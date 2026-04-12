import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that draws a colored outline around the sprite.
 * Works by sampling neighboring pixels — if any neighbor is opaque but the
 * current pixel is transparent, it draws the outline color.
 * Commonly used for selection highlights, hover states, or collectible glow.
 * @category Effects
 * @example
 * // yellow outline for selection
 * mySprite.shader = new OutlineEffect(renderer, {
 *     color: [1.0, 1.0, 0.0],
 *     width: 2.0,
 * });
 * @example
 * // remove the effect
 * mySprite.shader = undefined;
 */
export default class OutlineEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - outline color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.width=1.0] - outline width in pixels
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uOutlineColor;
			uniform float uOutlineWidth;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a > 0.0) {
					return color;
				}
				// sample neighbors to detect edges
				vec2 texel = uOutlineWidth / uTextureSize;
				float a = 0.0;
				a = max(a, texture2D(uSampler, uv + vec2(-texel.x, 0.0)).a);
				a = max(a, texture2D(uSampler, uv + vec2( texel.x, 0.0)).a);
				a = max(a, texture2D(uSampler, uv + vec2(0.0, -texel.y)).a);
				a = max(a, texture2D(uSampler, uv + vec2(0.0,  texel.y)).a);
				a = max(a, texture2D(uSampler, uv + vec2(-texel.x, -texel.y)).a);
				a = max(a, texture2D(uSampler, uv + vec2( texel.x, -texel.y)).a);
				a = max(a, texture2D(uSampler, uv + vec2(-texel.x,  texel.y)).a);
				a = max(a, texture2D(uSampler, uv + vec2( texel.x,  texel.y)).a);
				if (a > 0.0) {
					return vec4(uOutlineColor, a) * vColor;
				}
				return color;
			}
			`,
		);

		const color = options.color || [1.0, 1.0, 1.0];
		const width = options.width || 1.0;

		this.setUniform("uOutlineColor", new Float32Array(color));
		this.setUniform("uOutlineWidth", width);
		// texture size will be set when the sprite renders
		this.setUniform(
			"uTextureSize",
			new Float32Array([renderer.width, renderer.height]),
		);
	}

	/**
	 * set the outline color
	 * @param {number[]} color - outline color as [r, g, b] (0.0–1.0)
	 */
	setColor(color) {
		this.setUniform("uOutlineColor", new Float32Array(color));
	}

	/**
	 * set the outline width
	 * @param {number} width - outline width in pixels
	 */
	setWidth(width) {
		this.setUniform("uOutlineWidth", width);
	}

	/**
	 * set the texture size (called automatically when the sprite texture is known)
	 * @param {number} width - texture width in pixels
	 * @param {number} height - texture height in pixels
	 */
	setTextureSize(width, height) {
		this.setUniform("uTextureSize", new Float32Array([width, height]));
	}
}
