/**
 * Splicing a ShaderEffect body into the engine's own mesh shaders (#1658).
 *
 * A `ShaderEffect` is realized against the QUAD vertex contract: a fixed
 * attribute layout and a vertex stage that projects straight from
 * `uProjectionMatrix`. A mesh supplies geometry in MODEL space and needs
 * `projection × view × model`, so the quad realization cannot host one — on
 * WebGL it drew the mesh unplaced and without the camera (the mesh batcher
 * warns about exactly that), and on WebGPU it was refused outright.
 *
 * Rather than assemble a second full mesh program per backend — which would
 * duplicate the fog and lighting math that `mesh.frag` / `mesh.wgsl` warn
 * must be "kept in step" — the effect body is spliced INTO the engine's own
 * mesh shader. Each of those shaders declares an identity hook:
 *
 * - GLSL: `vec4 ME_effect(vec4 c, vec2 uv) { return c; }`
 * - WGSL: `fn ME_effect(c : vec4f, uv : vec2f) -> vec4f { return c; }`
 *
 * and calls it in its fragment stage after the tint, before lighting and fog.
 * Splicing pastes the body and redefines the hook to call its `apply()`;
 * nothing here has to know which colour variable is in scope, because the
 * shader's own call site already names it. Compilers inline the identity
 * form, so an un-effected mesh pays nothing.
 *
 * It is a FUNCTION rather than a marker comment on purpose: the shader build
 * pipeline strips comments, so a comment cannot be relied on to reach this
 * code at all. The hook is also declared ABOVE `@vertex` in the WGSL sources,
 * because `buildInstancedMeshWGSL` drops everything between the two stages.
 *
 * The effect therefore becomes a COLOUR HOOK: the mesh keeps its own
 * placement, alpha cutout, lighting and fog, and the body transforms the
 * surface colour on its way through. That is the same contract on both
 * backends.
 *
 * The 2D quad path is untouched by any of this — `buildGLSLProgram` and
 * `buildWGSLModule` still assemble exactly what they did before, so a
 * `ShaderEffect` on a `Sprite` compiles the same text it always has.
 * @ignore
 * @internal
 */

/**
 * The identity hook each mesh shader declares, in both languages. Matching is
 * whitespace-tolerant because the shader pipeline reformats as it strips
 * comments — which is also why the hook is a FUNCTION rather than a marker
 * comment: comments do not survive to the splicer.
 */
const HOOKS = [
	{
		pattern:
			/vec4\s+ME_effect\s*\(\s*vec4\s+c\s*,\s*vec2\s+uv\s*\)\s*\{[^}]*\}/,
		replacement: "vec4 ME_effect(vec4 c, vec2 uv) { return apply(c, uv); }",
	},
	{
		pattern:
			/fn\s+ME_effect\s*\(\s*c\s*:\s*vec4f\s*,\s*uv\s*:\s*vec2f\s*\)\s*->\s*vec4f\s*\{[^}]*\}/,
		replacement:
			"fn ME_effect(c : vec4f, uv : vec2f) -> vec4f { return apply(c, uv); }",
	},
];

/**
 * Builtins that a quad can offer an effect but a mesh cannot, with the
 * reason. `noise_uv` is derived from the quad's own image/object sizes
 * (`ME.size_obj`, `ME.size_img`), which a mesh has no equivalent of;
 * `screen_uv` / `screen_texture` need a capture the mesh tier does not
 * take.
 * @ignore
 * @internal
 */
const MESH_UNSUPPORTED = {
	noiseUV: "`noise_uv` (derived from a quad's image and object size)",
	screenUV: "`screen_uv` (needs the screen capture the quad tier takes)",
	screenTexture: "`screen_texture` (needs the screen capture)",
};

/**
 * Why this body cannot be hosted on a mesh, or `null` when it can.
 *
 * Returned rather than thrown so the caller can warn once and fall back to
 * the built-in shading — the effect contract is warn-and-degrade, never a
 * mesh that stops drawing.
 * @param {object} builtins - the parsed builtin-usage flags
 * @param {Array} [textures] - the body's declared texture/sampler pairs
 * @param {string} [language] - "wgsl" or "glsl"; a few builtins differ
 * @returns {string|null} the reason, or null when the body is hostable
 * @ignore
 * @internal
 */
export function meshHostingBlocker(builtins, textures, language) {
	// `vColor` is language-split, so it cannot live in the table above. The
	// GLSL mesh shaders declare `varying vec4 vColor` themselves, so a body
	// reading it works unchanged. The WGSL module has no module-scope
	// equivalent — the quad scaffold shims one in as a `var<private>` — so a
	// body referencing it assembles into a module that fails to compile, and
	// the mesh path has no validity fallback to catch that.
	if (language === "wgsl" && builtins?.vColor === true) {
		return "it reads `vColor`, which only the 2D quad tier exposes to an effect body";
	}
	// Extra samplers are refused on BOTH backends rather than working on one:
	// they are resolved by the quad tier's per-effect device state
	// (`setTexture` residency, the screen-capture stub), which the mesh path
	// has no equivalent of. Uniforms — the animation surface `setUniform` /
	// `setTime` drive — are fully supported.
	if (Array.isArray(textures) && textures.length > 0) {
		return "it declares its own texture samplers, which a mesh-hosted effect cannot bind yet — uniforms are supported, textures are not";
	}
	if (typeof builtins !== "object" || builtins === null) {
		return null;
	}
	const blocked = Object.keys(MESH_UNSUPPORTED)
		.filter((flag) => {
			return builtins[flag] === true;
		})
		.map((flag) => {
			return MESH_UNSUPPORTED[flag];
		});
	return blocked.length === 0
		? null
		: `it uses ${blocked.join(" and ")}, which only the 2D quad tier provides`;
}

/**
 * Whether a mesh shader source declares the effect hook.
 * @param {string} source - the shader text
 * @returns {boolean} true when an effect can be spliced into it
 * @ignore
 * @internal
 */
export function hasSpliceMarkers(source) {
	return (
		typeof source === "string" &&
		HOOKS.some((hook) => {
			return hook.pattern.test(source);
		})
	);
}

/**
 * Splice an effect body into a mesh shader source.
 *
 * The shader already calls `ME_effect()` at the right point in its fragment
 * stage — after the tint, before lighting and fog — so all this does is paste
 * the body and redefine the hook to call its `apply()`. Nothing has to know
 * which colour variable is in scope, because the shader's own call site
 * already names it.
 *
 * Returns `null` when the source declares no hook rather than throwing: a
 * batcher can be driven with a substitute source (a test stub, a family that
 * has not adopted the hook), and the effect contract is warn-and-degrade —
 * never a mesh that stops drawing, and never an exception out of the middle
 * of a frame.
 * @param {string} source - the engine mesh shader text (GLSL or WGSL)
 * @param {string} body - the user effect body, pasted verbatim
 * @returns {string|null} the spliced source, or null when unsupported
 * @ignore
 * @internal
 */
export function spliceEffect(source, body) {
	if (typeof source !== "string" || typeof body !== "string") {
		return null;
	}
	for (const hook of HOOKS) {
		if (hook.pattern.test(source)) {
			return source.replace(hook.pattern, () => {
				return `${body}\n${hook.replacement}`;
			});
		}
	}
	return null;
}

/**
 * Shift every `@group(3)` binding in a body by `shift`.
 *
 * A quad effect declares its uniform block at `@group(3) @binding(0)` and its
 * samplers above that — but on a mesh, group 3 binding 0 is `uMesh`. WebGPU
 * caps a pipeline at four bind groups and the backend has all four spoken for
 * (frame / material / lights / per-draw), so the effect cannot simply move to
 * a group of its own: it shares group 3, one binding higher.
 *
 * The body is embedded verbatim, so the renumbering is textual — the same
 * reason the declarations are pasted rather than re-emitted.
 * @param {string} body - the user WGSL body
 * @param {number} shift - how far to move each binding
 * @returns {string} the body with its group-3 bindings renumbered
 * @ignore
 * @internal
 */
export function shiftGroup3(body, shift) {
	return body.replace(
		/@group\(\s*3\s*\)\s*@binding\(\s*(\d+)\s*\)/g,
		(_match, binding) => {
			return `@group(3) @binding(${Number(binding) + shift})`;
		},
	);
}
