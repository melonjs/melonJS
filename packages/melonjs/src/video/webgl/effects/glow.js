import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that adds a colored glow around the sprite.
 * Similar to OutlineEffect but with a soft, blurred edge instead of a hard line.
 * Commonly used for power-ups, magic items, or selection highlights.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // blue glow for a magic item
 * mySprite.shader = new GlowEffect(renderer, {
 *     color: [0.2, 0.5, 1.0],
 *     intensity: 1.5,
 * });
 */
export default class GlowEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - glow color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.width=3.0] - glow spread in pixels
	 * @param {number} [options.intensity=1.0] - glow brightness multiplier
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uGlowColor;
			uniform float uGlowWidth;
			uniform float uGlowIntensity;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a > 0.0) {
					return color;
				}
				// sample in a circle to create a soft glow
				float a = 0.0;
				vec2 texel = uGlowWidth / uTextureSize;
				for (float angle = 0.0; angle < 6.28; angle += 0.785) {
					vec2 offset = vec2(cos(angle), sin(angle)) * texel;
					a += texture2D(uSampler, uv + offset).a;
				}
				a = a / 8.0 * uGlowIntensity;
				if (a > 0.0) {
					return vec4(uGlowColor * a, a) * vColor;
				}
				return color;
			}
			`,
		);

		const color = options.color ?? [1.0, 1.0, 1.0];
		const width = options.width ?? 3.0;
		const texSize = options.textureSize ?? [256, 256];
		this.intensity = options.intensity ?? 1.0;

		this.setUniform("uGlowColor", new Float32Array(color));
		this.setUniform("uGlowWidth", width);
		this.setUniform("uGlowIntensity", this.intensity);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the glow color
	 * @param {number[]} color - glow color as [r, g, b] (0.0–1.0)
	 */
	setColor(color) {
		this.setUniform("uGlowColor", new Float32Array(color));
	}

	/**
	 * set the glow intensity
	 * @param {number} value - glow brightness multiplier
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, value);
		this.setUniform("uGlowIntensity", this.intensity);
	}

	/**
	 * set the texture size
	 * @param {number} width - texture width in pixels
	 * @param {number} height - texture height in pixels
	 */
	setTextureSize(width, height) {
		this.setUniform("uTextureSize", new Float32Array([width, height]));
	}
}
