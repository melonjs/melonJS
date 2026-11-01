/**
 * `viewport.fadeIn()` / `fadeOut()` always call `onComplete` (#1810).
 *
 * Driven the way a game runs: each frame is a `TICK`, as the browser loop
 * emits it. The application updates first (its stage updates the camera,
 * which removes the effects that are complete), then the fade's tween steps.
 *
 * A fade used to count as complete once its colour's alpha read as the
 * target. The alpha is a 32-bit float, so on some durations it rounds to
 * the target one step before the tween ends; the camera then removed the
 * fade and stopped the tween before it called `onComplete`. Code waiting on
 * the callback, a scene change say, never ran.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Application, boot, event, FadeEffect, video } from "../src/index.js";

const FRAME = 1000 / 60;

let app;
// the clock the frames are stamped with, moved on by every frame
let now;

/** run one frame of the game loop at 60 fps */
const tick = () => {
	now += FRAME;
	event.emit(event.TICK, now);
};

/**
 * run frames until the camera has no fade left, or a limit
 * @returns the number of frames run
 */
const runFade = () => {
	let frames = 0;
	while (app.viewport.getCameraEffect(FadeEffect) && frames < 400) {
		tick();
		frames++;
	}
	return frames;
};

describe("viewport.fadeIn() / fadeOut() call onComplete (#1810)", () => {
	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		now = globalThis.performance.now();
	});

	it("fadeIn calls onComplete once, then the fade is gone, at every duration", () => {
		const missed = [];
		for (let duration = 100; duration <= 1000; duration += 25) {
			const onComplete = vi.fn();
			app.viewport.fadeIn("#000000", duration, onComplete);
			runFade();
			expect(app.viewport.getCameraEffect(FadeEffect)).toBeUndefined();
			if (onComplete.mock.calls.length !== 1) {
				missed.push(duration);
			}
		}
		expect(missed).toEqual([]);
	});

	it("fadeOut calls onComplete once, then the fade is gone, at every duration", () => {
		const missed = [];
		for (let duration = 100; duration <= 1000; duration += 25) {
			const onComplete = vi.fn();
			app.viewport.fadeOut("#000000", duration, onComplete);
			runFade();
			expect(app.viewport.getCameraEffect(FadeEffect)).toBeUndefined();
			if (onComplete.mock.calls.length !== 1) {
				missed.push(duration);
			}
		}
		expect(missed).toEqual([]);
	});

	it("the issue's case: a scene change chained on fadeIn callbacks reaches its end", () => {
		// as the Alex 4 outro moved from scene to scene in a fadeIn callback
		const scenes = [];
		const next = (n) => {
			scenes.push(n);
			if (n < 4) {
				app.viewport.fadeIn("#000000", 300, () => {
					next(n + 1);
				});
			}
		};
		next(1);
		for (let i = 0; i < 4 && app.viewport.getCameraEffect(FadeEffect); i++) {
			runFade();
		}
		expect(scenes).toEqual([1, 2, 3, 4]);
	});

	it("the fade ends on the frame after its tween does, not before", () => {
		const onComplete = vi.fn();
		app.viewport.fadeIn("#000000", 300, onComplete);
		const fade = app.viewport.getCameraEffect(FadeEffect);
		let frames = 0;
		while (!onComplete.mock.calls.length && frames < 400) {
			// still there for every frame before the callback
			expect(app.viewport.getCameraEffect(FadeEffect)).toBe(fade);
			tick();
			frames++;
		}
		expect(onComplete).toHaveBeenCalledTimes(1);
		// 300 ms is 18 frames at 60 fps
		expect(frames).toBeGreaterThanOrEqual(18);
		tick();
		expect(app.viewport.getCameraEffect(FadeEffect)).toBeUndefined();
	});
});
