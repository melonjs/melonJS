import { ColorMatrix } from "../../../math/color_matrix.ts";
import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that applies a 4x4 color transformation matrix.
 * Provides chainable color adjustment methods that automatically update the GPU uniform.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // desaturate a sprite
 * mySprite.shader = new ColorMatrixEffect(renderer).saturate(0.0);
 * @example
 * // combine brightness + contrast on a camera
 * camera.shader = new ColorMatrixEffect(renderer).brightness(1.3).contrast(1.5);
 * @example
 * // update dynamically
 * effect.reset().brightness(1.5).saturate(0.5);
 */
export default class ColorMatrixEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {ColorMatrix} [options.matrix] - an initial color matrix. Defaults to identity.
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform mat4 uColorMatrix;
			vec4 apply(vec4 color, vec2 uv) {
				return uColorMatrix * color;
			}
			`,
		);

		/**
		 * the internal color matrix
		 * @ignore
		 */
		this._matrix = options.matrix || new ColorMatrix();
		this._syncUniform();
	}

	/**
	 * Push the current matrix values to the GPU.
	 * @ignore
	 */
	_syncUniform() {
		this.setUniform("uColorMatrix", this._matrix.val);
	}

	/**
	 * Reset the color matrix to identity (no color change).
	 * @returns {this} this instance for chaining
	 */
	reset() {
		this._matrix.identity();
		this._syncUniform();
		return this;
	}

	/**
	 * Apply a brightness adjustment.
	 * @param {number} amount - brightness multiplier (1.0 = normal, >1 brighter, <1 darker)
	 * @returns {this} this instance for chaining
	 */
	brightness(amount) {
		this._matrix.brightness(amount);
		this._syncUniform();
		return this;
	}

	/**
	 * Apply a contrast adjustment.
	 * @param {number} amount - contrast multiplier (1.0 = normal, >1 more contrast, <1 less)
	 * @returns {this} this instance for chaining
	 */
	contrast(amount) {
		this._matrix.contrast(amount);
		this._syncUniform();
		return this;
	}

	/**
	 * Apply a saturation adjustment.
	 * @param {number} amount - saturation level (0.0 = grayscale, 1.0 = normal, >1 over-saturated)
	 * @returns {this} this instance for chaining
	 */
	saturate(amount) {
		this._matrix.saturate(amount);
		this._syncUniform();
		return this;
	}

	/**
	 * Apply a hue rotation.
	 * @param {number} angle - rotation angle in radians
	 * @returns {this} this instance for chaining
	 */
	hueRotate(angle) {
		this._matrix.hueRotate(angle);
		this._syncUniform();
		return this;
	}

	/**
	 * Apply a sepia tone.
	 * @param {number} [amount=1.0] - sepia intensity (0.0 = original, 1.0 = full sepia)
	 * @returns {this} this instance for chaining
	 */
	sepia(amount = 1.0) {
		this._matrix.sepia(amount);
		this._syncUniform();
		return this;
	}

	/**
	 * Apply a color inversion.
	 * @param {number} [amount=1.0] - inversion amount (0.0 = original, 1.0 = fully inverted)
	 * @returns {this} this instance for chaining
	 */
	invertColors(amount = 1.0) {
		this._matrix.invertColors(amount);
		this._syncUniform();
		return this;
	}

	/**
	 * Multiply the current matrix by another color matrix.
	 * @param {ColorMatrix} matrix - the matrix to multiply with
	 * @returns {this} this instance for chaining
	 */
	multiply(matrix) {
		this._matrix.multiply(matrix);
		this._syncUniform();
		return this;
	}

	/**
	 * Multiplies the current matrix with a transform described by individual values.
	 * @param {number} a - value
	 * @param {number} b - value
	 * @param {number} c - value
	 * @param {number} d - value
	 * @param {number} e - value
	 * @param {number} f - value
	 * @param {number} [g] - value
	 * @param {number} [h] - value
	 * @param {number} [i] - value
	 * @param {number} [j] - value
	 * @param {number} [k] - value
	 * @param {number} [l] - value
	 * @param {number} [m] - value
	 * @param {number} [n] - value
	 * @param {number} [o] - value
	 * @param {number} [p] - value
	 * @returns {this} this instance for chaining
	 */
	transform(...args) {
		this._matrix.transform(...args);
		this._syncUniform();
		return this;
	}
}
