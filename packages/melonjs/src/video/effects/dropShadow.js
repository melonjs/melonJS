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
struct ShadowUniforms {
	uShadowOffset : vec2f,
	uShadowColor : vec4f,
	uShadowOpacity : f32,
	uTextureSize : vec2f,
	uUVYDir : f32,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : ShadowUniforms;
${FRAME_WGSL}
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	if (color.a > 0.0) {
		return color;
	}
	// check if the shadow source pixel is opaque. Level-0 sample: past a
	// non-uniform return implicit derivatives are unavailable (sprites are
	// single-level textures, so identical output)
	var offset = fx.uShadowOffset / fx.uTextureSize;
	// uUVYDir keeps "down" pointing down whatever the sampled space's
	// vertical orientation (always +1 under WebGPU; the GL pooled path
	// sets -1 for its bottom-up captures)
	offset.y = offset.y * fx.uUVYDir;
	let shadowAlpha = frameTexelLevel(uv - offset).a;
	if (shadowAlpha > 0.0) {
		// the color's alpha scales the opacity; premultiplied, as everything the batcher draws is
		let alpha = shadowAlpha * fx.uShadowOpacity * fx.uShadowColor.a;
		return vec4f(fx.uShadowColor.rgb * alpha, alpha) * vColor;
	}
	return color;
}
`;

/**
 * A shader effect that adds a drop shadow beneath the sprite.
 * Works by sampling the texture at an offset — if the offset position
 * has an opaque pixel but the current position doesn't, the shadow is drawn.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // dark shadow offset to the bottom-right
 * mySprite.addPostEffect(new DropShadowEffect(renderer, {
 *     offsetX: 3.0,
 *     offsetY: 3.0,
 *     color: [0.0, 0.0, 0.0],
 *     opacity: 0.5,
 * }));
 * @example
 * // a soft blue shadow: the color's alpha scales `opacity`
 * mySprite.addPostEffect(new DropShadowEffect(renderer, {
 *     color: [0.1, 0.2, 0.6, 0.5],
 *     opacity: 0.8,
 * }));
 */
export default class DropShadowEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.offsetX=2.0] - shadow x offset in texels
	 * @param {number} [options.offsetY=2.0] - shadow y offset in texels
	 * @param {number[]} [options.color=[0.0, 0.0, 0.0]] - shadow color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales `opacity`
	 * @param {number} [options.opacity=0.5] - shadow opacity (0.0–1.0)
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec2 uShadowOffset;
			uniform vec4 uShadowColor;
			uniform float uShadowOpacity;
			uniform vec2 uTextureSize;
			uniform float uUVYDir;
			${FRAME_GLSL}
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a > 0.0) {
					return color;
				}
				// check if the shadow source pixel is opaque. uUVYDir keeps
				// "down" pointing down whatever the sampled space's vertical
				// orientation (+1 sampling the sprite atlas directly, -1 on
				// the pooled path's bottom-up capture FBOs)
				vec2 offset = uShadowOffset / uTextureSize;
				offset.y *= uUVYDir;
				float shadowAlpha = frameTexel(uv - offset).a;
				if (shadowAlpha > 0.0) {
					// the color's alpha scales the opacity; premultiplied, as everything the batcher draws is
					float alpha = shadowAlpha * uShadowOpacity * uShadowColor.a;
					return vec4(uShadowColor.rgb * alpha, alpha) * vColor;
				}
				return color;
			}
			`,
			wgsl: wgslFragment,
		});

		const texSize = options.textureSize ?? [256, 256];
		this.setUniform(
			"uShadowOffset",
			new Float32Array([options.offsetX ?? 2.0, options.offsetY ?? 2.0]),
		);
		this.setUniform("uShadowColor", rgba(options.color ?? [0.0, 0.0, 0.0]));
		this.setUniform("uShadowOpacity", options.opacity ?? 0.5);
		this.setUniform("uTextureSize", new Float32Array(texSize));
		// uv.y grows downward until a renderer path says otherwise
		this.setUniform("uUVYDir", 1.0);
	}

	/**
	 * set the shadow offset
	 * @param {number} x - x offset in texels
	 * @param {number} y - y offset in texels
	 */
	setOffset(x, y) {
		this.setUniform("uShadowOffset", new Float32Array([x, y]));
	}

	/**
	 * set the shadow color
	 * @param {number[]} color - shadow color as [r, g, b] or [r, g, b, a] (0.0–1.0); the alpha scales the opacity
	 */
	setColor(color) {
		this.setUniform("uShadowColor", rgba(color));
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
