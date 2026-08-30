import ColorMatrixEffect from "./colorMatrix.js";

/**
 * A shader effect that inverts the colors of the sprite.
 * Commonly used for damage feedback, negative image, or X-ray effects.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * mySprite.addPostEffect(new InvertEffect(renderer));
 * @example
 * // partial inversion
 * mySprite.addPostEffect(new InvertEffect(renderer, { intensity: 0.5 }));
 */
export default class InvertEffect extends ColorMatrixEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.intensity=1.0] - inversion intensity (0.0 = original, 1.0 = fully inverted)
	 */
	constructor(renderer, options = {}) {
		super(renderer);
		this.intensity =
			typeof options.intensity === "number" ? options.intensity : 1.0;
		this.invertColors(this.intensity);
	}

	/**
	 * set the inversion intensity
	 * @param {number} value - inversion intensity (0.0 = original, 1.0 = fully inverted)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.reset().invertColors(this.intensity);
	}
}
