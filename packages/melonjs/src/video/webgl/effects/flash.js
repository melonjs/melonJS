import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that flashes the sprite with a solid color.
 * Commonly used for hit feedback — flash white when the player takes damage.
 * The `intensity` uniform controls how much of the flash color is mixed in
 * (0.0 = original sprite, 1.0 = fully colored).
 * @category Effects
 * @example
 * // create a white flash effect
 * const flash = new FlashEffect(renderer);
 * mySprite.shader = flash;
 *
 * // trigger the flash (e.g. on hit)
 * flash.setIntensity(1.0);
 *
 * // fade it out over time (e.g. in update loop)
 * flash.setIntensity(flash.intensity - dt / 200);
 * @example
 * // red flash
 * const flash = new FlashEffect(renderer, { color: [1.0, 0.0, 0.0] });
 */
export default class FlashEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - flash color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.intensity=0.0] - initial flash intensity (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uFlashColor;
			uniform float uFlashIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				return vec4(mix(color.rgb, uFlashColor * color.a, uFlashIntensity), color.a);
			}
			`,
		);

		const color = options.color || [1.0, 1.0, 1.0];
		this.intensity = options.intensity || 0.0;

		this.setUniform("uFlashColor", new Float32Array(color));
		this.setUniform("uFlashIntensity", this.intensity);
	}

	/**
	 * set the flash intensity
	 * @param {number} value - flash intensity (0.0 = no flash, 1.0 = fully colored)
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.setUniform("uFlashIntensity", this.intensity);
	}

	/**
	 * set the flash color
	 * @param {number[]} color - flash color as [r, g, b] (0.0–1.0)
	 */
	setColor(color) {
		this.setUniform("uFlashColor", new Float32Array(color));
	}
}
