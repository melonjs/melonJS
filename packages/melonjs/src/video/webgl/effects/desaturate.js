import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that desaturates (grayscales) the sprite.
 * The `intensity` uniform controls how much color is removed
 * (0.0 = full color, 1.0 = fully grayscale).
 * Commonly used for disabled states, death effects, or petrification.
 * @category Effects
 * @example
 * // full grayscale
 * mySprite.shader = new DesaturateEffect(renderer);
 * @example
 * // partial desaturation (50%)
 * mySprite.shader = new DesaturateEffect(renderer, { intensity: 0.5 });
 */
export default class DesaturateEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.intensity=1.0] - desaturation intensity (0.0 = full color, 1.0 = grayscale)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform float uDesatIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
				return vec4(mix(color.rgb, vec3(gray), uDesatIntensity), color.a);
			}
			`,
		);

		this.intensity =
			typeof options.intensity === "number" ? options.intensity : 1.0;
		this.setUniform("uDesatIntensity", this.intensity);
	}

	/**
	 * set the desaturation intensity
	 * @param {number} value - desaturation intensity (0.0 = full color, 1.0 = grayscale)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.setUniform("uDesatIntensity", this.intensity);
	}
}
