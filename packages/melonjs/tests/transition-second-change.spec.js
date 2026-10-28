import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Ellipse,
	event,
	FadeEffect,
	MaskEffect,
	PixelateTransitionEffect,
	Stage,
	state,
	video,
} from "../src/index.js";

/**
 * A `state.change()` asked for while a transition covers the screen (#1787).
 *
 * Each change used to start a cover of its own, and keep what takes it down
 * in one slot that the next change overwrote: two changes in a row left the
 * first cover on the camera for good, the screen black or in big blocks over
 * a game still running. A second change now takes the transition already
 * covering the screen to its own state, so the last change asked for wins,
 * as it does without a transition.
 */

const DURATION = 60;
// Generous: a covering transition advances on animation frames, and under a
// full parallel run the browser can go seconds without giving this page one.
const WAIT = { timeout: 15000 };
const covers = {
	fade: FadeEffect,
	mask: MaskEffect,
	pixelate: PixelateTransitionEffect,
};

let nextState = state.USER + 80;

describe.each([
	["fade", video.CANVAS],
	["mask", video.CANVAS],
	["pixelate", video.WEBGL],
])("a second change during a %s transition", (type, renderer) => {
	let app;
	let resets;
	let start;

	/** a state of its own, which logs its resets and their arguments */
	const newState = (name) => {
		const id = nextState++;
		state.set(
			id,
			new Stage({
				onResetEvent(_app, ...args) {
					resets.push([name, ...args]);
				},
			}),
		);
		state.setTransition(id, true);
		return id;
	};

	/** the transition's effects on the camera: covers and reveals */
	const effects = (camera = app.viewport) => {
		return camera.cameraEffects.filter((fx) => {
			return fx instanceof covers[type];
		});
	};

	/**
	 * wait until `id` is the state with nothing left over the screen: no
	 * camera effect at all, the transition's own or any other
	 */
	const settlesOn = async (id) => {
		await vi.waitFor(() => {
			expect(state.isCurrent(id)).toBe(true);
			expect(app.viewport.cameraEffects).toHaveLength(0);
		}, WAIT);
		// and stays so: a cover left behind is persistent, and outlives
		// the reveal that would otherwise be the last effect to go
		await new Promise((resolve) => {
			setTimeout(resolve, DURATION * 3);
		});
		expect(state.isCurrent(id)).toBe(true);
		expect(app.viewport.cameraEffects).toHaveLength(0);
	};

	beforeEach(async () => {
		resets = [];
		boot();
		app = new Application(320, 240, { parent: "screen", renderer });
		await app.init();
		start = newState("start");
		state.setTransition(start, false);
		state.change(start, true);
		resets.length = 0;
		state.transition(
			type,
			"#000",
			DURATION,
			type === "mask" ? new Ellipse(0, 0, 1, 1) : undefined,
		);
	});

	afterEach(() => {
		state.transition("fade", "#000", 0);
		app?.destroy();
	});

	it("ends on the second, with the screen uncovered", async () => {
		const a = newState("a");
		const b = newState("b");
		state.change(a);
		state.change(b);
		// one cover, not one per change
		expect(effects()).toHaveLength(1);
		await settlesOn(b);
		// straight to the last state asked for
		expect(resets).toEqual([["b"]]);
	});

	it("ends on the second when it comes while the cover comes down", async () => {
		const a = newState("a");
		const b = newState("b");
		state.change(a);
		await new Promise((resolve) => {
			setTimeout(resolve, DURATION / 2);
		});
		expect(state.isCurrent(a)).toBe(false);
		state.change(b);
		expect(effects()).toHaveLength(1);
		await settlesOn(b);
		expect(resets).toEqual([["b"]]);
	});

	it("changes once when asked twice for the same state", async () => {
		const a = newState("a");
		state.change(a);
		state.change(a);
		expect(effects()).toHaveLength(1);
		await settlesOn(a);
		expect(resets).toEqual([["a"]]);
	});

	it("passes the arguments of the last change", async () => {
		const a = newState("a");
		const b = newState("b");
		state.change(a, false, "first");
		state.change(b, false, "second", 2);
		await settlesOn(b);
		expect(resets).toEqual([["b", "second", 2]]);
	});

	it("still ignores a change to the current state", async () => {
		const a = newState("a");
		state.change(a);
		state.change(start);
		await settlesOn(a);
		expect(resets).toEqual([["a"]]);
	});

	it("starts a new transition once the switch is made", async () => {
		const a = newState("a");
		const b = newState("b");
		state.change(a);
		await vi.waitFor(() => {
			expect(state.isCurrent(a)).toBe(true);
		}, WAIT);
		// during a's reveal: a change of its own, with a cover of its own
		state.change(b);
		await settlesOn(b);
		expect(resets).toEqual([["a"], ["b"]]);
	});

	it("makes a change with no transition of its own on the next frame", async () => {
		const a = newState("a");
		const b = newState("b");
		state.setTransition(b, false);
		state.change(a);
		state.change(b);
		// not waiting for the cover, which comes down with it: made by the
		// timer queued before this one
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
		expect(state.isCurrent(b)).toBe(true);
		await settlesOn(b);
		expect(resets).toEqual([["b"]]);
	});

	it("makes a forced change with no transition of its own at once", async () => {
		const a = newState("a");
		const b = newState("b");
		state.setTransition(b, false);
		state.change(a);
		state.change(b, true, "now");
		expect(state.isCurrent(b)).toBe(true);
		await settlesOn(b);
		expect(resets).toEqual([["b", "now"]]);
	});

	it("is made to the last state asked for in the same frame", async () => {
		const a = newState("a");
		const b = newState("b");
		const c = newState("c");
		state.setTransition(b, false);
		state.change(a);
		state.change(b);
		state.change(c);
		await settlesOn(c);
		expect(resets).toEqual([["c"]]);
	});

	it("switches once when the cover completes as such a change is asked for", async () => {
		const a = newState("a");
		const b = newState("b");
		state.setTransition(b, false);
		state.change(a);
		const [cover] = effects();
		// in the frame the cover completes, its switch already queued: on
		// the tick, after the tweens (registered after the cover's), as a
		// fade is completed by its tween, which runs after the frame's update
		const completed = () => {
			return cover instanceof FadeEffect
				? cover.color?.alpha >= 1
				: cover.isComplete;
		};
		let asked = false;
		const onTick = () => {
			if (completed()) {
				event.off(event.TICK, onTick);
				asked = true;
				state.change(b);
			}
		};
		event.on(event.TICK, onTick);
		try {
			await settlesOn(b);
		} finally {
			event.off(event.TICK, onTick);
		}
		// asked while the cover's own switch was queued, not after it
		expect(asked).toBe(true);
		// one switch, not one per request: b is not built twice
		expect(resets).toEqual([["b"]]);
	});

	it("is not held by a cover the game took off", async () => {
		const a = newState("a");
		const b = newState("b");
		state.change(a);
		const [cover] = effects();
		app.viewport.removeCameraEffect(cover);
		// that change is dropped with its cover, as before; this one is not
		state.change(b);
		await settlesOn(b);
		expect(resets).toEqual([["b"]]);
	});
});

describe("a transition left covering by a destroyed application", () => {
	it("holds nothing in the next one", async () => {
		boot();
		const first = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await first.init();
		const start = nextState++;
		const a = nextState++;
		const b = nextState++;
		state.set(start, new Stage());
		state.set(a, new Stage());
		state.set(b, new Stage());
		state.setTransition(start, false);
		state.setTransition(a, true);
		state.setTransition(b, false);
		// a stage first, for the application to have a camera
		state.change(start, true);
		state.transition("fade", "#000", 10000);
		// destroyed under its cover: the cover never completes
		state.change(a);
		first.destroy();

		const app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		try {
			// not taken by the dead transition: switched, directly
			state.change(b);
			await vi.waitFor(() => {
				expect(state.isCurrent(b)).toBe(true);
			}, WAIT);
			// and with no reveal of the dead transition's added to this one
			expect(
				app.viewport.cameraEffects.filter((fx) => {
					return fx instanceof FadeEffect;
				}),
			).toHaveLength(0);
		} finally {
			state.transition("fade", "#000", 0);
			app.destroy();
		}
	});
});
