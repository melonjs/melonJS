import { rgba } from "./rgba.js";
import ShaderEffect from "./shadereffect.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../canvas/canvas_renderer.js";
 * @import WebGLRenderer from "../webgl/webgl_renderer.js";
 * @import WebGPURenderer from "../webgpu/webgpu_renderer.js";
 * @import Renderer from "../renderer.js";
 */
// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct HologramUniforms {
	uHoloColor : vec4f,
	uHoloIntensity : f32,
	uTime : f32,
};
@group(3) @binding(0) var<uniform> fx : HologramUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	// scan line
	let scan = sin(uv.y * 200.0 + fx.uTime * 5.0) * 0.5 + 0.5;
	// flicker
	let flicker = 0.95 + 0.05 * sin(fx.uTime * 30.0);
	// color shift
	// the color's alpha scales how far the tint covers the sprite
	var holo = mix(color.rgb, fx.uHoloColor.rgb * color.a, fx.uHoloIntensity * fx.uHoloColor.a);
	holo *= (1.0 - scan * 0.15) * flicker;
	return vec4f(holo, color.a * flicker);
}
`;

/**
 * A shader effect that simulates a holographic projection with
 * horizontal scan lines, color shift, and flickering.
 * Commonly used for sci-fi UI, ghost/spirit characters, or tech displays.
 * The `time` uniform should be updated each frame for animation.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * const holo = new HologramEffect(renderer);
 * mySprite.addPostEffect(holo);
 * // update each frame
 * holo.setTime(performance.now() / 1000);
 * @example
 * // a faint cyan tint, the scan lines and flicker unchanged
 * mySprite.addPostEffect(new HologramEffect(renderer, { color: [0.1, 0.7, 1.0, 0.4] }));
 */
export default class HologramEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[0.1, 0.7, 1.0]] - hologram tint color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 * @param {number} [options.intensity=0.5] - effect intensity (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec4 uHoloColor;
			uniform float uHoloIntensity;
			uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) {
				// scan line
				float scan = sin(uv.y * 200.0 + uTime * 5.0) * 0.5 + 0.5;
				// flicker
				float flicker = 0.95 + 0.05 * sin(uTime * 30.0);
				// color shift
				// the color's alpha scales how far the tint covers the sprite
				vec3 holo = mix(color.rgb, uHoloColor.rgb * color.a, uHoloIntensity * uHoloColor.a);
				holo *= (1.0 - scan * 0.15) * flicker;
				return vec4(holo, color.a * flicker);
			}
			`,
			wgsl: wgslFragment,
		});

		const color = options.color ?? [0.1, 0.7, 1.0];
		this.setUniform("uHoloColor", rgba(color));
		this.setUniform("uHoloIntensity", options.intensity ?? 0.5);
		this.setUniform("uTime", 0.0);
	}

	/**
	 * set the hologram tint color
	 * @param {number[]} color - color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 */
	setColor(color) {
		this.setUniform("uHoloColor", rgba(color));
	}
}
