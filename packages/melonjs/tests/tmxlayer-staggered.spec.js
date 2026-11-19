/**
 * Staggered and hexagonal maps drawn tile by tile, and baked into one image,
 * on the Canvas renderer: held to the picture Tiled draws (a tile stands on
 * its cell and follows its tileset's `tileoffset`, as on every other map).
 * The GPU renderers are held to the same in
 * `helpers/tile-layer-staggered-scenarios.js`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { video } from "../src/index.js";
import {
	diff,
	drawIn,
	drawn,
	makeApp,
	makeMap,
	reference,
	show,
} from "./helpers/tile-layer-compare.js";
import {
	HEIGHT,
	STAGGERED_SCENES,
	STAGGERED_VIEWS,
	WIDTH,
} from "./helpers/tile-layer-staggered-scenarios.js";

describe("staggered and hexagonal maps, as Tiled draws them (Canvas renderer)", () => {
	let app;
	beforeAll(async () => {
		app = await makeApp(video.CANVAS, "CANVAS", WIDTH, HEIGHT);
	});
	afterAll(() => {
		app?.destroy();
		vi.restoreAllMocks();
	});

	for (const { label, scene: build } of STAGGERED_SCENES) {
		it(label, async () => {
			const scene = build();
			let total = 0;
			for (const mode of ["perTile", "prerender"]) {
				const layers = show(app, makeMap(scene), mode);
				for (const [x, y] of STAGGERED_VIEWS) {
					app.viewport.moveTo(x, y);
					const { frame } = await drawIn(app, layers, mode);
					const d = diff(reference(scene, x, y, WIDTH, HEIGHT), frame);
					expect(d.different, `${mode}, view (${x}, ${y}): ${d.first}`).toBe(0);
					total += drawn(frame);
				}
			}
			expect(total).toBeGreaterThan(0);
		});
	}
});
