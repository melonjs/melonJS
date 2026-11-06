import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Rect, TMXTileMap, video } from "../src/index.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";

/**
 * `TMXLayer.getTile(x, y)` checks the point is in the layer's bounding box,
 * converts it to tile coordinates and reads the cell. `cellAt` truncated the
 * coordinates with `~~`, which rounds toward 0: on an isometric map, where
 * the corners of the bounding box are outside the diamond of tiles, a point
 * just past the edge gives a column or row of -0.09, read as 0 — the edge
 * tile, not `null`. The same held for a staggered map's left and top
 * corners, and for an oblique map skewed left of 0.
 *
 * Coordinates are rounded down instead: every point is checked against the
 * tile whose diamond (or cell) holds it, worked out here from where Tiled
 * draws each tile.
 */

const COLS = 5;
const ROWS = 4;

// a map of one layer, every cell filled, tile id 1 + its index
const layerFor = (name, map) => {
	const canvas = document.createElement("canvas");
	canvas.width = map.tilewidth * COLS * ROWS;
	canvas.height = map.tileheight;
	const ctx = canvas.getContext("2d");
	// a diamond per tile, one colour each
	for (let i = 0; i < COLS * ROWS; i++) {
		const w = map.tilewidth;
		const h = map.tileheight;
		ctx.fillStyle = `rgb(${(i * 53) % 256},${(i * 97) % 256},${255 - i * 9})`;
		ctx.beginPath();
		ctx.moveTo(i * w + w / 2, 0);
		ctx.lineTo(i * w + w, h / 2);
		ctx.lineTo(i * w + w / 2, h);
		ctx.lineTo(i * w, h / 2);
		ctx.closePath();
		ctx.fill();
	}
	imgList[name] = canvas;
	const data = [];
	for (let i = 0; i < COLS * ROWS; i++) {
		data.push(i + 1);
	}
	return new TMXTileMap(name, {
		width: COLS,
		height: ROWS,
		renderorder: "right-down",
		infinite: false,
		version: "1.10",
		tiledversion: "1.12.0",
		...map,
		tilesets: [
			{
				firstgid: 1,
				name,
				tilewidth: map.tilewidth,
				tileheight: map.tileheight,
				spacing: 0,
				margin: 0,
				tilecount: COLS * ROWS,
				columns: COLS * ROWS,
				image: `${name}.png`,
			},
		],
		layers: [
			{
				type: "tilelayer",
				name: "ground",
				// the order a layer draws its tiles in (the layer's own, here)
				renderorder: map.renderorder ?? "right-down",
				width: COLS,
				height: ROWS,
				data,
				visible: true,
				opacity: 1,
			},
		],
	}).getLayers()[0];
};

// the cell holding (x, y) well inside it (not within 8% of its edge), among
// the map's cells and a ring around them, as Tiled lays them out
const isometricCell = (x, y) => {
	// IsometricRenderer: tile (col, row)'s top corner at
	// ((col - row) * tw / 2 + rows * tw / 2, (col + row) * th / 2)
	for (let row = -2; row < ROWS + 2; row++) {
		for (let col = -2; col < COLS + 2; col++) {
			const cx = (col - row) * 32 + ROWS * 32;
			const cy = (col + row) * 16 + 16;
			if (Math.abs(x - cx) / 32 + Math.abs(y - cy) / 16 < 0.92) {
				return [col, row];
			}
		}
	}
	return undefined;
};

const staggeredCell = (x, y) => {
	// stagger y, odd: an odd row half a tile right
	for (let row = -2; row < ROWS + 2; row++) {
		for (let col = -2; col < COLS + 2; col++) {
			const cx = col * 64 + ((row & 1) === 1 ? 32 : 0) + 32;
			const cy = row * 16 + 16;
			if (Math.abs(x - cx) / 32 + Math.abs(y - cy) / 16 < 0.92) {
				return [col, row];
			}
		}
	}
	return undefined;
};

// tile (col, row) of an oblique map is its orthogonal cell sheared:
// (col * tw + skewx * row, row * th + skewy * col); undo the shear, and keep
// away from the cell edges
const obliqueCell = (tw, th, skewx, skewy) => {
	return (x, y) => {
		const sx = skewx / th;
		const sy = skewy / tw;
		const det = 1 - sx * sy;
		const col = (x - sx * y) / det / tw;
		const row = (y - sy * x) / det / th;
		const fx = col - Math.floor(col);
		const fy = row - Math.floor(row);
		if (fx < 0.04 || fx > 0.96 || fy < 0.04 || fy > 0.96) {
			return undefined;
		}
		return [Math.floor(col), Math.floor(row)];
	};
};

// tile (col, row) of an orthogonal map: (col * tw, row * th)
const orthogonalCell = (x, y) => {
	const col = x / 32;
	const row = y / 24;
	const fx = col - Math.floor(col);
	const fy = row - Math.floor(row);
	if (fx < 0.04 || fx > 0.96 || fy < 0.04 || fy > 0.96) {
		return undefined;
	}
	return [Math.floor(col), Math.floor(row)];
};

const CASES = [
	[
		"isometric",
		{ orientation: "isometric", tilewidth: 64, tileheight: 32 },
		isometricCell,
	],
	[
		"staggered",
		{
			orientation: "staggered",
			tilewidth: 64,
			tileheight: 32,
			staggeraxis: "y",
			staggerindex: "odd",
		},
		staggeredCell,
	],
	[
		"oblique, skewed left of 0",
		{
			orientation: "oblique",
			tilewidth: 40,
			tileheight: 16,
			skewx: -12,
		},
		obliqueCell(40, 16, -12, 0),
	],
	[
		"oblique, skewed both ways",
		{
			orientation: "oblique",
			tilewidth: 40,
			tileheight: 24,
			skewx: 10,
			skewy: -6,
		},
		obliqueCell(40, 24, 10, -6),
	],
	[
		"oblique, drawn left-up",
		{
			orientation: "oblique",
			renderorder: "left-up",
			tilewidth: 40,
			tileheight: 16,
			skewx: -12,
		},
		obliqueCell(40, 16, -12, 0),
	],
	...["right-down", "right-up", "left-down", "left-up"].map((order) => {
		return [
			`orthogonal, drawn ${order}`,
			{
				orientation: "orthogonal",
				renderorder: order,
				tilewidth: 32,
				tileheight: 24,
			},
			orthogonalCell,
		];
	}),
];

describe("TMXLayer.getTile just outside the tiles, and views at the edges", () => {
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

	it("isometric: left of the top corner, in the layer's bounding box, is no tile", () => {
		const layer = layerFor("iso-corner", CASES[0][1]);
		// the top corner of tile (0, 0) is at (128, 0); its upper-left edge
		// passes x = 126 at y = 1, so (120, 1) is outside every tile
		expect(layer.contains(120, 1)).toEqual(true);
		expect(layer.getTile(120, 1)).toBeNull();
		// and the four corners of the bounding box
		const { left, top, right, bottom } = layer.getBounds();
		for (const [x, y] of [
			[left + 2, top + 2],
			[right - 2, top + 2],
			[left + 2, bottom - 2],
			[right - 2, bottom - 2],
		]) {
			expect(layer.getTile(x, y)).toBeNull();
		}
	});

	it("cellAt rounds a fractional column or row down, not toward 0", () => {
		const layer = layerFor("iso-cellat", CASES[0][1]);
		expect(layer.cellAt(-0.09, 0)).toBeNull();
		expect(layer.cellAt(0, -0.5)).toBeNull();
		expect(layer.cellAt(1.99, 0.01).tileId).toEqual(2);
		expect(layer.cellAt(COLS - 0.01, ROWS - 0.01).tileId).toEqual(COLS * ROWS);
		expect(layer.cellAt(COLS, 0)).toBeNull();
	});

	describe.each(CASES)("%s", (name, map, cellHolding) => {
		it("getTile is the tile under every point of the layer's bounds, or null", () => {
			const layer = layerFor(`gettile-${name}`, map);
			const { left, top, right, bottom } = layer.getBounds();
			const wrong = [];
			let checked = 0;
			let outside = 0;
			for (let y = top - 10; y < bottom + 10; y += 1.5) {
				for (let x = left - 10; x < right + 10; x += 2.5) {
					const want = cellHolding(x, y);
					if (want === undefined) {
						continue;
					}
					const inside =
						want[0] >= 0 && want[0] < COLS && want[1] >= 0 && want[1] < ROWS;
					checked++;
					if (!inside) {
						outside++;
					}
					const tile = layer.getTile(x, y);
					const got = tile === null ? null : tile.tileId;
					const expected = inside ? 1 + want[1] * COLS + want[0] : null;
					if (got !== expected) {
						wrong.push(
							`(${x},${y}) -> ${tile === null ? "null" : `(${tile.col},${tile.row})`}, not ${inside ? `(${want})` : "null"}`,
						);
					}
				}
			}
			expect(checked).toBeGreaterThan(1000);
			// points outside the tiles were checked too
			expect(outside).toBeGreaterThan(50);
			expect(wrong.slice(0, 10)).toEqual([]);
		});

		it("pixelToTileCoords rounded down is the cell holding each tile's centre", () => {
			const layer = layerFor(`centre-${name}`, map);
			const renderer = layer.getRenderer();
			const wrong = [];
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					// the centre: half a tile in, along the map's own axes
					const p = renderer.tileToPixelCoords(col + 0.5, row + 0.5);
					if (map.orientation === "staggered") {
						// whole tiles only: the centre is half a tile right and down
						renderer.tileToPixelCoords(col, row, p);
						p.x += map.tilewidth / 2;
						p.y += map.tileheight / 2;
					}
					const t = renderer.pixelToTileCoords(p.x, p.y);
					if (Math.floor(t.x) !== col || Math.floor(t.y) !== row) {
						wrong.push(`(${col},${row}) -> (${t.x},${t.y})`);
					}
				}
			}
			expect(wrong).toEqual([]);
		});

		it("a view anywhere over the map draws what a view of the whole map shows there", () => {
			const layer = layerFor(`view-${name}`, map);
			const W = 70;
			const H = 50;
			const bounds = layer.getRenderer().getBounds(layer);
			// whole pixels: the view and the whole map draw the same pixels
			const left = Math.floor(bounds.left) - 64;
			const top = Math.floor(bounds.top) - 64;
			const area = new Rect(
				left,
				top,
				Math.ceil(bounds.right) + 64 + W - left,
				Math.ceil(bounds.bottom) + 64 + H - top,
			);
			const draw = (x, y, width, height, rect) => {
				const renderer = new CanvasRenderer({
					width,
					height,
					transparent: true,
				});
				renderers.push(renderer);
				renderer.translate(-x, -y);
				layer.draw(renderer, rect);
				return renderer.getContext().getImageData(0, 0, width, height).data;
			};
			const whole = draw(area.left, area.top, area.width, area.height, area);
			const differing = [];
			for (let y0 = area.top + 34; y0 < bounds.bottom; y0 += 13) {
				for (let x0 = area.left + 34; x0 < bounds.right; x0 += 17) {
					const view = draw(x0, y0, W, H, new Rect(x0, y0, W, H));
					let differ = 0;
					for (let y = 0; y < H; y++) {
						for (let x = 0; x < W; x++) {
							const i = (y * W + x) * 4;
							const j =
								((y + y0 - area.top) * area.width + x + x0 - area.left) * 4;
							if (
								view[i] !== whole[j] ||
								view[i + 1] !== whole[j + 1] ||
								view[i + 2] !== whole[j + 2] ||
								view[i + 3] !== whole[j + 3]
							) {
								differ++;
							}
						}
					}
					if (differ !== 0) {
						differing.push(`(${x0},${y0}): ${differ} px`);
					}
					for (const renderer of renderers.splice(1)) {
						renderer.destroy();
					}
				}
			}
			expect(differing.slice(0, 10)).toEqual([]);
			// and a view wholly past each side of the layer draws nothing
			for (const [x0, y0] of [
				[area.left - W - 50, 0],
				[area.right + 50, 0],
				[0, area.top - H - 50],
				[0, area.bottom + 50],
			]) {
				const view = draw(x0, y0, W, H, new Rect(x0, y0, W, H));
				expect(
					view.some((v) => {
						return v !== 0;
					}),
				).toEqual(false);
			}
		});
	});
});
