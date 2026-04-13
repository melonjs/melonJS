import ShaderEffect from "../shadereffect.js";

/**
 * A shader effect that dissolves the sprite using a noise-based threshold.
 * Pixels are discarded based on a pseudo-random noise pattern as the
 * `progress` value increases from 0 to 1.
 * Commonly used for death, spawn, or teleport effects.
 * @category Effects
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
			// simple pseudo-random hash
			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
			}
			vec4 apply(vec4 color, vec2 uv) {
				if (uDissolveProgress <= 0.0) {
					return color;
				}
				float noise = hash(uv * 100.0);
				if (noise < uDissolveProgress) {
					discard;
				}
				// draw edge color near the dissolve threshold
				if (noise < uDissolveProgress + uEdgeWidth) {
					return vec4(uEdgeColor * color.a, color.a);
				}
				return color;
			}
			`,
		);

		this.progress = options.progress || 0.0;
		this.setUniform("uDissolveProgress", this.progress);
		this.setUniform(
			"uEdgeColor",
			new Float32Array(options.edgeColor || [1.0, 0.5, 0.0]),
		);
		this.setUniform("uEdgeWidth", options.edgeWidth || 0.05);
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
