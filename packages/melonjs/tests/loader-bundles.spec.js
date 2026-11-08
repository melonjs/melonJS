import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { boot, event, game, level, loader } from "../src/index.js";
import state from "../src/state/state.ts";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Named asset bundles (#1656): `loader.setBundle(id, assets)` declares a named
 * list of the asset descriptors a game already writes, and the loader's
 * existing calls take the id where they took a descriptor:
 *
 * - `load(id)` loads the bundle through the same path as `preload()` —
 *   progress for its own assets, the shader warm-up, `LOADER_COMPLETE` — but
 *   without switching to the loading screen, and always returns a promise;
 * - `preload([...])` takes ids mixed with descriptors, an asset listed more
 *   than once being loaded once;
 * - `unload(id)` releases the bundle's assets, freeing those nothing else holds;
 * - `isLoaded(id)` says whether every asset of the bundle is in memory, and
 *   `getBundle(id)` returns a copy of its list.
 *
 * A bundle is a lifetime over the SAME caches, not a namespace: its assets keep
 * their names. An unknown id throws synchronously in every form, and freeing a
 * map through a bundle unregisters its level. Ownership (sharing, pinning,
 * fetch counts) is covered by loader-bundles-ownership.spec.js.
 */

const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const img = (name, src = PNG) => {
	return { name, type: "image", src };
};
const json = (name) => {
	return {
		name,
		type: "json",
		src: `data:application/json,${encodeURIComponent('{"ok":1}')}`,
	};
};

/** a minimal Tiled map, registered as a level by the tmx parser on load */
const tmx = (name) => {
	return {
		name,
		type: "tmx",
		data: {
			type: "map",
			version: "1.10",
			orientation: "orthogonal",
			renderorder: "right-down",
			infinite: false,
			width: 2,
			height: 2,
			tilewidth: 16,
			tileheight: 16,
			nextlayerid: 2,
			nextobjectid: 1,
			layers: [
				{
					id: 1,
					name: "ground",
					type: "tilelayer",
					visible: true,
					opacity: 1,
					x: 0,
					y: 0,
					width: 2,
					height: 2,
					data: [0, 0, 0, 0],
				},
			],
			tilesets: [],
		},
	};
};

const flush = () => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

describe("loader bundles", () => {
	// a custom type whose loads fail while `flaky.fails` is set
	const flaky = { fails: true, calls: 0 };

	beforeAll(async () => {
		await boot();
		// a renderer, for the shader warm-up and the level director's world
		await getWebGLRenderer(64, 64);
		loader.setParser("bt-flaky", (asset, onload, onerror) => {
			flaky.calls++;
			setTimeout(() => {
				if (flaky.fails) {
					onerror(new Error("bt-flaky " + asset.name));
				} else {
					onload();
				}
			}, 0);
			return 1;
		});
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		state.stop();
		await flush();
		loader.unloadAll();
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	describe("declaring", () => {
		it("setBundle keeps a copy of the list, and getBundle hands back a copy", () => {
			const list = [img("dc-a"), json("dc-b")];
			loader.setBundle("dc", list);
			list.push(img("dc-c"));

			const got = loader.getBundle("dc");
			expect(
				got.map((asset) => {
					return asset.name;
				}),
			).toEqual(["dc-a", "dc-b"]);
			got.length = 0;
			expect(loader.getBundle("dc")).toHaveLength(2);
			// declaring loads nothing
			expect(loader.getImage("dc-a")).toBeNull();
			expect(loader.isLoaded("dc")).toBe(false);
		});

		it("getBundle returns undefined for an id never declared", () => {
			expect(loader.getBundle("never-declared")).toBeUndefined();
		});

		it("setBundle rejects a bad id, a list that is not an array, and nested ids", () => {
			expect(() => {
				loader.setBundle("", [img("x")]);
			}).toThrow(TypeError);
			expect(() => {
				loader.setBundle(3, [img("x")]);
			}).toThrow(TypeError);
			expect(() => {
				loader.setBundle("bad", img("x"));
			}).toThrow(TypeError);
			expect(() => {
				loader.setBundle("bad", [img("x"), "common"]);
			}).toThrow(/not other bundles/);
			expect(() => {
				loader.setBundle("bad", [{ name: "x", src: "x.png" }]);
			}).toThrow(TypeError);
			expect(() => {
				loader.setBundle("bad", [null]);
			}).toThrow(TypeError);
			expect(loader.getBundle("bad")).toBeUndefined();
		});

		it("an unknown id throws synchronously in every form, and loads nothing", async () => {
			const change = vi.spyOn(state, "change").mockImplementation(() => {});
			let returned;
			expect(() => {
				returned = loader.load("no-such-bundle");
			}).toThrow(/unknown bundle "no-such-bundle"/);
			expect(returned).toBeUndefined();
			expect(() => {
				loader.load(
					"no-such-bundle",
					() => {},
					() => {},
				);
			}).toThrow(/unknown bundle/);
			expect(() => {
				loader.unload("no-such-bundle");
			}).toThrow(/unknown bundle/);
			expect(() => {
				loader.isLoaded("no-such-bundle");
			}).toThrow(/unknown bundle/);
			// in a preload list: thrown before the loading screen or any asset
			expect(() => {
				loader.preload([img("uk-a"), "no-such-bundle"]);
			}).toThrow(/unknown bundle/);
			expect(change).not.toHaveBeenCalled();
			await flush();
			expect(loader.getImage("uk-a")).toBeNull();
		});

		it("a bad asset type in a bundle, or beside one, throws before anything loads", async () => {
			loader.setBundle("bt-typo", [
				img("bt-typo-a"),
				{ name: "x", type: "imgae" },
			]);
			loader.setBundle("bt-fine", [img("bt-fine-a")]);
			expect(() => {
				loader.load("bt-typo");
			}).toThrow(/unknown or invalid resource type : imgae/);
			expect(() => {
				loader.preload(
					["bt-fine", { name: "y", type: "jsno" }],
					undefined,
					false,
				);
			}).toThrow(/unknown or invalid resource type : jsno/);
			await flush();
			expect(loader.getImage("bt-typo-a")).toBeNull();
			expect(loader.getImage("bt-fine-a")).toBeNull();
			// neither was left half loading: both can still be redefined
			loader.setBundle("bt-typo", [img("bt-typo-a")]);
			loader.setBundle("bt-fine", [img("bt-fine-a")]);
		});

		it("a loaded or loading bundle cannot be redefined; an unloaded one can", async () => {
			loader.setBundle("rd", [img("rd-a")]);
			const loading = loader.load("rd");
			expect(() => {
				loader.setBundle("rd", [img("rd-b")]);
			}).toThrow(/loading/);
			await loading;
			expect(() => {
				loader.setBundle("rd", [img("rd-b")]);
			}).toThrow(/loaded/);

			expect(loader.unload("rd")).toBe(true);
			loader.setBundle("rd", [img("rd-b")]);
			expect(
				loader.getBundle("rd").map((asset) => {
					return asset.name;
				}),
			).toEqual(["rd-b"]);
			await loader.load("rd");
			expect(loader.getImage("rd-b")).not.toBeNull();
			expect(loader.getImage("rd-a")).toBeNull();
		});
	});

	describe("loading", () => {
		it("load(id) returns a promise, keeps the assets' own names, and calls onload", async () => {
			loader.setBundle("ld", [img("ld-img"), json("ld-json")]);
			const onload = vi.fn();
			const loading = loader.load("ld", onload);
			expect(loading).toBeInstanceOf(Promise);
			await loading;
			expect(onload).toHaveBeenCalledTimes(1);
			// the getters are the ones every asset goes through
			expect(loader.getImage("ld-img")).not.toBeNull();
			expect(loader.getJSON("ld-json")).toEqual({ ok: 1 });
			expect(loader.isLoaded("ld")).toBe(true);
		});

		it("load(id) reports progress for its own assets and fires LOADER_COMPLETE, without the loading screen", async () => {
			loader.setBundle("pg", [img("pg-a"), img("pg-b"), json("pg-c")]);
			// one of them already in memory: still a step of this load
			await loader.load(img("pg-a"));

			const change = vi.spyOn(state, "change");
			const progress = [];
			const onProgress = (value) => {
				progress.push(value);
			};
			const onComplete = vi.fn();
			event.on(event.LOADER_PROGRESS, onProgress);
			event.on(event.LOADER_COMPLETE, onComplete);
			try {
				await loader.load("pg");
			} finally {
				event.off(event.LOADER_PROGRESS, onProgress);
				event.off(event.LOADER_COMPLETE, onComplete);
			}
			expect(progress).toHaveLength(3);
			expect(progress.at(-1)).toBe(1);
			expect(progress[0]).toBeCloseTo(1 / 3);
			expect(onComplete).toHaveBeenCalledTimes(1);
			expect(change).not.toHaveBeenCalled();
		});

		it("load(id) runs the shader warm-up, as preload does", async () => {
			const prewarm = vi.spyOn(game.renderer, "prewarm");
			loader.setBundle("pw", [img("pw-a")]);
			await loader.load("pw");
			expect(prewarm).toHaveBeenCalledTimes(1);
		});

		it("a failing asset rejects load(id); the rest stays, and reload(src) completes it", async () => {
			flaky.fails = true;
			const flakyAsset = {
				name: "fl-x",
				type: "bt-flaky",
				src: "flaky://fl-x",
			};
			loader.setBundle("fl", [img("fl-ok"), flakyAsset]);
			const onload = vi.fn();
			const onerror = vi.fn();
			const errors = [];
			const onError = (res) => {
				errors.push(res.name);
			};
			event.on(event.LOADER_ERROR, onError);
			try {
				await expect(loader.load("fl", onload, onerror)).rejects.toThrow(
					/flaky:\/\/fl-x/,
				);
			} finally {
				event.off(event.LOADER_ERROR, onError);
			}
			expect(errors).toEqual(["fl-x"]);
			expect(onerror).toHaveBeenCalledTimes(1);
			expect(onload).not.toHaveBeenCalled();
			// what did load stays, held by the bundle (the rejection comes with
			// the first failure, so the image may still be decoding)
			await vi.waitFor(() => {
				expect(loader.getImage("fl-ok")).not.toBeNull();
			});
			expect(loader.isLoaded("fl")).toBe(false);

			flaky.fails = false;
			loader.reload("flaky://fl-x");
			await flush();
			await flush();
			expect(loader.isLoaded("fl")).toBe(true);
			// the load the asset failed in completes, with its own callback
			expect(onload).toHaveBeenCalledTimes(1);

			// and the retried asset belongs to the bundle like the others
			loader.unload("fl");
			expect(loader.getImage("fl-ok")).toBeNull();
			expect(loader.isLoaded("fl")).toBe(false);
		});

		it("preload takes bundle ids mixed with descriptors, loads a repeated asset once, and shows the loading screen", async () => {
			const change = vi.spyOn(state, "change").mockImplementation(() => {});
			const parse = vi.fn();
			loader.setParser("bt-count", (asset, onload) => {
				parse(asset.name);
				onload();
				return 1;
			});
			const counted = (name) => {
				return { name, type: "bt-count" };
			};
			loader.setBundle("mx-a", [counted("mx-shared"), counted("mx-only-a")]);
			loader.setBundle("mx-b", [counted("mx-shared"), counted("mx-only-b")]);

			const progress = [];
			const onProgress = (value) => {
				progress.push(value);
			};
			event.on(event.LOADER_PROGRESS, onProgress);
			try {
				await loader.preload([
					"mx-a",
					counted("mx-direct"),
					"mx-b",
					// listed directly as well: still one load
					counted("mx-shared"),
					"mx-a",
				]);
			} finally {
				event.off(event.LOADER_PROGRESS, onProgress);
			}
			expect(change).toHaveBeenCalledWith(state.LOADING);
			expect(parse.mock.calls.flat().sort()).toEqual([
				"mx-direct",
				"mx-only-a",
				"mx-only-b",
				"mx-shared",
			]);
			// one step per distinct asset
			expect(progress).toEqual([0.25, 0.5, 0.75, 1]);
			expect(loader.isLoaded("mx-a")).toBe(true);
			expect(loader.isLoaded("mx-b")).toBe(true);
			// both bundles were loaded by that preload
			expect(() => {
				loader.setBundle("mx-a", []);
			}).toThrow(/loaded/);
		});

		it("isLoaded follows every transition", async () => {
			loader.setBundle("tr", [img("tr-a"), json("tr-b")]);
			expect(loader.isLoaded("tr")).toBe(false);
			// one of two resident (loaded the old way): not yet
			await loader.load(img("tr-a"));
			expect(loader.isLoaded("tr")).toBe(false);
			// every asset resident, however it got there
			await loader.load(json("tr-b"));
			expect(loader.isLoaded("tr")).toBe(true);
			await loader.load("tr");
			expect(loader.isLoaded("tr")).toBe(true);
			// one freed on its own
			loader.unload(json("tr-b"));
			expect(loader.isLoaded("tr")).toBe(false);
			await loader.load("tr");
			expect(loader.isLoaded("tr")).toBe(true);
			// tr-a was pinned, tr-b only the bundle's
			loader.unload("tr");
			expect(loader.getImage("tr-a")).not.toBeNull();
			expect(loader.getJSON("tr-b")).toBeNull();
			expect(loader.isLoaded("tr")).toBe(false);
			// unloading a bundle that is not loaded does nothing
			expect(loader.unload("tr")).toBe(false);
		});

		it("unloadAll frees everything and keeps the declarations, ready to load again", async () => {
			loader.setBundle("ua", [img("ua-a")]);
			await loader.load("ua");
			loader.unloadAll();
			expect(loader.getImage("ua-a")).toBeNull();
			expect(loader.getBundle("ua")).toHaveLength(1);
			expect(loader.isLoaded("ua")).toBe(false);
			// not loaded any more, so it may be redefined
			loader.setBundle("ua", [img("ua-a"), img("ua-b")]);
			await loader.load("ua");
			expect(loader.isLoaded("ua")).toBe(true);
			expect(loader.unload("ua")).toBe(true);
			expect(loader.getImage("ua-b")).toBeNull();
		});
	});

	describe("defining and loading in one call: load(id, assets)", () => {
		const JSON_URL = "/data/misc/plain.json";
		const fileJson = (name) => {
			return { name, type: "json", src: JSON_URL };
		};
		const requestsFor = (spy) => {
			return spy.mock.calls.filter(([input]) => {
				return String(input).includes(JSON_URL);
			}).length;
		};

		it("declares the bundle and loads it: the assets are resident and getBundle returns them", async () => {
			const onProgress = vi.fn();
			event.on(event.LOADER_PROGRESS, onProgress);
			let loading;
			try {
				loading = loader.load("dl", [img("dl-img"), json("dl-json")]);
				expect(loading).toBeInstanceOf(Promise);
				await loading;
			} finally {
				event.off(event.LOADER_PROGRESS, onProgress);
			}
			expect(onProgress).toHaveBeenCalledTimes(2);
			expect(loader.getImage("dl-img")).not.toBeNull();
			expect(loader.getJSON("dl-json")).toEqual({ ok: 1 });
			expect(
				loader.getBundle("dl").map((asset) => {
					return asset.name;
				}),
			).toEqual(["dl-img", "dl-json"]);
			expect(loader.isLoaded("dl")).toBe(true);

			// and released by id, as any bundle
			expect(loader.unload("dl")).toBe(true);
			expect(loader.getImage("dl-img")).toBeNull();
			expect(loader.isLoaded("dl")).toBe(false);
		});

		it("takes a single descriptor too", async () => {
			await loader.load("dl-one", img("dl-one-img"));
			expect(loader.getBundle("dl-one")).toHaveLength(1);
			expect(loader.isLoaded("dl-one")).toBe(true);
		});

		it("called again with the same assets, it fetches nothing new", async () => {
			const spy = vi.spyOn(globalThis, "fetch");
			await loader.load("dl-again", [
				fileJson("dl-again-json"),
				img("dl-again-img"),
			]);
			expect(requestsFor(spy)).toBe(1);
			// the same assets, listed in another order and as new objects
			await loader.load("dl-again", [
				img("dl-again-img"),
				fileJson("dl-again-json"),
			]);
			expect(requestsFor(spy)).toBe(1);
			expect(loader.isLoaded("dl-again")).toBe(true);
			// still one owner: one unload frees
			loader.unload("dl-again");
			expect(loader.getJSON("dl-again-json")).toBeNull();
		});

		it("with different assets while loaded it throws synchronously; once unloaded it redefines", async () => {
			await loader.load("dl-diff", [img("dl-diff-a")]);
			let returned;
			expect(() => {
				returned = loader.load("dl-diff", [img("dl-diff-b")]);
			}).toThrow(/loaded/);
			expect(returned).toBeUndefined();
			// the declaration was left alone
			expect(
				loader.getBundle("dl-diff").map((asset) => {
					return asset.name;
				}),
			).toEqual(["dl-diff-a"]);
			// and so was the bundle's state
			expect(loader.isLoaded("dl-diff")).toBe(true);

			expect(loader.unload("dl-diff")).toBe(true);
			await loader.load("dl-diff", [img("dl-diff-b")]);
			expect(loader.getImage("dl-diff-b")).not.toBeNull();
			expect(loader.getImage("dl-diff-a")).toBeNull();
		});

		it("validates the assets as setBundle does", () => {
			expect(() => {
				loader.load("dl-bad", [img("x"), "common"]);
			}).toThrow(/not other bundles/);
			expect(() => {
				loader.load("dl-bad", [{ name: "x" }]);
			}).toThrow(TypeError);
			expect(loader.getBundle("dl-bad")).toBeUndefined();
		});
	});

	describe("preload with a record of bundles, as an assets file exports it", () => {
		const JSON_URL = "/data/misc/plain.json";
		const fileJson = (name) => {
			return { name, type: "json", src: JSON_URL };
		};
		const record = () => {
			// fresh arrays and objects every time, as a re-imported module's
			return {
				"rc-common": [img("rc-player"), fileJson("rc-data")],
				"rc-map1": [img("rc-hills"), img("rc-map1-own")],
				"rc-map2": [img("rc-hills"), json("rc-map2-own")],
			};
		};

		it("declares every bundle and loads them all, with one progress bar, the callback and the promise", async () => {
			const change = vi.spyOn(state, "change").mockImplementation(() => {});
			const progress = [];
			const onProgress = (value) => {
				progress.push(value);
			};
			const onload = vi.fn();
			event.on(event.LOADER_PROGRESS, onProgress);
			try {
				const loading = loader.preload(record(), onload);
				expect(loading).toBeInstanceOf(Promise);
				await loading;
			} finally {
				event.off(event.LOADER_PROGRESS, onProgress);
			}
			expect(change).toHaveBeenCalledWith(state.LOADING);
			expect(onload).toHaveBeenCalledTimes(1);
			// five distinct assets: the shared one counted once
			expect(progress).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
			for (const id of ["rc-common", "rc-map1", "rc-map2"]) {
				expect(loader.getBundle(id)).toHaveLength(2);
				expect(loader.isLoaded(id)).toBe(true);
			}
			expect(loader.getImage("rc-hills")).not.toBeNull();
			expect(loader.getJSON("rc-map2-own")).toEqual({ ok: 1 });
		});

		it("each bundle is then loaded as by load(id): unload frees its own assets, load brings them back", async () => {
			await loader.preload(record(), undefined, false);
			expect(loader.unload("rc-map1")).toBe(true);
			expect(loader.getImage("rc-map1-own")).toBeNull();
			// shared with rc-map2, which is still loaded
			expect(loader.getImage("rc-hills")).not.toBeNull();
			expect(loader.isLoaded("rc-common")).toBe(true);
			expect(loader.isLoaded("rc-map1")).toBe(false);

			await loader.load("rc-map1");
			expect(loader.getImage("rc-map1-own")).not.toBeNull();
			expect(loader.isLoaded("rc-map1")).toBe(true);
		});

		it("called twice, it fetches nothing new", async () => {
			const spy = vi.spyOn(globalThis, "fetch");
			await loader.preload(record(), undefined, false);
			const count = spy.mock.calls.filter(([input]) => {
				return String(input).includes(JSON_URL);
			}).length;
			expect(count).toBe(1);
			await loader.preload(record(), undefined, false);
			expect(
				spy.mock.calls.filter(([input]) => {
					return String(input).includes(JSON_URL);
				}).length,
			).toBe(1);
			expect(loader.isLoaded("rc-common")).toBe(true);
		});

		it("a loaded bundle given other assets throws synchronously, with nothing declared", async () => {
			await loader.preload({ "rc-x": [img("rc-x-a")] }, undefined, false);
			expect(() => {
				loader.preload(
					{ "rc-y": [img("rc-y-a")], "rc-x": [img("rc-x-b")] },
					undefined,
					false,
				);
			}).toThrow(/loaded/);
			expect(loader.getBundle("rc-y")).toBeUndefined();
			expect(
				loader.getBundle("rc-x").map((asset) => {
					return asset.name;
				}),
			).toEqual(["rc-x-a"]);
		});

		it("a single asset passed by mistake, or a record entry that is not a list, throws a TypeError", () => {
			const change = vi.spyOn(state, "change").mockImplementation(() => {});
			expect(() => {
				loader.preload(img("rc-single"));
			}).toThrow(/single asset/);
			expect(() => {
				loader.preload({ "rc-bad": img("rc-bad-a") });
			}).toThrow(TypeError);
			expect(loader.getBundle("rc-bad")).toBeUndefined();
			expect(change).not.toHaveBeenCalled();
		});

		it("the array form is unchanged beside it: its assets are pinned, not owned by the bundles", async () => {
			await loader.preload(record(), undefined, false);
			// the old call shape, naming one of the bundles' assets
			await loader.preload(
				[img("rc-map1-own"), img("rc-extra")],
				undefined,
				false,
			);
			expect(loader.getImage("rc-extra")).not.toBeNull();
			loader.unload("rc-map1");
			expect(loader.getImage("rc-map1-own")).not.toBeNull();
		});
	});

	describe("levels", () => {
		const loadLevel = (id) => {
			return level.load(id, { async: true });
		};

		it("unloading a bundle unregisters the level of the map it frees; loading it again registers it", async () => {
			loader.setBundle("lv-1", [tmx("bt-map1")]);
			loader.setBundle("lv-2", [tmx("bt-map2")]);
			await loader.load("lv-1");
			await loader.load("lv-2");
			const count = level.levelCount();
			await loadLevel("bt-map1");

			loader.unload("lv-2");
			expect(level.levelCount()).toBe(count - 1);
			expect(() => {
				level.load("bt-map2");
			}).toThrow(/level bt-map2 not found/);
			// the current level is untouched
			expect(level.getCurrentLevelId()).toBe("bt-map1");

			await loader.load("lv-2");
			expect(level.levelCount()).toBe(count);
			await expect(loadLevel("bt-map2")).resolves.toBe(true);
			expect(level.getCurrentLevelId()).toBe("bt-map2");
		});

		it("unloading the bundle of the current level leaves the world as it is, with no current level", async () => {
			loader.setBundle("lv-cur", [tmx("bt-cur")]);
			await loader.load("lv-cur");
			await loadLevel("bt-cur");
			const children = game.world.children.length;
			expect(children).toBeGreaterThan(0);

			loader.unload("lv-cur");
			expect(level.getCurrentLevelId()).toBeUndefined();
			expect(game.world.children.length).toBe(children);
			expect(() => {
				level.load("bt-cur");
			}).toThrow(/not found/);

			// back again, and loadable
			await loader.load("lv-cur");
			await expect(loadLevel("bt-cur")).resolves.toBe(true);
			expect(level.getCurrentLevelId()).toBe("bt-cur");
		});

		it("unload(asset) of a map keeps its level registered, unlike unloading its bundle", async () => {
			loader.setBundle("lv-desc", [tmx("bt-desc")]);
			await loader.load("lv-desc");
			const count = level.levelCount();
			// the descriptor form behaves as it always has
			loader.unload(tmx("bt-desc"));
			expect(loader.getTMX("bt-desc")).toBeNull();
			expect(level.levelCount()).toBe(count);
			expect(loader.isLoaded("lv-desc")).toBe(false);
		});
	});
});
