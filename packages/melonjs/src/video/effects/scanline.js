import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct ScanlineUniforms {
	uScanlineOpacity : f32,
	uCurvature : f32,
	uVignetteStrength : f32,
};
@group(3) @binding(0) var<uniform> fx : ScanlineUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	var c = color;
	var coords = uv;

	// barrel distortion (CRT curvature)
	if (fx.uCurvature > 0.0) {
		var centered = uv * 2.0 - 1.0;
		centered *= 1.0 + fx.uCurvature * dot(centered, centered);
		coords = centered * 0.5 + 0.5;
		if (coords.x < 0.0 || coords.x > 1.0 || coords.y < 0.0 || coords.y > 1.0) {
			discard;
		}
		c = textureSampleLevel(uTexture, uSampler, coords, 0.0) * vColor;
	}

	// scanlines
	let line = sin(coords.y * 800.0) * 0.5 + 0.5;
	c = vec4f(c.rgb * (1.0 - line * fx.uScanlineOpacity), c.a);

	// vignette
	if (fx.uVignetteStrength > 0.0) {
		let vig = coords * (1.0 - coords);
		let vigFactor = vig.x * vig.y * 15.0;
		c = vec4f(c.rgb * clamp(pow(vigFactor, fx.uVignetteStrength), 0.0, 1.0), c.a);
	}

	return c;
}
`;

/**
 * A shader effect that overlays horizontal scanlines on the sprite.
 * Can optionally add barrel distortion and vignette for a full CRT monitor look.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // simple scanlines
 * mySprite.addPostEffect(new ScanlineEffect(renderer, { opacity: 0.3 }));
 * @example
 * // full CRT look with curvature and vignette
 * mySprite.addPostEffect(new ScanlineEffect(renderer, {
 *     opacity: 0.3,
 *     curvature: 0.02,
 *     vignetteStrength: 0.3,
 * }));
 */
export default class ScanlineEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.opacity=0.25] - scanline darkness (0.0 = invisible, 1.0 = fully black lines)
	 * @param {number} [options.curvature=0.0] - barrel distortion strength (0.0 = flat, 0.02 = subtle CRT curve)
	 * @param {number} [options.vignetteStrength=0.0] - edge darkening strength (0.0 = none, 0.3 = subtle)
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uScanlineOpacity;
			uniform float uCurvature;
			uniform float uVignetteStrength;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 coords = uv;

				// barrel distortion (CRT curvature)
				if (uCurvature > 0.0) {
					vec2 centered = uv * 2.0 - 1.0;
					centered *= 1.0 + uCurvature * dot(centered, centered);
					coords = centered * 0.5 + 0.5;
					if (coords.x < 0.0 || coords.x > 1.0 || coords.y < 0.0 || coords.y > 1.0) {
						discard;
					}
					color = texture2D(uSampler, coords) * vColor;
				}

				// scanlines
				float line = sin(coords.y * 800.0) * 0.5 + 0.5;
				color.rgb *= 1.0 - line * uScanlineOpacity;

				// vignette
				if (uVignetteStrength > 0.0) {
					vec2 vig = coords * (1.0 - coords);
					float vigFactor = vig.x * vig.y * 15.0;
					color.rgb *= clamp(pow(vigFactor, uVignetteStrength), 0.0, 1.0);
				}

				return color;
			}
			`,
			wgsl: wgslFragment,
		});

		this.setUniform("uScanlineOpacity", options.opacity ?? 0.25);
		this.setUniform("uCurvature", options.curvature ?? 0.0);
		this.setUniform("uVignetteStrength", options.vignetteStrength ?? 0.0);
	}

	/**
	 * set the scanline opacity
	 * @param {number} opacity - scanline darkness (0.0–1.0)
	 */
	setOpacity(opacity) {
		this.setUniform("uScanlineOpacity", Math.max(0, Math.min(1, opacity)));
	}

	/**
	 * set the barrel curvature strength
	 * @param {number} curvature - distortion amount (0.0 = flat)
	 */
	setCurvature(curvature) {
		this.setUniform("uCurvature", curvature);
	}

	/**
	 * set the vignette strength
	 * @param {number} strength - edge darkening (0.0 = none)
	 */
	setVignetteStrength(strength) {
		this.setUniform("uVignetteStrength", strength);
	}
}
