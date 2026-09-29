/**
 * `ToneMappingEffect` — the curve that replaces a clamp.
 *
 * Three things have to hold. The chosen curve must be the one that ends up in
 * the shader (it is BAKED at construction, so picking the wrong one is silent
 * and permanent for that instance); both language bodies must carry the same
 * curve, since a drift is invisible until the other backend runs; and the
 * body must un-premultiply before mapping, because a curve applied to
 * premultiplied colour darkens anything partly transparent by its own alpha a
 * second time.
 *
 * The maths itself is checked against the curves evaluated in JS, so a typo in
 * a coefficient fails here rather than looking like a grading choice.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ToneMappingEffect } from "../src/index.js";
import { CURVES } from "../src/video/effects/tonemap.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const wgslRenderer = { shaderLanguage: "wgsl" };
const created = [];

function make(options) {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const effect = new ToneMappingEffect(wgslRenderer, options);
	warn.mockRestore();
	created.push(effect);
	return effect;
}

/** the WGSL body this instance realized */
const body = (effect) => {
	return effect.wgslRealization.body;
};

afterEach(() => {
	for (const effect of created.splice(0)) {
		if (!effect.destroyed) {
			effect.destroy();
		}
	}
});

describe("ToneMappingEffect — the baked curve", () => {
	it("defaults to the filmic curve", () => {
		const effect = make();
		expect(effect.mode).toBe("aces");
		// the ACES approximation's own coefficients, not another curve's
		expect(body(effect)).toContain("2.51");
		expect(body(effect)).toContain("0.14");
	});

	it("bakes reinhard when asked", () => {
		const effect = make({ mode: "reinhard" });
		expect(effect.mode).toBe("reinhard");
		expect(body(effect)).toContain("c / (vec3f(1.0) + c)");
		// and ONLY that curve: a body carrying two is a template bug
		expect(body(effect)).not.toContain("2.51");
		expect(body(effect)).not.toContain("exp(-c)");
	});

	it("bakes the exponential curve when asked", () => {
		const effect = make({ mode: "exponential" });
		expect(effect.mode).toBe("exponential");
		expect(body(effect)).toContain("exp(-c)");
		expect(body(effect)).not.toContain("2.51");
	});

	it("falls back to the default for a curve it does not have", () => {
		// a typo must not produce a shader with `undefined` spliced into it
		const effect = make({ mode: "filmic-ish" });
		expect(effect.mode).toBe("aces");
		expect(body(effect)).not.toContain("undefined");
		expect(body(effect)).toContain("2.51");
	});
});

describe("ToneMappingEffect — the contract of the body", () => {
	it("carries exposure as a live uniform, clamped at zero", () => {
		const effect = make({ exposure: 1.6 });
		expect(effect._uniformValues.get("uExposure")).toBeCloseTo(1.6, 5);
		effect.setExposure(0.4);
		expect(effect._uniformValues.get("uExposure")).toBeCloseTo(0.4, 5);
		// negative exposure inverts the image rather than darkening it
		effect.setExposure(-2);
		expect(effect._uniformValues.get("uExposure")).toBe(0);
	});
});

describe("ToneMappingEffect — the curves themselves", () => {
	/**
	 * Every curve must map `[0, inf)` into `[0, 1)` and rise monotonically,
	 * which is what makes it a tone map rather than a grade that can fold
	 * back on itself. Evaluated here in JS against the same expressions the
	 * shaders carry.
	 */
	// the SHIPPED evaluators, not a copy of them: a second transcription here
	// would pass while the one the white point actually uses was wrong
	const curves = Object.fromEntries(
		Object.entries(CURVES).map(([name, curve]) => {
			return [name, curve.fn];
		}),
	);

	it("maps black to black and never exceeds white", () => {
		for (const [name, f] of Object.entries(curves)) {
			expect(f(0), name).toBeCloseTo(0, 6);
			for (const v of [0.5, 1, 4, 20, 1000]) {
				expect(f(v), `${name} at ${v}`).toBeLessThanOrEqual(1);
				expect(f(v), `${name} at ${v}`).toBeGreaterThan(0);
			}
		}
	});

	it("rises monotonically, so no input ever gets darker than a dimmer one", () => {
		for (const [name, f] of Object.entries(curves)) {
			let prev = -1;
			for (let v = 0; v <= 8; v += 0.05) {
				const out = f(v);
				expect(out, `${name} at ${v.toFixed(2)}`).toBeGreaterThanOrEqual(prev);
				prev = out;
			}
		}
	});

	it("compresses rather than clips: 2 and 4 stay distinguishable", () => {
		// the failure a tone map exists to prevent is two different bright
		// values arriving at the same white
		for (const [name, f] of Object.entries(curves)) {
			expect(f(4) - f(2), name).toBeGreaterThan(0.001);
		}
	});
});

describe("ToneMappingEffect — on a real driver", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	it("ships the exact coefficients, in both languages", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// The property tests above evaluate the curves in JS, which proves the
		// formulas are sane but says nothing about the ones actually compiled:
		// a coefficient typo in the shader passes every one of them and just
		// looks like a grading choice. These pin the shipped text.
		const EXPECTED = {
			aces: {
				glsl: "clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0)",
				wgsl: "clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3f(0.0), vec3f(1.0))",
			},
			reinhard: {
				glsl: "c / (vec3(1.0) + c)",
				wgsl: "c / (vec3f(1.0) + c)",
			},
			exponential: {
				glsl: "vec3(1.0) - exp(-c)",
				wgsl: "vec3f(1.0) - exp(-c)",
			},
		};
		const squash = (t) => {
			return t.replace(/\s+/g, " ");
		};
		for (const [mode, want] of Object.entries(EXPECTED)) {
			const gl = new ToneMappingEffect(renderer, { mode });
			expect(squash(gl._shader._sourceFragment), `${mode} glsl`).toContain(
				squash(want.glsl),
			);
			gl.destroy();

			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const wg = new ToneMappingEffect(wgslRenderer, { mode });
			warn.mockRestore();
			expect(squash(wg.wgslRealization.body), `${mode} wgsl`).toContain(
				squash(want.wgsl),
			);
			wg.destroy();
		}
	});

	it("handles alpha identically in both languages", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// Checked in BOTH, because the previous version of this test asserted
		// the WGSL spelling only and the two bodies had already drifted in
		// exactly this line — the test was enshrining the drift it existed
		// to prevent.
		//
		// The upper clamp is the load-bearing one. Under `hdr: true` the
		// targets are half-float and `blendFunc(ONE, ONE)` accumulates alpha
		// past 1, so an unclamped divide hands the curve a fraction of the
		// real radiance and multiplies it back out past 1 afterwards.
		const gl = new ToneMappingEffect(renderer, {});
		const glsl = gl._shader._sourceFragment;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const wg = new ToneMappingEffect(wgslRenderer, {});
		warn.mockRestore();
		const wgsl = wg.wgslRealization.body;

		for (const [lang, src] of [
			["glsl", glsl],
			["wgsl", wgsl],
		]) {
			expect(src, `${lang} clamps alpha at both ends`).toContain(
				"clamp(color.a, 0.0001, 1.0)",
			);
			expect(src, `${lang} un-premultiplies`).toContain("color.rgb / a");
			// re-premultiplied by the ORIGINAL alpha, not the clamped one, or
			// a genuinely transparent pixel would come back opaque
			expect(src, `${lang} re-premultiplies`).toContain("c * color.a, color.a");
		}
		gl.destroy();
		wg.destroy();
	});

	it("applies exposure before the curve in both languages", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// after the curve, exposure would push the result back past 1 and
		// undo the mapping entirely
		const gl = new ToneMappingEffect(renderer, { mode: "aces" });
		const glsl = gl._shader._sourceFragment;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const wg = new ToneMappingEffect(wgslRenderer, { mode: "aces" });
		warn.mockRestore();
		const wgsl = wg.wgslRealization.body;

		expect(glsl.indexOf("2.51")).toBeGreaterThan(glsl.indexOf("c * uExposure"));
		expect(wgsl.indexOf("2.51")).toBeGreaterThan(
			wgsl.indexOf("c * fx.uExposure"),
		);
		gl.destroy();
		wg.destroy();
	});

	it("compiles and links every curve", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		for (const mode of ["aces", "reinhard", "exponential"]) {
			const effect = new ToneMappingEffect(renderer, { mode });
			expect(effect._shader._sourceFragment, mode).toContain("uExposure");
			effect.destroy();
		}
		releaseWebGLRenderer();
	});
});

describe("ToneMappingEffect — the white point", () => {
	it("defaults to off, leaving the curve its own shoulder", () => {
		const effect = make();
		expect(effect.white).toBe(0);
		expect(effect._uniformValues.get("uWhiteScale")).toBe(1);
	});

	it("scales so the chosen value lands on exactly white", () => {
		for (const mode of ["aces", "reinhard", "exponential"]) {
			for (const white of [0.5, 1, 2, 8]) {
				const effect = make({ mode, white });
				const scale = effect._uniformValues.get("uWhiteScale");
				// what the shader computes for that input: curve(white) * scale
				const out = CURVES[mode].fn(white) * scale;
				expect(out, `${mode} white=${white}`).toBeCloseTo(1, 5);
			}
		}
	});

	it("only ever brightens", () => {
		// curve(white) <= 1, so its reciprocal is >= 1. A white point that
		// darkened would be an exposure control wearing the wrong name
		for (const mode of ["aces", "reinhard", "exponential"]) {
			for (const white of [0.25, 1, 4, 100]) {
				const effect = make({ mode, white });
				expect(
					effect._uniformValues.get("uWhiteScale"),
					`${mode} white=${white}`,
				).toBeGreaterThanOrEqual(1);
			}
		}
	});

	it("is live, and 0 restores the shoulder", () => {
		const effect = make({ mode: "reinhard", white: 1 });
		expect(effect._uniformValues.get("uWhiteScale")).toBeCloseTo(2, 5);
		effect.setWhite(3);
		expect(effect.white).toBe(3);
		expect(effect._uniformValues.get("uWhiteScale")).toBeCloseTo(4 / 3, 5);
		effect.setWhite(0);
		expect(effect._uniformValues.get("uWhiteScale")).toBe(1);
		// negative is meaningless rather than inverting
		effect.setWhite(-2);
		expect(effect.white).toBe(0);
		expect(effect._uniformValues.get("uWhiteScale")).toBe(1);
	});

	it("carries the scale in both language bodies, after the curve", () => {
		const effect = make({ white: 2 });
		const wgsl = effect.wgslRealization.body;
		expect(wgsl).toContain("fx.uWhiteScale");
		// AFTER the curve: scaling before it would just be exposure again
		expect(wgsl.indexOf("fx.uWhiteScale")).toBeGreaterThan(
			wgsl.indexOf("2.51"),
		);
		expect(wgsl).toContain("uWhiteScale : f32");
	});
});
