import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, event, video, WebGLRenderer } from "../src/index.js";

/**
 * Regression tests for the cross-batcher binding-tracker reset
 * (the "planes go black / bullets go white" bug).
 *
 * Symptom: `TextureCache` reassigned units when the shader's sampler
 * range was exhausted (or via explicit `resetUnitAssignments`), but
 * only the CURRENT batcher's `boundTextures` map was cleared. Every
 * other batcher (mesh while quad current, vice versa) kept stale
 * `texture → WebGLTexture at unit` entries. Their next draw's
 * `bindTexture2D` short-circuit (`texture === boundTextures[unit]`)
 * skipped the actual `gl.bindTexture`, so the shader sampled whatever
 * the other batcher's texture happened to be at that GPU unit.
 *
 * Fix (event-based, see #1480):
 *   - `TextureCache` emits `event.GPU_TEXTURE_CACHE_RESET` after
 *     clearing `units` / `usedUnits`.
 *   - `MaterialBatcher` (base of `MeshBatcher`, `QuadBatcher`,
 *     `LitQuadBatcher`) subscribes in `init` and clears its own
 *     `boundTextures` + `currentTextureUnit` + `currentSamplerUnit`
 *     on the event.
 *
 * The event-driven design keeps `TextureCache` decoupled from
 * batchers (it doesn't reach into their internals), and lets future
 * GPU backends (WebGPU) reuse the same contract by reading the same
 * event.
 */
describe("GPU texture cache reset (cross-batcher binding-tracker regression)", () => {
	let renderer;
	let cache;
	let meshBatcher;
	let quadBatcher;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
	});

	beforeEach(() => {
		if (!(renderer instanceof WebGLRenderer)) {
			return;
		}
		cache = renderer.cache;
		meshBatcher = renderer.batchers.get("mesh");
		quadBatcher = renderer.batchers.get("quad");
	});

	it("the runner gave us a real WebGL renderer (no silent-skip)", () => {
		// Loud failure if WebGL didn't come up — without this, a real
		// regression in one of the tests below could silently "pass"
		// by skipping its body.
		expect(renderer).toBeInstanceOf(WebGLRenderer);
		expect(renderer.gl).toBeDefined();
		expect(meshBatcher).toBeDefined();
		expect(quadBatcher).toBeDefined();
	});

	describe("event emission contract", () => {
		it("resetUnitAssignments() fires GPU_TEXTURE_CACHE_RESET exactly once", () => {
			const handler = vi.fn();
			event.on(event.GPU_TEXTURE_CACHE_RESET, handler);
			try {
				cache.resetUnitAssignments();
				expect(handler).toHaveBeenCalledTimes(1);
				expect(handler).toHaveBeenCalledWith();
			} finally {
				event.off(event.GPU_TEXTURE_CACHE_RESET, handler);
			}
		});

		it("allocateTextureUnit() exhaustion fires GPU_TEXTURE_CACHE_RESET", () => {
			// Saturate the cache so the next allocation must take the
			// reset branch.
			cache.units.clear();
			cache.usedUnits.clear();
			for (let i = 0; i < cache.max_size; i++) {
				cache.usedUnits.add(i);
			}

			const handler = vi.fn();
			event.on(event.GPU_TEXTURE_CACHE_RESET, handler);
			try {
				const unit = cache.allocateTextureUnit();
				expect(unit).toBe(0);
				expect(handler).toHaveBeenCalledTimes(1);
			} finally {
				event.off(event.GPU_TEXTURE_CACHE_RESET, handler);
			}
		});

		it("allocateTextureUnit() with units available does NOT fire the event", () => {
			// Normal fast path — there's at least one free unit, no
			// reset needed, no event.
			cache.units.clear();
			cache.usedUnits.clear();

			const handler = vi.fn();
			event.on(event.GPU_TEXTURE_CACHE_RESET, handler);
			try {
				cache.allocateTextureUnit();
				expect(handler).not.toHaveBeenCalled();
			} finally {
				event.off(event.GPU_TEXTURE_CACHE_RESET, handler);
			}
		});
	});

	describe("MaterialBatcher subscription contract", () => {
		it("emitting GPU_TEXTURE_CACHE_RESET clears EVERY MaterialBatcher's bind tracking, not just the current one", () => {
			// Poison both batchers as if a previous frame had populated
			// their `boundTextures` maps.
			meshBatcher.boundTextures[3] = { __sentinel: "mesh" };
			meshBatcher.currentTextureUnit = 3;
			meshBatcher.currentSamplerUnit = 3;
			quadBatcher.boundTextures[5] = { __sentinel: "quad" };
			quadBatcher.currentTextureUnit = 5;
			quadBatcher.currentSamplerUnit = 5;

			// Set the renderer's current batcher to MESH — the old
			// single-batcher-clear path would have left quad stale,
			// causing bullets to sample whatever's at unit 5.
			const prevCurrent = renderer.currentBatcher;
			renderer.currentBatcher = meshBatcher;
			try {
				event.emit(event.GPU_TEXTURE_CACHE_RESET);

				expect(meshBatcher.boundTextures.length).toBe(0);
				expect(quadBatcher.boundTextures.length).toBe(0);
				expect(meshBatcher.currentTextureUnit).toBe(-1);
				expect(quadBatcher.currentTextureUnit).toBe(-1);
				expect(meshBatcher.currentSamplerUnit).toBe(-1);
				expect(quadBatcher.currentSamplerUnit).toBe(-1);
			} finally {
				renderer.currentBatcher = prevCurrent;
			}
		});

		it("end-to-end: resetUnitAssignments() clears every batcher's tracking via the event chain", () => {
			// Same as above but goes through the public cache API
			// rather than emitting the event directly. Pins the full
			// "cache reset → event → batcher clears its state" loop.
			meshBatcher.boundTextures[1] = { __sentinel: "mesh" };
			meshBatcher.currentTextureUnit = 1;
			quadBatcher.boundTextures[2] = { __sentinel: "quad" };
			quadBatcher.currentTextureUnit = 2;

			cache.resetUnitAssignments();

			expect(meshBatcher.boundTextures.length).toBe(0);
			expect(quadBatcher.boundTextures.length).toBe(0);
			expect(meshBatcher.currentTextureUnit).toBe(-1);
			expect(quadBatcher.currentTextureUnit).toBe(-1);
		});

		it("end-to-end: allocateTextureUnit() exhaustion clears every batcher's tracking via the event chain", () => {
			meshBatcher.boundTextures[7] = { __sentinel: "mesh" };
			meshBatcher.currentTextureUnit = 7;
			quadBatcher.boundTextures[4] = { __sentinel: "quad" };
			quadBatcher.currentTextureUnit = 4;

			cache.units.clear();
			cache.usedUnits.clear();
			for (let i = 0; i < cache.max_size; i++) {
				cache.usedUnits.add(i);
			}

			cache.allocateTextureUnit();

			expect(meshBatcher.boundTextures.length).toBe(0);
			expect(quadBatcher.boundTextures.length).toBe(0);
			expect(meshBatcher.currentTextureUnit).toBe(-1);
			expect(quadBatcher.currentTextureUnit).toBe(-1);
		});

		it("non-MaterialBatcher subscribers — third-party listeners — receive the event too", () => {
			// The event is the public contract; any future subsystem
			// that caches a texture → unit mapping can subscribe and
			// get notified.
			const customHandler = vi.fn();
			event.on(event.GPU_TEXTURE_CACHE_RESET, customHandler);
			try {
				cache.resetUnitAssignments();
				expect(customHandler).toHaveBeenCalledTimes(1);
			} finally {
				event.off(event.GPU_TEXTURE_CACHE_RESET, customHandler);
			}
		});
	});
});
