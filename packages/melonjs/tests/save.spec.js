import { beforeEach, describe, expect, it } from "vitest";
import { device, save } from "../src/index.js";

describe("local Storage", () => {
	it("add and retrieve keys", () => {
		if (device.localStorage === true) {
			save.add({ testKey1: 1, testKey2: 2 });
			expect(save.testKey1).toBe(1);
			expect(device.getStorage().testKey2).toBe(2);
		} else {
			// localStorage not supported in the testing environment
			expect(true).toBe(true);
		}
	});

	it("remove keys", () => {
		if (device.localStorage === true) {
			// access through getStorage
			const localStorage = device.getStorage("local");
			// both value should still be there
			expect(localStorage.testKey1).toBe(1);
			expect(localStorage.testKey2).toBe(2);
			localStorage.remove("testKey1");
			localStorage.remove("testKey2");
			expect(localStorage.testKey1).toBeUndefined();
			expect(localStorage.testKey2).toBeUndefined();
		} else {
			// localStorage not supported in the testing environment
			expect(true).toBe(true);
		}
	});
});

/**
 * `save` registers keys through `add()` and installs real accessors for them
 * with `Object.defineProperty`. Typed as `Record<string, unknown>` the index
 * signature swallowed every member, so under `strict` TypeScript `save.add`
 * came out as `unknown` and **could not be called at all** — the namespace's
 * own documented example did not compile — while every registered key read
 * back as `unknown` and needed a cast to compare or assign.
 *
 * `add()` now returns the namespace typed with the keys just registered. These
 * pin the runtime half of that contract; the typing half is enforced by the
 * build.
 */
describe("save", () => {
	beforeEach(() => {
		save.remove("spec_score");
		save.remove("spec_lives");
		save.remove("spec_name");
	});

	it("registers keys with their defaults", () => {
		save.add({ spec_score: 0, spec_lives: 3 });

		expect(save.spec_score).toBe(0);
		expect(save.spec_lives).toBe(3);
	});

	it("hands back the namespace so the keys can be read straight away", () => {
		const store = save.add({ spec_score: 7 });

		expect(store.spec_score).toBe(7);
		// it IS the namespace, not a copy — writes through either are the same
		store.spec_score = 9;
		expect(save.spec_score).toBe(9);
	});

	it("leaves an existing value alone when re-registered", () => {
		save.add({ spec_score: 0 });
		save.spec_score = 42;

		save.add({ spec_score: 0 });

		expect(save.spec_score).toBe(42);
	});

	it("accumulates across chained calls", () => {
		const store = save.add({ spec_score: 1 }).add({ spec_name: "ada" });

		expect(store.spec_score).toBe(1);
		expect(store.spec_name).toBe("ada");
	});

	it("forgets a removed key", () => {
		save.add({ spec_score: 5 });
		save.remove("spec_score");

		expect(save.spec_score).toBeUndefined();
	});
});
