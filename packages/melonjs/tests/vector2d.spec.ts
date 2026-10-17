import { describe, expect, it } from "vitest";
import * as math from "../src/math/math.js";
import { Vector2d } from "../src/math/vector2d.js";

describe("Vector2d", () => {
	const x = 1;
	const y = 2;

	let a: Vector2d;
	let b: Vector2d;
	let c: Vector2d;

	it("should be initialized to a (0, 0) 2d vector", () => {
		a = new Vector2d();
		b = new Vector2d();
		c = new Vector2d();

		expect(a.toString()).toEqual("x:0,y:0");
	});

	it("a(1, 2) should be copied into b", () => {
		a.set(x, y);
		b.copy(a);

		expect(b.equals(a)).toEqual(true);
		expect(b.equals(a.x, a.y)).toEqual(true);
	});

	it("set (1, 2) into a defined vector", () => {
		a.set(x, y);

		expect(a.toString()).toEqual(`x:${x},y:${y}`);
	});

	it("add (1, 2) to (-1, -2)", () => {
		a.set(x, y);
		b.set(-x, -y);

		expect(a.add(b).toString()).toEqual("x:0,y:0");
	});

	it("sub (1, 2) to (-1, -2)", () => {
		a.set(x, y);
		b.set(-x, -y);

		expect(a.sub(b).toString()).toEqual(`x:${x - -x},y:${y - -y}`);
	});

	it("scale (1, 2) by (-1, -2)", () => {
		a.set(x, y);
		b.set(-x, -y);

		expect(a.scaleV(b).toString()).toEqual(`x:${x * -x},y:${y * -y}`);
	});

	it("negate (1, 2)", () => {
		a.set(x, y);

		expect(a.negateSelf().toString()).toEqual(`x:${-x},y:${-y}`);
	});

	it("dot Product (1, 2) and (-1, -2)", () => {
		a.set(x, y);
		b.set(-x, -y);

		// calculate the dot product
		expect(a.dot(b)).toEqual(-x * x - y * y);
	});

	it("cross Product (2, 3) and (5, 6)", () => {
		a.set(2, 3);
		b.set(5, 6);

		// calculate the cross product
		expect(a.cross(b)).toEqual(-3);
	});

	it("length/lengthSqrt functions", () => {
		a.set(x, 0);
		b.set(0, -y);
		c.set(0, 0);

		expect(a.length()).toEqual(x);
		expect(a.length2()).toEqual(x * x);
		expect(b.length()).toEqual(y);
		expect(b.length2()).toEqual(y * y);
		expect(c.length()).toEqual(0);
		expect(c.length2()).toEqual(0);

		a.set(x, y);
		expect(a.length()).toEqual(Math.sqrt(x * x + y * y));
		expect(a.length2()).toEqual(x * x + y * y);
	});

	it("lerp functions", () => {
		a.set(x, 0);
		b.set(0, -y);

		expect(a.clone().lerp(a, 0)).toEqual(a.lerp(a, 0.5));
		expect(a.clone().lerp(a, 0).equals(a.lerp(a, 1))).toEqual(true);

		expect(a.clone().lerp(b, 0).equals(a)).toEqual(true);

		expect(a.clone().lerp(b, 0.5).x).toEqual(x * 0.5);
		expect(a.clone().lerp(b, 0.5).y).toEqual(-y * 0.5);

		expect(a.clone().lerp(b, 1).equals(b)).toEqual(true);
	});

	it("damp — dt=0 leaves vector unchanged", () => {
		a.set(10, 20);
		b.set(100, 200);
		const before = a.clone();
		a.damp(b, 5, 0);
		expect(a.equals(before)).toEqual(true);
	});

	it("damp — lambda=0 leaves vector unchanged", () => {
		a.set(10, 20);
		b.set(100, 200);
		const before = a.clone();
		a.damp(b, 0, 0.5);
		expect(a.equals(before)).toEqual(true);
	});

	it("damp — lambda=Infinity snaps to target", () => {
		a.set(0, 0);
		b.set(100, 200);
		a.damp(b, Number.POSITIVE_INFINITY, 1 / 60);
		expect(a.equals(b)).toEqual(true);
	});

	it("damp — equal target = no movement (idempotent)", () => {
		a.set(10, 20);
		a.damp(a, 5, 1 / 60);
		expect(a.x).toEqual(10);
		expect(a.y).toEqual(20);
	});

	it("damp — frame-rate independence over 1 second", () => {
		const target = new Vector2d(100, 200);
		const lambda = 5;
		const sim = (steps: number, dt: number) => {
			const v = new Vector2d(0, 0);
			for (let i = 0; i < steps; i++) v.damp(target, lambda, dt);
			return v;
		};
		const v60 = sim(60, 1 / 60);
		const v30 = sim(30, 1 / 30);
		expect(v60.x).toBeCloseTo(v30.x, 9);
		expect(v60.y).toBeCloseTo(v30.y, 9);
		expect(v60.x).toBeCloseTo(100 * (1 - Math.exp(-5)), 6);
	});

	it("damp — returns `this` for chaining", () => {
		a.set(0, 0);
		const r = a.damp(b, 5, 1 / 60);
		expect(r).toBe(a);
	});

	it("damp — monotonic approach, no overshoot", () => {
		a.set(0, 0);
		b.set(100, 100);
		for (let i = 0; i < 1000; i++) {
			a.damp(b, 5, 1 / 60);
			expect(a.x).toBeLessThanOrEqual(100);
			expect(a.y).toBeLessThanOrEqual(100);
		}
	});

	it("normalize function", () => {
		a.set(x, 0);
		b.set(0, -y);

		a.normalize();
		expect(a.length()).toEqual(1);
		expect(a.x).toEqual(1);

		b.normalize();
		expect(b.length()).toEqual(1);
		expect(b.y).toEqual(-1);
	});

	it("distance function", () => {
		a.set(x, 0);
		b.set(0, -y);
		c.set(0, 0);

		expect(a.distance(c)).toEqual(x);
		expect(b.distance(c)).toEqual(y);
	});

	it("min/max/clamp", () => {
		a.set(x, y);
		b.set(-x, -y);
		c.set(0, 0);

		c.copy(a).minV(b);
		expect(c.x).toEqual(-x);
		expect(c.y).toEqual(-y);

		c.copy(a).maxV(b);
		expect(c.x).toEqual(x);
		expect(c.y).toEqual(y);

		c.set(-2 * x, 2 * x);
		c.clampSelf(-x, x);
		expect(c.x).toEqual(-x);
		expect(c.y).toEqual(x);
	});

	it("ceil/floor", () => {
		expect(
			new Vector2d(-0.1, 0.1).floorSelf().equals(new Vector2d(-1, 0)),
		).toEqual(true);
		expect(
			new Vector2d(-0.5, 0.5).floorSelf().equals(new Vector2d(-1, 0)),
		).toEqual(true);
		expect(
			new Vector2d(-0.9, 0.9).floorSelf().equals(new Vector2d(-1, 0)),
		).toEqual(true);

		expect(
			new Vector2d(-0.1, 0.1).ceilSelf().equals(new Vector2d(0, 1)),
		).toEqual(true);
		expect(
			new Vector2d(-0.5, 0.5).ceilSelf().equals(new Vector2d(0, 1)),
		).toEqual(true);
		expect(
			new Vector2d(-0.9, 0.9).ceilSelf().equals(new Vector2d(0, 1)),
		).toEqual(true);
	});

	it("project a on b", () => {
		a.set(x, y);
		b.set(-x, -y);

		// the following only works with (-)1, (-)2style of values
		expect(a.project(b).equals(b)).toEqual(true);
	});

	it("projectN onto a unit vector skips the division", () => {
		// `projectN` exists to skip the `/ v.length2()` that `project` pays,
		// because the target is already unit. On a unit target the two must
		// agree exactly, which is what makes it a safe substitution.
		//
		// Note melonJS scales THIS by the ratio rather than returning the
		// component along `v`, so the result points along `a`, not along `b`.
		const unit = new Vector2d(3, 4).normalize(); // (0.6, 0.8), length 1
		const byProject = new Vector2d(1, 2).project(unit);
		const byProjectN = new Vector2d(1, 2).projectN(unit);
		expect(byProjectN.x).toBeCloseTo(byProject.x, 12);
		expect(byProjectN.y).toBeCloseTo(byProject.y, 12);

		// and the value itself: `a` scaled by `a . b`
		const dot = 1 * unit.x + 2 * unit.y;
		expect(byProjectN.x).toBeCloseTo(1 * dot, 12);
		expect(byProjectN.y).toBeCloseTo(2 * dot, 12);
	});

	it("projectN does NOT divide by the target's length", () => {
		// The contract is that the caller supplies a unit vector. Handed one
		// that is not, `projectN` must scale by the RAW dot product, which is
		// the whole point of it being cheaper; it must not quietly behave
		// like `project`. This is the assertion that fails if the division is
		// ever put back.
		const long = new Vector2d(0, 10);
		const n = new Vector2d(1, 2).projectN(long); // dot 20 -> (20, 40)
		const pr = new Vector2d(1, 2).project(long); // /100 -> (0.2, 0.4)
		expect(n.x).toBeCloseTo(20, 12);
		expect(n.y).toBeCloseTo(40, 12);
		expect(pr.x).toBeCloseTo(0.2, 12);
		expect(pr.y).toBeCloseTo(0.4, 12);
		expect(n.y).not.toBeCloseTo(pr.y, 6);
	});

	it("angle between a and b", () => {
		a.set(x, y);
		b.set(-x, -y);

		// why is this not perfectly 180 degrees ?
		expect(Math.round(math.radToDeg(a.angle(b)))).toEqual(180);

		b.set(4 * x, -y);
		expect(a.angle(b)).toEqual(Math.PI / 2);
	});

	it("rotate around its origin point", () => {
		a.set(1, 0);
		// rotate the vector by 90 degree clockwise
		a.rotate(Math.PI / 2);

		expect(a.x).toBeCloseTo(0, 5);
		expect(a.y).toBeCloseTo(1, 5);
	});

	it("rotate around a given point", () => {
		a.set(1, 0);
		// rotate the vector by 90 degree clockwise on the z axis
		a.rotate(Math.PI / 2, { x: 1, y: 1 });

		expect(a.x).toBeCloseTo(2, 5);
		expect(a.y).toBeCloseTo(1, 5);
	});

	it("perp and rotate function", () => {
		a.set(x, y);
		b.copy(a).perp();
		// perp rotate the vector by 90 degree clockwise on the z axis
		c.copy(a).rotate(Math.PI / 2);

		expect(a.angle(b)).toEqual(a.angle(c));
	});

	it("convert vector to iso coordinates", () => {
		a.set(32, 32);

		a.toIso();
		expect(a.toString()).toEqual("x:0,y:32");

		a.to2d();
		expect(a.toString()).toEqual("x:32,y:32");
	});

	it("angle function", () => {
		a.set(6, 3);
		b.set(5, 13);
		expect(math.radToDeg(a.angle(b))).toBeCloseTo(42, -1);

		a.set(3, -6);
		b.set(8, 4);
		expect(math.radToDeg(a.angle(b))).toBeCloseTo(90, -1);
	});

	describe("slerp", () => {
		// the signed angle from `u` to `v`, the shorter way round
		const turn = (u: Vector2d, v: Vector2d) =>
			Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
		const len = (v: Vector2d) => Math.sqrt(v.x * v.x + v.y * v.y);

		it("turns at a constant angular rate, where lerp does not", () => {
			// A quarter turn from +X to +Y. Halfway along the arc is 45
			// degrees from each end; halfway along the CHORD is not, and it
			// has fallen off the unit circle as well.
			const from = new Vector2d(1, 0);
			const to = new Vector2d(0, 1);
			const half = from.clone().slerp(to, 0.5);
			expect(turn(from, half)).toBeCloseTo(Math.PI / 4, 6);
			expect(turn(half, to)).toBeCloseTo(Math.PI / 4, 6);
			expect(len(half)).toBeCloseTo(1, 6);
			expect(len(from.clone().lerp(to, 0.5))).toBeLessThan(0.95);
		});

		it("reaches both ends exactly", () => {
			const to = new Vector2d(0, 3);
			const atZero = new Vector2d(2, 0).slerp(to, 0);
			expect(atZero.x).toBeCloseTo(2, 6);
			expect(atZero.y).toBeCloseTo(0, 6);
			const atOne = new Vector2d(2, 0).slerp(to, 1);
			expect(atOne.x).toBeCloseTo(0, 6);
			expect(atOne.y).toBeCloseTo(3, 6);
		});

		it("interpolates length alongside direction", () => {
			const out = new Vector2d(2, 0).slerp(new Vector2d(0, 4), 0.5);
			expect(len(out)).toBeCloseTo(3, 6);
			expect(turn(new Vector2d(1, 0), out)).toBeCloseTo(Math.PI / 4, 6);
		});

		it("takes the SHORTER way round across the wrap", () => {
			// This is the bug a scalar `damp` on a heading has: 170 degrees
			// to -170 degrees is 20 degrees apart, and damping the numbers
			// sweeps the other 340. The arc cannot do that.
			const from = new Vector2d(
				Math.cos(math.degToRad(170)),
				Math.sin(math.degToRad(170)),
			);
			const to = new Vector2d(
				Math.cos(math.degToRad(-170)),
				Math.sin(math.degToRad(-170)),
			);
			const step = from.clone().slerp(to, 0.5);
			// ten degrees on, not a hundred and seventy
			expect(math.radToDeg(Math.abs(turn(from, step)))).toBeCloseTo(10, 4);
			expect(len(step)).toBeCloseTo(1, 6);
		});

		it("turns a half circle between exactly opposite directions", () => {
			const from = new Vector2d(1, 0);
			const half = from.clone().slerp(new Vector2d(-1, 0), 0.5);
			expect(len(half)).toBeCloseTo(1, 6);
			expect(Math.abs(turn(from, half))).toBeCloseTo(Math.PI / 2, 5);
			expect(from.clone().slerp(new Vector2d(-1, 0), 1).x).toBeCloseTo(-1, 5);
			// and the way it goes is the documented one: a POSITIVE turn,
			// the same direction `rotate` takes for a positive angle
			expect(half.y).toBeCloseTo(1, 6);
		});

		it("turns the same way for every opposite pair", () => {
			// The sine of two exactly opposite vectors is a ZERO whose SIGN
			// depends on which components are zero, and `atan2` reads that
			// sign: `(1,0)` toward `(-1,0)` gives `+0` and so `+pi`, while
			// `(0,1)` toward `(0,-1)` gives `-0` and so `-pi`. Unguarded,
			// those two turn in opposite directions for no reason visible to
			// a caller.
			//
			// Both ends are written out in full rather than derived as
			// `(-x, -y)`: negating a `0` yields `-0`, which lands the sine
			// back on `+0` every time and hides the whole problem. An
			// earlier version of this test did exactly that and stayed green
			// with the guard deleted.
			const turns = [
				[
					[1, 0],
					[-1, 0],
				],
				[
					[0, 1],
					[0, -1],
				],
				[
					[-1, 0],
					[1, 0],
				],
				[
					[0, -1],
					[0, 1],
				],
			].map(([[ax, ay], [bx, by]]) => {
				const from = new Vector2d(ax, ay);
				return Math.sign(
					turn(from, from.clone().slerp(new Vector2d(bx, by), 0.5)),
				);
			});
			expect(new Set(turns).size).toBe(1);
			expect(turns[0]).toBe(1);
		});

		it("holds still between identical directions", () => {
			const out = new Vector2d(3, 4).slerp(new Vector2d(6, 8), 0.5);
			// same direction, so only the length moves
			expect(len(out)).toBeCloseTo(7.5, 6);
			expect(turn(new Vector2d(3, 4), out)).toBeCloseTo(0, 9);
		});

		it("falls back to a straight interpolation for a zero vector", () => {
			const out = new Vector2d(0, 0).slerp(new Vector2d(0, 2), 0.5);
			expect(out.x).toBeCloseTo(0, 6);
			expect(out.y).toBeCloseTo(1, 6);
			const back = new Vector2d(0, 2).slerp(new Vector2d(0, 0), 0.5);
			expect(back.y).toBeCloseTo(1, 6);
		});

		it("returns itself for chaining", () => {
			const v = new Vector2d(1, 0);
			expect(v.slerp(new Vector2d(0, 1), 0.5)).toBe(v);
		});
	});
});
