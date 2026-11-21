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

/**
 * the most colors a palette takes
 * @ignore
 */
const MAX_COLORS = 16;

// Both bodies read one color per cell of uPixelSize texels and find the two
// allowed colors it lies between: two levels of each channel, or the two
// nearest colors of the palette. A 4 x 4 ordered (Bayer) pattern then picks
// one of the two for the cell, the nearer one more often, in proportion. A
// color that is itself allowed is so left alone: only what lies between two
// is patterned, which is the shading of a scene and not its flat colors.
//
// The pattern is built from the cell's two lowest bits rather than read from
// a table, and the bits are taken before any arithmetic: on a large texture
// the usual one-line form of it runs out of float precision.

// the WGSL twin of the GLSL body below: same logic, same uniform names,
// picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct DitherUniforms {
	uPalette : array<vec4f, ${MAX_COLORS}>,
	uCount : f32,
	uLevels : f32,
	uStrength : f32,
	uPixelSize : f32,
	uTextureSize : vec2f,${FRAME_WGSL_MEMBERS}
};
@group(3) @binding(0) var<uniform> fx : DitherUniforms;
${FRAME_WGSL}
fn ditherBayer2(p : vec2f) -> f32 {
	let a = floor(p) - 2.0 * floor(floor(p) / 2.0);
	return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let texel = fx.uPixelSize / fx.uTextureSize;
	let cell = floor(uv / texel);
	let src = frameTexel((cell + 0.5) * texel) * vColor;
	// the pixel's own color, out of its premultiplied form
	let rgb = src.rgb / max(src.a, 0.0001);
	let threshold = ditherBayer2(cell * 0.5) * 0.25 + ditherBayer2(cell) + 0.03125 - 0.5;
	var alpha = src.a;
	var result = rgb;
	if (fx.uCount < 0.5) {
		let steps = fx.uLevels - 1.0;
		result = clamp(floor(rgb * steps + 0.5 + threshold * fx.uStrength) / steps, vec3f(0.0), vec3f(1.0));
	} else {
		// the two nearest colors of the palette
		var first = fx.uPalette[0];
		var second = fx.uPalette[0];
		var firstDistance = 1000.0;
		var secondDistance = 1000.0;
		for (var i = 0; i < ${MAX_COLORS}; i++) {
			if (f32(i) >= fx.uCount) {
				break;
			}
			let d = rgb - fx.uPalette[i].rgb;
			let dist = dot(d, d);
			if (dist < firstDistance) {
				secondDistance = firstDistance;
				second = first;
				firstDistance = dist;
				first = fx.uPalette[i];
			} else if (dist < secondDistance) {
				secondDistance = dist;
				second = fx.uPalette[i];
			}
		}
		// how far the pixel is from the nearest towards the other, 0 to 0.5
		let axis = second.rgb - first.rgb;
		let along = clamp(dot(rgb - first.rgb, axis) / max(dot(axis, axis), 0.000001), 0.0, 1.0);
		var chosen = first;
		if (along > mix(0.5, threshold + 0.5, fx.uStrength)) {
			chosen = second;
		}
		result = chosen.rgb;
		alpha = alpha * chosen.a;
	}
	return vec4f(result * alpha, alpha);
}
`;

/**
 * A shader effect that draws in a few colors, with an ordered dither between
 * them: the checkerboard-like patterns of early consoles and home computers,
 * which make a handful of colors read as many.
 *
 * It is made for a whole scene, as an effect on the camera. The colors are
 * so many levels of each channel (`levels`), so everything keeps its own hue,
 * or a palette of your own (`palette`). `size` makes each drawn pixel several
 * pixels wide, for a low-resolution look.
 *
 * Only a color that falls between two of the allowed ones is patterned: the
 * shading of a lit surface, the soft edge of a shadow, a gradient. A flat
 * color that is itself allowed is left as it is. So for clean flat areas,
 * give them such colors: at 6 levels, channels that are fifths of 255 (0, 51,
 * 102, 153, 204, 255), or with a palette, colors of the palette.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage, on a camera or on a renderable
 * @example
 * // the whole scene in six levels a channel, in pixels three screen pixels wide
 * app.viewport.addPostEffect(new DitherEffect(renderer, { levels: 6, size: 3 }));
 * @example
 * // the whole scene in four shades of green
 * app.viewport.addPostEffect(new DitherEffect(renderer, {
 *     palette: [
 *         [0.06, 0.22, 0.06],
 *         [0.19, 0.38, 0.19],
 *         [0.55, 0.67, 0.06],
 *         [0.61, 0.74, 0.06],
 *     ],
 *     size: 2,
 * }));
 * @example
 * // one sprite, in pixels eight texels of its art wide
 * mySprite.addPostEffect(new DitherEffect(renderer, { levels: 3, size: 8 }));
 * @example
 * // flat bands, with no pattern between them
 * mySprite.addPostEffect(new DitherEffect(renderer, { levels: 3, strength: 0 }));
 */
export default class DitherEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.levels=4] - how many levels of each color channel are kept (2 or more), when no palette is given: 2 leaves eight colors, 4 leaves sixty-four
	 * @param {number[][]} [options.palette] - two to sixteen colors to draw in, each as [r, g, b] or [r, g, b, a] (0.0–1.0), instead of levels: every pixel takes one of the two nearest, the nearer more often. A color's alpha is how opaque the pixels that take it are drawn
	 * @param {number} [options.size=1.0] - the size of a drawn pixel (1 or more), in pixels of the texture it draws: screen pixels for a camera's effect, texels of its art for a sprite's
	 * @param {number} [options.strength=1.0] - how much of the dither pattern is applied (0.0 = flat bands, every pixel taking the nearest color; 1.0 = a full pattern between two colors)
	 * @param {number[]} [options.textureSize] - the size, `[width, height]`, of the texture its pixel size is measured in; by default the texture it draws: a sprite's own, alone or with other effects and at any scale or zoom, the screen for a camera's effect
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec4 uPalette[${MAX_COLORS}];
			uniform float uCount;
			uniform float uLevels;
			uniform float uStrength;
			uniform float uPixelSize;
			uniform vec2 uTextureSize;
			${FRAME_GLSL}
			float ditherBayer2(vec2 p) {
				vec2 a = mod(floor(p), 2.0);
				return fract(a.x / 2.0 + a.y * a.y * 0.75);
			}
			vec4 apply(vec4 color, vec2 uv) {
				vec2 texel = uPixelSize / uTextureSize;
				vec2 cell = floor(uv / texel);
				vec4 src = frameTexel((cell + 0.5) * texel) * vColor;
				// the pixel's own color, out of its premultiplied form
				vec3 rgb = src.rgb / max(src.a, 0.0001);
				float threshold = ditherBayer2(cell * 0.5) * 0.25 + ditherBayer2(cell) + 0.03125 - 0.5;
				float alpha = src.a;
				vec3 result = rgb;
				if (uCount < 0.5) {
					float steps = uLevels - 1.0;
					result = clamp(floor(rgb * steps + 0.5 + threshold * uStrength) / steps, 0.0, 1.0);
				} else {
					// the two nearest colors of the palette
					vec4 first = uPalette[0];
					vec4 second = uPalette[0];
					float firstDistance = 1000.0;
					float secondDistance = 1000.0;
					for (int i = 0; i < ${MAX_COLORS}; i++) {
						if (float(i) >= uCount) {
							break;
						}
						vec3 d = rgb - uPalette[i].rgb;
						float dist = dot(d, d);
						if (dist < firstDistance) {
							secondDistance = firstDistance;
							second = first;
							firstDistance = dist;
							first = uPalette[i];
						} else if (dist < secondDistance) {
							secondDistance = dist;
							second = uPalette[i];
						}
					}
					// how far the pixel is from the nearest towards the other, 0 to 0.5
					vec3 axis = second.rgb - first.rgb;
					float along = clamp(dot(rgb - first.rgb, axis) / max(dot(axis, axis), 0.000001), 0.0, 1.0);
					vec4 chosen = along > mix(0.5, threshold + 0.5, uStrength) ? second : first;
					result = chosen.rgb;
					alpha *= chosen.a;
				}
				return vec4(result * alpha, alpha);
			}
			`,
			wgsl: wgslFragment,
		});

		/**
		 * the palette, four floats a color, as the shader reads it
		 * @ignore
		 * @internal
		 */
		this._palette = new Float32Array(MAX_COLORS * 4);

		/**
		 * how many levels of each color channel are kept, when there is no
		 * palette
		 * @type {number}
		 */
		this.levels = 4;

		/**
		 * the size of a drawn pixel, in texels
		 * @type {number}
		 */
		this.size = 1;

		/**
		 * how much of the dither pattern is applied (0.0–1.0)
		 * @type {number}
		 */
		this.strength = 1;

		this.setLevels(options.levels ?? 4);
		this.setSize(options.size ?? 1);
		this.setStrength(options.strength ?? 1);
		this.setPalette(options.palette ?? null);
		// its pixel size is in texels: of the texture it draws, unless given one
		this._initTextureSize(options.textureSize, [256, 256]);
	}

	/**
	 * set how many levels of each color channel are kept. A palette, while
	 * one is set, is drawn in instead: see {@link DitherEffect#setPalette}
	 * @param {number} levels - 2 or more
	 */
	setLevels(levels) {
		this.levels = Math.max(2, Math.round(levels));
		this.setUniform("uLevels", this.levels);
	}

	/**
	 * set the colors to draw in, or go back to levels of each channel
	 * @param {number[][]|null} palette - two to sixteen colors, each as [r, g, b] or [r, g, b, a] (0.0–1.0); null to draw in levels again
	 */
	setPalette(palette) {
		this._palette.fill(0);
		if (palette === null) {
			this.setUniform("uPalette", this._palette);
			this.setUniform("uCount", 0);
			return;
		}
		if (palette.length < 2 || palette.length > MAX_COLORS) {
			throw new RangeError(
				`a dither palette takes 2 to ${MAX_COLORS} colors, not ${palette.length}`,
			);
		}
		for (let i = 0; i < palette.length; i++) {
			this._palette.set(rgba(palette[i]), i * 4);
		}
		this.setUniform("uPalette", this._palette);
		this.setUniform("uCount", palette.length);
	}

	/**
	 * set the size of a drawn pixel
	 * @param {number} size - in texels, 1 or more
	 */
	setSize(size) {
		this.size = Math.max(1, size);
		this.setUniform("uPixelSize", this.size);
	}

	/**
	 * set how much of the dither pattern is applied
	 * @param {number} value - 0.0 = flat bands, 1.0 = a full pattern between two colors
	 */
	setStrength(value) {
		this.strength = Math.max(0, Math.min(1, value));
		this.setUniform("uStrength", this.strength);
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
