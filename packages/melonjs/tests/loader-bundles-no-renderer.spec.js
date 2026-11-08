import { describe, expect, it } from "vitest";
import { boot, loader } from "../src/index.js";

/**
 * Bundles before any Application exists (#1656).
 *
 * Unloading an image now also frees the texture the renderer made from it;
 * with no renderer yet there is none, and unloading must still just work —
 * a game may load and free a bundle of plain data before `app.init()`, and a
 * tool or a test may never create an application at all. This file never
 * creates one, so the loader has no renderer to reach.
 */

const PNG =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const img = (name) => {
	return { name, type: "image", src: PNG };
};

describe("bundles with no renderer", () => {
	it("loads and unloads a bundle of images, and an image on its own, without a renderer", async () => {
		await boot();
		loader.setBundle("nr", [img("nr-a"), img("nr-b")]);
		await loader.load("nr");
		expect(loader.isLoaded("nr")).toBe(true);

		expect(() => {
			expect(loader.unload("nr")).toBe(true);
		}).not.toThrow();
		expect(loader.getImage("nr-a")).toBeNull();

		await loader.load(img("nr-c"));
		expect(() => {
			expect(loader.unload(img("nr-c"))).toBe(true);
		}).not.toThrow();

		await loader.preload(["nr"], undefined, false);
		expect(() => {
			loader.unloadAll();
		}).not.toThrow();
		expect(loader.isLoaded("nr")).toBe(false);
	});
});
