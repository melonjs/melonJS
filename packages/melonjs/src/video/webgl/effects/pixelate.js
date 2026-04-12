import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that pixelates the sprite by snapping UV coordinates
 * to a grid. Commonly used for teleport effects, transitions, or retro styling.
 * @category Effects
 * @example
 * // moderate pixelation
 * mySprite.shader = new PixelateEffect(renderer, { size: 8.0 });
 * @example
 * // animate the pixelation (e.g. for teleport)
 * pixelate.setSize(pixelate.size + dt / 50);
 */
export default class PixelateEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.size=4.0] - pixel size in texels (higher = more pixelated)
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform float uPixelSize;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 texel = uPixelSize / uTextureSize;
				vec2 snapped = texel * floor(uv / texel) + texel * 0.5;
				return texture2D(uSampler, snapped) * vColor;
			}
			`,
		);

		this.size = options.size || 4.0;
		const texSize = options.textureSize || [256, 256];

		this.setUniform("uPixelSize", this.size);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the pixel size
	 * @param {number} size - pixel size in texels
	 */
	setSize(size) {
		this.size = Math.max(1, size);
		this.setUniform("uPixelSize", this.size);
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
