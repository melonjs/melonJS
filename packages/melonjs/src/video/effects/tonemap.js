import ShaderEffect from "./shadereffect.js";

/*
 * Tone mapping: squeeze a range brighter than the display into the range the
 * display has, with a curve instead of a clamp.
 *
 * Without it, anything over 1 clips flat, and clipping is what makes a bright
 * effect read as a white sticker rather than as light: every channel arrives
 * at 1 together, so the hue is thrown away exactly where the eye expects a
 * hot core to shift toward white THROUGH its own colour. A curve keeps the
 * shift continuous, so a red bolt goes orange and then white-hot at the
 * filament, which is what a real one does.
 *
 * ### This is a look, not a colour-managed pipeline
 *
 * A physically-correct chain renders into a floating-point target, keeps
 * values above 1 all the way through, tone maps once and encodes to sRGB at
 * the end. melonJS renders into `RGBA8` throughout, so by the time this runs
 * the frame is already clamped: the curve is being applied to values in
 * `[0, 1]`, and `exposure` is what lifts them back into a range the curve has
 * something to do with.
 *
 * That is worth knowing rather than hiding, because it sets expectations. It
 * still earns its place — pushing exposure past 1 and letting the curve bring
 * the result back is how the highlights stop competing for the same flat
 * white — but it is a grade, and the effect does NOT do a linear-to-sRGB
 * conversion, because the engine never linearized in the first place.
 *
 * Pair it with {@link BloomEffect}: bloom first to spread the bright parts,
 * tone map last so the sum of the two lands inside the display range instead
 * of clipping where they overlap.
 */

/**
 * The curves, as GLSL and WGSL expressions over a `vec3`/`vec3f` named `c`.
 * Written once per language so the two cannot drift, and BAKED into the body
 * at construction rather than selected by a uniform: which curve you want is
 * a decision about the look of the game, made once, and baking it keeps each
 * program to the arithmetic it actually uses.
 *
 * Exported so the spec can check each `fn` against the shader text beside it
 * rather than keeping a second copy of the same maths, which is the copy that
 * would drift.
 * @ignore
 * @internal
 */
export const CURVES = {
	/**
	 * Reinhard. The gentlest of the three and the easiest to reason about:
	 * it never reaches 1, compresses smoothly everywhere, and desaturates
	 * highlights as they climb.
	 */
	reinhard: {
		glsl: "c / (vec3(1.0) + c)",
		wgsl: "c / (vec3f(1.0) + c)",
		/**
		 * The same curve for one scalar on the CPU, which is how `white` is
		 * turned into a scale factor. Kept beside its shader twin because the
		 * two must agree: a drift here shows up as a white point that lands
		 * somewhere other than white, which reads as a broken slider rather
		 * than as a wrong formula. `tonemap-effect.spec.js` pins them
		 * together.
		 * @param {number} c - the value
		 * @returns {number} the mapped value
		 */
		fn: (c) => {
			return c / (1 + c);
		},
	},
	/**
	 * The Narkowicz approximation of the ACES filmic curve. More contrast in
	 * the midtones and a longer shoulder, which is the look most games and
	 * film stocks have; the default for that reason.
	 *
	 * **Not usable with `hdrOutput`.** The expression clamps to `[0, 1]`
	 * itself, so everything past the shoulder collapses to a single value
	 * before the white point scales it, and different bright things present
	 * equally bright. The other two approach 1 asymptotically without
	 * clamping, so they keep their ordering when the white point lifts them
	 * past it.
	 */
	aces: {
		glsl: "clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0)",
		wgsl: "clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3f(0.0), vec3f(1.0))",
		/** @param {number} c - the value @returns {number} the mapped value */
		fn: (c) => {
			return Math.min(
				1,
				Math.max(0, (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14)),
			);
		},
	},
	/**
	 * `1 - exp(-c)`. Each channel saturates at its own rate, so a saturated
	 * colour shifts toward white through its own hue rather than all three
	 * channels arriving together.
	 */
	exponential: {
		glsl: "vec3(1.0) - exp(-c)",
		wgsl: "vec3f(1.0) - exp(-c)",
		/** @param {number} c - the value @returns {number} the mapped value */
		fn: (c) => {
			return 1 - Math.exp(-c);
		},
	},
};

/** the default curve, and what an unknown `mode` falls back to */
const DEFAULT_MODE = "aces";

/**
 * Both bodies from one template, so a fix to the premultiply handling cannot
 * land in only one backend.
 * @param {string} mode - the curve name
 * @returns {{glsl: string, wgsl: string}} the dual-language body
 * @ignore
 * @internal
 */
function buildBody(mode) {
	const curve = CURVES[mode] ?? CURVES[DEFAULT_MODE];
	// The two bodies are written from ONE shape below, because the last time
	// they were separate literals they drifted in exactly the line that
	// matters here.
	//
	// `clamp(a, 0.0001, 1.0)` at both ends, and the upper bound is the one
	// that is easy to miss. Alpha is supposed to be in [0, 1], but under
	// `hdr: true` the targets are half-float and `blendFunc(ONE, ONE)`
	// applies to alpha as well as colour, so an additive stack accumulates
	// past 1 instead of saturating. Dividing by that alpha hands the curve a
	// fraction of the real radiance, maps it well inside the shoulder, and
	// then multiplies it back out past 1 — the tone map quietly stops
	// working in exactly the hot spots it exists for. The lower bound is the
	// ordinary divide-by-zero guard.
	const body = (lang) => {
		const vec3 = lang === "wgsl" ? "vec3f" : "vec3";
		const vec4 = lang === "wgsl" ? "vec4f" : "vec4";
		const expo = lang === "wgsl" ? "fx.uExposure" : "uExposure";
		const decl = lang === "wgsl" ? "let" : "float";
		const white = lang === "wgsl" ? "fx.uWhiteScale" : "uWhiteScale";
		return `	${decl} a = clamp(color.a, 0.0001, 1.0);
	// straight colour in, premultiplied colour out: everything reaching an
	// effect body is premultiplied, and a curve applied to premultiplied
	// colour darkens whatever is partly transparent by its own alpha twice
	${lang === "wgsl" ? "var" : vec3} c = color.rgb / a;
	c = c * ${expo};
	c = ${curve[lang]};
	// the white point, as a scale: uWhiteScale is 1/curve(white), so the
	// value the game called white leaves the curve at exactly 1. It is 1
	// when no white point was set, which is the curve's own shoulder
	c = c * ${white};
	return ${vec4}(c * color.a, color.a);`;
	};
	return {
		glsl: `
uniform float uExposure;
uniform float uWhiteScale;

vec4 apply(vec4 color, vec2 uv) {
${body("glsl")}
}
`,
		wgsl: `
struct ToneMapUniforms {
	uExposure : f32,
	uWhiteScale : f32,
};
@group(3) @binding(0) var<uniform> fx : ToneMapUniforms;

fn apply(color : vec4f, uv : vec2f) -> vec4f {
${body("wgsl")}
}
`,
	};
}

/**
 * A shader effect that tone maps what it is applied to: values are lifted by
 * `exposure` and brought back into display range by a curve, instead of
 * clipping flat at white.
 *
 * Put it on the CAMERA, and put it LAST — after {@link BloomEffect}, so the
 * light bloom spreads is mapped along with everything else rather than
 * clipping where the two overlap.
 *
 * Three curves, chosen once at construction:
 *
 * | `mode` | character |
 * |---|---|
 * | `"aces"` | filmic: more midtone contrast, long shoulder. The default. Clamps internally, so it cannot feed `hdrOutput` |
 * | `"reinhard"` | gentle and neutral, desaturates highlights as they climb |
 * | `"exponential"` | channels saturate separately, so a hot core shifts toward white through its own hue |
 *
 * **Without `hdr: true` it is a grade, not a colour-managed pipeline.** The
 * default render targets are `RGBA8`, so the frame reaching this is already
 * clamped to `[0, 1]` and `exposure` is what gives the curve something to
 * work on. With the `hdr` application setting on, the targets are half-float
 * and the values arriving are genuinely above 1, which is what the curve is
 * for. Either way it does not convert linear to sRGB, because nothing
 * linearized it.
 * @category Effects
 * @see {@link Renderable#addPostEffect} for usage
 * @example
 * // the usual pairing: spread the bright parts, then map the result
 * game.viewport.addPostEffect(new BloomEffect(renderer));
 * game.viewport.addPostEffect(new ToneMappingEffect(renderer, { exposure: 1.6 }));
 *
 * @example
 * // a hot core that shifts through its own colour on the way to white
 * const grade = new ToneMappingEffect(renderer, {
 *     mode: "exponential",
 *     exposure: 2.2,
 * });
 * game.viewport.addPostEffect(grade);
 * // and dip it for a moment when the player is hit
 * grade.setExposure(0.7);
 */
export default class ToneMappingEffect extends ShaderEffect {
	/**
	 * @param {WebGLRenderer|WebGPURenderer|CanvasRenderer} renderer - the current renderer instance
	 * @param {object} [options] - effect options
	 * @param {string} [options.mode="aces"] - curve: `"aces"`, `"reinhard"` or `"exponential"`
	 * @param {number} [options.exposure=1.0] - multiplier applied before the curve; above `1` lifts the image into the curve's shoulder
	 * @param {number} [options.white] - the post-exposure value that should come out as display white. Omitted, the curve keeps its own shoulder and nothing reaches 1 exactly
	 */
	constructor(renderer, options = {}) {
		const mode = options.mode ?? DEFAULT_MODE;
		super(renderer, buildBody(mode));

		/**
		 * which curve this instance baked, for reading back
		 * @type {string}
		 * @readonly
		 */
		this.mode = mode in CURVES ? mode : DEFAULT_MODE;
		this.exposure = options.exposure ?? 1.0;
		this.setUniform("uExposure", this.exposure);

		/**
		 * The post-exposure value that comes out as display white, or `0`
		 * when the curve is left with its own shoulder.
		 * @type {number}
		 * @readonly
		 */
		this.white = 0;
		this.setWhite(options.white ?? 0);
	}

	/**
	 * Set the white point: the value that should come out as display white.
	 *
	 * This is the knob a "brightness" or "peak" slider in a settings screen
	 * drives. Without it a tone curve only approaches 1 asymptotically, so
	 * nothing in the frame is ever quite white and a player who wants a
	 * brighter picture can only raise `exposure`, which lifts the midtones
	 * with it. A white point moves where the shoulder lands instead.
	 *
	 * Implemented as a scale rather than a reshaped curve: the value is run
	 * through the same curve on the CPU and the shader multiplies by its
	 * reciprocal, so `white` maps to exactly 1 and everything under it keeps
	 * the curve's shape. Values above it clip, which is what "white point"
	 * means.
	 * @param {number} white - the value to map to white; `0` or less restores the curve's own shoulder
	 */
	setWhite(white) {
		this.white = Math.max(0, white);
		// `curve(white)` is at most 1, so the reciprocal is at least 1 — the
		// image can only get brighter from here, never darker
		const mapped = this.white > 0 ? CURVES[this.mode].fn(this.white) : 0;
		this.setUniform("uWhiteScale", mapped > 0 ? 1 / mapped : 1);
	}

	/**
	 * set the exposure. Cheap, and safe to drive per frame: it is a uniform,
	 * so changing it does not rebuild the program the way `mode` would.
	 * @param {number} exposure - multiplier applied before the curve; `0` maps everything to black
	 */
	setExposure(exposure) {
		this.exposure = Math.max(0, exposure);
		this.setUniform("uExposure", this.exposure);
	}
}
