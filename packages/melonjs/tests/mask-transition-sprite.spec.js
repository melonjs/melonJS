import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	FadeEffect,
	MaskEffect,
	Sprite,
	Stage,
	state,
	video,
} from "../src/index.js";
import { readPixel } from "./helpers/pixels.js";

/**
 * `state.transition("mask", …, sprite, { center: sprite })` (#1399): the
 * hide closes on the player with the player's own silhouette, and the reveal
 * opens from the same place with the same silhouette, though the state
 * change has destroyed the player in between.
 *
 * And the way to use one for a single change: set it, call `state.change()`,
 * set the usual transition back on the next line.
 */

const DURATION = 60;
const FRAME = 1000 / 60;
const LIMIT = 20000;

// the game loop, run here one frame at a time (see transition-second-change)
let nextFrame = null;
let clock = 0;
const frame = async () => {
	const callback = nextFrame;
	nextFrame = null;
	if (callback !== null) {
		clock += FRAME;
		callback(clock);
	}
	await new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};
const runUntil = async (check) => {
	const end = globalThis.performance.now() + LIMIT;
	while (globalThis.performance.now() < end) {
		try {
			check();
			return;
		} catch {
			await frame();
		}
	}
	check();
};

/** a 20 × 30 image, its left half opaque */
const leftHalf = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 20;
	canvas.height = 30;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#f00";
	ctx.fillRect(0, 0, 10, 30);
	return canvas;
};

/** what is on the camera now, as `Class:direction` */
const effectsOn = (app) => {
	return app.viewport.cameraEffects.map((fx) => {
		return `${fx.constructor.name}:${fx.direction}`;
	});
};

describe("a mask transition shaped like, and closing on, a sprite", () => {
	let app;
	beforeAll(async () => {
		clock = globalThis.performance.now();
		vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
			(callback) => {
				nextFrame = callback;
				return 1;
			},
		);
		vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
			nextFrame = null;
		});
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});
	afterAll(() => {
		state.transition("fade", "#000", 0);
		app?.destroy();
		vi.restoreAllMocks();
	});

	it("the reveal opens where the hide closed, after the player is gone", async () => {
		let player;
		const start = state.USER + 90;
		const next = state.USER + 91;
		state.set(
			start,
			new Stage({
				onResetEvent(game) {
					player = new Sprite(200, 50, { image: leftHalf() });
					player.anchorPoint.set(0, 0);
					game.world.addChild(player);
				},
			}),
		);
		state.set(next, new Stage());
		state.setTransition(start, false);
		state.change(start, true);
		await runUntil(() => {
			expect(state.isCurrent(start)).toBe(true);
			expect(player?.ancestor).toBeDefined();
		});

		state.transition("mask", "#000", DURATION, player, {
			center: player,
			invert: true,
		});
		state.change(next);

		const hide = app.viewport.getCameraEffect(MaskEffect);
		expect(hide.direction).toBe("hide");
		expect(hide.invert).toBe(true);
		expect(hide._silhouette).toBeDefined();
		// the middle of the player's frame
		expect(hide.center).toEqual({ x: 210, y: 65 });
		const silhouette = hide._silhouette.target.canvas;

		// the switch lands, the player goes with the old stage
		let reveal;
		await runUntil(() => {
			expect(state.isCurrent(next)).toBe(true);
			reveal = app.viewport.cameraEffects.find((fx) => {
				return fx instanceof MaskEffect && fx.direction === "reveal";
			});
			expect(reveal).toBeDefined();
		});
		expect(player.offset).toBeUndefined();
		expect(reveal.invert).toBe(true);
		expect(reveal.center).toEqual({ x: 210, y: 65 });
		expect(reveal._silhouette.target.canvas).toBe(silhouette);

		// just before it ends, nothing is covered any more: drawn over white,
		// every corner and the middle read white
		reveal.tween.stop();
		reveal.progress.value = 0.995;
		const renderer = app.renderer;
		renderer.save();
		renderer.resetTransform();
		renderer.setColor("#ffffff");
		renderer.fillRect(0, 0, 320, 240);
		renderer.restore();
		reveal.draw(renderer, 320, 240);
		for (const [x, y] of [
			[1, 1],
			[318, 1],
			[1, 238],
			[318, 238],
			[160, 120],
		]) {
			expect((await readPixel(renderer, x, y))[0]).toBeGreaterThan(200);
		}
		reveal.progress.value = 1;

		// and the screen ends uncovered
		await runUntil(() => {
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});

		// The player it was given is gone: a later change does not read it
		// again (destroyed, or recycled into something else), but closes an
		// iris on the centre of the screen, with nothing to warn about
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		state.setTransition(start, true);
		state.change(start);
		const again = app.viewport.getCameraEffect(MaskEffect);
		expect(again._maskShape?.type).toBe("Ellipse");
		expect(again.center).toBeUndefined();
		expect(again.invert).toBe(true);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
		await runUntil(() => {
			expect(state.isCurrent(start)).toBe(true);
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});
	});

	it("set for one change, then set back at once: that change is the mask, the next one the usual fade", async () => {
		let player;
		const start = state.USER + 92;
		const next = state.USER + 93;
		const last = state.USER + 94;
		state.set(
			start,
			new Stage({
				onResetEvent(game) {
					player = new Sprite(200, 50, { image: leftHalf() });
					game.world.addChild(player);
				},
			}),
		);
		state.set(next, new Stage());
		state.set(last, new Stage());
		state.setTransition(start, false);
		state.change(start, true);
		await runUntil(() => {
			expect(state.isCurrent(start)).toBe(true);
			expect(player?.ancestor).toBeDefined();
		});

		// the game's usual transition
		state.transition("fade", "#000", DURATION);

		// the player's silhouette, for this change only: the usual one is
		// set back before a single frame of the mask has run
		state.transition("mask", "#000", DURATION, player);
		state.change(next);
		state.transition("fade", "#000", DURATION);

		// the hide was built when the change was asked for, from the mask
		expect(effectsOn(app)).toEqual(["MaskEffect:hide"]);
		const hide = app.viewport.getCameraEffect(MaskEffect);
		expect(hide._silhouette).toBeDefined();
		const silhouette = hide._silhouette.target.canvas;

		// the reveal comes from the hide, not from the settings, which are
		// the fade's by now: the same mask, the same silhouette
		const seen = new Set();
		let reveal;
		await runUntil(() => {
			for (const name of effectsOn(app)) {
				seen.add(name);
			}
			expect(state.isCurrent(next)).toBe(true);
			reveal = app.viewport.cameraEffects.find((fx) => {
				return fx instanceof MaskEffect && fx.direction === "reveal";
			});
			expect(reveal).toBeDefined();
		});
		expect(reveal._silhouette.target.canvas).toBe(silhouette);
		await runUntil(() => {
			for (const name of effectsOn(app)) {
				seen.add(name);
			}
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});
		// on no frame of that transition was a fade on the camera
		expect([...seen].sort()).toEqual(["MaskEffect:hide", "MaskEffect:reveal"]);

		// the next change is the usual fade, both ways, and never a mask
		state.change(last);
		expect(app.viewport.getCameraEffect(FadeEffect)).toBeDefined();
		const seenNext = new Set();
		await runUntil(() => {
			for (const name of effectsOn(app)) {
				seenNext.add(name);
			}
			expect(state.isCurrent(last)).toBe(true);
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});
		expect(seenNext.size).toBeGreaterThan(0);
		for (const name of seenNext) {
			expect(name.startsWith("FadeEffect")).toBe(true);
		}
	});
});
