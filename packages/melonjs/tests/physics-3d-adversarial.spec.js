/**
 * The 3D physics additions, pushed where they are most likely to give:
 * degenerate and non-finite input, aliasing (an argument that is also the
 * receiver, an `out` that is also an input), round trips against an
 * independent implementation, and the promise that a Vector2d call does
 * exactly what it did before a Vector3d was accepted.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	Box3d,
	BuiltinAdapter,
	boot,
	Capsule3d,
	ConvexHull3d,
	Matrix3d,
	Mesh,
	ObservableVector3d,
	Quaternion,
	Rect,
	Renderable,
	TriangleMesh3d,
	Vector2d,
	Vector3d,
	video,
	World,
} from "../src/index.js";
import { slerpQuat } from "../src/level/gltf/gltf_sampler.js";
import { composeTRS } from "../src/loader/parsers/gltf.js";
import { AABB3d } from "../src/physics/broadphase/aabb3d.ts";

// a small reproducible generator: the cases are the same on every run
const rng = (seed) => {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
};
const randomQuaternion = (next) => {
	return new Quaternion().rotate(
		(next() * 2 - 1) * Math.PI,
		new Vector3d(next() * 2 - 1, next() * 2 - 1, next() * 2 - 1),
	);
};
const finite = (q) => {
	return [q.x, q.y, q.z, q.w].every(Number.isFinite);
};
// the same orientation: q and -q turn everything alike
const expectSameRotation = (a, b, digits = 5) => {
	const sign = a.dot(b) < 0 ? -1 : 1;
	expect(a.x).toBeCloseTo(b.x * sign, digits);
	expect(a.y).toBeCloseTo(b.y * sign, digits);
	expect(a.z).toBeCloseTo(b.z * sign, digits);
	expect(a.w).toBeCloseTo(b.w * sign, digits);
};
const expectVector = (v, x, y, z, digits = 5) => {
	expect(v.x).toBeCloseTo(x, digits);
	expect(v.y).toBeCloseTo(y, digits);
	expect(v.z).toBeCloseTo(z, digits);
};

let app;
beforeAll(async () => {
	boot();
	app = new Application(320, 240, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
	await app.init();
});
afterAll(() => {
	app?.destroy();
});

describe("Quaternion, adversarial", () => {
	describe("named and shaped as its siblings are", () => {
		it("length2 is the squared length, as on Vector3d", () => {
			const q = new Quaternion(1, 2, 3, 4);
			expect(q.length2()).toBe(30);
			expect(q.length()).toBeCloseTo(Math.sqrt(30), 12);
			expect(typeof new Vector3d().length2).toBe("function");
			expect(q.lengthSquared).toBeUndefined();
		});

		it("apply turns the vector it is given and returns that vector, as Matrix3d#apply does", () => {
			const q = new Quaternion().rotate(1, new Vector3d(0, 0, 1));
			const m = q.toMatrix3d();
			const v = new Vector3d(3, -2, 5);
			const w = v.clone();
			expect(q.apply(v)).toBe(v);
			expect(m.apply(w)).toBe(w);
			expectVector(v, w.x, w.y, w.z, 4);
			// the quaternion itself is untouched
			expectSameRotation(
				q,
				new Quaternion().rotate(1, new Vector3d(0, 0, 1)),
				12,
			);
		});

		it("apply reports one change on an observable vector, such as a renderable's pos", () => {
			let fired = 0;
			const v = new ObservableVector3d(1, 0, 0, () => {
				fired++;
			});
			new Quaternion().rotate(Math.PI / 2, new Vector3d(0, 0, 1)).apply(v);
			expectVector(v, 0, 1, 0);
			expect(fired).toBe(1);
		});

		it("every method that changes it returns it, for chaining", () => {
			const q = new Quaternion();
			const other = new Quaternion(0, 1, 0, 0);
			expect(q.set(0, 0, 0, 1)).toBe(q);
			expect(q.identity()).toBe(q);
			expect(q.copy(other)).toBe(q);
			expect(q.identity().rotate(1, new Vector3d(1, 0, 0))).toBe(q);
			expect(q.fromMat3d(new Matrix3d())).toBe(q);
			expect(q.multiply(other)).toBe(q);
			expect(q.premultiply(other)).toBe(q);
			expect(q.invert()).toBe(q);
			expect(q.normalize()).toBe(q);
			expect(q.slerp(other, 0.5)).toBe(q);
			expect(q.fromArray([0, 0, 0, 1])).toBe(q);
			// one chain, start to end
			const end = new Quaternion()
				.rotate(0.3, new Vector3d(0, 1, 0))
				.multiply(other)
				.invert()
				.normalize();
			expect(end.length()).toBeCloseTo(1, 12);
		});

		it("prints as a vector does", () => {
			expect(new Quaternion(1, 2, 3, 4).toString()).toBe("x:1,y:2,z:3,w:4");
			expect(new Vector3d(1, 2, 3).toString()).toBe("x:1,y:2,z:3");
		});

		it("clone is independent, and toArray hands out a fresh array", () => {
			const q = new Quaternion(0.1, 0.2, 0.3, 0.4);
			const c = q.clone();
			expect(c).not.toBe(q);
			c.x = 9;
			expect(q.x).toBe(0.1);
			const a = q.toArray();
			a[0] = 7;
			expect(q.x).toBe(0.1);
			expect(q.toArray()).not.toBe(q.toArray());
			// a typed array, an offset-free read of exactly four
			expect(new Quaternion().fromArray(new Float32Array([0, 1, 0, 0])).y).toBe(
				1,
			);
		});
	});

	describe("aliasing", () => {
		it("a.multiply(a) and a.premultiply(a) double the turn", () => {
			const axis = new Vector3d(0.3, -1, 0.4);
			const twice = new Quaternion().rotate(1.4, axis);
			const a = new Quaternion().rotate(0.7, axis);
			a.multiply(a);
			expectSameRotation(a, twice, 10);
			const b = new Quaternion().rotate(0.7, axis);
			b.premultiply(b);
			expectSameRotation(b, twice, 10);
		});

		it("a.slerp(a, t), a.copy(a) and a.dot(a) leave a as it is", () => {
			const a = randomQuaternion(rng(5));
			const before = a.clone();
			for (const t of [0, 0.3, 1, 2, -1]) {
				a.slerp(a, t);
				expectSameRotation(a, before, 10);
			}
			a.copy(a);
			expect(a.equals(before, 1e-12)).toBe(true);
			expect(a.dot(a)).toBeCloseTo(1, 12);
		});

		it("multiply and premultiply are each other, sides swapped", () => {
			const next = rng(11);
			for (let i = 0; i < 20; i++) {
				const a = randomQuaternion(next);
				const b = randomQuaternion(next);
				const ab = a.clone().multiply(b);
				const viaPre = b.clone().premultiply(a);
				expect(ab.equals(viaPre, 1e-12)).toBe(true);
				// and neither argument was touched
				expect(a.length()).toBeCloseTo(1, 12);
			}
		});

		it("the argument of multiply, copy and slerp is never written", () => {
			const a = randomQuaternion(rng(3));
			const b = randomQuaternion(rng(4));
			const kept = b.toArray();
			a.multiply(b);
			a.premultiply(b);
			a.slerp(b, 0.4);
			a.copy(b);
			expect(b.toArray()).toEqual(kept);
		});
	});

	describe("slerp at its edges", () => {
		it("matches the engine's own glTF slerp, for any pair", () => {
			const next = rng(42);
			for (let i = 0; i < 50; i++) {
				const a = randomQuaternion(next);
				const b = randomQuaternion(next);
				const t = next();
				const want = slerpQuat([...a.toArray(), ...b.toArray()], 0, 4, t, []);
				a.slerp(b, t);
				expect(a.x).toBeCloseTo(want[0], 5);
				expect(a.y).toBeCloseTo(want[1], 5);
				expect(a.z).toBeCloseTo(want[2], 5);
				expect(a.w).toBeCloseTo(want[3], 5);
			}
		});

		it("t = 0 is this and t = 1 is the target, whichever sign the target has", () => {
			const next = rng(8);
			for (let i = 0; i < 20; i++) {
				const a = randomQuaternion(next);
				const b = randomQuaternion(next);
				const negB = new Quaternion(-b.x, -b.y, -b.z, -b.w);
				expectSameRotation(a.clone().slerp(b, 0), a, 9);
				expectSameRotation(a.clone().slerp(b, 1), b, 9);
				expectSameRotation(a.clone().slerp(negB, 1), b, 9);
				// and the way there is the same for q and -q
				expectSameRotation(
					a.clone().slerp(b, 0.37),
					a.clone().slerp(negB, 0.37),
					9,
				);
			}
		});

		it("toward its own negative stays where it is: they are one orientation", () => {
			const a = randomQuaternion(rng(17));
			const neg = new Quaternion(-a.x, -a.y, -a.z, -a.w);
			for (const t of [0, 0.25, 0.5, 0.75, 1]) {
				const r = a.clone().slerp(neg, t);
				expect(finite(r)).toBe(true);
				expectSameRotation(r, a, 9);
			}
		});

		it("between two turns half a turn apart is a unit quaternion all the way", () => {
			// a half turn about X against none: the dot product is exactly 0
			const a = new Quaternion();
			const b = new Quaternion(1, 0, 0, 0);
			for (let t = 0; t <= 1.0001; t += 0.125) {
				const r = a.clone().slerp(b, t);
				expect(finite(r)).toBe(true);
				expect(r.length()).toBeCloseTo(1, 12);
				expectSameRotation(
					r,
					new Quaternion().rotate(Math.PI * t, new Vector3d(1, 0, 0)),
					9,
				);
			}
		});

		it("past either end keeps turning along the same arc, still a rotation", () => {
			const axis = new Vector3d(0, 1, 0);
			const a = new Quaternion();
			const b = new Quaternion().rotate(0.4, axis);
			expectSameRotation(
				a.clone().slerp(b, 2),
				new Quaternion().rotate(0.8, axis),
				9,
			);
			expectSameRotation(
				a.clone().slerp(b, -1),
				new Quaternion().rotate(-0.4, axis),
				9,
			);
		});

		it("never leaves a NaN behind, whatever it is handed", () => {
			const good = randomQuaternion(rng(2));
			for (const t of [NaN, Infinity, -Infinity]) {
				expect(finite(good.clone().slerp(new Quaternion(0, 1, 0, 0), t))).toBe(
					true,
				);
			}
			const nan = new Quaternion(NaN, NaN, NaN, NaN);
			expect(finite(good.clone().slerp(nan, 0.5))).toBe(true);
			expect(finite(nan.clone().slerp(good, 0.5))).toBe(true);
			// two zero quaternions: nothing to blend, no rotation
			expect(
				new Quaternion(0, 0, 0, 0)
					.slerp(new Quaternion(0, 0, 0, 0), 0.5)
					.isIdentity(),
			).toBe(true);
		});
	});

	describe("to a matrix and back", () => {
		it("agrees with the engine's glTF matrix composition", () => {
			const next = rng(77);
			for (let i = 0; i < 30; i++) {
				const q = randomQuaternion(next);
				const want = composeTRS([0, 0, 0], q.toArray(), [1, 1, 1]);
				const got = q.toMatrix3d().val;
				for (let k = 0; k < 16; k++) {
					expect(got[k]).toBeCloseTo(want[k], 5);
				}
			}
		});

		it("round-trips any rotation, on every branch of the reader", () => {
			const next = rng(123);
			const cases = [
				// the three branches a negative trace picks between
				new Quaternion(1, 0, 0, 0),
				new Quaternion(0, 1, 0, 0),
				new Quaternion(0, 0, 1, 0),
				new Quaternion(Math.SQRT1_2, Math.SQRT1_2, 0, 0),
				new Quaternion(0, Math.SQRT1_2, Math.SQRT1_2, 0),
				new Quaternion(Math.SQRT1_2, 0, Math.SQRT1_2, 0),
				// a trace of exactly 0
				new Quaternion().rotate((2 * Math.PI) / 3, new Vector3d(1, 1, 1)),
				new Quaternion(),
			];
			for (let i = 0; i < 60; i++) {
				cases.push(randomQuaternion(next));
			}
			for (const q of cases) {
				const back = new Quaternion().fromMat3d(q.toMatrix3d());
				expect(back.length()).toBeCloseTo(1, 6);
				expectSameRotation(back, q, 4);
			}
		});

		it("reads the turn out of a scaled transform, a mesh's currentTransform as it is", () => {
			const axis = new Vector3d(0.2, 1, -0.5);
			const want = new Quaternion().rotate(2.5, axis);
			for (const [sx, sy, sz] of [
				[2, 2, 2],
				[10, 1, 3],
				[0.01, 5, 0.5],
			]) {
				const m = new Matrix3d()
					.translate(4, 5, 6)
					.rotate(2.5, axis.clone().normalize());
				// Matrix3d#scale(x, y, z) scales the columns
				m.scale(sx, sy, sz);
				expectSameRotation(new Quaternion().fromMat3d(m), want, 4);
			}
		});

		it("gives no rotation for a matrix that holds none", () => {
			const zero = new Matrix3d();
			zero.val.fill(0);
			expect(new Quaternion(1, 0, 0, 0).fromMat3d(zero).isIdentity()).toBe(
				true,
			);
			const nan = new Matrix3d();
			nan.val.fill(NaN);
			expect(new Quaternion(1, 0, 0, 0).fromMat3d(nan).isIdentity()).toBe(true);
			const flat = new Matrix3d().scale(1, 1, 0);
			expect(finite(new Quaternion().fromMat3d(flat))).toBe(true);
		});

		it("toMatrix3d writes into out, returns it, and keeps its translation and w", () => {
			const out = new Matrix3d().translate(7, 8, 9);
			const q = randomQuaternion(rng(9));
			expect(q.toMatrix3d(out)).toBe(out);
			expect([out.val[12], out.val[13], out.val[14], out.val[15]]).toEqual([
				7, 8, 9, 1,
			]);
			// two calls without out never share a matrix
			expect(q.toMatrix3d()).not.toBe(q.toMatrix3d());
		});

		it("the matrix turns a vector as the quaternion does", () => {
			const next = rng(31);
			for (let i = 0; i < 20; i++) {
				const q = randomQuaternion(next);
				const v = new Vector3d(next() * 10, next() * 10, next() * 10);
				const viaMatrix = q.toMatrix3d().apply(v.clone());
				const viaQuat = q.apply(v.clone());
				expectVector(viaQuat, viaMatrix.x, viaMatrix.y, viaMatrix.z, 3);
			}
		});

		it("composes in the order matrices do, for any pair", () => {
			const next = rng(64);
			for (let i = 0; i < 20; i++) {
				const a = randomQuaternion(next);
				const b = randomQuaternion(next);
				const m = a.toMatrix3d().multiply(b.toMatrix3d());
				const v = new Vector3d(1, 2, 3);
				const want = m.apply(v.clone());
				const got = a.clone().multiply(b).apply(v.clone());
				expectVector(got, want.x, want.y, want.z, 4);
			}
		});
	});

	describe("degenerate input", () => {
		it("an axis or an angle that is not a number gives no rotation", () => {
			const q = new Quaternion(1, 0, 0, 0);
			for (const [axis, angle] of [
				[new Vector3d(0, 0, 0), 1],
				[new Vector3d(NaN, 0, 0), 1],
				[new Vector3d(Infinity, 0, 0), 1],
				[new Vector3d(0, 1, 0), NaN],
				[new Vector3d(0, 1, 0), Infinity],
				[new Vector3d(0, 1, 0), -Infinity],
			]) {
				expect(
					q.set(1, 0, 0, 0).identity().rotate(angle, axis).isIdentity(),
				).toBe(true);
			}
		});

		it("a whole turn, or many, is no rotation to anything it turns", () => {
			for (const turns of [1, 2, -3, 100]) {
				const q = new Quaternion().rotate(
					turns * 2 * Math.PI,
					new Vector3d(1, 2, 3),
				);
				expectVector(q.apply(new Vector3d(4, 5, 6)), 4, 5, 6, 6);
			}
		});

		it("a short or a huge axis is as good as a unit one", () => {
			const want = new Quaternion().rotate(1, new Vector3d(0, 1, 0));
			for (const len of [1e-3, 1e20, 1e150]) {
				expectSameRotation(
					new Quaternion().rotate(1, new Vector3d(0, len, 0)),
					want,
					10,
				);
			}
		});

		it("an axis too short to turn about turns nothing, as Matrix3d#rotate", () => {
			for (const len of [1e-7, 1e-20, 1e-150]) {
				const axis = new Vector3d(0, len, 0);
				expect(new Quaternion().rotate(1, axis).isIdentity()).toBe(true);
				expect(new Matrix3d().rotate(1, axis).isIdentity()).toBe(true);
			}
		});

		it("normalize and invert never produce NaN", () => {
			for (const bad of [
				[0, 0, 0, 0],
				[NaN, 0, 0, 1],
				[Infinity, 0, 0, 1],
				[0, 0, 0, -Infinity],
			]) {
				expect(new Quaternion(...bad).normalize().isIdentity()).toBe(true);
				expect(finite(new Quaternion(...bad).invert())).toBe(true);
			}
		});

		it("inverts a quaternion that is not of unit length", () => {
			const q = new Quaternion(1, -2, 3, 4);
			const product = q.clone().multiply(q.clone().invert());
			expect(product.equals(new Quaternion(), 1e-12)).toBe(true);
			// and the other way round
			expect(
				q.clone().invert().multiply(q).equals(new Quaternion(), 1e-12),
			).toBe(true);
		});

		it("isIdentity takes either sign of w and of zero, and nothing else", () => {
			expect(new Quaternion(-0, 0, -0, 1).isIdentity()).toBe(true);
			expect(new Quaternion(0, 0, 0, -1).isIdentity()).toBe(true);
			expect(new Quaternion(0, 0, 0, 2).isIdentity()).toBe(false);
			expect(new Quaternion(0, 0, 0, 0).isIdentity()).toBe(false);
			expect(new Quaternion(1e-300, 0, 0, 1).isIdentity()).toBe(false);
			expect(new Quaternion(NaN, 0, 0, 1).isIdentity()).toBe(false);
		});

		it("equals is exact by default, takes a tolerance, and is never true of NaN", () => {
			const a = new Quaternion(0.1, 0.2, 0.3, 0.4);
			expect(a.equals(a.clone())).toBe(true);
			expect(a.equals(new Quaternion(0.1, 0.2, 0.3, 0.4000001))).toBe(false);
			expect(a.equals(new Quaternion(0.1, 0.2, 0.3, 0.4000001), 1e-6)).toBe(
				true,
			);
			const nan = new Quaternion(NaN, 0, 0, 1);
			expect(nan.equals(nan)).toBe(false);
			expect(nan.equals(nan, Infinity)).toBe(false);
			// components, not orientation: q and -q differ here
			expect(new Quaternion().equals(new Quaternion(0, 0, 0, -1))).toBe(false);
		});
	});
});

describe("3D shapes, adversarial", () => {
	const cube = () => {
		// eight corners of a cube from (0,0,0) to (2,4,6)
		const p = [];
		for (const x of [0, 2]) {
			for (const y of [0, 4]) {
				for (const z of [0, 6]) {
					p.push(x, y, z);
				}
			}
		}
		return p;
	};
	const shapes = () => {
		return [
			new Capsule3d(0, 0, 0, 5, 40),
			new ConvexHull3d(cube()),
			new TriangleMesh3d(cube(), [0, 1, 2, 5, 6, 7]),
		];
	};
	const boundsArray = (b) => {
		return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];
	};

	describe("every shape alike", () => {
		it("names its type after its class, as Box3d and Sphere do", () => {
			expect(
				shapes().map((s) => {
					return s.type;
				}),
			).toEqual(["Capsule3d", "ConvexHull3d", "TriangleMesh3d"]);
			expect(new Box3d().type).toBe("Box3d");
		});

		it("shifts by numbers or by a vector, and returns itself", () => {
			for (const s of shapes()) {
				const before = boundsArray(s.getBounds3d());
				expect(s.shift(1, 2, 3)).toBe(s);
				expect(s.shift(new Vector3d(10, 20, 30)).shift(0)).toBe(s);
				const after = boundsArray(s.getBounds3d());
				expect(after).toEqual([
					before[0] + 11,
					before[1] + 22,
					before[2] + 33,
					before[3] + 11,
					before[4] + 22,
					before[5] + 33,
				]);
				expect([s.pos.x, s.pos.y, s.pos.z]).toEqual([11, 22, 33]);
			}
		});

		it("toBox3d, getBounds3d and getBounds agree, wherever pos has been moved to", () => {
			for (const s of shapes()) {
				s.shift(-7, 3, 11);
				// moved through pos directly too, as a body's owner may
				s.pos.x += 2;
				const b = s.getBounds3d();
				const box = s.toBox3d();
				expect(boundsArray(box.getBounds3d())).toEqual(boundsArray(b));
				const flat = s.getBounds();
				expect([flat.min.x, flat.min.y, flat.max.x, flat.max.y]).toEqual([
					b.min.x,
					b.min.y,
					b.max.x,
					b.max.y,
				]);
			}
		});

		it("getBounds3d writes into out and returns it; without one, a fresh box each time", () => {
			for (const s of shapes()) {
				const out = new AABB3d();
				expect(s.getBounds3d(out)).toBe(out);
				const first = s.getBounds3d();
				const kept = boundsArray(first);
				expect(s.getBounds3d()).not.toBe(first);
				// nothing a later call does reaches a box already handed out
				s.shift(100, 100, 100);
				s.getBounds3d();
				s.getBounds();
				s.toBox3d();
				expect(boundsArray(first)).toEqual(kept);
				// and an out that already held something is replaced, not grown
				const dirty = new AABB3d(
					{ x: -1e6, y: -1e6, z: -1e6 },
					{ x: 1e6, y: 1e6, z: 1e6 },
				);
				expect(boundsArray(s.getBounds3d(dirty))).toEqual(
					boundsArray(s.getBounds3d()),
				);
			}
		});

		it("toBox3d is a new box every time, never one of the shape's own", () => {
			for (const s of shapes()) {
				const a = s.toBox3d();
				const b = s.toBox3d();
				expect(a).not.toBe(b);
				a.shift(5, 5, 5);
				expect(boundsArray(s.toBox3d().getBounds3d())).toEqual(
					boundsArray(b.getBounds3d()),
				);
			}
		});

		it("clones deeply: pos and arrays are the clone's own", () => {
			for (const s of shapes()) {
				s.shift(1, 2, 3);
				const c = s.clone();
				expect(c).not.toBe(s);
				expect(c.constructor).toBe(s.constructor);
				expect(c.pos).not.toBe(s.pos);
				expect(boundsArray(c.getBounds3d())).toEqual(
					boundsArray(s.getBounds3d()),
				);
				c.shift(50, 50, 50);
				expect([s.pos.x, s.pos.y, s.pos.z]).toEqual([1, 2, 3]);
				for (const key of ["points", "vertices", "indices"]) {
					if (s[key] !== undefined) {
						expect(c[key]).not.toBe(s[key]);
						expect(c[key].buffer).not.toBe(s[key].buffer);
						expect(Array.from(c[key])).toEqual(Array.from(s[key]));
					}
				}
			}
		});
	});

	describe("Capsule3d", () => {
		it("takes negative sizes as their magnitude, and anything not a number as nothing", () => {
			const c = new Capsule3d(0, 0, 0, -5, -40);
			expect([c.radius, c.height, c.halfSegment]).toEqual([5, 40, 15]);
			for (const bad of [NaN, Infinity, -Infinity, undefined]) {
				const d = new Capsule3d(1, 2, 3, bad, bad);
				expect([d.radius, d.height, d.halfSegment]).toEqual([0, 0, 0]);
				expect(boundsArray(d.getBounds3d())).toEqual([1, 2, 3, 1, 2, 3]);
				expect(d.contains(1, 2, 3)).toBe(true);
				expect(d.contains(1, 2.001, 3)).toBe(false);
			}
			// a default one is a point at the origin, as a default Box3d is
			const empty = new Capsule3d();
			expect(boundsArray(empty.getBounds3d())).toEqual([0, 0, 0, 0, 0, 0]);
			expect(boundsArray(new Box3d().getBounds3d())).toEqual([
				0, 0, 0, 0, 0, 0,
			]);
		});

		it("is never inside out, even when radius and height are written apart", () => {
			const c = new Capsule3d(0, 0, 0, 5, 40);
			// fatter than it is tall: a sphere of that radius
			c.radius = 30;
			expect(c.halfSegment).toBe(0);
			expect(boundsArray(c.getBounds3d())).toEqual([-30, -30, -30, 30, 30, 30]);
			const box = c.toBox3d();
			expect([box.width, box.height, box.depth]).toEqual([60, 60, 60]);
			const flat = c.getBounds();
			expect([flat.min.y, flat.max.y]).toEqual([-30, 30]);
			expect(c.contains(0, 29, 0)).toBe(true);
			expect(c.contains(0, 31, 0)).toBe(false);
			// a height that is not a number
			c.height = NaN;
			expect(c.halfSegment).toBe(0);
			// a negative radius is its magnitude, as on a Sphere
			c.height = 100;
			c.radius = -10;
			expect(c.halfSegment).toBe(40);
			expect(boundsArray(c.getBounds3d())).toEqual([-10, -50, -10, 10, 50, 10]);
		});

		it("contains its surface, and nothing beyond it", () => {
			const c = new Capsule3d(10, 20, 30, 5, 40);
			// the two poles, and the waist
			expect(c.contains(10, 0, 30)).toBe(true);
			expect(c.contains(10, 40, 30)).toBe(true);
			expect(c.contains(15, 20, 30)).toBe(true);
			expect(c.contains(10, 20, 25)).toBe(true);
			expect(c.contains(10, -0.001, 30)).toBe(false);
			expect(c.contains(15.001, 20, 30)).toBe(false);
			// the corner of its bounding box is outside the rounded end
			expect(c.contains(15, 0, 35)).toBe(false);
			// beside the rounded end, off the axis
			expect(c.contains(13, 1, 30)).toBe(true);
			expect(c.contains(14, 1, 30)).toBe(false);
			// a vector and three numbers are the same question
			expect(c.contains(new Vector3d(13, 1, 30))).toBe(true);
			expect(c.contains(new Vector3d(14, 1, 30))).toBe(false);
			expect(c.contains(NaN, 20, 30)).toBe(false);
		});

		it("setShape returns the capsule and replaces everything", () => {
			const c = new Capsule3d(1, 1, 1, 1, 10);
			expect(c.setShape(4, 5, 6, 2, 3)).toBe(c);
			// shorter than its two ends: a sphere of that radius
			expect([c.pos.x, c.pos.y, c.pos.z, c.radius, c.height]).toEqual([
				4, 5, 6, 2, 4,
			]);
		});
	});

	describe("ConvexHull3d and TriangleMesh3d", () => {
		it("copy what they are given: the source can change afterwards", () => {
			const points = new Float32Array(cube());
			const indices = new Uint16Array([0, 1, 2]);
			const hull = new ConvexHull3d(points);
			const mesh = new TriangleMesh3d(points, indices);
			points.fill(99);
			indices.fill(7);
			expect(Array.from(hull.points)).toEqual(cube());
			expect(Array.from(mesh.vertices)).toEqual(cube());
			expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
			expect(hull.points).toBeInstanceOf(Float32Array);
			expect(mesh.indices).toBeInstanceOf(Uint32Array);
		});

		it("leave a vertex that is not a number out of the bounds", () => {
			const p = cube();
			p.push(NaN, 0, 0, Infinity, 1, 1, 0, -Infinity, 0);
			const hull = new ConvexHull3d(p);
			expect(boundsArray(hull.getBounds3d())).toEqual([0, 0, 0, 2, 4, 6]);
			const box = hull.toBox3d();
			expect([box.width, box.height, box.depth]).toEqual([2, 4, 6]);
			// nothing but such vertices: a point at pos, never an infinite box
			const none = new ConvexHull3d(new Array(12).fill(NaN));
			none.shift(3, 4, 5);
			expect(boundsArray(none.getBounds3d())).toEqual([3, 4, 5, 3, 4, 5]);
			const point = none.toBox3d();
			expect([point.width, point.height, point.depth]).toEqual([0, 0, 0]);
			expect([point.pos.x, point.pos.y, point.pos.z]).toEqual([3, 4, 5]);
		});

		it("a hull needs four whole points", () => {
			expect(() => {
				return new ConvexHull3d([]);
			}).toThrow(/at least four points \(got 0\)/);
			expect(() => {
				return new ConvexHull3d(new Array(9).fill(0));
			}).toThrow(/at least four points \(got 3\)/);
			expect(() => {
				return new ConvexHull3d(new Array(13).fill(0));
			}).toThrow(/x, y, z triples \(got 13 numbers\)/);
		});

		it("a mesh refuses an index that names no vertex, whatever kind", () => {
			const v = cube();
			for (const bad of [8, -1, 1.5, NaN, Infinity]) {
				expect(() => {
					return new TriangleMesh3d(v, [0, 1, bad]);
				}).toThrow(/names no vertex/);
			}
			expect(() => {
				return new TriangleMesh3d(v, [0, 1]);
			}).toThrow(/in threes/);
			expect(() => {
				return new TriangleMesh3d([0, 0, 0, 1], [0, 0, 0]);
			}).toThrow(/x, y, z triples/);
			// an index into no vertices at all
			expect(() => {
				return new TriangleMesh3d([], [0, 0, 0]);
			}).toThrow(/names no vertex/);
		});

		it("an empty mesh is a mesh of no triangles at pos", () => {
			const t = new TriangleMesh3d([]);
			expect(t.triangleCount).toBe(0);
			t.shift(1, 2, 3);
			expect(boundsArray(t.getBounds3d())).toEqual([1, 2, 3, 1, 2, 3]);
			// vertices that do not fill a last triangle are kept, unused
			const odd = new TriangleMesh3d(new Array(12).fill(0));
			expect(odd.triangleCount).toBe(1);
			expect(odd.vertices.length).toBe(12);
			// a degenerate triangle is the caller's to give
			expect(new TriangleMesh3d(cube(), [0, 0, 0]).triangleCount).toBe(1);
		});
	});

	describe("fromMesh", () => {
		/** a small irregular solid, as a loaded glTF part would be */
		const solid = (settings = {}) => {
			return new Mesh(0, 0, {
				vertices: new Float32Array([
					0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 0.25, -0.75,
				]),
				uvs: new Float32Array(10),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2, 4, 1, 0]),
				width: 10,
				height: 10,
				scale: 10,
				normalize: false,
				...settings,
			});
		};
		const place = (mesh) => {
			mesh.pos.set(37, -12, 0);
			mesh.depth = 55;
			mesh.currentTransform
				.translate(0.5, -0.25, 2)
				.rotate(0.7, new Vector3d(0, 1, 0))
				.rotate(-1.1, new Vector3d(1, 0, 0));
			mesh.currentTransform.scale(2, 1, 3);
		};

		it("is the mesh's own drawn vertices less its pos, for both handednesses", () => {
			for (const rightHanded of [false, true]) {
				const mesh = solid({ rightHanded });
				place(mesh);
				const tri = TriangleMesh3d.fromMesh(mesh);
				const hull = ConvexHull3d.fromMesh(mesh);
				// what the mesh hands the renderer under a Camera3d
				mesh._projectVerticesWorld(mesh.pos.x, mesh.pos.y, mesh.depth);
				const at = [mesh.pos.x, mesh.pos.y, mesh.depth];
				expect(tri.vertices.length).toBe(mesh.vertexCount * 3);
				for (let i = 0; i < mesh.vertexCount * 3; i++) {
					const drawn = mesh.vertices[i] - at[i % 3];
					expect(tri.vertices[i]).toBeCloseTo(drawn, 3);
					expect(hull.points[i]).toBeCloseTo(drawn, 3);
				}
				// and its bounds are the mesh's own, less its pos
				const world = mesh.getBounds3d();
				const local = tri.getBounds3d();
				expect(local.min.x + at[0]).toBeCloseTo(world.min.x, 3);
				expect(local.max.y + at[1]).toBeCloseTo(world.max.y, 3);
				expect(local.min.z + at[2]).toBeCloseTo(world.min.z, 3);
				expect(local.max.z + at[2]).toBeCloseTo(world.max.z, 3);
			}
		});

		it("the two handednesses differ by the sign of z, and only by that", () => {
			const left = solid({ rightHanded: false });
			const right = solid({ rightHanded: true });
			place(left);
			place(right);
			const a = TriangleMesh3d.fromMesh(left).vertices;
			const b = TriangleMesh3d.fromMesh(right).vertices;
			for (let i = 0; i < a.length; i += 3) {
				expect(b[i]).toBeCloseTo(a[i], 5);
				expect(b[i + 1]).toBeCloseTo(a[i + 1], 5);
				expect(b[i + 2]).toBeCloseTo(-a[i + 2], 5);
			}
		});

		it("keeps the triangles in the order the mesh was loaded with", () => {
			for (const rightHanded of [false, true]) {
				const mesh = solid({ rightHanded });
				const loaded = [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2, 4, 1, 0];
				// drawing may reorder the mesh's indices; the shape must not follow
				mesh._projectVerticesWorld(0, 0, 0);
				const tri = TriangleMesh3d.fromMesh(mesh);
				expect(Array.from(tri.indices)).toEqual(loaded);
				expect(tri.triangleCount).toBe(5);
			}
		});

		it("shares nothing with the mesh: neither changes the other afterwards", () => {
			const mesh = solid();
			const original = Array.from(mesh.originalVertices);
			const tri = TriangleMesh3d.fromMesh(mesh);
			const hull = ConvexHull3d.fromMesh(mesh);
			const baked = Array.from(tri.vertices);
			expect(tri.vertices.buffer).not.toBe(mesh.originalVertices.buffer);
			expect(tri.vertices.buffer).not.toBe(mesh.vertices.buffer);
			expect(hull.points.buffer).not.toBe(tri.vertices.buffer);
			expect(tri.indices.buffer).not.toBe(mesh.indices.buffer);
			// the shape is edited: the mesh is as it was
			tri.vertices.fill(0);
			tri.indices.fill(0);
			hull.points.fill(0);
			expect(Array.from(mesh.originalVertices)).toEqual(original);
			// the mesh is turned and drawn: the shape made before is as it was
			const again = TriangleMesh3d.fromMesh(mesh);
			mesh.currentTransform.rotate(1, new Vector3d(0, 0, 1));
			mesh._projectVerticesWorld(5, 5, 5);
			expect(Array.from(again.vertices)).toEqual(baked);
			// the mesh's pos is not baked in: a shape is relative to it
			mesh.currentTransform.identity();
			mesh.pos.set(1000, 1000, 0);
			expect(Array.from(TriangleMesh3d.fromMesh(mesh).vertices)).toEqual(baked);
		});

		it("reads a plain object that has what a mesh has", () => {
			const tri = TriangleMesh3d.fromMesh({
				originalVertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
				vertexCount: 3,
				currentTransform: new Matrix3d(),
				meshScale: 2,
			});
			// Y-up geometry in a Y-down world
			expect(Array.from(tri.vertices)).toEqual([0, -0, 0, 2, -0, 0, 0, -2, 0]);
			expect(Array.from(tri.indices)).toEqual([0, 1, 2]);
		});
	});

	describe("on a built-in body", () => {
		const holder = () => {
			const r = new Renderable(0, 0, 10, 10);
			r.isKinematic = false;
			return r;
		};

		it("the stand-in box sits where the shape is, offset included, and the shape is untouched", () => {
			for (const shape of shapes()) {
				shape.shift(100, -50, 25);
				const before = boundsArray(shape.getBounds3d());
				const body = new Body(holder(), shape);
				const box = body.shapes[0];
				expect(box).toBeInstanceOf(Box3d);
				expect(box).not.toBe(shape);
				expect(boundsArray(box.getBounds3d())).toEqual(before);
				expect(boundsArray(shape.getBounds3d())).toEqual(before);
				expect(body.hasDepth).toBe(true);
				// the body's own 2D bounds cover the footprint
				const b = body.getBounds();
				expect(b.min.x).toBeCloseTo(before[0], 5);
				expect(b.max.y).toBeCloseTo(before[4], 5);
				// moving the source afterwards does not move the body's box
				shape.shift(1000, 1000, 1000);
				expect(boundsArray(box.getBounds3d())).toEqual(before);
			}
		});

		it("adds beside other shapes, and the body is torn down without a throw", () => {
			const body = new Body(holder(), new Box3d(0, 0, 0, 10, 10, 10));
			for (const shape of shapes()) {
				body.addShape(shape);
			}
			expect(body.shapes.length).toBe(4);
			expect(
				body.shapes.every((s) => {
					return s instanceof Box3d;
				}),
			).toBe(true);
			// removing one stand-in rebuilds the rest
			expect(body.removeShapeAt(1)).toBe(3);
			expect(body.hasDepth).toBe(true);
			expect(() => {
				body.destroy();
			}).not.toThrow();
		});

		it("a degenerate shape still makes a body that steps without NaN", () => {
			const adapter = new BuiltinAdapter({ gravity: new Vector2d(0, 1) });
			// eslint-disable-next-line no-new
			new World(0, 0, 800, 600, adapter);
			for (const shape of [
				new Capsule3d(),
				new Capsule3d(0, 0, 0, NaN, NaN),
				new ConvexHull3d(new Array(12).fill(0)),
				new ConvexHull3d(new Array(12).fill(NaN)),
				new TriangleMesh3d([]),
			]) {
				const r = new Renderable(10, 10, 4, 4);
				r.alwaysUpdate = true;
				const body = adapter.addBody(r, { type: "dynamic", shapes: [shape] });
				expect(body.shapes[0]).toBeInstanceOf(Box3d);
				for (let i = 0; i < 5; i++) {
					adapter.step(16);
				}
				expect(Number.isFinite(r.pos.x)).toBe(true);
				expect(Number.isFinite(r.pos.y)).toBe(true);
				expect(Number.isFinite(r.pos.z)).toBe(true);
				const bounds = body.getBounds();
				expect(Number.isFinite(bounds.width)).toBe(true);
				expect(Number.isFinite(bounds.height)).toBe(true);
			}
		});
	});
});

describe("BuiltinAdapter 3D interface, adversarial", () => {
	/** @type {BuiltinAdapter} */
	let adapter;

	beforeEach(() => {
		adapter = new BuiltinAdapter({ gravity: new Vector2d(0, 0) });
		// eslint-disable-next-line no-new
		new World(0, 0, 800, 600, adapter);
	});

	const make = (
		shape = new Rect(0, 0, 32, 32),
		type = "dynamic",
		on = adapter,
	) => {
		const r = new Renderable(100, 100, 32, 32);
		r.alwaysUpdate = true;
		const body = on.addBody(r, { type, shapes: [shape] });
		return { r, body };
	};

	describe("a Vector2d call is the call it always was", () => {
		it("every Vector2d input leaves the depth fields exactly as they were", () => {
			const { r, body } = make();
			body.velZ = 3;
			body.forceZ = 4;
			r.depth = 5;
			adapter.setVelocity(r, new Vector2d(1, 2));
			adapter.applyImpulse(r, new Vector2d(10, 20));
			adapter.applyForce(r, new Vector2d(1, 1));
			adapter.applyForce(r, new Vector2d(1, 1), new Vector2d(0, 0));
			adapter.setPosition(r, new Vector2d(7, 8));
			expect(body.velZ).toBe(3);
			expect(body.forceZ).toBe(4);
			expect(r.depth).toBe(5);
			expect([r.pos.x, r.pos.y, r.pos.z]).toEqual([7, 8, 5]);
		});

		it("gives the same x and y as the Vector3d call with the same x and y", () => {
			const a = make();
			const b = make();
			for (const [x, y] of [
				[3, -4],
				[0, 0],
				[-1e6, 1e-6],
			]) {
				adapter.setVelocity(a.r, new Vector2d(x, y));
				adapter.setVelocity(b.r, new Vector3d(x, y, 9));
				adapter.applyImpulse(a.r, new Vector2d(y, x));
				adapter.applyImpulse(b.r, new Vector3d(y, x, 9));
				adapter.applyForce(a.r, new Vector2d(x, y), new Vector2d(1, 2));
				adapter.applyForce(b.r, new Vector3d(x, y, 9), new Vector3d(1, 2, 3));
				expect([a.body.vel.x, a.body.vel.y]).toEqual([
					b.body.vel.x,
					b.body.vel.y,
				]);
				expect([a.body.force.x, a.body.force.y]).toEqual([
					b.body.force.x,
					b.body.force.y,
				]);
				expect(a.body.torque).toBe(b.body.torque);
			}
		});

		it("a plain { x, y } is taken as a Vector2d is", () => {
			const { r, body } = make();
			body.velZ = 2;
			adapter.setVelocity(r, { x: 5, y: 6 });
			adapter.applyImpulse(r, { x: 1, y: 1 });
			adapter.setPosition(r, { x: 1, y: 2 });
			expect(body.velZ).toBe(2);
			expect(Number.isFinite(body.vel.x)).toBe(true);
			// a z that is not a number is no z
			adapter.setVelocity(r, { x: 5, y: 6, z: undefined });
			adapter.setVelocity(r, { x: 5, y: 6, z: null });
			adapter.setVelocity(r, { x: 5, y: 6, z: "7" });
			expect(body.velZ).toBe(2);
		});

		it("the body handle without a z is the two-argument call it was", () => {
			const { body } = make();
			body.velZ = 4;
			body.setVelocity(1, 2);
			body.setVelocity(1, 2, undefined);
			body.applyImpulse(3, 4);
			body.applyImpulse(3, 4, undefined);
			expect(body.velZ).toBe(4);
			const flat = body.getVelocity(new Vector2d());
			const deep = body.getVelocity3d(new Vector3d());
			expect([deep.x, deep.y, deep.z]).toEqual([flat.x, flat.y, 4]);
		});

		it("the adapter and the body handle are one implementation", () => {
			const a = make();
			const b = make();
			a.body.setMass(4);
			b.body.setMass(4);
			adapter.setVelocity(a.r, new Vector3d(1, 2, 3));
			b.body.setVelocity(1, 2, 3);
			adapter.applyImpulse(a.r, new Vector3d(8, -8, 2));
			b.body.applyImpulse(8, -8, 2);
			expect([a.body.vel.x, a.body.vel.y, a.body.velZ]).toEqual([
				b.body.vel.x,
				b.body.vel.y,
				b.body.velZ,
			]);
			expect(a.body.velZ).toBe(3.5);
		});
	});

	describe("depth through a step", () => {
		it("a force along Z accelerates by force over mass, and is spent by the step", () => {
			const { r, body } = make(new Box3d(0, 0, 0, 32, 32, 32));
			adapter.setMaxVelocity(r, { x: 100, y: 100 });
			body.maxVelZ = 100;
			adapter.applyForce(r, new Vector3d(0, 0, 6));
			adapter.applyForce(r, new Vector3d(0, 0, 6));
			expect(body.forceZ).toBe(12);
			adapter.step(16);
			expect(body.forceZ).toBe(0);
			expect(body.velZ).toBeGreaterThan(0);
			const after = body.velZ;
			// no force left: nothing more is added
			adapter.step(16);
			expect(body.velZ).toBeCloseTo(after, 10);
		});

		it("a static body takes no depth motion from gravity along Z", () => {
			const a = new BuiltinAdapter({ gravity: new Vector3d(0, 0, 1) });
			// eslint-disable-next-line no-new
			new World(0, 0, 800, 600, a);
			const fixed = make(new Box3d(0, 0, 0, 32, 32, 32), "static", a);
			const free = make(new Box3d(0, 0, 0, 32, 32, 32), "dynamic", a);
			free.r.pos.x = 500;
			const off = make(new Box3d(0, 0, 0, 32, 32, 32), "dynamic", a);
			off.r.pos.x = 300;
			off.body.ignoreGravity = true;
			const scaled = make(new Box3d(0, 0, 0, 32, 32, 32), "dynamic", a);
			scaled.r.pos.y = 400;
			a.setGravityScale(scaled.r, 0);
			for (let i = 0; i < 5; i++) {
				a.step(16);
			}
			expect(fixed.r.pos.z).toBe(0);
			expect(off.r.pos.z).toBe(0);
			expect(scaled.r.pos.z).toBe(0);
			expect(free.r.pos.z).toBeGreaterThan(0);
		});

		it("gravity can be swapped between a Vector2d and a Vector3d at run time", () => {
			const { r, body } = make(new Box3d(0, 0, 0, 32, 32, 32));
			adapter.gravity = new Vector3d(0, 0, 1);
			adapter.step(16);
			expect(body.velZ).toBeGreaterThan(0);
			adapter.setVelocity(r, new Vector3d(0, 0, 0));
			adapter.gravity = new Vector2d(0, 0);
			adapter.step(16);
			expect(body.velZ).toBe(0);
			// and mutated in place
			adapter.gravity = new Vector3d(0, 0, 0);
			adapter.gravity.z = -1;
			adapter.step(16);
			expect(body.velZ).toBeLessThan(0);
		});
	});

	describe("mass and non-finite input", () => {
		it("a body of no mass takes no impulse on any axis, and no NaN", () => {
			const { r, body } = make();
			body.setMass(0);
			body.velZ = 1;
			adapter.applyImpulse(r, new Vector3d(5, 5, 5));
			body.applyImpulse(5, 5, 5);
			expect([body.vel.x, body.vel.y, body.velZ]).toEqual([0, 0, 1]);
		});

		it("a Vector3d with z 0 is a z, not a missing one", () => {
			// a body that lives in 3D: a flat one keeps its depth on setPosition
			const { r, body } = make(new Box3d(0, 0, 0, 32, 32, 32));
			body.velZ = 5;
			adapter.setVelocity(r, new Vector3d(1, 1, 0));
			expect(body.velZ).toBe(0);
			r.depth = 9;
			adapter.setPosition(r, new Vector3d(1, 1, 0));
			expect(r.depth).toBe(0);
			adapter.setVelocity(r, new Vector3d(1, 1, -0));
			expect(Object.is(body.velZ, -0) || body.velZ === 0).toBe(true);
		});

		it("setRotation with a quaternion that is not a number leaves the angle alone", () => {
			const { r, body } = make();
			body.setAngle(0.4);
			for (const bad of [
				new Quaternion(NaN, NaN, NaN, NaN),
				new Quaternion(0, 0, NaN, 1),
				new Quaternion(Infinity, 0, 0, 1),
				new Quaternion(0, 0, Infinity, Infinity),
			]) {
				adapter.setRotation(r, bad);
				expect(body.angle).toBe(0.4);
			}
			// a quaternion of no length turns nothing: +X stays +X
			adapter.setRotation(r, new Quaternion(0, 0, 0, 0));
			expect(body.angle).toBe(0);
		});
	});

	describe("rotation", () => {
		it("round-trips every angle through getRotation and setRotation, the same out reused", () => {
			const { r, body } = make();
			const q = new Quaternion();
			for (let angle = -Math.PI + 0.01; angle < Math.PI; angle += 0.37) {
				body.setAngle(angle);
				expect(adapter.getRotation(r, q)).toBe(q);
				body.setAngle(0);
				adapter.setRotation(r, q);
				expect(body.angle).toBeCloseTo(angle, 10);
				// setRotation reads q and leaves it as it was
				expectSameRotation(
					q,
					new Quaternion().rotate(angle, new Vector3d(0, 0, 1)),
					12,
				);
			}
		});

		it("a half turn about Z is a half turn, and -q is the same turn as q", () => {
			const { r, body } = make();
			const q = new Quaternion().rotate(Math.PI, new Vector3d(0, 0, 1));
			adapter.setRotation(r, q);
			expect(Math.abs(body.angle)).toBeCloseTo(Math.PI, 10);
			const turn = new Quaternion().rotate(0.8, new Vector3d(0, 0, 1));
			adapter.setRotation(
				r,
				new Quaternion(-turn.x, -turn.y, -turn.z, -turn.w),
			);
			expect(body.angle).toBeCloseTo(0.8, 10);
		});

		it("turning the body turns its renderable as setAngle does", () => {
			const a = make();
			const b = make();
			adapter.setAngle(a.r, 0.6);
			adapter.setRotation(
				b.r,
				new Quaternion().rotate(0.6, new Vector3d(0, 0, 1)),
			);
			expect(b.body.angle).toBeCloseTo(a.body.angle, 12);
			for (let i = 0; i < 16; i++) {
				expect(b.r.currentTransform.val[i]).toBeCloseTo(
					a.r.currentTransform.val[i],
					6,
				);
			}
		});

		it("the 3D readers never return the same object twice, nor a shared one", () => {
			const { r } = make();
			expect(adapter.getRotation(r)).not.toBe(adapter.getRotation(r));
			expect(adapter.getVelocity3d(r)).not.toBe(adapter.getVelocity3d(r));
			expect(adapter.getAngularVelocity3d(r)).not.toBe(
				adapter.getAngularVelocity3d(r),
			);
			// an out that held something else is overwritten in full
			const v = new Vector3d(9, 9, 9);
			adapter.setAngularVelocity(r, 0.25);
			expect(adapter.getAngularVelocity3d(r, v)).toBe(v);
			expect([v.x, v.y, v.z]).toEqual([0, 0, 0.25]);
			adapter.setAngularVelocity(r, new Vector3d(5, 6, -0.5));
			expect(adapter.getAngularVelocity(r)).toBe(-0.5);
		});
	});

	describe("bodies that are gone, or never were", () => {
		it("the readers answer for a removed body and for a renderable with none", () => {
			const { r } = make();
			adapter.setVelocity(r, new Vector3d(7, 8, 9));
			adapter.removeBody(r);
			const out = new Vector3d(1, 1, 1);
			expect(adapter.getVelocity3d(r, out)).toBe(out);
			expect([out.x, out.y, out.z]).toEqual([0, 0, 0]);
			const flat = adapter.getVelocity(r);
			expect([flat.x, flat.y]).toEqual([0, 0]);

			const bare = new Renderable(0, 0, 1, 1);
			expect(adapter.getRotation(bare).isIdentity()).toBe(true);
			const w = adapter.getAngularVelocity3d(bare);
			expect([w.x, w.y, w.z]).toEqual([0, 0, 0]);
			const v = adapter.getVelocity3d(bare);
			expect([v.x, v.y, v.z]).toEqual([0, 0, 0]);
		});

		it("a body from another adapter reads as still on this one", () => {
			const other = new BuiltinAdapter({ gravity: new Vector2d(0, 0) });
			// eslint-disable-next-line no-new
			new World(0, 0, 800, 600, other);
			const { r } = make(undefined, "dynamic", other);
			other.setVelocity(r, new Vector3d(1, 2, 3));
			const mine = adapter.getVelocity3d(r);
			expect([mine.x, mine.y, mine.z]).toEqual([0, 0, 0]);
			const theirs = other.getVelocity3d(r);
			expect([theirs.x, theirs.y, theirs.z]).toEqual([1, 2, 3]);
		});
	});
});
