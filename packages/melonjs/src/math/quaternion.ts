import { Matrix3d } from "./matrix3d.ts";
import type { Vector3d } from "./vector3d.ts";

/**
 * How near two orientations have to be before {@link Quaternion.slerp} stops
 * dividing by the sine of the angle between them, which vanishes as they meet,
 * and blends them linearly instead. A cosine, so the test costs no `acos`.
 */
const SLERP_EPSILON = 1e-6;

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
 * @category Math
 * @example
 * import { Quaternion, Vector3d } from "melonjs";
 *
 * // a quarter turn about the vertical axis
 * const turn = new Quaternion().setFromAxisAngle(new Vector3d(0, 1, 0), Math.PI / 2);
 * // where it takes +X
 * const v = turn.rotate(new Vector3d(1, 0, 0));
 * // and the same turn as a matrix, for a renderable's transform
 * mesh.currentTransform.identity().multiply(turn.toMatrix3d());
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
	 * The rotation of `angle` radians about `axis`. The axis need not be of
	 * unit length; one of length 0 gives no rotation.
	 * @param axis - the axis to turn about
	 * @param angle - the angle, in radians
	 * @returns this, for chaining
	 */
	setFromAxisAngle(axis: Vector3d, angle: number) {
		const len = Math.hypot(axis.x, axis.y, axis.z);
		if (!(len > 0) || !Number.isFinite(len)) {
			return this.identity();
		}
		const s = Math.sin(angle / 2) / len;
		return this.set(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle / 2));
	}

	/**
	 * The rotation held in a matrix: its upper 3×3, which must be a pure
	 * rotation (a scale is not taken out). The inverse of
	 * {@link Quaternion#toMatrix3d}.
	 * @param m - the matrix to read
	 * @returns this, for chaining
	 */
	setFromMatrix3d(m: Matrix3d) {
		const v = m.val;
		// column-major: element (row r, column c) is v[c * 4 + r]
		const m00 = v[0];
		const m11 = v[5];
		const m22 = v[10];
		const trace = m00 + m11 + m22;
		// the largest of w, x, y, z is recovered first: dividing by a small
		// one would lose the others' precision
		if (trace > 0) {
			const s = 0.5 / Math.sqrt(trace + 1);
			this.set(
				(v[6] - v[9]) * s,
				(v[8] - v[2]) * s,
				(v[1] - v[4]) * s,
				0.25 / s,
			);
		} else if (m00 > m11 && m00 > m22) {
			const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
			this.set(
				0.25 * s,
				(v[4] + v[1]) / s,
				(v[8] + v[2]) / s,
				(v[6] - v[9]) / s,
			);
		} else if (m11 > m22) {
			const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
			this.set(
				(v[4] + v[1]) / s,
				0.25 * s,
				(v[9] + v[6]) / s,
				(v[8] - v[2]) / s,
			);
		} else {
			const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
			this.set(
				(v[8] + v[2]) / s,
				(v[9] + v[6]) / s,
				0.25 * s,
				(v[1] - v[4]) / s,
			);
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
		const v = target.val;
		const { x, y, z, w } = this;
		const xx = x * x;
		const yy = y * y;
		const zz = z * z;
		const xy = x * y;
		const xz = x * z;
		const yz = y * z;
		const wx = w * x;
		const wy = w * y;
		const wz = w * z;
		v[0] = 1 - 2 * (yy + zz);
		v[1] = 2 * (xy + wz);
		v[2] = 2 * (xz - wy);
		v[3] = 0;
		v[4] = 2 * (xy - wz);
		v[5] = 1 - 2 * (xx + zz);
		v[6] = 2 * (yz + wx);
		v[7] = 0;
		v[8] = 2 * (xz + wy);
		v[9] = 2 * (yz - wx);
		v[10] = 1 - 2 * (xx + yy);
		v[11] = 0;
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
	 * its conjugate, `(-x, -y, -z, w)`.
	 * @returns this, for chaining
	 */
	invert() {
		const d = this.lengthSquared();
		if (!(d > 0)) {
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
	 * The squared length.
	 * @returns the squared length
	 */
	lengthSquared() {
		return this.dot(this);
	}

	/**
	 * The length, 1 for a rotation.
	 * @returns the length
	 */
	length() {
		return Math.sqrt(this.lengthSquared());
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
		let { x: bx, y: by, z: bz, w: bw } = q;
		let cos = this.dot(q);
		// q and -q are one orientation: go the short way
		if (cos < 0) {
			cos = -cos;
			bx = -bx;
			by = -by;
			bz = -bz;
			bw = -bw;
		}
		let a;
		let b;
		if (1 - cos < SLERP_EPSILON) {
			a = 1 - t;
			b = t;
		} else {
			const angle = Math.acos(Math.min(cos, 1));
			const sin = Math.sin(angle);
			a = Math.sin((1 - t) * angle) / sin;
			b = Math.sin(t * angle) / sin;
		}
		this.set(
			this.x * a + bx * b,
			this.y * a + by * b,
			this.z * a + bz * b,
			this.w * a + bw * b,
		);
		return this.normalize();
	}

	/**
	 * Turn a vector by this rotation, in place.
	 * @param v - the vector to turn
	 * @returns `v`, turned
	 */
	rotate(v: Vector3d) {
		const { x, y, z, w } = this;
		// v' = v + 2w(q × v) + 2 q × (q × v)
		const tx = 2 * (y * v.z - z * v.y);
		const ty = 2 * (z * v.x - x * v.z);
		const tz = 2 * (x * v.y - y * v.x);
		const vx = v.x + w * tx + (y * tz - z * ty);
		const vy = v.y + w * ty + (z * tx - x * tz);
		const vz = v.z + w * tz + (x * ty - y * tx);
		v.x = vx;
		v.y = vy;
		v.z = vz;
		return v;
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
