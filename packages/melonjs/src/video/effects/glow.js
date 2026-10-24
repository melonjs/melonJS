import { FRAME_GLSL, FRAME_WGSL, FRAME_WGSL_MEMBERS } from "./frame.js";
import { rgba } from "./rgba.js";
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
struct GlowUniforms {
	uGlowColor : vec4f,
	uGlowWidth : f32,
	uGlowIntensity : f32,
	uTextureSize : vec2f,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : GlowUniforms;
${FRAME_WGSL}
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	if (color.a > 0.0) {
		return color;
	}
	// sample in a circle to create a soft glow (level-0: non-uniform flow)
	var a = 0.0;
	let texel = fx.uGlowWidth / fx.uTextureSize;
	for (var angle = 0.0; angle < 6.28; angle += 0.785) {
		let offset = vec2f(cos(angle), sin(angle)) * texel;
		a += frameTexelLevel(uv + offset).a;
	}
	a = a / 8.0 * fx.uGlowIntensity;
	if (a > 0.0) {
		// the color's alpha is the halo's opacity; premultiplied, as everything the batcher draws is
		let alpha = a * fx.uGlowColor.a;
		return vec4f(fx.uGlowColor.rgb * alpha, alpha) * vColor;
	}
	return color;
}
`;

/**
 * A shader effect that adds a colored glow around the sprite.
 * Similar to OutlineEffect but with a soft, blurred edge instead of a hard line.
 * Commonly used for power-ups, magic items, or selection highlights.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // blue glow for a magic item
 * mySprite.addPostEffect(new GlowEffect(renderer, {
 *     color: [0.2, 0.5, 1.0],
 *     intensity: 1.5,
 * }));
 * @example
 * // a faint white halo: the color's alpha is the halo's opacity
 * mySprite.addPostEffect(new GlowEffect(renderer, { color: [1.0, 1.0, 1.0, 0.5] }));
 */
export default class GlowEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - glow color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha is the halo's opacity
	 * @param {number} [options.width=3.0] - glow spread in pixels
	 * @param {number} [options.intensity=1.0] - glow brightness multiplier
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec4 uGlowColor;
			uniform float uGlowWidth;
			uniform float uGlowIntensity;
			uniform vec2 uTextureSize;
			${FRAME_GLSL}
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a > 0.0) {
					return color;
				}
				// sample in a circle to create a soft glow
				float a = 0.0;
				vec2 texel = uGlowWidth / uTextureSize;
				for (float angle = 0.0; angle < 6.28; angle += 0.785) {
					vec2 offset = vec2(cos(angle), sin(angle)) * texel;
					a += frameTexel(uv + offset).a;
				}
				a = a / 8.0 * uGlowIntensity;
				if (a > 0.0) {
					// the color's alpha is the halo's opacity; premultiplied, as everything the batcher draws is
					float alpha = a * uGlowColor.a;
					return vec4(uGlowColor.rgb * alpha, alpha) * vColor;
				}
				return color;
			}
			`,
			wgsl: wgslFragment,
		});

		const color = options.color ?? [1.0, 1.0, 1.0];
		const width = options.width ?? 3.0;
		const texSize = options.textureSize ?? [256, 256];
		this.intensity = options.intensity ?? 1.0;

		this.setUniform("uGlowColor", rgba(color));
		this.setUniform("uGlowWidth", width);
		this.setUniform("uGlowIntensity", this.intensity);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the glow color
	 * @param {number[]} color - glow color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha is the halo's opacity
	 */
	setColor(color) {
		this.setUniform("uGlowColor", rgba(color));
	}

	/**
	 * set the glow intensity
	 * @param {number} value - glow brightness multiplier
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, value);
		this.setUniform("uGlowIntensity", this.intensity);
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
