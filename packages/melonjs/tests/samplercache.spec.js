/**
 * WebGL 2 sampler objects (#1585).
 *
 * GL bakes wrap and filter into the texture object, which is why one image at
 * two repeat modes needed two units and two uploads. Sampler objects move that
 * state onto the unit — the same separation the WebGPU backend has between
 * `GPUTexture` and `GPUSampler` — which is what allows texture residency to be
 * keyed by source alone.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, game, WebGLRenderer } from "../src/index.js";
import { GLSamplerCache } from "../src/video/webgl/utils/samplercache.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

describe("GLSamplerCache", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		await boot();
		try {
			await getWebGLRenderer(64, 64);
		} catch {
			// genuine WebGL absence — tests skip below
		}
		if (game.renderer instanceof WebGLRenderer) {
			renderer = game.renderer;
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		try {
			releaseWebGLRenderer();
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("dedupes by state, so the set stays tiny", (ctx) => {
		requireWebGL(ctx);
		const cache = new GLSamplerCache(gl);
		const a = cache.get(gl.LINEAR, "no-repeat");
		const b = cache.get(gl.LINEAR, "no-repeat");
		expect(b).toBe(a);
		// a scene has two filters times four repeat modes at most, however
		// many textures it loads
		cache.get(gl.NEAREST, "no-repeat");
		cache.get(gl.LINEAR, "repeat");
		expect(cache.samplers.size).toBe(3);
		cache.releaseAll(true);
	});

	it("distinguishes every axis that matters", (ctx) => {
		requireWebGL(ctx);
		const cache = new GLSamplerCache(gl);
		const base = cache.get(gl.LINEAR, "no-repeat", false);
		expect(cache.get(gl.NEAREST, "no-repeat", false)).not.toBe(base);
		expect(cache.get(gl.LINEAR, "repeat", false)).not.toBe(base);
		expect(cache.get(gl.LINEAR, "repeat-x", false)).not.toBe(base);
		expect(cache.get(gl.LINEAR, "repeat-y", false)).not.toBe(base);
		expect(cache.get(gl.LINEAR, "no-repeat", true)).not.toBe(base);
		cache.releaseAll(true);
	});

	it("maps repeat per axis, matching createTexture2D", (ctx) => {
		requireWebGL(ctx);
		const cache = new GLSamplerCache(gl);
		const x = cache.get(gl.LINEAR, "repeat-x");
		expect(gl.getSamplerParameter(x, gl.TEXTURE_WRAP_S)).toBe(gl.REPEAT);
		expect(gl.getSamplerParameter(x, gl.TEXTURE_WRAP_T)).toBe(gl.CLAMP_TO_EDGE);
		const y = cache.get(gl.LINEAR, "repeat-y");
		expect(gl.getSamplerParameter(y, gl.TEXTURE_WRAP_S)).toBe(gl.CLAMP_TO_EDGE);
		expect(gl.getSamplerParameter(y, gl.TEXTURE_WRAP_T)).toBe(gl.REPEAT);
		cache.releaseAll(true);
	});

	it("only goes trilinear over a linear chain", (ctx) => {
		requireWebGL(ctx);
		// "nearest" opts out of mip filtering so crisp pixel-art keeps hard
		// minification — the same rule the mesh path uses
		const cache = new GLSamplerCache(gl);
		const linear = cache.get(gl.LINEAR, "no-repeat", true);
		expect(gl.getSamplerParameter(linear, gl.TEXTURE_MIN_FILTER)).toBe(
			gl.LINEAR_MIPMAP_LINEAR,
		);
		const nearest = cache.get(gl.NEAREST, "no-repeat", true);
		expect(gl.getSamplerParameter(nearest, gl.TEXTURE_MIN_FILTER)).toBe(
			gl.NEAREST,
		);
		cache.releaseAll(true);
	});

	it("a bound sampler overrides the texture's own parameters", (ctx) => {
		requireWebGL(ctx);
		// this is the property the whole approach rests on: one texture can be
		// sampled at several variants at once, so residency need not be keyed
		// by variant
		const cache = new GLSamplerCache(gl);
		const tex = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

		cache.bind(0, cache.get(gl.LINEAR, "repeat"));
		expect(gl.getParameter(gl.SAMPLER_BINDING)).not.toBeNull();
		// the texture still reports its own state — the sampler simply wins at
		// sample time, which is why the texture parameters can stay as a
		// fallback for any path that binds no sampler
		expect(gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S)).toBe(
			gl.CLAMP_TO_EDGE,
		);

		cache.bind(0, null);
		expect(gl.getParameter(gl.SAMPLER_BINDING)).toBeNull();
		gl.deleteTexture(tex);
		cache.releaseAll(true);
	});

	// `get` runs once per QUAD, so it memoizes its last answer behind a
	// three-value guard, and `bind` skips a redundant bind per unit. Both are
	// caches over GL objects, which is exactly where a stale entry becomes a
	// silently-wrong render rather than an error.
	describe("hot-path memoization", () => {
		it("returns the cached sampler for a repeated lookup", (ctx) => {
			requireWebGL(ctx);
			const cache = new GLSamplerCache(gl);
			const spy = vi.spyOn(gl, "createSampler");
			const a = cache.get(gl.LINEAR, "repeat", false);
			const b = cache.get(gl.LINEAR, "repeat", false);
			expect(b).toBe(a);
			expect(spy).toHaveBeenCalledTimes(1);
			spy.mockRestore();
			cache.releaseAll(true);
		});

		it("the memo never answers for DIFFERENT arguments", (ctx) => {
			requireWebGL(ctx);
			// the regression a last-value memo invites: returning the previous
			// sampler because only the guard was checked, not the arguments
			const cache = new GLSamplerCache(gl);
			const base = cache.get(gl.LINEAR, "no-repeat", false);
			// change exactly one axis at a time, each straight after a hit
			cache.get(gl.LINEAR, "no-repeat", false);
			expect(cache.get(gl.NEAREST, "no-repeat", false)).not.toBe(base);
			cache.get(gl.LINEAR, "no-repeat", false);
			expect(cache.get(gl.LINEAR, "repeat", false)).not.toBe(base);
			cache.get(gl.LINEAR, "no-repeat", false);
			expect(cache.get(gl.LINEAR, "no-repeat", true)).not.toBe(base);
			// and coming back still gives the original
			expect(cache.get(gl.LINEAR, "no-repeat", false)).toBe(base);
			cache.releaseAll(true);
		});

		it("the memo is dropped on release, so no deleted sampler is reused", (ctx) => {
			requireWebGL(ctx);
			// the dangerous one: releaseAll deletes the GL objects, and a live
			// memo would hand a deleted sampler to the very next draw
			const cache = new GLSamplerCache(gl);
			const before = cache.get(gl.LINEAR, "repeat", false);
			cache.releaseAll(true);
			expect(gl.isSampler(before)).toBe(false);
			const after = cache.get(gl.LINEAR, "repeat", false);
			expect(after).not.toBe(before);
			expect(gl.isSampler(after)).toBe(true);
			cache.releaseAll(true);
		});

		it("skips a redundant bind, but never a needed one", (ctx) => {
			requireWebGL(ctx);
			const cache = new GLSamplerCache(gl);
			const a = cache.get(gl.LINEAR, "no-repeat");
			const b = cache.get(gl.NEAREST, "repeat");
			const spy = vi.spyOn(gl, "bindSampler");

			cache.bind(0, a);
			cache.bind(0, a);
			cache.bind(0, a);
			expect(spy).toHaveBeenCalledTimes(1);

			// a different sampler on the same unit must go through
			cache.bind(0, b);
			expect(spy).toHaveBeenCalledTimes(2);
			// and the same sampler on a DIFFERENT unit must too — the tracking
			// is per unit, not global
			cache.bind(1, b);
			expect(spy).toHaveBeenCalledTimes(3);
			// unbinding is a real transition
			cache.bind(0, null);
			expect(spy).toHaveBeenCalledTimes(4);

			spy.mockRestore();
			cache.releaseAll(true);
		});

		it("forgets its bindings on release, so the next bind re-issues", (ctx) => {
			requireWebGL(ctx);
			// GL drops sampler bindings when the objects die; believing a unit
			// still holds one would leave it sampling with the texture's own
			// parameters and no call to fix it
			const cache = new GLSamplerCache(gl);
			const a = cache.get(gl.LINEAR, "no-repeat");
			cache.bind(2, a);
			cache.releaseAll(true);

			const fresh = cache.get(gl.LINEAR, "no-repeat");
			const spy = vi.spyOn(gl, "bindSampler");
			cache.bind(2, fresh);
			expect(spy).toHaveBeenCalledTimes(1);
			spy.mockRestore();
			cache.releaseAll(true);
		});
	});

	it("the renderer owns one, and drops it on context loss", (ctx) => {
		requireWebGL(ctx);
		// renderer-owned so every batcher shares it; cleared rather than
		// replaced, so a second loss cannot orphan the first round
		expect(renderer.samplerCache).toBeInstanceOf(GLSamplerCache);
		renderer.samplerCache.get(gl.LINEAR, "no-repeat");
		expect(renderer.samplerCache.samplers.size).toBeGreaterThan(0);
		const identity = renderer.samplerCache;
		renderer.samplerCache.releaseAll();
		expect(renderer.samplerCache).toBe(identity);
		expect(renderer.samplerCache.samplers.size).toBe(0);
	});
});
