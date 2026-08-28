import "./helpers/webgpu-globals.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebGPUQuadBatcher from "../src/video/webgpu/batchers/quad_batcher.js";
import WebGPUBatcher from "../src/video/webgpu/batchers/webgpu_batcher.js";
import { createMockWebGPURenderer } from "./helpers/webgpu-mock-renderer.js";

/**
 * Unit tests for the WebGPU quad batcher (and the base batcher's guard
 * rails) against the mock renderer: the frozen 28-byte vertex layout,
 * the CPU corner transform, single-texture material adoption, and the
 * 6-indices-per-4-vertices draw.
 */
describe("WebGPUQuadBatcher", () => {
	let renderer;
	let batcher;
	const atlasA = { name: "A" };
	const atlasB = { name: "B" };

	beforeEach(() => {
		renderer = createMockWebGPURenderer();
		batcher = new WebGPUQuadBatcher(renderer);
	});

	it("a first init without settings fails loudly (WebGL-base parity)", () => {
		expect(() => {
			return new WebGPUBatcher(renderer);
		}).toThrow(/attributes definition missing/);
	});

	it("addQuad writes the frozen 28-byte layout: corners, UVs, packed tint, z", () => {
		renderer.currentDepth = 2;
		batcher.addQuad(atlasA, 10, 20, 30, 40, 0.1, 0.2, 0.3, 0.4, 0xffaabbcc);
		batcher.flush();

		expect(renderer.calls.drawIndexed).toEqual([6]);
		const { size, floats, view } = renderer.calls.writes[0];
		expect(size).toBe(4 * 28);

		// corner order: (x,y) (x+w,y) (x,y+h) (x+w,y+h); stride = 7 floats
		expect([floats[0], floats[1]]).toEqual([10, 20]);
		expect([floats[7], floats[8]]).toEqual([40, 20]);
		expect([floats[14], floats[15]]).toEqual([10, 60]);
		expect([floats[21], floats[22]]).toEqual([40, 60]);
		// per-sprite depth stamped on z (identity transform passes it through)
		expect(floats[2]).toBe(2);
		// per-corner UV mapping
		expect([floats[3], floats[4]]).toEqual([
			expect.closeTo(0.1),
			expect.closeTo(0.2),
		]);
		expect([floats[10], floats[11]]).toEqual([
			expect.closeTo(0.3),
			expect.closeTo(0.2),
		]);
		// packed ARGB tint rides as a uint32 at byte 20
		expect(view.getUint32(20, true)).toBe(0xffaabbcc);
		// aTextureId is 0 under single-texture batching
		expect(floats[6]).toBe(0);
	});

	it("the current transform is applied to all four corners", () => {
		renderer.currentTransform.translate(100, 1000);
		batcher.addQuad(atlasA, 10, 20, 30, 40, 0, 0, 1, 1, 0xffffffff);
		batcher.flush();

		const floats = renderer.calls.writes[0].floats;
		expect([floats[0], floats[1]]).toEqual([110, 1020]);
		expect([floats[21], floats[22]]).toEqual([140, 1060]);
	});

	it("a texture change claims a new slot — quads batch across textures in ONE segment", () => {
		batcher.addQuad(atlasA, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.addQuad(atlasA, 8, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.addQuad(atlasB, 0, 8, 8, 8, 0, 0, 1, 1, 0xffffffff);
		// no flush on the texture change: B claimed slot 1
		expect(renderer.calls.drawIndexed).toEqual([]);

		batcher.flush();
		// one draw for all three quads, one COMPOSED bind group at group 1
		expect(renderer.calls.drawIndexed).toEqual([18]);
		expect(renderer.calls.materialBinds).toHaveLength(1);
		// aTextureId per vertex: quads 1-2 slot 0, quad 3 slot 1 (float
		// at offset 6 of each 7-float vertex)
		const vertexWrite = renderer.calls.writes.find((w) => {
			return w.buffer === renderer.vertexArena.page;
		});
		const slotOf = (vertex) => {
			return vertexWrite.floats[vertex * 7 + 6];
		};
		expect(slotOf(0)).toBe(0);
		expect(slotOf(4)).toBe(0);
		expect(slotOf(8)).toBe(1);
	});

	it("the ninth distinct texture forces the segment flush", () => {
		const atlases = Array.from({ length: 9 }, (_, i) => {
			return { name: `atlas${i}` };
		});
		for (const atlas of atlases) {
			batcher.addQuad(atlas, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		}
		// the first eight batched; the ninth drained them as one draw
		expect(renderer.calls.drawIndexed).toEqual([8 * 6]);
		batcher.flush();
		expect(renderer.calls.drawIndexed).toEqual([8 * 6, 6]);
		// two composed bind groups, one per segment
		expect(renderer.calls.materialBinds).toHaveLength(2);
	});

	it("a steady-state segment re-uses its composed bind group across flushes", () => {
		batcher.addQuad(atlasA, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.addQuad(atlasB, 8, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.flush();
		batcher.addQuad(atlasA, 0, 8, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.addQuad(atlasB, 8, 8, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.flush();
		expect(renderer.calls.materialBinds).toHaveLength(2);
		expect(renderer.calls.materialBinds[1]).toBe(
			renderer.calls.materialBinds[0],
		);
	});

	// #1585 moved slot assignment onto the shared `TextureSlotTable` and made
	// `segmentEntries` indexed by slot rather than pushed. Two invariants that
	// used to be structural now rest on the table handing out slots lowest-first,
	// so they need pinning.
	it("the composed material group is dense: views 0-7, samplers 8-15", () => {
		// `composeSegmentGroup` pads unclaimed slots from `entries[0]`, so a hole
		// at slot 0 would make the padding source undefined and throw. Every
		// declared binding must be present whatever the segment holds.
		batcher.addQuad(atlasA, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.addQuad(atlasB, 8, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.flush();

		const group = renderer.calls.materialBinds[0];
		// entries are emitted interleaved (texture then sampler per slot), which
		// WebGPU permits — what matters is that all 16 declared bindings are
		// present and resourced, not the order they appear in
		const bindings = group.entries.map((e) => {
			return e.binding;
		});
		expect(
			[...bindings].sort((a, b) => {
				return a - b;
			}),
		).toEqual(
			Array.from({ length: 16 }, (_, i) => {
				return i;
			}),
		);
		for (const e of group.entries) {
			expect(e.resource).toBeDefined();
		}
	});

	it("hasPendingMaterial tracks the slot table, not the entry array", () => {
		// the predicate #1585 rewrote from `segmentEntries.length > 0`. It gates
		// whether a flush draws at all, so a stale `true` records a draw with no
		// material and a stale `false` silently drops queued quads.
		expect(batcher.hasPendingMaterial()).toBe(false);
		batcher.addQuad(atlasA, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		expect(batcher.hasPendingMaterial()).toBe(true);
		batcher.flush();
		// resetSegment must clear it, or the next empty flush draws garbage
		expect(batcher.hasPendingMaterial()).toBe(false);
	});

	it("a flush with no material ever adopted records nothing", () => {
		expect(() => {
			batcher.flush();
		}).not.toThrow();
		expect(renderer.calls.drawIndexed).toEqual([]);
		expect(renderer.calls.writes).toEqual([]);
	});

	it("reset drops pending vertices without recording a draw", () => {
		batcher.addQuad(atlasA, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
		batcher.reset();
		batcher.flush();
		expect(renderer.calls.drawIndexed).toEqual([]);
	});

	describe("segment slot memo", () => {
		// `segmentSlotFor` runs per quad and built a template-literal key each
		// time, then hashed it into the slot table — 20k string allocations
		// and 20k string-keyed lookups per frame at 20k quads, measured as the
		// entire gap against WebGL's quad submission. The memo skips that for
		// runs of same-texture quads.
		//
		// Everything below is about the ways a memo can hand back a slot that
		// is no longer correct, because that batches a quad against the wrong
		// texture or sampler — a silent rendering bug, not a crash.

		it("resolves a repeated texture to the same slot", () => {
			const first = batcher.segmentSlotFor(atlasA, false);
			expect(batcher.segmentSlotFor(atlasA, false)).toBe(first);
		});

		it("does not collapse distinct textures onto one slot", () => {
			const a = batcher.segmentSlotFor(atlasA, false);
			const b = batcher.segmentSlotFor(atlasB, false);
			expect(b).not.toBe(a);
			expect(batcher.segmentSlotFor(atlasA, false)).toBe(a);
		});

		it("gives each texture its own slot when they interleave", () => {
			// A,B,A,B thrashes the memo — every call is a miss, and each must
			// still resolve to that texture's own slot
			const a1 = batcher.segmentSlotFor(atlasA, false);
			const b1 = batcher.segmentSlotFor(atlasB, false);
			expect(batcher.segmentSlotFor(atlasA, false)).toBe(a1);
			expect(batcher.segmentSlotFor(atlasB, false)).toBe(b1);
			expect(a1).not.toBe(b1);
		});

		it("re-resolves when the FILTER changes on the same texture", () => {
			// the slot key is (view, filter, wrap). A memo keyed on the
			// texture object alone returns the stale slot here, and the quad
			// batches against a sampler with the wrong filtering.
			const tex = { name: "T", filter: "nearest" };
			const nearest = batcher.segmentSlotFor(tex, false);
			tex.filter = "linear";
			expect(
				batcher.segmentSlotFor(tex, false),
				"filter change reused the old slot",
			).not.toBe(nearest);
		});

		it("re-resolves when the WRAP changes on the same texture", () => {
			const tex = { name: "T", repeat: "no-repeat" };
			const clamped = batcher.segmentSlotFor(tex, false);
			tex.repeat = "repeat";
			expect(
				batcher.segmentSlotFor(tex, false),
				"wrap change reused the old slot",
			).not.toBe(clamped);
		});

		it("still revalidates residency on every quad", () => {
			// `getResidentRecord` re-checks the record against
			// `texture.getTexture()` and re-uploads when the source changed
			// underneath — a video frame, an animated canvas, a swapped
			// atlas. Memoizing past it would serve stale pixels, so the memo
			// must sit AFTER that call, not before it.
			let residencyChecks = 0;
			const store = renderer.textureStore;
			const original = store.getResidentRecord.bind(store);
			store.getResidentRecord = (...args) => {
				residencyChecks++;
				return original(...args);
			};

			batcher.segmentSlotFor(atlasA, false);
			batcher.segmentSlotFor(atlasA, false);
			batcher.segmentSlotFor(atlasA, false);

			expect(residencyChecks, "memo skipped the residency check").toBe(3);
		});

		it("is bypassed when the caller forces a reupload", () => {
			const store = renderer.textureStore;
			const forced = [];
			const original = store.getResidentRecord.bind(store);
			store.getResidentRecord = (texture, options) => {
				forced.push(options?.force === true);
				return original(texture, options);
			};

			batcher.segmentSlotFor(atlasA, false);
			batcher.segmentSlotFor(atlasA, true);

			expect(forced, "reupload did not reach the store").toEqual([false, true]);
		});

		it("forgets a slot that gets evicted under it", () => {
			// Eviction hands the index to a different texture. Driven through
			// the real table by overflowing it rather than by invoking the
			// callback by hand — a test that reimplements the logic it checks
			// proves nothing.
			batcher.segmentSlotFor(atlasA, false);
			const view = batcher._memoView;
			expect(view).not.toBeNull();

			for (let i = 0; i < 32; i++) {
				batcher.segmentSlotFor({ name: `overflow-${i}` }, false);
			}

			expect(batcher._memoView, "evicted slot stayed memoized").not.toBe(view);
		});

		it("clears after a segment reset", () => {
			batcher.segmentSlotFor(atlasA, false);
			batcher.resetSegment();
			expect(batcher._memoView).toBeNull();
			expect(batcher.segmentSlotFor(atlasA, false)).toBe(0);
		});

		it("routes interleaved quads to the right slots through addQuad", () => {
			// the observable end of all of the above
			batcher.addQuad(atlasA, 0, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
			batcher.addQuad(atlasB, 8, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);
			batcher.addQuad(atlasA, 16, 0, 8, 8, 0, 0, 1, 1, 0xffffffff);

			// inspected BEFORE the flush, which resets the segment: two
			// distinct textures must occupy two distinct slots, and the
			// repeat of atlasA must not have claimed a third
			const live = batcher.segmentEntries.filter((e) => {
				return e !== undefined;
			});
			expect(live.length, "interleaved quads did not share slots").toBe(2);

			batcher.flush();
			expect(renderer.calls.drawIndexed).toEqual([18]);
		});
	});
});
