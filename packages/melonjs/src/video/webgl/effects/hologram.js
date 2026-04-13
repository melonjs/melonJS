import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that simulates a holographic projection with
 * horizontal scan lines, color shift, and flickering.
 * Commonly used for sci-fi UI, ghost/spirit characters, or tech displays.
 * The `time` uniform should be updated each frame for animation.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * const holo = new HologramEffect(renderer);
 * mySprite.shader = holo;
 * // update each frame
 * holo.setTime(performance.now() / 1000);
 */
export default class HologramEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[0.1, 0.7, 1.0]] - hologram tint color [r, g, b]
	 * @param {number} [options.intensity=0.5] - effect intensity (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uHoloColor;
			uniform float uHoloIntensity;
			uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) {
				// scan line
				float scan = sin(uv.y * 200.0 + uTime * 5.0) * 0.5 + 0.5;
				// flicker
				float flicker = 0.95 + 0.05 * sin(uTime * 30.0);
				// color shift
				vec3 holo = mix(color.rgb, uHoloColor * color.a, uHoloIntensity);
				holo *= (1.0 - scan * 0.15) * flicker;
				return vec4(holo, color.a * flicker);
			}
			`,
		);

		const color = options.color ?? [0.1, 0.7, 1.0];
		this.setUniform("uHoloColor", new Float32Array(color));
		this.setUniform("uHoloIntensity", options.intensity ?? 0.5);
		this.setUniform("uTime", 0.0);
	}

	/**
	 * set the current time (call each frame for animation)
	 * @param {number} time - time in seconds
	 */
	setTime(time) {
		this.setUniform("uTime", time);
	}

	/**
	 * set the hologram tint color
	 * @param {number[]} color - color as [r, g, b] (0.0–1.0)
	 */
	setColor(color) {
		this.setUniform("uHoloColor", new Float32Array(color));
	}
}
