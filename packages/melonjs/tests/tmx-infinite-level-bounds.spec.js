import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, TMXTileMap, video } from "../src/index.js";
import { imgList } from "../src/loader/cache.js";

/**
 * On an infinite Tiled map the designer can paint past the map's own width
 * and height, and left of or above its origin. The level's bounds, which the
 * camera is held to when the map is added with `setViewportBounds`, used to
 * be the map's width and height from (0, 0): the camera stopped short of
 * every tile outside them, and a player walking there left the screen.
 *
 * The bounds now cover the map and every painted tile, and only those:
 * Tiled saves whole chunks (16 x 16 cells by default), so a layer's chunks
 * usually reach past the last painted tile, and the empty cells beyond it are
 * not part of the level.
 */

const MAP_COLS = 4;
const MAP_ROWS = 4;
const CHUNK = 4;

const ORIENTATIONS = {
	orthogonal: {
		map: { orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
		// the area Tiled draws tile (col, row) in
		cell: (col, row) => {
			return [col * 32, row * 32, col * 32 + 32, row * 32 + 32];
		},
	},
	isometric: {
		map: { orientation: "isometric", tilewidth: 64, tileheight: 32 },
		cell: (col, row) => {
			const x = (col - row) * 32 + MAP_ROWS * 32;
			const y = (col + row) * 16;
			return [x - 32, y, x + 32, y + 32];
		},
	},
	staggered: {
		map: {
			orientation: "staggered",
			tilewidth: 64,
			tileheight: 32,
			staggeraxis: "y",
			staggerindex: "odd",
		},
		cell: (col, row) => {
			const x = col * 64 + ((row & 1) === 1 ? 32 : 0);
			const y = row * 16;
			return [x, y, x + 64, y + 32];
		},
	},
};

const tilesetImage = (name, w, h) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	canvas.getContext("2d").fillRect(0, 0, w, h);
	imgList[name] = canvas;
	return `${name}.png`;
};

// the chunks holding the painted cells, as Tiled saves them
const chunksOf = (painted) => {
	const chunks = new Map();
	const chunkAt = (x, y) => {
		const key = `${x},${y}`;
		if (!chunks.has(key)) {
			chunks.set(key, {
				x,
				y,
				width: CHUNK,
				height: CHUNK,
				data: new Array(CHUNK * CHUNK).fill(0),
			});
		}
		return chunks.get(key);
	};
	// the map's own area always has a chunk
	chunkAt(0, 0);
	for (const [col, row] of painted) {
		const x = Math.floor(col / CHUNK) * CHUNK;
		const y = Math.floor(row / CHUNK) * CHUNK;
		chunkAt(x, y).data[(row - y) * CHUNK + (col - x)] = 1;
	}
	return [...chunks.values()];
};

let mapId = 0;
const infiniteMap = (orientation, painted, extraChunks = []) => {
	const { map } = ORIENTATIONS[orientation];
	const name = `level-bounds-${orientation}`;
	const chunks = [...chunksOf(painted), ...extraChunks];
	return new TMXTileMap(`level-bounds-${mapId++}`, {
		width: MAP_COLS,
		height: MAP_ROWS,
		renderorder: "right-down",
		infinite: true,
		version: "1.10",
		tiledversion: "1.10.2",
		...map,
		tilesets: [
			{
				firstgid: 1,
				name,
				tilewidth: map.tilewidth,
				tileheight: map.tileheight,
				spacing: 0,
				margin: 0,
				tilecount: 1,
				columns: 1,
				image: tilesetImage(name, map.tilewidth, map.tileheight),
			},
		],
		layers: [
			{
				type: "tilelayer",
				name: "ground",
				chunks,
				visible: true,
				opacity: 1,
			},
		],
	});
};

// a level's world bounds, [left, top, right, bottom]
const edges = (b) => {
	return [b.left, b.top, b.right, b.bottom];
};

describe("an infinite map's level bounds cover every painted tile", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(64, 64, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	describe.each(Object.keys(ORIENTATIONS))("%s", (orientation) => {
		const { cell } = ORIENTATIONS[orientation];

		it("covers tiles painted left of, above, right of and below the map", () => {
			const painted = [
				[-3, -2],
				[5, 1],
				[1, 6],
				[-6, 7],
			];
			const bounds = infiniteMap(orientation, painted).getBounds();
			const outside = [];
			for (const [col, row] of painted) {
				const [l, t, r, b] = cell(col, row);
				if (
					l < bounds.left ||
					t < bounds.top ||
					r > bounds.right ||
					b > bounds.bottom
				) {
					outside.push(`(${col},${row})`);
				}
			}
			expect(outside).toEqual([]);
		});

		it("still covers the map's own area when nothing is painted past it", () => {
			const map = infiniteMap(orientation, [[1, 1]]);
			const own = [
				...cell(0, 0),
				...cell(MAP_COLS - 1, MAP_ROWS - 1),
				...cell(0, MAP_ROWS - 1),
				...cell(MAP_COLS - 1, 0),
			];
			const bounds = map.getBounds();
			for (let i = 0; i < own.length; i += 4) {
				expect(own[i]).toBeGreaterThanOrEqual(bounds.left);
				expect(own[i + 1]).toBeGreaterThanOrEqual(bounds.top);
				expect(own[i + 2]).toBeLessThanOrEqual(bounds.right);
				expect(own[i + 3]).toBeLessThanOrEqual(bounds.bottom);
			}
		});

		it("the level's width and height are its bounds'", () => {
			const map = infiniteMap(orientation, [
				[-3, -2],
				[6, 6],
			]);
			expect(map.width).toEqual(map.getBounds().width);
			expect(map.height).toEqual(map.getBounds().height);
		});
	});

	it("orthogonal: the bounds run exactly from the first painted tile to the last", () => {
		const map = infiniteMap("orthogonal", [
			[-3, -2],
			[5, 6],
		]);
		expect(edges(map.getBounds())).toEqual([-96, -64, 192, 224]);
	});

	it("empty chunk cells past the last painted tile are not part of the level", () => {
		// as Tiled saves a 4 x 4 map painted inside its own area, with empty
		// chunks reaching past it on every side
		const empty = (x, y) => {
			return {
				x,
				y,
				width: CHUNK,
				height: CHUNK,
				data: new Array(CHUNK * CHUNK).fill(0),
			};
		};
		const map = infiniteMap(
			"orthogonal",
			[
				[0, 0],
				[3, 3],
			],
			[empty(-4, -4), empty(4, 4), empty(4, -4), empty(-4, 4)],
		);
		expect(edges(map.getBounds())).toEqual([0, 0, 128, 128]);
	});

	it("a finite map's bounds are unchanged", () => {
		const name = "level-bounds-finite";
		const map = new TMXTileMap(name, {
			width: MAP_COLS,
			height: MAP_ROWS,
			tilewidth: 32,
			tileheight: 32,
			orientation: "orthogonal",
			renderorder: "right-down",
			infinite: false,
			version: "1.10",
			tiledversion: "1.10.2",
			tilesets: [
				{
					firstgid: 1,
					name,
					tilewidth: 32,
					tileheight: 32,
					spacing: 0,
					margin: 0,
					tilecount: 1,
					columns: 1,
					image: tilesetImage(name, 32, 32),
				},
			],
			layers: [
				{
					type: "tilelayer",
					name: "ground",
					width: MAP_COLS,
					height: MAP_ROWS,
					data: new Array(MAP_COLS * MAP_ROWS).fill(1),
					visible: true,
					opacity: 1,
				},
			],
		});
		expect(edges(map.getBounds())).toEqual([0, 0, 128, 128]);
	});

	describe("added to the world with setViewportBounds", () => {
		const addLevel = (painted) => {
			const map = infiniteMap("orthogonal", painted);
			app.world.reset();
			map.addTo(app.world, true, true);
			return map;
		};

		it("the camera is held to the level's bounds, painted tiles past the map included", () => {
			addLevel([
				[-3, -2],
				[5, 6],
			]);
			const camera = app.viewport;
			expect(edges(camera.bounds)).toEqual([-96, -64, 192, 224]);
		});

		it("the camera can scroll to a tile left of and above the map's origin", () => {
			addLevel([
				[-3, -2],
				[5, 6],
			]);
			const camera = app.viewport;
			camera.moveTo(-1000, -1000);
			expect([camera.pos.x, camera.pos.y]).toEqual([-96, -64]);
			camera.moveTo(1000, 1000);
			expect([camera.pos.x, camera.pos.y]).toEqual([192 - 64, 224 - 64]);
		});

		it("a level smaller than the camera is still centred in it", () => {
			// one painted tile, a 4 x 4 map of 8 px tiles: 32 x 32 in a 64 x 64 view
			const name = "level-bounds-small";
			const map = new TMXTileMap(name, {
				width: 4,
				height: 4,
				tilewidth: 8,
				tileheight: 8,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: true,
				version: "1.10",
				tiledversion: "1.10.2",
				tilesets: [
					{
						firstgid: 1,
						name,
						tilewidth: 8,
						tileheight: 8,
						spacing: 0,
						margin: 0,
						tilecount: 1,
						columns: 1,
						image: tilesetImage(name, 8, 8),
					},
				],
				layers: [
					{
						type: "tilelayer",
						name: "ground",
						chunks: chunksOf([[1, 1]]),
						visible: true,
						opacity: 1,
					},
				],
			});
			app.world.reset();
			map.addTo(app.world, true, true);
			expect([app.world.pos.x, app.world.pos.y]).toEqual([16, 16]);
			app.world.pos.set(0, 0, app.world.pos.z);
		});
	});
});
