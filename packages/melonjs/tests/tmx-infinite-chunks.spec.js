import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Rect, TMXTileMap, video } from "../src/index.js";
import * as TMXUtils from "../src/level/tiled/TMXUtils.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * Infinite Tiled maps store a layer as chunks, each placed at its own column
 * and row in the map's tile coordinates — which can be negative, and can
 * reach past the map's `width` and `height` (a TMX layer of an infinite map
 * carries the map's size whatever its chunks hold; a JSON one the chunks'
 * bounds, from `startx`, `starty`).
 *
 * The layer used to write a chunk's cell (x, y) at `(y + chunk.y) * cols +
 * x + chunk.x`, ignoring where the layer starts and checking no bounds: a
 * tile left of the origin landed in the row above, a tile past the layer's
 * width in the next row, and a tile above the origin was dropped.
 *
 * A tile must instead be where Tiled shows it: `cellAt`, `getTile`, `setTile`
 * and `clearTile` take the map's tile coordinates (the column and row Tiled
 * shows, negative included), and the tile is drawn where Tiled draws it.
 */

// four tiles in a row, each a solid colour, square (orthogonal) or a
// diamond (isometric, staggered): only one tile covers a cell's centre
const COLOURS = [
	[255, 0, 0],
	[0, 255, 0],
	[0, 0, 255],
	[255, 255, 0],
];
const tilesetImage = (name, w, h, diamond) => {
	const canvas = document.createElement("canvas");
	canvas.width = w * COLOURS.length;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	COLOURS.forEach(([r, g, b], i) => {
		ctx.fillStyle = `rgb(${r},${g},${b})`;
		if (diamond) {
			ctx.beginPath();
			ctx.moveTo(i * w + w / 2, 0);
			ctx.lineTo(i * w + w, h / 2);
			ctx.lineTo(i * w + w / 2, h);
			ctx.lineTo(i * w, h / 2);
			ctx.closePath();
			ctx.fill();
		} else {
			ctx.fillRect(i * w, 0, w, h);
		}
	});
	imgList[name] = canvas;
	return `${name}.png`;
};

const MAP_COLS = 4;
const MAP_ROWS = 4;
const CHUNK = 4;

// the tiles painted, [col, row, gid], in the map's tile coordinates: one in
// each quadrant around the origin, one past the map's right edge and one
// past its bottom edge
const PAINTED = [
	[-3, -2, 1],
	[2, -1, 2],
	[-1, 3, 3],
	[1, 1, 4],
	[5, 2, 1],
	[3, 5, 2],
	[-4, -4, 3],
	[7, 7, 4],
];

// the chunks holding them, as Tiled saves them: each at a multiple of the
// chunk size, `CHUNK` x `CHUNK` cells
const chunksOf = (painted) => {
	const chunks = new Map();
	for (const [col, row, gid] of painted) {
		const x = Math.floor(col / CHUNK) * CHUNK;
		const y = Math.floor(row / CHUNK) * CHUNK;
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
		chunks.get(key).data[(row - y) * CHUNK + (col - x)] = gid;
	}
	// the map's own area always has a chunk
	if (!chunks.has("0,0")) {
		chunks.set("0,0", {
			x: 0,
			y: 0,
			width: CHUNK,
			height: CHUNK,
			data: new Array(CHUNK * CHUNK).fill(0),
		});
	}
	return [...chunks.values()];
};

// the orientations, with where Tiled puts the centre of tile (col, row):
// written out from Tiled's renderers, not taken from melonJS's
const ORIENTATIONS = {
	orthogonal: {
		map: { orientation: "orthogonal", tilewidth: 32, tileheight: 32 },
		diamond: false,
		centre: (col, row) => {
			return [col * 32 + 16, row * 32 + 16];
		},
	},
	isometric: {
		map: { orientation: "isometric", tilewidth: 64, tileheight: 32 },
		diamond: true,
		// IsometricRenderer::tileToScreenCoords: the origin is the map's
		// height times half a tile right of 0
		centre: (col, row) => {
			return [(col - row) * 32 + MAP_ROWS * 32, (col + row) * 16 + 16];
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
		diamond: true,
		// StaggeredRenderer (HexagonalRenderer::tileToScreenCoords, no side)
		centre: (col, row) => {
			const shift = (row & 1) === 1 ? 32 : 0;
			return [col * 64 + shift + 32, row * 16 + 16];
		},
	},
};

// a Tiled JSON infinite map of one tile layer
const jsonMap = (orientation, painted = PAINTED) => {
	const { map, diamond } = ORIENTATIONS[orientation];
	const chunks = chunksOf(painted);
	const left = Math.min(
		...chunks.map((c) => {
			return c.x;
		}),
	);
	const top = Math.min(
		...chunks.map((c) => {
			return c.y;
		}),
	);
	const right = Math.max(
		...chunks.map((c) => {
			return c.x + c.width;
		}),
	);
	const bottom = Math.max(
		...chunks.map((c) => {
			return c.y + c.height;
		}),
	);
	const name = `infinite-${orientation}`;
	return {
		width: MAP_COLS,
		height: MAP_ROWS,
		renderorder: "right-down",
		infinite: true,
		version: "1.10",
		tiledversion: "1.10.2",
		nextobjectid: 1,
		...map,
		tilesets: [
			{
				firstgid: 1,
				name,
				tilewidth: map.tilewidth,
				tileheight: map.tileheight,
				spacing: 0,
				margin: 0,
				tilecount: COLOURS.length,
				columns: COLOURS.length,
				image: tilesetImage(name, map.tilewidth, map.tileheight, diamond),
			},
		],
		layers: [
			{
				type: "tilelayer",
				name: "ground",
				// as Tiled saves a JSON infinite layer: the chunks' bounds
				startx: left,
				starty: top,
				width: right - left,
				height: bottom - top,
				chunks,
				visible: true,
				opacity: 1,
			},
		],
	};
};

// the same map as Tiled saves it in TMX (XML), with CSV chunks: the layer
// carries the map's width and height
const tmxMap = (orientation, painted = PAINTED) => {
	const json = jsonMap(orientation, painted);
	const tileset = json.tilesets[0];
	const stagger =
		json.staggeraxis !== undefined
			? ` staggeraxis="${json.staggeraxis}" staggerindex="${json.staggerindex}"`
			: "";
	const chunks = json.layers[0].chunks
		.map((c) => {
			return `<chunk x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}">${c.data.join(",")}</chunk>`;
		})
		.join("");
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="${json.orientation}" renderorder="right-down" width="${MAP_COLS}" height="${MAP_ROWS}" tilewidth="${json.tilewidth}" tileheight="${json.tileheight}" infinite="1"${stagger} nextlayerid="2" nextobjectid="1">
 <tileset firstgid="1" name="${tileset.name}" tilewidth="${tileset.tilewidth}" tileheight="${tileset.tileheight}" tilecount="${tileset.tilecount}" columns="${tileset.columns}">
  <image source="${tileset.image}" width="${tileset.tilewidth * 4}" height="${tileset.tileheight}"/>
 </tileset>
 <layer id="1" name="ground" width="${MAP_COLS}" height="${MAP_ROWS}">
  <data encoding="csv">${chunks}</data>
 </layer>
</map>`;
	const doc = new DOMParser().parseFromString(xml, "text/xml");
	return TMXUtils.parse(doc).map;
};

const FORMATS = { json: jsonMap, tmx: tmxMap };

const layerOf = (format, orientation, painted) => {
	const map = new TMXTileMap(
		`infinite-${format}-${orientation}`,
		FORMATS[format](orientation, painted),
	);
	return map.getLayers()[0];
};

// every non-empty cell of the layer, [col, row, gid], in the map's tile
// coordinates
const cellsOf = (layer) => {
	const cells = [];
	for (let row = layer.starty; row < layer.starty + layer.rows; row++) {
		for (let col = layer.startx; col < layer.startx + layer.cols; col++) {
			const tile = layer.cellAt(col, row);
			if (tile !== null) {
				cells.push([col, row, tile.tileId]);
			}
		}
	}
	return cells;
};

const sorted = (cells) => {
	return [...cells].sort((a, b) => {
		return a[1] - b[1] || a[0] - b[0];
	});
};

describe("TMXLayer on an infinite map", () => {
	const renderers = [];
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

	afterEach(() => {
		for (const renderer of renderers.splice(0)) {
			renderer.destroy();
		}
	});

	describe.each(Object.keys(FORMATS))("%s", (format) => {
		describe.each(Object.keys(ORIENTATIONS))("%s", (orientation) => {
			it("holds every painted tile at its own column and row, and nothing else", () => {
				const layer = layerOf(format, orientation);
				expect(sorted(cellsOf(layer))).toEqual(sorted(PAINTED));
				for (const [col, row, gid] of PAINTED) {
					const tile = layer.cellAt(col, row);
					expect(tile.tileId).toEqual(gid);
					expect(tile.col).toEqual(col);
					expect(tile.row).toEqual(row);
				}
			});

			it("starts at the first chunk left of and above the origin, and covers the map", () => {
				const layer = layerOf(format, orientation);
				expect(layer.startx).toEqual(-4);
				expect(layer.starty).toEqual(-4);
				// the chunks run to column and row 8
				expect(layer.cols).toEqual(12);
				expect(layer.rows).toEqual(12);
			});

			it("getTile at a painted tile's centre (where Tiled puts it) returns that tile", () => {
				const layer = layerOf(format, orientation);
				const { centre } = ORIENTATIONS[orientation];
				const wrong = [];
				for (const [col, row, gid] of PAINTED) {
					const [x, y] = centre(col, row);
					const tile = layer.getTile(x, y);
					if (tile?.tileId !== gid || tile.col !== col || tile.row !== row) {
						wrong.push(
							`(${col},${row}) -> ${tile === null ? "null" : `(${tile.col},${tile.row}) #${tile.tileId}`}`,
						);
					}
				}
				expect(wrong).toEqual([]);
			});

			it("pixelToTileCoords and tileToPixelCoords agree with where Tiled puts every cell", () => {
				const layer = layerOf(format, orientation);
				const renderer = layer.getRenderer();
				const { centre } = ORIENTATIONS[orientation];
				const wrong = [];
				for (let row = layer.starty; row < layer.starty + layer.rows; row++) {
					for (let col = layer.startx; col < layer.startx + layer.cols; col++) {
						const [x, y] = centre(col, row);
						const t = renderer.pixelToTileCoords(x, y);
						if (Math.floor(t.x) !== col || Math.floor(t.y) !== row) {
							wrong.push(`(${col},${row}) -> (${t.x},${t.y})`);
						}
					}
				}
				expect(wrong).toEqual([]);
			});

			it("setTile and clearTile change the cell at negative coordinates", () => {
				const layer = layerOf(format, orientation);
				layer.clearTile(-3, -2);
				expect(layer.cellAt(-3, -2)).toBeNull();
				layer.setTile(layer.getTileById(4, -2, -3), -2, -3);
				expect(layer.cellAt(-2, -3).tileId).toEqual(4);
				// only those two cells changed
				const expected = PAINTED.filter(([col, row]) => {
					return col !== -3 || row !== -2;
				}).concat([[-2, -3, 4]]);
				expect(sorted(cellsOf(layer))).toEqual(sorted(expected));
				// outside the layer: no change, and nothing thrown
				layer.setTile(layer.getTileById(1, -5, 0), -5, 0);
				layer.clearTile(100, 100);
				expect(layer.cellAt(-5, 0)).toBeNull();
				expect(sorted(cellsOf(layer))).toEqual(sorted(expected));
			});

			it.each(["perTile", "prerender"])(
				"draws every tile where Tiled draws it (%s)",
				(mode) => {
					const layer = layerOf(format, orientation);
					const { centre } = ORIENTATIONS[orientation];
					// the whole layer, left of and above 0 included, and a margin
					const xs = [];
					const ys = [];
					for (let row = layer.starty; row < layer.starty + layer.rows; row++) {
						for (
							let col = layer.startx;
							col < layer.startx + layer.cols;
							col++
						) {
							const [x, y] = centre(col, row);
							xs.push(x);
							ys.push(y);
						}
					}
					const area = new Rect(
						Math.min(...xs) - 96,
						Math.min(...ys) - 96,
						Math.max(...xs) - Math.min(...xs) + 192,
						Math.max(...ys) - Math.min(...ys) + 192,
					);
					const renderer = new CanvasRenderer({
						width: area.width,
						height: area.height,
						transparent: true,
					});
					renderers.push(renderer);
					renderer.translate(-area.left, -area.top);
					layer.renderMode = mode;
					layer.onActivateEvent();
					layer.draw(renderer, area);
					const pixels = renderer
						.getContext()
						.getImageData(0, 0, area.width, area.height).data;
					const painted = new Map(
						PAINTED.map(([col, row, gid]) => {
							return [`${col},${row}`, gid];
						}),
					);
					const wrong = [];
					for (let row = layer.starty; row < layer.starty + layer.rows; row++) {
						for (
							let col = layer.startx;
							col < layer.startx + layer.cols;
							col++
						) {
							const [x, y] = centre(col, row);
							const i =
								((Math.floor(y) - area.top) * area.width +
									(Math.floor(x) - area.left)) *
								4;
							const got = [
								pixels[i],
								pixels[i + 1],
								pixels[i + 2],
								pixels[i + 3],
							];
							const gid = painted.get(`${col},${row}`);
							const want =
								gid === undefined ? [0, 0, 0, 0] : [...COLOURS[gid - 1], 255];
							if (got.join() !== want.join()) {
								wrong.push(`(${col},${row}) ${got.join()} != ${want.join()}`);
							}
						}
					}
					expect(wrong).toEqual([]);
				},
			);
		});
	});

	it("a tile past a 20-wide TMX layer does not wrap into the next row", () => {
		// the bug hunt's case: a TMX layer carries the map's width (20) while
		// its 16-wide chunks span columns 0 to 31
		const tiles = [[24, 0, 1]];
		const chunk = (x) => {
			return {
				x,
				y: 0,
				width: 16,
				height: 16,
				data: new Array(256).fill(0),
			};
		};
		const right = chunk(16);
		right.data[8] = 1;
		tilesetImage("infinite-wrap", 32, 32, false);
		const map = new TMXTileMap("infinite-wrap", {
			width: 20,
			height: 16,
			tilewidth: 32,
			tileheight: 32,
			orientation: "orthogonal",
			renderorder: "right-down",
			infinite: true,
			version: "1.10",
			tiledversion: "1.10.2",
			tilesets: [
				{
					firstgid: 1,
					name: "infinite-wrap",
					tilewidth: 32,
					tileheight: 32,
					tilecount: 4,
					columns: 4,
					image: "infinite-wrap.png",
				},
			],
			layers: [
				{
					type: "tilelayer",
					name: "ground",
					width: 20,
					height: 16,
					chunks: [chunk(0), right],
					visible: true,
					opacity: 1,
				},
			],
		});
		const layer = map.getLayers()[0];
		expect(layer.cellAt(4, 1)).toBeNull();
		expect(sorted(cellsOf(layer))).toEqual(tiles);
		expect(layer.getTile(24 * 32 + 5, 5).tileId).toEqual(1);
	});

	it("a staggered layer starting at an odd chunk column keeps every tile's stagger", () => {
		// a 3-wide chunk at x = -3: the layer's grid starts at the even
		// column -4, so its cells keep the map tiles' stagger
		const painted = [
			[-3, 1, 1],
			[-2, 2, 2],
			[0, 3, 3],
		];
		const json = jsonMap("staggered", painted);
		json.staggeraxis = "x";
		json.layers[0].chunks = [
			{
				x: -3,
				y: 0,
				width: 3,
				height: 4,
				data: [0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0],
			},
			{
				x: 0,
				y: 0,
				width: 4,
				height: 4,
				data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0],
			},
		];
		const layer = new TMXTileMap("infinite-odd", json).getLayers()[0];
		expect(layer.startx).toEqual(-4);
		expect(sorted(cellsOf(layer))).toEqual(sorted(painted));
		// stagger x, odd: an odd column is half a tile lower
		const renderer = layer.getRenderer();
		for (const [col, row, gid] of painted) {
			const p = renderer.tileToPixelCoords(col, row);
			const shift = (col & 1) === 1 ? 16 : 0;
			expect([p.x, p.y]).toEqual([col * 32, row * 32 + shift]);
			expect(layer.getTile(p.x + 32, p.y + 16).tileId).toEqual(gid);
		}
	});

	it("a finite map's layer is unchanged: it starts at 0 and is the map's size", () => {
		tilesetImage("finite-check", 32, 32, false);
		const map = new TMXTileMap("finite-check", {
			width: 3,
			height: 2,
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
					name: "finite-check",
					tilewidth: 32,
					tileheight: 32,
					tilecount: 4,
					columns: 4,
					image: "finite-check.png",
				},
			],
			layers: [
				{
					type: "tilelayer",
					name: "ground",
					width: 3,
					height: 2,
					data: [1, 0, 2, 0, 3, 4],
					visible: true,
					opacity: 1,
				},
			],
		});
		const layer = map.getLayers()[0];
		expect([layer.startx, layer.starty, layer.cols, layer.rows]).toEqual([
			0, 0, 3, 2,
		]);
		expect([layer.pos.x, layer.pos.y, layer.width, layer.height]).toEqual([
			0, 0, 96, 64,
		]);
		expect(sorted(cellsOf(layer))).toEqual(
			sorted([
				[0, 0, 1],
				[2, 0, 2],
				[1, 1, 3],
				[2, 1, 4],
			]),
		);
	});
});

describe("TMXLayer on an infinite map, WebGL shader path", () => {
	let renderer;

	beforeAll(async () => {
		boot();
		try {
			renderer = await getWebGLRenderer(64, 64);
		} catch {
			// no WebGL2 here: the test skips itself
		}
	});

	afterAll(() => {
		try {
			releaseWebGLRenderer();
		} catch {
			// nothing to release
		}
	});

	it("draws the layer's grid moved to where its first cell's tile is", (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
		const layer = new TMXTileMap(
			"infinite-shader",
			jsonMap("orthogonal"),
		).getLayers()[0];
		// the shader draws the grid from its first cell, at (0, 0): the layer
		// moves the renderer to that cell's place, (-4, -4) tiles of 32px,
		// and gives it the view in the grid's own coordinates
		layer.renderMode = "shader";
		const gpu = renderer._getTMXGPURendererFor("orthogonal");
		const calls = [];
		const draw = gpu.draw;
		gpu.draw = (l, rect) => {
			calls.push([
				rect.pos.x,
				rect.pos.y,
				rect.width,
				rect.height,
				renderer.currentTransform.tx,
				renderer.currentTransform.ty,
			]);
		};
		try {
			renderer.save();
			renderer.resetTransform();
			layer.draw(renderer, new Rect(-50, -20, 64, 64));
			const tx = renderer.currentTransform.tx;
			renderer.restore();
			expect(calls).toEqual([[-50 + 128, -20 + 128, 64, 64, -128, -128]]);
			// and the transform is back where it was
			expect(tx).toEqual(0);
		} finally {
			gpu.draw = draw;
		}
	});
});
