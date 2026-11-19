/**
 * A tile layer drawn where its ancestors put it: in a world moved to centre
 * a map smaller than the view (what `level.load` does), or in a container
 * that was moved. The layer is handed the camera's view in the world's
 * coordinates, and has to read it in its own: the tiles that reach above or
 * left of its grid were cut on the GPU and baked paths, and a layer far
 * enough from the origin lost tiles tile by tile.
 *
 * Also here: a layer's `renderMode` switched by hand, and tiles set in
 * between.
 *
 * One spec file per renderer calls this: an application takes the place of
 * the one before it, and a spec file has its own page.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Container } from "../../src/index.js";
import {
	comparePaths,
	diff,
	drawIn,
	drawn,
	FLIP_AD,
	fill,
	inBlock,
	makeApp,
	makeMap,
	makeTileset,
	reference,
	show,
} from "./tile-layer-compare.js";

const WIDTH = 320;
const HEIGHT = 240;

const all = (cols, rows) => {
	return fill(cols, rows, (c, r) => {
		return 1 + ((c + r * 2) % 8);
	});
};

/** small maps of tiles that reach past their grid, one per orientation */
const SCENES = {
	orthogonal: () => {
		return {
			orientation: "orthogonal",
			cols: 4,
			rows: 3,
			tw: 32,
			th: 32,
			tilesets: [makeTileset({ tw: 48, th: 64 })],
			layers: [{ data: all(4, 3) }],
		};
	},
	isometric: () => {
		return {
			orientation: "isometric",
			cols: 3,
			rows: 3,
			tw: 64,
			th: 32,
			tilesets: [
				makeTileset({
					tw: 64,
					th: 96,
					opaque: (x, y) => {
						return inBlock(x, y, 64, 96, 64, 32);
					},
				}),
			],
			layers: [{ data: all(3, 3) }],
		};
	},
	staggered: () => {
		return {
			orientation: "staggered",
			cols: 3,
			rows: 5,
			tw: 64,
			th: 32,
			tilesets: [
				makeTileset({
					tw: 64,
					th: 80,
					extra: { tileoffset: { x: -20, y: 0 } },
				}),
			],
			layers: [{ data: all(3, 5) }],
			extra: { staggeraxis: "y", staggerindex: "odd" },
		};
	},
	hexagonal: () => {
		return {
			orientation: "hexagonal",
			cols: 5,
			rows: 5,
			tw: 28,
			th: 24,
			tilesets: [makeTileset({ tw: 28, th: 60 })],
			layers: [{ data: all(5, 5) }],
			extra: { staggeraxis: "x", staggerindex: "even", hexsidelength: 12 },
		};
	},
};

const VIEWS = [
	[0, 0],
	[30, 20],
	[-45, -60],
];

/**
 * Declare the checks for one renderer.
 * @param {number} renderer - `video.CANVAS`, `video.WEBGL` or `video.WEBGPU`
 * @param {string} type - the `renderer.type` expected
 * @param {string[]} modes - the render modes that renderer has
 */
export function placementChecks(renderer, type, modes) {
	describe(`a tile layer where its ancestors put it (${type})`, () => {
		let app;
		beforeAll(async () => {
			app = await makeApp(renderer, type, WIDTH, HEIGHT);
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

		for (const [orientation, build] of Object.entries(SCENES)) {
			it(`${orientation}: a map centred in the view keeps the tiles that reach past its grid`, async (ctx) => {
				need(ctx);
				const scene = build();
				let total = 0;
				for (const mode of modes) {
					const layers = show(
						app,
						makeMap(scene),
						mode === "prerender" ? mode : undefined,
						true,
					);
					const { x: ox, y: oy } = app.world.pos;
					// smaller than the view: centred, by moving the world
					expect(ox, "centred across").toBeGreaterThan(0);
					expect(oy, "centred down").toBeGreaterThan(0);
					for (const [x, y] of VIEWS) {
						app.viewport.moveTo(x, y);
						const { frame } = await drawIn(app, layers, mode);
						const ref = reference(scene, x - ox, y - oy, WIDTH, HEIGHT);
						const d = diff(ref, frame);
						expect(d.different, `${mode}, view (${x}, ${y}): ${d.first}`).toBe(
							0,
						);
						total += drawn(frame);
					}
				}
				expect(total).toBeGreaterThan(0);
			});

			for (const [gx, gy] of [
				[120, 80],
				[-700, 900],
			]) {
				it(`${orientation}: in a container moved to (${gx}, ${gy})`, async (ctx) => {
					need(ctx);
					const scene = build();
					let total = 0;
					for (const mode of modes) {
						app.world.reset();
						app.world.pos.set(0, 0, app.world.pos.z);
						app.renderer.reset?.();
						app.renderer.backgroundColor.setColor(16, 24, 48);
						const map = makeMap(scene);
						const layers = map.getLayers();
						if (mode === "prerender") {
							layers[0].renderMode = mode;
						}
						const group = new Container();
						group.pos.set(gx, gy, 0);
						app.world.addChild(group);
						map.addTo(group, true, false);
						app.world.sortNow(true);
						app.viewport.setBounds(-100000, -100000, 200000, 200000);
						for (const [x, y] of VIEWS) {
							// the view follows the container
							app.viewport.moveTo(x + gx, y + gy);
							const { frame } = await drawIn(app, layers, mode);
							const ref = reference(scene, x, y, WIDTH, HEIGHT);
							const d = diff(ref, frame);
							expect(
								d.different,
								`${mode}, view (${x}, ${y}): ${d.first}`,
							).toBe(0);
							total += drawn(frame);
						}
					}
					expect(total).toBeGreaterThan(0);
				});
			}
		}

		if (type !== "CANVAS") {
			it("both paths, centred: the same as the reference", async (ctx) => {
				need(ctx);
				for (const build of Object.values(SCENES)) {
					const scene = build();
					const layers = show(app, makeMap(scene), undefined, true);
					expect(layers[0].renderMode).toBe("shader");
					const origin = [app.world.pos.x, app.world.pos.y];
					expect(
						await comparePaths(app, scene, { views: VIEWS, layers, origin }),
						scene.orientation,
					).toBeGreaterThan(0);
				}
			});

			describe("a render mode switched by hand, and tiles set in between", () => {
				const two = (orientation) => {
					const scene = SCENES[orientation]();
					const [first] = scene.tilesets;
					scene.tilesets = [
						first,
						makeTileset({ tw: first.tilewidth, th: first.tileheight }),
					];
					return scene;
				};

				for (const orientation of ["isometric", "staggered", "hexagonal"]) {
					it(`${orientation}: a tile of another tileset set while the layer was drawn tile by tile`, async (ctx) => {
						need(ctx);
						const scene = two(orientation);
						const layers = show(app, makeMap(scene));
						const layer = layers[0];
						expect(layer.renderMode).toBe("shader");
						layer.renderMode = "perTile";
						// no warning: nothing is moved off the GPU path now
						const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
						scene.layers[0].data[1 * scene.cols + 1] = 11;
						layer.setTile(layer.getTileById(11, 1, 1), 1, 1);
						expect(warn).not.toHaveBeenCalled();
						warn.mockRestore();
						// asked for the GPU path again: the layer has tiles of
						// two tilesets, and is drawn tile by tile, whole
						app.viewport.moveTo(0, 0);
						const forced = await drawIn(app, layers, "shader");
						expect(forced.cpuDraws).toBe(1);
						const d = diff(reference(scene, 0, 0, WIDTH, HEIGHT), forced.frame);
						expect(d.different, d.first).toBe(0);
					});
				}

				it("orthogonal: a tile not square, flipped diagonally, set while the layer was drawn tile by tile", async (ctx) => {
					need(ctx);
					const scene = SCENES.orthogonal();
					const layers = show(app, makeMap(scene));
					const layer = layers[0];
					expect(layer.renderMode).toBe("shader");
					app.viewport.moveTo(0, 0);
					layer.renderMode = "perTile";
					layer.setTile(layer.getTileById(3 + FLIP_AD, 1, 1), 1, 1);
					const cpu = await drawIn(app, layers, "perTile");
					// asked for the GPU path again: still tile by tile, and the
					// same picture
					const forced = await drawIn(app, layers, "shader");
					expect(forced.cpuDraws).toBe(1);
					expect(diff(cpu.frame, forced.frame).different).toBe(0);
					expect(drawn(forced.frame)).toBeGreaterThan(0);
				});
			});
		}
	});
}
