import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct BlurUniforms {
	uBlurStrength : f32,
	uTextureSize : vec2f,
};
@group(3) @binding(0) var<uniform> fx : BlurUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let texel = fx.uBlurStrength / fx.uTextureSize;
	var sum = vec4f(0.0);
	// 9-tap box blur
	sum += textureSample(uTexture, uSampler, uv + vec2f(-texel.x, -texel.y));
	sum += textureSample(uTexture, uSampler, uv + vec2f(0.0, -texel.y));
	sum += textureSample(uTexture, uSampler, uv + vec2f(texel.x, -texel.y));
	sum += textureSample(uTexture, uSampler, uv + vec2f(-texel.x, 0.0));
	sum += textureSample(uTexture, uSampler, uv);
	sum += textureSample(uTexture, uSampler, uv + vec2f(texel.x, 0.0));
	sum += textureSample(uTexture, uSampler, uv + vec2f(-texel.x, texel.y));
	sum += textureSample(uTexture, uSampler, uv + vec2f(0.0, texel.y));
	sum += textureSample(uTexture, uSampler, uv + vec2f(texel.x, texel.y));
	return (sum / 9.0) * vColor;
}
`;

/**
 * A shader effect that applies a box blur to the sprite.
 * Commonly used for background defocus, depth-of-field simulation,
 * or UI backdrop blur.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // moderate blur
 * mySprite.shader = new BlurEffect(renderer, { strength: 2.0 });
 */
export default class BlurEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.strength=1.0] - blur strength in texels
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uBlurStrength;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 texel = uBlurStrength / uTextureSize;
				vec4 sum = vec4(0.0);
				// 9-tap box blur
				sum += texture2D(uSampler, uv + vec2(-texel.x, -texel.y));
				sum += texture2D(uSampler, uv + vec2( 0.0,    -texel.y));
				sum += texture2D(uSampler, uv + vec2( texel.x, -texel.y));
				sum += texture2D(uSampler, uv + vec2(-texel.x,  0.0));
				sum += texture2D(uSampler, uv);
				sum += texture2D(uSampler, uv + vec2( texel.x,  0.0));
				sum += texture2D(uSampler, uv + vec2(-texel.x,  texel.y));
				sum += texture2D(uSampler, uv + vec2( 0.0,     texel.y));
				sum += texture2D(uSampler, uv + vec2( texel.x,  texel.y));
				return (sum / 9.0) * vColor;
			}
			`,
			wgsl: wgslFragment,
		});

		this.strength = options.strength ?? 1.0;
		const texSize = options.textureSize ?? [256, 256];

		this.setUniform("uBlurStrength", this.strength);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the blur strength
	 * @param {number} strength - blur strength in texels
	 */
	setStrength(strength) {
		this.strength = Math.max(0, strength);
		this.setUniform("uBlurStrength", this.strength);
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
