import {
	INSTANCE_ATTRIBUTE_NAMES,
	INSTANCE_SLOT_OFFSETS,
} from "../../gpu/instancerecord.ts";

/**
 * Derive an instanced mesh WGSL module from the ordinary one (#1508).
 *
 * WGSL has no preprocessor, and a module carries **both** entry points in
 * one file — so an instanced variant cannot be a second vertex file the way
 * it is on the WebGL side. Rather than copy the module (which for the lit
 * tier would duplicate the whole lighting loop, and the `Light3dBlock`
 * layout that must agree byte-for-byte with the uniform packer), this
 * rewrites the shared source:
 *
 * - everything before `@vertex` is kept — structs, bindings, `VSOut` —
 *   with one extra inter-stage field when the custom slot is in play;
 * - the vertex stage is replaced with one that reads the per-instance
 *   attributes and applies them;
 * - the fragment stage is kept **verbatim**, apart from one substitution
 *   that folds the per-instance slot into the emissive term.
 *
 * So the lighting loop, the light block and the alpha-cutout rule exist in
 * exactly one place, and an instanced mesh shades identically to its
 * uninstanced twin by construction rather than by review.
 *
 * Shader locations for the instance slots are **pinned**
 * (`INSTANCE_SLOT_OFFSETS`), so a variant that omits the colour slot does
 * not renumber the data slot.
 * @param {string} source - the ordinary module (`mesh.wgsl` / `mesh-lit.wgsl`)
 * @param {object} options - variant options
 * @param {number} options.baseLocation - first vertex location after the tier's geometry attributes
 * @param {number} options.varyingLocation - first free inter-stage location in `VSOut`
 * @param {boolean} options.hasColor - whether the per-instance colour slot is present
 * @param {boolean} options.hasData - whether the per-instance custom slot is present
 * @param {string} options.geometryInputs - the tier's geometry attribute declarations
 * @param {string} options.body - the tier's placement body, which reads the `instance` matrix the generated preamble declares and must leave a `clip` value for the shared tail
 * @returns {string} the instanced module text
 * @ignore
 * @internal
 */
export function buildInstancedMeshWGSL(source, options) {
	const {
		baseLocation,
		varyingLocation,
		hasColor,
		hasData,
		geometryInputs,
		body,
	} = options;

	// match the entry points at the START of a line: `@vertex` mentioned in a
	// doc comment would otherwise slice the module in the wrong place
	const vertexAt = source.search(/^@vertex\b/m);
	const fragmentAt = source.search(/^@fragment\b/m);
	if (vertexAt < 0 || fragmentAt < 0 || fragmentAt < vertexAt) {
		throw new Error(
			"buildInstancedMeshWGSL: the source module must declare both stages, vertex first",
		);
	}

	let head = source.slice(0, vertexAt);
	let fragment = source.slice(fragmentAt);

	// the custom slot travels to the fragment stage as one more varying, and
	// is folded into the term the fragment already adds after shading
	if (hasData) {
		head = head.replace(
			/(struct VSOut \{[\s\S]*?)\n\};/,
			`$1\n\t// per-instance custom slot; this built-in shading reads its\n\t// rgb as emissive (a custom module may read it as anything)\n\t@location(${varyingLocation}) vInstanceData : vec4f,\n};`,
		);
		const emissive = "uMesh.emissive.rgb";
		if (!fragment.includes(emissive)) {
			throw new Error(
				"buildInstancedMeshWGSL: the fragment stage no longer reads `uMesh.emissive.rgb` — the per-instance emissive substitution needs updating",
			);
		}
		fragment = fragment.replaceAll(
			emissive,
			"(uMesh.emissive.rgb + in.vInstanceData.rgb)",
		);
	}

	const rows = INSTANCE_ATTRIBUTE_NAMES.rows;
	const inputs = [geometryInputs];
	rows.forEach((name, i) => {
		inputs.push(
			`\t@location(${baseLocation + INSTANCE_SLOT_OFFSETS.rows[i]}) ${name} : vec4f,`,
		);
	});
	if (hasColor) {
		inputs.push(
			`\t@location(${baseLocation + INSTANCE_SLOT_OFFSETS.color}) ${INSTANCE_ATTRIBUTE_NAMES.color} : vec4f,`,
		);
	}
	if (hasData) {
		inputs.push(
			`\t@location(${baseLocation + INSTANCE_SLOT_OFFSETS.data}) ${INSTANCE_ATTRIBUTE_NAMES.data} : vec4f,`,
		);
	}

	const vertex = [
		"@vertex",
		"fn vertex_main(",
		inputs.join("\n"),
		") -> VSOut {",
		"\tvar out : VSOut;",
		"\t// The instance transform arrives as three ROW-major vec4 rows, not a",
		"\t// full mat4: the bottom row of an affine matrix is always (0,0,0,1),",
		"\t// so storing it would waste 16 bytes and an attribute slot per",
		"\t// instance. mat4x4f takes COLUMNS, hence the transpose.",
		"\tlet instance = mat4x4f(",
		`\t\tvec4f(${rows[0]}.x, ${rows[1]}.x, ${rows[2]}.x, 0.0),`,
		`\t\tvec4f(${rows[0]}.y, ${rows[1]}.y, ${rows[2]}.y, 0.0),`,
		`\t\tvec4f(${rows[0]}.z, ${rows[1]}.z, ${rows[2]}.z, 0.0),`,
		`\t\tvec4f(${rows[0]}.w, ${rows[1]}.w, ${rows[2]}.w, 1.0));`,
		body,
		"\t// GL-convention clip z in [-w, w] remapped to WebGPU's [0, w]",
		"\tout.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);",
		hasColor
			? `\tlet tinted = aColor * uMesh.tint * ${INSTANCE_ATTRIBUTE_NAMES.color};`
			: "\tlet tinted = aColor * uMesh.tint;",
		"\t// tint first, then premultiply — matches the fragment's expectation",
		"\tout.vColor = vec4f(tinted.rgb * tinted.a, tinted.a);",
		"\tout.vRegion = aRegion;",
		hasData ? `\tout.vInstanceData = ${INSTANCE_ATTRIBUTE_NAMES.data};` : null,
		"\treturn out;",
		"}",
		"",
		"",
	]
		.filter((line) => {
			return line !== null;
		})
		.join("\n");

	const module = head + vertex + fragment;

	// The generated vertex stage hard-codes which VSOut members it writes, so
	// a member added to the shared source would silently arrive as zeros in
	// the fragment stage (WGSL zero-initializes `var out : VSOut`). Fail
	// instead — every declared member must be assigned.
	const struct = /struct VSOut \{([\s\S]*?)\n\};/.exec(head);
	if (struct !== null) {
		const generated = module.slice(module.search(/^@vertex\b/m));
		for (const [, member] of struct[1].matchAll(
			/@location\(\d+\)\s+(\w+)\s*:/g,
		)) {
			if (!generated.includes(`out.${member}`)) {
				throw new Error(
					`buildInstancedMeshWGSL: VSOut member "${member}" is never written by the generated vertex stage — the derived module has drifted from its source`,
				);
			}
		}
		// and no two members may share an inter-stage location
		const locations = [...struct[1].matchAll(/@location\((\d+)\)/g)].map(
			(m) => {
				return m[1];
			},
		);
		if (new Set(locations).size !== locations.length) {
			throw new Error(
				"buildInstancedMeshWGSL: duplicate @location in the derived VSOut",
			);
		}
	}

	return module;
}

/**
 * the unlit tier's geometry inputs and placement body
 * @ignore
 * @internal
 */
export const UNLIT_INSTANCED = {
	baseLocation: 3,
	// 2 is vFogDepth in the base module now; the instance slot follows it
	varyingLocation: 3,
	geometryInputs: [
		"\t@location(0) aVertex : vec3f,",
		"\t@location(1) aRegion : vec2f,",
		"\t@location(2) aColor : vec4f,",
	].join("\n"),
	body: [
		"\tlet clip = uFrame.projection * uMesh.view * uMesh.model * instance",
		"\t\t* vec4f(aVertex, 1.0);",
		"\t// radial view-space distance for distance fog, behind the same",
		"\t// pipeline-overridable constant the base module declares",
		"\tif (enable_fog) {",
		"\t\tlet viewPos = uMesh.view * uMesh.model * instance * vec4f(aVertex, 1.0);",
		"\t\tout.vFogDepth = length(viewPos.xyz)",
		"\t\t\t* fog_height_factor(viewPos.xyz);",
		"\t} else {",
		"\t\tout.vFogDepth = 0.0;",
		"\t}",
	].join("\n"),
};

/**
 * the lit tier's geometry inputs, placement body and normal handling
 * @ignore
 * @internal
 */
export const LIT_INSTANCED = {
	baseLocation: 4,
	// 4 is vFogDepth in the base module now; the instance slot follows it
	varyingLocation: 5,
	geometryInputs: [
		"\t@location(0) aVertex : vec3f,",
		"\t@location(1) aRegion : vec2f,",
		"\t@location(2) aColor : vec4f,",
		"\t@location(3) aNormal : vec3f,",
	].join("\n"),
	body: [
		"\tlet worldPos = uMesh.model * instance * vec4f(aVertex, 1.0);",
		"\tlet clip = uFrame.projection * uMesh.view * worldPos;",
		"\tout.vWorldPos = worldPos.xyz;",
		"\t// radial view-space distance for distance fog, behind the same",
		"\t// pipeline-overridable constant the base module declares",
		"\tif (enable_fog) {",
		"\t\tlet viewPos = (uMesh.view * worldPos).xyz;",
		"\t\tout.vFogDepth = length(viewPos) * fog_height_factor(viewPos);",
		"\t} else {",
		"\t\tout.vFogDepth = 0.0;",
		"\t}",
		"\t// Rotate the normal through BOTH transforms, in the order the",
		"\t// position takes them. Non-uniform scale is approximated exactly as",
		"\t// the uninstanced path approximates it, so an instanced mesh shades",
		"\t// like its uninstanced twin rather than subtly differently.",
		"\tlet m = uMesh.model;",
		"\tlet mi = mat3x3f(instance[0].xyz, instance[1].xyz, instance[2].xyz);",
		"\tout.vNormal = mat3x3f(m[0].xyz, m[1].xyz, m[2].xyz) * mi * aNormal;",
	].join("\n"),
};
