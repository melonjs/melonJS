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
 * the most colors a gradient map takes
 * @ignore
 */
const MAX_COLORS = 8;

// Both bodies walk the colors with a loop over a constant bound: a uniform
// array indexed by a value computed per pixel is not something every GLSL
// compiler takes. Each color is mixed over the one before it, by how far
// the pixel's brightness is past it: a ramp when smooth, a step when not.

// the WGSL twin of the GLSL body below: same logic, same uniform names,
// picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct GradientMapUniforms {
	uColors : array<vec4f, ${MAX_COLORS}>,
	uCount : f32,
	uSmooth : f32,
	uIntensity : f32,
};
@group(3) @binding(0) var<uniform> fx : GradientMapUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	// the pixel's own color, out of its premultiplied form
	let rgb = color.rgb / max(color.a, 0.0001);
	let luma = clamp(dot(rgb, vec3f(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
	let pos = luma * (fx.uCount - 1.0);
	let band = min(floor(luma * fx.uCount), fx.uCount - 1.0);
	var mapped = fx.uColors[0];
	for (var i = 1; i < ${MAX_COLORS}; i++) {
		if (f32(i) >= fx.uCount) {
			break;
		}
		var f = step(f32(i), band);
		if (fx.uSmooth > 0.5) {
			f = clamp(pos - f32(i - 1), 0.0, 1.0);
		}
		mapped = mix(mapped, fx.uColors[i], f);
	}
	let alpha = color.a * mix(1.0, mapped.a, fx.uIntensity);
	return vec4f(mix(rgb, mapped.rgb, fx.uIntensity) * alpha, alpha);
}
`;

/**
 * A shader effect that recolors the sprite from its brightness: the darkest
 * pixels take the first color of a list, the brightest the last, and the
 * ones in between the colors in between. The sprite keeps its shading and
 * loses its own hues.
 *
 * Commonly used to draw one sprite as several (the same enemy in a palette
 * per team or per level), for duotone and night scenes, and to give art from
 * different sources one palette.
 *
 * With `smooth` off each color takes a band of brightness of its own, with a
 * hard edge between two: a palette swap, for art drawn in a few flat shades.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // a duotone: shadows in navy, lights in cream
 * mySprite.addPostEffect(new GradientMapEffect(renderer, {
 *     colors: [[0.05, 0.08, 0.25], [1.0, 0.93, 0.78]],
 * }));
 * @example
 * // the same sprite as a second team: four flat shades of red
 * enemy.addPostEffect(new GradientMapEffect(renderer, {
 *     colors: [[0.2, 0, 0.05], [0.55, 0.05, 0.1], [0.9, 0.25, 0.2], [1, 0.8, 0.7]],
 *     smooth: false,
 * }));
 * @example
 * // fade a scene to its night palette, as an effect on the camera
 * const night = new GradientMapEffect(renderer, { colors: nightColors, intensity: 0 });
 * app.viewport.addPostEffect(night);
 * // then, over time
 * night.setIntensity(night.intensity + dt / 2000);
 */
export default class GradientMapEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number[][]} [options.colors=[[0, 0, 0], [1, 1, 1]]] - two to eight colors, from the one the darkest pixels take to the one the brightest take, each as [r, g, b] or [r, g, b, a] (0.0–1.0); a color's alpha is how opaque the pixels that take it are drawn. The default draws the sprite in grays
	 * @param {boolean} [options.smooth=true] - blend from each color to the next; when false, each color takes a band of brightness of its own
	 * @param {number} [options.intensity=1.0] - how far the sprite is recolored (0.0 = its own colors, 1.0 = the colors of the list)
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec4 uColors[${MAX_COLORS}];
			uniform float uCount;
			uniform float uSmooth;
			uniform float uIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				// the pixel's own color, out of its premultiplied form
				vec3 rgb = color.rgb / max(color.a, 0.0001);
				float luma = clamp(dot(rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
				float pos = luma * (uCount - 1.0);
				float band = min(floor(luma * uCount), uCount - 1.0);
				vec4 mapped = uColors[0];
				for (int i = 1; i < ${MAX_COLORS}; i++) {
					if (float(i) >= uCount) {
						break;
					}
					float f = uSmooth > 0.5
						? clamp(pos - float(i - 1), 0.0, 1.0)
						: step(float(i), band);
					mapped = mix(mapped, uColors[i], f);
				}
				float alpha = color.a * mix(1.0, mapped.a, uIntensity);
				return vec4(mix(rgb, mapped.rgb, uIntensity) * alpha, alpha);
			}
			`,
			wgsl: wgslFragment,
		});

		/**
		 * the colors, four floats each, as the shader reads them
		 * @ignore
		 * @internal
		 */
		this._colors = new Float32Array(MAX_COLORS * 4);

		/**
		 * how far the sprite is recolored (0.0–1.0)
		 * @type {number}
		 */
		this.intensity = options.intensity ?? 1.0;

		/**
		 * whether each color blends into the next
		 * @type {boolean}
		 */
		this.smooth = options.smooth ?? true;

		this.setColors(
			options.colors ?? [
				[0, 0, 0],
				[1, 1, 1],
			],
		);
		this.setUniform("uSmooth", this.smooth ? 1 : 0);
		this.setUniform("uIntensity", this.intensity);
	}

	/**
	 * set the colors the sprite is drawn in
	 * @param {number[][]} colors - two to eight colors, from the one the darkest pixels take to the one the brightest take, each as [r, g, b] or [r, g, b, a] (0.0–1.0)
	 */
	setColors(colors) {
		if (colors.length < 2 || colors.length > MAX_COLORS) {
			throw new RangeError(
				`a gradient map takes 2 to ${MAX_COLORS} colors, not ${colors.length}`,
			);
		}
		this._colors.fill(0);
		for (let i = 0; i < colors.length; i++) {
			this._colors.set(rgba(colors[i]), i * 4);
		}
		this.setUniform("uColors", this._colors);
		this.setUniform("uCount", colors.length);
	}

	/**
	 * set how far the sprite is recolored
	 * @param {number} value - 0.0 = its own colors, 1.0 = the colors of the list
	 */
	setIntensity(value) {
		this.intensity = Math.max(0, Math.min(1, value));
		this.setUniform("uIntensity", this.intensity);
	}

	/**
	 * blend from each color to the next, or give each a band of its own
	 * @param {boolean} smooth - false for hard bands
	 */
	setSmooth(smooth) {
		this.smooth = smooth === true;
		this.setUniform("uSmooth", this.smooth ? 1 : 0);
	}
}
