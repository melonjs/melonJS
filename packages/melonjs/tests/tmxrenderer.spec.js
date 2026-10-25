import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";
import TMXHexagonalRenderer from "../src/level/tiled/renderer/TMXHexagonalRenderer.js";
import TMXIsometricRenderer from "../src/level/tiled/renderer/TMXIsometricRenderer.js";
import TMXObliqueRenderer from "../src/level/tiled/renderer/TMXObliqueRenderer.js";
import TMXOrthogonalRenderer from "../src/level/tiled/renderer/TMXOrthogonalRenderer.js";
import TMXStaggeredRenderer from "../src/level/tiled/renderer/TMXStaggeredRenderer.js";
import Tile from "../src/level/tiled/TMXTile.js";
import TMXTileset from "../src/level/tiled/TMXTileset.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";

// helper to create a fake image in the loader cache
function fakeImage(name, w = 64, h = 64) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	imgList[name] = canvas;
	return canvas;
}

describe("TMX Renderers", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
		fakeImage("drawtest", 256, 256);
	});

	afterAll(() => {
		// release the WebGL context this describe owns — browsers cap
		// live contexts, and a leak surfaces as UNRELATED specs failing
		app?.destroy();
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

		describe("adjustPosition matches Tiled", () => {
			// 4x4 map with 186x108 tiles, the expected values are where Tiled
			// draws these objects (tmxrasterizer), with the map's left corner at x = 0
			let iso;

			beforeAll(() => {
				iso = new TMXIsometricRenderer(
					mockMap({
						orientation: "isometric",
						cols: 4,
						rows: 4,
						tilewidth: 186,
						tileheight: 108,
					}),
				);
			});

			it("should project object positions in tileheight units on both axes", () => {
				const obj = { x: 54, y: 54 };
				iso.adjustPosition(obj);
				expect(obj.x).toBeCloseTo(372);
				expect(obj.y).toBeCloseTo(54);
			});

			it("should align tile objects to their bottom center", () => {
				const obj = { gid: 2, x: 162, y: 54, width: 40, height: 40 };
				iso.adjustPosition(obj);
				// Tiled draws this 40x40 tile from (445, 68) to (484, 107)
				expect(obj.x).toBeCloseTo(445);
				expect(obj.y).toBeCloseTo(68);
			});

			it("should align tile objects by their tileset's objectalignment", () => {
				// the same object projects to (465, 108), the point its
				// tileset's alignment puts on the map
				const place = (objectalignment) => {
					const obj = {
						gid: 2,
						x: 162,
						y: 54,
						width: 40,
						height: 40,
						tile: { tileset: { objectalignment } },
					};
					iso.adjustPosition(obj);
					return [obj.x, obj.y];
				};
				expect(place("topleft")).toEqual([465, 108]);
				expect(place("center")).toEqual([445, 88]);
				expect(place("bottomright")).toEqual([425, 68]);
				// unspecified, or a value Tiled does not know, is the bottom center
				expect(place("unspecified")).toEqual([445, 68]);
				expect(place("middle")).toEqual([445, 68]);
			});

			it("should turn a rotated tile object about the point its tileset aligns", () => {
				// melonJS turns the sprite and body about their top left, so that
				// corner must sit where Tiled's turn about (465, 108) leaves it
				const place = (objectalignment, degrees) => {
					const obj = {
						gid: 2,
						x: 162,
						y: 54,
						width: 40,
						height: 40,
						rotation: (degrees * Math.PI) / 180,
						tile: { tileset: { objectalignment } },
					};
					iso.adjustPosition(obj);
					return [obj.x, obj.y].map((v) => {
						return Math.round(v * 1e6) / 1e6;
					});
				};
				// the bottom center: (-20, -40) from the anchor turns to (40, -20)
				expect(place("unspecified", 90)).toEqual([505, 88]);
				// the center: (-20, -20) turns to (20, -20)
				expect(place("center", 90)).toEqual([485, 88]);
				// the top left is the anchor: it does not move
				expect(place("topleft", 90)).toEqual([465, 108]);
				// half a turn: (-20, -40) turns to (20, 40)
				expect(place("unspecified", 180)).toEqual([485, 148]);
			});
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

			it("draws a tile at its own size on a Canvas renderer without smoothing", () => {
				// it used to be drawn a pixel larger there, to hide the seams
				// smoothing drew once a resize had turned it back on
				const renderer = new CanvasRenderer({
					width: 8,
					height: 8,
					antiAlias: false,
				});
				const calls = [];
				renderer.drawImage = (img, sx, sy, sw, sh, dx, dy, dw, dh) => {
					calls.push({ dw, dh });
				};
				const ts = makeTileset({}, 48, 48);
				const ortho = new TMXOrthogonalRenderer(mockMap());
				ortho.drawTile(renderer, 0, 0, new Tile(0, 0, 1, ts));
				expect(calls).toEqual([{ dw: 48, dh: 48 }]);
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

			it("should sit collection tiles of different heights on the cell's bottom", () => {
				// the tileset's tileheight is its tallest image (64): the short
				// one must not be drawn as if it were that tall
				fakeImage("short", 48, 32);
				fakeImage("tall", 48, 64);
				const ts = makeTileset(
					{
						tileheight: 64,
						tilecount: 2,
						columns: 0,
						image: undefined,
						tiles: [
							{ id: 0, image: "short.png" },
							{ id: 1, image: "tall.png" },
						],
					},
					32,
					32,
				);
				expect(ts.isCollection).toEqual(true);
				const ortho = new TMXOrthogonalRenderer(mockMap());
				for (const gid of [1, 2]) {
					const spy = spyRenderer();
					ortho.drawTile(spy, 0, 0, new Tile(0, 0, gid, ts));
					ortho.drawTileRaw(spy, 0, 0, gid, 0, ts);
					for (const { dy, dh } of spy.calls) {
						// the bottom of the first row of 32px cells
						expect(dy + dh, `gid ${gid}`).toEqual(32);
					}
					expect(spy.calls.length).toEqual(2);
				}
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
