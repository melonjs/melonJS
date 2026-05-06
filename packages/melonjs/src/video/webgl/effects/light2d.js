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
 * renderer; per-frame uniforms (`uColor`, `uIntensity`, `uAspect`) are
 * updated via the semantic setters before each light's draw.
 *
 * The falloff curve is **linear** (`f = clamp(1 - d, 0, 1)`) to match
 * the existing Canvas `createRadialGradient` two-stop interpolation
 * exactly — preserves visual parity for users with calibrated scenes.
 * Output is premultiplied so the standard `"lighter"` (additive) blend
 * composes correctly across overlapping lights.
 *
 * The constructor accepts initial color / intensity / radii so the
 * effect is also usable standalone (e.g. for tests, debug overlays, or
 * any code path that wants a procedural soft-circle quad).
 * @category Effects
 * @example
 * const effect = new Light2dEffect(renderer, {
 *     color: lightColor,
 *     intensity: 0.7,
 *     radiusX: 80,
 *     radiusY: 80,
 * });
 * effect.setIntensity(1.2); // adjust at runtime
 */
export default class Light2dEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer} renderer - the current renderer instance
	 * @param {object} [options] - initial uniform values
	 * @param {Color} [options.color] - light color (0..255 RGB); defaults to white
	 * @param {number} [options.intensity=1] - 0..1+ light intensity
	 * @param {number} [options.radiusX=1] - light radius along the X axis
	 * @param {number} [options.radiusY] - light radius along the Y axis (defaults to `radiusX`)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform vec3 uColor;
			uniform float uIntensity;
			uniform vec2 uAspect;
			vec4 apply(vec4 color, vec2 uv) {
				// recenter to [-1, 1] and undo the quad's aspect stretch so
				// the falloff stays circular when radiusX !== radiusY
				vec2 c = (uv * 2.0 - 1.0) / uAspect;
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
		const rx = options.radiusX ?? 1;
		const ry = options.radiusY ?? rx;
		this.setRadii(rx, ry);
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

	/**
	 * Set the per-axis aspect for the falloff. The shader normalizes the
	 * UV-space distance by this aspect so the gradient stays circular in
	 * world space even when the quad is non-square (`radiusX !== radiusY`).
	 * @param {number} radiusX - light radius along the X axis
	 * @param {number} radiusY - light radius along the Y axis
	 */
	setRadii(radiusX, radiusY) {
		// scale the smaller axis: keeps the unit-circle falloff isotropic
		// inside the quad's local UV space
		const aspect =
			radiusX >= radiusY ? [1.0, radiusY / radiusX] : [radiusX / radiusY, 1.0];
		this.setUniform("uAspect", aspect);
	}
}
