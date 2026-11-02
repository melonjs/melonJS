import { afterEach, beforeAll, describe, expect, inject, it, vi } from "vitest";
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

	describe("every scenario, with real requests through the loader", () => {
		// servers on other origins, started by tests/helpers/cors-servers.js
		const servers = inject("corsServers");
		const OWN = "/data/cors/";

		beforeAll(() => {
			boot();
		});

		afterEach(() => {
			loader.setOptions({ crossOrigin: "", withCredentials: false });
		});

		const ASSETS = {
			json: "level.json",
			image: "dot.png",
		};

		/** load an asset, resolving with what came of it */
		let n = 0;
		const load = (type, base) => {
			const name = `cors-${type}-${n++}`;
			return new Promise((resolve) => {
				loader.load(
					{ name, type, src: base + ASSETS[type] },
					() => {
						const data =
							type === "json" ? loader.getJSON(name) : loader.getImage(name);
						resolve({ loaded: true, data });
					},
					(error) => {
						resolve({
							loaded: false,
							message: String(error?.message ?? error),
						});
					},
				);
			}).finally(() => {
				loader.unload({ name, type });
			});
		};

		/** the asset loaded, with its real content */
		const expectLoaded = (type, result) => {
			expect(result.loaded, result.message).toBe(true);
			if (type === "json") {
				expect(result.data).toEqual({ ok: 1 });
			} else {
				expect(result.data.width).toBe(1);
				expect(result.data.height).toBe(1);
			}
		};

		/** the asset failed at the request, with the error naming it and why */
		const expectBlocked = (type, base, result) => {
			expect(result.loaded).toBe(false);
			expect(result.message).toContain(base + ASSETS[type]);
			expect(result.message).toContain("Access-Control-Allow-Origin");
		};

		// one row per scenario: the loader's options, where the asset is,
		// and what must come of it (the table in the PR)
		const scenarios = [
			["default", {}, "own", "loads"],
			["default", {}, "cors", "loads"],
			["default", {}, "none", "blocked"],
			['crossOrigin "anonymous"', { crossOrigin: "anonymous" }, "own", "loads"],
			[
				'crossOrigin "anonymous"',
				{ crossOrigin: "anonymous" },
				"cors",
				"loads",
			],
			[
				'crossOrigin "anonymous"',
				{ crossOrigin: "anonymous" },
				"none",
				"blocked",
			],
			["withCredentials", { withCredentials: true }, "own", "loads"],
			["withCredentials", { withCredentials: true }, "credentials", "loads"],
			["withCredentials", { withCredentials: true }, "cors", "blocked"],
			["withCredentials", { withCredentials: true }, "none", "blocked"],
			[
				'crossOrigin "use-credentials"',
				{ crossOrigin: "use-credentials" },
				"credentials",
				"loads",
			],
			[
				'crossOrigin "use-credentials"',
				{ crossOrigin: "use-credentials" },
				"cors",
				"blocked",
			],
		];

		const where = {
			own: "the game's own origin",
			cors: "another origin that sends CORS headers",
			none: "another origin with no CORS headers",
			credentials: "another origin that allows credentials",
		};

		describe.each(["json", "image"])("%s", (type) => {
			it.each(
				scenarios.map(([label, options, origin, outcome]) => {
					return [label, where[origin], outcome, options, origin];
				}),
			)("%s, from %s: %s", async (_label, _where, outcome, options, origin) => {
				loader.setOptions({
					crossOrigin: "",
					withCredentials: false,
					...options,
				});
				const base = origin === "own" ? OWN : servers[origin];
				const result = await load(type, base);
				if (outcome === "loads") {
					expectLoaded(type, result);
				} else {
					expectBlocked(type, base, result);
				}
			});
		});

		it("an asset on an origin that cannot be reached fails at load, naming it", async () => {
			// nothing listens on port 1
			const result = await load("json", "http://127.0.0.1:1/");
			expect(result.loaded).toBe(false);
			expect(result.message).toContain("http://127.0.0.1:1/level.json");
		});
	});
});
