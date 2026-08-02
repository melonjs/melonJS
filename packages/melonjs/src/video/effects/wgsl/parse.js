import { computeUniformLayout } from "./layout.js";

/**
 * Declaration-only parser for a WGSL ShaderEffect body.
 *
 * The body is real WGSL, compiled verbatim inside the engine scaffold —
 * nothing is rewritten. This parser only reads declarations to learn what
 * the engine must provide around it:
 *
 * - `fn apply(color : vec4f, uv : vec2f) -> vec4f` — required entry point
 * - at most one `@group(3) @binding(0) var<uniform> <name> : <Struct>;`
 *   whose struct members become the `setUniform` names (offsets computed
 *   by the layout calculator — WebGPU has no reflection)
 * - extra `setTexture` samplers as texture/sampler PAIRS at explicit
 *   consecutive bindings: `@group(3) @binding(k) var t : texture_2d<f32>;`
 *   immediately followed by `@binding(k+1) var s : sampler;` (k ≥ 1)
 * - builtin identifiers activated on reference: `screen_uv`, `noise_uv`,
 *   `screen_texture` (+ `screen_sampler` / `screen_sampler_repeat`)
 *
 * Every failure mode returns `{ok: false, error}` — the effect then warns
 * and disables (the generalized missing-language behavior), it never
 * throws and never guesses at offsets.
 * @ignore
 */

const APPLY_FN = /\bfn\s+apply\s*\(/;
const UNIFORM_DECL =
	/@group\(\s*3\s*\)\s*@binding\(\s*0\s*\)\s*var\s*<\s*uniform\s*>\s*([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)\s*;/;
const RESOURCE_DECL =
	/@group\(\s*3\s*\)\s*@binding\(\s*(\d+)\s*\)\s*var\s+([A-Za-z_]\w*)\s*:\s*(texture_2d<f32>|sampler)\s*;/g;
const GROUP3_ANY = /@group\(\s*3\s*\)\s*@binding\(\s*(\d+)\s*\)/g;

/**
 * strip `//` line and `/* *\/` block comments so declarations inside
 * comments are never honored (scratch copy — the original compiles).
 * The block-comment pattern is the classic linear-time form — a lazy
 * `[\s\S]*?` backtracks polynomially on pathological inputs (ReDoS).
 * @ignore
 */
function stripComments(source) {
	return source
		.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, " ")
		.replace(/\/\/[^\n]*/g, " ");
}

/**
 * whether the body declares the identifier itself (a `var`/`let`/`const`
 * or struct member of that name) — the builtin then stays user-managed,
 * same contract as the GLSL side
 * @ignore
 */
function hasOwnDeclaration(source, name) {
	return new RegExp(
		`(?:\\bvar\\s*(?:<[^>]*>)?\\s+|\\blet\\s+|\\bconst\\s+)${name}\\s*[:=]`,
	).test(source);
}

/**
 * Parse a WGSL effect body's declarations.
 * @param {string} body - the user WGSL body
 * @returns {object} `{ok: true, layout, structSize, uniformVar, textures, builtins, maxUserBinding}`
 *   or `{ok: false, error}`
 * @ignore
 */
export function parseWGSLBody(body) {
	const source = stripComments(body);

	if (!APPLY_FN.test(source)) {
		return {
			ok: false,
			error:
				"a WGSL effect body must define `fn apply(color : vec4f, uv : vec2f) -> vec4f`",
		};
	}

	// ---- the (optional) uniform struct at @group(3) @binding(0) ----------
	let layout = new Map();
	let structSize = 0;
	let uniformVar = null;
	const uniform = UNIFORM_DECL.exec(source);
	if (uniform !== null) {
		const structName = uniform[2];
		const struct = new RegExp(`struct\\s+${structName}\\s*\\{([^}]*)\\}`).exec(
			source,
		);
		if (struct === null) {
			return {
				ok: false,
				error: `uniform struct \`${structName}\` is not declared in the body`,
			};
		}
		const members = [];
		for (const entry of struct[1].split(",")) {
			const trimmed = entry.trim();
			if (trimmed === "") {
				continue;
			}
			const member = /^([A-Za-z_]\w*)\s*:\s*([A-Za-z0-9_<>,\s]+)$/.exec(
				trimmed,
			);
			if (member === null) {
				return {
					ok: false,
					error: `unsupported struct member declaration \`${trimmed}\``,
				};
			}
			members.push({ name: member[1], type: member[2].trim() });
		}
		const computed = computeUniformLayout(members);
		if (computed === null) {
			return {
				ok: false,
				error: `unsupported uniform member type in struct \`${structName}\` (supported: f32, i32, u32, vec2f, vec3f, vec4f, mat3x3f, mat4x4f, array<vec4f, N>)`,
			};
		}
		layout = computed.map;
		structSize = computed.size;
		uniformVar = uniform[1];
	}

	// ---- extra texture/sampler pairs at explicit group-3 bindings ---------
	const resources = [];
	RESOURCE_DECL.lastIndex = 0;
	for (const match of source.matchAll(RESOURCE_DECL)) {
		resources.push({
			binding: parseInt(match[1], 10),
			name: match[2],
			kind: match[3] === "sampler" ? "sampler" : "texture",
		});
	}
	resources.sort((a, b) => {
		return a.binding - b.binding;
	});
	const textures = [];
	const seen = new Set();
	for (let i = 0; i < resources.length; i++) {
		const resource = resources[i];
		if (resource.binding === 0 || seen.has(resource.binding)) {
			return {
				ok: false,
				error: `invalid or duplicate @group(3) @binding(${resource.binding})`,
			};
		}
		seen.add(resource.binding);
		if (resource.kind === "texture") {
			const sampler = resources[i + 1];
			if (
				typeof sampler === "undefined" ||
				sampler.kind !== "sampler" ||
				sampler.binding !== resource.binding + 1
			) {
				return {
					ok: false,
					error: `texture \`${resource.name}\` needs its sampler at @binding(${resource.binding + 1})`,
				};
			}
			seen.add(sampler.binding);
			textures.push({
				name: resource.name,
				binding: resource.binding,
				samplerName: sampler.name,
				samplerBinding: sampler.binding,
			});
			i++;
		} else {
			return {
				ok: false,
				error: `sampler \`${resource.name}\` at @binding(${resource.binding}) has no texture at @binding(${resource.binding - 1})`,
			};
		}
	}

	// any OTHER group-3 binding the regexes didn't classify is a shape we
	// can't build a bind group for
	let maxUserBinding = 0;
	GROUP3_ANY.lastIndex = 0;
	for (const match of source.matchAll(GROUP3_ANY)) {
		const binding = parseInt(match[1], 10);
		if (binding !== 0 && !seen.has(binding)) {
			return {
				ok: false,
				error: `unsupported declaration at @group(3) @binding(${binding}) (only one uniform struct at binding 0 and texture/sampler pairs are supported)`,
			};
		}
		maxUserBinding = Math.max(maxUserBinding, binding);
	}

	// ---- builtins, activated on reference -------------------------------
	const screenTexture =
		/\bscreen_texture\b/.test(source) &&
		!hasOwnDeclaration(source, "screen_texture");
	const builtins = {
		screenTexture,
		screenSamplerClamp: /\bscreen_sampler\b/.test(source),
		screenSamplerRepeat: /\bscreen_sampler_repeat\b/.test(source),
		screenUV:
			(screenTexture || /\bscreen_uv\b/.test(source)) &&
			!hasOwnDeclaration(source, "screen_uv"),
		noiseUV:
			/\bnoise_uv\b/.test(source) && !hasOwnDeclaration(source, "noise_uv"),
		// the interpolated tint (the GLSL `vColor` varying) — bodies that
		// re-sample the source texture reference it to re-apply the tint
		vColor: /\bvColor\b/.test(source) && !hasOwnDeclaration(source, "vColor"),
	};
	if (
		builtins.screenTexture &&
		!builtins.screenSamplerClamp &&
		!builtins.screenSamplerRepeat
	) {
		return {
			ok: false,
			error:
				"`screen_texture` is sampled through `screen_sampler` (clamp) or `screen_sampler_repeat` — reference one of them",
		};
	}

	return {
		ok: true,
		layout,
		structSize,
		uniformVar,
		textures,
		builtins,
		maxUserBinding,
	};
}
