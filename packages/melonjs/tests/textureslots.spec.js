/**
 * `TextureSlotTable` — the shared texture-slot assignment policy (#1585).
 *
 * Both GPU backends give each texture a small integer slot that the fragment
 * shader selects on per vertex; only the resource differs (a GL texture unit
 * vs an entry in a WebGPU material bind group). The policy was written twice
 * and drifted, so it now lives here — and this suite is the oracle that says
 * the two backends behave alike. It is deliberately GPU-free: the table only
 * ever deals in string keys and slot integers.
 */
import { describe, expect, it, vi } from "vitest";
import { TextureSlotTable } from "../src/video/gpu/textureslots.js";

const makeTable = (capacity, extra = {}) => {
	return new TextureSlotTable({ capacity, ...extra });
};

describe("TextureSlotTable", () => {
	describe("assignment", () => {
		it("hands out slots from zero, in order", () => {
			const table = makeTable(4);
			expect(table.slotFor("a")).toBe(0);
			expect(table.slotFor("b")).toBe(1);
			expect(table.slotFor("c")).toBe(2);
		});

		it("is stable — the same key keeps its slot", () => {
			const table = makeTable(4);
			const first = table.slotFor("a");
			table.slotFor("b");
			expect(table.slotFor("a")).toBe(first);
			// and re-resolving does not consume capacity
			expect(table.size).toBe(2);
		});

		it("peek() never assigns", () => {
			const table = makeTable(4);
			expect(table.peek("a")).toBeUndefined();
			expect(table.size).toBe(0);
			table.slotFor("a");
			expect(table.peek("a")).toBe(0);
		});

		it("reuses a released slot rather than growing", () => {
			const table = makeTable(4);
			table.slotFor("a");
			table.slotFor("b");
			expect(table.release("a")).toBe(true);
			// the lowest free slot is 0 again
			expect(table.slotFor("c")).toBe(0);
			expect(table.release("nope")).toBe(false);
		});
	});

	describe("overflow", () => {
		it("fills to capacity without overflowing", () => {
			const onOverflow = vi.fn();
			const table = makeTable(4, { onOverflow });
			for (const key of ["a", "b", "c", "d"]) {
				table.slotFor(key);
			}
			// the LAST slot must not trigger a flush — an off-by-one here
			// costs a draw call per full batch
			expect(onOverflow).not.toHaveBeenCalled();
		});

		it("overflows exactly once, on the key that does not fit", () => {
			const onOverflow = vi.fn();
			const table = makeTable(4, { onOverflow });
			for (const key of ["a", "b", "c", "d"]) {
				table.slotFor(key);
			}
			expect(table.slotFor("e")).toBe(0);
			expect(onOverflow).toHaveBeenCalledTimes(1);
			// the overflowing key is the sole survivor
			expect(table.size).toBe(1);
			expect(table.peek("a")).toBeUndefined();
		});

		it("flushes BEFORE reassigning — pending work must not be restamped", () => {
			// the ordering that makes overflow correct: if the table reassigned
			// first, already-queued vertices would sample the new texture
			const seen = [];
			const table = makeTable(2, {
				onOverflow: () => {
					seen.push(["flush", table.peek("a")]);
				},
				onEvict: (slot) => {
					seen.push(["evict", slot]);
				},
			});
			table.slotFor("a");
			table.slotFor("b");
			table.slotFor("c");

			expect(seen[0]).toEqual(["flush", 0]); // "a" still resident here
			expect(
				seen.slice(1).map((e) => {
					return e[0];
				}),
			).toEqual(["evict", "evict"]);
		});

		it("does not overflow for a key that is already resident", () => {
			const onOverflow = vi.fn();
			const table = makeTable(2, { onOverflow });
			table.slotFor("a");
			table.slotFor("b");
			table.slotFor("a");
			table.slotFor("b");
			expect(onOverflow).not.toHaveBeenCalled();
		});

		it("round-robin over capacity+1 overflows every cycle", () => {
			// the pathological case #1584 exists to remove — pinned here so the
			// cost is visible if the policy is ever changed (see #1586)
			const onOverflow = vi.fn();
			const table = makeTable(4, { onOverflow });
			for (let i = 0; i < 15; i++) {
				table.slotFor(`t${i % 5}`);
			}
			expect(onOverflow.mock.calls.length).toBeGreaterThan(1);
		});
	});

	describe("eviction callbacks", () => {
		it("reports each live slot exactly once on reset", () => {
			const onEvict = vi.fn();
			const table = makeTable(4, { onEvict });
			table.slotFor("a");
			table.slotFor("b");
			table.reset();
			expect(onEvict.mock.calls.flat().sort()).toEqual([0, 1]);
			expect(table.size).toBe(0);
		});

		it("does not report slots that were never assigned", () => {
			const onEvict = vi.fn();
			const table = makeTable(8, { onEvict });
			table.slotFor("a");
			table.reset();
			expect(onEvict).toHaveBeenCalledTimes(1);
		});
	});

	describe("reservations", () => {
		it("never assigns a reserved slot", () => {
			// WebGL parks ShaderEffect extra samplers on high units this way
			const reserved = new Set([1, 3]);
			const table = makeTable(4, {
				isReserved: (s) => {
					return reserved.has(s);
				},
			});
			expect(table.slotFor("a")).toBe(0);
			expect(table.slotFor("b")).toBe(2);
		});

		it("keeps reservations across an overflow", () => {
			const reserved = new Set([3]);
			const onOverflow = vi.fn();
			const table = makeTable(4, {
				onOverflow,
				isReserved: (s) => {
					return reserved.has(s);
				},
			});
			table.slotFor("a");
			table.slotFor("b");
			table.slotFor("c");
			// slot 3 is held out, so the fourth distinct key overflows
			expect(table.slotFor("d")).toBe(0);
			expect(onOverflow).toHaveBeenCalledTimes(1);
			expect(table.peek("d")).not.toBe(3);
		});

		it("throws rather than aliasing when nothing is assignable", () => {
			// returning 0 here would silently sample a reserved texture
			const table = makeTable(2, {
				isReserved: () => {
					return true;
				},
			});
			expect(() => {
				return table.slotFor("a");
			}).toThrow(/no assignable slot/);
			expect(() => {
				return makeTable(0).slotFor("a");
			}).toThrow(/no assignable slot/);
		});
	});

	describe("setCapacity", () => {
		it("evicts only assignments above the new capacity", () => {
			const onEvict = vi.fn();
			const table = makeTable(4, { onEvict });
			for (const key of ["a", "b", "c", "d"]) {
				table.slotFor(key);
			}
			table.setCapacity(2);
			expect(table.peek("a")).toBe(0);
			expect(table.peek("b")).toBe(1);
			expect(table.peek("c")).toBeUndefined();
			expect(onEvict.mock.calls.flat().sort()).toEqual([2, 3]);
		});

		it("growing keeps every assignment and opens the new slots", () => {
			const table = makeTable(2);
			table.slotFor("a");
			table.slotFor("b");
			table.setCapacity(4);
			expect(table.peek("a")).toBe(0);
			expect(table.slotFor("c")).toBe(2);
		});
	});
});
