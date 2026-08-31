import ShaderEffect from "./shadereffect.js";

// the effect body, dual-authored: same logic, same uniform names, one body
// per shading language — the ShaderEffect base picks the one matching the
// active renderer (renderer.shaderLanguage)
const fragment = `
			uniform float uStrength;
			uniform float uSize;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 vig = uv * (1.0 - uv);
				float v = clamp(pow(vig.x * vig.y * uSize, uStrength), 0.0, 1.0);
				return vec4(color.rgb * v, color.a);
			}
			`;

const wgslFragment = `
struct VignetteUniforms {
	uStrength : f32,
	uSize : f32,
};
@group(3) @binding(0) var<uniform> fx : VignetteUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let vig = uv * (1.0 - uv);
	let v = clamp(pow(vig.x * vig.y * fx.uSize, fx.uStrength), 0.0, 1.0);
	return vec4f(color.rgb * v, color.a);
}
`;

/**
 * A shader effect that darkens the edges of the screen, drawing focus
 * to the center. Commonly used for atmosphere, cinematic feel, or to
 * naturally frame a camera viewport (e.g. minimap).
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // subtle vignette on the main camera
 * app.viewport.addPostEffect(new VignetteEffect(renderer));
 * @example
 * // stronger cinematic vignette
 * app.viewport.addPostEffect(new VignetteEffect(renderer, {
 *     strength: 0.3,
 *     size: 20.0,
 * }));
 */
export default class VignetteEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.strength=0.15] - edge darkening power (lower = stronger darkening, higher = softer falloff)
	 * @param {number} [options.size=25.0] - vignette spread multiplier (higher = smaller dark area)
	 */
	constructor(renderer, options = {}) {
		super(renderer, { glsl: fragment, wgsl: wgslFragment });

		this.strength = options.strength ?? 0.15;
		this.size = options.size ?? 25.0;

		this.setUniform("uStrength", this.strength);
		this.setUniform("uSize", this.size);
	}

	/**
	 * set the vignette strength
	 * @param {number} strength - edge darkening power (lower = stronger, higher = softer)
	 */
	setStrength(strength) {
		this.strength = Math.max(0, strength);
		this.setUniform("uStrength", this.strength);
	}

	/**
	 * set the vignette size
	 * @param {number} size - spread multiplier (higher = smaller dark area)
	 */
	setSize(size) {
		this.size = Math.max(0, size);
		this.setUniform("uSize", this.size);
	}
}
