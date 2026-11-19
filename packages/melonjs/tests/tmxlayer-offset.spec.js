/**
 * Where a tile layer is: moved by its offset in Tiled and by its own `pos`,
 * and in view as far as its tiles reach, which is past its grid when they
 * are larger than a cell or moved by their tileset's `tileoffset`.
 *
 * Checked here on the Canvas renderer, tile by tile and baked into one
 * image, against the picture painted with no engine (see
 * `helpers/tile-layer-compare.js`), and for what `getTile` answers. The GPU
 * renderers are held to the same in `helpers/tile-layer-isometric-scenarios.js`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { video } from "../src/index.js";
import {
	diff,
	drawIn,
	drawn,
	fill,
	inBlock,
	makeApp,
	makeMap,
	makeTileset,
	reference,
	show,
} from "./helpers/tile-layer-compare.js";

const WIDTH = 320;
const HEIGHT = 240;

const filled = (cols, rows) => {
	return fill(cols, rows, (c, r) => {
		return (c * 3 + r) % 7 === 0 ? 0 : 1 + ((c + r * 2) % 8);
	});
};

const orthogonal = (options = {}) => {
	return {
		orientation: "orthogonal",
		cols: 10,
		rows: 8,
		tw: 32,
		th: 32,
		tilesets: [makeTileset({ tw: 32, th: options.tall ?? 32 })],
		layers: [{ data: filled(10, 8), ...options.layer }],
	};
};

const isometric = (options = {}) => {
	const th = options.tall ?? 64;
	return {
		orientation: "isometric",
		cols: 8,
		rows: 6,
		tw: 64,
		th: 32,
		tilesets: [
			makeTileset({
				tw: 64,
				th,
				opaque: (x, y) => {
					return inBlock(x, y, 64, th, 64, 32);
				},
			}),
		],
		layers: [{ data: filled(8, 6), ...options.layer }],
	};
};

describe("where a tile layer is (Canvas renderer)", () => {
	let app;
	beforeAll(async () => {
		app = await makeApp(video.CANVAS, "CANVAS", WIDTH, HEIGHT);
	});
	afterAll(() => {
		app?.destroy();
		vi.restoreAllMocks();
	});

	/**
	 * Draw a scene tile by tile and baked, from each view, and expect the
	 * reference picture.
	 * @returns {Promise<number>} how many pixels were drawn, in all
	 */
	const asTiled = async (scene, views) => {
		let total = 0;
		for (const mode of ["perTile", "prerender"]) {
			const layers = show(app, makeMap(scene), mode);
			for (const [x, y] of views) {
				app.viewport.moveTo(x, y);
				const { frame } = await drawIn(app, layers, mode);
				const d = diff(reference(scene, x, y, WIDTH, HEIGHT), frame);
				expect(d.different, `${mode}, view (${x}, ${y}): ${d.first}`).toBe(0);
				total += drawn(frame);
			}
		}
		return total;
	};

	const VIEWS = [
		[0, 0],
		[70, 20],
		[-40, -80],
		[230, 110],
	];

	describe("moved by its offset in Tiled", () => {
		for (const [x, y] of [
			[37, -21],
			[-130, 75],
		]) {
			it(`an orthogonal layer, by (${x}, ${y})`, async () => {
				const scene = orthogonal({
					tall: 64,
					layer: { offsetx: x, offsety: y },
				});
				expect(await asTiled(scene, VIEWS)).toBeGreaterThan(0);
			});

			it(`an isometric layer, by (${x}, ${y})`, async () => {
				const scene = isometric({
					tall: 128,
					layer: { offsetx: x, offsety: y },
				});
				expect(await asTiled(scene, VIEWS)).toBeGreaterThan(0);
			});
		}

		for (const [orientation, extra] of [
			["staggered", { staggeraxis: "y", staggerindex: "odd" }],
			[
				"hexagonal",
				{ staggeraxis: "x", staggerindex: "even", hexsidelength: 16 },
			],
		]) {
			it(`a ${orientation} layer: the same picture, moved`, async () => {
				// no reference is painted for these maps: the layer moved by
				// (37, -21) is the layer where it was, seen from that much
				// the other way
				const scene = (layer) => {
					return {
						orientation,
						cols: 8,
						rows: 8,
						tw: 64,
						th: 32,
						tilesets: [tileset],
						layers: [{ data: filled(8, 8), ...layer }],
						extra,
					};
				};
				const tileset = makeTileset({
					tw: 64,
					th: 48,
					opaque: (x, y) => {
						return inBlock(x, y, 64, 48, 64, 32);
					},
				});
				for (const mode of ["perTile", "prerender"]) {
					const plain = show(app, makeMap(scene({})), mode);
					const frames = [];
					for (const [x, y] of VIEWS) {
						app.viewport.moveTo(x - 37, y + 21);
						frames.push((await drawIn(app, plain, mode)).frame);
					}
					const moved = show(
						app,
						makeMap(scene({ offsetx: 37, offsety: -21 })),
						mode,
					);
					for (const [i, [x, y]] of VIEWS.entries()) {
						app.viewport.moveTo(x, y);
						const { frame } = await drawIn(app, moved, mode);
						const d = diff(frames[i], frame);
						expect(d.different, `${mode}, view (${x}, ${y}): ${d.first}`).toBe(
							0,
						);
						expect(drawn(frame)).toBeGreaterThan(0);
					}
				}
			});
		}

		it("the layer's pos is its offset, and its bounds move with it", () => {
			const [layer] = show(
				app,
				makeMap(orthogonal({ layer: { offsetx: 37, offsety: -21 } })),
			);
			expect([layer.pos.x, layer.pos.y]).toEqual([37, -21]);
			expect([layer.width, layer.height]).toEqual([320, 256]);
			const bounds = layer.getBounds();
			expect([bounds.left, bounds.top]).toEqual([37, -21]);
			expect([bounds.right, bounds.bottom]).toEqual([357, 235]);
			// no offset: where it always was
			const [plain] = show(app, makeMap(orthogonal()));
			expect([plain.pos.x, plain.pos.y]).toEqual([0, 0]);
		});

		it("getTile answers for where the tiles are drawn", () => {
			const [layer] = show(
				app,
				makeMap(orthogonal({ layer: { offsetx: 40, offsety: -24 } })),
			);
			// the cell (2, 3) is drawn from (64 + 40, 96 - 24)
			const tile = layer.getTile(64 + 40 + 5, 96 - 24 + 5);
			expect([tile.col, tile.row]).toEqual([2, 3]);
			expect(tile.tileId).toBe(layer.cellAt(2, 3).tileId);
			// its last pixel, and the first of the next cell
			expect(layer.getTile(95 + 40, 127 - 24).col).toBe(2);
			expect(layer.getTile(96 + 40, 127 - 24).col).toBe(3);
			// left of where the layer now starts: no tile, where there was
			// one before the layer was moved
			expect(layer.getTile(5, 40)).toBeNull();
			const first = layer.getTile(32 + 40 + 5, -20);
			expect([first.col, first.row]).toEqual([1, 0]);

			const [iso] = show(
				app,
				makeMap(isometric({ layer: { offsetx: -30, offsety: 50 } })),
			);
			// the middle of the diamond of cell (3, 2): the map's top
			// corner is at x = rows × half a tile
			const originX = 6 * 32;
			const middle = iso.getTile(
				(3 - 2) * 32 + originX - 30,
				(3 + 2 + 1) * 16 + 50,
			);
			expect([middle.col, middle.row]).toEqual([3, 2]);
		});
	});

	describe("getTile, on every kind of map, with the layer moved", () => {
		const grids = [
			["orthogonal", 32, 32, {}],
			["isometric", 64, 32, {}],
			["staggered", 64, 32, { staggeraxis: "y", staggerindex: "odd" }],
			["staggered", 64, 32, { staggeraxis: "x", staggerindex: "even" }],
			[
				"hexagonal",
				28,
				24,
				{ staggeraxis: "y", staggerindex: "odd", hexsidelength: 12 },
			],
			[
				"hexagonal",
				28,
				24,
				{ staggeraxis: "x", staggerindex: "even", hexsidelength: 11 },
			],
		];
		for (const [orientation, tw, th, extra] of grids) {
			it(`${orientation}${extra.staggeraxis ? `, axis ${extra.staggeraxis}` : ""}: the middle of every cell is that cell`, () => {
				const cols = 7;
				const rows = 6;
				const scene = {
					orientation,
					cols,
					rows,
					tw,
					th,
					tilesets: [makeTileset({ tw, th })],
					layers: [{ data: filled(cols, rows), offsetx: 37, offsety: -21 }],
					extra,
				};
				const [layer] = show(app, makeMap(scene));
				const map = layer.getRenderer();
				let found = 0;
				for (const [dx, dy] of [
					[0, 0],
					[55, -140],
				]) {
					layer.pos.x += dx;
					layer.pos.y += dy;
					const movedX = 37 + dx;
					const movedY = -21 + dy;
					for (let row = 0; row < rows; row++) {
						for (let col = 0; col < cols; col++) {
							// the middle of the cell, where the map's renderer
							// puts it, moved as the layer is
							const at =
								orientation === "isometric"
									? map.tileToPixelCoords(col + 0.5, row + 0.5)
									: map.tileToPixelCoords(col, row);
							if (orientation !== "isometric") {
								at.x += map.tilewidth / 2;
								at.y += map.tileheight / 2;
							}
							const tile = layer.getTile(at.x + movedX, at.y + movedY);
							const gid = scene.layers[0].data[row * cols + col];
							if (gid === 0) {
								expect(tile, `empty cell (${col}, ${row})`).toBeNull();
							} else {
								expect(
									[tile?.col, tile?.row],
									`cell (${col}, ${row}), layer moved by (${movedX}, ${movedY})`,
								).toEqual([col, row]);
								expect(tile.tileId).toBe(gid);
								found++;
							}
						}
					}
				}
				expect(found).toBeGreaterThan(40);
				// and far from the layer, nothing
				expect(layer.getTile(-5000, -5000)).toBeNull();
			});
		}
	});

	describe("moved in the game, by its pos", () => {
		for (const make of [orthogonal, isometric]) {
			it(`${make.name}: drawn, and found by getTile, where it was moved to`, async () => {
				const scene = make({ tall: 64 });
				const layers = show(app, makeMap(scene), "perTile");
				const layer = layers[0];
				const before = layer.getTile(150, 100);
				expect(before).not.toBeNull();
				for (const [dx, dy] of [
					[50, -30],
					[-170, 90],
					[0, 0],
				]) {
					layer.pos.x = dx;
					layer.pos.y = dy;
					scene.layers[0].offsetx = dx;
					scene.layers[0].offsety = dy;
					for (const [x, y] of VIEWS) {
						app.viewport.moveTo(x, y);
						const { frame } = await drawIn(app, layers, "perTile");
						const d = diff(reference(scene, x, y, WIDTH, HEIGHT), frame);
						expect(
							d.different,
							`moved by (${dx}, ${dy}), view (${x}, ${y}): ${d.first}`,
						).toBe(0);
					}
					// the same cell, where it is now
					const now = layer.getTile(150 + dx, 100 + dy);
					expect([now.col, now.row]).toEqual([before.col, before.row]);
				}
			});
		}
	});

	describe("in view as far as its tiles reach", () => {
		it("isometric: tall tiles, above the map's top corner", async () => {
			const scene = isometric({ tall: 128 });
			scene.layers[0].data = fill(8, 6, (c, r) => {
				return 1 + ((c + r * 2) % 8);
			});
			// the grid starts at y = 0: these views end above it
			const views = [
				[40, -HEIGHT - 10],
				[100, -HEIGHT - 60],
			];
			expect(await asTiled(scene, views)).toBeGreaterThan(0);
		});

		it("orthogonal: tall tiles above the first row, wide ones right of the last column", async () => {
			const tall = orthogonal({ tall: 128 });
			expect(
				await asTiled(tall, [
					[0, -HEIGHT - 10],
					[-200, -HEIGHT - 80],
				]),
			).toBeGreaterThan(0);
			const wide = orthogonal();
			wide.tilesets = [makeTileset({ tw: 96, th: 32 })];
			expect(
				await asTiled(wide, [
					[325, 0],
					[380, -100],
				]),
			).toBeGreaterThan(0);
		});

		it("tiles moved off the grid by their tileset's tileoffset", async () => {
			const scene = orthogonal();
			scene.tilesets = [
				makeTileset({ tw: 32, th: 32, extra: { tileoffset: { x: 0, y: 90 } } }),
			];
			// the grid ends at y = 256
			expect(
				await asTiled(scene, [
					[0, 260],
					[-40, 300],
				]),
			).toBeGreaterThan(0);
		});

		it("its bounds stay the grid's: the reach is for what is in view alone", () => {
			const [layer] = show(app, makeMap(orthogonal({ tall: 128 })));
			expect([layer.width, layer.height]).toEqual([320, 256]);
			const bounds = layer.getBounds();
			expect([bounds.left, bounds.top, bounds.right, bounds.bottom]).toEqual([
				0, 0, 320, 256,
			]);
			// 128 pixel tiles on a 32 pixel grid stand 96 above their cell
			const reach = layer.getDrawBounds();
			expect([reach.left, reach.top, reach.right, reach.bottom]).toEqual([
				0, -96, 320, 256,
			]);
			// and getTile has nothing above the grid: no cell is there
			expect(layer.getTile(10, -50)).toBeNull();
			// moved, both move with it
			layer.pos.x = 40;
			layer.pos.y = -10;
			expect([layer.getBounds().left, layer.getBounds().top]).toEqual([
				40, -10,
			]);
			expect([layer.getDrawBounds().left, layer.getDrawBounds().top]).toEqual([
				40, -106,
			]);
			// tiles the size of the grid: the grid, no more
			const plain = show(app, makeMap(orthogonal()))[0].getDrawBounds();
			expect([plain.left, plain.top, plain.right, plain.bottom]).toEqual([
				0, 0, 320, 256,
			]);
		});

		it("and far from all of it, the layer is not drawn at all", async () => {
			const scene = orthogonal({ tall: 128 });
			const layers = show(app, makeMap(scene), "perTile");
			app.viewport.moveTo(0, -HEIGHT - 200);
			const far = await drawIn(app, layers, "perTile");
			expect(far.cpuDraws).toBe(0);
			expect(drawn(far.frame)).toBe(0);
		});
	});
});
