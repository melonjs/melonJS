import { afterEach, describe, expect, it, vi } from "vitest";
import { loader } from "../src/index.js";
import { fetchData } from "../src/utils/fetchdata.js";

/**
 * Assets served behind a same-origin session (a cookie or HTTP auth on the
 * page's own origin) must load without any setting: requests are made with
 * `credentials: "same-origin"`, the browser's own `fetch` default.
 * `withCredentials: true` widens that to cross-origin requests ("include").
 * These tests stub `fetch` and check the options each request is made with.
 */
describe("loader request credentials", () => {
	const stubFetch = () => {
		const spy = vi.fn(() => {
			return Promise.resolve(
				new Response('{"ok":true}', {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);
		});
		vi.stubGlobal("fetch", spy);
		return spy;
	};

	const loadJSON = (name) => {
		return new Promise((resolve, reject) => {
			loader.load(
				{ name, type: "json", src: `data/${name}.json` },
				resolve,
				reject,
			);
		});
	};

	afterEach(() => {
		loader.setOptions({ withCredentials: false });
		loader.unload({ name: "cred-default", type: "json" });
		loader.unload({ name: "cred-include", type: "json" });
		vi.unstubAllGlobals();
	});

	it("sends same-origin credentials by default", async () => {
		const spy = stubFetch();
		await loadJSON("cred-default");
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][1].credentials).toBe("same-origin");
	});

	it("includes credentials with withCredentials: true", async () => {
		const spy = stubFetch();
		loader.setOptions({ withCredentials: true });
		await loadJSON("cred-include");
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0][1].credentials).toBe("include");
	});

	it("fetchData never omits credentials", async () => {
		const spy = stubFetch();
		await fetchData("data/x.json", "json");
		await fetchData("data/x.json", "json", { withCredentials: false });
		expect(spy.mock.calls[0][1].credentials).toBe("same-origin");
		expect(spy.mock.calls[1][1].credentials).toBe("same-origin");
	});
});
