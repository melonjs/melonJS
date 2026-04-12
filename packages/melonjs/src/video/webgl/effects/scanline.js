import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that overlays horizontal scanlines on the sprite.
 * Creates a retro CRT / TV monitor look.
 * @category Effects
 * @example
 * // subtle scanlines
 * mySprite.shader = new ScanlineEffect(renderer, {
 *     density: 2.0,
 *     opacity: 0.3,
 * });
 */
export default class ScanlineEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.density=1.0] - scanline density (lines per texel, higher = more lines)
	 * @param {number} [options.opacity=0.25] - scanline darkness (0.0 = invisible, 1.0 = fully black lines)
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform float uScanlineDensity;
			uniform float uScanlineOpacity;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				float y = uv.y * uTextureSize.y * uScanlineDensity;
				float scanline = mod(floor(y), 2.0);
				float darken = 1.0 - scanline * uScanlineOpacity;
				return vec4(color.rgb * darken, color.a);
			}
			`,
		);

		const texSize = options.textureSize || [256, 256];
		this.setUniform("uScanlineDensity", options.density || 1.0);
		this.setUniform("uScanlineOpacity", options.opacity || 0.25);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the scanline density
	 * @param {number} density - lines per texel
	 */
	setDensity(density) {
		this.setUniform("uScanlineDensity", density);
	}

	/**
	 * set the scanline opacity
	 * @param {number} opacity - scanline darkness (0.0–1.0)
	 */
	setOpacity(opacity) {
		this.setUniform("uScanlineOpacity", Math.max(0, Math.min(1, opacity)));
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
