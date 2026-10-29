/**
 * WGSL module assembly for a ShaderEffect body — the WGSL counterpart of
 * `glsl_realization.js`'s source templating. The user body is embedded
 * VERBATIM (WGSL module-scope declarations are order-independent); the
 * scaffold contributes the vertex/fragment entry points over the frozen
 * 36-byte quad layout, the frame-globals and material groups, and the
 * builtin declarations the parser detected.
 *
 * Frozen conventions carried over from the core quad shader:
 * - clip-z remap `(z + w) * 0.5` (GL-convention [-w, w] → WebGPU [0, w])
 * - packed-ARGB attribute read as (B,G,R,A) → `.bgr * .a` premultiply
 * - `screen_uv` is y-down (`0.5 - ndc.y * 0.5`): WebGPU texture row 0 is
 *   the top, so the capture is sampled without any flip
 * @ignore
 * @internal
 */

import {
	LOCAL_HELPERS_WGSL,
	localVertexStatementsWGSL,
	ME_STRUCT_WGSL,
} from "../local_space.js";

/**
 * reads of the frame uniform by frame.js's FRAME_WGSL helpers (not of
 * `fx.ME_frame_half`: no word boundary inside the longer name)
 * @ignore
 */
const SPRITE_FRAME_READ = /\bfx\.ME_frame\b/;
/**
 * @ignore
 */
const SPRITE_FRAME_READS = /\bfx\.ME_frame\b/g;

/**
 * builtin group-3 bindings are assigned ABOVE the highest user binding so
 * they can never collide: ME uniform first, then the capture texture and
 * its sampler variants
 * @param {object} parsed - the parseWGSLBody result
 * @returns {{me: number, screenTexture: number, screenSamplerClamp: number, screenSamplerRepeat: number}}
 *   assigned binding indices (-1 when the builtin is unused)
 * @ignore
 * @internal
 */
export function assignBuiltinBindings(parsed) {
	let next =
		Math.max(parsed.maxUserBinding, parsed.structSize > 0 ? 0 : -1) + 1;
	const bindings = {
		me: -1,
		screenTexture: -1,
		screenSamplerClamp: -1,
		screenSamplerRepeat: -1,
	};
	// the `MEBuiltins` block: `noise_uv`'s rect and the local space
	if (parsed.builtins.noiseUV || parsed.builtins.local) {
		bindings.me = next++;
	}
	if (parsed.builtins.screenTexture) {
		bindings.screenTexture = next++;
		if (parsed.builtins.screenSamplerClamp) {
			bindings.screenSamplerClamp = next++;
		}
		if (parsed.builtins.screenSamplerRepeat) {
			bindings.screenSamplerRepeat = next;
		}
	}
	return bindings;
}

/**
 * Assemble the complete WGSL module for an effect body.
 * @param {string} body - the user WGSL body (embedded verbatim)
 * @param {object} parsed - the parseWGSLBody result
 * @returns {{code: string, bindings: object}} the module text and the
 *   builtin binding assignment (consumed when building the bind group)
 * @ignore
 * @internal
 */
export function buildWGSLModule(body, parsed) {
	const builtins = parsed.builtins;
	const bindings = assignBuiltinBindings(parsed);
	// `noise_uv` and the local space both read the `MEBuiltins` block
	const space = builtins.noiseUV || builtins.local;
	// a body keeping its samples inside its frame (frame.js's FRAME_WGSL):
	// on a sprite the frame comes with the quad, so its reads of the
	// uniform become reads of the frame the vertex stage hands over. The
	// struct keeps the member, which a mesh hosting the body still reads
	const spriteFrame = SPRITE_FRAME_READ.test(body);
	if (spriteFrame) {
		body = body.replace(SPRITE_FRAME_READS, "ME_frame_v");
	}

	const scaffold = [
		"// ---- melonJS effect scaffold ----",
		"struct FrameUniforms {",
		"\tprojection : mat4x4<f32>,",
		"\tlineWidth : f32,",
		"};",
		"@group(0) @binding(0) var<uniform> uFrame : FrameUniforms;",
		"@group(1) @binding(0) var uTexture : texture_2d<f32>;",
		"@group(1) @binding(1) var uSampler : sampler;",
	];

	if (builtins.screenUV) {
		scaffold.push("var<private> screen_uv : vec2f;");
	}
	if (builtins.vColor) {
		// the interpolated tint, exposed under its GLSL varying name so
		// re-sampling bodies port literally
		scaffold.push("var<private> vColor : vec4f;");
	}
	if (spriteFrame) {
		scaffold.push("var<private> ME_frame_v : vec4f;");
	}
	if (builtins.noiseUV) {
		scaffold.push("var<private> noise_uv : vec2f;");
	}
	if (space) {
		scaffold.push(
			...ME_STRUCT_WGSL,
			`@group(3) @binding(${bindings.me}) var<uniform> ME : MEBuiltins;`,
		);
	}
	if (builtins.local) {
		scaffold.push(...LOCAL_HELPERS_WGSL);
	}
	if (builtins.screenTexture) {
		scaffold.push(
			`@group(3) @binding(${bindings.screenTexture}) var screen_texture : texture_2d<f32>;`,
		);
		if (builtins.screenSamplerClamp) {
			scaffold.push(
				`@group(3) @binding(${bindings.screenSamplerClamp}) var screen_sampler : sampler;`,
			);
		}
		if (builtins.screenSamplerRepeat) {
			scaffold.push(
				`@group(3) @binding(${bindings.screenSamplerRepeat}) var screen_sampler_repeat : sampler;`,
			);
		}
	}

	scaffold.push(
		"struct VSOut {",
		"\t@builtin(position) position : vec4f,",
		"\t@location(0) vRegion : vec2f,",
		"\t@location(1) vColor : vec4f,",
		...(builtins.screenUV ? ["\t@location(2) vScreenUV : vec2f,"] : []),
		...(builtins.noiseUV ? ["\t@location(3) vNoiseUV : vec2f,"] : []),
		...(spriteFrame ? ["\t@location(4) vFrame : vec4f,"] : []),
		...(builtins.local
			? ["\t@location(5) vLocal : vec2f,", "\t@location(6) vArt : vec2f,"]
			: []),
		"};",
		"",
		"@vertex",
		"fn vertex_main(",
		"\t@location(0) aVertex : vec3f,",
		"\t@location(1) aRegion : vec2f,",
		"\t@location(2) aColor : vec4f,",
		"\t@location(3) aTextureId : f32,",
		...(spriteFrame ? ["\t@location(4) aFrame : vec2f,"] : []),
		") -> VSOut {",
		"\tvar out : VSOut;",
		"\tlet clip = uFrame.projection * vec4f(aVertex, 1.0);",
		"\t// GL-convention clip z in [-w, w] -> WebGPU [0, w]",
		"\tout.position = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);",
		"\tout.vColor = vec4f(aColor.bgr * aColor.a, aColor.a);",
		"\tout.vRegion = aRegion;",
		...(builtins.screenUV
			? [
					"\tlet ndc = clip.xy / clip.w;",
					"\t// y-down: capture row 0 = screen top under WebGPU",
					"\tout.vScreenUV = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);",
				]
			: []),
		...(space ? localVertexStatementsWGSL(builtins) : []),
		...(spriteFrame
			? [
					"\tout.vFrame = select(",
					"\t\tvec4f(min(aRegion, aFrame), max(aRegion, aFrame)),",
					"\t\tvec4f(-1.0e6, -1.0e6, 1.0e6, 1.0e6),",
					"\t\taFrame.x < -5.0e5,",
					"\t);",
				]
			: []),
		"\treturn out;",
		"}",
		"",
		"// ---- user body (verbatim) ----",
		body,
		"",
		"@fragment",
		"fn fragment_main(in : VSOut) -> @location(0) vec4f {",
		...(builtins.screenUV ? ["\tscreen_uv = in.vScreenUV;"] : []),
		...(builtins.noiseUV ? ["\tnoise_uv = in.vNoiseUV;"] : []),
		...(builtins.local
			? ["\tME_local = in.vLocal;", "\tME_art = in.vArt;"]
			: []),
		...(builtins.vColor ? ["\tvColor = in.vColor;"] : []),
		...(spriteFrame
			? [
					// a side on the texture's own edge (within a hundredth of a
					// texel) has no frame past it, and is left unbounded
					"\tlet meEdge = fx.ME_frame_half * 0.02;",
					"\tME_frame_v = vec4f(",
					"\t\tselect(in.vFrame.x, -1.0e6, in.vFrame.x <= meEdge.x),",
					"\t\tselect(in.vFrame.y, -1.0e6, in.vFrame.y <= meEdge.y),",
					"\t\tselect(in.vFrame.z, 1.0e6, in.vFrame.z >= 1.0 - meEdge.x),",
					"\t\tselect(in.vFrame.w, 1.0e6, in.vFrame.w >= 1.0 - meEdge.y),",
					"\t);",
				]
			: []),
		"\tlet texColor = textureSample(uTexture, uSampler, in.vRegion) * in.vColor;",
		"\treturn apply(texColor, in.vRegion);",
		"}",
	);

	return { code: scaffold.join("\n"), bindings };
}
