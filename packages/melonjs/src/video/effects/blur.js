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
struct BlurUniforms {
	uBlurStrength : f32,
	uTextureSize : vec2f,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : BlurUniforms;
${FRAME_WGSL}
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let texel = fx.uBlurStrength / fx.uTextureSize;
	var sum = vec4f(0.0);
	// 9-tap box blur
	sum += frameTexel(uv + vec2f(-texel.x, -texel.y));
	sum += frameTexel(uv + vec2f(0.0, -texel.y));
	sum += frameTexel(uv + vec2f(texel.x, -texel.y));
	sum += frameTexel(uv + vec2f(-texel.x, 0.0));
	sum += frameTexel(uv);
	sum += frameTexel(uv + vec2f(texel.x, 0.0));
	sum += frameTexel(uv + vec2f(-texel.x, texel.y));
	sum += frameTexel(uv + vec2f(0.0, texel.y));
	sum += frameTexel(uv + vec2f(texel.x, texel.y));
	return (sum / 9.0) * vColor;
}
`;

/**
 * A shader effect that applies a box blur to the sprite.
 * Commonly used for background defocus, depth-of-field simulation,
 * or UI backdrop blur.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // moderate blur
 * mySprite.addPostEffect(new BlurEffect(renderer, { strength: 2.0 }));
 */
export default class BlurEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.strength=1.0] - blur strength in texels
	 * @param {number[]} [options.textureSize] - the size, `[width, height]`, of the texture its strength is measured in; by default the texture it draws: a sprite's own, alone or with other effects and at any scale or zoom, the screen for a camera's effect
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uBlurStrength;
			uniform vec2 uTextureSize;
			${FRAME_GLSL}
			vec4 apply(vec4 color, vec2 uv) {
				vec2 texel = uBlurStrength / uTextureSize;
				vec4 sum = vec4(0.0);
				// 9-tap box blur
				sum += frameTexel(uv + vec2(-texel.x, -texel.y));
				sum += frameTexel(uv + vec2( 0.0,    -texel.y));
				sum += frameTexel(uv + vec2( texel.x, -texel.y));
				sum += frameTexel(uv + vec2(-texel.x,  0.0));
				sum += frameTexel(uv);
				sum += frameTexel(uv + vec2( texel.x,  0.0));
				sum += frameTexel(uv + vec2(-texel.x,  texel.y));
				sum += frameTexel(uv + vec2( 0.0,     texel.y));
				sum += frameTexel(uv + vec2( texel.x,  texel.y));
				return (sum / 9.0) * vColor;
			}
			`,
			wgsl: wgslFragment,
		});

		this.strength = options.strength ?? 1.0;

		this.setUniform("uBlurStrength", this.strength);
		// its strength is in texels: of the texture it draws, unless given one
		this._initTextureSize(options.textureSize, [256, 256]);
	}

	/**
	 * set the blur strength
	 * @param {number} strength - blur strength in texels
	 */
	setStrength(strength) {
		this.strength = Math.max(0, strength);
		this.setUniform("uBlurStrength", this.strength);
	}

	/**
	 * Measure the effect's strength in the texels of a texture of this size,
	 * rather than of the texture it draws (the default)
	 * @param {number} width - texture width in pixels
	 * @param {number} height - texture height in pixels
	 */
	setTextureSize(width, height) {
		this.setUniform("uTextureSize", new Float32Array([width, height]));
	}
}
