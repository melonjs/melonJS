import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	boot,
	CanvasTexture,
	Sprite,
	TextureAtlas,
	video,
} from "../src/index.js";

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

		it("should flush and reset when texture units are exhausted", () => {
			cache.max_size = 2;
			cache.allocateTextureUnit();
			cache.allocateTextureUnit();

			// stub the compositor to verify flush is called
			let flushed = false;
			const compositor = video.renderer.currentCompositor;
			if (compositor) {
				const originalFlush = compositor.flush.bind(compositor);
				compositor.flush = () => {
					flushed = true;
					originalFlush();
				};
			}

			// when all units are exhausted, it should flush, reset, and return unit 0
			const unit = cache.allocateTextureUnit();
			expect(unit).toEqual(0);
			expect(cache.usedUnits.size).toEqual(1);
			expect(cache.units.size).toEqual(0);

			if (compositor) {
				expect(flushed).toBe(true);
				expect(compositor.boundTextures.length).toEqual(0);
				expect(compositor.currentTextureUnit).toEqual(-1);
			}
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

	describe("TextureAtlas.getAnimationSettings", () => {
		let atlas;

		beforeAll(() => {
			// create a mock texture atlas using TexturePacker JSON format
			const mockImage = video.createCanvas(256, 256);
			const atlasJSON = {
				meta: {
					app: "https://www.codeandweb.com/texturepacker",
					size: { w: 256, h: 256 },
					image: "default",
				},
				frames: [
					{
						filename: "walk0001.png",
						frame: { x: 0, y: 0, w: 32, h: 48 },
						rotated: false,
						trimmed: false,
						spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
						sourceSize: { w: 32, h: 48 },
					},
					{
						filename: "walk0002.png",
						frame: { x: 32, y: 0, w: 32, h: 48 },
						rotated: false,
						trimmed: false,
						spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
						sourceSize: { w: 32, h: 48 },
					},
					{
						filename: "walk0003.png",
						frame: { x: 64, y: 0, w: 32, h: 48 },
						rotated: false,
						trimmed: false,
						spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
						sourceSize: { w: 32, h: 48 },
					},
					{
						filename: "idle0001.png",
						frame: { x: 96, y: 0, w: 40, h: 52 },
						rotated: false,
						trimmed: false,
						spriteSourceSize: { x: 0, y: 0, w: 40, h: 52 },
						sourceSize: { w: 40, h: 52 },
					},
				],
			};
			atlas = new TextureAtlas(atlasJSON, mockImage);
		});

		it("should return a valid settings object with expected properties", () => {
			const settings = atlas.getAnimationSettings([
				"walk0001.png",
				"walk0002.png",
				"walk0003.png",
			]);

			expect(settings).toBeDefined();
			expect(settings.image).toBe(atlas);
			expect(settings.framewidth).toEqual(32);
			expect(settings.frameheight).toEqual(48);
			expect(settings.margin).toEqual(0);
			expect(settings.spacing).toEqual(0);
			expect(settings.atlas).toBeInstanceOf(Array);
			expect(settings.atlas.length).toEqual(3);
			expect(settings.atlasIndices).toBeDefined();
			expect(settings.atlasIndices["walk0001.png"]).toEqual(0);
			expect(settings.atlasIndices["walk0002.png"]).toEqual(1);
			expect(settings.atlasIndices["walk0003.png"]).toEqual(2);
		});

		it("should compute framewidth/frameheight as the max across all requested frames", () => {
			const settings = atlas.getAnimationSettings([
				"walk0001.png",
				"idle0001.png",
			]);

			// walk is 32x48, idle is 40x52 — max should be 40x52
			expect(settings.framewidth).toEqual(40);
			expect(settings.frameheight).toEqual(52);
		});

		it("should use all atlas entries when names is undefined", () => {
			const settings = atlas.getAnimationSettings();

			expect(settings.atlas.length).toEqual(4);
			expect(settings.atlasIndices["walk0001.png"]).toBeDefined();
			expect(settings.atlasIndices["walk0002.png"]).toBeDefined();
			expect(settings.atlasIndices["walk0003.png"]).toBeDefined();
			expect(settings.atlasIndices["idle0001.png"]).toBeDefined();
		});

		it("should throw when a requested frame name does not exist", () => {
			expect(() => {
				atlas.getAnimationSettings(["nonexistent.png"]);
			}).toThrow(/region for nonexistent.png not found/);
		});

		it("should produce settings compatible with Sprite constructor", () => {
			const settings = atlas.getAnimationSettings([
				"walk0001.png",
				"walk0002.png",
				"walk0003.png",
			]);

			const sprite = new Sprite(0, 0, settings);
			expect(sprite).toBeInstanceOf(Sprite);
			expect(sprite.width).toEqual(32);
			expect(sprite.height).toEqual(48);
		});

		it("should produce settings that enable addAnimation with frame names", () => {
			const settings = atlas.getAnimationSettings([
				"walk0001.png",
				"walk0002.png",
				"walk0003.png",
			]);

			const sprite = new Sprite(0, 0, settings);
			const count = sprite.addAnimation("walk", [
				"walk0001.png",
				"walk0002.png",
			]);
			expect(count).toEqual(2);
			sprite.setCurrentAnimation("walk");
			expect(sprite.isCurrentAnimation("walk")).toEqual(true);
		});

		it("should produce identical results to createAnimationFromName", () => {
			const settings = atlas.getAnimationSettings([
				"walk0001.png",
				"walk0002.png",
				"walk0003.png",
			]);
			const spriteFromSettings = new Sprite(0, 0, settings);

			const spriteFromFactory = atlas.createAnimationFromName([
				"walk0001.png",
				"walk0002.png",
				"walk0003.png",
			]);

			// same dimensions
			expect(spriteFromSettings.width).toEqual(spriteFromFactory.width);
			expect(spriteFromSettings.height).toEqual(spriteFromFactory.height);

			// same atlas data
			expect(spriteFromSettings.textureAtlas.length).toEqual(
				spriteFromFactory.textureAtlas.length,
			);
			expect(Object.keys(spriteFromSettings.atlasIndices).length).toEqual(
				Object.keys(spriteFromFactory.atlasIndices).length,
			);
		});

		it("should strip anchorPoint from atlas regions", () => {
			// create an atlas with pivot/anchorPoint data (as TexturePacker exports)
			const mockImage = video.createCanvas(256, 256);
			const atlasWithPivot = new TextureAtlas(
				{
					meta: {
						app: "https://www.codeandweb.com/texturepacker",
						size: { w: 256, h: 256 },
						image: "default",
					},
					frames: [
						{
							filename: "char0001.png",
							frame: { x: 0, y: 0, w: 32, h: 48 },
							rotated: false,
							trimmed: false,
							spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
							sourceSize: { w: 32, h: 48 },
							pivot: { x: 0.5, y: 1.0 },
						},
						{
							filename: "char0002.png",
							frame: { x: 32, y: 0, w: 32, h: 48 },
							rotated: false,
							trimmed: false,
							spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
							sourceSize: { w: 32, h: 48 },
							pivot: { x: 0.5, y: 1.0 },
						},
					],
				},
				mockImage,
			);

			// verify the original regions have anchorPoint
			const originalRegion = atlasWithPivot.getRegion("char0001.png");
			expect(originalRegion.anchorPoint).toBeDefined();

			// getAnimationSettings should strip it
			const settings = atlasWithPivot.getAnimationSettings([
				"char0001.png",
				"char0002.png",
			]);
			for (const region of settings.atlas) {
				expect(region.anchorPoint).toBeUndefined();
			}

			// Sprite created from these settings should keep its own anchor
			const sprite = new Sprite(10, 20, {
				...settings,
				anchorPoint: { x: 0, y: 0 },
			});
			sprite.addAnimation("walk", ["char0001.png", "char0002.png"]);
			sprite.setCurrentAnimation("walk");
			// anchor should remain (0, 0), not overridden by the region
			expect(sprite.anchorPoint.x).toEqual(0);
			expect(sprite.anchorPoint.y).toEqual(0);
		});

		it("createAnimationFromName should preserve anchorPoint in regions", () => {
			// create an atlas with pivot data
			const mockImage = video.createCanvas(256, 256);
			const atlasWithPivot = new TextureAtlas(
				{
					meta: {
						app: "https://www.codeandweb.com/texturepacker",
						size: { w: 256, h: 256 },
						image: "default",
					},
					frames: [
						{
							filename: "hero0001.png",
							frame: { x: 0, y: 0, w: 32, h: 48 },
							rotated: false,
							trimmed: false,
							spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
							sourceSize: { w: 32, h: 48 },
							pivot: { x: 0.5, y: 1.0 },
						},
					],
				},
				mockImage,
			);

			// createAnimationFromName should NOT strip anchorPoint (backward compat)
			const sprite = atlasWithPivot.createAnimationFromName(["hero0001.png"]);
			// the sprite's anchor should be set from the region's pivot
			expect(sprite.anchorPoint.x).toEqual(0.5);
			expect(sprite.anchorPoint.y).toEqual(1.0);
		});

		it("should bottom-align smaller frames via trim offset", () => {
			// walk frames are 32x48, idle is 40x52 — max height is 52
			const settings = atlas.getAnimationSettings([
				"walk0001.png",
				"idle0001.png",
			]);

			// walk frame (height 48) should get a trim.y offset of 52 - 48 = 4
			const walkRegion = settings.atlas[settings.atlasIndices["walk0001.png"]];
			expect(walkRegion.trim).toBeDefined();
			expect(walkRegion.trim.y).toEqual(4);

			// idle frame (height 52 = max) should NOT get a trim offset
			const idleRegion = settings.atlas[settings.atlasIndices["idle0001.png"]];
			// trim should be null/undefined or have y=0
			if (idleRegion.trim) {
				expect(idleRegion.trim.y).toEqual(0);
			}
		});

		it("should not add trim when all frames have the same height", () => {
			const settings = atlas.getAnimationSettings([
				"walk0001.png",
				"walk0002.png",
				"walk0003.png",
			]);

			// all walk frames are 32x48 — no trim needed
			for (const region of settings.atlas) {
				if (region.trim) {
					expect(region.trim.y).toEqual(0);
				}
			}
		});
	});
});
