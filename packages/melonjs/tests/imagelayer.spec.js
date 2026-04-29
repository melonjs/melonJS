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

	describe("preDraw delegates post-effects", () => {
		// Build a tiny renderer stub that captures the high-level calls we want
		// to assert on. Anything not listed here is a no-op spy.
		function makeRendererStub() {
			return {
				save: vi.fn(),
				translate: vi.fn(),
				scale: vi.fn(),
				setMask: vi.fn(),
				beginPostEffect: vi.fn(),
				drawPattern: vi.fn(),
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
			layer.width = 64;
			layer.height = 64;
			return layer;
		}

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

		it("preDraw does NOT call setMask or scale (deferred to draw)", () => {
			// flip/mask must NOT be applied in preDraw — they need to run in
			// the post-zoom local frame, which only exists inside draw().
			const layer = makeLayer();
			layer.mask = new Rect(0, 0, 32, 32);
			layer.flipX(true);
			const r = makeRendererStub();
			layer.preDraw(r);
			expect(r.setMask).not.toHaveBeenCalled();
			expect(r.scale).not.toHaveBeenCalled();
		});
	});

	describe("draw applies flip / mask in the post-zoom local frame", () => {
		function makeRendererStub() {
			return {
				save: vi.fn(),
				translate: vi.fn(),
				scale: vi.fn(),
				setMask: vi.fn(),
				drawPattern: vi.fn(),
			};
		}

		function makeLayer() {
			const layer = new ImageLayer(0, 0, {
				image: testImage,
				name: "test",
				repeat: "no-repeat",
			});
			layer.width = 64;
			layer.height = 64;
			return layer;
		}

		function makeViewport({ zoom = 1, width = 800, height = 600 } = {}) {
			return {
				zoom,
				width,
				height,
				pos: { x: 0, y: 0 },
				bounds: { width, height },
			};
		}

		it("calls renderer.setMask in draw when this.mask is set", () => {
			const layer = makeLayer();
			layer.mask = new Rect(0, 0, 32, 32);
			const r = makeRendererStub();
			layer.draw(r, makeViewport());
			expect(r.setMask).toHaveBeenCalledWith(layer.mask);
		});

		it("does not call setMask when this.mask is undefined", () => {
			const layer = makeLayer();
			const r = makeRendererStub();
			layer.draw(r, makeViewport());
			expect(r.setMask).not.toHaveBeenCalled();
		});

		it("applies horizontal flip via renderer.scale(-1, 1)", () => {
			const layer = makeLayer();
			layer.flipX(true);
			const r = makeRendererStub();
			layer.draw(r, makeViewport());
			const flipCall = r.scale.mock.calls.find((args) => {
				return args[0] === -1 && args[1] === 1;
			});
			expect(flipCall).toBeDefined();
		});

		it("applies vertical flip via renderer.scale(1, -1)", () => {
			const layer = makeLayer();
			layer.flipY(true);
			const r = makeRendererStub();
			layer.draw(r, makeViewport());
			const flipCall = r.scale.mock.calls.find((args) => {
				return args[0] === 1 && args[1] === -1;
			});
			expect(flipCall).toBeDefined();
		});

		it("applies both axes via renderer.scale(-1, -1) when flipX and flipY are set", () => {
			const layer = makeLayer();
			layer.flipX(true);
			layer.flipY(true);
			const r = makeRendererStub();
			layer.draw(r, makeViewport());
			const flipCall = r.scale.mock.calls.find((args) => {
				return args[0] === -1 && args[1] === -1;
			});
			expect(flipCall).toBeDefined();
		});

		it("flip pivot uses (viewport.width, viewport.height) — the centre of the drawn pattern", () => {
			// The pivot has to be at the centre of the drawPattern destination
			// rect (which is 0..viewport.width*2, 0..viewport.height*2 in the
			// post-zoom local frame). Asserting the pivot location explicitly
			// guards against accidentally regressing to e.g. (centerX, centerY)
			// which would be wrong post-zoom.
			const layer = makeLayer();
			layer.flipX(true);
			const viewport = makeViewport({ width: 800, height: 600 });
			const r = makeRendererStub();
			const events = [];
			r.translate.mockImplementation((...args) => {
				events.push({ kind: "translate", args });
			});
			r.scale.mockImplementation((...args) => {
				events.push({ kind: "scale", args });
			});

			layer.draw(r, viewport);

			// locate the flip scale, then check the immediately surrounding translates
			const flipScaleIdx = events.findIndex((e) => {
				return e.kind === "scale" && e.args[0] === -1 && e.args[1] === 1;
			});
			expect(flipScaleIdx).toBeGreaterThan(0);

			const before = events[flipScaleIdx - 1];
			const after = events[flipScaleIdx + 1];
			expect(before).toEqual({
				kind: "translate",
				args: [viewport.width, viewport.height],
			});
			expect(after).toEqual({
				kind: "translate",
				args: [-viewport.width, -viewport.height],
			});
		});

		it("flip pivot is set up after the zoom transforms (call ordering)", () => {
			// the zoom translate(x*vZoom, y*vZoom) and scale(vZoom, vZoom) must
			// be issued *before* the flip translate/scale pair — otherwise the
			// flip ends up in the wrong local frame for non-1 zoom.
			const layer = makeLayer();
			layer.flipX(true);
			const r = makeRendererStub();
			const events = [];
			r.translate.mockImplementation((...args) => {
				events.push({ kind: "translate", args });
			});
			r.scale.mockImplementation((...args) => {
				events.push({ kind: "scale", args });
			});

			layer.draw(r, makeViewport({ zoom: 2 }));

			// expected order: zoom-scale → flip-translate → flip-scale → flip-untranslate
			const zoomScaleIdx = events.findIndex((e) => {
				return e.kind === "scale" && e.args[0] === 2 && e.args[1] === 2;
			});
			const flipScaleIdx = events.findIndex((e) => {
				return e.kind === "scale" && e.args[0] === -1 && e.args[1] === 1;
			});
			expect(zoomScaleIdx).toBeGreaterThanOrEqual(0);
			expect(flipScaleIdx).toBeGreaterThan(zoomScaleIdx);
		});

		it("setMask is issued after the zoom transforms", () => {
			const layer = makeLayer();
			layer.mask = new Rect(0, 0, 32, 32);
			const r = makeRendererStub();
			const events = [];
			r.translate.mockImplementation(() => {
				events.push("translate");
			});
			r.scale.mockImplementation(() => {
				events.push("scale");
			});
			r.setMask.mockImplementation(() => {
				events.push("setMask");
			});

			layer.draw(r, makeViewport({ zoom: 2 }));

			// the zoom block emits translate + scale; setMask must come after
			const zoomScaleIdx = events.indexOf("scale");
			const setMaskIdx = events.indexOf("setMask");
			expect(zoomScaleIdx).toBeGreaterThanOrEqual(0);
			expect(setMaskIdx).toBeGreaterThan(zoomScaleIdx);
		});
	});
});
