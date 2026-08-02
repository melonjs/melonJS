import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct WaveUniforms {
	uAmplitude : f32,
	uFrequency : f32,
	uSpeed : f32,
	uTime : f32,
};
@group(3) @binding(0) var<uniform> fx : WaveUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let wave = sin(uv.y * fx.uFrequency + fx.uTime * fx.uSpeed) * fx.uAmplitude;
	let distorted = vec2f(uv.x + wave, uv.y);
	return textureSample(uTexture, uSampler, distorted) * vColor;
}
`;

/**
 * A shader effect that applies a sine wave distortion to the sprite.
 * Commonly used for underwater, heat haze, or dream sequence effects.
 * The `time` uniform should be updated each frame for animation.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * const wave = new WaveEffect(renderer, { amplitude: 0.01, frequency: 10.0 });
 * mySprite.shader = wave;
 * // update each frame
 * wave.setTime(performance.now() / 1000);
 */
export default class WaveEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.amplitude=0.01] - wave displacement strength (in UV space, 0.01 = subtle)
	 * @param {number} [options.frequency=10.0] - number of waves across the sprite
	 * @param {number} [options.speed=2.0] - wave animation speed
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uAmplitude;
			uniform float uFrequency;
			uniform float uSpeed;
			uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) {
				float wave = sin(uv.y * uFrequency + uTime * uSpeed) * uAmplitude;
				vec2 distorted = vec2(uv.x + wave, uv.y);
				return texture2D(uSampler, distorted) * vColor;
			}
			`,
			wgsl: wgslFragment,
		});

		this.setUniform("uAmplitude", options.amplitude ?? 0.01);
		this.setUniform("uFrequency", options.frequency ?? 10.0);
		this.setUniform("uSpeed", options.speed ?? 2.0);
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
	 * set the wave amplitude
	 * @param {number} amplitude - displacement strength in UV space
	 */
	setAmplitude(amplitude) {
		this.setUniform("uAmplitude", amplitude);
	}

	/**
	 * set the wave frequency
	 * @param {number} frequency - number of waves
	 */
	setFrequency(frequency) {
		this.setUniform("uFrequency", frequency);
	}
}
