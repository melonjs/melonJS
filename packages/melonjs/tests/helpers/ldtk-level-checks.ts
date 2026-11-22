import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Application, LDtkProject, video } from "../../src/index.js";
import {
	diff,
	enter,
	frame,
	HEIGHT,
	loadSamples,
	makeApp,
	referenceLevel,
	referenceView,
	SAMPLES,
	WIDTH,
} from "./ldtk-harness.ts";

/**
 * Every level of every sample that comes with LDtk, loaded as a game loads
 * it and drawn, against the same level drawn with the 2D canvas alone from
 * the project file: from its top left corner, its middle and its bottom right
 * corner.
 * @param renderer - the renderer to ask for
 * @param name - its name
 * @param tolerance - the largest difference of a channel that is not counted: what blending rounds by
 */
export function levelChecks(
	renderer: typeof video.CANVAS | typeof video.WEBGL,
	name: string,
	tolerance: number,
) {
	describe(`every level of the LDtk samples, on ${name}`, () => {
		let app: Application;
		let projects: Map<string, LDtkProject>;

		beforeAll(async () => {
			app = await makeApp(renderer);
			projects = await loadSamples();
		});

		afterAll(() => {
			app.destroy();
		});

		for (const sample of SAMPLES) {
			it(`${sample}: each level as LDtk draws it`, async () => {
				const project = projects.get(sample) as LDtkProject;
				expect(project.levels.length).toBeGreaterThan(0);
				let tiles = 0;
				for (const info of project.levels) {
					await enter(app, info.id, { objects: false });
					const picture = referenceLevel(project.json, info.json, false);
					// a level smaller than the view is centred in it
					const x = Math.max(0, Math.trunc((WIDTH - info.width) / 2));
					const y = Math.max(0, Math.trunc((HEIGHT - info.height) / 2));
					const maxX = Math.max(0, info.width - WIDTH);
					const maxY = Math.max(0, info.height - HEIGHT);
					const views = new Map([
						["0,0", [0, 0]],
						[
							`${String(maxX >> 1)},${String(maxY >> 1)}`,
							[maxX >> 1, maxY >> 1],
						],
						[`${String(maxX)},${String(maxY)}`, [maxX, maxY]],
					]);
					for (const [viewX, viewY] of views.values()) {
						app.viewport.moveTo(viewX, viewY);
						const actual = frame(app);
						const expected = referenceView(
							info.bgColor,
							[{ picture, x, y }],
							viewX,
							viewY,
						);
						const result = diff(actual, expected, tolerance);
						// a background image is scaled, and each renderer
						// rounds to the nearest pixel its own way: a few
						// pixels of it may come from the pixel next door
						const scaled = typeof info.json.bgRelPath === "string";
						expect(
							result.different,
							`${info.identifier} from ${String(viewX)}, ${String(viewY)}: ${result.first} (worst ${String(result.worst)})`,
						).toBeLessThanOrEqual(scaled ? WIDTH * HEIGHT * 0.04 : 0);
					}
					for (const layer of info.json.layerInstances ?? []) {
						tiles += layer.gridTiles.length + layer.autoLayerTiles.length;
					}
				}
				// a sample of IntGrid layers alone has no tile to draw
				if (sample !== "SeparateLevelFiles") {
					expect(tiles).toBeGreaterThan(0);
				}
			});
		}
	});
}
