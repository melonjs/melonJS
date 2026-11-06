import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Rect, TMXTileMap, video } from "../src/index.js";
import TMXStaggeredRenderer from "../src/level/tiled/renderer/TMXStaggeredRenderer.js";
import { imgList } from "../src/loader/cache.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";

/**
 * A staggered map's `pixelToTileCoords` (and so `TMXLayer.getTile`) gave a
 * neighbouring tile for every row (or column) past the first: it doubled the
 * grid-aligned reference point into a tile row *before* measuring where the
 * point is on the reference square, so the point seemed far below (or right
 * of) it. Tiled's `StaggeredRenderer::screenToTileCoords`, and melonJS's own
 * hexagonal renderer, measure first; and Tiled tests the four corners with
 * if / else if, one neighbour at most.
 *
 * The staggered renderer draws through the hexagonal one, which starts at the
 * tile `pixelToTileCoords` gives for the view's top left corner: given a
 * staggered map's point within its tile (2.3, 4.7), it read cells at
 * fractional indices, and a view scrolled anywhere but the origin drew
 * nothing.
 *
 * Every case is checked for both stagger axes and both stagger indices
 * against where Tiled puts each tile.
 */

const COLS = 6;
const ROWS = 8;
const TW = 64;
const TH = 32;

const VARIANTS = [
	["y", "odd"],
	["y", "even"],
	["x", "odd"],
	["x", "even"],
];

// where Tiled draws tile (col, row), its top left corner, on a staggered map
// (HexagonalRenderer::tileToScreenCoords with no side length)
const tiledTopLeft = (axis, index, col, row) => {
	const even = index === "even" ? 1 : 0;
	if (axis === "x") {
		const shifted = ((col & 1) ^ even) === 1;
		return [col * (TW / 2), row * TH + (shifted ? TH / 2 : 0)];
	}
	const shifted = ((row & 1) ^ even) === 1;
	return [col * TW + (shifted ? TW / 2 : 0), row * (TH / 2)];
};

// the tile whose diamond holds (x, y) well inside it (not within 8% of its
// edge), among the map's tiles and a ring around them, or undefined
const tileHolding = (axis, index, x, y) => {
	for (let row = -2; row < ROWS + 2; row++) {
		for (let col = -2; col < COLS + 2; col++) {
			const [left, top] = tiledTopLeft(axis, index, col, row);
			const dx = Math.abs(x - (left + TW / 2)) / (TW / 2);
			const dy = Math.abs(y - (top + TH / 2)) / (TH / 2);
			if (dx + dy < 0.92) {
				return [col, row];
			}
		}
	}
	return undefined;
};

const rendererFor = (axis, index) => {
	return new TMXStaggeredRenderer({
		cols: COLS,
		rows: ROWS,
		tilewidth: TW,
		tileheight: TH,
		orientation: "staggered",
		staggeraxis: axis,
		staggerindex: index,
		hexsidelength: 0,
	});
};

// diamond tiles, one colour each: tile `i` is a grey level of its own, so
// a tile drawn in the wrong place, or not at all, shows
const tilesetImage = (name, count) => {
	const canvas = document.createElement("canvas");
	canvas.width = TW * count;
	canvas.height = TH;
	const ctx = canvas.getContext("2d");
	for (let i = 0; i < count; i++) {
		ctx.fillStyle = `rgb(${(i * 37) % 256},${(i * 91) % 256},${255 - i * 4})`;
		ctx.beginPath();
		ctx.moveTo(i * TW + TW / 2, 0);
		ctx.lineTo(i * TW + TW, TH / 2);
		ctx.lineTo(i * TW + TW / 2, TH);
		ctx.lineTo(i * TW, TH / 2);
		ctx.closePath();
		ctx.fill();
	}
	imgList[name] = canvas;
	return `${name}.png`;
};

// a staggered (or hexagonal) map of one layer, every cell filled, tile id 1 + its index
const layerFor = (
	axis,
	index,
	orientation = "staggered",
	hexsidelength = 0,
) => {
	const name = `${orientation}-${axis}-${index}`;
	const data = [];
	for (let i = 0; i < COLS * ROWS; i++) {
		data.push(i + 1);
	}
	const map = new TMXTileMap(name, {
		width: COLS,
		height: ROWS,
		tilewidth: TW,
		tileheight: TH,
		orientation,
		hexsidelength,
		staggeraxis: axis,
		staggerindex: index,
		renderorder: "right-down",
		infinite: false,
		version: "1.10",
		tiledversion: "1.10.2",
		tilesets: [
			{
				firstgid: 1,
				name,
				tilewidth: TW,
				tileheight: TH,
				spacing: 0,
				margin: 0,
				tilecount: COLS * ROWS,
				columns: COLS * ROWS,
				image: tilesetImage(name, COLS * ROWS),
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

describe("staggered map coordinates", () => {
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

	describe.each(VARIANTS)("stagger axis %s, index %s", (axis, index) => {
		it("tileToPixelCoords puts every tile where Tiled does", () => {
			const renderer = rendererFor(axis, index);
			const wrong = [];
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					const p = renderer.tileToPixelCoords(col, row);
					const want = tiledTopLeft(axis, index, col, row);
					if (p.x !== want[0] || p.y !== want[1]) {
						wrong.push(`(${col},${row})`);
					}
				}
			}
			expect(wrong).toEqual([]);
		});

		it("pixelToTileCoords maps the centre of every tile back onto it", () => {
			const renderer = rendererFor(axis, index);
			const wrong = [];
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					const p = renderer.tileToPixelCoords(col, row);
					const t = renderer.pixelToTileCoords(p.x + TW / 2, p.y + TH / 2);
					if (Math.floor(t.x) !== col || Math.floor(t.y) !== row) {
						wrong.push(`(${col},${row}) -> (${t.x},${t.y})`);
					}
				}
			}
			expect(wrong).toEqual([]);
		});

		it("pixelToTileCoords gives the tile whose diamond holds the point, all over the map", () => {
			const renderer = rendererFor(axis, index);
			const wrong = [];
			let checked = 0;
			for (let y = -24; y < ROWS * TH + 24; y += 3) {
				for (let x = -40; x < COLS * TW + 40; x += 5) {
					const want = tileHolding(axis, index, x, y);
					if (want === undefined) {
						continue;
					}
					checked++;
					const t = renderer.pixelToTileCoords(x, y);
					const got = [Math.floor(t.x), Math.floor(t.y)];
					if (got[0] !== want[0] || got[1] !== want[1]) {
						wrong.push(`(${x},${y}) -> (${got}) not (${want})`);
					}
				}
			}
			expect(checked).toBeGreaterThan(1000);
			expect(wrong.slice(0, 10)).toEqual([]);
		});

		it("layer.getTile returns the tile drawn under the point, or null off the map", () => {
			const layer = layerFor(axis, index);
			const wrong = [];
			for (let y = -24; y < ROWS * TH + 24; y += 3) {
				for (let x = -40; x < COLS * TW + 40; x += 5) {
					const want = tileHolding(axis, index, x, y);
					if (want === undefined) {
						continue;
					}
					const inside =
						want[0] >= 0 && want[0] < COLS && want[1] >= 0 && want[1] < ROWS;
					const tile = layer.getTile(x, y);
					const expected = inside ? 1 + want[1] * COLS + want[0] : null;
					if ((tile === null ? null : tile.tileId) !== expected) {
						wrong.push(
							`(${x},${y}) -> ${tile === null ? "null" : `(${tile.col},${tile.row})`} not ${inside ? `(${want})` : "null"}`,
						);
					}
				}
			}
			expect(wrong.slice(0, 10)).toEqual([]);
		});

		it("a view anywhere over the map draws what a view of the whole map shows there", () => {
			expect(viewsDiffering(layerFor(axis, index))).toEqual([]);
		});
	});

	// the hexagonal renderer draws the staggered maps: the same loop
	describe.each(VARIANTS)(
		"hexagonal, stagger axis %s, index %s",
		(axis, index) => {
			it("a view anywhere over the map draws what a view of the whole map shows there", () => {
				expect(viewsDiffering(layerFor(axis, index, "hexagonal", 16))).toEqual(
					[],
				);
			});
		},
	);

	// the layer drawn whole, then through views of 120 x 90 all over it
	// (and past its edges): the views where a pixel differs from the whole
	const viewsDiffering = (layer) => {
		const W = 120;
		const H = 90;
		const bounds = layer.getRenderer().getBounds(layer);
		const area = new Rect(
			bounds.left - 64,
			bounds.top - 64,
			bounds.width + 128 + W,
			bounds.height + 128 + H,
		);
		const draw = (left, top, width, height, rect) => {
			const renderer = new CanvasRenderer({ width, height, transparent: true });
			renderers.push(renderer);
			renderer.translate(-left, -top);
			layer.draw(renderer, rect);
			return renderer.getContext().getImageData(0, 0, width, height).data;
		};
		const whole = draw(area.left, area.top, area.width, area.height, area);
		const differing = [];
		let painted = 0;
		for (let top = bounds.top - 40; top < bounds.bottom; top += 23) {
			for (let left = bounds.left - 40; left < bounds.right; left += 29) {
				const view = draw(left, top, W, H, new Rect(left, top, W, H));
				let differ = 0;
				for (let y = 0; y < H; y++) {
					for (let x = 0; x < W; x++) {
						const i = (y * W + x) * 4;
						const j =
							((y + top - area.top) * area.width + x + left - area.left) * 4;
						if (whole[j + 3] !== 0) {
							painted++;
						}
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
					differing.push(`(${left},${top}): ${differ} px`);
				}
				for (const renderer of renderers.splice(1)) {
					renderer.destroy();
				}
			}
		}
		// the views did show the map
		expect(painted).toBeGreaterThan(10000);
		return differing.slice(0, 10);
	};

	describe("stagger axis y, index odd", () => {
		it("the bug hunt's case: getTile at the centre of each tile", () => {
			const layer = layerFor("y", "odd");
			const renderer = layer.getRenderer();
			const wrong = [];
			for (let row = 0; row < ROWS; row++) {
				for (let col = 0; col < COLS; col++) {
					const p = renderer.tileToPixelCoords(col, row);
					const tile = layer.getTile(p.x + TW / 2, p.y + TH / 2);
					if (tile === null || tile.tileId !== 1 + row * COLS + col) {
						wrong.push(`(${col},${row})`);
					}
				}
			}
			expect(wrong).toEqual([]);
		});
	});
});
