import { afterEach, describe, expect, it, vi } from "vitest";
import { Application, event, Renderable } from "../src/index.js";
import timer from "../src/system/timer.ts";

/**
 * The fixed-timestep loop steps the world once the time it has saved up (the
 * accumulator, capped at `accumulatorMax`, ten steps) reaches the cost of a
 * step: one step's worth, or how long the last update really took, which is
 * what keeps a scene too heavy for real time from spiralling.
 *
 * One update slower than the cap used to stop the game for good: the next step
 * then needed more saved time than the cap allows, so none came, and nothing
 * measured the cost again to lower it. A first update doing a lot of one-time
 * work is enough, and since 20.12 the first frame of every state takes a step,
 * so a game could freeze on its first frame (the After Burner example did,
 * showing a text it had already removed).
 *
 * A step is now never more than the cap away: after a slow update the game
 * steps again as soon as the cap's worth of time has passed, and runs at full
 * speed as soon as its updates are cheap again.
 */

const makeApp = async () => {
	const app = new Application(64, 64, { physics: { adapter: "builtin" } });
	await app.init();
	// as `updateFrameRate()` sets it once the app is sized
	app.accumulatorMax = app.stepSize * 10;
	// past the first frame, which takes a step of its own
	app._stepOwed = false;
	app.accumulator = 0;
	app.frameCounter = 0;
	return app;
};

/** run `frames` frames, each `ms` of real time apart; how many steps ran */
const run = (app, frames, ms = app.stepSize) => {
	const step = vi.spyOn(app.world, "update");
	const delta = vi.spyOn(timer, "getDelta").mockReturnValue(ms);
	try {
		for (let i = 0; i < frames; i++) {
			app.update(performance.now());
		}
		return step.mock.calls.length;
	} finally {
		delta.mockRestore();
		step.mockRestore();
	}
};

/** a renderable whose update burns `ms` of real time, `times` times */
const slowChild = (ms, times = 1) => {
	const hog = new Renderable(0, 0, 8, 8);
	let left = times;
	hog.alwaysUpdate = true;
	hog.update = () => {
		if (left > 0) {
			left--;
			const t0 = performance.now();
			while (performance.now() - t0 < ms) {
				// spin
			}
		}
		return false;
	};
	return hog;
};

describe("Application: a slow update does not stop the game loop", () => {
	let app;

	afterEach(() => {
		app?.destroy();
		app = undefined;
	});

	it("after a step that cost more than the cap, the world is stepped again", async () => {
		app = await makeApp();
		app.lastUpdateDelta = app.accumulatorMax * 2;
		expect(run(app, 30)).toBeGreaterThan(0);
	});

	it("and runs at full speed again once its updates are cheap", async () => {
		app = await makeApp();
		app.lastUpdateDelta = app.accumulatorMax * 2;
		// it waits for the cap's worth of time, then one step measures a
		// cheap update and the loop is back to one step a frame
		run(app, 30);
		expect(run(app, 20)).toBeGreaterThanOrEqual(19);
	});

	it("a real update slower than the cap, on the first frame of a state, does not freeze it", async () => {
		app = await makeApp();
		app.world.addChild(slowChild(app.accumulatorMax + 40));
		// what a state change leaves: the next frame takes a step, however
		// short it is (`Application#reset`)
		app._stepOwed = true;
		const first = run(app, 1, 1);
		expect(first).toBe(1);
		expect(app.lastUpdateDelta).toBeGreaterThan(app.accumulatorMax);
		// the game goes on
		expect(run(app, 60)).toBeGreaterThan(40);
	});

	it("the same, for a slow update in the middle of a game", async () => {
		app = await makeApp();
		app.world.addChild(slowChild(app.accumulatorMax + 40));
		expect(run(app, 1)).toBe(1);
		expect(app.lastUpdateDelta).toBeGreaterThan(app.accumulatorMax);
		expect(run(app, 60)).toBeGreaterThan(40);
	});

	// the spiral-of-death guard is kept
	it("a step costing more than a step still drains the accumulator by its real cost", async () => {
		app = await makeApp();
		app.lastUpdateDelta = app.stepSize * 3;
		app.accumulator = app.stepSize;
		app.update(performance.now());
		expect(app.accumulatorUpdateDelta).toBeCloseTo(app.stepSize * 3, 5);
	});

	it("a step costing three steps runs about once every three frames, not every frame", async () => {
		app = await makeApp();
		app.lastUpdateDelta = app.stepSize * 3;
		// no real work: hold the measured cost where it is
		const hold = () => {
			app.lastUpdateDelta = app.stepSize * 3;
		};
		event.on(event.GAME_AFTER_UPDATE, hold);
		try {
			const steps = run(app, 30);
			expect(steps).toBeGreaterThanOrEqual(8);
			expect(steps).toBeLessThanOrEqual(11);
		} finally {
			event.off(event.GAME_AFTER_UPDATE, hold);
		}
	});

	it("an ordinary game steps once a frame", async () => {
		app = await makeApp();
		expect(run(app, 30)).toBeGreaterThanOrEqual(29);
	});
});
