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

		it("a sprite atlas + a createPattern over the same image hold independent units (real-world #1448)", (ctx) => {
			requireWebGL(ctx);
			// Mirrors the original real-world breakage that drove #1448:
			// a Sprite using `cache.get(image)` (default "no-repeat") and
			// a separately-created `createPattern(image, "repeat-x")`
			// shared one unit pre-fix, so the sprite's draws silently
			// sampled with the pattern's wrap mode after the pattern was
			// uploaded. Post-fix, each has its own (source, repeat) slot.
			const canvas = new CanvasTexture(32, 32);

			// Step 1: a sprite-like atlas allocates a unit for (source, no-repeat)
			const spriteAtlas = video.renderer.cache.get(canvas.canvas);
			const spriteUnit = video.renderer.cache.getUnit(spriteAtlas);

			// Step 2: a pattern allocates a separate unit for (source, repeat-x)
			const pattern = video.renderer.createPattern(canvas.canvas, "repeat-x");
			const patternUnit = video.renderer.cache.peekUnit(pattern);

			// Both must remain valid AND distinct
			expect(spriteUnit).toBeGreaterThanOrEqual(0);
			expect(patternUnit).toBeGreaterThanOrEqual(0);
			expect(spriteUnit).not.toEqual(patternUnit);

			// The sprite's lookup must still resolve to its original unit
			// (not the pattern's — that was the pre-fix bug).
			expect(video.renderer.cache.peekUnit(spriteAtlas)).toEqual(spriteUnit);
		});

		it("unit exhaustion mid-multi-repeat allocation: cache recovers cleanly", (ctx) => {
			requireWebGL(ctx);
			// `allocateTextureUnit` calls `units.clear()` when it can't
			// find a free unit, wiping the whole nested `Map<source,
			// Map<repeat, unit>>`. After the reset, subsequent
			// `getUnit` calls must successfully re-allocate; nothing
			// should be wedged by stale inner-Map state.
			const canvas = new CanvasTexture(32, 32);
			const cache = video.renderer.cache;

			// Squeeze the cache to a tiny capacity so exhaustion fires
			// after just a couple of distinct (source, repeat) pairs.
			const originalMax = cache.max_size;
			cache.max_size = 2;
			try {
				const repeats = ["no-repeat", "repeat", "repeat-x", "repeat-y"];
				const allocated = repeats.map((repeat) => {
					return cache.getUnit({
						sources: new Map([["d", canvas.canvas]]),
						activeAtlas: "d",
						repeat,
					});
				});

				// Every call returned a defined unit (no `undefined` from
				// a botched recovery path).
				for (const u of allocated) {
					expect(u).toBeGreaterThanOrEqual(0);
					expect(u).toBeLessThan(cache.max_size);
				}

				// After exhaustion the cache should have re-started from
				// the new most-recent (source, repeat). It MUST still be
				// usable — fresh getUnit returns a defined unit.
				const fresh = cache.getUnit({
					sources: new Map([["d", canvas.canvas]]),
					activeAtlas: "d",
					repeat: "no-repeat",
				});
				expect(fresh).toBeGreaterThanOrEqual(0);
			} finally {
				cache.max_size = originalMax;
				cache.clear();
			}
		});

		it("mutating texture.repeat after getUnit reroutes subsequent lookups", (ctx) => {
			requireWebGL(ctx);
			// Pinning the contract: `getUnit` / `peekUnit` re-read
			// `texture.repeat` on every call. A consumer that mutates
			// `.repeat` on a live TextureAtlas effectively switches it
			// to a different `(source, repeat)` slot — the OLD unit is
			// orphaned in `units[source][oldRepeat]` until explicit
			// cleanup, and the NEW lookup either reuses or allocates
			// under the new repeat. This is intentional behaviour, but
			// without a test nothing would catch a future change to
			// "cache the unit on the texture object".
			const source = document.createElement("canvas");
			source.width = 32;
			source.height = 32;
			const tex = {
				sources: new Map([["d", source]]),
				activeAtlas: "d",
				repeat: "repeat-x",
			};

			const unitA = video.renderer.cache.getUnit(tex);
			tex.repeat = "repeat-y";
			const unitB = video.renderer.cache.getUnit(tex);

			expect(unitB).not.toEqual(unitA);
			expect(video.renderer.cache.peekUnit(tex)).toEqual(unitB);

			// Revert the repeat and the original unit still resolves.
			tex.repeat = "repeat-x";
			expect(video.renderer.cache.peekUnit(tex)).toEqual(unitA);
		});

		it("cache.clear() mid-pattern-lifecycle wipes every (source, repeat) entry", (ctx) => {
			requireWebGL(ctx);
			// Calling `clear()` between two createPattern calls must
			// wipe ALL units, not leak the prior pattern's entry under
			// the nested structure.
			const canvas = new CanvasTexture(32, 32);

			video.renderer.createPattern(canvas.canvas, "repeat-x");
			expect(video.renderer.cache.usedUnits.size).toBeGreaterThan(0);

			video.renderer.cache.clear();
			expect(video.renderer.cache.usedUnits.size).toEqual(0);
			expect(video.renderer.cache.units.size).toEqual(0);

			// Fresh createPattern after clear() must allocate from a
			// clean slate (no stale entry confusing the lookup).
			const fresh = video.renderer.createPattern(canvas.canvas, "repeat-x");
			expect(fresh).toBeDefined();
			expect(video.renderer.cache.peekUnit(fresh)).toBeGreaterThanOrEqual(0);
		});

		it("freeTextureUnit on a never-allocated texture is a silent no-op", (ctx) => {
			requireWebGL(ctx);
			// Guards the new `perRepeat?.get(repeat)` chain — if the
			// outer Map has no entry for `source`, or the inner Map has
			// no entry for `repeat`, freeTextureUnit must just no-op,
			// not throw or corrupt `usedUnits`.
			const source = document.createElement("canvas");
			source.width = 32;
			source.height = 32;
			const tex = {
				sources: new Map([["d", source]]),
				activeAtlas: "d",
				repeat: "repeat-x",
			};
			const before = video.renderer.cache.usedUnits.size;
			expect(() => {
				video.renderer.cache.freeTextureUnit(tex);
			}).not.toThrow();
			expect(video.renderer.cache.usedUnits.size).toEqual(before);

			// Now allocate, free, free-again — the second free must be
			// a no-op too (the outer Map's source entry was deleted by
			// the first free's inner-cleanup branch).
			video.renderer.cache.getUnit(tex);
			video.renderer.cache.freeTextureUnit(tex);
			expect(() => {
				video.renderer.cache.freeTextureUnit(tex);
			}).not.toThrow();
		});

		it("two patterns with SAME (source, repeat) share one unit (orphan-handle contract)", (ctx) => {
			requireWebGL(ctx);
			// Pre-#1448 and post-fix: multiple TextureAtlas wrappers
			// built from the same source with the same repeat mode share
			// one GL texture unit. `freeTextureUnit` on either handle
			// drops the unit; the other handle's `peekUnit` then returns
			// -1 even though the JS-side wrapper is still live. Not a
			// bug — it's the inherent contract of unit-allocation-per-
			// (source, repeat). Pinning prevents a future refactor from
			// silently changing the sharing semantics.
			const canvas = new CanvasTexture(32, 32);

			const p1 = video.renderer.createPattern(canvas.canvas, "repeat-x");
			const p2 = video.renderer.createPattern(canvas.canvas, "repeat-x");

			const u1 = video.renderer.cache.peekUnit(p1);
			const u2 = video.renderer.cache.peekUnit(p2);
			expect(u1).toEqual(u2);
			expect(u1).toBeGreaterThanOrEqual(0);

			video.renderer.cache.freeTextureUnit(p1);

			// p2's handle is technically orphaned now — the shared unit
			// is gone. Both peekUnit calls return -1.
			expect(video.renderer.cache.peekUnit(p1)).toEqual(-1);
			expect(video.renderer.cache.peekUnit(p2)).toEqual(-1);
		});

		it("resetUnitAssignments wipes units, leaves cache intact, re-allocates cleanly", (ctx) => {
			requireWebGL(ctx);
			// `resetUnitAssignments` is called when a shader's sampler
			// range is exceeded mid-batch. It clears the `units` map
			// AND `usedUnits` but leaves the atlas multimap (`cache`)
			// alone, then emits `GPU_TEXTURE_CACHE_RESET` so batchers
			// drop their boundTextures tracking. After the reset,
			// `peekUnit` on previously-cached atlases must return -1
			// (units gone) but `cache.has(image)` stays true (atlas
			// still cached), and the next `getUnit` re-allocates from
			// a clean slate.
			const canvas = new CanvasTexture(32, 32);
			const pattern = video.renderer.createPattern(canvas.canvas, "repeat-x");
			expect(video.renderer.cache.peekUnit(pattern)).toBeGreaterThanOrEqual(0);
			expect(video.renderer.cache.has(canvas.canvas)).toBe(true);

			video.renderer.cache.resetUnitAssignments();

			expect(video.renderer.cache.peekUnit(pattern)).toEqual(-1);
			expect(video.renderer.cache.usedUnits.size).toEqual(0);
			expect(video.renderer.cache.units.size).toEqual(0);
			// Atlas multimap intact — `cache.has(image)` still true even
			// though no unit is allocated.
			expect(video.renderer.cache.has(canvas.canvas)).toBe(true);

			// Re-allocation works without manual intervention.
			const reAllocatedUnit = video.renderer.cache.getUnit(pattern);
			expect(reAllocatedUnit).toBeGreaterThanOrEqual(0);
		});

		it("`usedUnits.size` matches the sum of inner-map sizes in `units` after mixed ops", (ctx) => {
			requireWebGL(ctx);
			// Sanity invariant: the total count of allocated units
			// (tracked in `usedUnits`) must always equal the number of
			// (source, repeat) entries across all inner Maps in `units`.
			// A drift means either a unit leaked into `usedUnits`
			// without a corresponding `units` entry, OR an entry in
			// `units` points at a unit that's already been freed.
			const c1 = new CanvasTexture(32, 32);
			const c2 = new CanvasTexture(48, 48);
			const cache = video.renderer.cache;
			const sumInner = () => {
				let total = 0;
				for (const inner of cache.units.values()) {
					total += inner.size;
				}
				return total;
			};

			video.renderer.createPattern(c1.canvas, "repeat-x");
			video.renderer.createPattern(c1.canvas, "repeat-y");
			video.renderer.createPattern(c2.canvas, "no-repeat");
			expect(cache.usedUnits.size).toEqual(sumInner());

			cache.freeTextureUnit({
				sources: new Map([["d", c1.canvas]]),
				activeAtlas: "d",
				repeat: "repeat-x",
			});
			expect(cache.usedUnits.size).toEqual(sumInner());

			cache.delete(c2.canvas);
			expect(cache.usedUnits.size).toEqual(sumInner());
		});

		it("cache.get(image, {framewidth, frameheight}) with multiple atlases under one image", (ctx) => {
			requireWebGL(ctx);
			// Post-#1448 the multimap can hold several atlases under
			// one image (one per repeat mode). `cache.get(image,
			// frame)` iterates every entry matching the image key
			// looking for `_atlas.width === frame.framewidth &&
			// _atlas.height === frame.frameheight`. Worth noting:
			// pattern atlases produced by `createAtlas` only carry
			// their dimensions under `meta.size`, NOT as top-level
			// `.width` / `.height` — so for pattern-only entries the
			// framewidth refinement loop matches nothing and the
			// `cache.get(image)[0]` fallback wins. Either way the
			// contract is "return a defined entry, don't crash".
			const canvas = new CanvasTexture(32, 32);
			video.renderer.createPattern(canvas.canvas, "repeat-x");
			video.renderer.createPattern(canvas.canvas, "repeat-y");

			let entry;
			expect(() => {
				entry = video.renderer.cache.get(canvas.canvas, {
					framewidth: 32,
					frameheight: 32,
				});
			}).not.toThrow();
			expect(entry).toBeDefined();
			// The entry is a TextureAtlas (whatever framewidth the
			// loop did or didn't match); minimum sanity is that it
			// exposes the standard atlas surface.
			expect(typeof entry.getAtlas).toEqual("function");
		});

		it("freeTextureUnit on a texture whose sources Map is empty is a silent no-op", (ctx) => {
			requireWebGL(ctx);
			// Defensive guard around `_unitKey` and the nested-map
			// lookup. `texture.sources.get(texture.activeAtlas)` would
			// return `undefined` here — the cache's
			// `Map<undefined, perRepeat>` lookup is unlikely to find a
			// hit, and `perRepeat?.` short-circuits cleanly. Must not
			// throw or corrupt state.
			const tex = {
				sources: new Map(), // empty — no activeAtlas key
				activeAtlas: "missing",
				repeat: "repeat-x",
			};
			const before = video.renderer.cache.usedUnits.size;
			expect(() => {
				video.renderer.cache.freeTextureUnit(tex);
			}).not.toThrow();
			expect(() => {
				video.renderer.cache.peekUnit(tex);
			}).not.toThrow();
			expect(video.renderer.cache.peekUnit(tex)).toEqual(-1);
			expect(video.renderer.cache.usedUnits.size).toEqual(before);
		});

		it("MaterialBatcher.deleteTexture2D wipes EVERY repeat's bound GL texture, not just the called one", (ctx) => {
			requireWebGL(ctx);
			// Integration test for the boundary between `cache.delete`
			// (which post-#1448 frees every (source, repeat) unit) and
			// `MaterialBatcher.deleteTexture2D` (which deletes the GL
			// texture at `boundTextures[unit]` and unbinds it). With
			// only the cache-level fix, `deleteTexture2D` would still
			// delete just the called texture's GL handle while
			// `cache.delete(image)` freed every other repeat's unit —
			// orphaning the OTHER repeats' bound GL textures, which
			// would then be left over at unit slots that the cache now
			// thinks are free for reallocation. Stale binds + GL leak.
			//
			// Surface: probe `boundTextures` directly to confirm BOTH
			// units' GL handles got cleaned up.
			const canvas = new CanvasTexture(32, 32);
			video.renderer.setBatcher("quad");
			const batcher = video.renderer.currentBatcher;

			const horiz = video.renderer.createPattern(canvas.canvas, "repeat-x");
			const vert = video.renderer.createPattern(canvas.canvas, "repeat-y");

			const ux = video.renderer.cache.peekUnit(horiz);
			const uy = video.renderer.cache.peekUnit(vert);
			expect(ux).toBeGreaterThanOrEqual(0);
			expect(uy).toBeGreaterThanOrEqual(0);
			expect(batcher.boundTextures[ux]).toBeDefined();
			expect(batcher.boundTextures[uy]).toBeDefined();

			batcher.deleteTexture2D(horiz);

			// BOTH bound GL textures must be cleared, not just horiz's.
			expect(batcher.boundTextures[ux]).toBeUndefined();
			expect(batcher.boundTextures[uy]).toBeUndefined();

			// And both units must be reclaimable.
			expect(video.renderer.cache.peekUnit(horiz)).toEqual(-1);
			expect(video.renderer.cache.peekUnit(vert)).toEqual(-1);
		});

		it("normalizes unknown/typo'd repeat values to `no-repeat` (no unit leak on bad input)", (ctx) => {
			requireWebGL(ctx);
			// Defensive normalization: only the four canonical repeat
			// values produce distinct GL wrap behaviour. A typo like
			// `"repat-x"` would silently clamp at the GL mapping but
			// would still allocate its own (source, "repat-x") unit
			// pre-normalization — slowly leaking texture-unit slots on
			// user code that builds repeat strings dynamically.
			const source = document.createElement("canvas");
			source.width = 32;
			source.height = 32;
			const cache = video.renderer.cache;

			const noRepeat = {
				sources: new Map([["d", source]]),
				activeAtlas: "d",
				repeat: "no-repeat",
			};
			const typo = {
				sources: new Map([["d", source]]),
				activeAtlas: "d",
				repeat: "repat-x",
			};

			const unitNoRepeat = cache.getUnit(noRepeat);
			const unitTypo = cache.getUnit(typo);
			expect(unitTypo).toEqual(unitNoRepeat);
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
