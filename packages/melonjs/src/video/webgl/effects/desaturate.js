import ColorMatrixEffect from "./colorMatrix.js";

/**
 * A shader effect that desaturates (grayscales) the sprite.
 * Commonly used for disabled states, death effects, or petrification.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // full grayscale
 * mySprite.shader = new DesaturateEffect(renderer);
 * @example
 * // partial desaturation (50%)
 * mySprite.shader = new DesaturateEffect(renderer, { intensity: 0.5 });
 */
export default class DesaturateEffect extends ColorMatrixEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.intensity=1.0] - desaturation intensity (0.0 = full color, 1.0 = grayscale)
	 */
	constructor(renderer, options = {}) {
		super(renderer);
		this.intensity =
			typeof options.intensity === "number" ? options.intensity : 1.0;
		this.saturate(1 - this.intensity);
	}

	/**
	 * set the desaturation intensity
	 * @param {number} value - desaturation intensity (0.0 = full color, 1.0 = grayscale)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.reset().saturate(1 - this.intensity);
	}
}
