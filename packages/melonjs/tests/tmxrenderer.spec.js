import { beforeAll, describe, expect, it } from "vitest";
import { boot } from "../src/index.js";
import TMXHexagonalRenderer from "../src/level/tiled/renderer/TMXHexagonalRenderer.js";
import TMXIsometricRenderer from "../src/level/tiled/renderer/TMXIsometricRenderer.js";
import TMXOrthogonalRenderer from "../src/level/tiled/renderer/TMXOrthogonalRenderer.js";
import TMXStaggeredRenderer from "../src/level/tiled/renderer/TMXStaggeredRenderer.js";

describe("TMX Renderers", () => {
	beforeAll(() => {
		boot();
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

			// Call pixelToTileCoords multiple times with the same input
			const result1 = renderer.pixelToTileCoords(50, 50);
			const result2 = renderer.pixelToTileCoords(50, 50);
			const result3 = renderer.pixelToTileCoords(50, 50);

			// Results should be identical since centers are not mutated
			expect(result1.x).toEqual(result2.x);
			expect(result1.y).toEqual(result2.y);
			expect(result2.x).toEqual(result3.x);
			expect(result2.y).toEqual(result3.y);
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
});
