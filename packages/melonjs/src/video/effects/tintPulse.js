import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct TintPulseUniforms {
	uPulseColor : vec3f,
	uPulseSpeed : f32,
	uPulseIntensity : f32,
	uTime : f32,
};
@group(3) @binding(0) var<uniform> fx : TintPulseUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let pulse = (sin(fx.uTime * fx.uPulseSpeed * 6.2832) * 0.5 + 0.5) * fx.uPulseIntensity;
	return vec4f(mix(color.rgb, fx.uPulseColor * color.a, pulse), color.a);
}
`;

/**
 * A shader effect that pulses a color overlay on the sprite.
 * Commonly used for status effects — poison green, freeze blue, fire red.
 * The `time` uniform should be updated each frame for the pulse animation.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // poison pulse
 * const poison = new TintPulseEffect(renderer, {
 *     color: [0.0, 1.0, 0.0],
 *     speed: 3.0,
 * });
 * mySprite.addPostEffect(poison);
 *
 * // update each frame
 * poison.setTime(timer.getTime() / 1000);
 */
export default class TintPulseEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 0.0, 0.0]] - pulse color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.speed=2.0] - pulse speed (oscillations per second)
	 * @param {number} [options.intensity=0.3] - maximum tint strength (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec3 uPulseColor;
			uniform float uPulseSpeed;
			uniform float uPulseIntensity;
			uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) {
				float pulse = (sin(uTime * uPulseSpeed * 6.2832) * 0.5 + 0.5) * uPulseIntensity;
				return vec4(mix(color.rgb, uPulseColor * color.a, pulse), color.a);
			}
			`,
			wgsl: wgslFragment,
		});

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
