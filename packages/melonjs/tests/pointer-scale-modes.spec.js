import { afterEach, describe, expect, it } from "vitest";
import { Application, boot, video } from "../src/index.js";

/**
 * No scale method introduces a world offset.
 *
 * #1605 changes the coordinate space used for pointer hit tests, but only
 * when `world.pos` is non-zero. That matters for the blast radius: if a scale
 * method set the offset, every game using that method would take the new
 * path. Nothing in the engine does — `world.pos` is moved by GAME code, to
 * centre a level — and these pin it, so an ordinary game keeps taking the
 * original path in every mode.
 *
 * Deliberately NOT asserted here: that a click lands on a region under each
 * mode. These modes call `renderer.resize()` against the parent element, and
 * in a headless harness that parent has no meaningful size (the canvas comes
 * out at sizes like 800x1731), so such a test measures the harness rather
 * than the engine. Verified separately instead: the behaviour under every
 * mode is byte-identical before and after #1605.
 */
const METHODS = [
	"fit",
	"fill-min",
	"fill-max",
	"flex",
	"flex-width",
	"flex-height",
	"stretch",
];

describe("scale methods and the world offset", () => {
	let app;

	afterEach(() => {
		app?.destroy();
		app = undefined;
	});

	it.for(METHODS)("%s leaves world.pos at the origin", async (scaleMethod) => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scaleMethod,
			renderer: video.CANVAS,
		});
		await app.init();

		expect(app.world.pos.x, `${scaleMethod} shifted the world on x`).toBe(0);
		expect(app.world.pos.y, `${scaleMethod} shifted the world on y`).toBe(0);

		// and a resize must not introduce one either — that is the path the
		// bug report came in through
		app.resize(1024, 768);
		expect(app.world.pos.x, `${scaleMethod} shifted the world on resize`).toBe(
			0,
		);
		expect(app.world.pos.y, `${scaleMethod} shifted the world on resize`).toBe(
			0,
		);
	});
});
