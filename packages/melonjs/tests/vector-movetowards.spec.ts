import { describe, expect, it } from "vitest";
import {
	ObservableVector2d,
	ObservableVector3d,
	Vector2d,
	Vector3d,
} from "../src/index.js";

/**
 * moveTowards() contract, per its own JSDoc: interpolate on the x and y axis
 * towards the target by at most `step` per call, returning "Reference to this
 * object for method chaining"; negative steps push away from the target.
 *
 * Written failing-first against two bugs shared by all four vector classes:
 * - the arrival test compared the remaining distance against `step * step`
 *   (wrong units — snapped way too early for step > 1, and never converged
 *   for fractional steps), and
 * - on "arrival" it returned the TARGET vector without moving `this` at all,
 *   so the vector never actually reached the goal and chained calls mutated
 *   the caller's target object.
 */

type VecLike = {
	x: number;
	y: number;
	moveTowards(target: VecLike, step: number): VecLike;
};

const impls: [string, (x: number, y: number) => VecLike][] = [
	[
		"Vector2d",
		(x, y) => {
			return new Vector2d(x, y);
		},
	],
	[
		"Vector3d",
		(x, y) => {
			return new Vector3d(x, y, 0);
		},
	],
	[
		"ObservableVector2d",
		(x, y) => {
			return new ObservableVector2d(x, y);
		},
	],
	[
		"ObservableVector3d",
		(x, y) => {
			return new ObservableVector3d(x, y, 0);
		},
	],
];

describe.each(impls)("%s.moveTowards", (_name, vec) => {
	it("steps by exactly `step` toward the target", () => {
		const v = vec(0, 0);
		const target = vec(10, 0);
		const returned = v.moveTowards(target, 3);
		expect(returned).toBe(v);
		expect(v.x).toBeCloseTo(3, 10);
		expect(v.y).toBeCloseTo(0, 10);
	});

	it("lands exactly on the target when within `step`, returning `this` (not the target)", () => {
		const v = vec(9, 0);
		const target = vec(10, 0);
		const returned = v.moveTowards(target, 5);
		// pre-fix: returned `target` and left `v` untouched at (9, 0)
		expect(returned).toBe(v);
		expect(v.x).toBeCloseTo(10, 10);
		expect(v.y).toBeCloseTo(0, 10);
		// the caller's target must never be the mutation surface
		expect(target.x).toBeCloseTo(10, 10);
	});

	it("converges with a fractional step (step*step threshold dithered forever)", () => {
		const v = vec(0, 0);
		const target = vec(1, 0);
		// pre-fix: with step 0.4 the vector oscillated 0.2 either side of the
		// target forever (threshold 0.16 never satisfied); 10 iterations is
		// more than enough for correct code (3 steps)
		for (let i = 0; i < 10 && v.x !== target.x; i++) {
			v.moveTowards(target, 0.4);
		}
		expect(v.x).toBeCloseTo(1, 10);
		expect(v.y).toBeCloseTo(0, 10);
	});

	it("a negative step pushes away from the target (documented flee semantics)", () => {
		const v = vec(9, 0);
		const returned = v.moveTowards(vec(10, 0), -2);
		expect(returned).toBe(v);
		expect(v.x).toBeCloseTo(7, 10);
	});
});
