import { FRAME_GLSL, FRAME_WGSL, FRAME_WGSL_MEMBERS } from "./frame.js";
import ShaderEffect from "./shadereffect.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../canvas/canvas_renderer.js";
 * @import WebGLRenderer from "../webgl/webgl_renderer.js";
 * @import WebGPURenderer from "../webgpu/webgpu_renderer.js";
 * @import Renderer from "../renderer.js";
 */
// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct WaveUniforms {
	uAmplitude : f32,
	uFrequency : f32,
	uSpeed : f32,
	uTime : f32,
	uAnchor : f32,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : WaveUniforms;
${FRAME_WGSL}
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	// with an anchor, rows fade from full wave at the top to none at the anchor
	let bend = select(1.0, clamp((fx.uAnchor - uv.y) / fx.uAnchor, 0.0, 1.0), fx.uAnchor > 0.0);
	let wave = sin(uv.y * fx.uFrequency + fx.uTime * fx.uSpeed) * fx.uAmplitude * bend;
	let distorted = vec2f(uv.x + wave, uv.y);
	return frameTexel(distorted) * vColor;
}
`;

/**
 * A shader effect that applies a sine wave distortion to the sprite.
 * Commonly used for underwater, heat haze, or dream sequence effects.
 * The `time` uniform should be updated each frame for animation.
 *
 * With an `anchor`, the wave fades out toward a row instead of moving the
 * whole sprite: full at the top, nothing at the anchor and below. That is
 * how {@link SwayEffect} leans a sprite while its feet stay planted. Rows
 * are measured across the texture the effect samples, so on a sprite cut
 * from an atlas the anchor is a row of the atlas.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * const wave = new WaveEffect(renderer, { amplitude: 0.01, frequency: 10.0 });
 * mySprite.addPostEffect(wave);
 * // update each frame
 * wave.setTime(performance.now() / 1000);
 * @example
 * // seaweed: the tips wave, the roots on the bottom row stay planted
 * const seaweed = new WaveEffect(renderer, { amplitude: 0.02, frequency: 6.0, anchor: 1.0 });
 * mySprite.addPostEffect(seaweed);
 */
export default class WaveEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.amplitude=0.01] - wave displacement strength (in UV space, 0.01 = subtle)
	 * @param {number} [options.frequency=10.0] - number of waves across the sprite
	 * @param {number} [options.speed=2.0] - wave animation speed
	 * @param {number} [options.anchor=0] - the row the wave fades out at, as a fraction of the height from the top (0..1); 0 waves every row alike
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uAmplitude;
			uniform float uFrequency;
			uniform float uSpeed;
			uniform float uTime;
			uniform float uAnchor;
			${FRAME_GLSL}
			vec4 apply(vec4 color, vec2 uv) {
				// with an anchor, rows fade from full wave at the top to none at the anchor
				float bend = uAnchor > 0.0 ? clamp((uAnchor - uv.y) / uAnchor, 0.0, 1.0) : 1.0;
				float wave = sin(uv.y * uFrequency + uTime * uSpeed) * uAmplitude * bend;
				vec2 distorted = vec2(uv.x + wave, uv.y);
				return frameTexel(distorted) * vColor;
			}
			`,
			wgsl: wgslFragment,
		});

		this.setUniform("uAmplitude", options.amplitude ?? 0.01);
		this.setUniform("uFrequency", options.frequency ?? 10.0);
		this.setUniform("uSpeed", options.speed ?? 2.0);
		this.setUniform("uTime", 0.0);
		this.setUniform("uAnchor", options.anchor ?? 0);
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

	/**
	 * set the row the wave fades out at
	 * @param {number} anchor - a fraction of the height from the top (0..1); 0 waves every row alike
	 */
	setAnchor(anchor) {
		this.setUniform("uAnchor", anchor);
	}
}
