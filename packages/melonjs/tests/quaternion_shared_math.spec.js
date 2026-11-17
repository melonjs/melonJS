/**
 * The rotation arithmetic `Quaternion`, `Matrix3d` and the glTF animation now
 * share (`math/rotation.ts`), and the API built on it: `Matrix3d#compose`,
 * `Matrix3d#rotate(q)` / `Renderable#rotate(q)` and
 * `Quaternion#setFromUnitVectors`.
 *
 * The references are copies of the code the shared arithmetic replaced: the
 * glTF loader's TRS composition, its sampler's slerp and the class's own
 * slerp and matrix, so a change in what they compute shows here.
 */
import { describe, expect, it } from "vitest";
import {
	Matrix2d,
	Matrix3d,
	Quaternion,
	Renderable,
	Vector3d,
} from "../src/index.js";
import { slerpQuat } from "../src/level/gltf/gltf_sampler.js";
import { composeTRSInto } from "../src/loader/parsers/gltf.js";
import { slerpInto, writeRotationScale } from "../src/math/rotation.ts";

// ── the code it replaced ─────────────────────────────────────────────────

/** the glTF loader's composeTRSInto, as it was */
const oldCompose = (out, [tx, ty, tz], [qx, qy, qz, qw], [sx, sy, sz]) => {
	const x2 = qx + qx;
	const y2 = qy + qy;
	const z2 = qz + qz;
	const xx = qx * x2;
	const xy = qx * y2;
	const xz = qx * z2;
	const yy = qy * y2;
	const yz = qy * z2;
	const zz = qz * z2;
	const wx = qw * x2;
	const wy = qw * y2;
	const wz = qw * z2;
	out[0] = (1 - (yy + zz)) * sx;
	out[1] = (xy + wz) * sx;
	out[2] = (xz - wy) * sx;
	out[3] = 0;
	out[4] = (xy - wz) * sy;
	out[5] = (1 - (xx + zz)) * sy;
	out[6] = (yz + wx) * sy;
	out[7] = 0;
	out[8] = (xz + wy) * sz;
	out[9] = (yz - wx) * sz;
	out[10] = (1 - (xx + yy)) * sz;
	out[11] = 0;
	out[12] = tx;
	out[13] = ty;
	out[14] = tz;
	out[15] = 1;
	return out;
};

/** the class's slerp, as it was (and, but for its cut-off, the sampler's) */
const oldSlerp = (a, b, t, epsilon = 1e-6) => {
	let [bx, by, bz, bw] = b;
	let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
	if (cos < 0) {
		cos = -cos;
		bx = -bx;
		by = -by;
		bz = -bz;
		bw = -bw;
	}
	let wa;
	let wb;
	if (1 - cos < epsilon) {
		wa = 1 - t;
		wb = t;
	} else {
		const angle = Math.acos(Math.min(cos, 1));
		const sin = Math.sin(angle);
		wa = Math.sin((1 - t) * angle) / sin;
		wb = Math.sin(t * angle) / sin;
	}
	const r = [
		a[0] * wa + bx * wb,
		a[1] * wa + by * wb,
		a[2] * wa + bz * wb,
		a[3] * wa + bw * wb,
	];
	const len = Math.hypot(...r);
	return len > 0
		? r.map((c) => {
				return c / len;
			})
		: [0, 0, 0, 1];
};

// a seeded generator, so a failure can be run again
let seed = 12345;
const rand = () => {
	seed = (seed * 16807) % 2147483647;
	return seed / 2147483647;
};
const randomUnit = () => {
	const q = [rand() - 0.5, rand() - 0.5, rand() - 0.5, rand() - 0.5];
	const len = Math.hypot(...q);
	return q.map((c) => {
		return c / len;
	});
};
const randomVec = (scale = 10) => {
	return new Vector3d(
		(rand() - 0.5) * scale,
		(rand() - 0.5) * scale,
		(rand() - 0.5) * scale,
	);
};
const quat = ([x, y, z, w]) => {
	return new Quaternion(x, y, z, w);
};
/** q and -q are one orientation */
const sameTurn = (a, b, digits = 6) => {
	const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
	expect(dot).toBeCloseTo(1, digits);
};
const expectVec = (v, x, y, z, digits = 6) => {
	expect(v.x).toBeCloseTo(x, digits);
	expect(v.y).toBeCloseTo(y, digits);
	expect(v.z).toBeCloseTo(z, digits);
};

describe("the shared rotation arithmetic", () => {
	describe("writeRotationScale and the glTF TRS composition", () => {
		it("composeTRSInto computes exactly what it did, bit for bit", () => {
			for (let i = 0; i < 500; i++) {
				const t = [rand() * 100 - 50, rand() * 100 - 50, rand() * 100 - 50];
				// unit, non-unit and degenerate rotations alike: the loader
				// never normalized them
				const r =
					i % 3 === 0
						? randomUnit()
						: [rand() * 4 - 2, rand() * 4 - 2, rand() * 4 - 2, rand() * 4 - 2];
				const s = [rand() * 3 - 1, rand() * 3, rand() * 3 + 0.001];
				const got = composeTRSInto(new Array(16), t, r, s);
				expect(got).toEqual(oldCompose(new Array(16), t, r, s));
			}
		});

		it("writes in the precision of the array it is given", () => {
			const r = randomUnit();
			const f64 = new Float64Array(16);
			const plain = new Array(16);
			writeRotationScale(f64, ...r, 1, 1, 1);
			writeRotationScale(plain, ...r, 1, 1, 1);
			expect(Array.from(f64).slice(0, 12)).toEqual(plain.slice(0, 12));
			// the translation column is left alone
			const kept = new Float64Array(16).fill(7);
			writeRotationScale(kept, ...r, 1, 1, 1);
			expect([kept[12], kept[13], kept[14], kept[15]]).toEqual([7, 7, 7, 7]);
		});

		it("Quaternion#toMatrix3d writes exactly what it did", () => {
			for (let i = 0; i < 200; i++) {
				const q = quat(randomUnit());
				const m = q.toMatrix3d();
				const ref = new Float32Array(16);
				oldCompose(ref, [0, 0, 0], [q.x, q.y, q.z, q.w], [1, 1, 1]);
				expect(Array.from(m.val).slice(0, 12)).toEqual(
					Array.from(ref).slice(0, 12),
				);
			}
		});
	});

	describe("slerpInto, Quaternion#slerp and the glTF sampler", () => {
		it("Quaternion#slerp computes what it did", () => {
			for (let i = 0; i < 500; i++) {
				const a = randomUnit();
				const b = randomUnit();
				const t = rand();
				const q = quat(a).slerp(quat(b), t);
				const ref = oldSlerp(a, b, t);
				expect(q.x).toBeCloseTo(ref[0], 12);
				expect(q.y).toBeCloseTo(ref[1], 12);
				expect(q.z).toBeCloseTo(ref[2], 12);
				expect(q.w).toBeCloseTo(ref[3], 12);
			}
		});

		it("the sampler's slerp is the class's, on a key buffer", () => {
			for (let i = 0; i < 200; i++) {
				const a = randomUnit();
				const b = randomUnit();
				const t = rand();
				const keys = new Float32Array([...a, ...b]);
				const out = [0, 0, 0, 0];
				slerpQuat(keys, 0, 4, t, out);
				const ref = quat([...keys.slice(0, 4)]).slerp(
					quat([...keys.slice(4, 8)]),
					t,
				);
				expect(out[0]).toBeCloseTo(ref.x, 12);
				expect(out[1]).toBeCloseTo(ref.y, 12);
				expect(out[2]).toBeCloseTo(ref.z, 12);
				expect(out[3]).toBeCloseTo(ref.w, 12);
			}
		});

		it("the sampler computes what it did, keys far apart and a degree apart", () => {
			// it blends straight above cos 0.9995 (about 1.8 degrees), as it did
			const axis = new Vector3d(0.3, 1, -0.2);
			const pairs = [];
			for (let k = 0; k < 100; k++) {
				pairs.push([randomUnit(), randomUnit()]);
				const a = new Quaternion().rotate(rand() * 6, axis);
				const b = a
					.clone()
					.multiply(new Quaternion().rotate(0.017 * rand(), axis));
				pairs.push([a.toArray(), b.toArray()]);
			}
			for (const [a, b] of pairs) {
				const keys = new Float32Array([...a, ...b]);
				const t = rand();
				const out = [0, 0, 0, 0];
				slerpQuat(keys, 0, 4, t, out);
				const ref = oldSlerp(
					Array.from(keys.slice(0, 4)),
					Array.from(keys.slice(4, 8)),
					t,
					0.0005,
				);
				for (let c = 0; c < 4; c++) {
					expect(out[c]).toBeCloseTo(ref[c], 12);
				}
			}
		});

		it("t = 0 and t = 1 give the two ends, the short way", () => {
			const a = randomUnit();
			const b = randomUnit();
			const out = [0, 0, 0, 0];
			slerpInto(a, 0, b, 0, 0, out);
			sameTurn(quat(out), quat(a), 12);
			slerpInto(a, 0, b, 0, 1, out);
			sameTurn(quat(out), quat(b), 12);
		});

		it("q and -q blend to the same orientation, not through a full turn", () => {
			const a = randomUnit();
			const out1 = [0, 0, 0, 0];
			const out2 = [0, 0, 0, 0];
			slerpInto(a, 0, a, 0, 0.5, out1);
			slerpInto(
				a,
				0,
				a.map((c) => {
					return -c;
				}),
				0,
				0.5,
				out2,
			);
			sameTurn(quat(out1), quat(a), 12);
			sameTurn(quat(out2), quat(a), 12);
		});

		it("two all but identical rotations blend without dividing by zero", () => {
			const a = new Quaternion().rotate(1, new Vector3d(1, 2, 3));
			const b = new Quaternion().rotate(1 + 1e-9, new Vector3d(1, 2, 3));
			const out = [0, 0, 0, 0];
			slerpInto(a.toArray(), 0, b.toArray(), 0, 0.5, out);
			for (const c of out) {
				expect(Number.isFinite(c)).toBe(true);
			}
			sameTurn(quat(out), a, 9);
		});

		it("zero quaternions give no rotation rather than NaN", () => {
			const out = [9, 9, 9, 9];
			slerpInto([0, 0, 0, 0], 0, [0, 0, 0, 0], 0, 0.5, out);
			expect(out).toEqual([0, 0, 0, 1]);
		});

		it("the result may be written over its own inputs", () => {
			const a = randomUnit();
			const b = randomUnit();
			const buf = new Float64Array([...a, ...b]);
			const ref = [0, 0, 0, 0];
			slerpInto(a, 0, b, 0, 0.3, ref);
			slerpInto(buf, 0, buf, 4, 0.3, buf, 0);
			expect(Array.from(buf.slice(0, 4))).toEqual(ref);
			// and at an offset that overlaps the second input
			const buf2 = new Float64Array([...a, ...b]);
			slerpInto(buf2, 0, buf2, 4, 0.3, buf2, 4);
			expect(Array.from(buf2.slice(4, 8))).toEqual(ref);
		});
	});
});

describe("Matrix3d#compose", () => {
	it("is translate, then rotate, then scale", () => {
		for (let i = 0; i < 100; i++) {
			const t = randomVec(100);
			const q = quat(randomUnit());
			const s = new Vector3d(rand() * 3, rand() * 3 + 0.1, rand() * 3 + 0.1);
			const m = new Matrix3d().compose(t, q, s);
			const ref = new Matrix3d()
				.translate(t.x, t.y, t.z)
				.rotate(q)
				.scale(s.x, s.y, s.z);
			for (let k = 0; k < 16; k++) {
				expect(m.val[k]).toBeCloseTo(ref.val[k], 4);
			}
			// a point is scaled, turned, then moved
			const p = randomVec();
			const got = m.apply(p.clone());
			const want = q.apply(new Vector3d(p.x * s.x, p.y * s.y, p.z * s.z));
			expectVec(got, want.x + t.x, want.y + t.y, want.z + t.z, 3);
		}
	});

	it("overwrites the whole matrix, whatever it held", () => {
		const m = new Matrix3d();
		m.val.fill(Number.NaN);
		m.compose(new Vector3d(1, 2, 3), new Quaternion());
		expect(Array.from(m.val)).toEqual([
			1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1,
		]);
	});

	it("a missing z is 0 for the translation and 1 for the scale", () => {
		const m = new Matrix3d().compose({ x: 4, y: 5 }, new Quaternion(), {
			x: 2,
			y: 3,
		});
		expect(Array.from(m.val)).toEqual([
			2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 4, 5, 0, 1,
		]);
	});

	it("a non-unit rotation is normalized; a zero or NaN one is no turn", () => {
		const unit = new Quaternion().rotate(0.8, new Vector3d(0, 1, 0));
		const scaled = new Quaternion(
			unit.x * 5,
			unit.y * 5,
			unit.z * 5,
			unit.w * 5,
		);
		const a = new Matrix3d().compose(new Vector3d(), unit);
		const b = new Matrix3d().compose(new Vector3d(), scaled);
		for (let k = 0; k < 16; k++) {
			expect(b.val[k]).toBeCloseTo(a.val[k], 6);
		}
		for (const bad of [
			new Quaternion(0, 0, 0, 0),
			new Quaternion(Number.NaN, 0, 0, 1),
			new Quaternion(Infinity, 0, 0, 1),
		]) {
			const m = new Matrix3d().compose(new Vector3d(1, 1, 1), bad);
			expect(Array.from(m.val)).toEqual([
				1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1,
			]);
		}
	});

	it("does not change the quaternion or the vectors it is given", () => {
		const t = new Vector3d(1, 2, 3);
		const q = new Quaternion(0, 0, 3, 4);
		const s = new Vector3d(2, 2, 2);
		new Matrix3d().compose(t, q, s);
		expect([t.x, t.y, t.z]).toEqual([1, 2, 3]);
		expect([q.x, q.y, q.z, q.w]).toEqual([0, 0, 3, 4]);
		expect([s.x, s.y, s.z]).toEqual([2, 2, 2]);
	});
});

describe("Matrix3d#rotate and Renderable#rotate with a Quaternion", () => {
	it("turns as rotate(angle, axis) does", () => {
		for (let i = 0; i < 100; i++) {
			const axis = randomVec();
			const angle = (rand() - 0.5) * 10;
			const base = new Matrix3d()
				.translate(rand() * 10, rand() * 10, rand() * 10)
				.scale(rand() + 0.5, rand() + 0.5, rand() + 0.5);
			const byAngle = base.clone().rotate(angle, axis);
			const byQuat = base.clone().rotate(new Quaternion().rotate(angle, axis));
			for (let k = 0; k < 16; k++) {
				expect(byQuat.val[k]).toBeCloseTo(byAngle.val[k], 4);
			}
		}
	});

	it("keeps the translation column, and returns the matrix", () => {
		const m = new Matrix3d().translate(5, 6, 7);
		expect(m.rotate(new Quaternion().rotate(1, new Vector3d(1, 0, 0)))).toBe(m);
		expect([m.val[12], m.val[13], m.val[14], m.val[15]]).toEqual([5, 6, 7, 1]);
	});

	it("identity, non-unit, zero and NaN quaternions", () => {
		const base = new Matrix3d().rotate(0.4).translate(1, 2, 3);
		const before = Array.from(base.val);
		expect(Array.from(base.clone().rotate(new Quaternion()).val)).toEqual(
			before,
		);
		const q = new Quaternion().rotate(0.9, new Vector3d(0, 0, 1));
		const a = base.clone().rotate(q);
		const b = base
			.clone()
			.rotate(new Quaternion(q.x * 9, q.y * 9, q.z * 9, q.w * 9));
		for (let k = 0; k < 16; k++) {
			expect(b.val[k]).toBeCloseTo(a.val[k], 6);
		}
		for (const bad of [
			new Quaternion(0, 0, 0, 0),
			new Quaternion(Number.NaN, 1, 0, 0),
		]) {
			expect(Array.from(base.clone().rotate(bad).val)).toEqual(before);
		}
	});

	it("a number still turns as it did, with or without an axis", () => {
		const a = new Matrix3d().rotate(0.5);
		const b = new Matrix3d().rotate(0.5, new Vector3d(0, 0, 1));
		expect(Array.from(a.val)).toEqual(Array.from(b.val));
		expect(new Matrix3d().rotate(0).isIdentity()).toBe(true);
	});

	it("a renderable turned by a quaternion updates its bounds and redraws", () => {
		const r = new Renderable(0, 0, 40, 10);
		r.isDirty = false;
		const before = r.getBounds().width;
		r.rotate(new Quaternion().rotate(Math.PI / 2, new Vector3d(0, 0, 1)));
		expect(r.isDirty).toBe(true);
		// a quarter turn about Z swaps the bounds' width and height
		expect(r.getBounds().width).toBeCloseTo(10, 4);
		expect(r.getBounds().height).toBeCloseTo(before, 4);
	});
});

describe("Quaternion#setFromUnitVectors", () => {
	it("takes `from` onto `to`, for any two directions", () => {
		for (let i = 0; i < 300; i++) {
			const from = randomVec();
			const to = randomVec();
			const q = new Quaternion().setFromUnitVectors(from, to);
			expect(q.length()).toBeCloseTo(1, 10);
			const turned = q.apply(from.clone().normalize());
			const want = to.clone().normalize();
			expectVec(turned, want.x, want.y, want.z, 6);
		}
	});

	it("the same direction twice is no turn, whatever their lengths", () => {
		const q = new Quaternion().setFromUnitVectors(
			new Vector3d(1, 2, 3),
			new Vector3d(10, 20, 30),
		);
		sameTurn(q, new Quaternion(), 12);
	});

	it("opposite directions are a half turn, about an axis square to them", () => {
		for (const d of [
			new Vector3d(1, 0, 0),
			new Vector3d(0, 1, 0),
			new Vector3d(0, 0, 1),
			new Vector3d(0, 0, -1),
			new Vector3d(1, 1, 1),
			new Vector3d(-3, 0.001, 2),
			new Vector3d(1e-8, 1, 1e-8),
		]) {
			const q = new Quaternion().setFromUnitVectors(d, d.clone().negateSelf());
			expect(q.length()).toBeCloseTo(1, 10);
			// a half turn: w is 0
			expect(q.w).toBeCloseTo(0, 6);
			// and its axis is square to the direction
			const n = d.clone().normalize();
			expect(q.x * n.x + q.y * n.y + q.z * n.z).toBeCloseTo(0, 6);
			const turned = q.apply(n.clone());
			expectVec(turned, -n.x, -n.y, -n.z, 6);
		}
	});

	it("almost opposite directions still take one onto the other", () => {
		const from = new Vector3d(1, 0, 0);
		const to = new Vector3d(-1, 1e-7, 0);
		const q = new Quaternion().setFromUnitVectors(from, to);
		const turned = q.apply(from.clone());
		const want = to.clone().normalize();
		expectVec(turned, want.x, want.y, want.z, 5);
	});

	it("a zero, NaN or infinite direction is no turn", () => {
		const ok = new Vector3d(1, 0, 0);
		for (const bad of [
			new Vector3d(0, 0, 0),
			new Vector3d(Number.NaN, 0, 0),
			new Vector3d(Infinity, 0, 0),
		]) {
			expect(
				new Quaternion(1, 2, 3, 4).setFromUnitVectors(bad, ok).isIdentity(),
			).toBe(true);
			expect(
				new Quaternion(1, 2, 3, 4).setFromUnitVectors(ok, bad).isIdentity(),
			).toBe(true);
		}
	});

	it("tiny and huge directions are as good as unit ones", () => {
		const q1 = new Quaternion().setFromUnitVectors(
			new Vector3d(1e-30, 0, 0),
			new Vector3d(0, 1e-30, 0),
		);
		const q2 = new Quaternion().setFromUnitVectors(
			new Vector3d(1e200, 0, 0),
			new Vector3d(0, 1e200, 0),
		);
		const ref = new Quaternion().rotate(Math.PI / 2, new Vector3d(0, 0, 1));
		sameTurn(q1, ref, 10);
		sameTurn(q2, ref, 10);
	});

	it("does not change the vectors it is given", () => {
		const a = new Vector3d(3, 0, 0);
		const b = new Vector3d(0, 0, 5);
		new Quaternion().setFromUnitVectors(a, b);
		expect([a.x, a.y, a.z, b.x, b.y, b.z]).toEqual([3, 0, 0, 0, 0, 5]);
	});
});

describe("Quaternion reads as a Matrix3d does", () => {
	/** a quaternion and a matrix turned alike, compared through a vector */
	const expectSameTurn = (q, m, digits = 6) => {
		for (const v of [
			new Vector3d(1, 0, 0),
			new Vector3d(0, 1, 0),
			new Vector3d(0.3, -0.7, 0.2),
		]) {
			const a = q.apply(v.clone());
			const b = m.apply(v.clone());
			expectVec(a, b.x, b.y, b.z, digits);
		}
	};

	it("rotate(angle, axis) chains turn as Matrix3d#rotate chains do", () => {
		for (let i = 0; i < 100; i++) {
			const steps = [];
			for (let k = 0; k < 4; k++) {
				steps.push([(rand() - 0.5) * 8, randomVec()]);
			}
			const q = new Quaternion();
			const m = new Matrix3d();
			for (const [angle, axis] of steps) {
				q.rotate(angle, axis);
				m.rotate(angle, axis);
			}
			expectSameTurn(q, m, 5);
		}
	});

	it("rotate turns further, the new turn first, as on a matrix", () => {
		const q = new Quaternion().rotate(0.6, new Vector3d(1, 0, 0));
		const m = new Matrix3d().rotate(0.6, new Vector3d(1, 0, 0));
		q.rotate(1.1, new Vector3d(0, 1, 0));
		m.rotate(1.1, new Vector3d(0, 1, 0));
		expectSameTurn(q, m);
		// and the same as composing with multiply
		const composed = new Quaternion()
			.rotate(0.6, new Vector3d(1, 0, 0))
			.multiply(new Quaternion().rotate(1.1, new Vector3d(0, 1, 0)));
		sameTurn(q, composed, 12);
	});

	it("the axis defaults to Z, as on a matrix", () => {
		const q = new Quaternion().rotate(0.8);
		const m = new Matrix3d().rotate(0.8);
		expectSameTurn(q, m);
		sameTurn(q, new Quaternion().rotate(0.8, new Vector3d(0, 0, 1)), 12);
	});

	it("an angle of 0, or not a number, or a zero or NaN axis, turns nothing, on both", () => {
		const start = new Quaternion().rotate(0.4, new Vector3d(1, 1, 0));
		const startM = new Matrix3d().rotate(0.4, new Vector3d(1, 1, 0));
		const before = Array.from(startM.val);
		for (const [angle, axis] of [
			[0, new Vector3d(0, 1, 0)],
			[Number.NaN, new Vector3d(0, 1, 0)],
			[Infinity, new Vector3d(0, 1, 0)],
			[1, new Vector3d(0, 0, 0)],
			[1, new Vector3d(Number.NaN, 1, 0)],
			[1, new Vector3d(Infinity, 0, 0)],
		]) {
			const q = start.clone().rotate(angle, axis);
			expect([q.x, q.y, q.z, q.w]).toEqual([
				start.x,
				start.y,
				start.z,
				start.w,
			]);
			const m = startM.clone().rotate(angle, axis);
			expect(Array.from(m.val)).toEqual(before);
		}
	});

	it("Matrix2d#rotate with an angle that is not a number turns nothing", () => {
		for (const bad of [Number.NaN, Infinity, -Infinity]) {
			const m = new Matrix2d().rotate(0.3);
			const before = Array.from(m.val);
			m.rotate(bad);
			expect(Array.from(m.val)).toEqual(before);
		}
	});

	it("a renderable turned by an angle that is not a number keeps its turn", () => {
		const r = new Renderable(0, 0, 10, 10);
		r.rotate(0.5);
		const before = Array.from(r.currentTransform.val);
		r.rotate(Number.NaN, new Vector3d(0, 1, 0));
		expect(Array.from(r.currentTransform.val)).toEqual(before);
	});

	it("applyInverse undoes apply, as on a matrix", () => {
		for (let i = 0; i < 100; i++) {
			const q = quat(randomUnit());
			const v = randomVec();
			const back = q.applyInverse(q.apply(v.clone()));
			expectVec(back, v.x, v.y, v.z, 9);
			const m = q.toMatrix3d();
			const viaMatrix = m.applyInverse(v.clone());
			const viaQuat = q.applyInverse(v.clone());
			expectVec(viaQuat, viaMatrix.x, viaMatrix.y, viaMatrix.z, 4);
		}
	});

	it("fromMat3d reads back what toMatrix3d wrote, as Matrix2d#fromMat3d does", () => {
		for (let i = 0; i < 100; i++) {
			const q = quat(randomUnit());
			const back = new Quaternion().fromMat3d(q.toMatrix3d());
			sameTurn(back, q, 6);
		}
	});
});
