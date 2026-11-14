import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, event, save } from "../src/index.js";

/**
 * A `save` key set again after `save.remove()` survives a reload.
 *
 * `remove()` drops the key from the "me.save" index, the list boot reads back
 * from localStorage, but leaves its accessor on the namespace. Setting the key
 * again then went through that accessor, which wrote `me.save.<key>` and never
 * put the key back in the index — so the value sat in localStorage and was
 * silently not restored on the next page load: a high score saved after a
 * "reset progress" button was gone the next day.
 *
 * A reload is simulated by loading a fresh copy of the save module and
 * emitting BOOT, which runs the same restore a new page would, from the same
 * localStorage.
 */
describe("save: a key set again after remove()", () => {
	const keys = [
		"srr_score",
		"srr_level",
		"srr_name",
		"srr_obj",
		"srr_other",
		"srr_flag",
	];

	beforeAll(() => {
		// the engine's own BOOT listeners run (once) here, not on the
		// simulated reloads below
		boot();
	});

	afterEach(() => {
		for (const key of keys) {
			save.remove(key);
			// a fresh copy may have written keys this one does not know about
			localStorage.removeItem(`me.save.${key}`);
		}
		const listed = JSON.parse(localStorage.getItem("me.save") ?? "[]");
		localStorage.setItem(
			"me.save",
			JSON.stringify(
				listed.filter((key) => {
					return !keys.includes(key);
				}),
			),
		);
	});

	/**
	 * what a new page load would find in `save`
	 * @returns {Promise<object>} the save namespace of a fresh module copy
	 */
	// One per reload: a query makes each a module of its own, evaluated
	// afresh (`vi.resetModules()` does not re-evaluate a module in browser
	// mode), and Vite only resolves a dynamic import written out in full.
	const copies = [
		() => {
			return import("../src/system/save.ts?reload=1");
		},
		() => {
			return import("../src/system/save.ts?reload=2");
		},
		() => {
			return import("../src/system/save.ts?reload=3");
		},
		() => {
			return import("../src/system/save.ts?reload=4");
		},
		() => {
			return import("../src/system/save.ts?reload=5");
		},
		() => {
			return import("../src/system/save.ts?reload=6");
		},
	];
	const reload = async () => {
		const { default: fresh } = await copies.shift()();
		expect(fresh).not.toBe(save);
		// the same bus the fresh copy subscribed to; boot() already ran, so
		// BOOT now only reaches that copy's restore
		event.emit(event.BOOT);
		return fresh;
	};

	const index = () => {
		return JSON.parse(localStorage.getItem("me.save"));
	};

	it("is listed again in the index boot restores from", () => {
		save.add({ srr_level: 1 });
		save.remove("srr_level");
		expect(index()).not.toContain("srr_level");

		save.srr_level = 7;
		expect(save.srr_level).toBe(7);
		expect(index()).toContain("srr_level");
	});

	it("is restored by a reload", async () => {
		save.add({ srr_score: 0 });
		save.srr_score = 120;
		save.remove("srr_score");
		save.srr_score = 31337;

		const fresh = await reload();
		// restored as data; `add` is what puts the accessor on it, as a game
		// does at start-up, and keeps the stored value over the default
		fresh.add({ srr_score: 0 });
		expect(fresh.srr_score).toBe(31337);
	});

	it("keeps nested values, and the default does not win over them", async () => {
		save.add({ srr_obj: { a: 1 } });
		save.remove("srr_obj");
		save.srr_obj = { a: "b", c: [1, 2, 3, "d"], e: { f: [{}] } };

		const fresh = await reload();
		fresh.add({ srr_obj: {} });
		expect(fresh.srr_obj).toEqual({
			a: "b",
			c: [1, 2, 3, "d"],
			e: { f: [{}] },
		});
	});

	it("falsy values survive too: 0, false, the empty string, null", async () => {
		save.add({ srr_level: 5, srr_flag: true, srr_name: "ada", srr_obj: 1 });
		for (const key of ["srr_level", "srr_flag", "srr_name", "srr_obj"]) {
			save.remove(key);
		}
		save.srr_level = 0;
		save.srr_flag = false;
		save.srr_name = "";
		save.srr_obj = null;

		const fresh = await reload();
		fresh.add({ srr_level: 9, srr_flag: true, srr_name: "x", srr_obj: 1 });
		expect(fresh.srr_level).toBe(0);
		expect(fresh.srr_flag).toBe(false);
		expect(fresh.srr_name).toBe("");
		expect(fresh.srr_obj).toBe(null);
	});

	it("a key removed and NOT set again stays gone, and its default comes back", async () => {
		save.add({ srr_score: 0, srr_other: 1 });
		save.srr_score = 50;
		save.srr_other = 2;
		save.remove("srr_score");

		const fresh = await reload();
		fresh.add({ srr_score: 0, srr_other: 1 });
		expect(fresh.srr_score).toBe(0);
		// the other key is unaffected
		expect(fresh.srr_other).toBe(2);
	});

	it("removing, re-setting and removing again leaves nothing behind", () => {
		save.add({ srr_score: 1 });
		save.remove("srr_score");
		save.srr_score = 2;
		save.remove("srr_score");

		expect(index()).not.toContain("srr_score");
		expect(localStorage.getItem("me.save.srr_score")).toBe(null);
	});

	it("re-registering with add() after remove() is saved too, at its default", async () => {
		save.add({ srr_level: 3 });
		save.srr_level = 8;
		save.remove("srr_level");
		save.add({ srr_level: 3 });
		expect(save.srr_level).toBe(3);

		const fresh = await reload();
		fresh.add({ srr_level: 0 });
		expect(fresh.srr_level).toBe(3);
	});
});
