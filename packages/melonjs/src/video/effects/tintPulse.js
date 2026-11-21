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
 * A shader effect that pulses a color overlay on the sprite.
 * Commonly used for status effects — poison green, freeze blue, fire red.
 * The time should be updated each frame, with `setTime()`, for the pulse
 * animation.
 *
 * A tint is a color matrix, here one that follows the time: it is drawn by
 * the shader of {@link ColorMatrixEffect}, which every pulse shares.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // poison pulse
 * const poison = new TintPulseEffect(renderer, {
 *     color: [0.0, 1.0, 0.0],
 *     speed: 3.0,
 * });
 * mySprite.addPostEffect(poison);
 *
 * // update each frame
 * poison.setTime(timer.getTime() / 1000);
 * @example
 * // a subtle pulse: the color's alpha caps how far it tints
 * mySprite.addPostEffect(new TintPulseEffect(renderer, { color: [1.0, 0.8, 0.0, 0.35] }));
 */
export default class TintPulseEffect extends ColorMatrixEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 0.0, 0.0]] - pulse color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 * @param {number} [options.speed=2.0] - pulse speed (oscillations per second)
	 * @param {number} [options.intensity=0.3] - maximum tint strength (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(renderer);

		/**
		 * the pulse color, as [r, g, b, a]
		 * @ignore
		 * @internal
		 */
		this._color = rgba(options.color ?? [1.0, 0.0, 0.0]);

		/**
		 * pulse speed, in oscillations per second
		 * @type {number}
		 */
		this.speed = options.speed ?? 2.0;

		/**
		 * maximum tint strength (0.0–1.0)
		 * @type {number}
		 */
		this.intensity = options.intensity ?? 0.3;

		/**
		 * the time the pulse is drawn at, in seconds
		 * @ignore
		 * @internal
		 */
		this._time = 0;

		this._pulse();
	}

	/**
	 * set the pulse color
	 * @param {number[]} color - pulse color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the intensity
	 */
	setColor(color) {
		this._color = rgba(color);
		this._pulse();
	}

	/**
	 * Set the time the pulse is drawn at: call it once per frame.
	 * @param {number} seconds - elapsed time, in seconds
	 */
	setTime(seconds) {
		this._time = seconds;
		this._pulse();
	}

	/**
	 * The pulse had a shader of its own, with these four uniforms: a game
	 * that set them by name keeps working.
	 * @param {string} name - the uniform's name
	 * @param {*} value - its value
	 * @ignore
	 */
	setUniform(name, value) {
		if (name === "uTime") {
			this.setTime(value);
		} else if (name === "uPulseColor") {
			this.setColor(value);
		} else if (name === "uPulseSpeed") {
			this.speed = value;
			this._pulse();
		} else if (name === "uPulseIntensity") {
			this.intensity = value;
			this._pulse();
		} else {
			super.setUniform(name, value);
		}
	}

	/**
	 * the matrix of the tint at the current time: from none to `intensity`
	 * and back, `speed` times a second
	 * @ignore
	 * @internal
	 */
	_pulse() {
		const wave = Math.sin(this._time * this.speed * Math.PI * 2) * 0.5 + 0.5;
		this._blendToward(this._color, wave * this.intensity);
	}
}
