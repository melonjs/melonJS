import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, CanvasTexture, video } from "../src/index.js";

describe("Texture", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("convertToBlob() should return a Blob when using a regular canvas", async () => {
		const canvasTexture = new CanvasTexture(100, 100);
		const offscreenCanvas = new CanvasTexture(100, 100, {
			offscreenCanvas: true,
		});

		expect(await canvasTexture.toBlob()).toBeInstanceOf(window.Blob);
		expect(await offscreenCanvas.toBlob()).toBeInstanceOf(window.Blob);
	});

	describe("TextureCache", () => {
		let cache;

		beforeEach(() => {
			cache = video.renderer.cache;
			cache.clear();
		});

		it("should have a texture cache on the renderer", () => {
			expect(cache).toBeDefined();
			expect(typeof cache.set).toEqual("function");
			expect(typeof cache.get).toEqual("function");
			expect(typeof cache.delete).toEqual("function");
			expect(typeof cache.clear).toEqual("function");
		});

		it("should cache and retrieve a texture atlas for an image", () => {
			const canvas = new CanvasTexture(64, 64);
			const entry = cache.get(canvas.canvas);
			expect(entry).toBeDefined();

			// retrieving again should return the same entry
			const entry2 = cache.get(canvas.canvas);
			expect(entry2).toBe(entry);
		});

		it("should auto-create a texture atlas on first get", () => {
			const canvas = new CanvasTexture(128, 128);
			const entry = cache.get(canvas.canvas);
			expect(entry).toBeDefined();
			// the auto-created atlas should have a default region
			const atlas = entry.getAtlas();
			expect(atlas).toBeDefined();
			expect(atlas["default"]).toBeDefined();
			expect(atlas["default"].width).toEqual(128);
			expect(atlas["default"].height).toEqual(128);
		});

		it("should store multiple atlases for the same image key", () => {
			const canvas = new CanvasTexture(64, 64);
			// first entry auto-created
			const entry1 = cache.get(canvas.canvas);
			expect(entry1).toBeDefined();

			// manually add a second atlas for the same image
			const canvas2 = new CanvasTexture(64, 64);
			const entry2 = cache.get(canvas2.canvas);
			cache.set(canvas.canvas, entry2);

			// get() returns the first entry
			const retrieved = cache.get(canvas.canvas);
			expect(retrieved).toBe(entry1);
		});

		it("should retrieve specific atlas by frame dimensions", () => {
			const canvas = new CanvasTexture(64, 64);
			// auto-create default atlas (full image: 64x64)
			const defaultEntry = cache.get(canvas.canvas);
			expect(defaultEntry).toBeDefined();

			// request with a specific atlas frame size that matches
			const entry = cache.get(canvas.canvas, {
				framewidth: 64,
				frameheight: 64,
			});
			expect(entry).toBeDefined();
		});

		it("should keep different images as separate cache entries", () => {
			const c1 = new CanvasTexture(32, 32);
			const c2 = new CanvasTexture(64, 64);

			const entry1 = cache.get(c1.canvas);
			const entry2 = cache.get(c2.canvas);

			expect(entry1).not.toBe(entry2);
			expect(entry1.getAtlas()["default"].width).toEqual(32);
			expect(entry2.getAtlas()["default"].width).toEqual(64);
		});

		it("should delete a cached texture and create new on next get", () => {
			const canvas = new CanvasTexture(32, 32);
			const original = cache.get(canvas.canvas);
			cache.delete(canvas.canvas);

			// after delete, get() should create a new entry
			const newEntry = cache.get(canvas.canvas);
			expect(newEntry).toBeDefined();
			expect(newEntry).not.toBe(original);
		});

		it("should not throw when deleting a non-existent key", () => {
			const canvas = new CanvasTexture(32, 32);
			// never cached — delete should be a no-op
			expect(() => {
				return cache.delete(canvas.canvas);
			}).not.toThrow();
		});

		it("should clear all cached textures", () => {
			const c1 = new CanvasTexture(32, 32);
			const c2 = new CanvasTexture(64, 64);
			const entry1 = cache.get(c1.canvas);
			cache.get(c2.canvas);

			cache.clear();

			// after clear, get creates a fresh entry
			const newEntry = cache.get(c1.canvas);
			expect(newEntry).toBeDefined();
			expect(newEntry).not.toBe(entry1);
		});

		it("should also clear tinted cache and texture units on clear", () => {
			const canvas = new CanvasTexture(32, 32);
			cache.get(canvas.canvas);

			cache.clear();

			// internal state should be reset
			expect(cache.tinted.size).toEqual(0);
			expect(cache.units.size).toEqual(0);
			expect(cache.usedUnits.size).toEqual(0);
		});

		it("should allocate texture units sequentially", () => {
			const unit0 = cache.allocateTextureUnit();
			const unit1 = cache.allocateTextureUnit();

			expect(unit0).toEqual(0);
			expect(unit1).toEqual(1);
		});

		it("should throw when texture units are exhausted", () => {
			cache.max_size = 2;
			cache.allocateTextureUnit();
			cache.allocateTextureUnit();

			expect(() => {
				return cache.allocateTextureUnit();
			}).toThrow(/Texture cache overflow/);
		});

		it("tint() should cache and return the same result for identical src+color", () => {
			// mock a source image and a tint function on the renderer
			const src = document.createElement("canvas");
			src.width = 32;
			src.height = 32;
			const color = "rgb(255, 0, 0)";

			// call tint twice with the same src and color
			const result1 = cache.tint(src, color);
			const result2 = cache.tint(src, color);

			// BUG: if Map.set() return value is used as the inner map,
			// cache never hits and a new tinted image is created every call
			expect(result1).toBe(result2);
		});

		it("tint() should return different results for different colors", () => {
			const src = document.createElement("canvas");
			src.width = 32;
			src.height = 32;

			const red = cache.tint(src, "rgb(255, 0, 0)");
			const blue = cache.tint(src, "rgb(0, 0, 255)");

			expect(red).not.toBe(blue);
		});

		it("tint() inner map should grow only for unique colors", () => {
			const src = document.createElement("canvas");
			src.width = 32;
			src.height = 32;

			cache.tint(src, "rgb(255, 0, 0)");
			cache.tint(src, "rgb(255, 0, 0)"); // duplicate
			cache.tint(src, "rgb(0, 255, 0)");
			cache.tint(src, "rgb(0, 255, 0)"); // duplicate

			const innerMap = cache.tinted.get(src);
			// should have exactly 2 entries, not 4
			expect(innerMap).toBeInstanceOf(Map);
			expect(innerMap.size).toEqual(2);
		});

		it("should handle set() followed by get() returning first entry", () => {
			const canvas = new CanvasTexture(48, 48);

			// manually set two different atlases for the same key
			const c2 = new CanvasTexture(48, 48);
			const atlas1 = cache.get(canvas.canvas);
			const atlas2 = cache.get(c2.canvas);

			cache.clear();
			cache.set(canvas.canvas, atlas1);
			cache.set(canvas.canvas, atlas2);

			// get should return the first one stored
			const retrieved = cache.get(canvas.canvas);
			expect(retrieved).toBe(atlas1);
		});
	});
});
