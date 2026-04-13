import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that pulses a color overlay on the sprite.
 * Commonly used for status effects — poison green, freeze blue, fire red.
 * The `time` uniform should be updated each frame for the pulse animation.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // poison pulse
 * const poison = new TintPulseEffect(renderer, {
 *     color: [0.0, 1.0, 0.0],
 *     speed: 3.0,
 * });
 * mySprite.shader = poison;
 *
 * // update each frame
 * poison.setTime(timer.getTime() / 1000);
 */
export default class TintPulseEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 0.0, 0.0]] - pulse color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.speed=2.0] - pulse speed (oscillations per second)
	 * @param {number} [options.intensity=0.3] - maximum tint strength (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uPulseColor;
			uniform float uPulseSpeed;
			uniform float uPulseIntensity;
			uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) {
				float pulse = (sin(uTime * uPulseSpeed * 6.2832) * 0.5 + 0.5) * uPulseIntensity;
				return vec4(mix(color.rgb, uPulseColor * color.a, pulse), color.a);
			}
			`,
		);

		const color = options.color ?? [1.0, 0.0, 0.0];
		this.setUniform("uPulseColor", new Float32Array(color));
		this.setUniform("uPulseSpeed", options.speed ?? 2.0);
		this.setUniform("uPulseIntensity", options.intensity ?? 0.3);
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
	 * set the pulse color
	 * @param {number[]} color - pulse color as [r, g, b] (0.0–1.0)
	 */
	setColor(color) {
		this.setUniform("uPulseColor", new Float32Array(color));
	}
}
