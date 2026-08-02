/**
 * WGSL module assembly for a ShaderEffect body — the WGSL counterpart of
 * `glsl_realization.js`'s source templating. The user body is embedded
 * VERBATIM (WGSL module-scope declarations are order-independent); the
 * scaffold contributes the vertex/fragment entry points over the frozen
 * 28-byte quad layout, the frame-globals and material groups, and the
 * builtin declarations the parser detected.
 *
 * Frozen conventions carried over from the core quad shader:
 * - clip-z remap `(z + w) * 0.5` (GL-convention [-w, w] → WebGPU [0, w])
 * - packed-ARGB attribute read as (B,G,R,A) → `.bgr * .a` premultiply
 * - `screen_uv` is y-down (`0.5 - ndc.y * 0.5`): WebGPU texture row 0 is
 *   the top, so the capture is sampled without any flip
 * @ignore
 */

/**
 * builtin group-3 bindings are assigned ABOVE the highest user binding so
 * they can never collide: ME uniform first, then the capture texture and
 * its sampler variants
 * @param {object} parsed - the parseWGSLBody result
 * @returns {{me: number, screenTexture: number, screenSamplerClamp: number, screenSamplerRepeat: number}}
 *   assigned binding indices (-1 when the builtin is unused)
 * @ignore
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
	if (parsed.builtins.noiseUV) {
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
 */
export function buildWGSLModule(body, parsed) {
	const builtins = parsed.builtins;
	const bindings = assignBuiltinBindings(parsed);

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
	if (builtins.noiseUV) {
		scaffold.push(
			"var<private> noise_uv : vec2f;",
			"struct MEBuiltins {",
			"\tsize_obj : vec2f,",
			"\tsize_img : vec2f,",
			"\toffset : vec2f,",
			"};",
			`@group(3) @binding(${bindings.me}) var<uniform> ME : MEBuiltins;`,
		);
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
		"};",
		"",
		"@vertex",
		"fn vertex_main(",
		"\t@location(0) aVertex : vec3f,",
		"\t@location(1) aRegion : vec2f,",
		"\t@location(2) aColor : vec4f,",
		"\t@location(3) aTextureId : f32,",
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
		...(builtins.noiseUV
			? [
					"\tout.vNoiseUV = aRegion * (ME.size_img / ME.size_obj) - ME.offset / ME.size_obj;",
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
		"\tlet texColor = textureSample(uTexture, uSampler, in.vRegion) * in.vColor;",
		"\treturn apply(texColor, in.vRegion);",
		"}",
	);

	return { code: scaffold.join("\n"), bindings };
}
