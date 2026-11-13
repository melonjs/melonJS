import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, device, event } from "../src/index.js";
import { getLocalStorage } from "../src/system/dom.ts";

/**
 * Whether the browser's `localStorage` can be used, decided in one place
 * (`getLocalStorage()`, in dom.ts) for both `device.localStorage` and the
 * default storage of `save`.
 *
 * `save` used to make its own check, `typeof localStorage !== "undefined"`,
 * which is true when `localStorage` is `null`. Some sandboxed frames have it
 * `null` (YouTube Playables' SDK Test Suite runs games in one), and there the
 * boot restore called `null.getItem()` and the game never started.
 *
 * `localStorage` is replaced on the window for each case, then put back.
 */

const WINDOW_OWN = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const real = globalThis.localStorage;

// make `globalThis.localStorage` read as the given getter returns
const replaceLocalStorage = (get) => {
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		get,
	});
};

const restoreLocalStorage = () => {
	if (WINDOW_OWN !== undefined) {
		Object.defineProperty(globalThis, "localStorage", WINDOW_OWN);
	} else {
		delete globalThis.localStorage;
	}
};

describe("getLocalStorage()", () => {
	afterEach(restoreLocalStorage);

	it("is the browser's localStorage where there is one", () => {
		expect(getLocalStorage()).toBe(real);
	});

	it("is undefined where localStorage is null, as in some sandboxed frames", () => {
		replaceLocalStorage(() => {
			return null;
		});
		expect(getLocalStorage()).toBeUndefined();
	});

	it("is undefined where reading localStorage throws (cookies blocked)", () => {
		replaceLocalStorage(() => {
			throw new DOMException("blocked", "SecurityError");
		});
		expect(getLocalStorage()).toBeUndefined();
	});

	it("is undefined where there is no localStorage at all", () => {
		replaceLocalStorage(() => {
			return undefined;
		});
		expect(getLocalStorage()).toBeUndefined();
	});
});

describe("a page whose localStorage is null", () => {
	beforeAll(() => {
		// the engine's own BOOT listeners run here, once
		boot();
	});

	afterEach(restoreLocalStorage);

	it("reports it through device.localStorage", async () => {
		expect(device.localStorage).toBe(true);
		replaceLocalStorage(() => {
			return null;
		});
		// the flag is read when the module loads: a copy loaded now
		const fresh = await import("../src/system/device.ts?null-storage");
		expect(fresh.localStorage).toBe(false);
	});

	it("boots, and save keeps its keys in memory", async () => {
		replaceLocalStorage(() => {
			return null;
		});
		// a page loading with it null: a copy of save loaded now, and its boot
		const { default: save } = await import(
			"../src/system/save.ts?null-storage"
		);
		expect(() => {
			// boot() already ran, so BOOT only reaches that copy's restore
			event.emit(event.BOOT);
		}).not.toThrow();
		const store = save.add({ lns_score: 5 });
		expect(store.lns_score).toBe(5);
		store.lns_score = 42;
		expect(store.lns_score).toBe(42);
		save.remove("lns_score");
		expect(store.lns_score).toBeUndefined();
		// and nothing reached the real localStorage
		restoreLocalStorage();
		expect(globalThis.localStorage.getItem("me.save.lns_score")).toBeNull();
	});
});
