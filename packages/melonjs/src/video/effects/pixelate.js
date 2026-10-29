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
struct PixelateUniforms {
	uPixelSize : f32,
	uTextureSize : vec2f,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : PixelateUniforms;
${FRAME_WGSL}
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let texel = fx.uPixelSize / fx.uTextureSize;
	let snapped = texel * floor(uv / texel) + texel * 0.5;
	return frameTexel(snapped) * vColor;
}
`;

/**
 * A shader effect that pixelates the sprite by snapping UV coordinates
 * to a grid. Commonly used for teleport effects, transitions, or retro styling.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // moderate pixelation
 * mySprite.addPostEffect(new PixelateEffect(renderer, { size: 8.0 }));
 * @example
 * // animate the pixelation (e.g. for teleport)
 * pixelate.setSize(pixelate.size + dt / 50);
 */
export default class PixelateEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.size=4.0] - pixel size in texels (higher = more pixelated)
	 * @param {number[]} [options.textureSize] - the size, `[width, height]`, of the texture its pixel size is measured in; by default the texture it draws: a sprite's own, alone or with other effects and at any scale or zoom, the screen for a camera's effect
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uPixelSize;
			uniform vec2 uTextureSize;
			${FRAME_GLSL}
			vec4 apply(vec4 color, vec2 uv) {
				vec2 texel = uPixelSize / uTextureSize;
				vec2 snapped = texel * floor(uv / texel) + texel * 0.5;
				return frameTexel(snapped) * vColor;
			}
			`,
			wgsl: wgslFragment,
		});

		this.size = options.size ?? 4.0;

		this.setUniform("uPixelSize", this.size);
		// its pixel size is in texels: of the texture it draws, unless given one
		this._initTextureSize(options.textureSize, [256, 256]);
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
	 * Measure the effect's pixel size in the texels of a texture of this size,
	 * rather than of the texture it draws (the default)
	 * @param {number} width - texture width in pixels
	 * @param {number} height - texture height in pixels
	 */
	setTextureSize(width, height) {
		this.setUniform("uTextureSize", new Float32Array([width, height]));
	}
}
