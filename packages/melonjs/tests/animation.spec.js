import { describe, expect, it } from "vitest";
import { parseAnimationOptions } from "../src/renderable/animation.ts";

/**
 * Unit tests for parseAnimationOptions — the shared helper that normalizes the
 * polymorphic 2nd argument of `setCurrentAnimation` (used by both the 2D Sprite
 * and the 3D GLTFModel animation paths). Pure, no engine deps.
 */
describe("parseAnimationOptions", () => {
	it("undefined → loop forever at authored speed", () => {
		expect(parseAnimationOptions(undefined)).toEqual({ loop: true, speed: 1 });
	});

	it("null (internal chain call) → loop forever at authored speed", () => {
		// the animation-chain calls setCurrentAnimation(next, null, true)
		expect(parseAnimationOptions(null)).toEqual({ loop: true, speed: 1 });
	});

	it("no argument → loop forever at authored speed", () => {
		expect(parseAnimationOptions()).toEqual({ loop: true, speed: 1 });
	});

	it("a string → chains to that animation (next), looping", () => {
		expect(parseAnimationOptions("walk")).toEqual({
			next: "walk",
			loop: true,
			speed: 1,
		});
	});

	it("a function → legacy completion callback (legacyFn flagged)", () => {
		const fn = () => {};
		const opts = parseAnimationOptions(fn);
		expect(opts.onComplete).toBe(fn);
		expect(opts.legacyFn).toBe(true);
		expect(opts.loop).toBe(true);
		expect(opts.speed).toBe(1);
	});

	it("an options object maps through, defaulting loop=true / speed=1", () => {
		const onComplete = () => {};
		const opts = parseAnimationOptions({ onComplete, next: "idle" });
		expect(opts.onComplete).toBe(onComplete);
		expect(opts.next).toBe("idle");
		expect(opts.loop).toBe(true);
		expect(opts.speed).toBe(1);
		expect(opts.legacyFn).toBeUndefined();
	});

	it("options loop:false disables looping (only an explicit false)", () => {
		expect(parseAnimationOptions({ loop: false }).loop).toBe(false);
		// any other falsy-ish value is NOT treated as false
		expect(parseAnimationOptions({}).loop).toBe(true);
		expect(parseAnimationOptions({ loop: undefined }).loop).toBe(true);
	});

	it("options speed passes through, including 0", () => {
		expect(parseAnimationOptions({ speed: 2 }).speed).toBe(2);
		expect(parseAnimationOptions({ speed: 0.5 }).speed).toBe(0.5);
		// 0 is a valid speed (freeze) — must not fall back to the default 1
		expect(parseAnimationOptions({ speed: 0 }).speed).toBe(0);
	});

	it("ADVERSARIAL: a non-numeric speed falls back to 1", () => {
		// guards the `typeof speed === "number"` check
		expect(parseAnimationOptions({ speed: "fast" }).speed).toBe(1);
	});

	it("ADVERSARIAL: a string is treated as next, NOT a legacy callback", () => {
		const opts = parseAnimationOptions("die");
		expect(opts.next).toBe("die");
		expect(opts.legacyFn).toBeUndefined();
		expect(opts.onComplete).toBeUndefined();
	});

	it("ADVERSARIAL: an options object never sets legacyFn (only a bare function does)", () => {
		const opts = parseAnimationOptions({ onComplete: () => {}, loop: false });
		expect(opts.legacyFn).toBeUndefined();
	});
});
