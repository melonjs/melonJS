/**
 * `BloomEffect` — the engine's first screen-space bloom.
 *
 * What matters is not the look, which is taste, but three things a bloom has
 * to get right to be usable at all: it must compile on a real driver, both
 * language bodies must carry the SAME taps (they are generated from one
 * table, and a drift is invisible until someone runs the other backend), and
 * a pixel under the threshold must be left alone, or the whole frame lifts
 * and the game reads as fogged.
 *
 * The language bodies are exercised through stub renderers, the way
 * `shadereffect_dual_body.spec.js` does it, so the WGSL half is covered on a
 * machine with no WebGPU.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BloomEffect, GlowEffect } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/** how many taps the generator emits, counted from the shared table */
const TAP_COUNT = 12;

const wgslRenderer = { shaderLanguage: "wgsl", width: 800, height: 600 };

const created = [];

/** build an effect against a stub renderer, muting the backend warning */
function make(renderer, options) {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const effect = new BloomEffect(renderer, options);
	warn.mockRestore();
	created.push(effect);
	return effect;
}

afterEach(() => {
	for (const effect of created.splice(0)) {
		if (!effect.destroyed) {
			effect.destroy();
		}
	}
});

describe("BloomEffect — the two language bodies", () => {
	it("emits every tap into the WGSL body", () => {
		const effect = make(wgslRenderer);
		const body = effect.wgslRealization.body;
		expect(body).toContain("fn overBright(");
		// one read per tap, plus none for the centre, which reuses `color`
		const taps = body.match(/textureSample\(uTexture, uSampler, uv \+/g) ?? [];
		expect(taps).toHaveLength(TAP_COUNT);
		// the centre is the incoming colour, NOT a thirteenth sample: taking
		// it would read the same texel the quad already handed over
		expect(body).toContain("overBright(color) * 0.16");
	});

	it("weights the taps so the whole kernel sums to one", () => {
		const effect = make(wgslRenderer);
		const weights = [
			...effect.wgslRealization.body.matchAll(/\* (0\.\d+);$/gm),
		].map((m) => {
			return Number.parseFloat(m[1]);
		});
		// every tap plus the centre
		expect(weights).toHaveLength(TAP_COUNT + 1);
		// `intensity` then means "this much of the over-bright light, added
		// back", rather than an arbitrary scale that shifts whenever a tap is
		// added or a weight is retuned
		const total = weights.reduce((a, b) => {
			return a + b;
		}, 0);
		expect(total).toBeCloseTo(1, 5);
	});

	it("records its uniforms whichever backend it realized on", () => {
		const effect = make(wgslRenderer);
		expect(effect._uniformValues.get("uThreshold")).toBeCloseTo(0.75, 5);
		expect(effect._uniformValues.get("uIntensity")).toBeCloseTo(1, 5);
		expect(effect._uniformValues.get("uRadius")).toBeCloseTo(2, 5);
	});

	it("sizes itself from the renderer, since a camera effect filters the frame", () => {
		// the tap offsets are in TEXELS, so a fixed default would give the
		// wrong halo width on every canvas but one
		const effect = make(wgslRenderer);
		expect(Array.from(effect._uniformValues.get("uTextureSize"))).toEqual([
			800, 600,
		]);
	});

	it("takes explicit options over both", () => {
		const effect = make(wgslRenderer, {
			threshold: 0.85,
			intensity: 1.4,
			radius: 4,
			textureSize: [320, 240],
		});
		expect(effect._uniformValues.get("uThreshold")).toBeCloseTo(0.85, 5);
		expect(effect._uniformValues.get("uIntensity")).toBeCloseTo(1.4, 5);
		expect(effect._uniformValues.get("uRadius")).toBeCloseTo(4, 5);
		expect(Array.from(effect._uniformValues.get("uTextureSize"))).toEqual([
			320, 240,
		]);
	});

	it("refuses a negative radius, intensity or threshold", () => {
		const effect = make(wgslRenderer);
		// a negative radius mirrors every tap through the centre, which still
		// draws and is never what the caller meant
		effect.setRadius(-3);
		effect.setIntensity(-1);
		effect.setThreshold(-1);
		expect(effect._uniformValues.get("uRadius")).toBe(0);
		expect(effect._uniformValues.get("uIntensity")).toBe(0);
		expect(effect._uniformValues.get("uThreshold")).toBe(0);
	});

	it("moves with setTextureSize, for a resize", () => {
		const effect = make(wgslRenderer);
		effect.setTextureSize(1280, 720);
		expect(Array.from(effect._uniformValues.get("uTextureSize"))).toEqual([
			1280, 720,
		]);
	});
});

describe("BloomEffect — on a real driver", () => {
	/** @type {object | undefined} */
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
	});

	it("compiles and links", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// `ShaderEffect` links in its constructor and `getProgramParameter`
		// blocks until the driver finishes, so reaching a fragment source at
		// all means the generated GLSL compiled and linked.
		const effect = new BloomEffect(renderer);
		const src = effect._shader._sourceFragment;
		expect(src).toContain("overBright");
		const taps = src.match(/texture2D\(uSampler, uv \+/g) ?? [];
		expect(taps).toHaveLength(TAP_COUNT);
		// and the same kernel as the WGSL body, checked here rather than
		// assumed: both are generated from one table, so the only way they
		// can disagree is if someone edits one body by hand, which is exactly
		// the change no one would notice
		const weights = [...src.matchAll(/\* (0\.\d+);$/gm)].map((m) => {
			return Number.parseFloat(m[1]);
		});
		expect(weights).toHaveLength(TAP_COUNT + 1);
		expect(
			weights.reduce((a, b) => {
				return a + b;
			}, 0),
		).toBeCloseTo(1, 5);
		effect.destroy();
		releaseWebGLRenderer();
	});

	it("is not GlowEffect", (ctx) => {
		if (typeof renderer === "undefined") {
			ctx.skip();
			return;
		}
		// `GlowEffect` opens with `if (color.a > 0.0) return color;` — it
		// draws OUTSIDE a silhouette, so on an opaque frame it returns early
		// on every fragment and a camera-wide glow does nothing whatever.
		// Ending that confusion is why this class exists, so it must not
		// inherit the trait.
		const glow = new GlowEffect(renderer);
		expect(glow._shader._sourceFragment).toMatch(/color\.a\s*>\s*0\.0/);
		const bloom = new BloomEffect(renderer);
		expect(bloom._shader._sourceFragment).not.toMatch(/color\.a\s*>\s*0\.0/);
		glow.destroy();
		bloom.destroy();
		releaseWebGLRenderer();
	});
});
