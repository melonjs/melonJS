/**
 * `TextureStore` — the shared residency policy (#1585).
 *
 * Residency answers "does this source exist on the GPU and is its content
 * current". It is deliberately NOT the same question as "which slot is it in
 * for this draw" — conflating the two is what made a WebGL texture-cache
 * overflow re-create and re-upload every texture, once per draw, every frame.
 *
 * GPU-free by construction: the store only ever sees opaque handles returned
 * by its callbacks, so this suite is the behavioural oracle for both backends.
 */
import { describe, expect, it, vi } from "vitest";
import { TextureStore } from "../src/video/gpu/texturestore.js";

/** a store whose handles are just tagged objects, with call spies */
const makeStore = (over = {}) => {
	let next = 0;
	const spies = {
		onCreate: vi.fn(() => {
			return { id: next++ };
		}),
		onUpload: vi.fn(() => {
			return undefined;
		}),
		onDestroy: vi.fn(),
	};
	return { store: new TextureStore({ ...spies, ...over }), spies };
};

describe("TextureStore", () => {
	describe("reuse vs upload", () => {
		it("creates and uploads a source seen for the first time", () => {
			const { store, spies } = makeStore();
			const src = { name: "a" };
			const rec = store.getResidentRecord(src);
			expect(spies.onCreate).toHaveBeenCalledTimes(1);
			expect(spies.onUpload).toHaveBeenCalledTimes(1);
			expect(rec.uploaded).toBe(true);
		});

		it("re-resolving an unchanged source does NO gpu work", () => {
			// the whole point: a texture that merely moved slots must not
			// re-upload. This is the assertion the WebGL bug violated.
			const { store, spies } = makeStore();
			const src = { name: "a" };
			const first = store.getResidentRecord(src);
			const second = store.getResidentRecord(src);
			expect(spies.onCreate).toHaveBeenCalledTimes(1);
			expect(spies.onUpload).toHaveBeenCalledTimes(1);
			expect(second.handle).toBe(first.handle);
			expect(second.uploaded).toBe(false);
		});

		it("a version bump re-uploads without recreating", () => {
			const { store, spies } = makeStore();
			const src = { name: "a" };
			const first = store.getResidentRecord(src, { version: 1 });
			const second = store.getResidentRecord(src, { version: 2 });
			expect(spies.onCreate).toHaveBeenCalledTimes(1);
			expect(spies.onUpload).toHaveBeenCalledTimes(2);
			expect(second.handle).toBe(first.handle);
		});

		it("force re-uploads even when the version matches", () => {
			const { store, spies } = makeStore();
			const src = { name: "a" };
			store.getResidentRecord(src, { version: 7 });
			store.getResidentRecord(src, { version: 7, force: true });
			expect(spies.onUpload).toHaveBeenCalledTimes(2);
		});

		it("a fresh record always uploads once, even at version 0", () => {
			// records start at an unmatchable version on purpose — otherwise a
			// source whose version is legitimately 0 would be created and never
			// filled, and sample as garbage
			const { store, spies } = makeStore();
			store.getResidentRecord({ name: "a" }, { version: 0 });
			expect(spies.onUpload).toHaveBeenCalledTimes(1);
		});

		it("adopts a replacement handle when the backend swaps one in", () => {
			// immutable storage cannot be respecified, so a shape change forces
			// a new GPU object; the store must track it or it hands back a dead
			// handle forever
			const swapped = { id: "new" };
			const { store } = makeStore({
				onUpload: vi.fn(() => {
					return swapped;
				}),
			});
			const rec = store.getResidentRecord({ name: "a" });
			expect(rec.handle).toBe(swapped);
		});

		it("keeps sources independent", () => {
			const { store, spies } = makeStore();
			const a = store.getResidentRecord({ name: "a" });
			const b = store.getResidentRecord({ name: "b" });
			expect(a.handle).not.toBe(b.handle);
			expect(spies.onCreate).toHaveBeenCalledTimes(2);
			expect(store.size).toBe(2);
		});
	});

	describe("invalidate / destroy", () => {
		it("destroyTexture releases exactly once", () => {
			const { store, spies } = makeStore();
			const src = { name: "a" };
			const rec = store.getResidentRecord(src);
			expect(store.destroyTexture(src)).toBe(true);
			expect(spies.onDestroy).toHaveBeenCalledWith(rec.handle, src);
			// a second destroy must not double-free
			expect(store.destroyTexture(src)).toBe(false);
			expect(spies.onDestroy).toHaveBeenCalledTimes(1);
		});

		it("a destroyed source is rebuilt on the next resolve", () => {
			const { store, spies } = makeStore();
			const src = { name: "a" };
			store.getResidentRecord(src);
			store.destroyTexture(src);
			store.getResidentRecord(src);
			expect(spies.onCreate).toHaveBeenCalledTimes(2);
		});

		it("peek never resolves", () => {
			const { store, spies } = makeStore();
			const src = { name: "a" };
			expect(store.peek(src)).toBeUndefined();
			expect(spies.onCreate).not.toHaveBeenCalled();
			store.getResidentRecord(src);
			expect(store.peek(src)).toBeDefined();
		});
	});

	describe("context loss", () => {
		it("rebuilds from scratch after a loss", () => {
			const { store, spies } = makeStore();
			const src = { name: "a" };
			const before = store.getResidentRecord(src).handle;
			store.releaseAll();
			const after = store.getResidentRecord(src).handle;
			expect(after).not.toBe(before);
			expect(spies.onCreate).toHaveBeenCalledTimes(2);
			expect(store.peek(src).generation).toBe(store.generation);
		});

		it("does not try to free handles whose context already died", () => {
			// the GPU objects went with the context; asking a dead context to
			// release them is at best a no-op and at worst throws
			const { store, spies } = makeStore();
			store.getResidentRecord({ name: "a" });
			store.releaseAll();
			expect(spies.onDestroy).not.toHaveBeenCalled();
		});

		it("releases handles on an orderly teardown", () => {
			const { store, spies } = makeStore();
			store.getResidentRecord({ name: "a" });
			store.getResidentRecord({ name: "b" });
			store.releaseAll(true);
			expect(spies.onDestroy).toHaveBeenCalledTimes(2);
		});

		it("survives a SECOND loss without leaking the first round", () => {
			// the failure this guards: responding to a restore by building a
			// replacement store orphans everything the old one tracked, so the
			// second loss leaks it all. Clearing in place must stay correct
			// across repeated cycles — and single-loss tests pass right through
			// this, which is why it needs its own case.
			const { store, spies } = makeStore();
			for (let cycle = 0; cycle < 3; cycle++) {
				store.getResidentRecord({ name: `a${cycle}` });
				store.getResidentRecord({ name: `b${cycle}` });
				expect(store.size).toBe(2);
				store.releaseAll();
				expect(store.size).toBe(0);
			}
			expect(store.generation).toBe(3);
			expect(spies.onCreate).toHaveBeenCalledTimes(6);
		});

		it("a stale record is dropped without being double-counted", () => {
			const { store } = makeStore();
			const src = { name: "a" };
			store.getResidentRecord(src);
			store.releaseAll();
			store.getResidentRecord(src);
			expect(store.size).toBe(1);
		});
	});
});
