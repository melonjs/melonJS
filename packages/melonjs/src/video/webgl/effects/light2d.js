import ShaderEffect from "../shadereffect.js";

/**
 * additional import for TypeScript
 * @import { Color } from "../../../math/color.ts";
 * @import { default as WebGLRenderer } from "../webgl_renderer.js";
 */

/**
 * Procedural radial-falloff shader used by `WebGLRenderer.drawLight()` to
 * render `Light2d` instances without baking an offscreen-canvas gradient
 * texture. One instance is shared across every Light2d on the same
 * renderer; per-frame uniforms (`uColor`, `uIntensity`) are updated via
 * the semantic setters before each light's draw.
 *
 * The falloff curve is **linear** (`f = clamp(1 - d, 0, 1)`) to match
 * the existing Canvas `createRadialGradient` two-stop interpolation
 * exactly — preserves visual parity for users with calibrated scenes.
 * Output is premultiplied so the standard `"lighter"` (additive) blend
 * composes correctly across overlapping lights.
 *
 * Elliptical lights (`radiusX !== radiusY`) work naturally: the quad's
 * UV space is normalized to `[0, 1]` regardless of quad dimensions, so
 * `c = uv * 2 - 1` directly gives the position relative to the elliptical
 * boundary `(world_dx/radiusX, world_dy/radiusY)`. `length(c) == 1`
 * lies exactly on the ellipse — no extra aspect uniform needed.
 *
 * The constructor accepts initial color / intensity so the effect is also
 * usable standalone (e.g. for tests, debug overlays, or any code path that
 * wants a procedural soft-circle quad).
 * @category Effects
 * @example
 * const effect = new Light2dEffect(renderer, {
 *     color: lightColor,
 *     intensity: 0.7,
 * });
 * effect.setIntensity(1.2); // adjust at runtime
 */
export default class Light2dEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer} renderer - the current renderer instance
	 * @param {object} [options] - initial uniform values
	 * @param {Color} [options.color] - light color (0..255 RGB); defaults to white
	 * @param {number} [options.intensity=1] - 0..1+ light intensity
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uColor;
			uniform float uIntensity;
			vec4 apply(vec4 color, vec2 uv) {
				// recenter to [-1, 1] across the quad. For elliptical lights
				// the quad's own aspect ratio handles the squashing, so
				// length(c) == 1 already lies on the ellipse boundary
				// (radiusX, radiusY) in world space.
				vec2 c = uv * 2.0 - 1.0;
				float d = length(c);
				// linear ramp matches Canvas createRadialGradient's two-stop output
				float f = clamp(1.0 - d, 0.0, 1.0);
				float a = f * uIntensity;
				// premultiplied: composes correctly under additive ("lighter") blending
				return vec4(uColor * a, a);
			}
			`,
		);

		const color = options.color;
		if (color) {
			this.setColor(color);
		} else {
			this.setUniform("uColor", [1, 1, 1]);
		}
		this.setIntensity(options.intensity ?? 1);
	}

	/**
	 * Set the light's color. RGB only — alpha is ignored (the falloff
	 * supplies the per-pixel alpha).
	 * @param {Color} color - 0..255 RGB color
	 */
	setColor(color) {
		this.setUniform("uColor", [color.r / 255, color.g / 255, color.b / 255]);
	}

	/**
	 * Set the light's intensity. Acts as a brightness multiplier on the
	 * falloff curve; values above 1 over-saturate the center of the light.
	 * @param {number} intensity - 0..1+ multiplier
	 */
	setIntensity(intensity) {
		this.setUniform("uIntensity", intensity);
	}
}
