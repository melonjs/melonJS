import { beforeAll, describe, expect, it, vi } from "vitest";
import { boot, game, ImageLayer, Matrix2d, Rect, video } from "../src/index.js";

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

	describe("draw screen-space transform math (replays renderer calls)", () => {
		// Replays the recorded translate/scale calls into a real Matrix2d,
		// then applies the matrix to the corners of `drawPattern(0,0,W*2,H*2)`
		// to compute their final screen-space positions. This tests the actual
		// composed transform — not just that individual calls happened.
		function replayInto(matrix, events) {
			for (const e of events) {
				if (e.kind === "translate") {
					matrix.translate(e.args[0], e.args[1]);
				} else if (e.kind === "scale") {
					matrix.scale(e.args[0], e.args[1]);
				}
			}
			return matrix;
		}

		function makeRendererStub(events) {
			return {
				save: vi.fn(),
				translate: vi.fn((x, y) => {
					events.push({ kind: "translate", args: [x, y] });
				}),
				scale: vi.fn((x, y) => {
					events.push({ kind: "scale", args: [x, y] });
				}),
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
			// pin the layer geometry — `pos = (0,0)`, anchor `(0,0)`, ratio `(0,0)`
			// (static), so the computed `x` / `y` in draw() are both 0
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

		// Corners of drawPattern's destination rect in local coordinates,
		// before any of the recorded transforms are applied. drawPattern is
		// always called with `(0, 0, viewport.width * 2, viewport.height * 2)`.
		function corners(viewport) {
			const W2 = viewport.width * 2;
			const H2 = viewport.height * 2;
			return {
				topLeft: { x: 0, y: 0 },
				topRight: { x: W2, y: 0 },
				bottomLeft: { x: 0, y: H2 },
				bottomRight: { x: W2, y: H2 },
			};
		}

		// At pos=(0,0) anchor=(0,0) static, the unflipped pattern occupies
		// the screen-space rect (0, 0) → (W*2*Z, H*2*Z).
		function expectedUnflipped(viewport) {
			const W2 = viewport.width * 2;
			const H2 = viewport.height * 2;
			const Z = viewport.zoom;
			return {
				topLeft: { x: 0, y: 0 },
				topRight: { x: W2 * Z, y: 0 },
				bottomLeft: { x: 0, y: H2 * Z },
				bottomRight: { x: W2 * Z, y: H2 * Z },
			};
		}

		function transformCorners(matrix, c) {
			const out = {};
			for (const k of Object.keys(c)) {
				out[k] = { x: c[k].x, y: c[k].y };
				matrix.apply(out[k]);
			}
			return out;
		}

		function expectClose(actual, expected) {
			expect(actual.x).toBeCloseTo(expected.x, 6);
			expect(actual.y).toBeCloseTo(expected.y, 6);
		}

		it("zoom=1, no flip: pattern occupies (0,0) → (2W, 2H) in screen space", () => {
			const events = [];
			const layer = makeLayer();
			const viewport = makeViewport({ zoom: 1 });
			layer.draw(makeRendererStub(events), viewport);

			const actual = transformCorners(
				replayInto(new Matrix2d(), events),
				corners(viewport),
			);
			const exp = expectedUnflipped(viewport);
			expectClose(actual.topLeft, exp.topLeft);
			expectClose(actual.topRight, exp.topRight);
			expectClose(actual.bottomLeft, exp.bottomLeft);
			expectClose(actual.bottomRight, exp.bottomRight);
		});

		it("zoom=2, no flip: pattern occupies (0,0) → (2W*2, 2H*2) in screen space", () => {
			const events = [];
			const layer = makeLayer();
			const viewport = makeViewport({ zoom: 2 });
			layer.draw(makeRendererStub(events), viewport);

			const actual = transformCorners(
				replayInto(new Matrix2d(), events),
				corners(viewport),
			);
			const exp = expectedUnflipped(viewport);
			expectClose(actual.topLeft, exp.topLeft);
			expectClose(actual.topRight, exp.topRight);
			expectClose(actual.bottomLeft, exp.bottomLeft);
			expectClose(actual.bottomRight, exp.bottomRight);
		});

		it("flipX at zoom=1: covers SAME screen rect as unflipped, but corners swap horizontally", () => {
			const events = [];
			const layer = makeLayer();
			layer.flipX(true);
			const viewport = makeViewport({ zoom: 1 });
			layer.draw(makeRendererStub(events), viewport);

			const actual = transformCorners(
				replayInto(new Matrix2d(), events),
				corners(viewport),
			);
			const exp = expectedUnflipped(viewport);

			// the screen-space footprint is identical (mirror, not translate)
			const actualXs = [
				actual.topLeft.x,
				actual.topRight.x,
				actual.bottomLeft.x,
				actual.bottomRight.x,
			];
			const expectedXs = [
				exp.topLeft.x,
				exp.topRight.x,
				exp.bottomLeft.x,
				exp.bottomRight.x,
			];
			expect(Math.min(...actualXs)).toBeCloseTo(Math.min(...expectedXs), 6);
			expect(Math.max(...actualXs)).toBeCloseTo(Math.max(...expectedXs), 6);

			// the LEFT corner of the original rect now maps to the RIGHT side
			expectClose(actual.topLeft, exp.topRight);
			expectClose(actual.topRight, exp.topLeft);
			expectClose(actual.bottomLeft, exp.bottomRight);
			expectClose(actual.bottomRight, exp.bottomLeft);
		});

		it("flipX at zoom=2: still covers the SAME screen rect (this is the fix)", () => {
			// Regression test for the original bug: at non-1 zoom, the pre-zoom
			// flip pivot would land in the wrong screen-space location.
			// With flip moved to draw() (post-zoom), the mirrored pattern still
			// occupies the SAME screen rect as the unflipped pattern at zoom=2.
			const events = [];
			const layer = makeLayer();
			layer.flipX(true);
			const viewport = makeViewport({ zoom: 2 });
			layer.draw(makeRendererStub(events), viewport);

			const actual = transformCorners(
				replayInto(new Matrix2d(), events),
				corners(viewport),
			);
			const exp = expectedUnflipped(viewport);

			const actualXs = [
				actual.topLeft.x,
				actual.topRight.x,
				actual.bottomLeft.x,
				actual.bottomRight.x,
			];
			const expectedXs = [
				exp.topLeft.x,
				exp.topRight.x,
				exp.bottomLeft.x,
				exp.bottomRight.x,
			];
			expect(Math.min(...actualXs)).toBeCloseTo(Math.min(...expectedXs), 6);
			expect(Math.max(...actualXs)).toBeCloseTo(Math.max(...expectedXs), 6);
		});

		it("flipY at zoom=2: covers SAME screen rect (vertical mirror)", () => {
			const events = [];
			const layer = makeLayer();
			layer.flipY(true);
			const viewport = makeViewport({ zoom: 2 });
			layer.draw(makeRendererStub(events), viewport);

			const actual = transformCorners(
				replayInto(new Matrix2d(), events),
				corners(viewport),
			);
			const exp = expectedUnflipped(viewport);

			const actualYs = [
				actual.topLeft.y,
				actual.topRight.y,
				actual.bottomLeft.y,
				actual.bottomRight.y,
			];
			const expectedYs = [
				exp.topLeft.y,
				exp.topRight.y,
				exp.bottomLeft.y,
				exp.bottomRight.y,
			];
			expect(Math.min(...actualYs)).toBeCloseTo(Math.min(...expectedYs), 6);
			expect(Math.max(...actualYs)).toBeCloseTo(Math.max(...expectedYs), 6);
		});

		it("flipX+flipY at zoom=2: corners rotate 180° around the rect centre", () => {
			const events = [];
			const layer = makeLayer();
			layer.flipX(true);
			layer.flipY(true);
			const viewport = makeViewport({ zoom: 2 });
			layer.draw(makeRendererStub(events), viewport);

			const actual = transformCorners(
				replayInto(new Matrix2d(), events),
				corners(viewport),
			);
			const exp = expectedUnflipped(viewport);

			// top-left ↔ bottom-right, top-right ↔ bottom-left
			expectClose(actual.topLeft, exp.bottomRight);
			expectClose(actual.topRight, exp.bottomLeft);
			expectClose(actual.bottomLeft, exp.topRight);
			expectClose(actual.bottomRight, exp.topLeft);
		});
	});
});
