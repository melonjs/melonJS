import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, loader } from "../src/index.js";
import { preloadFontFace } from "../src/loader/parsers/fontface.js";

/**
 * The parser contract: every registered parser is normalized to the same
 * shape — `{ parse, normalizeSrc, needsBaseURL }` — so `load()` can resolve a
 * src without ever naming an asset type.
 *
 * These are adversarial on purpose. The thing that makes the contract worth
 * having is that a type's rules live with that type, and the failure mode when
 * it breaks is silent: a src resolves to a slightly wrong URL and the asset
 * 404s at runtime, far from the cause.
 */
describe("the parser src contract", () => {
	/** every type registered here, cleaned up after each test */
	const registered = new Set();

	beforeAll(() => {
		boot();
	});

	afterEach(() => {
		for (const type of registered) {
			loader.setBaseURL(type, "");
		}
		registered.clear();
	});

	/**
	 * Register a probe parser and return what src the parser actually received.
	 * @param {string} type - a unique asset type for this test
	 * @param {object} [hooks] - optional `normalizeSrc` / `needsBaseURL`
	 * @param {string} [base] - base URL for the type
	 * @returns {function(string): Promise<string>} loads a src, resolves to what the parser saw
	 */
	const probe = (type, hooks = {}, base = "assets/") => {
		let seen;
		const parser = (asset, onload) => {
			seen = asset.src;
			onload();
			return 1;
		};
		Object.assign(parser, hooks);
		loader.setParser(type, parser);
		loader.setBaseURL(type, base);
		registered.add(type);
		return async (src) => {
			await loader.load(Object.freeze({ name: `${type}-probe`, type, src }));
			return seen;
		};
	};

	describe("a parser that declares nothing", () => {
		it("gets the base URL, and keeps its src otherwise untouched", async () => {
			const load = probe("plain-a");
			expect(await load("sprite.png")).toBe("assets/sprite.png");
		});

		it("still has data URIs excluded — the one universal rule", async () => {
			// a type that declares no hooks must not have to know about data:
			const load = probe("plain-b");
			expect(await load("data:image/png;base64,AA==")).toBe(
				"data:image/png;base64,AA==",
			);
		});

		it("is handed a src that looks like another type's descriptor, verbatim", async () => {
			// `url(...)` is CSS, and means nothing to a type that has not said so.
			// If `load()` ever unwraps it for everyone, this breaks — which is
			// exactly the leak the contract exists to prevent.
			const load = probe("plain-c");
			expect(await load("url(weird.png)")).toBe("assets/url(weird.png)");
			const localish = probe("plain-d");
			expect(await localish("local('Not A Font')")).toBe(
				"assets/local('Not A Font')",
			);
		});
	});

	describe("normalizeSrc", () => {
		it("runs before the base URL, not after", async () => {
			// the ordering IS the reason the hook exists: a parser cannot repair
			// "assets/" + "url(x.png)" once the prefix is on
			const load = probe("order-a", {
				normalizeSrc: (src) => {
					return src.replace(/^wrapped\((.*)\)$/, "$1");
				},
			});
			expect(await load("wrapped(x.png)")).toBe("assets/x.png");
		});

		it("can normalize a src INTO a data URI and still be excluded", async () => {
			// the nasty ordering case: the exclusion has to be tested against the
			// NORMALIZED value, not the original. Tested against the original,
			// this resolves to "assets/data:font/..." and 404s
			const load = probe("order-b", {
				normalizeSrc: (src) => {
					return src.replace(/^url\((.*)\)$/, "$1");
				},
			});
			expect(await load("url(data:font/woff2;base64,AA==)")).toBe(
				"data:font/woff2;base64,AA==",
			);
		});

		it("can normalize a src into one its own needsBaseURL then rejects", async () => {
			// same ordering trap, through the other hook
			const load = probe("order-c", {
				normalizeSrc: (src) => {
					return src.replace(/^wrapped\((.*)\)$/, "$1");
				},
				needsBaseURL: (src) => {
					return !src.startsWith("local(");
				},
			});
			expect(await load("wrapped(local('Family'))")).toBe("local('Family')");
		});

		it("is not called for an array src (an image fallback chain)", async () => {
			let calls = 0;
			const load = probe("array-a", {
				normalizeSrc: (src) => {
					calls++;
					return src;
				},
			});
			const chain = ["a.ktx", "b.png"];
			expect(await load(chain)).toEqual(chain);
			expect(calls).toBe(0);
		});
	});

	describe("needsBaseURL", () => {
		it("suppresses the prefix when it answers false", async () => {
			const load = probe("skip-a", {
				needsBaseURL: () => {
					return false;
				},
			});
			expect(await load("anything.bin")).toBe("anything.bin");
		});

		it("cannot re-enable the base URL for a data URI", async () => {
			// data: is decided before the hook is consulted, so a parser that
			// answers true for everything still cannot break a data URI
			const load = probe("skip-b", {
				needsBaseURL: () => {
					return true;
				},
			});
			expect(await load("data:text/plain,hi")).toBe("data:text/plain,hi");
		});
	});

	describe("the manifest entry is never mutated", () => {
		it("survives being loaded twice, frozen", async () => {
			// the bug this guards: load() used to write the resolved src back
			// onto the asset, so a retry prefixed an already-prefixed path
			const load = probe("frozen-a");
			expect(await load("x.png")).toBe("assets/x.png");
			expect(await load("x.png")).toBe("assets/x.png");
		});

		it("leaves the caller's object untouched", async () => {
			const type = "frozen-b";
			let seen;
			const parser = (asset, onload) => {
				seen = asset.src;
				onload();
				return 1;
			};
			loader.setParser(type, parser);
			loader.setBaseURL(type, "assets/");
			registered.add(type);
			const asset = Object.freeze({ name: "f", type, src: "y.png" });
			await loader.load(asset);
			expect(seen).toBe("assets/y.png");
			expect(asset.src).toBe("y.png");
		});
	});

	describe("the fontface rules, through the generic path", () => {
		/**
		 * Registered under a type that is NOT "fontface", so nothing can pass by
		 * the loader recognising the name.
		 * @returns {function(string): Promise<string>} the probe
		 */
		const fontProbe = () => {
			return probe(
				"font-rules",
				{
					normalizeSrc: preloadFontFace.normalizeSrc,
					needsBaseURL: preloadFontFace.needsBaseURL,
				},
				"fonts/",
			);
		};

		it.each([
			["bare path", "t.woff2", "fonts/t.woff2"],
			["unquoted url()", "url(t.woff2)", "fonts/t.woff2"],
			["single-quoted", "url('t.woff2')", "fonts/t.woff2"],
			["double-quoted", 'url("t.woff2")', "fonts/t.woff2"],
			["padded", "url(  't.woff2'  )", "fonts/t.woff2"],
			["a space in the name", "url('My Font.woff2')", "fonts/My Font.woff2"],
			["local family", "local('My Font')", "local('My Font')"],
			[
				"bare data URI",
				"data:font/woff2;base64,AA==",
				"data:font/woff2;base64,AA==",
			],
			[
				"data URI inside url()",
				"url('data:font/woff2;base64,AA==')",
				"data:font/woff2;base64,AA==",
			],
			[
				"a path that merely contains url(",
				"my-url(x).woff2",
				"fonts/my-url(x).woff2",
			],
			["an unterminated url(", "url(t.woff2", "fonts/url(t.woff2"],
		])("%s", async (_label, src, expected) => {
			const load = fontProbe();
			expect(await load(src)).toBe(expected);
		});
	});

	describe("a type with no base URL configured", () => {
		it("leaves the src alone but still normalizes it", async () => {
			const load = probe(
				"nobase-a",
				{
					normalizeSrc: (src) => {
						return src.replace(/^w\((.*)\)$/, "$1");
					},
				},
				"",
			);
			// setBaseURL("") is still "defined", so the prefix is an empty string
			expect(await load("w(x.png)")).toBe("x.png");
		});
	});
});
