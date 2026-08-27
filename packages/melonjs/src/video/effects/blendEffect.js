import { advancedBlendModeIndex } from "../blendmodes.js";
import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform names,
// picked by the ShaderEffect base per renderer.shaderLanguage.
//
// Exported so the suite can run it through `parseWGSLBody` WITHOUT a device:
// headless chromium has no WebGPU, so a device-compiled check would skip in
// CI and this body could rot unnoticed between local runs.
//
// `backdrop` is bound by the renderer to its own frame capture (NOT the
// shared `: screen_texture` slot — see the class docblock), and sampled at
// `screen_uv`, which is y-DOWN here and y-UP in GLSL. That mismatch is
// deliberate and cancels out: the WebGPU capture is top-down and the GL
// capture bottom-up, so each backend's own convention lands on the same
// texel and NEITHER body flips.
export const wgslFragment = `
struct BlendUniforms {
	uBlendMode : f32,
};
@group(3) @binding(0) var<uniform> fx : BlendUniforms;
@group(3) @binding(1) var backdrop : texture_2d<f32>;
@group(3) @binding(2) var backdrop_sampler : sampler;

// HardLight(Cb, Cs) — also the kernel for Overlay, which the W3C spec
// defines as HardLight with the arguments swapped
fn ME_hardLight(b : vec3f, s : vec3f) -> vec3f {
	let lo = 2.0 * b * s;
	let hi = 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
	return mix(lo, hi, step(vec3f(0.5), s));
}

fn ME_softLight(b : vec3f, s : vec3f) -> vec3f {
	let d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(vec3f(0.25), b));
	let lo = b - (1.0 - 2.0 * s) * b * (1.0 - b);
	let hi = b + (2.0 * s - 1.0) * (d - b);
	return mix(lo, hi, step(vec3f(0.5), s));
}

// Cb == 0 wins over Cs == 1, so it is applied last
fn ME_colorDodge(b : vec3f, s : vec3f) -> vec3f {
	var r = min(vec3f(1.0), b / max(1.0 - s, vec3f(1e-4)));
	r = mix(r, vec3f(1.0), step(vec3f(1.0), s));
	return mix(r, vec3f(0.0), step(b, vec3f(0.0)));
}

// Cb == 1 wins over Cs == 0, so it is applied last
fn ME_colorBurn(b : vec3f, s : vec3f) -> vec3f {
	var r = 1.0 - min(vec3f(1.0), (1.0 - b) / max(s, vec3f(1e-4)));
	r = mix(r, vec3f(0.0), step(s, vec3f(0.0)));
	return mix(r, vec3f(1.0), step(vec3f(1.0), b));
}

fn ME_blend(b : vec3f, s : vec3f) -> vec3f {
	if (fx.uBlendMode < 0.5) { return abs(b - s); }
	if (fx.uBlendMode < 1.5) { return ME_hardLight(s, b); }
	if (fx.uBlendMode < 2.5) { return ME_hardLight(b, s); }
	if (fx.uBlendMode < 3.5) { return ME_colorDodge(b, s); }
	if (fx.uBlendMode < 4.5) { return ME_colorBurn(b, s); }
	if (fx.uBlendMode < 5.5) { return ME_softLight(b, s); }
	if (fx.uBlendMode < 6.5) { return min(b, s); }
	return max(b, s);
}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	// sampled BEFORE any branch, so plain textureSampleLevel is safe here
	let Cb = textureSampleLevel(backdrop, backdrop_sampler, screen_uv, 0.0).rgb;
	let a = color.a;
	let Cs = color.rgb / max(a, 1e-4);
	let B = clamp(ME_blend(Cb, Cs), vec3f(0.0), vec3f(1.0));
	return vec4f(a * B, a);
}
`;

/**
 * The compositing shader behind the six CSS blend modes that fixed-function
 * blending cannot express: `overlay`, `hard-light`, `color-dodge`,
 * `color-burn`, `soft-light` and `difference`.
 *
 * Internal — owned by the renderer, one instance per renderer, never
 * constructed or configured by user code. A game selects a mode the ordinary
 * way (`sprite.blendMode = "overlay"`, or `renderer.setBlendMode("overlay")`)
 * and the renderer drives this effect from there.
 *
 * ### How it composites
 *
 * The renderer captures the destination, renders the draw to an offscreen
 * target, then blits that target through this effect. Everything arriving in
 * `color` is PREMULTIPLIED (the offscreen was drawn source-over into a
 * transparent clear), while the W3C formulas are defined on straight colour —
 * so the body un-premultiplies, blends, and re-premultiplies.
 *
 * Emitting premultiplied and letting ordinary source-over run the composite
 * yields `as*B + (1-as)*Cb` and a correct output alpha for free. It also keeps
 * the premultiplied invariant `rgb <= a` — a texel with `rgb > a` is undefined
 * and diverges across browsers — which is why `B` is clamped even though all
 * six formulas land in `[0,1]` analytically.
 *
 * The backdrop is treated as opaque (`ab = 1`). The GL capture is an RGB
 * texture so that is true by construction there; the WebGPU capture preserves
 * alpha and is deliberately ignored, so the two backends agree.
 *
 * ### Why not the `: screen_texture` builtin
 *
 * That annotation wires the sampler to the renderer's SHARED capture slot,
 * which `drawImage` already refreshes on behalf of any custom shader that
 * samples the screen. A renderable carrying an advanced blend mode AND a
 * screen-sampling {@link ShaderEffect} would then have the two fighting over
 * one texture. This declares a plain sampler instead and the renderer binds
 * its own capture, so the two are independent. Referencing `screen_uv` still
 * activates that varying on its own.
 * @see {@link https://www.w3.org/TR/compositing-1/#blending}
 * @ignore
 */
export default class BlendEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl/webgl_renderer.js").default|import("../webgpu/webgpu_renderer.js").default} renderer - the renderer that owns this effect
	 */
	constructor(renderer) {
		super(renderer, {
			glsl: `
			uniform sampler2D backdrop;
			uniform float uBlendMode;

			// HardLight(Cb, Cs) — also the kernel for Overlay, which the W3C
			// spec defines as HardLight with the arguments swapped
			vec3 ME_hardLight(vec3 b, vec3 s) {
				vec3 lo = 2.0 * b * s;
				vec3 hi = 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
				return mix(lo, hi, step(vec3(0.5), s));
			}

			vec3 ME_softLight(vec3 b, vec3 s) {
				vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(vec3(0.25), b));
				vec3 lo = b - (1.0 - 2.0 * s) * b * (1.0 - b);
				vec3 hi = b + (2.0 * s - 1.0) * (d - b);
				return mix(lo, hi, step(vec3(0.5), s));
			}

			// Cb == 0 wins over Cs == 1, so it is applied last
			vec3 ME_colorDodge(vec3 b, vec3 s) {
				vec3 r = min(vec3(1.0), b / max(1.0 - s, vec3(1e-4)));
				r = mix(r, vec3(1.0), step(vec3(1.0), s));
				return mix(r, vec3(0.0), step(b, vec3(0.0)));
			}

			// Cb == 1 wins over Cs == 0, so it is applied last
			vec3 ME_colorBurn(vec3 b, vec3 s) {
				vec3 r = 1.0 - min(vec3(1.0), (1.0 - b) / max(s, vec3(1e-4)));
				r = mix(r, vec3(0.0), step(s, vec3(0.0)));
				return mix(r, vec3(1.0), step(vec3(1.0), b));
			}

			vec3 ME_blend(vec3 b, vec3 s) {
				if (uBlendMode < 0.5) { return abs(b - s); }
				if (uBlendMode < 1.5) { return ME_hardLight(s, b); }
				if (uBlendMode < 2.5) { return ME_hardLight(b, s); }
				if (uBlendMode < 3.5) { return ME_colorDodge(b, s); }
				if (uBlendMode < 4.5) { return ME_colorBurn(b, s); }
				if (uBlendMode < 5.5) { return ME_softLight(b, s); }
				if (uBlendMode < 6.5) { return min(b, s); }
				return max(b, s);
			}

			vec4 apply(vec4 color, vec2 uv) {
				vec3 Cb = texture2D(backdrop, screen_uv).rgb;
				float a = color.a;
				vec3 Cs = color.rgb / max(a, 1e-4);
				vec3 B = clamp(ME_blend(Cb, Cs), 0.0, 1.0);
				return vec4(a * B, a);
			}
			`,
			wgsl: wgslFragment,
		});

		this.setUniform("uBlendMode", 0.0);
	}

	/**
	 * Select which of the six formulas the shader evaluates.
	 * @param {string} mode - one of the modes in {@link ADVANCED_BLEND_MODES}
	 * @returns {boolean} false when the mode is not an advanced blend mode, in
	 * which case the uniform is left untouched
	 * @ignore
	 */
	setBlendMode(mode) {
		const index = advancedBlendModeIndex(mode);
		if (index === -1) {
			return false;
		}
		this.setUniform("uBlendMode", index);
		return true;
	}
}
