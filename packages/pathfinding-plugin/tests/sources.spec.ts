/**
 * Grids built from a level: from a Tiled tile layer (tiles, a tile's `cost`
 * property, changed tiles), from the level's collision shapes, and kept by
 * the plugin across level loads.
 */
import {
	Application,
	boot,
	Container,
	collision,
	level,
	loader,
	plugin,
	Rect,
	Renderable,
	state,
	type TMXLayer,
	video,
} from "melonjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Grid, PathfindingPlugin } from "../src/index.ts";

const T = 16;

/** a 2-tile tileset: tile 1 a wall, tile 2 mud (cost 3) */
const tileset = {
	firstgid: 1,
	name: "pf-tiles",
	tilewidth: T,
	tileheight: T,
	spacing: 0,
	margin: 0,
	tilecount: 2,
	columns: 2,
	image: "pf-tiles.png",
	imagewidth: 2 * T,
	imageheight: T,
	tiles: [{ id: 1, properties: [{ name: "cost", type: "int", value: 3 }] }],
};

/**
 * a 6 x 4 map:
 *   walls (layer "walls"):  . . # . . .   mud on (4, 1)
 *                           . . # . M .
 *                           . . # . . .
 *                           . . . . . .
 * and a collision layer with a box on column 4 (rows 0-1) and a triangle
 * covering the bottom left corner
 */
const walls = [
	0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
const map = {
	type: "map",
	version: "1.10",
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	width: 6,
	height: 4,
	tilewidth: T,
	tileheight: T,
	nextlayerid: 3,
	nextobjectid: 3,
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
			width: 6,
			height: 4,
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
					id: 1,
					name: "",
					type: "",
					x: 4 * T,
					y: 0,
					width: T,
					height: 2 * T,
					rotation: 0,
					visible: true,
				},
				{
					id: 2,
					name: "",
					type: "",
					x: 0,
					y: 2 * T,
					width: 0,
					height: 0,
					rotation: 0,
					visible: true,
					// a right triangle filling the bottom left 2 x 2 cells
					// below their diagonal
					polygon: [
						{ x: 0, y: 0 },
						{ x: 2 * T, y: 2 * T },
						{ x: 0, y: 2 * T },
					],
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
			line += grid.isWalkable(col, row) ? "." : "#";
		}
		rows.push(line);
	}
	return rows;
};

describe("grids from a level", () => {
	let app: Application | undefined;

	beforeAll(async () => {
		boot();
		const game = new Application(6 * T, 4 * T, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await game.init();
		app = game;
		const image = document.createElement("canvas");
		image.width = 2 * T;
		image.height = T;
		await loader.preload(
			[
				{ name: "pf-tiles", type: "image", src: image.toDataURL() },
				// an inline map, which the loader takes though `Asset.data` is
				// typed for shader sources
				{ name: "pf-map", type: "tmx", data: map as unknown as string },
			],
			undefined,
			false,
		);
		state.stop();
		await level.load("pf-map", {
			container: game.world,
			setViewportBounds: false,
			async: true,
		});
	});

	const world = () => {
		if (app === undefined) {
			throw new Error("no application");
		}
		return app.world;
	};

	afterAll(() => {
		app?.destroy();
	});

	const wallsLayer = () => {
		return world().getChildByName("walls")[0] as unknown as TMXLayer;
	};

	describe("Grid.fromTileLayer", () => {
		it("blocks the cells with a tile, by default", () => {
			const grid = Grid.fromTileLayer(wallsLayer(), {
				walkable: (tile) => {
					return tile === null || tile.tileId !== 1;
				},
			});
			expect(picture(grid)).toEqual(["..#...", "..#...", "..#...", "......"]);
			const plain = Grid.fromTileLayer(wallsLayer());
			expect(plain.isWalkable(4, 1)).toBe(false);
			expect(plain.isWalkable(2, 0)).toBe(false);
			expect(plain.isWalkable(0, 0)).toBe(true);
		});

		it("takes a cell's cost from its tile's cost property", () => {
			const grid = Grid.fromTileLayer(wallsLayer(), {
				walkable: (tile) => {
					return tile === null || tile.tileId !== 1;
				},
			});
			expect(grid.getCost(4, 1)).toBe(3);
			expect(grid.getCost(0, 0)).toBe(1);
		});

		it("finds a way round the wall", () => {
			const grid = Grid.fromTileLayer(wallsLayer());
			const r = grid.findPath(grid.cellCenter(0, 0), grid.cellCenter(3, 0));
			expect(r.found).toBe(true);
			expect(r.cells.some((c) => c.row === 3)).toBe(true);
		});

		it("sees a changed tile once refreshed", () => {
			const layer = wallsLayer();
			const grid = Grid.fromTileLayer(layer);
			layer.clearTile(2, 1);
			expect(grid.isWalkable(2, 1)).toBe(false);
			grid.refreshCell(2, 1);
			expect(grid.isWalkable(2, 1)).toBe(true);
			layer.setTile(layer.getTileById(1, 2, 1), 2, 1);
			grid.refresh();
			expect(grid.isWalkable(2, 1)).toBe(false);
		});
	});

	describe("Grid.fromBodies", () => {
		it("blocks the cells under the level's collision shapes", () => {
			const grid = Grid.fromBodies(world(), {
				cols: 6,
				rows: 4,
				tileWidth: T,
				tileHeight: T,
			});
			expect(picture(grid)).toEqual(["....#.", "....#.", "#.....", "##...."]);
		});

		it("follows the shape, not its bounding box", () => {
			const grid = Grid.fromBodies(world(), {
				cols: 6,
				rows: 4,
				tileWidth: T,
				tileHeight: T,
			});
			// the triangle's box covers (1, 2), the triangle barely does
			expect(grid.isWalkable(1, 2)).toBe(true);
		});
	});

	describe("Grid.fromBodies, on bodies added by code", () => {
		it("scans the whole shape, even past a smaller renderable", () => {
			const container = new Container(0, 0, 6 * T, 4 * T);
			// a 1 x 1 renderable holding a 3-cell long wall
			const wall = new Renderable(T, T, 1, 1);
			wall.anchorPoint.set(0, 0);
			wall.bodyDef = {
				type: "static",
				shapes: [new Rect(0, 0, 3 * T, T)],
				collisionType: collision.types.WORLD_SHAPE,
			};
			container.addChild(wall);
			const grid = Grid.fromBodies(container, {
				cols: 6,
				rows: 4,
				tileWidth: T,
				tileHeight: T,
			});
			expect(picture(grid)).toEqual(["......", ".###..", "......", "......"]);
		});
	});

	describe("PathfindingPlugin", () => {
		it("builds a grid for each level loaded, from a layer or the shapes", async () => {
			const byLayer = new PathfindingPlugin({ layer: "walls" }, app);
			const byShapes = new PathfindingPlugin({}, app);
			expect(byLayer.grid).toBe(null);
			await level.load("pf-map", {
				container: world(),
				setViewportBounds: false,
				async: true,
			});
			expect(byLayer.grid?.isWalkable(2, 0)).toBe(false);
			expect(byShapes.grid?.isWalkable(4, 0)).toBe(false);
			expect(byShapes.grid?.isWalkable(2, 0)).toBe(true);
			byLayer.destroy();
			byShapes.destroy();
		});

		it("registers through the plugin API", () => {
			plugin.register(PathfindingPlugin, "pathfinding", { layer: "walls" });
			const instance = plugin.cache.pathfinding as PathfindingPlugin;
			expect(instance).toBeInstanceOf(PathfindingPlugin);
			expect(instance.rebuild()?.cols).toBe(6);
			instance.destroy();
		});
	});
});
