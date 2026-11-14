import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { audio, boot, event, game, level, loader } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Named asset bundles (#1656), pushed at their edges: ids that are also asset
 * names, one name under two types, duplicates, empty bundles, assets shared
 * and then unloaded from under their bundles, unloads repeated or of bundles
 * never loaded, a missing file, audio, GPU programs and glTF levels.
 *
 * The rules these hold the loader to:
 * - an empty bundle is allowed: it loads at once and is always loaded;
 * - an asset is identified by its type and name, so the same name under two
 *   types is two assets, and a descriptor listed twice is one;
 * - unloading a bundle that is not loaded (never loaded, or unloaded already)
 *   returns false and frees nothing; ownership is a set, never a count, so it
 *   cannot go negative;
 * - `unload(asset)` drops every owner of the asset; a bundle loaded again
 *   fetches it again and owns it alone.
 */

const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const JSON_URL = "/data/misc/plain.json";
const MISSING_URL = "/data/misc/no-such-file.json";
const FLASH =
	"uniform float uIntensity;\nvec4 apply(vec4 color, vec2 uv) { return mix(color, vec4(1.0), uIntensity); }";

const img = (name) => {
	return { name, type: "image", src: PNG };
};
const json = (name, src = JSON_URL) => {
	return { name, type: "json", src };
};
const shader = (name) => {
	return { name, type: "shader", data: FLASH };
};
const sound = (name) => {
	return { name, type: "audio", src: "/data/sfx/" };
};
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
			width: 1,
			height: 1,
			tilewidth: 16,
			tileheight: 16,
			nextlayerid: 1,
			nextobjectid: 1,
			layers: [],
			tilesets: [],
		},
	};
};
/** the smallest glTF scene: one empty scene, as a data URI */
const gltf = (name) => {
	const scene = {
		asset: { version: "2.0" },
		scene: 0,
		scenes: [{ nodes: [] }],
		nodes: [],
	};
	return {
		name,
		type: "gltf",
		src: `data:model/gltf+json;base64,${btoa(JSON.stringify(scene))}`,
	};
};

const requestsFor = (spy, url) => {
	return spy.mock.calls.filter(([input]) => {
		return String(input).includes(url);
	}).length;
};

/** whether a level is registered: loads it, or meets the synchronous "not found" */
const levelExists = async (id) => {
	try {
		await level.load(id, { async: true });
		return true;
	} catch (error) {
		if (/not found/.test(error.message)) {
			return false;
		}
		throw error;
	}
};

describe("loader bundles: edge cases", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		renderer = await getWebGLRenderer(64, 64);
		audio.init("mp3,ogg");
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
		loader.unloadAll();
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	describe("names and ids", () => {
		it("a bundle id that is also an asset name: the string unloads the bundle, the descriptor the asset", async () => {
			loader.setBundle("ad-map", [tmx("ad-map"), img("ad-map-img")]);
			await loader.load("ad-map");
			expect(await levelExists("ad-map")).toBe(true);

			// the descriptor form frees the map only, and leaves its level
			expect(loader.unload({ name: "ad-map", type: "tmx" })).toBe(true);
			expect(loader.getTMX("ad-map")).toBeNull();
			expect(loader.getImage("ad-map-img")).not.toBeNull();
			expect(await levelExists("ad-map")).toBe(true);
			expect(loader.isLoaded("ad-map")).toBe(false);

			// the bundle loads it back, then the id form frees it all
			await loader.load("ad-map");
			expect(loader.isLoaded("ad-map")).toBe(true);
			expect(loader.unload("ad-map")).toBe(true);
			expect(loader.getTMX("ad-map")).toBeNull();
			expect(loader.getImage("ad-map-img")).toBeNull();
			expect(await levelExists("ad-map")).toBe(false);
		});

		it("a string is never read as an asset name: an id with no bundle throws even if an asset has that name", async () => {
			await loader.load(img("ad-name-only"));
			expect(() => {
				loader.load("ad-name-only");
			}).toThrow(/unknown bundle "ad-name-only"/);
			expect(() => {
				loader.unload("ad-name-only");
			}).toThrow(/unknown bundle/);
			expect(loader.getImage("ad-name-only")).not.toBeNull();
		});

		it("one name under two types is two assets, in one bundle or across two", async () => {
			loader.setBundle("ad-tex", [json("ad-tex"), img("ad-tex")]);
			await loader.load("ad-tex");
			expect(loader.getJSON("ad-tex")).not.toBeNull();
			expect(loader.getImage("ad-tex")).not.toBeNull();
			loader.unload("ad-tex");
			expect(loader.getJSON("ad-tex")).toBeNull();
			expect(loader.getImage("ad-tex")).toBeNull();

			loader.setBundle("ad-tex-json", [json("ad-tex2")]);
			loader.setBundle("ad-tex-img", [img("ad-tex2")]);
			await loader.load("ad-tex-json");
			await loader.load("ad-tex-img");
			loader.unload("ad-tex-json");
			expect(loader.getJSON("ad-tex2")).toBeNull();
			expect(loader.getImage("ad-tex2")).not.toBeNull();
			expect(loader.isLoaded("ad-tex-img")).toBe(true);
		});

		it("a descriptor listed twice in a bundle is one asset: one request, one progress step, one free", async () => {
			const spy = vi.spyOn(globalThis, "fetch");
			const progress = [];
			const onProgress = (value) => {
				progress.push(value);
			};
			loader.setBundle("ad-dup", [json("ad-dup"), json("ad-dup")]);
			event.on(event.LOADER_PROGRESS, onProgress);
			try {
				await loader.load("ad-dup");
			} finally {
				event.off(event.LOADER_PROGRESS, onProgress);
			}
			expect(requestsFor(spy, JSON_URL)).toBe(1);
			expect(progress).toEqual([1]);
			expect(loader.unload("ad-dup")).toBe(true);
			expect(loader.getJSON("ad-dup")).toBeNull();
			expect(loader.unload("ad-dup")).toBe(false);
		});

		it("an empty bundle is allowed: it loads at once and is always loaded", async () => {
			const complete = vi.fn();
			loader.setBundle("ad-empty", []);
			expect(loader.isLoaded("ad-empty")).toBe(true);
			event.on(event.LOADER_COMPLETE, complete);
			try {
				await loader.load("ad-empty");
			} finally {
				event.off(event.LOADER_COMPLETE, complete);
			}
			expect(complete).toHaveBeenCalledTimes(1);
			expect(loader.unload("ad-empty")).toBe(true);
			expect(loader.unload("ad-empty")).toBe(false);
		});
	});

	describe("unloading what is not loaded, and ownership", () => {
		it("a bundle declared but never loaded: unload returns false and frees nothing", async () => {
			await loader.load(img("ad-never"));
			loader.setBundle("ad-never", [img("ad-never")]);
			expect(loader.unload("ad-never")).toBe(false);
			expect(loader.getImage("ad-never")).not.toBeNull();
		});

		it("A and B share X; unload(A), then unload(X) directly, then load(B): X is fetched again and B owns it alone", async () => {
			const spy = vi.spyOn(globalThis, "fetch");
			loader.setBundle("ad-a", [json("ad-x"), img("ad-a-own")]);
			loader.setBundle("ad-b", [json("ad-x")]);
			await loader.load("ad-a");
			await loader.load("ad-b");
			expect(requestsFor(spy, JSON_URL)).toBe(1);

			loader.unload("ad-a");
			expect(loader.getJSON("ad-x")).not.toBeNull();
			expect(loader.unload(json("ad-x"))).toBe(true);
			expect(loader.isLoaded("ad-b")).toBe(false);

			await loader.load("ad-b");
			expect(requestsFor(spy, JSON_URL)).toBe(2);
			expect(loader.isLoaded("ad-b")).toBe(true);
			expect(loader.unload("ad-b")).toBe(true);
			expect(loader.getJSON("ad-x")).toBeNull();
			// nothing left over: unloading again does nothing, and A loaded
			// again fetches X once more and frees it alone
			expect(loader.unload("ad-b")).toBe(false);
			await loader.load("ad-a");
			expect(requestsFor(spy, JSON_URL)).toBe(3);
			loader.unload("ad-a");
			expect(loader.getJSON("ad-x")).toBeNull();
		});

		it("after unloadAll, isLoaded is false and loading again fetches again", async () => {
			const spy = vi.spyOn(globalThis, "fetch");
			loader.setBundle("ad-all", [json("ad-all")]);
			await loader.load("ad-all");
			loader.unloadAll();
			expect(loader.isLoaded("ad-all")).toBe(false);
			expect(loader.unload("ad-all")).toBe(false);
			await loader.load("ad-all");
			expect(requestsFor(spy, JSON_URL)).toBe(2);
			expect(loader.isLoaded("ad-all")).toBe(true);
		});
	});

	describe("a missing file", () => {
		it("rejects load(id); the rest stays, held by the bundle, and unload frees it", async () => {
			loader.setBundle("ad-404", [
				json("ad-404-ok"),
				json("ad-404-gone", MISSING_URL),
			]);
			await expect(loader.load("ad-404")).rejects.toThrow(
				/Failed loading resource \/data\/misc\/no-such-file.json/,
			);
			await vi.waitFor(() => {
				expect(loader.getJSON("ad-404-ok")).not.toBeNull();
			});
			expect(loader.isLoaded("ad-404")).toBe(false);
			// still a bundle in use: it cannot be redefined until unloaded
			expect(() => {
				loader.setBundle("ad-404", []);
			}).toThrow(/loaded/);
			expect(loader.unload("ad-404")).toBe(true);
			expect(loader.getJSON("ad-404-ok")).toBeNull();
		});
	});

	describe("audio", () => {
		it("a clip two bundles share plays until the last of them is unloaded", async () => {
			loader.setBundle("ad-snd-1", [sound("silence")]);
			loader.setBundle("ad-snd-2", [sound("silence")]);
			await loader.load("ad-snd-1");
			await loader.load("ad-snd-2");
			loader.unload("ad-snd-1");
			expect(() => {
				audio.stop("silence");
			}).not.toThrow();
			loader.unload("ad-snd-2");
			expect(() => {
				audio.play("silence");
			}).toThrow(/does not exist/);
		});
	});

	describe("shaders", () => {
		it("a GPU program two bundles share is deleted with the last of them, and never for a pinned one", async (ctx) => {
			requireWebGL(ctx, renderer);
			const deleteProgram = vi.spyOn(renderer.gl, "deleteProgram");
			// by identity: every WebGLProgram compares deeply equal
			const deleted = (target) => {
				return deleteProgram.mock.calls.some(([p]) => {
					return p === target;
				});
			};
			loader.setBundle("ad-fx-1", [shader("ad-fx")]);
			loader.setBundle("ad-fx-2", [shader("ad-fx")]);
			await loader.load("ad-fx-1");
			await loader.load("ad-fx-2");
			const program = loader.getShader("ad-fx")._shader.program;

			loader.unload("ad-fx-1");
			expect(deleted(program)).toBe(false);
			expect(renderer.gl.isProgram(program)).toBe(true);
			loader.unload("ad-fx-2");
			expect(deleted(program)).toBe(true);

			// loaded the old way: no bundle unload deletes it
			await loader.preload([shader("ad-fx-pinned")], undefined, false);
			const pinned = loader.getShader("ad-fx-pinned")._shader.program;
			loader.setBundle("ad-fx-3", [shader("ad-fx-pinned")]);
			await loader.load("ad-fx-3");
			loader.unload("ad-fx-3");
			expect(deleted(pinned)).toBe(false);
			expect(renderer.gl.isProgram(pinned)).toBe(true);
		});
	});

	describe("levels", () => {
		it("a glTF scene's level is unregistered with its bundle, and registered again with it", async () => {
			loader.setBundle("ad-scene", [gltf("ad-scene")]);
			await loader.load("ad-scene");
			expect(loader.getGLTF("ad-scene")).not.toBeNull();
			expect(await levelExists("ad-scene")).toBe(true);
			loader.unload("ad-scene");
			expect(loader.getGLTF("ad-scene")).toBeNull();
			expect(await levelExists("ad-scene")).toBe(false);
			await loader.load("ad-scene");
			expect(await levelExists("ad-scene")).toBe(true);
		});

		it("load(id, assets) and preload(record) register their maps' levels, and unload(id) unregisters them", async () => {
			await loader.load("ad-def", [tmx("ad-def-map")]);
			await loader.preload({ "ad-rec": [tmx("ad-rec-map")] }, undefined, false);
			expect(await levelExists("ad-def-map")).toBe(true);
			expect(await levelExists("ad-rec-map")).toBe(true);
			loader.unload("ad-def");
			loader.unload("ad-rec");
			expect(await levelExists("ad-def-map")).toBe(false);
			expect(await levelExists("ad-rec-map")).toBe(false);
		});

		it("unloading the current level's bundle keeps the world running", async () => {
			loader.setBundle("ad-cur", [tmx("ad-cur")]);
			await loader.load("ad-cur");
			await level.load("ad-cur", { async: true });
			loader.unload("ad-cur");
			expect(level.getCurrentLevelId()).toBeUndefined();
			// the world still updates and draws
			expect(() => {
				game.world.update(16);
				game.world.draw(renderer ?? game.renderer, game.viewport);
			}).not.toThrow();
			// and loading another level works as usual
			await loader.load("ad-next", [tmx("ad-next")]);
			await expect(level.load("ad-next", { async: true })).resolves.toBe(true);
			expect(level.getCurrentLevelId()).toBe("ad-next");
		});
	});
});
