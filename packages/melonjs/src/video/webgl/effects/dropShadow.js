import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that adds a drop shadow beneath the sprite.
 * Works by sampling the texture at an offset — if the offset position
 * has an opaque pixel but the current position doesn't, the shadow is drawn.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // dark shadow offset to the bottom-right
 * mySprite.shader = new DropShadowEffect(renderer, {
 *     offsetX: 3.0,
 *     offsetY: 3.0,
 *     color: [0.0, 0.0, 0.0],
 *     opacity: 0.5,
 * });
 */
export default class DropShadowEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.offsetX=2.0] - shadow x offset in texels
	 * @param {number} [options.offsetY=2.0] - shadow y offset in texels
	 * @param {number[]} [options.color=[0.0, 0.0, 0.0]] - shadow color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.opacity=0.5] - shadow opacity (0.0–1.0)
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec2 uShadowOffset;
			uniform vec3 uShadowColor;
			uniform float uShadowOpacity;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a > 0.0) {
					return color;
				}
				// check if the shadow source pixel is opaque
				vec2 offset = uShadowOffset / uTextureSize;
				float shadowAlpha = texture2D(uSampler, uv - offset).a;
				if (shadowAlpha > 0.0) {
					return vec4(uShadowColor, shadowAlpha * uShadowOpacity) * vColor;
				}
				return color;
			}
			`,
		);

		const texSize = options.textureSize ?? [256, 256];
		this.setUniform(
			"uShadowOffset",
			new Float32Array([options.offsetX ?? 2.0, options.offsetY ?? 2.0]),
		);
		this.setUniform(
			"uShadowColor",
			new Float32Array(options.color ?? [0.0, 0.0, 0.0]),
		);
		this.setUniform("uShadowOpacity", options.opacity ?? 0.5);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the shadow offset
	 * @param {number} x - x offset in texels
	 * @param {number} y - y offset in texels
	 */
	setOffset(x, y) {
		this.setUniform("uShadowOffset", new Float32Array([x, y]));
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
