import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	MaskEffect,
	Sprite,
	Stage,
	state,
	video,
} from "../src/index.js";

/**
 * `state.transition("mask", …, sprite, { center: sprite })` (#1399): the
 * hide closes on the player with the player's own silhouette, and the reveal
 * opens from the same place with the same silhouette, though the state
 * change has destroyed the player in between.
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
		const silhouette = hide.resolvedShape;

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
		expect(reveal._silhouette.canvas).toBe(silhouette);

		// and the screen ends uncovered
		await runUntil(() => {
			expect(app.viewport.cameraEffects).toHaveLength(0);
		});
	});
});
