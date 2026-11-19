/**
 * Tile layers on the GPU ("shader" render mode), isometric ones above all
 * (#1897), held to the picture Tiled draws.
 *
 * Every scenario draws the same layers through the CPU renderer ("perTile")
 * and through the GPU one, with the whole engine in between, and compares
 * both frames pixel by pixel with a reference painted here with no engine
 * at all (see `tile-layer-compare.js`). Where the reference does not reach
 * (a faded or tinted layer, a zoomed camera, animated tiles), the two paths
 * are compared with each other.
 *
 * The scenarios are the same on every GPU backend, so each one's spec file
 * calls this with its renderer: an application with a GPU device takes the
 * place of the one before it, and a spec file has its own page.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { grabFrame } from "./pixels.js";
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

const TW = 64;
const TH = 32;

/** a tileset of isometric blocks, `tw` × `th`, on the 64 × 32 grid */
const blocks = (tw = TW, th = TH, options = {}) => {
	return makeTileset({
		tw,
		th,
		opaque: (x, y) => {
			return inBlock(x, y, tw, th, Math.min(tw, TW), TH);
		},
		...options,
	});
};

/**
 * a tileset of blocks with soft edges, as drawn art has: a pixel is as
 * opaque as the share of its 3 × 3 neighbours that are in the block. Every
 * fourth tile is see-through all over, as glass or water is
 */
const softBlocks = (tw, th, options = {}) => {
	const dw = Math.min(tw, TW);
	return makeTileset({
		tw,
		th,
		alpha: (x, y, id) => {
			let inside = 0;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					inside += inBlock(x + dx, y + dy, tw, th, dw, TH) ? 1 : 0;
				}
			}
			return Math.round((inside / 9) * (id % 4 === 3 ? 120 : 255));
		},
		...options,
	});
};

/** a map with most cells filled, from one tileset, and a few holes */
const scattered = (cols, rows, count = 8, firstgid = 1) => {
	return fill(cols, rows, (c, r) => {
		return (c * 3 + r) % 7 === 0 ? 0 : firstgid + ((c + r * 2) % count);
	});
};

/** an isometric scene, on the 64 × 32 grid */
const iso = (options) => {
	return { orientation: "isometric", tw: TW, th: TH, ...options };
};

const WIDTH = 320;
const HEIGHT = 240;

/** views over a map: inside, over each edge, and scrolled part way */
const VIEWS = [
	[0, 0],
	[70, 20],
	[-40, -80],
	[230, 110],
	[-150, 30],
	[100, -200],
];

/** the frames' background, as `makeApp` sets it */
const BACKGROUND = [16, 24, 48];

/**
 * What a picture becomes when its layer is faded or tinted as a whole: each
 * drawn pixel multiplied by the tint, then blended with the background.
 * @param {ImageData} picture - the reference picture
 * @param {number} opacity - the layer's opacity
 * @param {number[]} [tint] - the layer's tint, 0 to 255 a channel
 * @returns {ImageData} the picture expected
 */
const layered = (picture, opacity, tint = [255, 255, 255]) => {
	const out = new ImageData(picture.width, picture.height);
	for (let i = 0; i < picture.data.length; i += 4) {
		const isBackground =
			picture.data[i] === BACKGROUND[0] &&
			picture.data[i + 1] === BACKGROUND[1] &&
			picture.data[i + 2] === BACKGROUND[2];
		for (let c = 0; c < 3; c++) {
			out.data[i + c] = isBackground
				? BACKGROUND[c]
				: Math.round(
						((picture.data[i + c] * tint[c]) / 255) * opacity +
							BACKGROUND[c] * (1 - opacity),
					);
		}
		out.data[i + 3] = 255;
	}
	return out;
};

const ALL_FLIPS = [
	0,
	FLIP_H,
	FLIP_V,
	FLIP_H + FLIP_V,
	FLIP_AD,
	FLIP_H + FLIP_AD,
	FLIP_V + FLIP_AD,
	FLIP_H + FLIP_V + FLIP_AD,
];

/**
 * Declare the scenarios for one GPU backend.
 * @param {number} renderer - `video.WEBGL` or `video.WEBGPU`
 * @param {string} type - the `renderer.type` expected ("WebGL", "WebGPU")
 */
export function isometricScenarios(renderer, type) {
	describe(`tile layers on the GPU, against the CPU renderer and a reference (${type})`, () => {
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

		const same = (scene, options) => {
			return comparePaths(app, scene, options);
		};

		/** how a layer of the scene ends up drawn, and what was warned */
		const modeOf = (scene) => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const layer = show(app, makeMap(scene))[0];
				return [layer.renderMode, warn.mock.calls.flat().join(" ")];
			} finally {
				warn.mockRestore();
			}
		};

		describe("isometric: tiles of every size", () => {
			for (const [label, tw, th] of [
				["as tall as the grid (flat diamonds)", 64, 32],
				["twice as tall", 64, 64],
				["four times as tall, as the Isometric Dungeon's", 64, 128],
				["eight times as tall, the limit", 64, 256],
				["a height that is no multiple of the grid", 64, 50],
				["shorter than the grid", 64, 20],
				["narrower than the grid", 40, 64],
				["twice as wide", 128, 32],
				["four times as wide, the limit", 256, 64],
				["wider and taller, no multiple of the grid", 90, 70],
			]) {
				it(label, async (ctx) => {
					need(ctx);
					const scene = iso({
						cols: 8,
						rows: 6,
						tilesets: [blocks(tw, th)],
						layers: [{ data: scattered(8, 6) }],
					});
					expect(await same(scene)).toBeGreaterThan(0);
				});
			}

			for (const [tw, th] of [
				[64, 96],
				[128, 128],
				[100, 30],
			]) {
				it(`${tw} × ${th} tiles that fill their whole image, so every overlap shows`, async (ctx) => {
					need(ctx);
					// no transparent pixel: which tile is in front decides
					// every pixel where two images overlap
					const scene = iso({
						cols: 7,
						rows: 9,
						tilesets: [makeTileset({ tw, th })],
						layers: [{ data: scattered(7, 9) }],
					});
					expect(await same(scene)).toBeGreaterThan(0);
				});
			}

			it("on a grid of another size, and an odd one", async (ctx) => {
				need(ctx);
				for (const [tw, th] of [
					[32, 16],
					[100, 50],
					[30, 14],
					[48, 48],
				]) {
					const scene = {
						orientation: "isometric",
						cols: 9,
						rows: 7,
						tw,
						th,
						tilesets: [
							makeTileset({
								tw,
								th: th * 2,
								opaque: (x, y) => {
									return inBlock(x, y, tw, th * 2, tw, th);
								},
							}),
						],
						layers: [{ data: scattered(9, 7) }],
					};
					expect(await same(scene), `${tw} × ${th}`).toBeGreaterThan(0);
				}
			});
		});

		describe("isometric: maps of every shape", () => {
			for (const [cols, rows] of [
				[1, 1],
				[1, 7],
				[7, 1],
				[3, 11],
				[12, 4],
				[20, 20],
			]) {
				it(`${cols} × ${rows}`, async (ctx) => {
					need(ctx);
					const scene = iso({
						cols,
						rows,
						tilesets: [blocks(64, 64)],
						layers: [
							{
								data: fill(cols, rows, (c, r) => {
									return 1 + ((c + r * 3) % 8);
								}),
							},
						],
					});
					expect(await same(scene)).toBeGreaterThan(0);
				});
			}

			it("a large map, of tiles like the Isometric Dungeon's", async (ctx) => {
				need(ctx);
				const scene = {
					orientation: "isometric",
					cols: 64,
					rows: 64,
					tw: 128,
					th: 64,
					tilesets: [
						makeTileset({
							tw: 128,
							th: 256,
							count: 16,
							columns: 8,
							opaque: (x, y) => {
								return inBlock(x, y, 128, 256, 128, 64);
							},
						}),
					],
					layers: [{ data: scattered(64, 64, 16) }],
				};
				const views = [
					[4096 - 160, 0],
					[4096 - 160, 2000],
					[100, 2040],
					[7900, 2040],
					[4096, 4000],
					[3000, 1500],
				];
				expect(await same(scene, { views })).toBeGreaterThan(0);
			});

			it("an empty layer draws nothing, either way", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 6,
					rows: 6,
					tilesets: [blocks()],
					layers: [
						{
							data: fill(6, 6, () => {
								return 0;
							}),
						},
					],
				});
				expect(await same(scene, { views: [[0, 0]] })).toBe(0);
			});

			it("a single tile, and tiles in the corners alone", async (ctx) => {
				need(ctx);
				const corners = iso({
					cols: 9,
					rows: 5,
					tilesets: [blocks(64, 128)],
					layers: [
						{
							data: fill(9, 5, (c, r) => {
								return (c === 0 || c === 8) && (r === 0 || r === 4) ? 3 : 0;
							}),
						},
					],
				});
				expect(await same(corners)).toBeGreaterThan(0);
				const one = iso({
					cols: 9,
					rows: 5,
					tilesets: [blocks(64, 128)],
					layers: [
						{
							data: fill(9, 5, (c, r) => {
								return c === 4 && r === 2 ? 6 : 0;
							}),
						},
					],
				});
				expect(await same(one)).toBeGreaterThan(0);
			});
		});

		describe("isometric: what a tile can be", () => {
			it("flipped, every way", async (ctx) => {
				need(ctx);
				// square tiles: a diagonal flip turns the image a quarter
				const tileset = makeTileset({
					tw: 64,
					th: 64,
					opaque: (x, y) => {
						return x + y > 20;
					},
				});
				const scene = iso({
					cols: 8,
					rows: 8,
					tilesets: [tileset],
					layers: [
						{
							data: fill(8, 8, (c, r) => {
								return 1 + ((c + r) % 8) + ALL_FLIPS[(c * 3 + r) % 8];
							}),
						},
					],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("flipped across and down, taller than wide", async (ctx) => {
				need(ctx);
				const flips = [0, FLIP_H, FLIP_V, FLIP_H + FLIP_V];
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 128)],
					layers: [
						{
							data: fill(8, 6, (c, r) => {
								return 1 + ((c + r) % 8) + flips[(c + r * 3) % 4];
							}),
						},
					],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("animated: each frame, as time passes", async (ctx) => {
				need(ctx);
				const tileset = blocks(64, 64, {
					extra: {
						tiles: [
							{
								id: 0,
								animation: [
									{ tileid: 0, duration: 100 },
									{ tileid: 5, duration: 100 },
									{ tileid: 6, duration: 100 },
								],
							},
							{
								id: 3,
								animation: [
									{ tileid: 3, duration: 150 },
									{ tileid: 7, duration: 150 },
								],
							},
						],
					},
				});
				const layers = show(
					app,
					makeMap(
						iso({
							cols: 8,
							rows: 6,
							tilesets: [tileset],
							layers: [
								{
									data: fill(8, 6, (c, r) => {
										return 1 + ((c + r) % 4);
									}),
								},
							],
						}),
					),
				);
				expect(layers[0].isAnimated).toBe(true);
				expect(layers[0].renderMode).toBe("shader");
				app.viewport.moveTo(0, 0);
				const frames = [];
				for (let step = 0; step < 6; step++) {
					// 60 ms a step: the two animations change at their own times
					const cpu = await drawIn(app, layers, "perTile", 60);
					const gpu = await drawIn(app, layers, "shader");
					expect(gpu.cpuDraws).toBe(0);
					const d = diff(cpu.frame, gpu.frame);
					expect(d.different, `step ${step}: ${d.first}`).toBe(0);
					frames.push(gpu.frame);
				}
				// and the picture did change along the way
				expect(diff(frames[0], frames[2]).different).toBeGreaterThan(0);
				expect(diff(frames[2], frames[5]).different).toBeGreaterThan(0);
			});

			it("from a tileset with a margin and spacing", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 64, { margin: 3, spacing: 5 })],
					layers: [{ data: scattered(8, 6) }],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("from a tileset whose image has no margin after its last tiles", async (ctx) => {
				need(ctx);
				// as Tiled lets one be: the tiles are counted from the first
				// margin, not as if there were two
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [
						blocks(64, 64, { margin: 7, spacing: 2, outerMargin: false }),
					],
					layers: [{ data: scattered(8, 6) }],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			for (const [x, y] of [
				[0, 16],
				[-12, 0],
				[7, -23],
				// further than a tile is large: the tile shows in cells that
				// are not its own, and from views its cell is not in
				[0, -80],
				[150, 150],
				[-200, 90],
			]) {
				it(`moved by a tileset tileoffset of (${x}, ${y})`, async (ctx) => {
					need(ctx);
					const scene = iso({
						cols: 8,
						rows: 6,
						tilesets: [blocks(64, 64, { extra: { tileoffset: { x, y } } })],
						layers: [{ data: scattered(8, 6) }],
					});
					expect(await same(scene)).toBeGreaterThan(0);
				});
			}

			for (const [tw, th] of [
				[64, 32],
				[64, 64],
				[64, 128],
				[128, 96],
			]) {
				it(`with soft edges, and see-through, ${tw} × ${th}: each shows the tiles behind it`, async (ctx) => {
					need(ctx);
					// a texel that is not opaque is blended over the tiles
					// behind it, as many as there are: one over the other
					// in 8 bits a step tile by tile, in one go on the GPU,
					// a rounding step or two apart
					const scene = iso({
						cols: 8,
						rows: 6,
						tilesets: [softBlocks(tw, th)],
						layers: [{ data: scattered(8, 6) }],
					});
					expect(await same(scene, { tolerance: 3 })).toBeGreaterThan(0);
				});
			}

			it("from the map's second tileset", async (ctx) => {
				need(ctx);
				// the first tileset is not used by this layer at all, and is
				// of another size: nothing of it may count
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 32), blocks(64, 96)],
					layers: [{ data: scattered(8, 6, 8, 9) }],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("from a tileset smaller than another of the map's", async (ctx) => {
				need(ctx);
				// the other way round: the unused tileset is the large one
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(128, 256), blocks(64, 48)],
					layers: [{ data: scattered(8, 6, 8, 9) }],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});
		});

		describe("isometric: what a layer can be", () => {
			it("half transparent, its tiles side by side", async (ctx) => {
				need(ctx);
				// flat diamonds do not overlap: each pixel is blended once,
				// a rounding step apart at most
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 32)],
					layers: [{ data: scattered(8, 6), opacity: 0.5 }],
				});
				const expected = (picture) => {
					return layered(picture, 0.5);
				};
				expect(await same(scene, { expected, tolerance: 1 })).toBeGreaterThan(
					0,
				);
			});

			it("half transparent, its tiles overlapping: faded as one picture", async (ctx) => {
				need(ctx);
				// The GPU path draws the layer flat, then fades it: what is
				// behind a tile does not show through it, as with a layer
				// baked into one image ("prerender"). Tile by tile, each
				// tile is blended on the ones behind it instead.
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 128)],
					layers: [{ data: scattered(8, 6), opacity: 0.5 }],
				});
				const views = VIEWS.slice(0, 3);
				const baked = [];
				let layers = show(app, makeMap(scene), "prerender");
				for (const [x, y] of views) {
					app.viewport.moveTo(x, y);
					baked.push((await drawIn(app, layers, "prerender")).frame);
				}
				layers = show(app, makeMap(scene));
				expect(layers[0].renderMode).toBe("shader");
				for (const [i, [x, y]] of views.entries()) {
					app.viewport.moveTo(x, y);
					const gpu = await drawIn(app, layers, "shader");
					expect(gpu.cpuDraws).toBe(0);
					const flat = layered(reference(scene, x, y, WIDTH, HEIGHT), 0.5);
					const d = diff(flat, gpu.frame, 1);
					expect(d.different, `view (${x}, ${y}): ${d.first}`).toBe(0);
					const b = diff(baked[i], gpu.frame, 1);
					expect(b.different, `as prerender, view (${x}, ${y})`).toBe(0);
					expect(drawn(gpu.frame)).toBeGreaterThan(0);
				}
			});

			it("tinted", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 128)],
					layers: [{ data: scattered(8, 6), tintcolor: "#ff8040" }],
				});
				const expected = (picture) => {
					return layered(picture, 1, [255, 128, 64]);
				};
				expect(await same(scene, { expected, tolerance: 1 })).toBeGreaterThan(
					0,
				);
			});

			it("one of several, each on a tileset of its own", async (ctx) => {
				need(ctx);
				// a floor of flat tiles under walls of tall ones
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 32), blocks(64, 128)],
					layers: [
						{
							data: fill(8, 6, (c, r) => {
								return 1 + ((c + r) % 8);
							}),
						},
						{
							data: fill(8, 6, (c, r) => {
								return (c + r) % 3 === 0 ? 9 + ((c * 2 + r) % 8) : 0;
							}),
						},
					],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("one of several, on tilesets of several sizes moved by a tileoffset", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [
						blocks(64, 32, { extra: { tileoffset: { x: 5, y: 9 } } }),
						blocks(64, 128, { extra: { tileoffset: { x: -20, y: 40 } } }),
						blocks(128, 64),
					],
					layers: [
						{ data: scattered(8, 6) },
						{ data: scattered(8, 6, 8, 9) },
						{
							data: fill(8, 6, (c, r) => {
								return (c + r) % 4 === 1 ? 17 + ((c + r * 3) % 8) : 0;
							}),
						},
					],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("of an infinite map, starting left of and above the origin", async (ctx) => {
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
				const scene = iso({
					cols: 8,
					rows: 8,
					tilesets: [blocks(64, 64)],
					extra: { infinite: true },
					layers: [
						{
							startx: -4,
							starty: -4,
							width: 12,
							height: 8,
							data: undefined,
							chunks: [chunk(-4, -4), chunk(0, -4), chunk(4, 0), chunk(0, 0)],
						},
					],
				});
				const layers = show(app, makeMap(scene));
				expect(layers[0].startx).toBe(-4);
				expect(layers[0].renderMode).toBe("shader");
				const views = [
					[0, 0],
					[-200, -150],
					[150, -100],
					[-60, 40],
				];
				expect(await same(scene, { views, layers })).toBeGreaterThan(0);
			});
		});

		describe("isometric: what a camera can do", () => {
			const tall = () => {
				return iso({
					cols: 10,
					rows: 8,
					tilesets: [blocks(64, 128)],
					layers: [{ data: scattered(10, 8) }],
				});
			};

			it("look from anywhere, and from where nothing shows", async (ctx) => {
				need(ctx);
				const scene = tall();
				const layers = show(app, makeMap(scene));
				const views = [];
				for (let x = -400; x <= 700; x += 137) {
					for (let y = -300; y <= 400; y += 97) {
						views.push([x, y]);
					}
				}
				expect(await same(scene, { views, layers })).toBeGreaterThan(0);
				// far off the map: nothing, either way
				const far = [
					[5000, 5000],
					[-5000, 0],
				];
				expect(await same(scene, { views: far, layers })).toBe(0);
			});

			it("scroll a pixel at a time, across a tile", async (ctx) => {
				need(ctx);
				const scene = tall();
				const layers = show(app, makeMap(scene));
				const views = [];
				for (let step = 0; step <= 64; step += 3) {
					views.push([40 + step, 10 + Math.floor(step / 2)]);
				}
				expect(await same(scene, { views, layers })).toBeGreaterThan(0);
			});

			it("stand between pixels", async (ctx) => {
				need(ctx);
				// the camera's position is rounded to whole pixels when the
				// world is drawn: the reference is painted from there
				const scene = tall();
				const layers = show(app, makeMap(scene));
				for (const [x, y] of [
					[10.5, 7.25],
					[-33.75, 60.5],
					[120.1, -45.9],
				]) {
					app.viewport.moveTo(x, y);
					const cpu = await drawIn(app, layers, "perTile");
					const gpu = await drawIn(app, layers, "shader");
					expect(gpu.cpuDraws).toBe(0);
					const d = diff(cpu.frame, gpu.frame);
					expect(d.different, `view (${x}, ${y}): ${d.first}`).toBe(0);
					expect(drawn(gpu.frame)).toBeGreaterThan(0);
				}
			});

			it("be shifted by its offset, as a shake does", async (ctx) => {
				need(ctx);
				const scene = tall();
				app.viewport.offset.set(13, -9);
				try {
					expect(await same(scene, { oracle: false })).toBeGreaterThan(0);
				} finally {
					app.viewport.offset.set(0, 0);
				}
			});

			for (const zoom of [2, 3]) {
				it(`zoom ${zoom} times`, async (ctx) => {
					need(ctx);
					const scene = tall();
					app.viewport.zoom = zoom;
					try {
						expect(await same(scene, { oracle: false })).toBeGreaterThan(0);
					} finally {
						app.viewport.zoom = 1;
					}
				});
			}

			for (const zoom of [0.5, 1.5]) {
				it(`zoom ${zoom} times, a texel apart at most but for a few pixels`, async (ctx) => {
					need(ctx);
					// Tiles are sampled without smoothing: where a screen
					// pixel's centre falls exactly between two texels, a
					// quad per tile and one quad for the layer do not round
					// the same way. A texel apart is within the tolerance
					// (colours change by 7 a texel at most here); the
					// outlines of the tiles, where the next texel is another
					// tile's, are the share left. An orthogonal layer's two
					// paths are as far apart.
					const scene = tall();
					app.viewport.zoom = zoom;
					try {
						expect(
							await same(scene, { oracle: false, tolerance: 8, share: 0.06 }),
						).toBeGreaterThan(0);
					} finally {
						app.viewport.zoom = 1;
					}
				});
			}
		});

		describe("isometric: tiles changed while the game runs", () => {
			/** set a cell in the world and in the scene the reference reads */
			const setCell = (scene, layer, col, row, gid) => {
				scene.layers[0].data[row * scene.cols + col] = gid;
				if (gid === 0) {
					layer.clearTile(col, row);
				} else {
					layer.setTile(layer.getTileById(gid, col, row), col, row);
				}
			};

			it("setTile and clearTile show at once", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [blocks(64, 128)],
					layers: [{ data: scattered(8, 6) }],
				});
				const layers = show(app, makeMap(scene));
				const layer = layers[0];
				const options = { views: [[0, 0]], layers };
				await same(scene, options);
				const before = (await drawIn(app, layers, "shader")).frame;

				setCell(scene, layer, 3, 2, 5);
				setCell(scene, layer, 0, 5, 2 + FLIP_H);
				await same(scene, options);
				const set = (await drawIn(app, layers, "shader")).frame;
				expect(diff(before, set).different).toBeGreaterThan(0);

				setCell(scene, layer, 3, 2, 0);
				setCell(scene, layer, 7, 0, 0);
				await same(scene, options);
				const cleared = (await drawIn(app, layers, "shader")).frame;
				expect(diff(set, cleared).different).toBeGreaterThan(0);
				expect(layer.renderMode).toBe("shader");
			});

			it("every cell changed, one frame after the other", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 6,
					rows: 5,
					tilesets: [blocks(64, 96)],
					layers: [{ data: scattered(6, 5) }],
				});
				const layers = show(app, makeMap(scene));
				const options = { views: [[0, 0]], layers };
				for (let step = 0; step < 4; step++) {
					for (let row = 0; row < 5; row++) {
						for (let col = 0; col < 6; col++) {
							const gid =
								(col + row + step) % 4 === 0 ? 0 : 1 + ((col * step + row) % 8);
							setCell(scene, layers[0], col, row, gid);
						}
					}
					await same(scene, options);
				}
				expect(layers[0].renderMode).toBe("shader");
			});

			it("an empty layer takes its tileset from the first tile set", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 6,
					rows: 6,
					tilesets: [blocks(64, 32), blocks(64, 96)],
					layers: [
						{
							data: fill(6, 6, () => {
								return 0;
							}),
						},
					],
				});
				const layers = show(app, makeMap(scene));
				const layer = layers[0];
				expect(layer._shaderTileset).toBeUndefined();
				setCell(scene, layer, 2, 3, 12);
				setCell(scene, layer, 3, 3, 10);
				expect(layer.renderMode).toBe("shader");
				expect(layer._shaderTileset.firstgid).toBe(9);
				expect(await same(scene, { views: [[0, 0]], layers })).toBeGreaterThan(
					0,
				);
			});

			it("a tile of a second tileset moves the layer back to the CPU renderer", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 6,
					rows: 6,
					tilesets: [blocks(64, 32), blocks(64, 96)],
					layers: [{ data: scattered(6, 6) }],
				});
				const layers = show(app, makeMap(scene));
				const layer = layers[0];
				expect(layer.renderMode).toBe("shader");
				const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
				try {
					// one of the same tileset: nothing changes
					setCell(scene, layer, 1, 1, 3);
					expect(layer.renderMode).toBe("shader");
					expect(warn).not.toHaveBeenCalled();
					// one of the other
					setCell(scene, layer, 2, 2, 10);
					expect(layer.renderMode).toBe("perTile");
					expect(warn.mock.calls.flat().join(" ")).toMatch(
						/more than one tileset/,
					);
				} finally {
					warn.mockRestore();
				}
				// and the layer is drawn right from there on
				app.viewport.moveTo(0, 0);
				app.world.update(0);
				app.repaint();
				app.draw();
				const frame = await grabFrame(app.renderer);
				const d = diff(reference(scene, 0, 0, WIDTH, HEIGHT), frame);
				expect(d.different, d.first).toBe(0);
			});

			it("a tile that is not square, flipped diagonally, does too", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 6,
					rows: 6,
					tilesets: [blocks(64, 96)],
					layers: [{ data: scattered(6, 6) }],
				});
				const layers = show(app, makeMap(scene));
				const layer = layers[0];
				expect(layer.renderMode).toBe("shader");
				const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
				try {
					setCell(scene, layer, 1, 1, 3 + FLIP_H + FLIP_V);
					expect(layer.renderMode).toBe("shader");
					setCell(scene, layer, 2, 2, 4 + FLIP_AD);
					expect(layer.renderMode).toBe("perTile");
					expect(warn.mock.calls.flat().join(" ")).toMatch(
						/not square, flipped diagonally/,
					);
				} finally {
					warn.mockRestore();
				}
			});
		});

		describe("isometric: layers the GPU path does not take", () => {
			it("tiles of two tilesets in one layer", (ctx) => {
				need(ctx);
				const [mode, said] = modeOf(
					iso({
						cols: 6,
						rows: 6,
						tilesets: [blocks(64, 32), blocks(64, 96)],
						layers: [
							{
								data: fill(6, 6, (c, r) => {
									return 1 + ((c + r) % 16);
								}),
							},
						],
					}),
				);
				expect(mode).toBe("perTile");
				expect(said).toMatch(/more than one tileset in an isometric layer/);
			});

			it("tiles past the size the shader walks", (ctx) => {
				need(ctx);
				const [tall, saidTall] = modeOf(
					iso({
						cols: 4,
						rows: 4,
						tilesets: [blocks(64, 257)],
						layers: [{ data: scattered(4, 4) }],
					}),
				);
				expect(tall).toBe("perTile");
				expect(saidTall).toMatch(/larger than the shader's limit/);
				const [wide] = modeOf(
					iso({
						cols: 4,
						rows: 4,
						tilesets: [makeTileset({ tw: 257, th: 32 })],
						layers: [{ data: scattered(4, 4) }],
					}),
				);
				expect(wide).toBe("perTile");
			});

			it("a tileset drawn at the map's grid size", (ctx) => {
				need(ctx);
				const [mode, said] = modeOf(
					iso({
						cols: 4,
						rows: 4,
						tilesets: [blocks(64, 64, { extra: { tilerendersize: "grid" } })],
						layers: [{ data: scattered(4, 4) }],
					}),
				);
				expect(mode).toBe("perTile");
				expect(said).toMatch(/tilerendersize/);
			});

			it("a tile that is not square, flipped diagonally", (ctx) => {
				need(ctx);
				const [mode, said] = modeOf(
					iso({
						cols: 4,
						rows: 4,
						tilesets: [blocks(64, 96)],
						layers: [
							{
								data: fill(4, 4, (c, r) => {
									return 1 + ((c + r) % 8) + (c === 2 && r === 1 ? FLIP_AD : 0);
								}),
							},
						],
					}),
				);
				expect(mode).toBe("perTile");
				expect(said).toMatch(/not square, flipped diagonally/);
			});

			it("a grid of odd size, whose tiles stand half a pixel off", async (ctx) => {
				need(ctx);
				for (const [tw, th] of [
					[33, 17],
					[64, 31],
					[63, 32],
				]) {
					const scene = {
						orientation: "isometric",
						cols: 9,
						rows: 7,
						tw,
						th,
						tilesets: [makeTileset({ tw, th: th * 2 })],
						layers: [{ data: scattered(9, 7) }],
					};
					const [mode, said] = modeOf(scene);
					expect(mode, `${tw} × ${th}`).toBe("perTile");
					expect(said).toMatch(/isometric grid of odd size/);
				}
			});

			it("a layer blended another way than the normal one", (ctx) => {
				need(ctx);
				for (const mode of ["add", "multiply", "screen"]) {
					const [took, said] = modeOf(
						iso({
							cols: 4,
							rows: 4,
							tilesets: [blocks(64, 128)],
							layers: [{ data: scattered(4, 4), mode }],
						}),
					);
					expect(took, mode).toBe("perTile");
					expect(said).toMatch(/blend mode/);
				}
			});

			it("and one asked for by hand afterwards is still drawn, tile by tile", async (ctx) => {
				need(ctx);
				// two tilesets in one layer: the layer has no tileset to
				// draw with on the GPU
				const scene = iso({
					cols: 6,
					rows: 6,
					tilesets: [blocks(64, 32), blocks(64, 96)],
					layers: [
						{
							data: fill(6, 6, (c, r) => {
								return 1 + ((c + r) % 16);
							}),
						},
					],
				});
				const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
				let layers;
				try {
					layers = show(app, makeMap(scene));
				} finally {
					warn.mockRestore();
				}
				expect(layers[0].renderMode).toBe("perTile");
				app.viewport.moveTo(0, 0);
				const forced = await drawIn(app, layers, "shader");
				expect(forced.cpuDraws).toBe(1);
				const d = diff(reference(scene, 0, 0, WIDTH, HEIGHT), forced.frame);
				expect(d.different, d.first).toBe(0);
				expect(drawn(forced.frame)).toBeGreaterThan(0);
			});

			it("any layer, with gpuTilemap off", (ctx) => {
				need(ctx);
				app.world.gpuTilemap = false;
				try {
					const [mode] = modeOf(
						iso({
							cols: 4,
							rows: 4,
							tilesets: [blocks()],
							layers: [{ data: scattered(4, 4) }],
						}),
					);
					expect(mode).toBe("perTile");
				} finally {
					app.world.gpuTilemap = true;
				}
			});
		});

		describe("orthogonal: the same picture, both ways", () => {
			const ortho = (options) => {
				return { orientation: "orthogonal", tw: 32, th: 32, ...options };
			};
			const ORTHO_VIEWS = [
				[0, 0],
				[40, 30],
				[-50, -60],
				[200, 150],
				[-250, 20],
				[90, -150],
			];

			it("tiles the size of the grid, flipped every way", async (ctx) => {
				need(ctx);
				const scene = ortho({
					cols: 12,
					rows: 10,
					tilesets: [makeTileset({ tw: 32, th: 32 })],
					layers: [
						{
							data: fill(12, 10, (c, r) => {
								return (c * 3 + r) % 5 === 0
									? 0
									: 1 + ((c + r * 2) % 8) + ALL_FLIPS[(c + r) % 8];
							}),
						},
					],
				});
				expect(await same(scene, { views: ORTHO_VIEWS })).toBeGreaterThan(0);
			});

			// tiles larger than the grid stand on their cell and reach above
			// it and to its right: above the map's first row and right of
			// its last column too
			for (const [tw, th] of [
				[32, 64],
				[32, 128],
				[64, 32],
				[96, 96],
				[48, 40],
			]) {
				it(`${tw} × ${th} tiles on a 32 × 32 grid`, async (ctx) => {
					need(ctx);
					const scene = ortho({
						cols: 10,
						rows: 8,
						tilesets: [
							makeTileset({
								tw,
								th,
								opaque: (x, y) => {
									return (x + y) % 9 !== 0 || x < 4;
								},
							}),
						],
						layers: [{ data: scattered(10, 8) }],
					});
					expect(await same(scene, { views: ORTHO_VIEWS })).toBeGreaterThan(0);
				});
			}

			it("a tileset whose image has no margin after its last tiles", async (ctx) => {
				need(ctx);
				const scene = ortho({
					cols: 10,
					rows: 8,
					tilesets: [
						makeTileset({
							tw: 32,
							th: 32,
							margin: 5,
							spacing: 3,
							outerMargin: false,
						}),
					],
					layers: [{ data: scattered(10, 8) }],
				});
				expect(await same(scene, { views: ORTHO_VIEWS })).toBeGreaterThan(0);
			});

			it("layers on tilesets of several sizes", async (ctx) => {
				need(ctx);
				const scene = ortho({
					cols: 10,
					rows: 8,
					tilesets: [
						makeTileset({ tw: 32, th: 32 }),
						makeTileset({
							tw: 64,
							th: 96,
							opaque: (x, y) => {
								return x > 10 && y > 6;
							},
						}),
					],
					layers: [
						{ data: scattered(10, 8) },
						{
							data: fill(10, 8, (c, r) => {
								return (c + r * 2) % 4 === 0 ? 9 + ((c + r) % 8) : 0;
							}),
						},
					],
				});
				expect(await same(scene, { views: ORTHO_VIEWS })).toBeGreaterThan(0);
			});

			it("tiles larger than the grid, with soft edges and see-through", async (ctx) => {
				need(ctx);
				for (const [tw, th] of [
					[64, 64],
					[32, 96],
					[80, 48],
				]) {
					const scene = ortho({
						cols: 10,
						rows: 8,
						tilesets: [
							makeTileset({
								tw,
								th,
								alpha: (x, y, id) => {
									// a soft border, and every third tile
									// see-through all over
									const edge = Math.min(x, y, tw - 1 - x, th - 1 - y);
									const a = id % 3 === 2 ? 110 : 255;
									return Math.round(a * Math.min(1, (edge + 1) / 4));
								},
							}),
						],
						layers: [{ data: scattered(10, 8) }],
					});
					expect(
						await same(scene, { views: ORTHO_VIEWS, tolerance: 3 }),
						`${tw} × ${th}`,
					).toBeGreaterThan(0);
				}
			});

			it("a tile that is not square, flipped diagonally, is left to the CPU renderer", (ctx) => {
				need(ctx);
				const [mode, said] = modeOf(
					ortho({
						cols: 4,
						rows: 4,
						tilesets: [makeTileset({ tw: 32, th: 64 })],
						layers: [
							{
								data: fill(4, 4, (c, r) => {
									return 1 + ((c + r) % 8) + (c === 1 && r === 2 ? FLIP_AD : 0);
								}),
							},
						],
					}),
				);
				expect(mode).toBe("perTile");
				expect(said).toMatch(/not square, flipped diagonally/);
			});
		});

		describe("a layer moved, in Tiled or in the game", () => {
			const ortho = (options) => {
				return { orientation: "orthogonal", tw: 32, th: 32, ...options };
			};

			/** the scene baked into one image ("prerender"), from each view */
			const baked = async (scene, views = VIEWS.slice(0, 4)) => {
				const layers = show(app, makeMap(scene), "prerender");
				for (const [x, y] of views) {
					app.viewport.moveTo(x, y);
					const { frame } = await drawIn(app, layers, "prerender");
					const d = diff(reference(scene, x, y, WIDTH, HEIGHT), frame);
					expect(d.different, `baked, view (${x}, ${y}): ${d.first}`).toBe(0);
				}
			};

			for (const [x, y] of [
				[37, -21],
				[-130, 75],
				[0, 200],
			]) {
				it(`isometric, offset by (${x}, ${y}) in Tiled`, async (ctx) => {
					need(ctx);
					const scene = iso({
						cols: 8,
						rows: 6,
						tilesets: [blocks(64, 128)],
						layers: [{ data: scattered(8, 6), offsetx: x, offsety: y }],
					});
					expect(await same(scene)).toBeGreaterThan(0);
					await baked(scene);
				});

				it(`orthogonal, offset by (${x}, ${y}) in Tiled`, async (ctx) => {
					need(ctx);
					const scene = ortho({
						cols: 10,
						rows: 8,
						tilesets: [makeTileset({ tw: 32, th: 64 })],
						layers: [{ data: scattered(10, 8), offsetx: x, offsety: y }],
					});
					expect(await same(scene)).toBeGreaterThan(0);
					await baked(scene);
				});
			}

			it("isometric layers, each with an offset of its own, on tilesets moved by a tileoffset", async (ctx) => {
				need(ctx);
				const scene = iso({
					cols: 8,
					rows: 6,
					tilesets: [
						blocks(64, 32, { extra: { tileoffset: { x: 5, y: 9 } } }),
						blocks(64, 128, { extra: { tileoffset: { x: -20, y: 40 } } }),
						blocks(128, 64),
					],
					layers: [
						{ data: scattered(8, 6), offsetx: -10, offsety: 30 },
						{ data: scattered(8, 6, 8, 9), offsetx: 64, offsety: 0 },
						{
							data: fill(8, 6, (c, r) => {
								return (c + r) % 4 === 1 ? 17 + ((c + r * 3) % 8) : 0;
							}),
							offsetx: 3,
							offsety: -70,
						},
					],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("orthogonal layers, each with an offset of its own", async (ctx) => {
				need(ctx);
				const scene = ortho({
					cols: 10,
					rows: 8,
					tilesets: [
						makeTileset({ tw: 32, th: 32 }),
						makeTileset({ tw: 64, th: 96 }),
					],
					layers: [
						{ data: scattered(10, 8), offsetx: 16, offsety: 8 },
						{
							data: fill(10, 8, (c, r) => {
								return (c + r * 2) % 4 === 0 ? 9 + ((c + r) % 8) : 0;
							}),
							offsetx: -45,
							offsety: 61,
						},
					],
				});
				expect(await same(scene)).toBeGreaterThan(0);
			});

			it("a layer of an infinite isometric map, offset", async (ctx) => {
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
				const scene = iso({
					cols: 8,
					rows: 8,
					tilesets: [blocks(64, 64)],
					extra: { infinite: true },
					layers: [
						{
							startx: -4,
							starty: -4,
							width: 12,
							height: 8,
							data: undefined,
							chunks: [chunk(-4, -4), chunk(0, -4), chunk(4, 0), chunk(0, 0)],
							offsetx: 48,
							offsety: -36,
						},
					],
				});
				const layers = show(app, makeMap(scene));
				expect(layers[0].renderMode).toBe("shader");
				const views = [
					[0, 0],
					[-200, -150],
					[150, -100],
				];
				expect(await same(scene, { views, layers })).toBeGreaterThan(0);
			});

			for (const orientation of ["isometric", "orthogonal"]) {
				it(`${orientation}: moved in the game, by its pos`, async (ctx) => {
					need(ctx);
					const layer0 = { offsetx: 12, offsety: 7 };
					const scene =
						orientation === "isometric"
							? iso({
									cols: 8,
									rows: 6,
									tilesets: [blocks(64, 128)],
									layers: [{ data: scattered(8, 6), ...layer0 }],
								})
							: ortho({
									cols: 10,
									rows: 8,
									tilesets: [makeTileset({ tw: 32, th: 32 })],
									layers: [{ data: scattered(10, 8), ...layer0 }],
								});
					const layers = show(app, makeMap(scene));
					const layer = layers[0];
					// where Tiled put it
					const startX = layer.pos.x;
					const startY = layer.pos.y;
					expect(await same(scene, { layers })).toBeGreaterThan(0);
					for (const [dx, dy] of [
						[50, -30],
						[-170, 90],
						[0, 0],
					]) {
						layer.pos.x = startX + dx;
						layer.pos.y = startY + dy;
						// the reference follows
						scene.layers[0].offsetx = 12 + dx;
						scene.layers[0].offsety = 7 + dy;
						expect(
							await same(scene, { layers }),
							`moved by (${dx}, ${dy})`,
						).toBeGreaterThan(0);
					}
				});
			}
		});

		describe("tiles that reach past the grid, when only they are in view", () => {
			const ortho = (options) => {
				return { orientation: "orthogonal", tw: 32, th: 32, ...options };
			};
			const all = (cols, rows) => {
				return fill(cols, rows, (c, r) => {
					return 1 + ((c + r * 2) % 8);
				});
			};

			/** the scene baked into one image ("prerender"), from each view */
			const baked = async (scene, views) => {
				const layers = show(app, makeMap(scene), "prerender");
				let total = 0;
				for (const [x, y] of views) {
					app.viewport.moveTo(x, y);
					const { frame } = await drawIn(app, layers, "prerender");
					const d = diff(reference(scene, x, y, WIDTH, HEIGHT), frame);
					expect(d.different, `baked, view (${x}, ${y}): ${d.first}`).toBe(0);
					total += drawn(frame);
				}
				return total;
			};

			it("isometric: tall tiles, above the map's top corner", async (ctx) => {
				need(ctx);
				// the 64 × 128 tiles of the first rows reach 96 pixels above
				// the grid, which starts at 0: these views end above it
				const scene = iso({
					cols: 10,
					rows: 8,
					tilesets: [blocks(64, 128)],
					layers: [{ data: all(10, 8) }],
				});
				const views = [
					[160, -HEIGHT - 10],
					[100, -HEIGHT - 40],
					[220, -HEIGHT - 70],
					[-126, -300],
				];
				expect(await same(scene, { views })).toBeGreaterThan(0);
				expect(await baked(scene, views)).toBeGreaterThan(0);
			});

			it("orthogonal: tall tiles, above the first row", async (ctx) => {
				need(ctx);
				const scene = ortho({
					cols: 10,
					rows: 8,
					tilesets: [makeTileset({ tw: 32, th: 128 })],
					layers: [{ data: all(10, 8) }],
				});
				const views = [
					[0, -HEIGHT - 10],
					[40, -HEIGHT - 50],
					[-200, -HEIGHT - 80],
				];
				expect(await same(scene, { views })).toBeGreaterThan(0);
				expect(await baked(scene, views)).toBeGreaterThan(0);
			});

			it("orthogonal: wide tiles, right of the last column", async (ctx) => {
				need(ctx);
				// 96 pixels wide on a 32 pixel grid: 64 pixels past the map,
				// which ends at 320
				const scene = ortho({
					cols: 10,
					rows: 8,
					tilesets: [makeTileset({ tw: 96, th: 32 })],
					layers: [{ data: all(10, 8) }],
				});
				const views = [
					[325, 0],
					[350, 40],
					[380, -100],
				];
				expect(await same(scene, { views })).toBeGreaterThan(0);
				expect(await baked(scene, views)).toBeGreaterThan(0);
			});

			it("isometric tiles moved off the grid by their tileset's tileoffset", async (ctx) => {
				need(ctx);
				// moved 150 pixels up and to the left: where the grid is not
				const scene = iso({
					cols: 6,
					rows: 6,
					tilesets: [
						blocks(64, 64, { extra: { tileoffset: { x: -150, y: -150 } } }),
					],
					layers: [{ data: all(6, 6) }],
				});
				const views = [
					[-WIDTH - 10, 0],
					[-100, -HEIGHT - 20],
					[-WIDTH - 60, -80],
				];
				expect(await same(scene, { views })).toBeGreaterThan(0);
			});

			it("orthogonal tiles moved off the grid by their tileset's tileoffset", async (ctx) => {
				need(ctx);
				// under the map, which ends at 192. An orthogonal tileoffset
				// leaves the layer to the CPU renderer: it is drawn as well
				const scene = ortho({
					cols: 8,
					rows: 6,
					tilesets: [
						makeTileset({
							tw: 32,
							th: 32,
							extra: { tileoffset: { x: 0, y: 90 } },
						}),
					],
					layers: [{ data: all(8, 6) }],
				});
				const [mode] = modeOf(scene);
				expect(mode).toBe("perTile");
				const layers = app.world.getChildren().filter((child) => {
					return child.layerData !== undefined;
				});
				for (const [x, y] of [
					[0, 200],
					[-40, 250],
				]) {
					app.viewport.moveTo(x, y);
					const { frame } = await drawIn(app, layers, "perTile");
					const d = diff(reference(scene, x, y, WIDTH, HEIGHT), frame);
					expect(d.different, `view (${x}, ${y}): ${d.first}`).toBe(0);
					expect(drawn(frame)).toBeGreaterThan(0);
				}
			});
		});

		it("a level change frees what the GPU path kept for its layers", async (ctx) => {
			need(ctx);
			const scene = iso({
				cols: 6,
				rows: 6,
				tilesets: [blocks(64, 64)],
				layers: [{ data: scattered(6, 6) }],
			});
			const layers = show(app, makeMap(scene));
			const options = { views: [[0, 0]], layers };
			await same(scene, options);
			const gpu =
				app.renderer._tmxGPURenderers?.get("isometric") ??
				app.renderer.tmxRenderers?.get("isometric");
			expect(gpu.resources.size).toBe(1);
			app.renderer.reset();
			expect(gpu.resources.size).toBe(0);
			// and the layer draws again after it
			expect(await same(scene, options)).toBeGreaterThan(0);
		});
	});
}
