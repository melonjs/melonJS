import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, loader } from "../src/index.js";
import { preloadFontFace } from "../src/loader/parsers/fontface.js";

describe("parser-owned source resolution", () => {
	const type = "font-source-probe";
	let received;

	beforeAll(() => {
		boot();
		const parser = (asset, onload) => {
			received = asset.src;
			onload();
			return 1;
		};
		// Use the font parser's rules under another type, so resolution cannot
		// depend on the loader recognizing the name "fontface".
		Object.assign(parser, {
			resolveSrc: preloadFontFace.resolveSrc,
			skipBaseURL: preloadFontFace.skipBaseURL,
		});
		loader.setParser(type, parser);
		loader.setBaseURL(type, "fonts/");
	});

	afterAll(() => {
		loader.setBaseURL(type, "");
	});

	it.each([
		["test.woff2", "fonts/test.woff2"],
		["url(test.woff2)", "fonts/test.woff2"],
		["url('test.woff2')", "fonts/test.woff2"],
		['url( "Test Font.woff2" )', "fonts/Test Font.woff2"],
		["local('Test Font')", "local('Test Font')"],
		["data:font/woff2;base64,AA==", "data:font/woff2;base64,AA=="],
		["url('data:font/woff2;base64,AA==')", "data:font/woff2;base64,AA=="],
	])("resolves %s without changing the manifest", async (src, expected) => {
		const asset = Object.freeze({ name: "source-probe", type, src });
		await loader.load(asset);
		expect(received).toBe(expected);
		expect(asset.src).toBe(src);
		// Retrying the same entry must not prepend the base URL twice.
		await loader.load(asset);
		expect(received).toBe(expected);
	});
});
