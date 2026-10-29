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
struct OutlineUniforms {
	uOutlineColor : vec4f,
	uOutlineWidth : f32,
	uTextureSize : vec2f,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : OutlineUniforms;
${FRAME_WGSL}
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	if (color.a > 0.0) {
		return color;
	}
	// sample neighbors to detect edges (level-0: non-uniform flow)
	let texel = fx.uOutlineWidth / fx.uTextureSize;
	var a = 0.0;
	a = max(a, frameTexelLevel(uv + vec2f(-texel.x, 0.0)).a);
	a = max(a, frameTexelLevel(uv + vec2f(texel.x, 0.0)).a);
	a = max(a, frameTexelLevel(uv + vec2f(0.0, -texel.y)).a);
	a = max(a, frameTexelLevel(uv + vec2f(0.0, texel.y)).a);
	a = max(a, frameTexelLevel(uv + vec2f(-texel.x, -texel.y)).a);
	a = max(a, frameTexelLevel(uv + vec2f(texel.x, -texel.y)).a);
	a = max(a, frameTexelLevel(uv + vec2f(-texel.x, texel.y)).a);
	a = max(a, frameTexelLevel(uv + vec2f(texel.x, texel.y)).a);
	if (a > 0.0) {
		// the color's alpha is the outline's opacity; premultiplied, as everything the batcher draws is
		let alpha = a * fx.uOutlineColor.a;
		return vec4f(fx.uOutlineColor.rgb * alpha, alpha) * vColor;
	}
	return color;
}
`;

/**
 * A shader effect that draws a colored outline around the sprite.
 * Works by sampling neighboring pixels — if any neighbor is opaque but the
 * current pixel is transparent, it draws the outline color.
 * Commonly used for selection highlights, hover states, or collectible glow.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // yellow outline for selection
 * mySprite.addPostEffect(new OutlineEffect(renderer, {
 *     color: [1.0, 1.0, 0.0],
 *     width: 2.0,
 * }));
 * @example
 * // a half-transparent white outline
 * mySprite.addPostEffect(new OutlineEffect(renderer, { color: [1, 1, 1, 0.5] }));
 * @example
 * // remove the effect
 * mySprite.removePostEffect(outline);
 */
export default class OutlineEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[]} [options.color=[1.0, 1.0, 1.0]] - outline color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha is the outline's opacity
	 * @param {number} [options.width=1.0] - outline width in pixels
	 * @param {number[]} [options.textureSize] - the size, `[width, height]`, of the texture its width is measured in; by default the texture it draws: a sprite's own, alone or with other effects and at any scale or zoom, the screen for a camera's effect
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec4 uOutlineColor;
			uniform float uOutlineWidth;
			uniform vec2 uTextureSize;
			${FRAME_GLSL}
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a > 0.0) {
					return color;
				}
				// sample neighbors to detect edges
				vec2 texel = uOutlineWidth / uTextureSize;
				float a = 0.0;
				a = max(a, frameTexel(uv + vec2(-texel.x, 0.0)).a);
				a = max(a, frameTexel(uv + vec2( texel.x, 0.0)).a);
				a = max(a, frameTexel(uv + vec2(0.0, -texel.y)).a);
				a = max(a, frameTexel(uv + vec2(0.0,  texel.y)).a);
				a = max(a, frameTexel(uv + vec2(-texel.x, -texel.y)).a);
				a = max(a, frameTexel(uv + vec2( texel.x, -texel.y)).a);
				a = max(a, frameTexel(uv + vec2(-texel.x,  texel.y)).a);
				a = max(a, frameTexel(uv + vec2( texel.x,  texel.y)).a);
				if (a > 0.0) {
					// the color's alpha is the outline's opacity; premultiplied, as everything the batcher draws is
					float alpha = a * uOutlineColor.a;
					return vec4(uOutlineColor.rgb * alpha, alpha) * vColor;
				}
				return color;
			}
			`,
			wgsl: wgslFragment,
		});

		const color = options.color ?? [1.0, 1.0, 1.0];
		const width = options.width ?? 1.0;

		this.setUniform("uOutlineColor", rgba(color));
		this.setUniform("uOutlineWidth", width);
		// its width is in texels: of the texture it draws, unless given one
		this._initTextureSize(options.textureSize, [
			renderer.width,
			renderer.height,
		]);
	}

	/**
	 * set the outline color
	 * @param {number[]} color - outline color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha is the outline's opacity
	 */
	setColor(color) {
		this.setUniform("uOutlineColor", rgba(color));
	}

	/**
	 * set the outline width
	 * @param {number} width - outline width in pixels
	 */
	setWidth(width) {
		this.setUniform("uOutlineWidth", width);
	}

	/**
	 * Measure the effect's width in the texels of a texture of this size,
	 * rather than of the texture it draws (the default)
	 * @param {number} width - texture width in pixels
	 * @param {number} height - texture height in pixels
	 */
	setTextureSize(width, height) {
		this.setUniform("uTextureSize", new Float32Array([width, height]));
	}
}
