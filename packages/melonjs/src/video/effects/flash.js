import ColorMatrixEffect from "./colorMatrix.js";
import { rgba } from "./rgba.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../canvas/canvas_renderer.js";
 * @import WebGLRenderer from "../webgl/webgl_renderer.js";
 * @import WebGPURenderer from "../webgpu/webgpu_renderer.js";
 * @import Renderer from "../renderer.js";
 */

/**
 * A shader effect that flashes the sprite with a solid color.
 * Commonly used for hit feedback — flash white when the player takes damage.
 * The `intensity` controls how much of the flash color is mixed in
 * (0.0 = original sprite, 1.0 = fully colored).
 *
 * A flash is a color matrix: it is drawn by the shader of
 * {@link ColorMatrixEffect}, which every flash shares.
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
export default class FlashEffect extends ColorMatrixEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - flash color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 * @param {number} [options.intensity=0.0] - initial flash intensity (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(renderer);

		/**
		 * the flash color, as [r, g, b, a]
		 * @ignore
		 * @internal
		 */
		this._color = rgba(options.color ?? [1.0, 1.0, 1.0]);

		/**
		 * how much of the flash color is mixed in (0.0–1.0)
		 * @type {number}
		 */
		this.intensity = options.intensity ?? 0.0;

		this._blendToward(this._color, this.intensity);
	}

	/**
	 * set the flash intensity
	 * @param {number} value - flash intensity (0.0 = no flash, 1.0 = fully colored)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this._blendToward(this._color, this.intensity);
	}

	/**
	 * set the flash color
	 * @param {number[]} color - flash color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 */
	setColor(color) {
		this._color = rgba(color);
		this._blendToward(this._color, this.intensity);
	}

	/**
	 * The flash had a shader of its own, with these two uniforms: a game that
	 * set them by name keeps working.
	 * @param {string} name - the uniform's name
	 * @param {*} value - its value
	 * @ignore
	 */
	setUniform(name, value) {
		if (name === "uFlashIntensity") {
			// as given, not clamped: that is what the uniform did
			this.intensity = value;
			this._blendToward(this._color, this.intensity);
		} else if (name === "uFlashColor") {
			this.setColor(value);
		} else {
			super.setUniform(name, value);
		}
	}
}
