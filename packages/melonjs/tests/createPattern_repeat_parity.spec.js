/**
 * Regression guard + parity check for #1448.
 *
 * Pre-fix, `WebGLRenderer.createPattern` keyed its texture cache by the
 * source `image` alone, so a second call with a different repeat mode
 * deleted the first call's GL texture before uploading the new one. The
 * returned `pattern1` handle survived as a JS object (its `.repeat`
 * field still read "repeat-x") but its underlying GL texture was the
 * one bound for `pattern2`'s "repeat-y" wrap mode — any draw using
 * `pattern1` silently sampled with the wrong mode.
 *
 * Canvas mode wasn't affected: `CanvasRenderer.createPattern` returns a
 * fresh `CanvasPattern` per call and doesn't cache textures. Canvas was
 * the correct reference behaviour all along; WebGL now matches it.
 *
 * Tests run the same `createPattern(image, "repeat-x") +
 * createPattern(image, "repeat-y")` scenario under each renderer with
 * forced `video.init(..., { renderer: video.<MODE> })`, asserting the
 * same user-visible invariants in both blocks. Both blocks pass against
 * the fix; the WebGL block fails (`usedUnits.size` stays flat) against
 * any future regression that re-keys the cache by source alone.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, CanvasTexture, video } from "../src/index.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";

describe("createPattern repeat-mode parity (#1448)", () => {
	// Restore the file-wide AUTO renderer when these tests finish so the
	// rest of the suite isn't affected by the explicit-mode init below.
	afterAll(() => {
		try {
			video.init(64, 64, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore — nothing to restore if init never succeeded
		}
	});

	describe("under Canvas renderer (reference behaviour)", () => {
		beforeAll(async () => {
			await boot();
			video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
		});

		it("two patterns from one image are distinct, defined handles", () => {
			// Canvas mode returns a raw `CanvasPattern` per call (an opaque
			// DOM type — no `.repeat` field exposed in JS), but the calls
			// are independent: each `createPattern` round-trips through
			// `getContext().createPattern(...)` and gets back its own
			// pattern object. That's the user-facing contract we want
			// WebGL to match.
			const canvas = new CanvasTexture(32, 32);
			const horiz = video.renderer.createPattern(canvas.canvas, "repeat-x");
			const vert = video.renderer.createPattern(canvas.canvas, "repeat-y");

			expect(horiz).toBeDefined();
			expect(vert).toBeDefined();
			expect(horiz).not.toBe(vert);
		});

		it("createPattern(image) without a repeat arg defaults to no-repeat", () => {
			// Canvas DOM's `getContext().createPattern(image, undefined)`
			// throws a TypeError; the engine entry point now defaults to
			// "no-repeat" so both renderers tolerate the no-arg form
			// identically. Repro for the parity gap that surfaced
			// alongside #1448.
			const canvas = new CanvasTexture(32, 32);
			expect(() => {
				video.renderer.createPattern(canvas.canvas);
			}).not.toThrow();
		});
	});

	describe("under WebGL renderer (#1448 repro)", () => {
		let webglReady = false;

		beforeAll(async () => {
			await boot();
			try {
				video.init(64, 64, {
					parent: "screen",
					renderer: video.WEBGL,
					failIfMajorPerformanceCaveat: false,
				});
				webglReady = video.renderer instanceof WebGLRenderer;
			} catch {
				// CI runners without GL acceleration can't construct a WebGL
				// renderer; the test below marks itself skipped at runtime.
			}
		});

		const requireWebGL = (ctx) => {
			if (!webglReady) {
				ctx.skip("WebGL renderer not available in this environment");
			}
		};

		it("two patterns from one image must stay independent across repeat modes", (ctx) => {
			requireWebGL(ctx);

			const canvas = new CanvasTexture(32, 32);

			// Snapshot the bound-texture-units count BEFORE the first
			// createPattern call so we can measure the net delta.
			const unitsBaseline = video.renderer.cache.usedUnits.size;

			const horiz = video.renderer.createPattern(canvas.canvas, "repeat-x");
			const unitsAfterFirst = video.renderer.cache.usedUnits.size;
			expect(unitsAfterFirst).toBe(unitsBaseline + 1);

			const vert = video.renderer.createPattern(canvas.canvas, "repeat-y");
			const unitsAfterSecond = video.renderer.cache.usedUnits.size;

			// Same invariants as the Canvas block — JS-side handles stay
			// independent. These hold today (the bug is on the GL side).
			expect(horiz).not.toBe(vert);
			expect(horiz.repeat).toEqual("repeat-x");
			expect(vert.repeat).toEqual("repeat-y");

			// The fix signal: the second createPattern call must allocate
			// a NEW bound texture unit, not delete + replace the first
			// pattern's. With the bug today, usedUnits.size stays flat
			// across the two calls (delete-then-upload nets zero); after
			// the fix it grows by one per call (two patterns → two live
			// GL textures), matching the Canvas reference behaviour.
			expect(unitsAfterSecond).toBe(unitsAfterFirst + 1);
		});

		it("createPattern(image) without a repeat arg defaults to no-repeat", (ctx) => {
			requireWebGL(ctx);
			// Parity with Canvas: both renderers tolerate the no-arg form
			// and resolve to "no-repeat" implicitly.
			const canvas = new CanvasTexture(32, 32);
			const pattern = video.renderer.createPattern(canvas.canvas);
			expect(pattern).toBeDefined();
			expect(pattern.repeat).toEqual("no-repeat");
		});

		it("TextureCache.delete(image) frees every repeat's unit, not just the first", (ctx) => {
			requireWebGL(ctx);
			// Regression guard for a follow-on of the #1448 fix: with the
			// units map now keyed by (source, repeat), `delete(image)`
			// must iterate every atlas registered under `image` and free
			// each one's unit. The old single-atlas free path leaked
			// every repeat after the first (the multimap bucket got
			// wiped by `cache.delete(image)` but only one
			// `freeTextureUnit` ran), so additional units stayed in
			// `usedUnits` forever.
			const canvas = new CanvasTexture(32, 32);
			const baseline = video.renderer.cache.usedUnits.size;

			video.renderer.createPattern(canvas.canvas, "repeat-x");
			video.renderer.createPattern(canvas.canvas, "repeat-y");
			expect(video.renderer.cache.usedUnits.size).toBe(baseline + 2);

			video.renderer.cache.delete(canvas.canvas);

			// Both repeats' units must be reclaimed, not just one.
			expect(video.renderer.cache.usedUnits.size).toBe(baseline);
		});
	});
});
