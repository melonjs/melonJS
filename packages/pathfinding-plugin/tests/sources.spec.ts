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
import { Grid, PathfindingDebug, PathfindingPlugin } from "../src/index.ts";

const T = 16;

/** a 2-tile tileset: tile 1 a wall, tile 2 mud (weight 3) */
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
	tiles: [{ id: 1, properties: [{ name: "weight", type: "int", value: 3 }] }],
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
			line += grid.isSolid(col, row) ? "#" : ".";
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
				solid: (tile) => {
					return tile !== null && tile.tileId === 1;
				},
			});
			expect(picture(grid)).toEqual(["..#...", "..#...", "..#...", "......"]);
			const plain = Grid.fromTileLayer(wallsLayer());
			expect(plain.isSolid(4, 1)).toBe(true);
			expect(plain.isSolid(2, 0)).toBe(true);
			expect(plain.isSolid(0, 0)).toBe(false);
		});

		it("takes a cell's weight from its tile's weight property", () => {
			const grid = Grid.fromTileLayer(wallsLayer(), {
				solid: (tile) => {
					return tile !== null && tile.tileId === 1;
				},
			});
			expect(grid.getWeight(4, 1)).toBe(3);
			expect(grid.getWeight(0, 0)).toBe(1);
		});

		it("finds a way round the wall", () => {
			const grid = Grid.fromTileLayer(wallsLayer());
			const r = grid.findPath(
				grid.getPointPosition(0, 0),
				grid.getPointPosition(3, 0),
			);
			expect(r.found).toBe(true);
			expect(r.cells.some((c) => c.y === 3)).toBe(true);
		});

		it("sees a changed tile once refreshed", () => {
			const layer = wallsLayer();
			const grid = Grid.fromTileLayer(layer);
			layer.clearTile(2, 1);
			expect(grid.isSolid(2, 1)).toBe(true);
			grid.refreshCell(2, 1);
			expect(grid.isSolid(2, 1)).toBe(false);
			layer.setTile(layer.getTileById(1, 2, 1), 2, 1);
			grid.refresh();
			expect(grid.isSolid(2, 1)).toBe(true);
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
			expect(grid.isSolid(1, 2)).toBe(false);
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

		/**
		 * a wall body, as code adds one
		 * @param x - where the renderable is
		 * @param y - where the renderable is
		 * @param shapes - its shapes, none for its bounding box
		 * @returns the wall
		 */
		const wall = (x: number, y: number, shapes: Rect[]) => {
			const r = new Renderable(x, y, T, T);
			r.bodyDef = {
				type: "static",
				shapes,
				collisionType: collision.types.WORLD_SHAPE,
			};
			return r;
		};
		const size = { cols: 6, rows: 4, tileWidth: T, tileHeight: T };

		it("places a shape from the renderable's anchor, as the engine does", () => {
			const container = new Container(0, 0, 6 * T, 4 * T);
			// the default anchor, the centre: the renderable at (2.5, 1.5)
			// cells is drawn over the cell (2, 1), and its shape with it
			const w = wall(2.5 * T, 1.5 * T, [new Rect(0, 0, T, T)]);
			container.addChild(w);
			expect(w.getBounds().left).toBe(2 * T);
			expect(w.getBounds().top).toBe(T);
			const grid = Grid.fromBodies(container, size);
			expect(picture(grid)).toEqual(["......", "..#...", "......", "......"]);
		});

		it("uses a wall's bounding box when it has no shape", () => {
			const container = new Container(0, 0, 6 * T, 4 * T);
			const box = wall(4 * T, 3 * T, []);
			box.anchorPoint.set(0, 0);
			container.addChild(box);
			expect(picture(Grid.fromBodies(container, size))).toEqual([
				"......",
				"......",
				"......",
				"....#.",
			]);
		});

		it("finds walls in nested containers, and only those it is told to", () => {
			const outer = new Container(0, 0, 6 * T, 4 * T);
			const inner = new Container(T, T, 4 * T, 2 * T);
			const a = wall(0, 0, [new Rect(0, 0, T, T)]);
			a.anchorPoint.set(0, 0);
			a.name = "a";
			const b = wall(2 * T, T, [new Rect(0, 0, T, T)]);
			b.anchorPoint.set(0, 0);
			inner.addChild(a);
			inner.addChild(b);
			outer.addChild(inner);
			expect(picture(Grid.fromBodies(outer, size))).toEqual([
				"......",
				".#....",
				"...#..",
				"......",
			]);
			const only = Grid.fromBodies(outer, {
				...size,
				solid: (r) => {
					return r.name === "a";
				},
				weight: (col) => {
					return col === 5 ? 3 : 1;
				},
			});
			expect(picture(only)).toEqual(["......", ".#....", "......", "......"]);
			expect(only.getWeight(5, 0)).toBe(3);
		});

		it("scans again where the grid now is, on refresh", () => {
			const container = new Container(0, 0, 8 * T, 4 * T);
			const w = wall(2 * T, T, [new Rect(0, 0, T, T)]);
			w.anchorPoint.set(0, 0);
			container.addChild(w);
			// a grid starting one cell in
			const grid = Grid.fromBodies(container, { ...size, x: T });
			expect(grid.isSolid(1, 1)).toBe(true);
			// moved a cell further: the wall is in its first column
			grid.x = 2 * T;
			grid.refresh();
			expect(grid.isSolid(0, 1)).toBe(true);
			expect(grid.isSolid(1, 1)).toBe(false);
			// a wall taken away, another added
			container.removeChildNow(w);
			const other = wall(6 * T, 2 * T, [new Rect(0, 0, T, T)]);
			other.anchorPoint.set(0, 0);
			container.addChild(other);
			grid.refresh();
			expect(picture(grid)).toEqual(["......", "......", "....#.", "......"]);
		});
	});

	describe("PathfindingDebug", () => {
		it("paints solid and heavy cells, each part when asked", () => {
			const grid = Grid.fromTileLayer(wallsLayer(), {
				solid: (tile) => {
					return tile !== null && tile.tileId === 1;
				},
			});
			const overlay = new PathfindingDebug(grid);
			expect([overlay.width, overlay.height]).toEqual([6 * T, 4 * T]);
			const renderer = app?.renderer as Parameters<typeof overlay.draw>[0];
			const canvas = renderer.getCanvas();
			const context = canvas.getContext("2d") as CanvasRenderingContext2D;
			const pixel = (col: number, row: number) => {
				return Array.from(
					context.getImageData(col * T + T / 2, row * T + T / 2, 1, 1).data,
				);
			};
			const draw = () => {
				context.clearRect(0, 0, canvas.width, canvas.height);
				overlay.update();
				overlay.draw(renderer);
			};
			draw();
			// a wall red, mud orange, an open cell left alone
			const [wr, wg] = pixel(2, 0);
			expect(wr).toBeGreaterThan(wg);
			expect(pixel(4, 1)[0]).toBeGreaterThan(0);
			expect(pixel(0, 0)[3]).toBe(0);
			overlay.showSolid = false;
			overlay.showWeight = false;
			draw();
			expect(pixel(2, 0)[3]).toBe(0);
			expect(pixel(4, 1)[3]).toBe(0);
			// it follows the grid when it moves
			grid.x = T;
			overlay.update();
			expect(overlay.pos.x).toBe(T);
		});
	});

	describe("PathfindingPlugin", () => {
		it("builds a grid for each level loaded, from a layer or the shapes", async () => {
			const byLayer = new PathfindingPlugin({ layer: "walls" }, app);
			const byShapes = new PathfindingPlugin({}, app);
			// a level is already loaded: its grid is built at once
			const first = byLayer.grid;
			expect(first?.isSolid(2, 0)).toBe(true);
			await level.load("pf-map", {
				container: world(),
				setViewportBounds: false,
				async: true,
			});
			expect(byLayer.grid?.isSolid(2, 0)).toBe(true);
			expect(byShapes.grid?.isSolid(4, 0)).toBe(true);
			expect(byShapes.grid?.isSolid(2, 0)).toBe(false);
			// a new grid for the new level
			expect(byLayer.grid).not.toBe(first);
			byLayer.destroy();
			byShapes.destroy();
		});

		it("builds the grid with build, or keeps none", async () => {
			const built = new Grid({ cols: 1, rows: 1, tileWidth: T, tileHeight: T });
			let given: Container | undefined;
			const custom = new PathfindingPlugin(
				{
					build: (container) => {
						given = container;
						return built;
					},
				},
				app,
			);
			expect(custom.grid).toBe(built);
			expect(given).toBe(world());
			const none = new PathfindingPlugin({ build: () => null }, app);
			const missing = new PathfindingPlugin({ layer: "no such layer" }, app);
			await level.load("pf-map", {
				container: world(),
				setViewportBounds: false,
				async: true,
			});
			expect(none.grid).toBe(null);
			expect(missing.grid).toBe(null);
			for (const p of [custom, none, missing]) {
				p.destroy();
			}
		});

		it("leaves its grid alone for a level loaded elsewhere", async () => {
			// as with a level loaded by another application, or after this
			// one was destroyed: the level registry is shared
			const elsewhere = new Container(0, 0, 6 * T, 4 * T);
			let builds = 0;
			const own = new Grid({ cols: 1, rows: 1, tileWidth: T, tileHeight: T });
			const p = new PathfindingPlugin(
				{
					container: elsewhere,
					build: () => {
						builds++;
						return own;
					},
				},
				app,
			);
			// the loaded level is in the world, not in its container
			expect(builds).toBe(0);
			await level.load("pf-map", {
				container: world(),
				setViewportBounds: false,
				async: true,
			});
			expect(builds).toBe(0);
			expect(p.grid).toBe(null);
			// loaded into its own container, it builds
			await level.load("pf-map", {
				container: elsewhere,
				setViewportBounds: false,
				async: true,
			});
			expect(builds).toBe(1);
			expect(p.grid).toBe(own);
			p.destroy();
			// back in the world, for the tests after this one
			await level.load("pf-map", {
				container: world(),
				setViewportBounds: false,
				async: true,
			});
		});

		it("stops following level loads once destroyed", async () => {
			let builds = 0;
			const p = new PathfindingPlugin(
				{
					build: () => {
						builds++;
						return null;
					},
				},
				app,
			);
			p.destroy();
			await level.load("pf-map", {
				container: world(),
				setViewportBounds: false,
				async: true,
			});
			expect(builds).toBe(1);
			expect(p.grid).toBe(null);
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
