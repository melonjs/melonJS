import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	FadeEffect,
	PixelateEffect,
	PixelateTransitionEffect,
	Stage,
	state,
	VignetteEffect,
	video,
} from "../src/index.js";

/**
 * The pixelate transition: the frame breaks up into blocks growing to `size`
 * pixels, the state changes behind the largest of them, and the frame comes
 * back sharp. It drives a PixelateEffect FIRST in the camera's post-effect
 * chain for as long as it runs, and falls back to a fade where shaders do
 * not run (the Canvas renderer).
 */
const pixelates = (camera) =>
	camera.postEffects.filter((fx) => fx instanceof PixelateEffect);
const transitions = (camera) =>
	camera.cameraEffects.filter((fx) => fx instanceof PixelateTransitionEffect);

/**
 * a state of its own, entered at once: a fresh application only has a camera
 * once a stage gives it one, and changing to the current state does nothing
 */
let nextState = state.USER + 60;
const newState = () => {
	const id = nextState++;
	state.set(id, new Stage());
	return id;
};

/** let the effect's tween run for `ms` of game time, then update the effect */
const run = async (effect, ms) => {
	await new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
	effect.update();
};

describe("PixelateTransitionEffect", () => {
	let app;

	beforeEach(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.WEBGL,
		});
		await app.init();
		state.change(newState(), true);
	});

	afterEach(() => {
		state.transition("fade", "#000", 0);
		// browsers cap live contexts — a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	it("puts its pixelate effect first in the camera's chain", () => {
		const camera = app.viewport;
		const vignette = camera.addPostEffect(new VignetteEffect(app.renderer));
		const effect = new PixelateTransitionEffect(camera, {
			renderer: app.renderer,
			duration: 50,
		});
		expect(camera.postEffects[0]).toBe(effect.effect);
		expect(camera.postEffects[1]).toBe(vignette);
		effect.destroy();
		expect(pixelates(camera)).toHaveLength(0);
		expect(camera.postEffects).toEqual([vignette]);
	});

	it("hides: from a sharp frame to the largest blocks, once complete", async () => {
		const onComplete = vi.fn();
		const effect = new PixelateTransitionEffect(app.viewport, {
			renderer: app.renderer,
			size: 24,
			duration: 60,
			direction: "hide",
			onComplete,
		});
		effect.update();
		expect(effect.effect.size).toBe(1);
		await vi.waitFor(
			() => {
				effect.update();
				expect(effect.isComplete).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(effect.effect.size).toBe(24);
		// once, however many times it is updated after
		effect.update();
		effect.update();
		expect(onComplete).toHaveBeenCalledTimes(1);
		effect.destroy();
	});

	it("reveals: from the largest blocks back to a sharp frame", async () => {
		const effect = new PixelateTransitionEffect(app.viewport, {
			renderer: app.renderer,
			size: 16,
			duration: 60,
			direction: "reveal",
		});
		effect.update();
		expect(effect.effect.size).toBe(16);
		await vi.waitFor(
			() => {
				effect.update();
				expect(effect.isComplete).toBe(true);
			},
			{ timeout: 3000 },
		);
		expect(effect.effect.size).toBe(1);
		effect.destroy();
	});

	it("grows in whole pixels", async () => {
		const effect = new PixelateTransitionEffect(app.viewport, {
			renderer: app.renderer,
			size: 9,
			duration: 200,
		});
		await run(effect, 60);
		expect(Number.isInteger(effect.effect.size)).toBe(true);
		effect.destroy();
	});

	it("can be destroyed twice", () => {
		const effect = new PixelateTransitionEffect(app.viewport, {
			renderer: app.renderer,
		});
		effect.destroy();
		expect(() => effect.destroy()).not.toThrow();
	});

	it("covers, changes state, reveals, and leaves the camera as it was", async () => {
		const camera = app.viewport;
		const before = [...camera.postEffects];
		const next = newState();
		state.transition("pixelate", "#000", 60, 20);
		state.setTransition(next, true);
		state.change(next);

		// covering, the blocks first in the chain
		expect(transitions(camera)).toHaveLength(1);
		expect(transitions(camera)[0].size).toBe(20);
		expect(camera.postEffects[0]).toBeInstanceOf(PixelateEffect);

		await vi.waitFor(
			() => {
				expect(state.isCurrent(next)).toBe(true);
			},
			{ timeout: 5000 },
		);
		// then revealing, and gone once sharp again
		await vi.waitFor(
			() => {
				expect(transitions(app.viewport)).toHaveLength(0);
				expect(pixelates(app.viewport)).toHaveLength(0);
			},
			{ timeout: 5000 },
		);
		expect(app.viewport.postEffects).toEqual(before);
	});

	it("takes the size of the largest blocks as its last argument", async () => {
		const next = newState();
		state.transition("pixelate", "#000", 50, 12);
		state.setTransition(next, true);
		state.change(next);
		expect(transitions(app.viewport)[0].size).toBe(12);
		// let it run its course, so it does not outlive this application
		await vi.waitFor(
			() => {
				expect(state.isCurrent(next)).toBe(true);
				expect(transitions(app.viewport)).toHaveLength(0);
			},
			{ timeout: 5000 },
		);
	});
});

describe("pixelate transition on the Canvas renderer", () => {
	let app;

	beforeEach(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
		state.change(newState(), true);
	});

	afterEach(() => {
		state.transition("fade", "#000", 0);
		app?.destroy();
	});

	it("fades in its color instead", () => {
		const next = newState();
		state.transition("pixelate", "#123456", 50);
		state.setTransition(next, true);
		state.change(next);
		expect(transitions(app.viewport)).toHaveLength(0);
		expect(
			app.viewport.cameraEffects.some((fx) => fx instanceof FadeEffect),
		).toBe(true);
	});
});
