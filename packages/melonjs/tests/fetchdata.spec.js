import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchData } from "../src/loader/parsers/fetchdata.js";

/**
 * `fetch()` cannot load `file:` URLs in several WebView contexts — notably a
 * Cordova/Capacitor APK on Android, where the app runs from `file://` and
 * `fetch()` rejects with a network error. `fetchData` falls back to
 * `XMLHttpRequest` there (which supports `file:`; a successful local read
 * reports `status === 0`). These tests stub the globals so the routing +
 * response handling are verified without needing real file access.
 */
describe("fetchData file:// XHR fallback", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	// a synchronous fake XHR that reports the given status/response on send()
	const stubXHR = ({ status = 0, text, response, error = false } = {}) => {
		const calls = { url: null, withCredentials: null, responseType: null };
		class FakeXHR {
			open(_method, url) {
				calls.url = url;
			}
			send() {
				calls.withCredentials = this.withCredentials;
				calls.responseType = this.responseType;
				this.status = status;
				this.responseText = text;
				this.response = response;
				if (error) {
					this.onerror();
				} else {
					this.onload();
				}
			}
		}
		vi.stubGlobal("XMLHttpRequest", FakeXHR);
		return calls;
	};

	it("routes a file:// URL to XHR and parses json (status 0)", async () => {
		const calls = stubXHR({ status: 0, text: '{"a":1,"b":"x"}' });
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const data = await fetchData(
			"file:///android_asset/www/data/x.json",
			"json",
		);
		expect(data).toEqual({ a: 1, b: "x" });
		expect(calls.url).toBe("file:///android_asset/www/data/x.json");
		expect(calls.responseType).toBe("text"); // json parsed from text
		expect(fetchSpy).not.toHaveBeenCalled(); // never touched fetch()
	});

	it("resolves an arrayBuffer file:// via xhr.response", async () => {
		const buf = new ArrayBuffer(8);
		const calls = stubXHR({ status: 0, response: buf });
		const data = await fetchData("file:///data/x.bin", "arrayBuffer");
		expect(data).toBe(buf);
		expect(calls.responseType).toBe("arraybuffer");
	});

	it("resolves a text file://", async () => {
		stubXHR({ status: 0, text: "hello" });
		expect(await fetchData("file:///data/x.txt", "text")).toBe("hello");
	});

	it("honors withCredentials on the XHR path", async () => {
		const calls = stubXHR({ status: 0, text: "{}" });
		await fetchData("file:///data/x.json", "json", { withCredentials: true });
		expect(calls.withCredentials).toBe(true);
	});

	it("rejects on a non-0/200 XHR status", async () => {
		stubXHR({ status: 404 });
		await expect(fetchData("file:///missing.json", "json")).rejects.toThrow(
			/not ok: 404/,
		);
	});

	it("rejects on an XHR network error", async () => {
		stubXHR({ error: true });
		await expect(fetchData("file:///x.json", "json")).rejects.toThrow(
			/XHR error/,
		);
	});

	it("still uses fetch() (NOT xhr) for an http(s) URL", async () => {
		const XHRSpy = vi.fn();
		vi.stubGlobal("XMLHttpRequest", XHRSpy);
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => {
				return { ok: 1 };
			},
		});
		const data = await fetchData("https://example.com/data/x.json", "json");
		expect(data).toEqual({ ok: 1 });
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(XHRSpy).not.toHaveBeenCalled();
	});
});
