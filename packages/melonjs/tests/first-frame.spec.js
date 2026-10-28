import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	event,
	level,
	Renderable,
	Stage,
	state,
	timer,
	video,
} from "../src/index.js";
import GLTFScene from "../src/level/gltf/GLTFScene.js";

/**
 * The first frame of a world that was just built (a stage starting, a level
 * loaded while the game runs) shows it.
 *
 * It showed the background alone. A step is where each object learns whether
 * a camera sees it, an object that has not is not drawn, and that first frame
 * took no step: the game clock is reset when the state starts, so the frame
 * was always shorter than a step. Every stage started with one frame of its
 * background, on every renderer, hidden only behind a transition's cover.
 */

/** a renderable that counts the times it is drawn */
class Probe extends Renderable {
	constructor() {
		super(100, 100, 32, 32);
		this.drawn = 0;
	}

	draw() {
		this.drawn++;
	}
}

/** what the probe holds on the first frame drawn once `ready()` holds */
const onFirstFrame = (ready, read) => {
	return new Promise((resolve) => {
		const onDraw = () => {
			if (ready()) {
				event.off(event.GAME_AFTER_DRAW, onDraw);
				resolve(read());
			}
		};
		event.on(event.GAME_AFTER_DRAW, onDraw);
	});
};

describe("the first frame of a new world", () => {
	let app;

	beforeEach(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
	});

	afterEach(() => {
		state.change(state.DEFAULT, true);
		app?.destroy();
	});

	describe("in the running game", () => {
		const STAGE = state.USER + 40;

		it("shows what the stage built, on the frame the stage starts", async () => {
			let probe;
			state.set(
				STAGE,
				new Stage({
					onResetEvent(game) {
						probe = new Probe();
						game.world.addChild(probe);
					},
				}),
			);
			state.setTransition(STAGE, false);
			const drawn = onFirstFrame(
				() => {
					return state.isCurrent(STAGE);
				},
				() => {
					return probe.drawn;
				},
			);
			state.change(STAGE, true);
			expect(await drawn).toBe(1);
		});

		it("shows a level loaded while the game runs, on the frame it resumes", async () => {
			const probe = new Probe();
			const addTo = vi
				.spyOn(GLTFScene.prototype, "addTo")
				.mockImplementation((container) => {
					container.addChild(probe);
				});
			try {
				level.add("gltf", "first-frame-level");
				state.restart();
				let loaded = false;
				const drawn = onFirstFrame(
					() => {
						return loaded;
					},
					() => {
						return probe.drawn;
					},
				);
				await level.load("first-frame-level", {
					container: app.world,
					async: true,
				});
				loaded = true;
				expect(addTo).toHaveBeenCalledTimes(1);
				expect(await drawn).toBe(1);
			} finally {
				addTo.mockRestore();
			}
		});
	});

	describe("step by step", () => {
		/** the time the game clock reads, after a reset */
		let now;
		let steps;

		beforeEach(() => {
			// stepped by hand from here: no frame of the running loop in between
			state.stop();
			// sized here as a stage start does (see `Application#reset`)
			app.updateFrameRate();
			timer.reset();
			now = timer.now;
			// a frame for the world the app started with, which may not have
			// had its first yet
			now += 1;
			app.update(now);
			steps = vi.spyOn(app.world, "update");
		});

		afterEach(() => {
			steps.mockRestore();
			timer.maxfps = 60;
		});

		/** one frame, `ms` after the last one */
		const frame = (ms) => {
			now += ms;
			app.update(now);
			return steps.mock.calls.length;
		};

		it("takes no step on a frame shorter than one, as before", () => {
			// what makes the next test mean anything: these frames are short
			expect(frame(1)).toBe(0);
			expect(frame(app.stepSize * 0.5)).toBe(0);
		});

		it("takes one step on its first frame however short it is", () => {
			app.reset();
			expect(frame(1)).toBe(1);
		});

		it("takes one only: the frames after are as they would be", () => {
			app.reset();
			expect(frame(1)).toBe(1);
			// not paid back: a whole step later is a step, not a frame owed
			expect(frame(app.stepSize * 1.5)).toBe(2);
			expect(frame(app.stepSize * 0.25)).toBe(2);
			expect(frame(app.stepSize * 0.5)).toBe(3);
		});

		it("takes it on a frame the frame skipping would skip", () => {
			// an update every other frame
			timer.maxfps = 30;
			app.reset();
			expect(app.frameRate).toBe(2);
			expect(frame(1)).toBe(1);
		});
	});
});
