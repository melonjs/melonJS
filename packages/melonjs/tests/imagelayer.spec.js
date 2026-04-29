import { beforeAll, describe, expect, it, vi } from "vitest";
import { boot, game, ImageLayer, Rect, video } from "../src/index.js";

describe("ImageLayer", () => {
	let testImage;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
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

	describe("preDraw delegates flip / mask / post-effects", () => {
		// Build a tiny renderer stub that captures the high-level calls we want
		// to assert on. Anything not listed here is a no-op spy.
		function makeRendererStub() {
			return {
				save: vi.fn(),
				translate: vi.fn(),
				scale: vi.fn(),
				setMask: vi.fn(),
				beginPostEffect: vi.fn(),
				setTint: vi.fn(),
				setBlendMode: vi.fn(),
				setGlobalAlpha: vi.fn(),
				globalAlpha: vi.fn(() => {
					return 1;
				}),
				getBlendMode: vi.fn(() => {
					return "normal";
				}),
			};
		}

		function makeLayer() {
			const layer = new ImageLayer(0, 0, {
				image: testImage,
				name: "test",
				repeat: "no-repeat",
			});
			// avoid any hidden GPU side-effects from world activation
			layer.width = 64;
			layer.height = 64;
			return layer;
		}

		it("calls renderer.setMask when this.mask is set", () => {
			const layer = makeLayer();
			layer.mask = new Rect(0, 0, 32, 32);
			const r = makeRendererStub();
			layer.preDraw(r);
			expect(r.setMask).toHaveBeenCalledWith(layer.mask);
		});

		it("does not call setMask when this.mask is undefined", () => {
			const layer = makeLayer();
			const r = makeRendererStub();
			layer.preDraw(r);
			expect(r.setMask).not.toHaveBeenCalled();
		});

		it("calls renderer.beginPostEffect (post-effects path)", () => {
			const layer = makeLayer();
			const r = makeRendererStub();
			layer.preDraw(r);
			expect(r.beginPostEffect).toHaveBeenCalledWith(layer);
		});

		it("skips beginPostEffect when _postEffectManaged is true", () => {
			const layer = makeLayer();
			layer._postEffectManaged = true;
			const r = makeRendererStub();
			layer.preDraw(r);
			expect(r.beginPostEffect).not.toHaveBeenCalled();
		});

		it("applies horizontal flip via renderer.scale(-1, 1)", () => {
			const layer = makeLayer();
			layer.flipX(true);
			const r = makeRendererStub();
			layer.preDraw(r);
			// expect a scale call with x = -1
			const flipCall = r.scale.mock.calls.find((args) => {
				return args[0] === -1 && args[1] === 1;
			});
			expect(flipCall).toBeDefined();
		});

		it("applies vertical flip via renderer.scale(1, -1)", () => {
			const layer = makeLayer();
			layer.flipY(true);
			const r = makeRendererStub();
			layer.preDraw(r);
			const flipCall = r.scale.mock.calls.find((args) => {
				return args[0] === 1 && args[1] === -1;
			});
			expect(flipCall).toBeDefined();
		});
	});
});
