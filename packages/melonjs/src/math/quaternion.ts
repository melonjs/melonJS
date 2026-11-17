import { EPSILON } from "./math.ts";
import { Matrix3d } from "./matrix3d.ts";
import { slerpInto, writeRotationScale } from "./rotation.ts";
import type { Vector3d } from "./vector3d.ts";

// the two quaternions a slerp blends, side by side
const _pair = new Float64Array(8);

/**
 * An orientation in 3D: a rotation about an axis, stored as a unit quaternion
 * `(x, y, z, w)`. What a 3D physics body's rotation is read and written as
 * ({@link PhysicsAdapter.getRotation}, {@link PhysicsAdapter.setRotation}),
 * and handy wherever turns are composed or blended, as it has none of the
 * gimbal lock of three Euler angles.
 *
 * `(0, 0, 0, 1)` is no rotation. Rotations follow the right-hand rule in the
 * engine's own space (Y-down, +Z forward, the {@link Camera3d} convention), as
 * {@link Matrix3d#rotate} does.
 *
 * Its methods read as a {@link Matrix3d}'s do: a new one is no rotation,
 * `rotate(angle, axis)` turns it further, `multiply` composes, `invert`,
 * `apply(v)` / `applyInverse(v)` turn a vector, and `fromMat3d` /
 * `toMatrix3d` convert, as `Matrix2d#fromMat3d` and `Matrix3d#toMatrix2d` do.
 * @category Math
 * @example
 * import { Quaternion, Vector3d } from "melonjs";
 *
 * // a quarter turn about the vertical axis, as a Matrix3d would be turned
 * const turn = new Quaternion().rotate(Math.PI / 2, new Vector3d(0, 1, 0));
 * // where it takes +X
 * const v = turn.apply(new Vector3d(1, 0, 0));
 * // and a renderable turned by it
 * mesh.currentTransform.identity().rotate(turn);
 */
export class Quaternion {
	x: number;
	y: number;
	z: number;
	w: number;

	/**
	 * @param [x] - x of the vector part
	 * @param [y] - y of the vector part
	 * @param [z] - z of the vector part
	 * @param [w] - the scalar part; `1` (with the rest 0) is no rotation
	 */
	constructor(x = 0, y = 0, z = 0, w = 1) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}

	/**
	 * Set the four components.
	 * @param x - x of the vector part
	 * @param y - y of the vector part
	 * @param z - z of the vector part
	 * @param w - the scalar part
	 * @returns this, for chaining
	 */
	set(x: number, y: number, z: number, w: number) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
		return this;
	}

	/**
	 * Make this no rotation, `(0, 0, 0, 1)`.
	 * @returns this, for chaining
	 */
	identity() {
		return this.set(0, 0, 0, 1);
	}

	/**
	 * Whether this is no rotation. `q` and `-q` are the same orientation, so
	 * `(0, 0, 0, -1)` counts too.
	 * @returns true if it turns nothing
	 */
	isIdentity() {
		return (
			this.x === 0 && this.y === 0 && this.z === 0 && Math.abs(this.w) === 1
		);
	}

	/**
	 * Copy another quaternion into this one.
	 * @param q - the quaternion to copy
	 * @returns this, for chaining
	 */
	copy(q: Quaternion) {
		return this.set(q.x, q.y, q.z, q.w);
	}

	/**
	 * A new quaternion equal to this one.
	 * @returns the copy
	 */
	clone() {
		return new Quaternion(this.x, this.y, this.z, this.w);
	}

	/**
	 * Whether `q` holds the same components, within `epsilon`.
	 * @param q - the quaternion to compare with
	 * @param [epsilon=0] - the tolerance per component
	 * @returns true if they match
	 */
	equals(q: Quaternion, epsilon = 0) {
		return (
			Math.abs(this.x - q.x) <= epsilon &&
			Math.abs(this.y - q.y) <= epsilon &&
			Math.abs(this.z - q.z) <= epsilon &&
			Math.abs(this.w - q.w) <= epsilon
		);
	}

	/**
	 * Turn this rotation further by `angle` radians about an axis, as
	 * {@link Matrix3d#rotate} turns a matrix: `this = this × R(axis, angle)`,
	 * so the new turn is applied first, then this one. On a new quaternion,
	 * that is simply the turn. The axis defaults to Z and need not be of unit
	 * length; an axis of length 0, or an angle or axis that is not a finite
	 * number, turns nothing.
	 * @param angle - the angle, in radians
	 * @param [v] - the axis to turn about (defaults to Z)
	 * @returns this, for chaining
	 * @example
	 * // yaw, then pitch, as a camera turns
	 * const q = new Quaternion()
	 *     .rotate(yaw, new Vector3d(0, 1, 0))
	 *     .rotate(pitch, new Vector3d(1, 0, 0));
	 */
	rotate(angle: number, v?: Vector3d) {
		if (angle === 0 || !Number.isFinite(angle)) {
			return this;
		}
		const ax = v ? v.x : 0;
		const ay = v ? v.y : 0;
		const az = v ? v.z : 1;
		const len = Math.hypot(ax, ay, az);
		if (!(len >= EPSILON) || !Number.isFinite(len)) {
			return this;
		}
		const s = Math.sin(angle / 2) / len;
		const bx = ax * s;
		const by = ay * s;
		const bz = az * s;
		const bw = Math.cos(angle / 2);
		const { x, y, z, w } = this;
		return this.set(
			w * bx + x * bw + y * bz - z * by,
			w * by - x * bz + y * bw + z * bx,
			w * bz + x * by - y * bx + z * bw,
			w * bw - x * bx - y * by - z * bz,
		);
	}

	/**
	 * The shortest turn that takes the direction `from` onto the direction
	 * `to`. Neither needs to be of unit length. Two opposite directions are
	 * joined by a half turn about an axis square to them; a direction of
	 * length 0, or one that is not a number, gives no rotation.
	 * @param from - the direction to turn from
	 * @param to - the direction to turn onto
	 * @returns this, for chaining
	 * @example
	 * // a band modeled along +X, laid along the line from a to b
	 * const along = b.clone().sub(a);
	 * band.rotate(new Quaternion().setFromUnitVectors(new Vector3d(1, 0, 0), along));
	 */
	setFromUnitVectors(from: Vector3d, to: Vector3d) {
		const fl = Math.hypot(from.x, from.y, from.z);
		const tl = Math.hypot(to.x, to.y, to.z);
		if (
			!(fl > 0) ||
			!(tl > 0) ||
			!Number.isFinite(fl) ||
			!Number.isFinite(tl)
		) {
			return this.identity();
		}
		const fx = from.x / fl;
		const fy = from.y / fl;
		const fz = from.z / fl;
		const tx = to.x / tl;
		const ty = to.y / tl;
		const tz = to.z / tl;
		const r = fx * tx + fy * ty + fz * tz + 1;
		if (r < 1e-9) {
			// opposite: a half turn about any axis square to `from`, the one
			// in the plane of the larger components keeping it well defined
			return Math.abs(fx) > Math.abs(fz)
				? this.set(-fy, fx, 0, 0).normalize()
				: this.set(0, -fz, fy, 0).normalize();
		}
		// (from × to, 1 + from · to), normalized: half the angle, no trig
		return this.set(
			fy * tz - fz * ty,
			fz * tx - fx * tz,
			fx * ty - fy * tx,
			r,
		).normalize();
	}

	/**
	 * The rotation held in a matrix: its upper 3×3. A scale along each axis
	 * is taken out, so a renderable's `currentTransform` can be read as it
	 * is; a mirror or a shear is not, and a matrix with an axis scaled to
	 * nothing gives no rotation. The inverse of {@link Quaternion#toMatrix3d}.
	 * @param m - the matrix to read
	 * @returns this, for chaining
	 */
	fromMat3d(m: Matrix3d) {
		const v = m.val;
		// the length of each column is the scale along that axis
		const sx = Math.hypot(v[0], v[1], v[2]);
		const sy = Math.hypot(v[4], v[5], v[6]);
		const sz = Math.hypot(v[8], v[9], v[10]);
		if (!(sx > 0) || !(sy > 0) || !(sz > 0)) {
			return this.identity();
		}
		// column-major: element (row r, column c) is v[c * 4 + r]
		const m00 = v[0] / sx;
		const m10 = v[1] / sx;
		const m20 = v[2] / sx;
		const m01 = v[4] / sy;
		const m11 = v[5] / sy;
		const m21 = v[6] / sy;
		const m02 = v[8] / sz;
		const m12 = v[9] / sz;
		const m22 = v[10] / sz;
		const trace = m00 + m11 + m22;
		// the largest of w, x, y, z is recovered first: dividing by a small
		// one would lose the others' precision
		if (trace > 0) {
			const s = 0.5 / Math.sqrt(trace + 1);
			this.set((m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s);
		} else if (m00 > m11 && m00 > m22) {
			const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
			this.set(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
		} else if (m11 > m22) {
			const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
			this.set((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s);
		} else {
			const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
			this.set((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s);
		}
		return this.normalize();
	}

	/**
	 * Write this rotation into a matrix's upper 3×3, leaving its translation
	 * column as it was: `out` turned as this quaternion turns.
	 * @param [out] - the matrix to write into; a new identity one when omitted
	 * @returns `out`
	 */
	toMatrix3d(out: Matrix3d = new Matrix3d()) {
		const target = out;
		writeRotationScale(target.val, this.x, this.y, this.z, this.w, 1, 1, 1);
		return target;
	}

	/**
	 * Compose two rotations: `this = this × q`, so `q` is applied first and
	 * this one after it, as with {@link Matrix3d#multiply}.
	 * @param q - the rotation applied first
	 * @returns this, for chaining
	 */
	multiply(q: Quaternion) {
		const { x, y, z, w } = this;
		return this.set(
			w * q.x + x * q.w + y * q.z - z * q.y,
			w * q.y - x * q.z + y * q.w + z * q.x,
			w * q.z + x * q.y - y * q.x + z * q.w,
			w * q.w - x * q.x - y * q.y - z * q.z,
		);
	}

	/**
	 * Compose the other way round: `this = q × this`, so this rotation is
	 * applied first and `q` after it.
	 * @param q - the rotation applied after
	 * @returns this, for chaining
	 */
	premultiply(q: Quaternion) {
		const { x, y, z, w } = this;
		return this.set(
			q.w * x + q.x * w + q.y * z - q.z * y,
			q.w * y - q.x * z + q.y * w + q.z * x,
			q.w * z + q.x * y - q.y * x + q.z * w,
			q.w * w - q.x * x - q.y * y - q.z * z,
		);
	}

	/**
	 * Turn this into the opposite rotation. For a unit quaternion this is
	 * its conjugate, `(-x, -y, -z, w)`. A zero quaternion, or one that is
	 * not a finite number, becomes no rotation.
	 * @returns this, for chaining
	 */
	invert() {
		const d = this.length2();
		if (!(d > 0) || !Number.isFinite(d)) {
			return this.identity();
		}
		return this.set(-this.x / d, -this.y / d, -this.z / d, this.w / d);
	}

	/**
	 * The dot product with another quaternion: the cosine of half the angle
	 * between the two orientations, for unit ones.
	 * @param q - the other quaternion
	 * @returns the dot product
	 */
	dot(q: Quaternion) {
		return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
	}

	/**
	 * The squared length, named as {@link Vector3d#length2} is.
	 * @returns the squared length
	 */
	length2() {
		return this.dot(this);
	}

	/**
	 * The length, 1 for a rotation.
	 * @returns the length
	 */
	length() {
		return Math.sqrt(this.length2());
	}

	/**
	 * Scale to unit length, so it is a rotation again after rounding has
	 * drifted it. A zero quaternion becomes no rotation.
	 * @returns this, for chaining
	 */
	normalize() {
		const len = this.length();
		if (!(len > 0) || !Number.isFinite(len)) {
			return this.identity();
		}
		return this.set(this.x / len, this.y / len, this.z / len, this.w / len);
	}

	/**
	 * Turn part of the way toward `q`, along the shortest arc: `t = 0` is
	 * this, `t = 1` is `q`, at an even angular speed in between.
	 * @param q - the orientation to turn toward
	 * @param t - how far, 0 to 1
	 * @returns this, for chaining
	 */
	slerp(q: Quaternion, t: number) {
		const p = _pair;
		p[0] = this.x;
		p[1] = this.y;
		p[2] = this.z;
		p[3] = this.w;
		p[4] = q.x;
		p[5] = q.y;
		p[6] = q.z;
		p[7] = q.w;
		slerpInto(p, 0, p, 4, t, p, 0);
		return this.set(p[0], p[1], p[2], p[3]);
	}

	/**
	 * Turn a vector by this rotation, in place: what {@link Matrix3d#apply}
	 * does with a matrix. The vector is changed and returned, not this
	 * quaternion.
	 * @param v - the vector to turn
	 * @returns `v`, turned
	 * @example
	 * // where a quarter turn about Y takes +X, keeping the original
	 * const where = turn.apply(new Vector3d(1, 0, 0));
	 */
	apply(v: Vector3d) {
		const { x, y, z, w } = this;
		// v' = v + 2w(q × v) + 2 q × (q × v)
		const tx = 2 * (y * v.z - z * v.y);
		const ty = 2 * (z * v.x - x * v.z);
		const tz = 2 * (x * v.y - y * v.x);
		// through `set`, so an observable vector reports the change once
		return v.set(
			v.x + w * tx + (y * tz - z * ty),
			v.y + w * ty + (z * tx - x * tz),
			v.z + w * tz + (x * ty - y * tx),
		);
	}
	/**
	 * Turn a vector by the inverse of this rotation, in place: what
	 * {@link Matrix3d#applyInverse} does with a matrix. The vector is changed
	 * and returned, not this quaternion.
	 * @param v - the vector to turn back
	 * @returns `v`, turned back
	 * @example
	 * // a world direction in a turned body's own space
	 * const local = body.applyInverse(worldDir.clone());
	 */
	applyInverse(v: Vector3d) {
		// the inverse of a unit quaternion is its conjugate: the same turn,
		// the vector part negated
		const { w } = this;
		const x = -this.x;
		const y = -this.y;
		const z = -this.z;
		const tx = 2 * (y * v.z - z * v.y);
		const ty = 2 * (z * v.x - x * v.z);
		const tz = 2 * (x * v.y - y * v.x);
		return v.set(
			v.x + w * tx + (y * tz - z * ty),
			v.y + w * ty + (z * tx - x * tz),
			v.z + w * tz + (x * ty - y * tx),
		);
	}

	/**
	 * The components as an array, `[x, y, z, w]`, the order glTF stores
	 * rotations in.
	 * @returns the array
	 */
	toArray(): [number, number, number, number] {
		return [this.x, this.y, this.z, this.w];
	}

	/**
	 * Set from an array `[x, y, z, w]`, as glTF stores a rotation.
	 * @param a - the four components
	 * @returns this, for chaining
	 */
	fromArray(a: ArrayLike<number>) {
		return this.set(a[0], a[1], a[2], a[3]);
	}

	/**
	 * A readable form, for logging.
	 * @returns the components
	 */
	toString() {
		return `x:${this.x},y:${this.y},z:${this.z},w:${this.w}`;
	}
}
