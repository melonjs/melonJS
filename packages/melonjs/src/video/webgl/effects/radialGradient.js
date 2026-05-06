import ShaderEffect from "../shadereffect.js";

/**
 * additional import for TypeScript
 * @import { Color } from "../../../math/color.ts";
 * @import { default as WebGLRenderer } from "../webgl_renderer.js";
 */

/**
 * A procedural radial-gradient shader effect: solid color at the center
 * fading linearly to fully transparent at the edge of the host quad.
 * The falloff is naturally elliptical for non-square quads.
 *
 * **UV-space caveat.** The `apply(color, uv)` function receives
 * `vRegion` — the atlas UVs of the host quad. The falloff math
 * (`length(uv * 2 - 1)`) assumes those UVs span `[0, 1] × [0, 1]`,
 * which is true when the quad samples a full-rect texture (a
 * dedicated 1×1 white pixel, a non-atlased Sprite, an FBO blit, or
 * the engine-provided light atlas used by `WebGLRenderer.drawLight`).
 * If you attach this effect to a Sprite that uses a *sub-region* of a
 * larger atlas, `uv` will be in `[u0..u1] × [v0..v1]` and the radial
 * center will be misplaced. For atlas-based renderables, set the
 * effect's `uColor`/`uIntensity` and pair it with a Sprite whose
 * texture covers a full atlas, or use a Sprite created from a
 * standalone image.
 *
 * The falloff curve is **linear** (`f = clamp(1 - d, 0, 1)`) to match
 * the Canvas 2D `createRadialGradient` two-stop output exactly. Output
 * is premultiplied so the result composes correctly under additive
 * (`"lighter"`) blending across overlapping quads.
 *
 * Color & intensity come from **two stacked sources**, multiplied
 * together: the `uColor`/`uIntensity` uniforms (set per-effect via
 * `setColor` / `setIntensity` — the natural API for a single-instance
 * shader attached to a renderable) AND the per-vertex tint coming
 * through `aColor` (used by `WebGLRenderer.drawLight` to encode each
 * light's color + intensity in the vertex stream so multiple lights
 * sharing this shader can batch into a single draw call). For typical
 * standalone usage the per-vertex tint is `(1,1,1,1)` and the uniforms
 * drive the look; for the Light2d batching path the uniforms stay at
 * defaults and the tint carries everything.
 * @category Effects
 * @example
 * // Soft white spot, 50% peak alpha at center
 * const spot = new RadialGradientEffect(renderer, { intensity: 0.5 });
 * @example
 * // Tinted hotspot — orange center, full brightness, sized via the
 * // host quad's bounds
 * const hot = new RadialGradientEffect(renderer, {
 *     color: new Color(255, 128, 64),
 *     intensity: 1.0,
 * });
 * hot.setIntensity(2.0); // pulse brighter at runtime
 * @example
 * // Pickup highlight — attach to any Renderable so it renders inside
 * // the renderable's bounding rect (anchorPoint applies). Combine with
 * // `blendMode = "lighter"` for the additive glow look.
 * pickup.shader = new RadialGradientEffect(renderer, {
 *     color: new Color(120, 255, 200), // mint green
 *     intensity: 0.8,
 * });
 * pickup.blendMode = "lighter";
 * @example
 * // Damage / impact indicator — short-lived elliptical flash on hit.
 * // The quad's width/height drive the falloff aspect for free.
 * const flash = new RadialGradientEffect(renderer, {
 *     color: new Color(255, 32, 32),
 *     intensity: 1.5,
 * });
 * // animate intensity to fade out
 * tween.to({ intensity: 0 }, 200).onUpdate((s) => flash.setIntensity(s.intensity));
 * @example
 * // Debug overlay — draw a soft circle wherever the player is to mark
 * // a trigger zone, without baking a texture per zone.
 * const zoneMarker = new RadialGradientEffect(renderer, {
 *     color: new Color(80, 160, 255),
 *     intensity: 0.4,
 * });
 */
export default class RadialGradientEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer} renderer - the current renderer instance
	 * @param {object} [options] - initial uniform values
	 * @param {Color} [options.color] - center color (0..255 RGB); defaults to white
	 * @param {number} [options.intensity=1] - peak alpha at the center (0..1+)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uColor;
			uniform float uIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				// recenter to [-1, 1] across the quad. The quad's own aspect
				// ratio handles elliptical falloffs naturally — length(c) == 1
				// lies on the inscribed ellipse in world space.
				vec2 c = uv * 2.0 - 1.0;
				float d = length(c);
				// linear ramp matches Canvas createRadialGradient's two-stop output
				float f = clamp(1.0 - d, 0.0, 1.0);
				// 'color' is the per-vertex tint, already premultiplied by
				// alpha in the vertex shader (vColor = vec4(aColor.bgr *
				// aColor.a, aColor.a)). For standalone use the tint is
				// (1,1,1,1) and the uniforms drive the look; for the Light2d
				// batching path the uniforms stay at default and the tint
				// carries the per-light color + intensity.
				vec3 rgb = color.rgb * uColor * uIntensity * f;
				float a = color.a * uIntensity * f;
				return vec4(rgb, a);
			}
			`,
		);

		// reused across `setColor` calls so we don't allocate a fresh
		// 3-element array every frame on every light.
		this._colorBuf = new Float32Array(3);

		const color = options.color;
		if (color) {
			this.setColor(color);
		} else {
			this._colorBuf[0] = 1;
			this._colorBuf[1] = 1;
			this._colorBuf[2] = 1;
			this.setUniform("uColor", this._colorBuf);
		}
		this.setIntensity(options.intensity ?? 1);
	}

	/**
	 * Set the center color. RGB only — alpha is ignored (the radial
	 * falloff supplies the per-pixel alpha).
	 * @param {Color} color - 0..255 RGB color
	 */
	setColor(color) {
		this._colorBuf[0] = color.r / 255;
		this._colorBuf[1] = color.g / 255;
		this._colorBuf[2] = color.b / 255;
		this.setUniform("uColor", this._colorBuf);
	}

	/**
	 * Set the peak intensity. Acts as a brightness multiplier on the
	 * falloff curve; values above 1 over-saturate the center of the gradient.
	 * @param {number} intensity - 0..1+ multiplier
	 */
	setIntensity(intensity) {
		this.setUniform("uIntensity", intensity);
	}
}
