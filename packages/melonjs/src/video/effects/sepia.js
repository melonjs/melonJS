import ColorMatrixEffect from "./colorMatrix.js";

/**
 * A shader effect that applies a warm sepia (vintage photo) tone to the sprite.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * mySprite.addPostEffect(new SepiaEffect(renderer));
 * @example
 * // partial sepia
 * mySprite.addPostEffect(new SepiaEffect(renderer, { intensity: 0.5 }));
 */
export default class SepiaEffect extends ColorMatrixEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.intensity=1.0] - sepia intensity (0.0 = original, 1.0 = full sepia)
	 */
	constructor(renderer, options = {}) {
		super(renderer);
		this.intensity =
			typeof options.intensity === "number" ? options.intensity : 1.0;
		this.sepia(this.intensity);
	}

	/**
	 * set the sepia intensity
	 * @param {number} value - sepia intensity (0.0 = original, 1.0 = full sepia)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.reset().sepia(this.intensity);
	}
}
