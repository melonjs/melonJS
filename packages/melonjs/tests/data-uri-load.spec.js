import { afterEach, describe, expect, it, vi } from "vitest";
import { imgList } from "../src/loader/cache.js";
import { preloadImage } from "../src/loader/parsers/image.js";
import { decodeDataURI, fetchData } from "../src/utils/fetchdata.js";

/**
 * `fetch()` of a `data:` URL is checked against the CSP `connect-src`
 * directive, which hardened pages (sandboxed embeds, hosted artifacts, ...)
 * often restrict to `'self'`. The engine's loading-screen logo is an inlined
 * `data:image/png;base64,...` URI, so it must be decoded locally instead.
 */

// a 2x1 RGBA PNG
const PNG_2x1 =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8AAQv8BD/kD/YURmXYAAAAASUVORK5CYII=";

describe("data: URI loading without fetch()", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		delete imgList["data-uri-logo"];
	});

	it("loads a data: URI image without calling fetch", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		await new Promise((resolve, reject) => {
			preloadImage({ name: "data-uri-logo", src: PNG_2x1 }, resolve, reject);
		});
		expect(fetchSpy).not.toHaveBeenCalled();
		const img = imgList["data-uri-logo"];
		expect(img.width).toBe(2);
		expect(img.height).toBe(1);
	});

	it("decodes a base64 data: URI to a typed blob", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const blob = await fetchData(PNG_2x1, "blob");
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(blob.type).toBe("image/png");
		const bytes = new Uint8Array(await blob.arrayBuffer());
		// PNG signature
		expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
	});

	it("decodes base64 to an exact-length arrayBuffer", async () => {
		const buf = await fetchData(
			"data:application/octet-stream;base64,AQID",
			"arrayBuffer",
		);
		expect([...new Uint8Array(buf)]).toEqual([1, 2, 3]);
	});

	it("decodes percent-encoded text and json payloads", async () => {
		expect(await fetchData("data:,hello%20world", "text")).toBe("hello world");
		expect(
			await fetchData(
				"data:application/json," + encodeURIComponent('{"a":[1,"é"]}'),
				"json",
			),
		).toEqual({ a: [1, "é"] });
		const blob = await fetchData("data:,x", "blob");
		expect(blob.type).toBe("text/plain;charset=us-ascii");
	});

	it("keeps media type parameters", async () => {
		const blob = await fetchData(
			"data:text/plain;charset=utf-8;base64,aGk=",
			"blob",
		);
		expect(blob.type).toBe("text/plain;charset=utf-8");
		expect(await blob.text()).toBe("hi");
	});

	it("decodes percent-encoded bytes that are not UTF-8 text", async () => {
		// decodeURIComponent throws on a lone %FF; fetch() and the URL
		// standard take it as the byte 255
		const buf = await fetchData(
			"data:application/octet-stream,%FF%00%41",
			"arrayBuffer",
		);
		expect([...new Uint8Array(buf)]).toEqual([255, 0, 65]);
		// a % not followed by two hex digits is just a %
		expect(await fetchData("data:,100%25%20and%2", "text")).toBe("100% and%2");
		// characters outside ASCII are their UTF-8 bytes
		expect(await fetchData("data:,é%C3%A9", "text")).toBe("éé");
	});

	it("takes a missing media type as text/plain, parameters or not", async () => {
		const blob = await fetchData("data:;charset=utf-8,hi", "blob");
		expect(blob.type.startsWith("text/plain")).toBe(true);
		expect(await blob.text()).toBe("hi");
	});

	it("rejects a malformed data: URI", async () => {
		await expect(decodeDataURI("data:image/png;base64")).rejects.toThrow(
			/malformed/,
		);
	});
});
