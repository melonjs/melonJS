import { beforeAll, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";
import TMXHexagonalRenderer from "../src/level/tiled/renderer/TMXHexagonalRenderer.js";
import TMXIsometricRenderer from "../src/level/tiled/renderer/TMXIsometricRenderer.js";
import TMXObliqueRenderer from "../src/level/tiled/renderer/TMXObliqueRenderer.js";
import TMXOrthogonalRenderer from "../src/level/tiled/renderer/TMXOrthogonalRenderer.js";
import TMXStaggeredRenderer from "../src/level/tiled/renderer/TMXStaggeredRenderer.js";
import Tile from "../src/level/tiled/TMXTile.js";
import TMXTileset from "../src/level/tiled/TMXTileset.js";
import { imgList } from "../src/loader/cache.js";

// helper to create a fake image in the loader cache
function fakeImage(name, w = 64, h = 64) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	imgList[name] = canvas;
	return canvas;
}

describe("TMX Renderers", () => {
	beforeAll(() => {
		boot();
		video.init(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		fakeImage("drawtest", 256, 256);
	});

	// mock map object for constructors
	function mockMap(overrides = {}) {
		return {
			cols: 10,
			rows: 10,
			tilewidth: 32,
			tileheight: 32,
			orientation: "orthogonal",
			staggeraxis: "y",
			staggerindex: "odd",
			hexsidelength: 0,
			...overrides,
		};
	}

	describe("TMXOrthogonalRenderer", () => {
		let renderer;

		beforeAll(() => {
			renderer = new TMXOrthogonalRenderer(mockMap());
		});

		it("pixelToTileCoords should convert pixel to tile coordinates", () => {
			const result = renderer.pixelToTileCoords(64, 96);
			expect(result.x).toEqual(2);
			expect(result.y).toEqual(3);
		});

		it("tileToPixelCoords should convert tile to pixel coordinates", () => {
			const result = renderer.tileToPixelCoords(2, 3);
			expect(result.x).toEqual(64);
			expect(result.y).toEqual(96);
		});

		it("pixelToTileCoords should reuse provided vector", () => {
			const v = renderer.pixelToTileCoords(0, 0);
			const result = renderer.pixelToTileCoords(32, 32, v);
			expect(result).toBe(v);
			expect(result.x).toEqual(1);
			expect(result.y).toEqual(1);
		});

		it("adjustPosition should offset y by height for gid objects", () => {
			const obj = { gid: 1, x: 10, y: 50, height: 32 };
			renderer.adjustPosition(obj);
			expect(obj.y).toEqual(18);
		});

		it("adjustPosition should not modify objects without gid", () => {
			const obj = { x: 10, y: 50, height: 32 };
			renderer.adjustPosition(obj);
			expect(obj.y).toEqual(50);
		});

		it("getBounds should return correct map bounds", () => {
			const bounds = renderer.getBounds();
			expect(bounds.width).toEqual(320);
			expect(bounds.height).toEqual(320);
		});
	});

	describe("TMXIsometricRenderer", () => {
		let renderer;

		beforeAll(() => {
			renderer = new TMXIsometricRenderer(
				mockMap({ orientation: "isometric" }),
			);
		});

		it("pixelToTileCoords and tileToPixelCoords should be inverse operations", () => {
			const tileX = 3;
			const tileY = 5;
			const pixel = renderer.tileToPixelCoords(tileX, tileY);
			const tile = renderer.pixelToTileCoords(pixel.x, pixel.y);
			expect(Math.round(tile.x)).toEqual(tileX);
			expect(Math.round(tile.y)).toEqual(tileY);
		});

		it("getBounds should return correct isometric bounds", () => {
			const bounds = renderer.getBounds();
			// (cols + rows) * (tilewidth / 2) = 20 * 16 = 320
			expect(bounds.width).toEqual(320);
			// (cols + rows) * (tileheight / 2) = 20 * 16 = 320
			expect(bounds.height).toEqual(320);
		});

		it("adjustPosition should use isometric coordinate conversion", () => {
			const obj = { x: 32, y: 32 };
			renderer.adjustPosition(obj);
			// isometric adjustPosition converts coordinates differently
			expect(obj.x).not.toEqual(32);
		});
	});

	describe("TMXHexagonalRenderer", () => {
		let renderer;

		beforeAll(() => {
			renderer = new TMXHexagonalRenderer(
				mockMap({
					orientation: "hexagonal",
					hexsidelength: 16,
					staggeraxis: "y",
					staggerindex: "odd",
				}),
			);
		});

		it("pixelToTileCoords should not mutate internal centers array", () => {
			// This verifies the critical bug fix:
			// previously this.centers[i].sub(rel) mutated the centers

			// Call pixelToTileCoords to trigger center calculations
			renderer.pixelToTileCoords(50, 50);

			// Save centers values after first call
			const centersAfterFirst = renderer.centers.map((c) => {
				return { x: c.x, y: c.y };
			});

			// Call again — centers should be re-set to the same values
			renderer.pixelToTileCoords(50, 50);

			// Verify centers were not mutated by the distance calculation
			for (let i = 0; i < 4; i++) {
				expect(renderer.centers[i].x).toEqual(centersAfterFirst[i].x);
				expect(renderer.centers[i].y).toEqual(centersAfterFirst[i].y);
			}
		});

		it("pixelToTileCoords should return consistent results (staggerX)", () => {
			const staggerXRenderer = new TMXHexagonalRenderer(
				mockMap({
					orientation: "hexagonal",
					hexsidelength: 16,
					staggeraxis: "x",
					staggerindex: "even",
				}),
			);

			const result1 = staggerXRenderer.pixelToTileCoords(100, 100);
			const result2 = staggerXRenderer.pixelToTileCoords(100, 100);

			expect(result1.x).toEqual(result2.x);
			expect(result1.y).toEqual(result2.y);
		});

		it("tileToPixelCoords should return correct coordinates", () => {
			const result = renderer.tileToPixelCoords(0, 0);
			expect(result.x).toEqual(0);
			expect(result.y).toEqual(0);
		});

		it("doStaggerX and doStaggerY should return correct stagger values", () => {
			// staggeraxis = "y", so doStaggerX should return falsy
			expect(renderer.doStaggerX(1)).toBeFalsy();

			// staggerindex = "odd", staggerEven = false
			// doStaggerY for odd row (1): !staggerX && (1 & 1) ^ 0 = truthy
			expect(renderer.doStaggerY(1)).toBeTruthy();
			// doStaggerY for even row (0): !staggerX && (0 & 1) ^ 0 = falsy
			expect(renderer.doStaggerY(0)).toBeFalsy();
		});

		it("adjustPosition should be inherited from base TMXRenderer", () => {
			const obj = { gid: 1, x: 10, y: 50, height: 32 };
			renderer.adjustPosition(obj);
			expect(obj.y).toEqual(18);
		});
	});

	describe("TMXStaggeredRenderer", () => {
		let renderer;

		beforeAll(() => {
			renderer = new TMXStaggeredRenderer(
				mockMap({
					orientation: "staggered",
					staggeraxis: "y",
					staggerindex: "odd",
				}),
			);
		});

		it("pixelToTileCoords should return consistent results", () => {
			const result1 = renderer.pixelToTileCoords(80, 80);
			const result2 = renderer.pixelToTileCoords(80, 80);

			expect(result1.x).toEqual(result2.x);
			expect(result1.y).toEqual(result2.y);
		});
	});

	// ==============================================================
	// drawTile with tilerendersize/fillmode across renderers
	// ==============================================================
	describe("drawTile with tilerendersize/fillmode", () => {
		// spy renderer that captures drawImage calls
		function spyRenderer() {
			const calls = [];
			return {
				calls,
				drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
					calls.push({ sx, sy, sw, sh, dx, dy, dw, dh });
				},
				save() {},
				restore() {},
				translate() {},
				transform() {},
				uvOffset: 0,
			};
		}

		// create a tileset with given overrides and map grid size
		function makeTileset(overrides, mapTw, mapTh) {
			return new TMXTileset(
				{
					firstgid: 1,
					name: "drawtest",
					tilewidth: 48,
					tileheight: 48,
					spacing: 0,
					margin: 0,
					tilecount: 16,
					columns: 4,
					image: "drawtest.png",
					...overrides,
				},
				mapTw,
				mapTh,
			);
		}

		describe("TMXOrthogonalRenderer.drawTile", () => {
			it("should draw oversize tile at native size with tilerendersize='tile'", () => {
				const ts = makeTileset({}, 32, 32);
				const tile = new Tile(0, 0, 1, ts);
				const spy = spyRenderer();
				const ortho = new TMXOrthogonalRenderer(mockMap());
				ortho.drawTile(spy, 0, 0, tile);
				expect(spy.calls.length).toEqual(1);
				// native tile size: 48x48
				expect(spy.calls[0].dw).toEqual(48);
				expect(spy.calls[0].dh).toEqual(48);
			});

			it("should scale tile to grid size with tilerendersize='grid' stretch", () => {
				const ts = makeTileset({ tilerendersize: "grid" }, 32, 32);
				const tile = new Tile(0, 0, 1, ts);
				const spy = spyRenderer();
				const ortho = new TMXOrthogonalRenderer(mockMap());
				ortho.drawTile(spy, 0, 0, tile);
				expect(spy.calls.length).toEqual(1);
				expect(spy.calls[0].dw).toBeCloseTo(32);
				expect(spy.calls[0].dh).toBeCloseTo(32);
			});

			it("should use uniform scale with preserve-aspect-fit", () => {
				// 48x48 tile on 32x16 grid → min(32/48, 16/48) = 1/3
				const ts = makeTileset(
					{ tilerendersize: "grid", fillmode: "preserve-aspect-fit" },
					32,
					16,
				);
				const tile = new Tile(0, 0, 1, ts);
				const spy = spyRenderer();
				const ortho = new TMXOrthogonalRenderer(
					mockMap({ tilewidth: 32, tileheight: 16 }),
				);
				ortho.drawTile(spy, 0, 0, tile);
				expect(spy.calls.length).toEqual(1);
				expect(spy.calls[0].dw).toBeCloseTo(16);
				expect(spy.calls[0].dh).toBeCloseTo(16);
			});
		});

		describe("TMXIsometricRenderer.drawTile", () => {
			it("should draw at native size with tilerendersize='tile'", () => {
				const ts = makeTileset({}, 32, 32);
				const tile = new Tile(0, 0, 1, ts);
				const spy = spyRenderer();
				const iso = new TMXIsometricRenderer(
					mockMap({ orientation: "isometric" }),
				);
				iso.drawTile(spy, 0, 0, tile);
				expect(spy.calls.length).toEqual(1);
				expect(spy.calls[0].dw).toEqual(48);
				expect(spy.calls[0].dh).toEqual(48);
			});

			it("should scale tile to grid size with tilerendersize='grid'", () => {
				const ts = makeTileset({ tilerendersize: "grid" }, 32, 32);
				const tile = new Tile(0, 0, 1, ts);
				const spy = spyRenderer();
				const iso = new TMXIsometricRenderer(
					mockMap({ orientation: "isometric" }),
				);
				iso.drawTile(spy, 0, 0, tile);
				expect(spy.calls.length).toEqual(1);
				expect(spy.calls[0].dw).toBeCloseTo(32);
				expect(spy.calls[0].dh).toBeCloseTo(32);
			});
		});

		describe("TMXHexagonalRenderer.drawTile", () => {
			it("should draw at native size with tilerendersize='tile'", () => {
				const ts = makeTileset({}, 32, 32);
				const tile = new Tile(0, 0, 1, ts);
				const spy = spyRenderer();
				const hex = new TMXHexagonalRenderer(
					mockMap({
						orientation: "hexagonal",
						hexsidelength: 16,
						staggeraxis: "y",
						staggerindex: "odd",
					}),
				);
				hex.drawTile(spy, 0, 0, tile);
				expect(spy.calls.length).toEqual(1);
				expect(spy.calls[0].dw).toEqual(48);
				expect(spy.calls[0].dh).toEqual(48);
			});

			it("should scale tile to grid size with tilerendersize='grid'", () => {
				const ts = makeTileset({ tilerendersize: "grid" }, 32, 32);
				const tile = new Tile(0, 0, 1, ts);
				const spy = spyRenderer();
				const hex = new TMXHexagonalRenderer(
					mockMap({
						orientation: "hexagonal",
						hexsidelength: 16,
						staggeraxis: "y",
						staggerindex: "odd",
					}),
				);
				hex.drawTile(spy, 0, 0, tile);
				expect(spy.calls.length).toEqual(1);
				expect(spy.calls[0].dw).toBeCloseTo(32);
				expect(spy.calls[0].dh).toBeCloseTo(32);
			});
		});
	});

	// ==============================================================
	// TMXObliqueRenderer (Tiled 1.12+)
	// ==============================================================
	describe("TMXObliqueRenderer", () => {
		function obliqueMap(skewx = 16, skewy = 0) {
			return {
				...mockMap({ orientation: "oblique" }),
				skewx,
				skewy,
			};
		}

		it("should store skew values from map", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 8));
			expect(renderer.skewX).toEqual(16);
			expect(renderer.skewY).toEqual(8);
		});

		it("should compute shear factors", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			// shearX = 16 / 32 = 0.5
			expect(renderer.shearX).toBeCloseTo(0.5);
			expect(renderer.shearY).toBeCloseTo(0);
		});

		it("pixelToTileCoords should inverse the shear transform", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			// tile (2, 3) → pixel = (2*32 + 0.5*3*32, 3*32) = (64+48, 96) = (112, 96)
			const pixel = renderer.tileToPixelCoords(2, 3);
			const tile = renderer.pixelToTileCoords(pixel.x, pixel.y);
			expect(tile.x).toBeCloseTo(2);
			expect(tile.y).toBeCloseTo(3);
		});

		it("tileToPixelCoords should apply skew offset", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			// tile (0, 1): pixel.x = 0 + shearX * 32 = 16, pixel.y = 32
			const result = renderer.tileToPixelCoords(0, 1);
			expect(result.x).toBeCloseTo(16);
			expect(result.y).toBeCloseTo(32);
		});

		it("tileToPixelCoords with skewy should apply vertical offset", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(0, 16));
			// tile (1, 0): pixel.x = 32, pixel.y = 0 + shearY * 32 = 16
			const result = renderer.tileToPixelCoords(1, 0);
			expect(result.x).toBeCloseTo(32);
			expect(result.y).toBeCloseTo(16);
		});

		it("pixelToTileCoords and tileToPixelCoords should be inverse (both skews)", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 8));
			const tileX = 5;
			const tileY = 3;
			const pixel = renderer.tileToPixelCoords(tileX, tileY);
			const tile = renderer.pixelToTileCoords(pixel.x, pixel.y);
			expect(tile.x).toBeCloseTo(tileX);
			expect(tile.y).toBeCloseTo(tileY);
		});

		it("getBounds should account for skew", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			const bounds = renderer.getBounds();
			// width should be > cols * tilewidth due to skew
			expect(bounds.width).toBeGreaterThan(10 * 32);
			// height should be rows * tileheight (no skewy)
			expect(bounds.height).toEqual(10 * 32);
		});

		it("getBounds with both skews should be larger than orthogonal", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 8));
			const bounds = renderer.getBounds();
			expect(bounds.width).toBeGreaterThan(10 * 32);
			expect(bounds.height).toBeGreaterThan(10 * 32);
		});

		it("should handle zero skew (equivalent to orthogonal)", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(0, 0));
			const result = renderer.tileToPixelCoords(3, 5);
			expect(result.x).toBeCloseTo(3 * 32);
			expect(result.y).toBeCloseTo(5 * 32);
		});

		it("pixelToTileCoords should reuse provided vector", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			const v = renderer.pixelToTileCoords(0, 0);
			const result = renderer.pixelToTileCoords(32, 32, v);
			expect(result).toBe(v);
		});

		it("tileToPixelCoords should reuse provided vector", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			const v = renderer.tileToPixelCoords(0, 0);
			const result = renderer.tileToPixelCoords(1, 1, v);
			expect(result).toBe(v);
		});

		it("should handle negative skewx", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(-16, 0));
			expect(renderer.skewX).toEqual(-16);
			expect(renderer.shearX).toBeCloseTo(-0.5);
			// tile (0, 1): pixel.x = 0 + (-0.5)*32 = -16
			const result = renderer.tileToPixelCoords(0, 1);
			expect(result.x).toBeCloseTo(-16);
			expect(result.y).toBeCloseTo(32);
		});

		it("should handle negative skewy", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(0, -8));
			expect(renderer.skewY).toEqual(-8);
			const result = renderer.tileToPixelCoords(1, 0);
			expect(result.x).toBeCloseTo(32);
			expect(result.y).toBeCloseTo(-8);
		});

		it("inverse should work with negative skew", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(-10, -5));
			const pixel = renderer.tileToPixelCoords(7, 4);
			const tile = renderer.pixelToTileCoords(pixel.x, pixel.y);
			expect(tile.x).toBeCloseTo(7);
			expect(tile.y).toBeCloseTo(4);
		});

		it("getBounds with negative skew should expand correctly", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(-16, 0));
			const bounds = renderer.getBounds();
			expect(bounds.width).toBeGreaterThan(10 * 32);
		});

		it("canRender should accept oblique orientation", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			expect(
				renderer.canRender({
					orientation: "oblique",
					tilewidth: 32,
					tileheight: 32,
				}),
			).toEqual(true);
		});

		it("canRender should reject non-oblique orientation", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			expect(
				renderer.canRender({
					orientation: "orthogonal",
					tilewidth: 32,
					tileheight: 32,
				}),
			).toEqual(false);
		});

		it("drawTile should apply skew offset to tile position", () => {
			const ts = new TMXTileset(
				{
					firstgid: 1,
					name: "drawtest",
					tilewidth: 48,
					tileheight: 48,
					spacing: 0,
					margin: 0,
					tilecount: 16,
					columns: 4,
					image: "drawtest.png",
				},
				32,
				32,
			);
			const tile = new Tile(0, 0, 1, ts);
			const spy = {
				calls: [],
				drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
					spy.calls.push({ dx, dy, dw, dh });
				},
				save() {},
				restore() {},
				translate() {},
				transform() {},
				uvOffset: 0,
			};
			const renderer = new TMXObliqueRenderer(obliqueMap(16, 0));
			// draw tile at grid (0, 5) — dx should include skewX * 5 = 80
			renderer.drawTile(spy, 0, 5, tile);
			expect(spy.calls.length).toEqual(1);
			expect(spy.calls[0].dx).toBeCloseTo(80);
		});

		it("origin tile (0,0) position should match orthogonal when no skew", () => {
			const renderer = new TMXObliqueRenderer(obliqueMap(0, 0));
			const ortho = new TMXOrthogonalRenderer(mockMap());
			// tileToPixelCoords should match
			const oblResult = renderer.tileToPixelCoords(3, 5);
			const ortResult = ortho.tileToPixelCoords(3, 5);
			expect(oblResult.x).toBeCloseTo(ortResult.x);
			expect(oblResult.y).toBeCloseTo(ortResult.y);
		});
	});
});
