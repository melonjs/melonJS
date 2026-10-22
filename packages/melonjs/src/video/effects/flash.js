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
struct FlashUniforms {
	uFlashColor : vec4f,
	uFlashIntensity : f32,
};
@group(3) @binding(0) var<uniform> fx : FlashUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	// the color's alpha scales how far the flash covers the sprite
	return vec4f(mix(color.rgb, fx.uFlashColor.rgb * color.a, fx.uFlashIntensity * fx.uFlashColor.a), color.a);
}
`;

/**
 * A shader effect that flashes the sprite with a solid color.
 * Commonly used for hit feedback — flash white when the player takes damage.
 * The `intensity` uniform controls how much of the flash color is mixed in
 * (0.0 = original sprite, 1.0 = fully colored).
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // create a white flash effect
 * const flash = new FlashEffect(renderer);
 * mySprite.addPostEffect(flash);
 *
 * // trigger the flash (e.g. on hit)
 * flash.setIntensity(1.0);
 *
 * // fade it out over time (e.g. in update loop)
 * flash.setIntensity(flash.intensity - dt / 200);
 * @example
 * // red flash
 * const flash = new FlashEffect(renderer, { color: [1.0, 0.0, 0.0] });
 * @example
 * // a hit flash that only half covers the sprite, even at full intensity
 * const hit = new FlashEffect(renderer, { color: [1.0, 1.0, 1.0, 0.5] });
 * hit.setIntensity(1.0);
 */
export default class FlashEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - flash color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 * @param {number} [options.intensity=0.0] - initial flash intensity (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec4 uFlashColor;
			uniform float uFlashIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				// the color's alpha scales how far the flash covers the sprite
				return vec4(mix(color.rgb, uFlashColor.rgb * color.a, uFlashIntensity * uFlashColor.a), color.a);
			}
			`,
			wgsl: wgslFragment,
		});

		const color = options.color ?? [1.0, 1.0, 1.0];
		this.intensity = options.intensity ?? 0.0;

		this.setUniform("uFlashColor", rgba(color));
		this.setUniform("uFlashIntensity", this.intensity);
	}

	/**
	 * set the flash intensity
	 * @param {number} value - flash intensity (0.0 = no flash, 1.0 = fully colored)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.setUniform("uFlashIntensity", this.intensity);
	}

	/**
	 * set the flash color
	 * @param {number[]} color - flash color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 */
	setColor(color) {
		this.setUniform("uFlashColor", rgba(color));
	}
}
