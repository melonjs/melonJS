import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, loader } from "../src/index.js";
import { fetchData } from "../src/utils/fetchdata.js";

/**
 * Asset requests carry the browser's credentials to the game's own origin
 * (#1801).
 *
 * `fetchData` built every request with `credentials: "omit"` unless
 * `withCredentials` was set, so even requests to the page's own origin went
 * out with no cookies or HTTP auth. A game served behind a login or a session
 * cookie loaded its `<script>` (which the browser sends the cookie with) and
 * then got a 403 for every asset. Requests now default to "same-origin", as
 * every browser request does; `withCredentials` still sends credentials to
 * other origins too ("include").
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

/** the `credentials` of the request a stubbed `fetch` was last called with */
const credentialsOf = (spy) => {
	return spy.mock.calls.at(-1)[1].credentials;
};

describe("asset request credentials (#1801)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("fetchData", () => {
		it("sends credentials to the game's own origin by default", async () => {
			const spy = stubFetch();
			await fetchData("data/level.json", "json");
			expect(credentialsOf(spy)).toBe("same-origin");
		});

		it("still only to its own origin with withCredentials false", async () => {
			const spy = stubFetch();
			await fetchData("data/level.json", "json", { withCredentials: false });
			expect(credentialsOf(spy)).toBe("same-origin");
		});

		it("to every origin with withCredentials true", async () => {
			const spy = stubFetch();
			await fetchData("https://cdn.example.com/level.json", "json", {
				withCredentials: true,
			});
			expect(credentialsOf(spy)).toBe("include");
		});

		it('with crossOrigin "anonymous", still to its own origin', async () => {
			const spy = stubFetch();
			await fetchData("data/level.json", "json", { crossOrigin: "anonymous" });
			expect(credentialsOf(spy)).toBe("same-origin");
		});
	});

	describe("through the loader", () => {
		beforeAll(() => {
			boot();
		});

		afterEach(() => {
			loader.setOptions({ withCredentials: false });
		});

		/** load a JSON asset through the loader, resolving once it is loaded */
		const loadJSON = (name) => {
			return new Promise((resolve, reject) => {
				loader.load(
					{ name, type: "json", src: `data/${name}.json` },
					resolve,
					reject,
				);
			}).finally(() => {
				loader.unload({ name, type: "json" });
			});
		};

		it("a game's assets carry its own origin's credentials by default", async () => {
			const spy = stubFetch();
			await loadJSON("cred-default");
			expect(credentialsOf(spy)).toBe("same-origin");
		});

		it("setOptions({ withCredentials: true }) sends them to every origin", async () => {
			loader.setOptions({ withCredentials: true });
			const spy = stubFetch();
			await loadJSON("cred-include");
			expect(credentialsOf(spy)).toBe("include");
		});
	});
});
