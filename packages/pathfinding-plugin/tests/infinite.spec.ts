/**
 * Grids over the tile layers of infinite maps, whose layers can start left
 * of and above the map's origin: orthogonal and isometric. Each cell of the
 * grid is checked against the tile the layer itself finds at that cell's
 * centre (`layer.getTile`), so both what the grid reads and where it puts
 * it match the map.
 */
import {
	Application,
	boot,
	level,
	loader,
	state,
	type Tile,
	type TMXLayer,
	video,
} from "melonjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Grid, PathfindingPlugin } from "../src/index.ts";

/**
 * an infinite map with one tile layer, "walls", in two 4 x 4 chunks
 * @param orientation - "orthogonal" or "isometric"
 * @param width - the tiles' width
 * @param height - the tiles' height
 * @param chunks - each chunk's position (in tiles) and its walls (in its
 * own cells)
 * @param box - a collision box over one tile of the map, in its tile
 * coordinates
 * @returns the map, as Tiled saves it in JSON
 */
const infiniteMap = (
	orientation: string,
	width: number,
	height: number,
	chunks: { x: number; y: number; walls: [number, number][] }[],
	box: [number, number],
) => {
	// Tiled places an isometric map's objects in tile heights along both
	// of its axes
	const unit =
		orientation === "isometric"
			? { x: height, y: height }
			: { x: width, y: height };
	return {
		type: "map",
		version: "1.10",
		orientation,
		renderorder: "right-down",
		infinite: true,
		width: 4,
		height: 4,
		tilewidth: width,
		tileheight: height,
		nextlayerid: 2,
		nextobjectid: 1,
		tilesets: [
			{
				firstgid: 1,
				name: `pf-inf-${orientation}`,
				tilewidth: width,
				tileheight: height,
				spacing: 0,
				margin: 0,
				tilecount: 1,
				columns: 1,
				image: `pf-inf-${orientation}.png`,
				imagewidth: width,
				imageheight: height,
			},
		],
		layers: [
			{
				id: 1,
				name: "walls",
				type: "tilelayer",
				visible: true,
				opacity: 1,
				x: 0,
				y: 0,
				startx: Math.min(...chunks.map((c) => c.x)),
				starty: Math.min(...chunks.map((c) => c.y)),
				width: 8,
				height: 8,
				chunks: chunks.map((c) => {
					const data = new Array(16).fill(0);
					for (const [x, y] of c.walls) {
						data[y * 4 + x] = 1;
					}
					return { x: c.x, y: c.y, width: 4, height: 4, data };
				}),
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
						x: box[0] * unit.x,
						y: box[1] * unit.y,
						width: unit.x,
						height: unit.y,
						rotation: 0,
						visible: true,
					},
				],
			},
		],
	};
};

const maps = {
	// a chunk left of the map's origin, and one on it
	orthogonal: infiniteMap(
		"orthogonal",
		16,
		16,
		[
			{ x: -4, y: 0, walls: [[1, 1]] },
			{
				x: 0,
				y: 0,
				walls: [
					[2, 2],
					[3, 0],
				],
			},
		],
		[-3, 2],
	),
	// a chunk above the map's origin, and one on it
	isometric: infiniteMap(
		"isometric",
		32,
		16,
		[
			{ x: 0, y: -4, walls: [[1, 1]] },
			{
				x: 0,
				y: 0,
				walls: [
					[2, 2],
					[0, 3],
				],
			},
		],
		[2, -3],
	),
};

describe("grids over an infinite map's tile layer", () => {
	let app: Application | undefined;

	beforeAll(async () => {
		boot();
		const game = new Application(256, 256, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await game.init();
		app = game;
		const assets: {
			name: string;
			type: string;
			src?: string;
			data?: string;
		}[] = [];
		for (const [name, map] of Object.entries(maps)) {
			const image = document.createElement("canvas");
			image.width = map.tilewidth;
			image.height = map.tileheight;
			assets.push(
				{ name: `pf-inf-${name}`, type: "image", src: image.toDataURL() },
				// an inline map, which the loader takes though `Asset.data` is
				// typed for shader sources
				{
					name: `pf-inf-${name}-map`,
					type: "tmx",
					data: map as unknown as string,
				},
			);
		}
		await loader.preload(
			assets as Parameters<typeof loader.preload>[0],
			undefined,
			false,
		);
		state.stop();
	});

	afterAll(() => {
		app?.destroy();
	});

	for (const name of ["orthogonal", "isometric"] as const) {
		it(`reads every ${name} cell where the layer draws it`, async () => {
			if (app === undefined) {
				throw new Error("no application");
			}
			await level.load(`pf-inf-${name}-map`, {
				container: app.world,
				setViewportBounds: false,
				async: true,
			});
			const layer = app.world.getChildByName("walls")[0] as unknown as TMXLayer;
			// the layer starts before the map's origin
			expect(layer.startx + layer.starty).toBe(-4);
			const grid = Grid.fromTileLayer(layer);
			expect(grid.cols).toBe(layer.cols);
			expect(grid.rows).toBe(layer.rows);
			let walls = 0;
			for (let row = 0; row < grid.rows; row++) {
				for (let col = 0; col < grid.cols; col++) {
					const p = grid.getPointPosition(col, row);
					// null where the layer has no tile, whatever its type says
					const tile = layer.getTile(p.x, p.y) as Tile | null;
					expect(grid.isSolid(col, row), `cell ${col},${row}`).toBe(
						tile !== null,
					);
					expect(grid.cellAt(p.x, p.y)).toMatchObject({ x: col, y: row });
					if (tile !== null) {
						walls++;
						// the tile in the map's coordinates, from the grid's cell
						expect(tile.col).toBe(col + layer.startx);
						expect(tile.row).toBe(row + layer.starty);
					}
				}
			}
			expect(walls).toBe(3);

			// the plugin's grid, from the collision shapes, covers the whole
			// level and lines up with the layer's
			const byShapes = new PathfindingPlugin({}, app);
			const shapes = byShapes.grid as Grid;
			expect([shapes.cols, shapes.rows]).toEqual([grid.cols, grid.rows]);
			expect([shapes.x, shapes.y]).toEqual([grid.x, grid.y]);
			const [bx, by] = name === "orthogonal" ? [-3, 2] : [2, -3];
			// the box, left of or above the map's origin, blocks its cell
			const boxCell = { x: bx - layer.startx, y: by - layer.starty };
			let solid = 0;
			for (let row = 0; row < shapes.rows; row++) {
				for (let col = 0; col < shapes.cols; col++) {
					if (shapes.isSolid(col, row)) {
						solid++;
						expect({ x: col, y: row }).toEqual(boxCell);
					}
				}
			}
			expect(solid).toBe(1);
			byShapes.destroy();
		});
	}
});
