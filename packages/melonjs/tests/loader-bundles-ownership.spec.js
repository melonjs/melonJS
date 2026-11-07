import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	boot,
	game,
	loader,
	ShaderEffect,
	WebGLRenderer,
} from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Who owns an asset loaded through bundles (#1656).
 *
 * Each LOADED bundle that lists an asset is one owner of it; unloading a bundle
 * frees each of its assets that no other loaded bundle lists. An asset loaded
 * the old way — `preload` / `load` with a descriptor — is PINNED: no bundle
 * unload frees it. `unload(asset)` with a descriptor still frees at once,
 * whoever owns it, and the bundles listing it then report not loaded, and fetch
 * it again when loaded again.
 *
 * A bundle never fetches what is already in memory, including for types whose
 * parser would fetch again (binary), and bundles loading the same asset at the
 * same time share one request. These count real requests: `fetch` is spied on,
 * not stubbed, and the files are served from tests/public.
 */

const JSON_URL = "/data/misc/plain.json";
const BIN_URL = "/data/misc/plain.bin";
const PNG_URL = "/data/img/rect.png";

const img = (name, src = PNG_URL) => {
	return { name, type: "image", src };
};
const json = (name) => {
	return { name, type: "json", src: JSON_URL };
};
const bin = (name) => {
	return { name, type: "binary", src: BIN_URL };
};

const FLASH =
	"uniform float uIntensity;\nvec4 apply(vec4 color, vec2 uv) { return mix(color, vec4(1.0), uIntensity); }";
const shader = (name) => {
	return { name, type: "shader", data: FLASH };
};

/** how many requests went out for a url */
const requestsFor = (spy, url) => {
	return spy.mock.calls.filter(([input]) => {
		return String(input).includes(url);
	}).length;
};

describe("loader bundles: ownership", () => {
	let renderer;
	let fetchSpy;

	beforeAll(async () => {
		await boot();
		renderer = await getWebGLRenderer(64, 64);
	});

	afterEach(() => {
		fetchSpy?.mockRestore();
		fetchSpy = undefined;
		loader.unloadAll();
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const countRequests = () => {
		// spied on, not stubbed: the requests really go out
		fetchSpy = vi.spyOn(globalThis, "fetch");
		return fetchSpy;
	};

	it("an asset two bundles share survives unloading the first, and is freed with the last", async () => {
		loader.setBundle("sh-1", [img("sh-shared"), img("sh-only1")]);
		loader.setBundle("sh-2", [img("sh-shared"), json("sh-only2")]);
		await loader.load("sh-1");
		await loader.load("sh-2");
		const shared = loader.getImage("sh-shared");

		expect(loader.unload("sh-1")).toBe(true);
		expect(loader.getImage("sh-only1")).toBeNull();
		// still held by sh-2, and the same object
		expect(loader.getImage("sh-shared")).toBe(shared);
		expect(loader.isLoaded("sh-2")).toBe(true);
		expect(loader.isLoaded("sh-1")).toBe(false);

		expect(loader.unload("sh-2")).toBe(true);
		expect(loader.getImage("sh-shared")).toBeNull();
		expect(loader.getJSON("sh-only2")).toBeNull();
	});

	it("an asset loaded the old way is pinned: no bundle unload frees it, unload(asset) does", async () => {
		await loader.preload([img("pn-pre")], undefined, false);
		await loader.load(json("pn-load"));
		await new Promise((resolve) => {
			loader.load(img("pn-cb"), resolve, resolve);
		});
		loader.setBundle("pn-1", [img("pn-pre"), json("pn-load"), img("pn-cb")]);
		loader.setBundle("pn-2", [img("pn-pre")]);
		await loader.load("pn-1");
		await loader.load("pn-2");

		loader.unload("pn-1");
		loader.unload("pn-2");
		expect(loader.getImage("pn-pre")).not.toBeNull();
		expect(loader.getJSON("pn-load")).not.toBeNull();
		expect(loader.getImage("pn-cb")).not.toBeNull();

		// pinned the other way round too: loaded old-style after the bundle
		loader.setBundle("pn-3", [img("pn-late")]);
		await loader.load("pn-3");
		await loader.load(img("pn-late"));
		loader.unload("pn-3");
		expect(loader.getImage("pn-late")).not.toBeNull();

		expect(loader.unload(img("pn-pre"))).toBe(true);
		expect(loader.getImage("pn-pre")).toBeNull();
	});

	it("unload(asset) frees at once: the bundle reports not loaded, and loading it again fetches it again", async () => {
		const spy = countRequests();
		loader.setBundle("ua-1", [json("ua-json"), img("ua-img")]);
		loader.setBundle("ua-2", [json("ua-json")]);
		await loader.load("ua-1");
		await loader.load("ua-2");
		expect(requestsFor(spy, JSON_URL)).toBe(1);

		// owned by two bundles, freed all the same
		expect(loader.unload(json("ua-json"))).toBe(true);
		expect(loader.getJSON("ua-json")).toBeNull();
		expect(loader.isLoaded("ua-1")).toBe(false);
		expect(loader.isLoaded("ua-2")).toBe(false);

		await loader.load("ua-1");
		expect(requestsFor(spy, JSON_URL)).toBe(2);
		expect(loader.isLoaded("ua-1")).toBe(true);
		// only ua-1 owns it now: ua-2 lost it to unload(asset)
		loader.unload("ua-1");
		expect(loader.getJSON("ua-json")).toBeNull();
	});

	it("a bundle fetches nothing that is already in memory, even for a type whose parser would", async () => {
		await loader.load(json("rs-json"));
		await loader.load(bin("rs-bin"));
		await loader.load(img("rs-img"));
		const spy = countRequests();
		loader.setBundle("rs", [json("rs-json"), bin("rs-bin"), img("rs-img")]);
		await loader.load("rs");
		expect(spy).not.toHaveBeenCalled();
		expect(loader.isLoaded("rs")).toBe(true);
	});

	it("one bundle loaded twice, in turn or at once, fetches each asset once", async () => {
		const spy = countRequests();
		loader.setBundle("tw", [json("tw-json"), bin("tw-bin")]);
		await Promise.all([loader.load("tw"), loader.load("tw")]);
		await loader.load("tw");
		await loader.preload(["tw", "tw"], undefined, false);
		expect(requestsFor(spy, JSON_URL)).toBe(1);
		expect(requestsFor(spy, BIN_URL)).toBe(1);
		// still one owner: one unload frees
		loader.unload("tw");
		expect(loader.getJSON("tw-json")).toBeNull();
	});

	it("overlapping bundles loaded at the same time share one request, and both own the asset", async () => {
		const spy = countRequests();
		loader.setBundle("ov-1", [bin("ov-shared"), img("ov-1-img")]);
		loader.setBundle("ov-2", [bin("ov-shared"), json("ov-2-json")]);
		await Promise.all([loader.load("ov-1"), loader.load("ov-2")]);
		expect(requestsFor(spy, BIN_URL)).toBe(1);

		loader.unload("ov-1");
		expect(loader.getBinary("ov-shared")).not.toBeNull();
		loader.unload("ov-2");
		expect(loader.getBinary("ov-shared")).toBeNull();
	});

	it("a bundle unloaded while loading frees its assets as they arrive, unless another bundle holds them", async () => {
		loader.setBundle("ul-1", [img("ul-shared"), json("ul-only")]);
		loader.setBundle("ul-2", [img("ul-shared")]);
		const first = loader.load("ul-1");
		const second = loader.load("ul-2");
		// released before anything has arrived
		expect(loader.unload("ul-1")).toBe(true);
		await Promise.all([first, second]);

		expect(loader.getJSON("ul-only")).toBeNull();
		expect(loader.getImage("ul-shared")).not.toBeNull();
		expect(loader.isLoaded("ul-2")).toBe(true);
		loader.unload("ul-2");
		expect(loader.getImage("ul-shared")).toBeNull();
	});

	describe("shaders", () => {
		it("a bundle's shader is compiled when the bundle loads, before any draw", async (ctx) => {
			requireWebGL(ctx, renderer);
			expect(game.renderer).toBeInstanceOf(WebGLRenderer);
			loader.setBundle("sd-warm", [shader("sd-warm-fx")]);
			await loader.load("sd-warm");
			const fx = loader.getShader("sd-warm-fx");
			expect(fx).toBeInstanceOf(ShaderEffect);
			expect(fx._shader.program).toBeTruthy();
			expect(renderer.gl.isProgram(fx._shader.program)).toBe(true);
		});

		it("a shader two bundles share keeps its GPU program until the last of them is unloaded", async (ctx) => {
			requireWebGL(ctx, renderer);
			loader.setBundle("sd-1", [shader("sd-fx")]);
			loader.setBundle("sd-2", [shader("sd-fx")]);
			await loader.load("sd-1");
			await loader.load("sd-2");
			const fx = loader.getShader("sd-fx");
			const program = fx._shader.program;

			loader.unload("sd-1");
			expect(fx.destroyed).not.toBe(true);
			expect(renderer.gl.isProgram(program)).toBe(true);
			expect(loader.getShader("sd-fx")).toBe(fx);

			loader.unload("sd-2");
			expect(fx.destroyed).toBe(true);
			expect(loader.getShader("sd-fx")).toBeNull();
			expect(renderer.gl.isProgram(program)).toBe(false);
		});

		it("a shader loaded the old way survives the bundle unload", async (ctx) => {
			requireWebGL(ctx, renderer);
			await loader.load(shader("sd-pinned"));
			loader.setBundle("sd-p", [shader("sd-pinned")]);
			await loader.load("sd-p");
			const fx = loader.getShader("sd-pinned");
			loader.unload("sd-p");
			expect(fx.destroyed).not.toBe(true);
			expect(loader.getShader("sd-pinned")).toBe(fx);
		});
	});
});
