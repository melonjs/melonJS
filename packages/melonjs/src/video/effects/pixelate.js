import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct PixelateUniforms {
	uPixelSize : f32,
	uTextureSize : vec2f,
};
@group(3) @binding(0) var<uniform> fx : PixelateUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let texel = fx.uPixelSize / fx.uTextureSize;
	let snapped = texel * floor(uv / texel) + texel * 0.5;
	return textureSample(uTexture, uSampler, snapped) * vColor;
}
`;

/**
 * A shader effect that pixelates the sprite by snapping UV coordinates
 * to a grid. Commonly used for teleport effects, transitions, or retro styling.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // moderate pixelation
 * mySprite.addPostEffect(new PixelateEffect(renderer, { size: 8.0 }));
 * @example
 * // animate the pixelation (e.g. for teleport)
 * pixelate.setSize(pixelate.size + dt / 50);
 */
export default class PixelateEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.size=4.0] - pixel size in texels (higher = more pixelated)
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform float uPixelSize;
			uniform vec2 uTextureSize;
			vec4 apply(vec4 color, vec2 uv) {
				vec2 texel = uPixelSize / uTextureSize;
				vec2 snapped = texel * floor(uv / texel) + texel * 0.5;
				return texture2D(uSampler, snapped) * vColor;
			}
			`,
			wgsl: wgslFragment,
		});

		this.size = options.size ?? 4.0;
		const texSize = options.textureSize ?? [256, 256];

		this.setUniform("uPixelSize", this.size);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the pixel size
	 * @param {number} size - pixel size in texels
	 */
	setSize(size) {
		this.size = Math.max(1, size);
		this.setUniform("uPixelSize", this.size);
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
