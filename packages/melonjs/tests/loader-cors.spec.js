import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, loader } from "../src/index.js";
import { fetchData } from "../src/utils/fetchdata.js";

/**
 * Asset requests are always made in CORS mode.
 *
 * `fetchData` used "no-cors" unless `crossOrigin: "anonymous"` was set. A
 * "no-cors" request to another origin comes back opaque (status 0, an empty
 * body), which `fetchData` took for a success, so the asset broke later with
 * an unrelated error ("Unexpected end of input" for JSON, "The source image
 * could not be decoded" for an image), even from a server that allows the
 * request. Every request is now a CORS request: an asset on another origin
 * loads when its server allows it, and fails at the request, with an error
 * naming it, when not. `crossOrigin: "use-credentials"` sends credentials, as
 * it does on an element.
 */

/** stub `fetch`, answering every request with a small JSON body */
const stubFetch = () => {
	return vi.spyOn(globalThis, "fetch").mockResolvedValue({
		ok: true,
		status: 200,
		json: () => {
			return Promise.resolve({ ok: 1 });
		},
	});
};

/** the options of the request a stubbed `fetch` was last called with */
const requestOf = (spy) => {
	return spy.mock.calls.at(-1)[1];
};

describe("asset requests are CORS requests", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("the request", () => {
		it.each([
			["by default", {}],
			['with crossOrigin ""', { crossOrigin: "" }],
			['with crossOrigin "anonymous"', { crossOrigin: "anonymous" }],
			[
				'with crossOrigin "use-credentials"',
				{ crossOrigin: "use-credentials" },
			],
			["with withCredentials", { withCredentials: true }],
		])("is made in CORS mode %s", async (_name, settings) => {
			const spy = stubFetch();
			await fetchData("https://cdn.example.com/level.json", "json", settings);
			expect(requestOf(spy).mode).toBe("cors");
		});

		it.each([
			["by default", "same-origin", {}],
			[
				'with crossOrigin "anonymous"',
				"same-origin",
				{ crossOrigin: "anonymous" },
			],
			[
				'with crossOrigin "use-credentials"',
				"include",
				{ crossOrigin: "use-credentials" },
			],
			["with withCredentials", "include", { withCredentials: true }],
		])("carries credentials %s: %s", async (_name, credentials, settings) => {
			const spy = stubFetch();
			await fetchData("https://cdn.example.com/level.json", "json", settings);
			expect(requestOf(spy).credentials).toBe(credentials);
		});
	});

	describe("a request that fails", () => {
		it("rejects with an error naming the asset and why, keeping the cause", async () => {
			const cause = new TypeError("Failed to fetch");
			vi.spyOn(globalThis, "fetch").mockRejectedValue(cause);
			const error = await fetchData(
				"https://cdn.example.com/level.json",
				"json",
			).catch((e) => {
				return e;
			});
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toContain('"https://cdn.example.com/level.json"');
			expect(error.message).toContain("Failed to fetch");
			expect(error.message).toContain("Access-Control-Allow-Origin");
			expect(error.cause).toBe(cause);
		});

		it("does not take a status 0 response for a success", async () => {
			// what an opaque "no-cors" response looked like
			vi.spyOn(globalThis, "fetch").mockResolvedValue({
				ok: false,
				status: 0,
				statusText: "",
				type: "opaque",
				json: () => {
					return Promise.reject(new SyntaxError("Unexpected end of input"));
				},
			});
			await expect(
				fetchData("https://cdn.example.com/level.json", "json"),
			).rejects.toThrow(/Network response was not ok: 0/);
		});

		it("still rejects an HTTP error status", async () => {
			vi.spyOn(globalThis, "fetch").mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
			});
			await expect(fetchData("data/missing.json", "json")).rejects.toThrow(
				/404 Not Found/,
			);
		});
	});

	describe("real requests, through the loader", () => {
		beforeAll(() => {
			boot();
		});

		afterEach(() => {
			loader.setOptions({ crossOrigin: "", withCredentials: false });
		});

		/** load an asset, resolving with the outcome */
		const load = (asset) => {
			return new Promise((resolve) => {
				loader.load(
					asset,
					() => {
						resolve({ loaded: true });
					},
					(error) => {
						resolve({ loaded: false, error });
					},
				);
			});
		};

		it("assets on the game's own origin still load, JSON and images", async () => {
			const json = await load({
				name: "cors-plain",
				type: "json",
				src: "/data/misc/plain.json",
			});
			const image = await load({
				name: "cors-rect",
				type: "image",
				src: "/data/img/rect.png",
			});
			try {
				expect(json.loaded).toBe(true);
				expect(loader.getJSON("cors-plain")).toBeTruthy();
				expect(image.loaded).toBe(true);
				expect(loader.getImage("cors-rect").width).toBeGreaterThan(0);
			} finally {
				loader.unload({ name: "cors-plain", type: "json" });
				loader.unload({ name: "cors-rect", type: "image" });
			}
		});

		it("an asset on an origin that cannot be reached fails at load, naming it", async () => {
			// nothing listens on port 1
			const src = "http://127.0.0.1:1/level.json";
			const result = await load({
				name: "cors-unreachable",
				type: "json",
				src,
			});
			expect(result.loaded).toBe(false);
			expect(String(result.error?.message ?? result.error)).toContain(src);
		});
	});
});
