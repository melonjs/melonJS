import { beforeAll, describe, expect, it } from "vitest";
import { boot, game, ImageLayer, video } from "../src/index.js";

describe("ImageLayer", () => {
	let testImage;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});

		// create a small canvas to use as the image source
		testImage = document.createElement("canvas");
		testImage.width = 64;
		testImage.height = 64;
	});

	describe("createPattern", () => {
		it("should create pattern when added to game world", () => {
			const layer = new ImageLayer(0, 0, {
				image: testImage,
				name: "test",
				repeat: "repeat",
			});
			game.world.addChild(layer);
			expect(layer._pattern).toBeDefined();
			game.world.removeChildNow(layer);
		});
	});

	describe("parentApp usage", () => {
		it("should access viewport via parentApp when in world", () => {
			const layer = new ImageLayer(0, 0, {
				image: testImage,
				name: "test",
				repeat: "no-repeat",
			});
			game.world.addChild(layer);
			expect(layer.parentApp).toBeDefined();
			expect(layer.parentApp.viewport).toBe(game.viewport);
			game.world.removeChildNow(layer);
		});

		it("should resize to viewport dimensions on activate", () => {
			const layer = new ImageLayer(0, 0, {
				image: testImage,
				name: "test",
				repeat: "no-repeat",
			});
			game.world.addChild(layer);
			expect(layer.width).toEqual(game.viewport.width);
			expect(layer.height).toEqual(game.viewport.height);
			game.world.removeChildNow(layer);
		});

		it("repeat-x should set width to Infinity on activate", () => {
			const layer = new ImageLayer(0, 0, {
				image: testImage,
				name: "test",
				repeat: "repeat-x",
			});
			game.world.addChild(layer);
			expect(layer.width).toEqual(Infinity);
			expect(layer.height).toEqual(game.viewport.height);
			game.world.removeChildNow(layer);
		});

		it("repeat-y should set height to Infinity on activate", () => {
			const layer = new ImageLayer(0, 0, {
				image: testImage,
				name: "test",
				repeat: "repeat-y",
			});
			game.world.addChild(layer);
			expect(layer.width).toEqual(game.viewport.width);
			expect(layer.height).toEqual(Infinity);
			game.world.removeChildNow(layer);
		});
	});
});
