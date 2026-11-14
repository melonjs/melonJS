/**
 * Redefining the animation that is playing.
 *
 * `addAnimation()` with an id that already exists replaces it, and the
 * `addAnimation` TSDoc shows exactly that ("slower animation": re-adding
 * "roll" with a new speed). But the playback state copied the frame count
 * from the definition only in `setCurrentAnimation()`, and re-selecting the
 * current id is a no-op, so redefining the CURRENT animation left the old
 * count behind:
 *
 * - fewer frames: playback stepped to an index past the new end, and the
 *   next `update()` threw `TypeError: Cannot read properties of undefined`;
 * - more frames: the new frames were never reached;
 * - no frames: the next `update()` threw;
 * - and the frame on screen stayed the old definition's until the next step.
 *
 * Redefining the current animation now re-syncs it: the playing frame is
 * kept (and re-applied) when it still exists, playback restarts at frame 0
 * past the new end, and a finished play-once run holds the new last frame.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Sprite, video } from "../src/index.js";
import Renderer from "../src/video/renderer.js";

describe("Sprite : redefining the current animation", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});
	afterAll(() => {
		app?.destroy();
	});

	// a 2x2 grid of 16x16 cells: frames 0..3, frame n at offset
	// ((n % 2) * 16, floor(n / 2) * 16)
	const makeSprite = () => {
		return new Sprite(0, 0, {
			framewidth: 16,
			frameheight: 16,
			image: Renderer.createCanvas(32, 32),
		});
	};
	const offsetOf = (n) => {
		return { x: (n % 2) * 16, y: Math.floor(n / 2) * 16 };
	};
	const shownOffset = (sprite) => {
		return { x: sprite.current.offset.x, y: sprite.current.offset.y };
	};
	// the frame index after each of `n` updates of `dt` ms
	const play = (sprite, n, dt = 100) => {
		const seen = [];
		for (let i = 0; i < n; i++) {
			sprite.update(dt);
			seen.push(sprite.getCurrentAnimationFrame());
		}
		return seen;
	};

	it("fewer frames while playing past the new end: restarts at frame 0 and keeps playing", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk");
		play(sprite, 3);
		expect(sprite.getCurrentAnimationFrame()).toBe(3);
		sprite.addAnimation("walk", [0, 1], 100);
		expect(sprite.getCurrentAnimationFrame()).toBe(0);
		expect(shownOffset(sprite)).toEqual(offsetOf(0));
		let seen;
		expect(() => {
			seen = play(sprite, 4);
		}).not.toThrow();
		expect(seen).toEqual([1, 0, 1, 0]);
	});

	it("fewer frames while the playing frame still exists: keeps that frame", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk");
		play(sprite, 1);
		sprite.addAnimation("walk", [0, 1, 2], 100);
		expect(sprite.getCurrentAnimationFrame()).toBe(1);
		expect(play(sprite, 3)).toEqual([2, 0, 1]);
	});

	it("the documented re-add right after selecting the animation (TSDoc 'slower animation')", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk");
		sprite.addAnimation("walk", [0, 1], 100);
		expect(() => {
			play(sprite, 4);
		}).not.toThrow();
		expect(sprite.getCurrentAnimationFrame()).toBeLessThan(2);
	});

	it("more frames: playback reaches the added frames", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1], 100);
		sprite.setCurrentAnimation("walk");
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		expect(play(sprite, 5)).toEqual([1, 2, 3, 0, 1]);
	});

	it("no frames: update() does nothing, and frames added back play again", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk");
		play(sprite, 2);
		expect(sprite.addAnimation("walk", [], 100)).toBe(0);
		expect(() => {
			play(sprite, 3);
		}).not.toThrow();
		expect(sprite.getCurrentAnimationFrame()).toBe(0);
		sprite.addAnimation("walk", [2, 3], 100);
		expect(shownOffset(sprite)).toEqual(offsetOf(2));
		expect(play(sprite, 3)).toEqual([1, 0, 1]);
	});

	it("the frame on screen is the new definition's at once, not after the next step", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk");
		play(sprite, 1);
		expect(shownOffset(sprite)).toEqual(offsetOf(1));
		// same length, other cells: index 1 is now cell 2
		sprite.addAnimation("walk", [3, 2, 1, 0], 100);
		expect(sprite.getCurrentAnimationFrame()).toBe(1);
		expect(shownOffset(sprite)).toEqual(offsetOf(2));
		sprite.update(100);
		expect(shownOffset(sprite)).toEqual(offsetOf(1));
	});

	it("a new speed, or per-frame delays, apply from the redefinition on", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk");
		sprite.addAnimation("walk", [0, 1, 2, 3], 200);
		expect(play(sprite, 4)).toEqual([0, 1, 1, 2]);
		sprite.addAnimation("walk", [
			{ name: 0, delay: 50 },
			{ name: 1, delay: 300 },
			{ name: 2, delay: 50 },
		]);
		// was on index 2, still there: 50 ms on it, then 50 on 0, then 300 on 1
		expect(play(sprite, 5, 50)).toEqual([0, 1, 1, 1, 1]);
		expect(play(sprite, 3, 50)).toEqual([1, 1, 2]);
	});

	it("a finished play-once animation redefined shorter holds the new last frame", () => {
		const sprite = makeSprite();
		sprite.addAnimation("die", [0, 1, 2, 3], 100);
		let completed = 0;
		sprite.setCurrentAnimation("die", {
			loop: false,
			onComplete: () => {
				completed++;
			},
		});
		play(sprite, 6);
		expect(completed).toBe(1);
		expect(sprite.getCurrentAnimationFrame()).toBe(3);
		sprite.addAnimation("die", [0, 1], 100);
		expect(sprite.getCurrentAnimationFrame()).toBe(1);
		expect(play(sprite, 3)).toEqual([1, 1, 1]);
		expect(completed).toBe(1);
		// and it can still be replayed
		sprite.setCurrentAnimation("die", { loop: false });
		expect(play(sprite, 3)).toEqual([1, 1, 1]);
		expect(sprite.getCurrentAnimationFrame()).toBe(1);
	});

	it("a play-once animation redefined while playing keeps its options", () => {
		const sprite = makeSprite();
		sprite.addAnimation("die", [0, 1, 2, 3], 100);
		sprite.addAnimation("idle", [2, 3], 100);
		sprite.setCurrentAnimation("die", "idle");
		play(sprite, 1);
		sprite.addAnimation("die", [0, 1, 2], 100);
		play(sprite, 2);
		expect(sprite.isCurrentAnimation("idle")).toBe(true);
	});

	it("redefining another animation leaves the playing one alone", () => {
		const sprite = makeSprite();
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.addAnimation("stand", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk");
		play(sprite, 3);
		sprite.addAnimation("stand", [0], 100);
		expect(sprite.getCurrentAnimationFrame()).toBe(3);
		expect(sprite.isCurrentAnimation("walk")).toBe(true);
		expect(play(sprite, 2)).toEqual([0, 1]);
	});

	it("does not report onFrame for a redefinition, only for playback", () => {
		const sprite = makeSprite();
		const frames = [];
		sprite.addAnimation("walk", [0, 1, 2, 3], 100);
		sprite.setCurrentAnimation("walk", {
			onFrame: (f) => {
				frames.push(f);
			},
		});
		play(sprite, 3);
		sprite.addAnimation("walk", [0, 1], 100);
		play(sprite, 2);
		expect(frames).toEqual([0, 1, 2, 3, 1, 0]);
	});
});
