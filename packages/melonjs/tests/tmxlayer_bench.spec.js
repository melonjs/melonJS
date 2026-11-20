import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { video } from "../src/index.js";
import TMXTileset from "../src/level/tiled/TMXTileset.js";
import Renderer from "../src/video/renderer.js";
import {
	fill,
	inBlock,
	makeApp,
	makeMap,
	makeTileset,
	show,
} from "./helpers/tile-layer-compare.js";

/**
 * Benchmark of the two ways a tile layer is drawn on WebGL: tile by tile
 * (`renderMode` "perTile", the CPU renderer: a quad per tile in view, each
 * found and placed in JavaScript every frame) against the GPU path
 * ("shader": one quad per layer, the tiles found by the fragment shader),
 * on a map of medium size, orthogonal and isometric (#1897).
 *
 * Read the times as **CPU-side** cost, the main thread's share of a frame:
 * the run happens under a software rasterizer, whose own time is no measure
 * of a graphics card's, and is left out (the frames are timed up to the
 * flush, and the rasterizer is let catch up between runs). What the GPU
 * path takes off the main thread is the walk over the cells in view and a
 * quad for each: its cost does not grow with the number of tiles shown,
 * which is what the wider views show.
 *
 * The canvas is a quarter of the view's size each way, and the camera
 * zoomed out to match: as many tiles are in view, and walked, as in the
 * view named, with a sixteenth of the pixels for the software rasterizer.
 *
 * It runs only when asked for: `BENCH=1 pnpm vitest run --config
 * packages/melonjs/vitest.config.ts tests/tmxlayer_bench.spec.js`, from the
 * repository's root.
 */

const SCALE = 4;
// the views measured: what a camera shows, in pixels of the map
const VIEWS = [
	[1280, 720],
	[2560, 1440],
	[3840, 2160],
];
const SIZE = 100; // cells a side
const FRAMES = 20;
const RUNS = 3;

/** most cells filled, a few holes, as a drawn map has */
const cells = () => {
	return fill(SIZE, SIZE, (c, r) => {
		return (c * 7 + r * 3) % 23 === 0 ? 0 : 1 + ((c * 5 + r * 11) % 8);
	});
};

const MAPS = [
	{
		label: "orthogonal, 32 × 32",
		scene: () => {
			return {
				orientation: "orthogonal",
				cols: SIZE,
				rows: SIZE,
				tw: 32,
				th: 32,
				tilesets: [makeTileset({ tw: 32, th: 32 })],
				layers: [{ data: cells() }],
			};
		},
		// the middle of the map
		center: [(SIZE * 32) / 2, (SIZE * 32) / 2],
	},
	{
		label: "isometric, 64 × 64 on a 64 × 32 grid",
		scene: () => {
			return {
				orientation: "isometric",
				cols: SIZE,
				rows: SIZE,
				tw: 64,
				th: 32,
				tilesets: [
					makeTileset({
						tw: 64,
						th: 64,
						opaque: (x, y) => {
							return inBlock(x, y, 64, 64, 64, 32);
						},
					}),
				],
				layers: [{ data: cells() }],
			};
		},
		center: [(SIZE * 64) / 2, (SIZE * 32) / 2],
	},
];

describe("tile layer benchmark: tile by tile against the GPU path", () => {
	let app;
	beforeAll(async () => {
		app = await makeApp(
			video.WEBGL,
			"WebGL",
			VIEWS[0][0] / SCALE,
			VIEWS[0][1] / SCALE,
		);
	});
	afterAll(() => {
		app?.destroy();
		vi.restoreAllMocks();
	});

	it(`${SIZE} × ${SIZE} maps, three sizes of view`, (ctx) => {
		if (app === null || app === undefined) {
			// a bare return reports as a PASS, so a benchmark that never
			// ran would look identical to one that did
			ctx.skip("WebGL not available: nothing to measure");
			return;
		}
		// Skipped unless asked for, and visibly so: it measures and tests
		// nothing the tile layer specs do not, and it is twenty seconds of
		// every run otherwise.
		if (import.meta.env.VITE_BENCH === "") {
			ctx.skip("benchmark: run it with BENCH=1");
			return;
		}
		const gl = app.renderer.gl;
		const pixel = new Uint8Array(4);
		const frame = () => {
			app.world.update(0);
			app.viewport.update(0);
			app.repaint();
			app.draw();
			app.renderer.flush();
		};
		// let the rasterizer finish what it was sent, outside the timings
		const settle = () => {
			gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
		};
		/** the median time of a frame, in ms */
		const time = () => {
			for (let i = 0; i < 5; i++) {
				frame();
			}
			settle();
			const runs = [];
			for (let run = 0; run < RUNS; run++) {
				const start = performance.now();
				for (let i = 0; i < FRAMES; i++) {
					frame();
				}
				runs.push((performance.now() - start) / FRAMES);
				settle();
			}
			runs.sort((a, b) => {
				return a - b;
			});
			return runs[Math.floor(RUNS / 2)];
		};

		const rows = [];
		for (const { label, scene, center } of MAPS) {
			const layers = show(app, makeMap(scene()));
			expect(layers[0].renderMode).toBe("shader");
			for (const [width, height] of VIEWS) {
				app.viewport.zoom = VIEWS[0][0] / SCALE / width;
				app.viewport.moveTo(center[0] - width / 2, center[1] - height / 2);

				layers[0].renderMode = "perTile";
				const tiles = vi.spyOn(TMXTileset.prototype, "drawTileRaw");
				frame();
				const inView = tiles.mock.calls.length;
				tiles.mockRestore();
				const perTile = time();

				layers[0].renderMode = "shader";
				const cpu = vi.spyOn(Renderer.prototype, "drawTileLayer");
				frame();
				// the GPU path draws alone
				expect(cpu).not.toHaveBeenCalled();
				cpu.mockRestore();
				const shader = time();

				expect(inView).toBeGreaterThan(0);
				rows.push({
					label,
					view: `${width} × ${height}`,
					inView,
					perTile,
					shader,
				});
			}
			app.viewport.zoom = 1;
		}

		const line = "═".repeat(86);
		console.log(`╔${line}╗`);
		console.log(
			`║ ${`TILE LAYER BENCHMARK — ${SIZE} × ${SIZE} map, CPU ms per frame`.padEnd(85)}║`,
		);
		console.log(`╠${line}╣`);
		console.log(
			`║ ${"map".padEnd(36)}${"view".padStart(13)}${"tiles".padStart(8)}${"perTile".padStart(10)}${"shader".padStart(9)}${"ratio".padStart(8)} ║`,
		);
		for (const row of rows) {
			console.log(
				`║ ${row.label.padEnd(36)}${row.view.padStart(13)}${String(row.inView).padStart(8)}${row.perTile.toFixed(3).padStart(10)}${row.shader.toFixed(3).padStart(9)}${`${(row.perTile / row.shader).toFixed(1)}×`.padStart(8)} ║`,
			);
		}
		console.log(`╚${line}╝`);
	});
});
