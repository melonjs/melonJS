import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that inverts the colors of the sprite.
 * Commonly used for damage feedback, negative image, or X-ray effects.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * mySprite.shader = new InvertEffect(renderer);
 * @example
 * // partial inversion
 * mySprite.shader = new InvertEffect(renderer, { intensity: 0.5 });
 */
export default class InvertEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.intensity=1.0] - inversion intensity (0.0 = original, 1.0 = fully inverted)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform float uInvertIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				vec3 inverted = vec3(color.a) - color.rgb;
				return vec4(mix(color.rgb, inverted, uInvertIntensity), color.a);
			}
			`,
		);

		this.intensity =
			typeof options.intensity === "number" ? options.intensity : 1.0;
		this.setUniform("uInvertIntensity", this.intensity);
	}

	/**
	 * set the inversion intensity
	 * @param {number} value - inversion intensity (0.0 = original, 1.0 = fully inverted)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.setUniform("uInvertIntensity", this.intensity);
	}
}
