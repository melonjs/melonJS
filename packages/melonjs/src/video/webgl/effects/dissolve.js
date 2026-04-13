import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that dissolves the sprite using a noise-based threshold.
 * Pixels are discarded based on a pseudo-random noise pattern as the
 * `progress` value increases from 0 to 1.
 * Commonly used for death, spawn, or teleport effects.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // create a dissolve effect
 * const dissolve = new DissolveEffect(renderer);
 * mySprite.shader = dissolve;
 *
 * // animate the dissolve (0 = fully visible, 1 = fully dissolved)
 * dissolve.setProgress(0.5);
 */
export default class DissolveEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.progress=0.0] - dissolve progress (0.0 = visible, 1.0 = dissolved)
	 * @param {number[]} [options.edgeColor=[1.0, 0.5, 0.0]] - color of the dissolve edge
	 * @param {number} [options.edgeWidth=0.05] - width of the colored edge (0.0–1.0)
	 */
	constructor(renderer, options = {}) {
		super(
			renderer,
			`
			uniform float uDissolveProgress;
			uniform vec3 uEdgeColor;
			uniform float uEdgeWidth;
			// pseudo-random hash
			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
			}
			// smooth value noise
			float vnoise(vec2 p) {
				vec2 i = floor(p);
				vec2 f = fract(p);
				f = f * f * (3.0 - 2.0 * f);
				return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
				           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
			}
			// fractal brownian motion for organic shapes
			float fbm(vec2 p) {
				float v = 0.0, a = 0.5;
				for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.0; a *= 0.5; }
				return v;
			}
			vec4 apply(vec4 color, vec2 uv) {
				if (uDissolveProgress <= 0.0) {
					return color;
				}
				float n = fbm(uv * 8.0);
				if (n < uDissolveProgress) {
					discard;
				}
				// glowing burn edge
				float dist = (n - uDissolveProgress) / uEdgeWidth;
				if (dist < 1.0) {
					float t = 1.0 - dist;
					// 3-stop gradient: red edge -> orange -> bright white core
					vec3 red = vec3(0.8, 0.1, 0.0);
					vec3 glow = (t < 0.5)
						? mix(red, uEdgeColor, t * 2.0)
						: mix(uEdgeColor, vec3(1.0, 0.95, 0.8), (t - 0.5) * 2.0);
					glow *= 1.0 + t * t;
					return vec4(mix(color.rgb, glow, t) * color.a, color.a);
				}
				return color;
			}
			`,
		);

		this.progress = options.progress ?? 0.0;
		this.setUniform("uDissolveProgress", this.progress);
		this.setUniform(
			"uEdgeColor",
			new Float32Array(options.edgeColor ?? [1.0, 0.5, 0.0]),
		);
		this.setUniform("uEdgeWidth", options.edgeWidth ?? 0.1);
	}

	/**
	 * set the dissolve progress
	 * @param {number} value - dissolve progress (0.0 = visible, 1.0 = dissolved)
	 */
	setProgress(value) {
		this.progress = Math.max(0, Math.min(1, value));
		this.setUniform("uDissolveProgress", this.progress);
	}

	/**
	 * set the edge color
	 * @param {number[]} color - edge color as [r, g, b] (0.0–1.0)
	 */
	setEdgeColor(color) {
		this.setUniform("uEdgeColor", new Float32Array(color));
	}
}
