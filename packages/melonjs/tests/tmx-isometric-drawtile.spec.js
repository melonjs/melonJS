import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Rect, TMXTileMap, video } from "../src/index.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";

/**
 * The isometric renderer draws one tile with `drawTile` (from a `Tile`) or
 * `drawTileRaw` (from its gid). Both used to place it with the map's column
 * count where Tiled uses its row count, and a quarter of the tile height where
 * Tiled uses a half: a tile drawn alone landed away from where the layer, and
 * Tiled, draw it.
 *
 * Tiled puts the top corner of tile (col, row) at ((col - row) * tilewidth / 2
 * + rows * tilewidth / 2, (col + row) * tileheight / 2). The map here is 4
 * columns by 2 rows, so the column and row counts differ, and each cell holds
 * a diamond of its own colour.
 */

const COLS = 4;
const ROWS = 2;
const TW = 64;
const TH = 32;

// a colour per cell, all distinct
const colourOf = (col, row) => {
	return [40 + col * 50, 40 + row * 100, 200];
};

const tilesetImage = () => {
	const canvas = document.createElement("canvas");
	canvas.width = TW * COLS * ROWS;
	canvas.height = TH;
	const ctx = canvas.getContext("2d");
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const i = row * COLS + col;
			const [r, g, b] = colourOf(col, row);
			ctx.fillStyle = `rgb(${r},${g},${b})`;
			ctx.beginPath();
			ctx.moveTo(i * TW + TW / 2, 0);
			ctx.lineTo(i * TW + TW, TH / 2);
			ctx.lineTo(i * TW + TW / 2, TH);
			ctx.lineTo(i * TW, TH / 2);
			ctx.closePath();
			ctx.fill();
		}
	}
	imgList["iso-drawtile-tiles"] = canvas;
	return "iso-drawtile-tiles.png";
};

const layerOf = () => {
	const data = [];
	for (let i = 0; i < COLS * ROWS; i++) {
		data.push(i + 1);
	}
	const map = new TMXTileMap("iso-drawtile", {
		width: COLS,
		height: ROWS,
		tilewidth: TW,
		tileheight: TH,
		orientation: "isometric",
		renderorder: "right-down",
		infinite: false,
		version: "1.10",
		tiledversion: "1.10.2",
		tilesets: [
			{
				firstgid: 1,
				name: "iso-drawtile-tiles",
				tilewidth: TW,
				tileheight: TH,
				spacing: 0,
				margin: 0,
				tilecount: COLS * ROWS,
				columns: COLS * ROWS,
				image: tilesetImage(),
			},
		],
		layers: [
			{
				type: "tilelayer",
				name: "ground",
				width: COLS,
				height: ROWS,
				data,
				visible: true,
				opacity: 1,
			},
		],
	});
	return map.getLayers()[0];
};

// the centre of tile (col, row), as Tiled draws it
const tiledCentre = (col, row) => {
	return [
		((col - row) * TW) / 2 + (ROWS * TW) / 2,
		((col + row) * TH) / 2 + TH / 2,
	];
};

// the map's whole area: (COLS + ROWS) half tiles each way
const W = ((COLS + ROWS) * TW) / 2;
const H = ((COLS + ROWS) * TH) / 2;

// draw with `draw(renderer)`, then list every cell whose centre does not show
// its own colour
const misplaced = (draw) => {
	const renderer = new CanvasRenderer({
		width: W,
		height: H,
		transparent: true,
	});
	try {
		draw(renderer);
		const ctx = renderer.getContext();
		const wrong = [];
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const [x, y] = tiledCentre(col, row);
				const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
				const [er, eg, eb] = colourOf(col, row);
				if (r !== er || g !== eg || b !== eb) {
					wrong.push(`(${col},${row}) shows rgb(${r},${g},${b})`);
				}
			}
		}
		return wrong;
	} finally {
		renderer.destroy();
	}
};

describe("isometric renderer: one tile drawn alone lands where Tiled draws it", () => {
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

	it("the layer, drawn whole, puts every tile where Tiled does", () => {
		const layer = layerOf();
		expect(
			misplaced((renderer) => {
				layer
					.getRenderer()
					.drawTileLayer(renderer, layer, new Rect(0, 0, W, H));
			}),
		).toEqual([]);
	});

	it("drawTile puts every tile where the layer and Tiled do", () => {
		const layer = layerOf();
		expect(
			misplaced((renderer) => {
				for (let row = 0; row < ROWS; row++) {
					for (let col = 0; col < COLS; col++) {
						layer
							.getRenderer()
							.drawTile(renderer, col, row, layer.cellAt(col, row));
					}
				}
			}),
		).toEqual([]);
	});

	it("drawTileRaw puts every tile where the layer and Tiled do", () => {
		const layer = layerOf();
		expect(
			misplaced((renderer) => {
				for (let row = 0; row < ROWS; row++) {
					for (let col = 0; col < COLS; col++) {
						const tile = layer.cellAt(col, row);
						layer
							.getRenderer()
							.drawTileRaw(renderer, col, row, tile.tileId, 0, tile.tileset);
					}
				}
			}),
		).toEqual([]);
	});
});
