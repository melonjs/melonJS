/**
 * Staggered and hexagonal tile layers, held to the picture Tiled draws: the
 * scenes, and for a GPU backend the same comparison as the isometric ones
 * (`tile-layer-isometric-scenarios.js`): the CPU renderer, the GPU one and
 * a reference painted with no engine, pixel by pixel.
 *
 * Both orientations are one geometry: lines of cells, every other one
 * shifted by half a cell, along the map's rows (`staggeraxis` "y") or its
 * columns ("x"); a hexagonal map's cells are longer by `hexsidelength`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	comparePaths,
	diff,
	drawIn,
	drawn,
	FLIP_AD,
	FLIP_H,
	FLIP_V,
	fill,
	inBlock,
	makeApp,
	makeMap,
	makeTileset,
	reference,
	show,
} from "./tile-layer-compare.js";

export const WIDTH = 320;
export const HEIGHT = 240;

const COLS = 9;
const ROWS = 11;

/** most cells filled, a few holes */
const scattered = (cols = COLS, rows = ROWS, firstgid = 1) => {
	return fill(cols, rows, (c, r) => {
		return (c * 3 + r) % 7 === 0 ? 0 : firstgid + ((c + r * 2) % 8);
	});
};

/** the grids: a staggered map's diamonds, and hexagons either way up */
const GRIDS = [
	{ orientation: "staggered", tw: 64, th: 32 },
	{ orientation: "hexagonal", tw: 28, th: 24, hexsidelength: 12 },
];

/**
 * A staggered or hexagonal scene.
 * @param {object} grid - one of `GRIDS`
 * @param {string} staggeraxis - "x" or "y"
 * @param {string} staggerindex - "odd" or "even"
 * @param {object} tileset - from `makeTileset`
 * @param {object} [more] - what else the scene has (its layers, by default
 * one of `scattered` cells)
 * @returns {object} the scene, for `makeMap` and `reference`
 */
export const staggeredScene = (
	grid,
	staggeraxis,
	staggerindex,
	tileset,
	more = {},
) => {
	const { orientation, tw, th, hexsidelength } = grid;
	return {
		orientation,
		cols: COLS,
		rows: ROWS,
		tw,
		th,
		tilesets: [tileset],
		layers: [{ data: scattered() }],
		...more,
		extra: { staggeraxis, staggerindex, hexsidelength, ...more.extra },
	};
};

/** the kinds of tiles each grid is drawn with */
const TILES = [
	{
		label: "tiles the size of a cell, filling it: every overlap shows",
		make: ({ tw, th }) => {
			return makeTileset({ tw, th });
		},
	},
	{
		label: "tiles taller than a cell, standing on it",
		make: ({ tw, th }) => {
			return makeTileset({
				tw,
				th: th * 3,
				opaque: (x, y) => {
					return inBlock(x, y, tw, th * 3, tw, th);
				},
			});
		},
	},
	{
		label: "tiles wider and taller than a cell, moved by a tileoffset",
		make: ({ tw, th }) => {
			return makeTileset({
				tw: tw + 20,
				th: th * 2 + 6,
				opaque: (x, y) => {
					return (x + y) % 11 !== 0;
				},
				extra: { tileoffset: { x: -6, y: 10 } },
			});
		},
	},
];

/** every grid, either axis, either index, each kind of tiles */
export const STAGGERED_SCENES = [];
for (const grid of GRIDS) {
	for (const staggeraxis of ["y", "x"]) {
		for (const staggerindex of ["odd", "even"]) {
			for (const tiles of TILES) {
				STAGGERED_SCENES.push({
					label: `${grid.orientation}, axis ${staggeraxis}, ${staggerindex}: ${tiles.label}`,
					scene: () => {
						return staggeredScene(
							grid,
							staggeraxis,
							staggerindex,
							tiles.make(grid),
						);
					},
				});
			}
		}
	}
}

export const STAGGERED_VIEWS = [
	[0, 0],
	[70, 20],
	[-40, -80],
	[230, 110],
	[-150, 30],
	[100, -200],
	[33, 57],
];

/**
 * Declare the scenarios for one GPU backend.
 * @param {number} renderer - `video.WEBGL` or `video.WEBGPU`
 * @param {string} type - the `renderer.type` expected ("WebGL", "WebGPU")
 */
export function staggeredScenarios(renderer, type) {
	describe(`staggered and hexagonal tile layers on the GPU, against the CPU renderer and a reference (${type})`, () => {
		let app;
		beforeAll(async () => {
			app = await makeApp(renderer, type, WIDTH, HEIGHT);
		});
		afterAll(() => {
			app?.destroy();
			vi.restoreAllMocks();
		});

		const need = (ctx) => {
			if (app === null || app === undefined) {
				ctx.skip(`${type} not available in this environment`);
			}
		};
		const same = (scene, options = {}) => {
			return comparePaths(app, scene, { views: STAGGERED_VIEWS, ...options });
		};
		const modeOf = (scene) => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const layer = show(app, makeMap(scene))[0];
				return [layer.renderMode, warn.mock.calls.flat().join(" ")];
			} finally {
				warn.mockRestore();
			}
		};
		const [STAGGERED, HEXAGONAL] = GRIDS;
		const blocks = (grid, tall = 2, options = {}) => {
			return makeTileset({
				tw: grid.tw,
				th: grid.th * tall,
				opaque: (x, y) => {
					return inBlock(x, y, grid.tw, grid.th * tall, grid.tw, grid.th);
				},
				...options,
			});
		};

		describe("every grid, either way", () => {
			for (const { label, scene } of STAGGERED_SCENES) {
				it(label, async (ctx) => {
					need(ctx);
					expect(await same(scene())).toBeGreaterThan(0);
				});
			}
		});

		describe("what a tile and a layer can be", () => {
			it("tiles with soft edges, and see-through: each shows the tiles behind it", async (ctx) => {
				need(ctx);
				for (const grid of GRIDS) {
					const tileset = makeTileset({
						tw: grid.tw,
						th: grid.th * 2,
						alpha: (x, y, id) => {
							const edge = Math.min(x, y, grid.tw - 1 - x, grid.th * 2 - 1 - y);
							const a = id % 3 === 2 ? 110 : 255;
							return Math.round(a * Math.min(1, (edge + 1) / 4));
						},
					});
					for (const axis of ["y", "x"]) {
						expect(
							await same(staggeredScene(grid, axis, "odd", tileset), {
								tolerance: 3,
							}),
							`${grid.orientation}, axis ${axis}`,
						).toBeGreaterThan(0);
					}
				}
			});

			it("tiles of odd size: on the cell Tiled lays out, a pixel smaller", async (ctx) => {
				need(ctx);
				// 63 x 31 tiles of a staggered map stand on 62 x 30 cells;
				// a hexagon side of 11 on 28 x 25 leaves 7 a side, rows 18
				// apart
				for (const [grid, tw, th] of [
					[{ orientation: "staggered", tw: 63, th: 31 }, 63, 31],
					[{ orientation: "staggered", tw: 64, th: 33 }, 64, 66],
					[
						{ orientation: "hexagonal", tw: 28, th: 25, hexsidelength: 11 },
						28,
						25,
					],
					[
						{ orientation: "hexagonal", tw: 27, th: 24, hexsidelength: 12 },
						27,
						40,
					],
				]) {
					for (const axis of ["y", "x"]) {
						expect(
							await same(
								staggeredScene(grid, axis, "odd", makeTileset({ tw, th })),
							),
							`${grid.orientation} ${grid.tw} x ${grid.th}, axis ${axis}`,
						).toBeGreaterThan(0);
					}
				}
			});

			it("tiles flipped across and down, on hexagons", async (ctx) => {
				need(ctx);
				// (a hexagonal map's third flag is a turn of 60 degrees in
				// Tiled, which the engine does not draw: left out here)
				const flips = [0, FLIP_H, FLIP_V, FLIP_H + FLIP_V];
				for (const axis of ["y", "x"]) {
					const scene = staggeredScene(
						HEXAGONAL,
						axis,
						"even",
						makeTileset({
							tw: 28,
							th: 40,
							opaque: (x, y) => {
								return x + y > 12;
							},
						}),
						{
							layers: [
								{
									data: fill(COLS, ROWS, (c, r) => {
										return 1 + ((c + r) % 8) + flips[(c * 3 + r) % 4];
									}),
								},
							],
						},
					);
					expect(await same(scene), `axis ${axis}`).toBeGreaterThan(0);
				}
			});

			it("tiles flipped, every way", async (ctx) => {
				need(ctx);
				const flips = [
					0,
					FLIP_H,
					FLIP_V,
					FLIP_H + FLIP_V,
					FLIP_AD,
					FLIP_H + FLIP_AD,
					FLIP_V + FLIP_AD,
					FLIP_H + FLIP_V + FLIP_AD,
				];
				// square tiles: a diagonal flip turns the image a quarter
				const tileset = makeTileset({
					tw: 64,
					th: 64,
					opaque: (x, y) => {
						return x + y > 20;
					},
				});
				const scene = staggeredScene(STAGGERED, "y", "odd", tileset, {
					layers: [
						{
							data: fill(COLS, ROWS, (c, r) => {
								return 1 + ((c + r) % 8) + flips[(c * 3 + r) % 8];
							}),
						},
					],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("animated tiles, as time passes", async (ctx) => {
				need(ctx);
				const tileset = blocks(STAGGERED, 2, {
					extra: {
						tiles: [
							{
								id: 0,
								animation: [
									{ tileid: 0, duration: 100 },
									{ tileid: 5, duration: 100 },
								],
							},
						],
					},
				});
				const layers = show(
					app,
					makeMap(staggeredScene(STAGGERED, "x", "even", tileset)),
				);
				expect(layers[0].renderMode).toBe("shader");
				app.viewport.moveTo(0, 0);
				const frames = [];
				for (let step = 0; step < 4; step++) {
					const cpu = await drawIn(app, layers, "perTile", 60);
					const gpu = await drawIn(app, layers, "shader");
					expect(gpu.cpuDraws).toBe(0);
					const d = diff(cpu.frame, gpu.frame);
					expect(d.different, `step ${step}: ${d.first}`).toBe(0);
					frames.push(gpu.frame);
				}
				expect(diff(frames[0], frames[2]).different).toBeGreaterThan(0);
			});

			it("a layer offset in Tiled, and moved in the game", async (ctx) => {
				need(ctx);
				for (const grid of GRIDS) {
					const scene = staggeredScene(grid, "y", "even", blocks(grid), {
						layers: [{ data: scattered(), offsetx: 37, offsety: -21 }],
					});
					const layers = show(app, makeMap(scene));
					expect(await same(scene, { layers })).toBeGreaterThan(0);
					layers[0].pos.x += 50;
					layers[0].pos.y += 64;
					scene.layers[0].offsetx += 50;
					scene.layers[0].offsety += 64;
					expect(await same(scene, { layers })).toBeGreaterThan(0);
				}
			});

			it("two layers, each on a tileset of its own", async (ctx) => {
				need(ctx);
				const scene = staggeredScene(
					STAGGERED,
					"y",
					"odd",
					blocks(STAGGERED, 1),
					{
						tilesets: [blocks(STAGGERED, 1), blocks(STAGGERED, 3)],
						layers: [
							{ data: scattered() },
							{
								data: fill(COLS, ROWS, (c, r) => {
									return (c + r) % 3 === 0 ? 9 + ((c * 2 + r) % 8) : 0;
								}),
							},
						],
					},
				);
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("a layer of an infinite map, starting left of and above the origin", async (ctx) => {
				need(ctx);
				const chunk = (x, y) => {
					return {
						x,
						y,
						width: 4,
						height: 4,
						data: fill(4, 4, (c, r) => {
							return (c + r + x) % 5 === 0 ? 0 : 1 + ((c + r * 2) % 8);
						}),
					};
				};
				for (const grid of GRIDS) {
					for (const axis of ["y", "x"]) {
						const scene = staggeredScene(grid, axis, "odd", blocks(grid), {
							cols: 8,
							rows: 8,
							layers: [
								{
									startx: -4,
									starty: -4,
									width: 12,
									height: 8,
									data: undefined,
									chunks: [
										chunk(-4, -4),
										chunk(0, -4),
										chunk(4, 0),
										chunk(0, 0),
										// odd coordinates: the lines that are shifted
										// are the map's, not the chunk's
										chunk(-3, 5),
										chunk(5, -9),
									],
								},
							],
							extra: { infinite: true },
						});
						const layers = show(app, makeMap(scene));
						expect(layers[0].renderMode).toBe("shader");
						const views = [
							[0, 0],
							[-200, -150],
							[150, -60],
						];
						expect(
							await same(scene, { views, layers }),
							`${grid.orientation}, axis ${axis}`,
						).toBeGreaterThan(0);
					}
				}
			});

			it("tiles set and cleared while the game runs", async (ctx) => {
				need(ctx);
				for (const grid of GRIDS) {
					const scene = staggeredScene(grid, "x", "odd", blocks(grid, 3));
					const layers = show(app, makeMap(scene));
					const layer = layers[0];
					const options = { views: [[0, 0]], layers };
					for (let step = 0; step < 3; step++) {
						for (let row = 0; row < ROWS; row++) {
							for (let col = 0; col < COLS; col++) {
								const gid =
									(col + row + step) % 4 === 0
										? 0
										: 1 + ((col * step + row) % 8);
								scene.layers[0].data[row * COLS + col] = gid;
								if (gid === 0) {
									layer.clearTile(col, row);
								} else {
									layer.setTile(layer.getTileById(gid, col, row), col, row);
								}
							}
						}
						await same(scene, options);
					}
					expect(layer.renderMode).toBe("shader");
				}
			});

			it("views that hold only what reaches past the grid", async (ctx) => {
				need(ctx);
				for (const grid of GRIDS) {
					// tiles four cells tall stand three cells above the grid
					const scene = staggeredScene(grid, "y", "odd", blocks(grid, 4), {
						layers: [
							{
								data: fill(COLS, ROWS, (c, r) => {
									return 1 + ((c + r * 2) % 8);
								}),
							},
						],
					});
					const views = [
						[0, -HEIGHT - 5],
						[60, -HEIGHT - grid.th],
					];
					expect(
						await same(scene, { views }),
						grid.orientation,
					).toBeGreaterThan(0);
				}
			});
		});

		describe("layers the GPU path does not take", () => {
			it("tiles of two tilesets in one layer", (ctx) => {
				need(ctx);
				for (const grid of GRIDS) {
					const [mode, said] = modeOf(
						staggeredScene(grid, "y", "odd", blocks(grid), {
							tilesets: [blocks(grid), blocks(grid, 3)],
							layers: [
								{
									data: fill(COLS, ROWS, (c, r) => {
										return 1 + ((c + r) % 16);
									}),
								},
							],
						}),
					);
					expect(mode).toBe("perTile");
					expect(said).toMatch(
						new RegExp(
							`more than one tileset in an? ${grid.orientation} layer`,
						),
					);
				}
			});

			it("tiles past the size the shader walks", (ctx) => {
				need(ctx);
				const [mode, said] = modeOf(
					staggeredScene(STAGGERED, "y", "odd", blocks(STAGGERED, 9)),
				);
				expect(mode).toBe("perTile");
				expect(said).toMatch(/larger than the shader's limit/);
			});

			it("a tile of another tileset set while the game runs", (ctx) => {
				need(ctx);
				const scene = staggeredScene(HEXAGONAL, "y", "odd", blocks(HEXAGONAL), {
					tilesets: [blocks(HEXAGONAL), blocks(HEXAGONAL, 2)],
				});
				const layer = show(app, makeMap(scene))[0];
				expect(layer.renderMode).toBe("shader");
				const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
				try {
					layer.setTile(layer.getTileById(10, 2, 2), 2, 2);
					expect(layer.renderMode).toBe("perTile");
					expect(warn.mock.calls.flat().join(" ")).toMatch(
						/more than one tileset/,
					);
				} finally {
					warn.mockRestore();
				}
			});

			it("an oblique map, still", (ctx) => {
				need(ctx);
				const [mode, said] = modeOf({
					orientation: "oblique",
					cols: 4,
					rows: 4,
					tw: 32,
					th: 32,
					tilesets: [makeTileset({ tw: 32, th: 32 })],
					layers: [{ data: scattered(4, 4) }],
					extra: { skewx: 10, skewy: 0 },
				});
				expect(mode).toBe("perTile");
				expect(said).toMatch(/no gpu renderer supported yet for "oblique"/);
			});
		});

		it("and each is drawn the same baked into one image", async (ctx) => {
			need(ctx);
			for (const { label, scene: build } of STAGGERED_SCENES.filter((_, i) => {
				return i % 5 === 1;
			})) {
				const scene = build();
				const layers = show(app, makeMap(scene), "prerender");
				let total = 0;
				for (const [x, y] of STAGGERED_VIEWS.slice(0, 4)) {
					app.viewport.moveTo(x, y);
					const { frame } = await drawIn(app, layers, "prerender");
					const d = diff(reference(scene, x, y, WIDTH, HEIGHT), frame);
					expect(d.different, `${label}, view (${x}, ${y}): ${d.first}`).toBe(
						0,
					);
					total += drawn(frame);
				}
				expect(total, label).toBeGreaterThan(0);
			}
		});
	});
}
