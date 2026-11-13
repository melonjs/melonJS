import { afterEach, describe, expect, it } from "vitest";
import { save } from "../src/index.js";

/**
 * `save.setStorage()` keeps the saved keys somewhere other than
 * `localStorage`, the default: anything with `getItem`, `setItem` and
 * `removeItem`, handed the same items `localStorage` would hold.
 *
 * - the keys the new storage holds are read at once and win
 * - a registered key it does not hold keeps its value, written to it
 * - a key read from the previous storage but never registered goes with it
 * - from then on every write and removal goes to the new storage only
 * - `setStorage(localStorage)` goes back to the default
 */

const KEYS = ["ss_score", "ss_level", "ss_name", "ss_old", "ss_setStorage"];

// a storage in memory, as a portal's cloud save would serve one
const memory = (items = {}) => {
	return {
		items,
		getItem(key) {
			return key in this.items ? this.items[key] : null;
		},
		setItem(key, value) {
			this.items[key] = String(value);
		},
		removeItem(key) {
			delete this.items[key];
		},
	};
};

// what a storage lists in its index
const listed = (storage) => {
	return JSON.parse(storage.getItem("me.save") ?? "[]");
};

describe("save.setStorage()", () => {
	afterEach(() => {
		save.setStorage(localStorage);
		for (const key of KEYS) {
			save.remove(key);
			localStorage.removeItem(`me.save.${key}`);
		}
	});

	it("keeps the keys in localStorage by default", () => {
		save.add({ ss_score: 10 });
		save.ss_score = 42;
		expect(localStorage.getItem("me.save.ss_score")).toBe("42");
		expect(listed(localStorage)).toContain("ss_score");
	});

	it("reads what the new storage holds, and writes there from then on", () => {
		save.add({ ss_score: 0, ss_level: 1 });
		const cloud = memory({
			"me.save": JSON.stringify(["ss_score"]),
			"me.save.ss_score": "900",
		});
		save.setStorage(cloud);
		// its value wins
		expect(save.ss_score).toBe(900);
		// a registered key it did not hold keeps its value, and is written to it
		expect(save.ss_level).toBe(1);
		expect(cloud.getItem("me.save.ss_level")).toBe("1");
		expect(listed(cloud)).toEqual(
			expect.arrayContaining(["ss_score", "ss_level"]),
		);

		// writes go to the new storage, and not to localStorage
		const before = localStorage.getItem("me.save.ss_score");
		save.ss_score = 1200;
		expect(cloud.getItem("me.save.ss_score")).toBe("1200");
		expect(localStorage.getItem("me.save.ss_score")).toBe(before);

		// and so do removals
		save.remove("ss_level");
		expect(cloud.getItem("me.save.ss_level")).toBeNull();
		expect(listed(cloud)).not.toContain("ss_level");
	});

	it("before add(), the stored value wins over the default", () => {
		save.setStorage(
			memory({
				"me.save": JSON.stringify(["ss_name"]),
				"me.save.ss_name": JSON.stringify("Ada"),
			}),
		);
		save.add({ ss_name: "player" });
		expect(save.ss_name).toBe("Ada");
	});

	it("drops a key read from the previous storage but never registered", () => {
		// left in localStorage by an earlier session, never add()ed in this one
		localStorage.setItem("me.save.ss_old", "7");
		localStorage.setItem(
			"me.save",
			JSON.stringify([...listed(localStorage), "ss_old"]),
		);
		save.setStorage(localStorage);
		const cloud = memory();
		save.setStorage(cloud);
		expect(cloud.getItem("me.save.ss_old")).toBeNull();
		expect(listed(cloud)).not.toContain("ss_old");
		// and the previous storage is left as it was
		expect(localStorage.getItem("me.save.ss_old")).toBe("7");
	});

	it("goes back to localStorage, and reads it again", () => {
		save.add({ ss_score: 5 });
		save.ss_score = 77;
		save.setStorage(memory());
		save.ss_score = 1;
		save.setStorage(localStorage);
		expect(save.ss_score).toBe(77);
	});

	it("is not a key that add() can register", () => {
		save.add({ ss_setStorage: 1, setStorage: 2 });
		expect(typeof save.setStorage).toBe("function");
	});
});
