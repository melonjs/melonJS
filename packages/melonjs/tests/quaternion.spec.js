import { describe, expect, it } from "vitest";
import { Matrix3d, Quaternion, Vector3d } from "../src/index.js";

/**
 * Quaternion against an independent reference: Matrix3d#rotate, which the
 * engine already uses for every 3D turn. A quaternion that disagrees with it
 * on a direction, an order or a sign is wrong, however self-consistent.
 */

const X = new Vector3d(1, 0, 0);
const Y = new Vector3d(0, 1, 0);
const Z = new Vector3d(0, 0, 1);

const close = (a, b, digits = 5) => {
	expect(a.x).toBeCloseTo(b.x, digits);
	expect(a.y).toBeCloseTo(b.y, digits);
	expect(a.z).toBeCloseTo(b.z, digits);
};
// the same orientation: q and -q are equal rotations
const sameRotation = (a, b, digits = 5) => {
	const sign = a.dot(b) < 0 ? -1 : 1;
	expect(a.x).toBeCloseTo(b.x * sign, digits);
	expect(a.y).toBeCloseTo(b.y * sign, digits);
	expect(a.z).toBeCloseTo(b.z * sign, digits);
	expect(a.w).toBeCloseTo(b.w * sign, digits);
};
const rotated = (m, v) => {
	return m.apply(v.clone());
};
// a reproducible spread of axes and angles, the awkward ones included
const CASES = [
	[X, 0],
	[X, Math.PI / 2],
	[Y, -Math.PI / 3],
	[Z, Math.PI],
	[X, Math.PI],
	[Y, Math.PI],
	[new Vector3d(1, 1, 1), 2.1],
	[new Vector3d(-0.3, 0.8, 0.5), -2.9],
	[new Vector3d(0.2, -1, 0.1), 3.1],
	[new Vector3d(5, 0, -2), 0.0001],
];

describe("Quaternion", () => {
	it("starts as no rotation", () => {
		const q = new Quaternion();
		expect(q.toArray()).toEqual([0, 0, 0, 1]);
		expect(q.isIdentity()).toBe(true);
		expect(new Quaternion(0, 0, 0, -1).isIdentity()).toBe(true);
		expect(new Quaternion(0, 0.1, 0, 1).isIdentity()).toBe(false);
		close(q.apply(new Vector3d(3, -4, 5)), new Vector3d(3, -4, 5));
	});

	it("turns a vector as Matrix3d#rotate does, about any axis", () => {
		for (const [axis, angle] of CASES) {
			const q = new Quaternion().rotate(angle, axis);
			const m = new Matrix3d().rotate(angle, axis.clone().normalize());
			for (const v of [X, Y, Z, new Vector3d(2, -3, 7)]) {
				close(q.apply(v.clone()), rotated(m, v), 4);
			}
		}
	});

	it("follows the right-hand rule in the engine's space", () => {
		// a quarter turn about +Z takes +X to +Y
		const q = new Quaternion().rotate(Math.PI / 2, Z);
		close(q.apply(X.clone()), Y);
	});

	it("does not mind the axis's length", () => {
		const unit = new Quaternion().rotate(1, Y);
		const long = new Quaternion().rotate(1, new Vector3d(0, 40, 0));
		sameRotation(unit, long);
		expect(long.length()).toBeCloseTo(1);
	});

	it("is no rotation for an axis of no length, rather than NaN", () => {
		for (const axis of [
			new Vector3d(0, 0, 0),
			new Vector3d(Number.NaN, 0, 0),
			new Vector3d(Number.POSITIVE_INFINITY, 0, 0),
		]) {
			const q = new Quaternion(1, 2, 3, 4).identity().rotate(1, axis);
			expect(q.isIdentity()).toBe(true);
		}
	});

	it("writes the same matrix Matrix3d#rotate builds", () => {
		for (const [axis, angle] of CASES) {
			const q = new Quaternion().rotate(angle, axis);
			const m = new Matrix3d().rotate(angle, axis.clone().normalize());
			const fromQ = q.toMatrix3d();
			expect(fromQ).toBeInstanceOf(Matrix3d);
			for (let i = 0; i < 16; i++) {
				expect(fromQ.val[i]).toBeCloseTo(m.val[i], 4);
			}
		}
	});

	it("leaves the translation of the matrix it writes into alone", () => {
		const m = new Matrix3d().translate(10, 20, 30);
		new Quaternion().rotate(1, Y).toMatrix3d(m);
		expect([m.val[12], m.val[13], m.val[14], m.val[15]]).toEqual([
			10, 20, 30, 1,
		]);
	});

	it("reads back the rotation of a matrix, on every branch", () => {
		// the 180° turns take the branches where w is near 0
		for (const [axis, angle] of CASES) {
			const q = new Quaternion().rotate(angle, axis);
			const back = new Quaternion().fromMat3d(q.toMatrix3d());
			sameRotation(back, q, 4);
		}
	});

	it("composes in matrix order: a.multiply(b) applies b first", () => {
		const a = new Quaternion().rotate(Math.PI / 2, Z);
		const b = new Quaternion().rotate(Math.PI / 2, X);
		const ab = a.clone().multiply(b);
		const m = new Matrix3d()
			.rotate(Math.PI / 2, Z)
			.multiply(new Matrix3d().rotate(Math.PI / 2, X));
		for (const v of [X, Y, Z]) {
			close(ab.apply(v.clone()), rotated(m, v));
		}
		// and premultiply the other way round
		const ba = a.clone().premultiply(b);
		const n = new Matrix3d()
			.rotate(Math.PI / 2, X)
			.multiply(new Matrix3d().rotate(Math.PI / 2, Z));
		for (const v of [X, Y, Z]) {
			close(ba.apply(v.clone()), rotated(n, v));
		}
	});

	it("inverts: a turn and its inverse cancel", () => {
		for (const [axis, angle] of CASES) {
			const q = new Quaternion().rotate(angle, axis);
			const back = q.clone().multiply(q.clone().invert());
			expect(back.isIdentity() || back.equals(new Quaternion(), 1e-6)).toBe(
				true,
			);
		}
		// a zero quaternion has no inverse: no rotation rather than NaN
		expect(new Quaternion(0, 0, 0, 0).invert().isIdentity()).toBe(true);
	});

	it("slerps along the shortest arc, at an even speed", () => {
		const a = new Quaternion();
		const b = new Quaternion().rotate(Math.PI / 2, Y);
		sameRotation(a.clone().slerp(b, 0), a);
		sameRotation(a.clone().slerp(b, 1), b);
		sameRotation(
			a.clone().slerp(b, 0.5),
			new Quaternion().rotate(Math.PI / 4, Y),
		);
		// -b is the same orientation: the result must not take the long way
		const negB = new Quaternion(-b.x, -b.y, -b.z, -b.w);
		sameRotation(
			a.clone().slerp(negB, 0.5),
			new Quaternion().rotate(Math.PI / 4, Y),
		);
	});

	it("slerps between two nearly equal turns without NaN", () => {
		const a = new Quaternion().rotate(1, Y);
		const b = new Quaternion().rotate(1 + 1e-9, Y);
		const mid = a.clone().slerp(b, 0.5);
		expect(mid.toArray().every(Number.isFinite)).toBe(true);
		expect(mid.length()).toBeCloseTo(1);
	});

	it("normalizes a drifted quaternion, and a zero one to no rotation", () => {
		const q = new Quaternion(0, 2, 0, 0).normalize();
		expect(q.toArray()).toEqual([0, 1, 0, 0]);
		expect(new Quaternion(0, 0, 0, 0).normalize().isIdentity()).toBe(true);
		expect(new Quaternion(Number.NaN, 0, 0, 1).normalize().isIdentity()).toBe(
			true,
		);
	});

	it("reads and writes glTF's [x, y, z, w] order", () => {
		const q = new Quaternion().fromArray([0.1, 0.2, 0.3, 0.9]);
		expect(q.toArray()).toEqual([0.1, 0.2, 0.3, 0.9]);
		expect(q.clone()).not.toBe(q);
		expect(q.clone().equals(q)).toBe(true);
		expect(new Quaternion().copy(q).equals(q)).toBe(true);
		expect(String(q)).toBe("x:0.1,y:0.2,z:0.3,w:0.9");
	});
});
