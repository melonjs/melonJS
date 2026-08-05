import ShaderEffect from "./shadereffect.js";

// the WGSL twin of the GLSL body below — same logic, same uniform
// names, picked by the ShaderEffect base per renderer.shaderLanguage
const wgslFragment = `
struct ShadowUniforms {
	uShadowOffset : vec2f,
	uShadowColor : vec3f,
	uShadowOpacity : f32,
	uTextureSize : vec2f,
	uUVYDir : f32,
};
@group(3) @binding(0) var<uniform> fx : ShadowUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	if (color.a > 0.0) {
		return color;
	}
	// check if the shadow source pixel is opaque. Level-0 sample: past a
	// non-uniform return implicit derivatives are unavailable (sprites are
	// single-level textures, so identical output)
	var offset = fx.uShadowOffset / fx.uTextureSize;
	// uUVYDir keeps "down" pointing down whatever the sampled space's
	// vertical orientation (always +1 under WebGPU; the GL pooled path
	// sets -1 for its bottom-up captures)
	offset.y = offset.y * fx.uUVYDir;
	let shadowAlpha = textureSampleLevel(uTexture, uSampler, uv - offset, 0.0).a;
	if (shadowAlpha > 0.0) {
		return vec4f(fx.uShadowColor, shadowAlpha * fx.uShadowOpacity) * vColor;
	}
	return color;
}
`;

/**
 * A shader effect that adds a drop shadow beneath the sprite.
 * Works by sampling the texture at an offset — if the offset position
 * has an opaque pixel but the current position doesn't, the shadow is drawn.
 * @category Effects
 * @see {@link Renderable.shader} for usage
 * @example
 * // dark shadow offset to the bottom-right
 * mySprite.shader = new DropShadowEffect(renderer, {
 *     offsetX: 3.0,
 *     offsetY: 3.0,
 *     color: [0.0, 0.0, 0.0],
 *     opacity: 0.5,
 * });
 */
export default class DropShadowEffect extends ShaderEffect {
	/**
	 * @param {import("../webgl_renderer.js").default} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.offsetX=2.0] - shadow x offset in texels
	 * @param {number} [options.offsetY=2.0] - shadow y offset in texels
	 * @param {number[]} [options.color=[0.0, 0.0, 0.0]] - shadow color as [r, g, b] (0.0–1.0)
	 * @param {number} [options.opacity=0.5] - shadow opacity (0.0–1.0)
	 * @param {number[]} [options.textureSize=[256, 256]] - texture dimensions [width, height]
	 */
	constructor(renderer, options = {}) {
		super(renderer, {
			glsl: `
			uniform vec2 uShadowOffset;
			uniform vec3 uShadowColor;
			uniform float uShadowOpacity;
			uniform vec2 uTextureSize;
			uniform float uUVYDir;
			vec4 apply(vec4 color, vec2 uv) {
				if (color.a > 0.0) {
					return color;
				}
				// check if the shadow source pixel is opaque. uUVYDir keeps
				// "down" pointing down whatever the sampled space's vertical
				// orientation (+1 sampling the sprite atlas directly, -1 on
				// the pooled path's bottom-up capture FBOs)
				vec2 offset = uShadowOffset / uTextureSize;
				offset.y *= uUVYDir;
				float shadowAlpha = texture2D(uSampler, uv - offset).a;
				if (shadowAlpha > 0.0) {
					return vec4(uShadowColor, shadowAlpha * uShadowOpacity) * vColor;
				}
				return color;
			}
			`,
			wgsl: wgslFragment,
		});

		const texSize = options.textureSize ?? [256, 256];
		this.setUniform(
			"uShadowOffset",
			new Float32Array([options.offsetX ?? 2.0, options.offsetY ?? 2.0]),
		);
		this.setUniform(
			"uShadowColor",
			new Float32Array(options.color ?? [0.0, 0.0, 0.0]),
		);
		this.setUniform("uShadowOpacity", options.opacity ?? 0.5);
		this.setUniform("uTextureSize", new Float32Array(texSize));
		// uv.y grows downward until a renderer path says otherwise
		this.setUniform("uUVYDir", 1.0);
	}

	/**
	 * set the shadow offset
	 * @param {number} x - x offset in texels
	 * @param {number} y - y offset in texels
	 */
	setOffset(x, y) {
		this.setUniform("uShadowOffset", new Float32Array([x, y]));
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
