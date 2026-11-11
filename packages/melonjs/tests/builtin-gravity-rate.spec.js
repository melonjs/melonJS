/**
 * How fast the built-in adapter's default gravity is, in pixels per second².
 *
 * The physics skill and the examples that compare backends convert gravity
 * with this figure (`target / 3600`). It used to be quoted as ~4450, which
 * made the built-in world about a fifth too weak in those comparisons. The
 * default is 0.98 px per step²: each step adds it to the velocity, then the
 * velocity to the position, so a fall from rest covers `0.98 * n(n + 1) / 2`
 * px in `n` steps, and 60 steps make a second.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	BuiltinAdapter,
	boot,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

describe("built-in adapter: default gravity", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	it("falls about 3600 px/s² at 60 steps a second", () => {
		const adapter = new BuiltinAdapter();
		expect(adapter.gravity.y).toBeCloseTo(0.98, 5);
		const world = new World(0, 0, 800, 100000, adapter);
		const box = new Renderable(0, 0, 16, 16);
		box.anchorPoint.set(0, 0);
		box.alwaysUpdate = true;
		box.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 16, 16)] };
		world.addChild(box);

		// one second of steps, from rest
		const steps = 60;
		for (let i = 0; i < steps; i++) {
			world.update(16);
		}
		const fall = box.pos.y;
		expect(fall).toBeCloseTo((0.98 * steps * (steps + 1)) / 2, 0);
		// the distance a constant acceleration covers in 1 s is a / 2
		const pxPerSecond2 = 2 * fall;
		expect(pxPerSecond2).toBeGreaterThan(3500);
		expect(pxPerSecond2).toBeLessThan(3700);
		world.destroy();
	});
});
