/**
 * The rotation arithmetic `Quaternion`, `Matrix3d` and the glTF animation
 * share, written once on plain numbers and arrays: it imports nothing, so
 * both classes can use it, and it allocates nothing, so a per-frame path
 * can call it on its own buffers at full precision.
 */

/** something an index can be written to: an array or a typed array */
type Writable = { [index: number]: number };

/**
 * Above this cosine two rotations are blended straight rather than slerped:
 * `1 - cos` is too close to 0 to divide by.
 */
const STRAIGHT_ABOVE = 1 - 1e-6;

/**
 * Slerp between two quaternions stored in arrays, along the shortest arc,
 * and write the unit result.
 * @param a - the array holding the first quaternion, `[x, y, z, w]`
 * @param ao - its offset in `a`
 * @param b - the array holding the second
 * @param bo - its offset in `b`
 * @param t - how far from the first to the second, 0 to 1
 * @param out - where to write the result
 * @param [oo] - its offset in `out`
 * @param [straightAbove] - the cosine above which the two are blended
 * straight, which is cheaper and, close enough, as good: the default only
 * when they are all but the same; an animation sampling dense keys passes a
 * lower one
 * @ignore
 */
export function slerpInto(
	a: ArrayLike<number>,
	ao: number,
	b: ArrayLike<number>,
	bo: number,
	t: number,
	out: Writable,
	oo = 0,
	straightAbove = STRAIGHT_ABOVE,
): void {
	const ax = a[ao];
	const ay = a[ao + 1];
	const az = a[ao + 2];
	const aw = a[ao + 3];
	let bx = b[bo];
	let by = b[bo + 1];
	let bz = b[bo + 2];
	let bw = b[bo + 3];
	let cos = ax * bx + ay * by + az * bz + aw * bw;
	// q and -q are one orientation: go the short way
	if (cos < 0) {
		cos = -cos;
		bx = -bx;
		by = -by;
		bz = -bz;
		bw = -bw;
	}
	let wa;
	let wb;
	if (cos > straightAbove) {
		// close enough: a straight blend, which cannot divide by ~0
		wa = 1 - t;
		wb = t;
	} else {
		const angle = Math.acos(Math.min(cos, 1));
		const sin = Math.sin(angle);
		wa = Math.sin((1 - t) * angle) / sin;
		wb = Math.sin(t * angle) / sin;
	}
	const x = ax * wa + bx * wb;
	const y = ay * wa + by * wb;
	const z = az * wa + bz * wb;
	const w = aw * wa + bw * wb;
	const len = Math.hypot(x, y, z, w);
	if (len > 0) {
		const inv = 1 / len;
		out[oo] = x * inv;
		out[oo + 1] = y * inv;
		out[oo + 2] = z * inv;
		out[oo + 3] = w * inv;
	} else {
		out[oo] = 0;
		out[oo + 1] = 0;
		out[oo + 2] = 0;
		out[oo + 3] = 1;
	}
}

/**
 * Write a rotation, scaled along each axis, into the upper 3×3 of a
 * column-major 4×4 matrix, `R · S`: column `c` is the rotation's column `c`
 * times the scale along `c`. The rotation is the unit quaternion
 * `(x, y, z, w)`; elements 3, 7 and 11 are set to 0, and the translation
 * column is left as it is.
 * @param out - the 16 elements to write into
 * @param x - the quaternion's x
 * @param y - its y
 * @param z - its z
 * @param w - its w
 * @param sx - the scale along X
 * @param sy - along Y
 * @param sz - along Z
 * @ignore
 */
export function writeRotationScale(
	out: Writable,
	x: number,
	y: number,
	z: number,
	w: number,
	sx: number,
	sy: number,
	sz: number,
): void {
	const x2 = x + x;
	const y2 = y + y;
	const z2 = z + z;
	const xx = x * x2;
	const xy = x * y2;
	const xz = x * z2;
	const yy = y * y2;
	const yz = y * z2;
	const zz = z * z2;
	const wx = w * x2;
	const wy = w * y2;
	const wz = w * z2;
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
}
