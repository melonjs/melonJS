import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that applies a warm sepia (vintage photo) tone to the sprite.
 * @category Effects
 * @example
 * mySprite.shader = new SepiaEffect(renderer);
 * @example
 * // partial sepia
 * mySprite.shader = new SepiaEffect(renderer, { intensity: 0.5 });
 */
export default class SepiaEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.intensity=1.0] - sepia intensity (0.0 = original, 1.0 = full sepia)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform float uSepiaIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				vec3 sepia;
				sepia.r = dot(color.rgb, vec3(0.393, 0.769, 0.189));
				sepia.g = dot(color.rgb, vec3(0.349, 0.686, 0.168));
				sepia.b = dot(color.rgb, vec3(0.272, 0.534, 0.131));
				return vec4(mix(color.rgb, sepia, uSepiaIntensity), color.a);
			}
			`,
		);

		this.intensity =
			typeof options.intensity === "number" ? options.intensity : 1.0;
		this.setUniform("uSepiaIntensity", this.intensity);
	}

	/**
	 * set the sepia intensity
	 * @param {number} value - sepia intensity (0.0 = original, 1.0 = full sepia)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.setUniform("uSepiaIntensity", this.intensity);
	}
}
