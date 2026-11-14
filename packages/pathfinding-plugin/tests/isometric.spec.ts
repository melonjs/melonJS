/**
 * Isometric grids: cells as diamonds, built by hand and from an isometric
 * Tiled map (its tile layer and its collision objects), checked against the
 * map's own renderer.
 */
import {
	Application,
	boot,
	level,
	loader,
	state,
	type TMXLayer,
	video,
} from "melonjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Grid, PathfindingDebug, PathfindingPlugin } from "../src/index.ts";

const W = 32;
const H = 16;
const COLS = 5;
const ROWS = 4;

const tileset = {
	firstgid: 1,
	name: "pf-iso-tiles",
	tilewidth: W,
	tileheight: H,
	spacing: 0,
	margin: 0,
	tilecount: 1,
	columns: 1,
	image: "pf-iso-tiles.png",
	imagewidth: W,
	imageheight: H,
};

/**
 * a 5 x 4 isometric map, its "walls" layer:
 *   . . # . .
 *   . . # . .
 *   . . # . .
 *   . . . . .
 * and a collision layer with one box over column 4, rows 0 and 1
 */
const walls = [1, 1, 1].flatMap(() => {
	return [0, 0, 1, 0, 0];
});
walls.push(0, 0, 0, 0, 0);
const map = {
	type: "map",
	version: "1.10",
	orientation: "isometric",
	renderorder: "right-down",
	infinite: false,
	width: COLS,
	height: ROWS,
	tilewidth: W,
	tileheight: H,
	nextlayerid: 3,
	nextobjectid: 2,
	tilesets: [tileset],
	layers: [
		{
			id: 1,
			name: "walls",
			type: "tilelayer",
			visible: true,
			opacity: 1,
			x: 0,
			y: 0,
			width: COLS,
			height: ROWS,
			data: walls,
		},
		{
			id: 2,
			name: "collision",
			type: "objectgroup",
			visible: true,
			opacity: 1,
			x: 0,
			y: 0,
			objects: [
				{
					// isometric objects are placed in tile heights along both
					// axes of the map
					id: 1,
					name: "",
					type: "",
					x: 4 * H,
					y: 0,
					width: H,
					height: 2 * H,
					rotation: 0,
					visible: true,
				},
			],
		},
	],
};

/**
 * the open cells of a grid as text, `#` for a wall
 * @param grid - the grid
 * @returns one string per row
 */
const picture = (grid: Grid) => {
	const rows: string[] = [];
	for (let row = 0; row < grid.rows; row++) {
		let line = "";
		for (let col = 0; col < grid.cols; col++) {
			line += grid.isSolid(col, row) ? "#" : ".";
		}
		rows.push(line);
	}
	return rows;
};

describe("an isometric grid", () => {
	const grid = new Grid({
		cols: 6,
		rows: 3,
		tileWidth: 40,
		tileHeight: 20,
		cellShape: "isometric",
		x: 100,
		y: 50,
	});

	it("puts each cell's point at its diamond's centre", () => {
		// the first column's diamond is at the top, as many half cells in
		// as there are rows
		expect(grid.getPointPosition(0, 0)).toMatchObject({ x: 160, y: 60 });
		// a column runs down to the right, a row down to the left
		expect(grid.getPointPosition(1, 0)).toMatchObject({ x: 180, y: 70 });
		expect(grid.getPointPosition(0, 1)).toMatchObject({ x: 140, y: 70 });
	});

	it("finds the cell under every point of every diamond", () => {
		for (let row = 0; row < grid.rows; row++) {
			for (let col = 0; col < grid.cols; col++) {
				const p = grid.getPointPosition(col, row);
				// the centre, and near the four corners, inside the diamond
				for (const [dx, dy] of [
					[0, 0],
					[0, -9],
					[19, 0],
					[0, 9],
					[-19, 0],
				]) {
					expect(grid.cellAt(p.x + dx, p.y + dy)).toMatchObject({
						x: col,
						y: row,
					});
				}
			}
		}
	});

	it("has nothing in the corners of the box around the diamonds", () => {
		expect(grid.cellAt(101, 51)).toBe(null);
		expect(grid.cellAt(100 + 9 * 20 - 1, 51)).toBe(null);
		expect(grid.cellAt(101, 50 + 9 * 10 - 1)).toBe(null);
	});

	it("finds a path the same way as a square grid", () => {
		const square = new Grid({
			cols: 6,
			rows: 3,
			tileWidth: 40,
			tileHeight: 20,
		});
		for (const g of [grid, square]) {
			g.fillSolidRegion({ x: 2, y: 0, width: 1, height: 2 });
		}
		const iso = grid.getIdPath({ x: 0, y: 0 }, { x: 5, y: 0 });
		expect(iso).toEqual(square.getIdPath({ x: 0, y: 0 }, { x: 5, y: 0 }));
		expect(iso.some((c) => c.y === 2)).toBe(true);
		// by world position: from the centre of one diamond to another
		const r = grid.findPath(
			grid.getPointPosition(0, 0),
			grid.getPointPosition(5, 0),
		);
		expect(r.found).toBe(true);
		expect(r.cells).toEqual(iso);
		expect(r.path[0]).toEqual(grid.getPointPosition(0, 0));
	});

	it("refuses a shape it does not know", () => {
		expect(() => {
			return new Grid({
				cols: 2,
				rows: 2,
				tileWidth: 8,
				tileHeight: 8,
				cellShape: "hexagonal" as "isometric",
			});
		}).toThrow(RangeError);
	});
});

describe("grids from an isometric level", () => {
	let app: Application | undefined;

	beforeAll(async () => {
		boot();
		const game = new Application(
			((COLS + ROWS) * W) / 2,
			((COLS + ROWS) * H) / 2,
			{ parent: "screen", renderer: video.CANVAS, consoleHeader: false },
		);
		await game.init();
		app = game;
		const image = document.createElement("canvas");
		image.width = W;
		image.height = H;
		await loader.preload(
			[
				{ name: "pf-iso-tiles", type: "image", src: image.toDataURL() },
				// an inline map, which the loader takes though `Asset.data` is
				// typed for shader sources
				{ name: "pf-iso-map", type: "tmx", data: map as unknown as string },
				// the same map, staggered, which no grid is built for
				{
					name: "pf-stagger-map",
					type: "tmx",
					data: {
						...map,
						orientation: "staggered",
						staggeraxis: "y",
						staggerindex: "odd",
						layers: [map.layers[0]],
					} as unknown as string,
				},
			],
			undefined,
			false,
		);
		state.stop();
		await level.load("pf-iso-map", {
			container: game.world,
			setViewportBounds: false,
			async: true,
		});
	});

	afterAll(() => {
		app?.destroy();
	});

	const world = () => {
		if (app === undefined) {
			throw new Error("no application");
		}
		return app.world;
	};
	const wallsLayer = () => {
		return world().getChildByName("walls")[0] as unknown as TMXLayer;
	};

	it("builds diamonds from the tile layer, where the map draws them", () => {
		const layer = wallsLayer();
		const grid = Grid.fromTileLayer(layer);
		expect(grid.cellShape).toBe("isometric");
		expect(picture(grid)).toEqual(["..#..", "..#..", "..#..", "....."]);
		const renderer = layer.getRenderer();
		const at = layer.getAbsolutePosition();
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				// the map's renderer, for the centre of the cell
				const centre = renderer.tileToPixelCoords(col + 0.5, row + 0.5);
				const p = grid.getPointPosition(col, row);
				expect(p.x).toBeCloseTo(at.x + centre.x);
				expect(p.y).toBeCloseTo(at.y + centre.y);
				expect(grid.cellAt(p.x, p.y)).toMatchObject({ x: col, y: row });
			}
		}
	});

	it("finds a way round the wall", () => {
		const grid = Grid.fromTileLayer(wallsLayer());
		const r = grid.findPath(
			grid.getPointPosition(0, 0),
			grid.getPointPosition(4, 0),
		);
		expect(r.found).toBe(true);
		expect(r.cells.some((c) => c.y === 3)).toBe(true);
	});

	it("blocks the diamonds under the level's collision shapes", () => {
		const grid = Grid.fromBodies(world(), {
			cols: COLS,
			rows: ROWS,
			tileWidth: W,
			tileHeight: H,
			cellShape: "isometric",
		});
		expect(picture(grid)).toEqual(["....#", "....#", ".....", "....."]);
	});

	it("is what the plugin builds for an isometric level", async () => {
		const byShapes = new PathfindingPlugin({}, app);
		const byLayer = new PathfindingPlugin({ layer: "walls" }, app);
		await level.load("pf-iso-map", {
			container: world(),
			setViewportBounds: false,
			async: true,
		});
		expect(byShapes.grid?.cellShape).toBe("isometric");
		expect(picture(byShapes.grid as Grid)).toEqual([
			"....#",
			"....#",
			".....",
			".....",
		]);
		expect(byLayer.grid?.cellShape).toBe("isometric");
		byShapes.destroy();
		byLayer.destroy();
	});

	it("keeps no grid for a staggered level, which still loads", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const byShapes = new PathfindingPlugin({}, app);
		const byLayer = new PathfindingPlugin({ layer: "walls" }, app);
		expect(byShapes.grid).not.toBe(null);
		let loaded = false;
		await level.load("pf-stagger-map", {
			container: world(),
			setViewportBounds: false,
			async: true,
			onLoaded: () => {
				loaded = true;
			},
		});
		expect(loaded).toBe(true);
		expect(level.getCurrentLevelId()).toBe("pf-stagger-map");
		expect(byShapes.grid).toBe(null);
		expect(byLayer.grid).toBe(null);
		expect(warn).toHaveBeenCalledTimes(2);
		// called directly, rebuild says why
		expect(() => {
			return byLayer.rebuild();
		}).toThrow(RangeError);
		byShapes.destroy();
		byLayer.destroy();
		warn.mockRestore();
		// back to the isometric level for the tests after this one
		await level.load("pf-iso-map", {
			container: world(),
			setViewportBounds: false,
			async: true,
		});
	});

	it("gives the points of a path at the diamonds' centres", () => {
		const grid = Grid.fromTileLayer(wallsLayer());
		const points = grid.getPointPath({ x: 0, y: 0 }, { x: 4, y: 0 });
		const cells = grid.getIdPath({ x: 0, y: 0 }, { x: 4, y: 0 });
		expect(points.length).toBe(cells.length);
		for (let i = 0; i < cells.length; i++) {
			expect(points[i]).toEqual(grid.getPointPosition(cells[i].x, cells[i].y));
		}
	});

	it("refuses a staggered or hexagonal layer", () => {
		const layer = { orientation: "staggered" } as unknown as TMXLayer;
		expect(() => {
			return Grid.fromTileLayer(layer);
		}).toThrow(RangeError);
	});

	it("draws the overlay as diamonds over the map", () => {
		const grid = Grid.fromTileLayer(wallsLayer());
		const overlay = new PathfindingDebug(grid);
		expect(overlay.width).toBe(((COLS + ROWS) * W) / 2);
		expect(overlay.height).toBe(((COLS + ROWS) * H) / 2);
		const result = grid.findPath(
			grid.getPointPosition(0, 0),
			grid.getPointPosition(4, 0),
			{ trace: true },
		);
		overlay.paths = [{ result }];
		world().addChild(overlay, 10);
		const renderer = app?.renderer as Parameters<typeof overlay.draw>[0];
		const canvas = renderer.getCanvas();
		const context = canvas.getContext("2d") as CanvasRenderingContext2D;
		context.clearRect(0, 0, canvas.width, canvas.height);
		// a frame's worth, through the real renderer
		overlay.update();
		overlay.draw(renderer);
		const red = (x: number, y: number) => {
			return context.getImageData(Math.round(x), Math.round(y), 1, 1).data[0];
		};
		// a wall's diamond is painted, the corner of the box beside it is not
		const wall = grid.getPointPosition(2, 0);
		expect(red(wall.x, wall.y)).toBeGreaterThan(40);
		expect(red(2, 2)).toBe(0);
		world().removeChild(overlay);
	});
});
