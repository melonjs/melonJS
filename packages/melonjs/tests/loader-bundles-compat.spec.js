import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { audio, boot, event, loader } from "../src/index.js";
import {
	fontList,
	gltfList,
	imgList,
	jsonList,
	videoList,
} from "../src/loader/cache.js";
import state from "../src/state/state.ts";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Backward compatibility of the loader with named bundles (#1656).
 *
 * Bundles extend `load`, `unload` and `preload` with a string (an id) or a
 * record where they took asset descriptors, so every call written before them
 * must behave exactly as it did: the same return values, callbacks, events,
 * loading-screen switch, cache hits and unload results. This file uses ONLY
 * the API that existed before bundles, and passes on the code before them as
 * well as after — it is the contract, run against both.
 */

const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const JSON_URL = "/data/misc/plain.json";
const FLASH =
	"uniform float uIntensity;\nvec4 apply(vec4 color, vec2 uv) { return mix(color, vec4(1.0), uIntensity); }";

const img = (name) => {
	return { name, type: "image", src: PNG };
};
const json = (name) => {
	return { name, type: "json", src: JSON_URL };
};

/** a minimal Tiled map, inline */
const MAP = {
	type: "map",
	version: "1.10",
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	width: 1,
	height: 1,
	tilewidth: 16,
	tileheight: 16,
	nextlayerid: 2,
	nextobjectid: 1,
	layers: [],
	tilesets: [],
};

const flush = () => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

/** record LOADER_PROGRESS / LOADER_COMPLETE while `run` settles */
const recordEvents = async (run) => {
	const progress = [];
	const complete = vi.fn();
	const onProgress = (value) => {
		progress.push(value);
	};
	event.on(event.LOADER_PROGRESS, onProgress);
	event.on(event.LOADER_COMPLETE, complete);
	try {
		await run();
	} finally {
		event.off(event.LOADER_PROGRESS, onProgress);
		event.off(event.LOADER_COMPLETE, complete);
	}
	return { progress, completes: complete.mock.calls.length };
};

describe("loader backward compatibility", () => {
	const flaky = { fails: true };

	beforeAll(async () => {
		await boot();
		await getWebGLRenderer(64, 64);
		audio.init("mp3,ogg");
		loader.setParser("compat-flaky", (asset, onload, onerror) => {
			setTimeout(() => {
				if (flaky.fails) {
					onerror(new Error("compat-flaky"));
				} else {
					onload();
				}
			}, 0);
			return 1;
		});
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await flush();
		loader.unloadAll();
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	describe("preload", () => {
		it("preload(array, cb): the callback once, progress per asset, LOADER_COMPLETE once, the loading screen", async () => {
			const change = vi.spyOn(state, "change").mockImplementation(() => {});
			const cb = vi.fn();
			const events = await recordEvents(() => {
				return loader.preload([img("c-p1"), img("c-p2")], cb);
			});
			expect(cb).toHaveBeenCalledTimes(1);
			expect(events.progress).toEqual([0.5, 1]);
			expect(events.completes).toBe(1);
			expect(change).toHaveBeenCalledTimes(1);
			expect(change).toHaveBeenCalledWith(state.LOADING);
		});

		it("preload(array) awaited resolves with undefined once everything is in", async () => {
			vi.spyOn(state, "change").mockImplementation(() => {});
			const result = await loader.preload([img("c-a1"), json("c-a2")]);
			expect(result).toBeUndefined();
			expect(loader.getImage("c-a1")).not.toBeNull();
			expect(loader.getJSON("c-a2")).toEqual({ ok: true, n: 42 });
		});

		it("preload(array, cb, false) does not switch to the loading screen", async () => {
			const change = vi.spyOn(state, "change");
			const cb = vi.fn();
			const events = await recordEvents(() => {
				return loader.preload([img("c-f1")], cb, false);
			});
			expect(change).not.toHaveBeenCalled();
			expect(cb).toHaveBeenCalledTimes(1);
			expect(events.progress).toEqual([1]);
			expect(events.completes).toBe(1);
		});

		it("a descriptor listed twice is loaded as two steps, as before", async () => {
			const events = await recordEvents(() => {
				return loader.preload(
					[img("c-twice"), img("c-twice")],
					undefined,
					false,
				);
			});
			expect(events.progress).toEqual([0.5, 1]);
		});

		it("a failing asset rejects with the loader's message, and LOADER_ERROR names it", async () => {
			const errors = [];
			const onError = (res) => {
				errors.push(res.name);
			};
			event.on(event.LOADER_ERROR, onError);
			try {
				await expect(
					loader.preload(
						[
							{
								name: "c-bad",
								type: "image",
								src: "data:image/png;base64,Zm9v",
							},
						],
						undefined,
						false,
					),
				).rejects.toThrow(/Failed loading resource/);
			} finally {
				event.off(event.LOADER_ERROR, onError);
			}
			expect(errors).toEqual(["c-bad"]);
		});

		it("an unknown asset type throws synchronously", () => {
			expect(() => {
				loader.preload([{ name: "c-x", type: "nope" }], undefined, false);
			}).toThrow(/unknown or invalid resource type : nope/);
		});
	});

	describe("load", () => {
		it("load(asset, onload, onerror) returns the resource count, and calls onload", async () => {
			const onload = vi.fn();
			const onerror = vi.fn();
			const count = loader.load(img("c-l1"), onload, onerror);
			expect(count).toBe(1);
			await vi.waitFor(() => {
				expect(onload).toHaveBeenCalledTimes(1);
			});
			expect(onerror).not.toHaveBeenCalled();
			// cached now: 0, and no callback comes for it
			const again = vi.fn();
			expect(loader.load(img("c-l1"), again, onerror)).toBe(0);
			await flush();
			expect(again).not.toHaveBeenCalled();
		});

		it("load(asset) returns a promise, and a cached asset resolves without a request", async () => {
			const loading = loader.load(json("c-l2"));
			expect(loading).toBeInstanceOf(Promise);
			await loading;
			const spy = vi.spyOn(globalThis, "fetch");
			await loader.load(json("c-l2"));
			expect(spy).not.toHaveBeenCalled();
		});

		it("an unknown type throws synchronously", () => {
			expect(() => {
				loader.load({ name: "c-x", type: "nope" });
			}).toThrow(/unknown or invalid resource type : nope/);
		});
	});

	describe("unload returns what it always has, for every type", () => {
		it("image, json, binary, tmx and tsx: true when present, false when absent", async () => {
			await loader.preload(
				[
					img("c-u-img"),
					json("c-u-json"),
					{ name: "c-u-bin", type: "binary", src: "/data/misc/plain.bin" },
					{ name: "c-u-tmx", type: "tmx", data: MAP },
					{ name: "c-u-tsx", type: "tsx", data: { name: "ts" } },
				],
				undefined,
				false,
			);
			for (const [name, type, get] of [
				["c-u-img", "image", loader.getImage],
				["c-u-json", "json", loader.getJSON],
				["c-u-bin", "binary", loader.getBinary],
				["c-u-tmx", "tmx", loader.getTMX],
				["c-u-tsx", "tsx", loader.getTMX],
			]) {
				expect(get(name)).not.toBeNull();
				expect(loader.unload({ name, type })).toBe(true);
				expect(get(name)).toBeNull();
				expect(loader.unload({ name, type })).toBe(false);
			}
		});

		it("obj and mtl", async () => {
			await loader.preload(
				[
					{ name: "c-u-cube", type: "obj", src: "/data/models/single.obj" },
					{ name: "c-u-cube", type: "mtl", src: "/data/models/cube.mtl" },
				],
				undefined,
				false,
			);
			expect(loader.unload({ name: "c-u-cube", type: "obj" })).toBe(true);
			expect(loader.getOBJ("c-u-cube")).toBeNull();
			expect(loader.unload({ name: "c-u-cube", type: "obj" })).toBe(false);
			expect(loader.unload({ name: "c-u-cube", type: "mtl" })).toBe(true);
			expect(loader.getMTL("c-u-cube")).toBeNull();
			expect(loader.unload({ name: "c-u-cube", type: "mtl" })).toBe(false);
		});

		it("gltf and glb share a cache", () => {
			gltfList["c-u-scene"] = { nodes: [] };
			expect(loader.getGLTF("c-u-scene")).not.toBeNull();
			expect(loader.unload({ name: "c-u-scene", type: "glb" })).toBe(true);
			expect(loader.unload({ name: "c-u-scene", type: "gltf" })).toBe(false);
		});

		it("video", () => {
			videoList["c-u-video"] = document.createElement("video");
			expect(loader.getVideo("c-u-video")).not.toBeNull();
			expect(loader.unload({ name: "c-u-video", type: "video" })).toBe(true);
			expect(loader.getVideo("c-u-video")).toBeNull();
			expect(loader.unload({ name: "c-u-video", type: "video" })).toBe(false);
		});

		it("fontface: out of the cache and out of the document", () => {
			const face = new FontFace("c-u-font", "url(x.woff2)");
			fontList["c-u-font"] = face;
			document.fonts.add(face);
			expect(loader.getFont("c-u-font")).toBe(face);
			expect(loader.unload({ name: "c-u-font", type: "fontface" })).toBe(true);
			expect(document.fonts.has(face)).toBe(false);
			expect(loader.getFont("c-u-font")).toBeNull();
			expect(loader.unload({ name: "c-u-font", type: "fontface" })).toBe(false);
		});

		it("aseprite: either half present counts", () => {
			imgList["c-u-ase"] = document.createElement("canvas");
			jsonList["c-u-ase"] = {};
			expect(loader.unload({ name: "c-u-ase", type: "aseprite" })).toBe(true);
			expect(loader.getImage("c-u-ase")).toBeNull();
			expect(loader.getJSON("c-u-ase")).toBeNull();
			expect(loader.unload({ name: "c-u-ase", type: "aseprite" })).toBe(false);
			jsonList["c-u-ase"] = {};
			expect(loader.unload({ name: "c-u-ase", type: "aseprite" })).toBe(true);
		});

		it("audio", async () => {
			await loader.preload(
				[{ name: "silence", type: "audio", src: "/data/sfx/" }],
				undefined,
				false,
			);
			expect(loader.unload({ name: "silence", type: "audio" })).toBe(true);
			expect(() => {
				audio.play("silence");
			}).toThrow(/does not exist/);
			expect(loader.unload({ name: "silence", type: "audio" })).toBe(false);
		});

		it("shader: the shared effect is destroyed", async () => {
			await loader.load({ name: "c-u-fx", type: "shader", data: FLASH });
			const fx = loader.getShader("c-u-fx");
			expect(fx).not.toBeNull();
			expect(loader.unload({ name: "c-u-fx", type: "shader" })).toBe(true);
			expect(fx.destroyed).toBe(true);
			expect(loader.getShader("c-u-fx")).toBeNull();
			expect(loader.unload({ name: "c-u-fx", type: "shader" })).toBe(false);
		});

		it("js: always true, nothing is cached for a script", () => {
			expect(loader.unload({ name: "c-u-js", type: "js" })).toBe(true);
		});

		it("an unknown type still throws", () => {
			expect(() => {
				loader.unload({ name: "c-u-x", type: "nope" });
			}).toThrow(/unload : unknown or invalid resource type : nope/);
		});
	});

	describe("the rest", () => {
		it("unloadAll clears every cache and the audio", async () => {
			await loader.preload(
				[
					img("c-all-img"),
					json("c-all-json"),
					{ name: "c-all-tmx", type: "tmx", data: MAP },
					{ name: "silence", type: "audio", src: "/data/sfx/" },
				],
				undefined,
				false,
			);
			loader.unloadAll();
			expect(loader.getImage("c-all-img")).toBeNull();
			expect(loader.getJSON("c-all-json")).toBeNull();
			expect(loader.getTMX("c-all-tmx")).toBeNull();
			expect(loader.unload({ name: "silence", type: "audio" })).toBe(false);
		});

		it("reload(src) completes the preload an asset failed in, with that preload's callback", async () => {
			flaky.fails = true;
			const cb = vi.fn();
			await expect(
				loader.preload(
					[
						img("c-r-ok"),
						{ name: "c-r-flaky", type: "compat-flaky", src: "compat://r" },
					],
					cb,
					false,
				),
			).rejects.toThrow(/Failed loading resource compat:\/\/r/);
			// the retry completes the preload once nothing else of it is pending
			await vi.waitFor(() => {
				expect(loader.getImage("c-r-ok")).not.toBeNull();
			});
			flaky.fails = false;
			const events = await recordEvents(async () => {
				loader.reload("compat://r");
				await vi.waitFor(() => {
					expect(cb).toHaveBeenCalledTimes(1);
				});
			});
			expect(events.progress).toEqual([1]);
			expect(events.completes).toBe(1);
		});

		it("a custom type is parsed with (asset, onload, onerror, settings) and keeps nothing", async () => {
			const seen = [];
			loader.setParser("compat-custom", (asset, onload, onerror, settings) => {
				seen.push([asset.name, typeof onload, typeof onerror, typeof settings]);
				onload();
				return 1;
			});
			await loader.preload(
				[{ name: "c-c", type: "compat-custom" }],
				undefined,
				false,
			);
			expect(seen).toEqual([["c-c", "function", "function", "object"]]);
			expect(loader.getImage("c-c")).toBeNull();
		});

		it("the getters return the loaded objects, and null for what is not there", async () => {
			await loader.preload(
				[
					img("c-g-img"),
					json("c-g-json"),
					{ name: "c-g-tmx", type: "tmx", data: MAP },
				],
				undefined,
				false,
			);
			expect(loader.getImage("c-g-img")).toBe(imgList["c-g-img"]);
			// getImage takes a path too, and reads its base name
			expect(loader.getImage("some/dir/c-g-img.png")).toBe(imgList["c-g-img"]);
			expect(loader.getJSON("c-g-json")).toEqual({ ok: true, n: 42 });
			expect(loader.getTMX("c-g-tmx")).toBe(MAP);
			for (const get of [
				loader.getImage,
				loader.getJSON,
				loader.getTMX,
				loader.getBinary,
				loader.getShader,
				loader.getFont,
				loader.getVideo,
				loader.getOBJ,
				loader.getMTL,
				loader.getGLTF,
			]) {
				expect(get("c-g-missing")).toBeNull();
			}
		});
	});
});
