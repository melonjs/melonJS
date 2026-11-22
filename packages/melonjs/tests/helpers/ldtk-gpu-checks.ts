import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	type LDtkLevel,
	type LDtkProject,
	level,
	PlacedTileLayer,
	Renderer,
	state,
	TileLayer,
	Tileset,
	type video,
} from "../../src/index.js";
import {
	diff,
	enter,
	HEIGHT,
	loadSamples,
	referenceLevel,
	referenceView,
	SAMPLES,
	WIDTH,
} from "./ldtk-harness.ts";
import { grabFrame } from "./pixels.js";

/**
 * The tile layers of an LDtk level are the engine's own, so the GPU draws
 * them as it does a Tiled map's: one quad a layer, no loop over the tiles.
 * A right picture does not show that (the loop draws the same one), so this
 * checks the path itself, for every level of every sample: each grid layer
 * says it is on the shader path, the tile-by-tile path is not taken once,
 * the GPU tile renderer draws each layer in view, and only the tiles that
 * fit no grid are drawn one by one.
 * @param renderer - the renderer to ask for
 * @param type - what its `type` starts with
 * @param tolerance - the largest difference of a channel that is not counted
 */
export function gpuChecks(
	renderer: typeof video.WEBGL | typeof video.WEBGPU,
	type: string,
	tolerance: number,
) {
	describe(`LDtk levels on the GPU tile renderer, ${type}`, () => {
		let app: Application | null = null;
		let projects: Map<string, LDtkProject>;

		beforeAll(async () => {
			// no frame of the engine's own: a test draws each one
			vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
				return 1;
			});
			vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
				// nothing to cancel
			});
			boot();
			try {
				app = new Application(WIDTH, HEIGHT, {
					parent: "screen",
					renderer,
					consoleHeader: false,
					antiAlias: false,
					failIfMajorPerformanceCaveat: false,
				});
				await app.init();
			} catch {
				app = null;
			}
			if (app !== null && !app.renderer.type.startsWith(type)) {
				app.destroy();
				app = null;
			}
			if (app !== null) {
				state.change(state.DEFAULT, true);
				projects = await loadSamples();
			}
		});

		afterAll(() => {
			app?.destroy();
		});

		for (const sample of SAMPLES) {
			it(`${sample}: every grid layer drawn by the GPU, none tile by tile`, async (ctx) => {
				if (app === null) {
					ctx.skip(`${type} is not available in this environment`);
					return;
				}
				const game = app;
				const project = projects.get(sample) as LDtkProject;
				let grids = 0;
				let placedTotal = 0;
				let allTiles = 0;
				for (const info of project.levels) {
					await enter(game, info.id, { objects: false });
					game.viewport.moveTo(0, 0);
					const layers = (level.getCurrentLevel() as unknown as LDtkLevel)
						.layers;
					const tileLayers = layers.filter((layer) => {
						return layer instanceof TileLayer;
					});
					const placed = layers.filter((layer) => {
						return layer instanceof PlacedTileLayer;
					});

					// the tile-by-tile path of a tile layer, and a tile drawn alone
					const cpu = vi.spyOn(Renderer.prototype, "drawTileLayer");
					const single = vi.spyOn(Tileset.prototype, "drawTileRaw");
					game.world.update(16);
					game.viewport.update(16);
					game.repaint();
					game.draw();
					const cpuDraws = cpu.mock.calls.length;
					const singles = single.mock.calls.length;
					cpu.mockRestore();
					single.mockRestore();
					const actual = (await grabFrame(game.renderer)).data;

					// every grid layer resolved to the shader path at activation
					for (const layer of tileLayers) {
						expect(
							layer.renderMode,
							`${info.identifier}: layer "${layer.name}"`,
						).toBe("shader");
					}
					// and was drawn there: the fallback was not taken once
					expect(cpuDraws, `${info.identifier}: tile-by-tile draws`).toBe(0);
					// only the tiles that fit no grid are drawn one by one
					let placedTiles = 0;
					for (const layer of placed) {
						placedTiles += layer.length;
					}
					expect(singles).toBeLessThanOrEqual(placedTiles);

					// what is on screen is the level, so the GPU drew it
					const x = Math.max(0, Math.trunc((WIDTH - info.width) / 2));
					const y = Math.max(0, Math.trunc((HEIGHT - info.height) / 2));
					const result = diff(
						actual,
						referenceView(
							info.bgColor,
							[
								{
									picture: referenceLevel(project.json, info.json, false),
									x,
									y,
								},
							],
							0,
							0,
						),
						tolerance,
					);
					const scaled = typeof info.json.bgRelPath === "string";
					expect(
						result.different,
						`${info.identifier}: ${result.first} (worst ${String(result.worst)})`,
					).toBeLessThanOrEqual(scaled ? WIDTH * HEIGHT * 0.04 : 0);

					grids += tileLayers.length;
					for (const layer of info.json.layerInstances ?? []) {
						allTiles += layer.gridTiles.length + layer.autoLayerTiles.length;
					}
					placedTotal += placedTiles;
				}
				// most of what a level holds is on the GPU path
				if (allTiles > 0) {
					expect(grids).toBeGreaterThan(0);
					expect((allTiles - placedTotal) / allTiles).toBeGreaterThan(0.5);
				}
			});
		}

		it("a grid layer of an LDtk level is one draw of the GPU tile renderer", async (ctx) => {
			if (app === null) {
				ctx.skip(`${type} is not available in this environment`);
				return;
			}
			const game = app;
			await enter(game, "Typical_TopDown_example:World_Level_0", {
				objects: false,
			});
			game.viewport.moveTo(0, 0);
			const layers = (level.getCurrentLevel() as unknown as LDtkLevel).layers;
			const tileLayers = layers.filter((layer) => {
				return layer instanceof TileLayer;
			});
			expect(tileLayers.length).toBeGreaterThanOrEqual(4);
			// what the renderer is asked to draw a tile layer with
			const asked = vi.spyOn(game.renderer, "drawTileLayer");
			const cpu = vi.spyOn(Renderer.prototype, "drawTileLayer");
			game.world.update(16);
			game.viewport.update(16);
			game.repaint();
			game.draw();
			// once a layer, each handed to the GPU and none passed on
			expect(asked).toHaveBeenCalledTimes(tileLayers.length);
			expect(cpu).not.toHaveBeenCalled();
			expect(
				asked.mock.calls.map((call) => {
					return call[0];
				}),
			).toEqual(tileLayers);
			asked.mockRestore();
			cpu.mockRestore();
		});

		it("a layer asked to be drawn tile by tile is, and shows the same level", async (ctx) => {
			if (app === null) {
				ctx.skip(`${type} is not available in this environment`);
				return;
			}
			const game = app;
			const draw = async () => {
				game.world.update(16);
				game.viewport.update(16);
				game.repaint();
				const cpu = vi.spyOn(Renderer.prototype, "drawTileLayer");
				game.draw();
				const calls = cpu.mock.calls.length;
				cpu.mockRestore();
				return { calls, data: (await grabFrame(game.renderer)).data };
			};
			await enter(game, "Typical_TopDown_example:World_Level_0", {
				objects: false,
			});
			game.viewport.moveTo(0, 0);
			const onGpu = await draw();
			expect(onGpu.calls).toBe(0);
			const tileLayers = (
				level.getCurrentLevel() as unknown as LDtkLevel
			).layers.filter((layer) => {
				return layer instanceof TileLayer;
			});
			for (const layer of tileLayers) {
				layer.renderMode = "perTile";
			}
			const onCpu = await draw();
			expect(onCpu.calls).toBe(tileLayers.length);
			// the two paths draw the same level
			const result = diff(onGpu.data, onCpu.data, tolerance);
			expect(result.different, result.first).toBe(0);
		});
	});
}
