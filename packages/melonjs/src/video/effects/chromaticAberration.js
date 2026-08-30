import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct AberrationUniforms {
	uOffset : f32,
	uTextureSize : vec2f,
};
@group(3) @binding(0) var<uniform> fx : AberrationUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let texel = fx.uOffset / fx.uTextureSize;
	let r = textureSample(uTexture, uSampler, uv + vec2f(texel.x, 0.0)).r;
	let g = textureSample(uTexture, uSampler, uv).g;
	let b = textureSample(uTexture, uSampler, uv - vec2f(texel.x, 0.0)).b;
	let a = textureSample(uTexture, uSampler, uv).a;
	return vec4f(r, g, b, a) * vColor;
}
`;

/**
 * A shader effect that offsets the RGB color channels to create a
 * chromatic aberration (color fringe) effect. Commonly used for
 * impact feedback, glitch effects, or damage indicators.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // subtle chromatic aberration
 * mySprite.addPostEffect(new ChromaticAberrationEffect(renderer, { offset: 2.0 }));
 * @example
 * // strong glitch effect
 * mySprite.addPostEffect(new ChromaticAberrationEffect(renderer, { offset: 5.0 }));
 */
export default class ChromaticAberrationEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.offset=3.0] - channel offset in texels
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uOffset;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 texel = uOffset / uTextureSize;
				float r = texture2D(uSampler, uv + vec2(texel.x, 0.0)).r;
				float g = texture2D(uSampler, uv).g;
				float b = texture2D(uSampler, uv - vec2(texel.x, 0.0)).b;
				float a = texture2D(uSampler, uv).a;
				return vec4(r, g, b, a) * vColor;
			}
			`,
			wgsl: wgslFragment,
		});

		this.offset = options.offset ?? 3.0;
		const texSize = options.textureSize ?? [256, 256];

		this.setUniform("uOffset", this.offset);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the channel offset
	 * @param {number} offset - offset in texels
	 */
	setOffset(offset) {
		this.offset = Math.max(0, offset);
		this.setUniform("uOffset", this.offset);
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
