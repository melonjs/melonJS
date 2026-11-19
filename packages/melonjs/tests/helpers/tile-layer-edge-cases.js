/**
 * Tile layers at their edges: the cases a set of adversarial probes broke,
 * each held to the picture painted with no engine (`tile-layer-compare.js`).
 * A layer the GPU path cannot draw right is left to the CPU renderer, with a
 * word in the console, and is still drawn as Tiled draws it.
 *
 * One spec file per GPU backend calls this.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Container } from "../../src/index.js";
import {
	comparePaths,
	diff,
	drawIn,
	drawn,
	fill,
	makeApp,
	makeMap,
	makeTileset,
	reference,
	show,
} from "./tile-layer-compare.js";

const W = 320;
const H = 240;

const all = (cols, rows) => {
	return fill(cols, rows, (c, r) => {
		return 1 + ((c + r * 3) % 8);
	});
};

/**
 * Declare the cases for one GPU backend.
 * @param {number} renderer - `video.WEBGL` or `video.WEBGPU`
 * @param {string} type - the `renderer.type` expected ("WebGL", "WebGPU")
 */
export function edgeCases(renderer, type) {
	describe(`tile layers at their edges (${type})`, () => {
		let app;
		beforeAll(async () => {
			app = await makeApp(renderer, type, W, H);
		});
		afterAll(() => {
			app?.world.pos.set(0, 0, 0);
			app?.destroy();
			vi.restoreAllMocks();
		});
		const need = (ctx) => {
			if (app === null || app === undefined) {
				ctx.skip(`${type} not available in this environment`);
			}
		};

		/**
		 * Put a scene in the world, and say how its first layer is drawn and
		 * what was warned.
		 */
		const shown = (scene) => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const layers = show(app, makeMap(scene));
				return {
					layers,
					mode: layers[0].renderMode,
					said: warn.mock.calls.flat().join(" "),
				};
			} finally {
				warn.mockRestore();
			}
		};

		/**
		 * A layer left to the CPU renderer for `reason`: drawn as the
		 * reference, as it stands and when asked for the GPU path by hand.
		 */
		const fallsBack = async (scene, reason, views = [[-40, -60]]) => {
			const { layers, mode, said } = shown(scene);
			expect(mode).toBe("perTile");
			expect(said).toMatch(reason);
			for (const [x, y] of views) {
				app.viewport.moveTo(x, y);
				const ref = reference(scene, x, y, W, H);
				expect(drawn(ref)).toBeGreaterThan(0);
				const cpu = await drawIn(app, layers, "perTile");
				const c = diff(ref, cpu.frame);
				expect(c.different, `tile by tile: ${c.first}`).toBe(0);
				// by hand: still tile by tile, and the same picture
				const forced = await drawIn(app, layers, "shader");
				expect(forced.cpuDraws).toBe(layers.length);
				const f = diff(ref, forced.frame);
				expect(f.different, `asked for by hand: ${f.first}`).toBe(0);
			}
		};

		describe("what is in view", () => {
			it("isometric, tile by tile: a tile narrower than half a cell, at the right edge of the view", async (ctx) => {
				need(ctx);
				// the view's corners are rounded to whole cells, half a cell
				// either way: a tile 8 pixels wide does not make up for it
				const scene = {
					orientation: "isometric",
					cols: 1,
					rows: 1,
					tw: 64,
					th: 32,
					tilesets: [makeTileset({ tw: 8, th: 8 })],
					layers: [{ data: [1] }],
				};
				const layers = show(app, makeMap(scene));
				// the one tile is drawn at x 0 to 7: these views end 1 to 8
				// pixels right of its left edge
				for (let right = 1; right <= 8; right++) {
					const x = right - W;
					app.viewport.moveTo(x, -120);
					const ref = reference(scene, x, -120, W, H);
					expect(drawn(ref), "the tile is in view").toBe(right * 8);
					for (const mode of ["shader", "perTile"]) {
						const { frame } = await drawIn(app, layers, mode);
						const d = diff(ref, frame);
						expect(d.different, `${mode}, ${right} px in view`).toBe(0);
					}
				}
			});

			for (const [orientation, tw, th, extra] of [
				["orthogonal", 32, 32, {}],
				["isometric", 64, 32, {}],
				["staggered", 64, 32, { staggeraxis: "y", staggerindex: "odd" }],
				[
					"hexagonal",
					28,
					24,
					{ staggeraxis: "x", staggerindex: "even", hexsidelength: 12 },
				],
			]) {
				it(`${orientation}: a sliver of the map, a pixel or a few, at each edge of the view`, async (ctx) => {
					need(ctx);
					// tiles larger than a cell, moved by a tileoffset where
					// the GPU takes one: how far the map reaches is measured
					// on the reference itself
					const scene = {
						orientation,
						cols: 5,
						rows: 5,
						tw,
						th,
						tilesets: [
							makeTileset({
								tw: tw + 10,
								th: th * 2,
								// (an orthogonal tileset with an offset is left
								// to the CPU renderer)
								extra:
									orientation === "orthogonal"
										? {}
										: { tileoffset: { x: -7, y: 5 } },
							}),
						],
						layers: [{ data: all(5, 5) }],
						extra,
					};
					const wide = reference(scene, -400, -400, 1200, 1000);
					let left = Infinity;
					let top = Infinity;
					let right = -Infinity;
					let bottom = -Infinity;
					for (let y = 0; y < wide.height; y++) {
						for (let x = 0; x < wide.width; x++) {
							const i = (y * wide.width + x) * 4;
							if (
								wide.data[i] !== 16 ||
								wide.data[i + 1] !== 24 ||
								wide.data[i + 2] !== 48
							) {
								left = Math.min(left, x - 400);
								right = Math.max(right, x - 400 + 1);
								top = Math.min(top, y - 400);
								bottom = Math.max(bottom, y - 400 + 1);
							}
						}
					}
					expect(right - left).toBeGreaterThan(100);
					const middleX = Math.round((left + right - W) / 2);
					const middleY = Math.round((top + bottom - H) / 2);
					const views = [];
					for (const k of [1, 2, 5]) {
						// the map's left edge at the view's right, and so on
						views.push([left + k - W, middleY]);
						views.push([right - k, middleY]);
						views.push([middleX, top + k - H]);
						views.push([middleX, bottom - k]);
					}
					const layers = show(app, makeMap(scene));
					expect(layers[0].renderMode).toBe("shader");
					for (const view of views) {
						expect(
							await comparePaths(app, scene, { views: [view], layers }),
							`view (${view})`,
						).toBeGreaterThan(0);
					}
					// and a pixel out of sight: nothing, either way
					const out = [
						[left - W, middleY],
						[right, middleY],
						[middleX, top - H],
						[middleX, bottom],
					];
					expect(await comparePaths(app, scene, { views: out, layers })).toBe(
						0,
					);
				});
			}

			it("a layer in a container with a size: the tops of tall tiles, the grid out of view", async (ctx) => {
				need(ctx);
				// a level loaded into a container gives it the map's size:
				// the camera has the container in view by its bounds before
				// it asks the layer, whose tiles stand 64 pixels above
				const scene = {
					orientation: "orthogonal",
					cols: 4,
					rows: 3,
					tw: 32,
					th: 32,
					tilesets: [makeTileset({ tw: 32, th: 96 })],
					layers: [{ data: all(4, 3) }],
				};
				// the view ends 10 pixels above the grid's first row
				const view = [-40, -H - 10];
				const ref = reference(scene, ...view, W, H);
				expect(drawn(ref)).toBeGreaterThan(0);
				for (const boxed of [false, true]) {
					app.world.reset();
					app.world.pos.set(0, 0, app.world.pos.z);
					app.renderer.reset?.();
					app.renderer.backgroundColor.setColor(16, 24, 48);
					const map = makeMap(scene);
					const box = boxed ? new Container() : app.world;
					if (boxed) {
						app.world.addChild(box);
					}
					map.addTo(box, true, false);
					app.world.sortNow(true);
					app.viewport.setBounds(-100000, -100000, 200000, 200000);
					app.viewport.moveTo(...view);
					for (const mode of ["perTile", "shader"]) {
						const { frame } = await drawIn(app, map.getLayers(), mode);
						const d = diff(ref, frame);
						expect(
							d.different,
							`${boxed ? "in a container" : "in the world"}, ${mode}: ${d.first}`,
						).toBe(0);
					}
				}
			});

			/** a scene put in a container of its own, as a level loaded into one */
			const boxed = (scene) => {
				app.world.reset();
				app.world.pos.set(0, 0, app.world.pos.z);
				app.renderer.reset?.();
				app.renderer.backgroundColor.setColor(16, 24, 48);
				const map = makeMap(scene);
				const box = new Container();
				app.world.addChild(box);
				map.addTo(box, true, false);
				app.world.sortNow(true);
				app.viewport.setBounds(-100000, -100000, 200000, 200000);
				return map.getLayers();
			};

			it("a layer offset in Tiled, in a container with a size: drawn where it is, the map's rectangle out of view", async (ctx) => {
				need(ctx);
				// the container has the map's size: 160 wide, and the layer
				// is 200 to its right
				const scene = {
					orientation: "orthogonal",
					cols: 5,
					rows: 4,
					tw: 32,
					th: 32,
					tilesets: [makeTileset({ tw: 32, th: 32 })],
					layers: [{ data: all(5, 4), offsetx: 200, offsety: 0 }],
				};
				const view = [170, -40];
				const ref = reference(scene, ...view, W, H);
				expect(drawn(ref)).toBeGreaterThan(0);
				const layers = boxed(scene);
				app.viewport.moveTo(...view);
				for (const mode of ["perTile", "shader"]) {
					const { frame } = await drawIn(app, layers, mode);
					const d = diff(ref, frame);
					expect(d.different, `${mode}: ${d.first}`).toBe(0);
				}
			});

			it("an infinite map in a container: the tiles left of and above its origin", async (ctx) => {
				need(ctx);
				const chunk = (x, y) => {
					return { x, y, width: 4, height: 4, data: all(4, 4) };
				};
				const scene = {
					orientation: "orthogonal",
					cols: 4,
					rows: 4,
					tw: 32,
					th: 32,
					tilesets: [makeTileset({ tw: 32, th: 32 })],
					layers: [
						{
							startx: -4,
							starty: -8,
							width: 8,
							height: 12,
							data: undefined,
							chunks: [chunk(-3, -5), chunk(0, 0)],
						},
					],
					extra: { infinite: true },
				};
				// left of and above the map's own rectangle
				const view = [-W - 4, -H - 4];
				const ref = reference(scene, ...view, W, H);
				expect(drawn(ref)).toBeGreaterThan(0);
				const layers = boxed(scene);
				app.viewport.moveTo(...view);
				for (const mode of ["perTile", "shader"]) {
					const { frame } = await drawIn(app, layers, mode);
					const d = diff(ref, frame);
					expect(d.different, `${mode}: ${d.first}`).toBe(0);
				}
			});

			for (const mode of ["perTile", "shader", "prerender"]) {
				it(`a zoomed camera with an offset, over a moved world, drawn "${mode}"`, async (ctx) => {
					need(ctx);
					// the camera at `pos + offset` with no offset shows the
					// same thing, by definition: zoomed, it is not the
					// default camera, and draws the world unmoved
					const scene = {
						orientation: "orthogonal",
						cols: 12,
						rows: 12,
						tw: 32,
						th: 32,
						tilesets: [makeTileset({ tw: 32, th: 32 })],
						layers: [{ data: all(12, 12) }],
					};
					app.world.reset();
					app.renderer.reset?.();
					app.renderer.backgroundColor.setColor(16, 24, 48);
					// the world moved first, as a centred map leaves it
					app.world.pos.set(100, 60, app.world.pos.z);
					const map = makeMap(scene);
					const layers = map.getLayers();
					if (mode === "prerender") {
						layers[0].renderMode = mode;
					}
					map.addTo(app.world, true, false);
					app.world.sortNow(true);
					app.viewport.setBounds(-100000, -100000, 200000, 200000);
					try {
						for (const zoom of [1, 2]) {
							app.viewport.zoom = zoom;
							app.viewport.offset.set(0, 0);
							app.viewport.moveTo(60 + 26, 40 - 18);
							const moved = await drawIn(app, layers, mode);
							expect(drawn(moved.frame)).toBeGreaterThan(0);
							app.viewport.offset.set(26, -18);
							app.viewport.moveTo(60, 40);
							const shaken = await drawIn(app, layers, mode);
							const d = diff(moved.frame, shaken.frame);
							expect(d.different, `zoom ${zoom}: ${d.first}`).toBe(0);
						}
					} finally {
						app.viewport.zoom = 1;
						app.viewport.offset.set(0, 0);
						app.world.pos.set(0, 0, app.world.pos.z);
					}
				});
			}
		});

		describe("grids of odd sizes, laid out as Tiled lays them out", () => {
			it("a staggered map of odd tile size: on cells a pixel smaller, every way it is drawn", async (ctx) => {
				need(ctx);
				// 63 x 31 tiles stand on 62 x 30 cells: one pixel above and
				// one to the right of each
				const scene = {
					orientation: "staggered",
					cols: 4,
					rows: 4,
					tw: 63,
					th: 31,
					tilesets: [makeTileset({ tw: 63, th: 31 })],
					layers: [{ data: all(4, 4) }],
					extra: { staggeraxis: "y", staggerindex: "odd" },
				};
				const views = [
					[-20, -20],
					[40, 10],
				];
				expect(await comparePaths(app, scene, { views })).toBeGreaterThan(0);
				const baked = show(app, makeMap(scene), "prerender");
				for (const [x, y] of views) {
					app.viewport.moveTo(x, y);
					const { frame } = await drawIn(app, baked, "prerender");
					const d = diff(reference(scene, x, y, W, H), frame);
					expect(d.different, `baked: ${d.first}`).toBe(0);
				}
			});

			for (const [axis, tw, th, side] of [
				["x", 28, 24, 11],
				// on this axis the cell is a pixel shorter than the tile
				["y", 28, 24, 11],
				// an odd height: 7 a side, rows 18 apart
				["y", 28, 25, 11],
				["x", 30, 24, 7],
				// longer than the tile: the half left of a cell is negative
				["x", 28, 24, 33],
			]) {
				it(`a hexagon side of ${side} on ${tw} x ${th} cells, axis ${axis}: columns and rows on whole pixels`, async (ctx) => {
					need(ctx);
					// Tiled halves what a side leaves of a cell in whole
					// numbers: 28 wide with a side of 11 is columns 19
					// pixels apart, not 19.5
					const scene = {
						orientation: "hexagonal",
						cols: 6,
						rows: 5,
						tw,
						th,
						tilesets: [makeTileset({ tw, th })],
						layers: [{ data: all(6, 5) }],
						extra: {
							staggeraxis: axis,
							staggerindex: "odd",
							hexsidelength: side,
						},
					};
					const views = [
						[-20, -20],
						[35, 12],
					];
					expect(await comparePaths(app, scene, { views })).toBeGreaterThan(0);
					// and baked: the canvas holds every tile, to its last pixel
					const baked = show(app, makeMap(scene), "prerender");
					for (const [x, y] of views) {
						app.viewport.moveTo(x, y);
						const { frame } = await drawIn(app, baked, "prerender");
						const d = diff(reference(scene, x, y, W, H), frame);
						expect(d.different, `baked: ${d.first}`).toBe(0);
					}
				});
			}
		});

		describe("orthogonal layers whose tiles overlap", () => {
			const big = (options = {}) => {
				return makeTileset({ tw: 48, th: 48, ...options });
			};

			it("tiles of two tilesets, larger than the grid, in one layer", async (ctx) => {
				need(ctx);
				// a later cell lies over an earlier one, whichever tileset
				// its tile is from: a pass per tileset cannot keep that
				const scene = {
					orientation: "orthogonal",
					cols: 4,
					rows: 3,
					tw: 32,
					th: 32,
					tilesets: [big(), big()],
					layers: [
						{
							// a checkerboard of the two tilesets
							data: fill(4, 3, (c, r) => {
								return 1 + ((c + r) % 2) * 8 + ((c + r * 3) % 8);
							}),
						},
					],
				};
				await fallsBack(scene, /more than one tileset/);
			});

			it("tiles of two tilesets, the size of the grid: nothing overlaps, and the GPU draws them", async (ctx) => {
				need(ctx);
				const scene = {
					orientation: "orthogonal",
					cols: 6,
					rows: 5,
					tw: 32,
					th: 32,
					tilesets: [
						makeTileset({ tw: 32, th: 32 }),
						makeTileset({ tw: 32, th: 32 }),
					],
					layers: [
						{
							data: fill(6, 5, (c, r) => {
								return 1 + ((c + r) % 2) * 8 + ((c + r * 3) % 8);
							}),
						},
					],
				};
				expect(await comparePaths(app, scene)).toBeGreaterThan(0);
			});

			it("a large tileset in the map that the layer does not use", async (ctx) => {
				need(ctx);
				// the layer's own tiles are the size of the grid
				const scene = {
					orientation: "orthogonal",
					cols: 6,
					rows: 5,
					tw: 32,
					th: 32,
					tilesets: [
						makeTileset({ tw: 32, th: 32 }),
						makeTileset({ tw: 32, th: 32 }),
						big(),
					],
					layers: [
						{
							data: fill(6, 5, (c, r) => {
								return 1 + ((c + r) % 2) * 8 + ((c + r * 3) % 8);
							}),
						},
					],
				};
				const { layers, mode } = shown(scene);
				expect(mode).toBe("shader");
				expect(await comparePaths(app, scene, { layers })).toBeGreaterThan(0);
				// until a tile of the large one is set: three tilesets in
				// use, one of them overlapping
				const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
				try {
					scene.layers[0].data[2 * 6 + 2] = 19;
					layers[0].setTile(layers[0].getTileById(19, 2, 2), 2, 2);
					expect(layers[0].renderMode).toBe("perTile");
					expect(warn.mock.calls.flat().join(" ")).toMatch(
						/more than one tileset/,
					);
				} finally {
					warn.mockRestore();
				}
				app.viewport.moveTo(0, 0);
				const { frame } = await drawIn(app, layers, "perTile");
				const d = diff(reference(scene, 0, 0, W, H), frame);
				expect(d.different, d.first).toBe(0);
			});

			for (const order of ["right-up", "left-down", "left-up"]) {
				it(`render order "${order}", tiles larger than the grid`, async (ctx) => {
					need(ctx);
					// the map walks its rows and columns the way it says:
					// with "left-up" the first cell's tile is in front
					const scene = {
						orientation: "orthogonal",
						cols: 4,
						rows: 3,
						tw: 32,
						th: 32,
						tilesets: [big()],
						layers: [{ data: all(4, 3) }],
						extra: { renderorder: order },
					};
					await fallsBack(scene, /render order/);
				});

				it(`render order "${order}", tiles the size of the grid: on the GPU`, async (ctx) => {
					need(ctx);
					const scene = {
						orientation: "orthogonal",
						cols: 6,
						rows: 5,
						tw: 32,
						th: 32,
						tilesets: [makeTileset({ tw: 32, th: 32 })],
						layers: [{ data: all(6, 5) }],
						extra: { renderorder: order },
					};
					expect(await comparePaths(app, scene)).toBeGreaterThan(0);
				});
			}
		});

		describe("layers past what the GPU holds, and tiles the image does not", () => {
			for (const orientation of ["orthogonal", "isometric"]) {
				it(`${orientation}: a layer with more columns than the largest texture has pixels`, async (ctx) => {
					need(ctx);
					// the GPU path keeps a texel per cell
					const cols = app.renderer.maxTextureSize + 1;
					expect(Number.isFinite(cols)).toBe(true);
					const iso = orientation === "isometric";
					const scene = {
						orientation,
						cols,
						rows: 1,
						tw: iso ? 64 : 32,
						th: 32,
						tilesets: [makeTileset({ tw: iso ? 64 : 32, th: 32 })],
						layers: [
							{
								data: fill(cols, 1, (c) => {
									return 1 + (c % 8);
								}),
							},
						],
					};
					await fallsBack(scene, /largest texture/, [[0, iso ? -100 : 0]]);
				});
			}

			it("a tile the tileset's image does not hold is not drawn, either way", async (ctx) => {
				need(ctx);
				// an image cropped since the map was saved: 4 tiles of the 8
				// the tileset says it has
				const scene = {
					orientation: "orthogonal",
					cols: 6,
					rows: 5,
					tw: 32,
					th: 32,
					tilesets: [
						makeTileset({ tw: 32, th: 32, count: 4, extra: { tilecount: 8 } }),
					],
					layers: [{ data: all(6, 5) }],
				};
				const { layers } = shown(scene);
				app.viewport.moveTo(0, 0);
				const cpu = await drawIn(app, layers, "perTile");
				const gpu = await drawIn(app, layers, "shader");
				// the tiles the image holds, and none of the others
				const held = {
					...scene,
					layers: [
						{
							data: scene.layers[0].data.map((gid) => {
								return gid <= 4 ? gid : 0;
							}),
						},
					],
				};
				const ref = reference(held, 0, 0, W, H);
				expect(drawn(ref)).toBeGreaterThan(0);
				expect(diff(ref, cpu.frame).different, "tile by tile").toBe(0);
				expect(diff(ref, gpu.frame).different, "on the GPU").toBe(0);
			});

			it("a tile the image does not hold, set on a baked layer: left undrawn", async (ctx) => {
				need(ctx);
				const scene = {
					orientation: "orthogonal",
					cols: 6,
					rows: 5,
					tw: 32,
					th: 32,
					tilesets: [
						makeTileset({ tw: 32, th: 32, count: 4, extra: { tilecount: 8 } }),
					],
					layers: [
						{
							data: fill(6, 5, (c, r) => {
								return 1 + ((c + r) % 4);
							}),
						},
					],
				};
				const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
				try {
					const layers = show(app, makeMap(scene), "prerender");
					const layer = layers[0];
					// one the image holds, and one it does not
					scene.layers[0].data[1 * 6 + 1] = 3;
					layer.setTile(layer.getTileById(3, 1, 1), 1, 1);
					scene.layers[0].data[2 * 6 + 2] = 0;
					expect(() => {
						layer.setTile(layer.getTileById(7, 2, 2), 2, 2);
					}).not.toThrow();
					app.viewport.moveTo(0, 0);
					const { frame } = await drawIn(app, layers, "prerender");
					const d = diff(reference(scene, 0, 0, W, H), frame);
					expect(d.different, d.first).toBe(0);
				} finally {
					warn.mockRestore();
				}
			});

			it("a layer taken out of the world and put back is drawn again", async (ctx) => {
				need(ctx);
				const scene = {
					orientation: "orthogonal",
					cols: 6,
					rows: 5,
					tw: 32,
					th: 32,
					tilesets: [makeTileset({ tw: 32, th: 32 })],
					layers: [{ data: all(6, 5) }],
				};
				const layers = show(app, makeMap(scene));
				const layer = layers[0];
				app.world.removeChildNow(layer, true);
				expect(() => {
					app.world.addChild(layer);
				}).not.toThrow();
				app.world.sortNow(true);
				expect(layer.renderMode).toBe("shader");
				expect(await comparePaths(app, scene, { layers })).toBeGreaterThan(0);
			});
		});
	});
}
