import { describe, expect, it } from "vitest";
import { math, ObservableVector2d, Vector2d } from "../src/index.js";

describe("ObservableVector2d : constructor", () => {
	const x = 1;
	const y = 2;

	let a: ObservableVector2d;
	let b: ObservableVector2d;
	let c: ObservableVector2d;

	it("creates a new ObservableVector2d instance with default values", () => {
		a = new ObservableVector2d();
		b = new ObservableVector2d();
		c = new ObservableVector2d();

		expect(a.toString()).toEqual("x:0,y:0");
	});

	it("creates a new ObservableVector2d instance with specified values", () => {
		const observableVector = new ObservableVector2d(10, 20);
		expect(observableVector.x).toEqual(10);
		expect(observableVector.y).toEqual(20);
	});

	it("values can be compared with a ObservableVector2d object", () => {
		const observableVector = new ObservableVector2d(10, 20);
		const vector2 = new Vector2d(10, 20);
		expect(observableVector.equals(vector2)).toEqual(true);
	});

	it("triggers the callback function when setting values", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observableVector = new ObservableVector2d(0, 0, callback);
		expect(observableVector.x).toEqual(0);
		expect(observableVector.y).toEqual(0);
		expect(callbackCalled).toEqual(false);

		observableVector.x = 10;
		expect(observableVector.x).toEqual(10);
		expect(callbackCalled).toEqual(true);
	});

	it("triggers the callback function when calling set()", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observableVector = new ObservableVector2d(1, 2, callback);
		expect(observableVector.x).toEqual(1);
		expect(observableVector.y).toEqual(2);
		expect(callbackCalled).toEqual(false);

		observableVector.set(10, 20);
		expect(observableVector.equals(10, 20)).toEqual(true);
		expect(callbackCalled).toEqual(true);
	});

	it("does not trigger the callback function when using setMuted", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observableVector = new ObservableVector2d(1, 2, callback);
		expect(observableVector.x).toEqual(1);
		expect(observableVector.y).toEqual(2);
		expect(callbackCalled).toEqual(false);

		observableVector.setMuted(10, 20);
		expect(observableVector.equals(10, 20)).toEqual(true);
		expect(callbackCalled).toEqual(false);
	});

	it("does not trigger the callback function when revoked", () => {
		let callbackCalled = false;
		const callback = () => {
			callbackCalled = true;
		};
		const observableVector = new ObservableVector2d(1, 2, callback);
		expect(observableVector.x).toEqual(1);
		expect(observableVector.y).toEqual(2);
		expect(callbackCalled).toEqual(false);

		observableVector.revoke();
		expect(() => {
			observableVector.set(20, 10);
		}).toThrow();
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
		const l = new ObservableVector2d();
		a.set(x, 0);
		b.set(0, -y);

		expect(l.copy(a).lerp(a, 0).equals(a.lerp(a, 0.5))).toEqual(true);
		expect(l.copy(a).lerp(a, 0).equals(a.lerp(a, 1))).toEqual(true);

		expect(l.copy(a).lerp(b, 0).equals(a)).toEqual(true);

		expect(l.copy(a).lerp(b, 0.5).x).toEqual(x * 0.5);
		expect(l.copy(a).lerp(b, 0.5).y).toEqual(-y * 0.5);

		expect(l.copy(a).lerp(b, 1).equals(b)).toEqual(true);
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
		const unit = new ObservableVector2d(3, 4).normalize(); // (0.6, 0.8), length 1
		const byProject = new ObservableVector2d(1, 2).project(unit);
		const byProjectN = new ObservableVector2d(1, 2).projectN(unit);
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
		const long = new ObservableVector2d(0, 10);
		const n = new ObservableVector2d(1, 2).projectN(long); // dot 20 -> (20, 40)
		const pr = new ObservableVector2d(1, 2).project(long); // /100 -> (0.2, 0.4)
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
		a.rotate(Math.PI / 2, new Vector2d(1, 1));

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
		it("turns along the arc and fires the callback ONCE", () => {
			// the whole reason this is not two component writes
			let calls = 0;
			const v = new ObservableVector2d(1, 0);
			v.setCallback(() => {
				calls++;
			});
			v.slerp(new Vector2d(0, 1), 0.5);
			expect(calls).toBe(1);
			expect(v.x).toBeCloseTo(Math.SQRT1_2, 6);
			expect(v.y).toBeCloseTo(Math.SQRT1_2, 6);
			expect(Math.sqrt(v.x * v.x + v.y * v.y)).toBeCloseTo(1, 6);
		});

		it("accepts another observable as the target", () => {
			const v = new ObservableVector2d(2, 0);
			v.slerp(new ObservableVector2d(0, 2), 1);
			expect(v.x).toBeCloseTo(0, 6);
			expect(v.y).toBeCloseTo(2, 6);
		});
	});
});
