import ShaderEffect from "./shadereffect.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "../canvas/canvas_renderer.js";
 * @import WebGLRenderer from "../webgl/webgl_renderer.js";
 * @import WebGPURenderer from "../webgpu/webgpu_renderer.js";
 * @import Renderer from "../renderer.js";
 */
/*
 * Bloom in ONE pass.
 *
 * The textbook bloom is three passes: threshold to an offscreen target,
 * separable blur across two more, then add. That needs render targets the
 * effect contract does not own, so this gathers instead: thirteen taps on two
 * rings, each thresholded as it is read. The difference is visible only on a
 * very wide radius, where a gather starts to show its ring structure while a
 * separable blur stays smooth, and that is the regime a game should reach for
 * a real multi-pass chain in anyway.
 *
 * Thresholding happens PER TAP rather than once on the summed colour. Summing
 * first lets a cluster of mid-bright pixels add up past the threshold and
 * bloom as a group, which makes flat lit walls glow at their corners. Per tap,
 * only genuinely over-bright pixels ever contribute.
 *
 * The knee is soft on purpose. A hard `step` at the threshold makes a light
 * that fades through it pop, because the bloom appears at full strength the
 * instant the pixel crosses; the quadratic knee below ramps it in over a small
 * band, which is what makes a dimming lamp read as dimming rather than as
 * switching off.
 *
 * Luminance-weighted, not per channel: a saturated red at the same perceived
 * brightness as a grey blooms by the same amount, instead of the grey winning
 * because all three of its channels are high.
 */

/** the tap ring offsets, shared by both language bodies so they cannot drift */
const TAPS = [
	// inner ring: axis and diagonal at one radius
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[0.7071, 0.7071],
	[-0.7071, 0.7071],
	[0.7071, -0.7071],
	[-0.7071, -0.7071],
	// outer ring: axis only at twice the radius, which is where the halo
	// gets its reach without paying for eight more samples
	[2, 0],
	[-2, 0],
	[0, 2],
	[0, -2],
];

/**
 * Inner taps carry more of the halo than the outer ones, and the whole set
 * plus the centre sums to exactly 1, so `intensity` means "this much of the
 * over-bright light, added back" rather than an arbitrary scale.
 */
const WEIGHTS = TAPS.map(([x, y]) => {
	return Math.hypot(x, y) > 1.5 ? 0.055 : 0.0775;
});

/**
 * One `sum += overBright(...)` line per tap, generated for both languages
 * from the same table so the two bodies cannot drift apart.
 * @param {string} vec - the language's 2-vector constructor
 * @param {(uv: string) => string} sample - wraps a coordinate in a texture read
 * @returns {string} the tap lines
 */
const tapList = (vec, sample) => {
	return TAPS.map(([x, y], i) => {
		const at = `uv + ${vec}(${x.toFixed(4)}, ${y.toFixed(4)}) * texel`;
		return `\tsum += overBright(${sample(at)}) * ${WEIGHTS[i].toFixed(4)};`;
	}).join("\n");
};

const glslFragment = `
uniform float uThreshold;
uniform float uIntensity;
uniform float uRadius;
uniform vec2 uTextureSize;

vec3 overBright(vec4 c) {
	float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
	// soft quadratic knee over the eighth of a unit above the threshold
	float knee = clamp((l - uThreshold) / 0.125, 0.0, 1.0);
	return c.rgb * knee * knee;
}

vec4 apply(vec4 color, vec2 uv) {
	vec2 texel = uRadius / uTextureSize;
	vec3 sum = overBright(color) * 0.16;
${tapList("vec2", (at) => {
	return `texture2D(uSampler, ${at})`;
})}
	return vec4(color.rgb + sum * uIntensity, color.a);
}
`;

const wgslFragment = `
struct BloomUniforms {
	uThreshold : f32,
	uIntensity : f32,
	uRadius : f32,
	uTextureSize : vec2f,
};
@group(3) @binding(0) var<uniform> fx : BloomUniforms;

fn overBright(c : vec4f) -> vec3f {
	let l = dot(c.rgb, vec3f(0.2126, 0.7152, 0.0722));
	let knee = clamp((l - fx.uThreshold) / 0.125, 0.0, 1.0);
	return c.rgb * knee * knee;
}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let texel = fx.uRadius / fx.uTextureSize;
	var sum = overBright(color) * 0.16;
${tapList("vec2f", (at) => {
	return `textureSample(uTexture, uSampler, ${at})`;
})}
	return vec4f(color.rgb + sum * fx.uIntensity, color.a);
}
`;

/**
 * A shader effect that adds a bloom: the bright parts of what it is applied to
 * bleed light into the pixels around them.
 *
 * Reach for it on the CAMERA, where it works on the whole frame and makes
 * emitters, neon, fire and specular highlights read as light rather than as
 * bright paint. It works on a single renderable too, where it blooms only that
 * sprite's own bright pixels.
 *
 * Not to be confused with {@link GlowEffect}, which draws an outline OUTSIDE a
 * sprite's silhouette and does nothing at all on an opaque frame.
 *
 * `textureSize` must match what is being filtered, since the tap offsets are
 * in texels; it defaults to the renderer's own size, which is what a camera
 * effect wants. Call {@link BloomEffect#setTextureSize} from an
 * {@link event.ONRESIZE} handler, or after applying it to something smaller.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // whole-frame bloom, the usual case
 * game.viewport.addPostEffect(new BloomEffect(renderer));
 *
 * @example
 * // only the brightest highlights, and a wide soft halo
 * game.viewport.addPostEffect(
 *     new BloomEffect(renderer, { threshold: 0.85, radius: 4, intensity: 1.4 })
 * );
 */
export default class BloomEffect extends ShaderEffect {
	/**
	 * @param {Renderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {number} [options.threshold=0.75] - luminance a pixel must pass before it blooms, `0` (everything blooms) to `1` (only white does)
	 * @param {number} [options.intensity=1.0] - how much of the gathered light is added back
	 * @param {number} [options.radius=2.0] - halo reach, in texels
	 * @param {number[]} [options.textureSize] - dimensions of what is being filtered, `[width, height]`; defaults to the renderer's size
	 */
	constructor(renderer, options = {}) {
		super(renderer, { glsl: glslFragment, wgsl: wgslFragment });

		this.threshold = options.threshold ?? 0.75;
		this.intensity = options.intensity ?? 1.0;
		this.radius = options.radius ?? 2.0;
		// A camera effect filters the frame, so the frame's size is the useful
		// default. `BlurEffect` predates this and defaults to 256x256, which
		// is why its own docs have to tell you to set it.
		const texSize = options.textureSize ?? [
			renderer?.width ?? 256,
			renderer?.height ?? 256,
		];

		this.setUniform("uThreshold", this.threshold);
		this.setUniform("uIntensity", this.intensity);
		this.setUniform("uRadius", this.radius);
		this.setUniform("uTextureSize", new Float32Array(texSize));
	}

	/**
	 * set the luminance a pixel must pass before it contributes
	 * @param {number} threshold - `0` (everything blooms) to `1` (only white does)
	 */
	setThreshold(threshold) {
		this.threshold = Math.max(0, threshold);
		this.setUniform("uThreshold", this.threshold);
	}

	/**
	 * set how much of the gathered light is added back
	 * @param {number} intensity - `0` disables the effect without removing it
	 */
	setIntensity(intensity) {
		this.intensity = Math.max(0, intensity);
		this.setUniform("uIntensity", this.intensity);
	}

	/**
	 * set the halo reach
	 * @param {number} radius - reach in texels
	 */
	setRadius(radius) {
		this.radius = Math.max(0, radius);
		this.setUniform("uRadius", this.radius);
	}

	/**
	 * set the dimensions of what is being filtered. The tap offsets are in
	 * texels, so a stale size makes the halo the wrong width after a resize.
	 * @param {number} width - width in pixels
	 * @param {number} height - height in pixels
	 */
	setTextureSize(width, height) {
		this.setUniform("uTextureSize", new Float32Array([width, height]));
	}
}
