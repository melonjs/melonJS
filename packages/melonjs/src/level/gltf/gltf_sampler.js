/**
 * Keyframe sampling for glTF node-TRS animation. Pure, engine-free helpers so
 * the interpolation math can be unit-tested in isolation from the renderer.
 *
 * A parsed channel (see the glTF loader) has the shape:
 * `{ node, path, times: Float32Array, values: Float32Array, stride, interpolation }`
 * where `stride` is the component count of one value (3 for translation/scale,
 * 4 for a rotation quaternion) and `interpolation` is `"LINEAR"` | `"STEP"` |
 * `"CUBICSPLINE"`.
 * @ignore
 */

// reused result for findKeyframe — the value is consumed immediately by the
// caller (sampleChannel destructures it on return), so a single shared object
// keeps the per-frame sample path allocation-free.
const _kf = { i0: 0, i1: 0, alpha: 0 };

/**
 * Locate the keyframe interval for time `t` in the (ascending) `times` array.
 * Clamps to the endpoints — glTF animations do not extrapolate beyond their
 * first/last keyframe. Returns the bracketing indices and the 0..1 blend factor.
 *
 * The returned object is **reused** across calls (read/copy its fields
 * immediately; don't retain the reference).
 * @param {ArrayLike<number>} times - keyframe times, ascending
 * @param {number} t - sample time (same units as `times`, i.e. seconds)
 * @returns {{ i0: number, i1: number, alpha: number }} reused result object
 * @ignore
 */
export function findKeyframe(times, t) {
	const n = times.length;
	if (n === 0 || t <= times[0]) {
		_kf.i0 = 0;
		_kf.i1 = 0;
		_kf.alpha = 0;
		return _kf;
	}
	if (t >= times[n - 1]) {
		_kf.i0 = n - 1;
		_kf.i1 = n - 1;
		_kf.alpha = 0;
		return _kf;
	}
	// binary search for the last index whose time is <= t
	let lo = 0;
	let hi = n - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (times[mid] <= t) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}
	const span = times[lo + 1] - times[lo];
	_kf.i0 = lo;
	_kf.i1 = lo + 1;
	// guard against a zero-length span (duplicate keyframe times)
	_kf.alpha = span > 0 ? (t - times[lo]) / span : 0;
	return _kf;
}

/**
 * Spherical-linear interpolation between two quaternions stored in `values` at
 * component offsets `o0` and `o1`. Picks the shortest arc (sign-flips the second
 * quaternion when the dot is negative) and falls back to normalized-lerp for
 * nearly-parallel inputs (where `sin(theta)` underflows). Result is normalized.
 * @param {ArrayLike<number>} values - flat quaternion buffer (xyzw per key)
 * @param {number} o0 - offset of the first quaternion
 * @param {number} o1 - offset of the second quaternion
 * @param {number} t - blend factor 0..1
 * @param {number[]} out - 4-element [x,y,z,w] result
 * @ignore
 */
export function slerpQuat(values, o0, o1, t, out) {
	const ax = values[o0];
	const ay = values[o0 + 1];
	const az = values[o0 + 2];
	const aw = values[o0 + 3];
	let bx = values[o1];
	let by = values[o1 + 1];
	let bz = values[o1 + 2];
	let bw = values[o1 + 3];
	let cosom = ax * bx + ay * by + az * bz + aw * bw;
	// shortest path: negate the second quaternion if the dot is negative
	if (cosom < 0) {
		cosom = -cosom;
		bx = -bx;
		by = -by;
		bz = -bz;
		bw = -bw;
	}
	let s0;
	let s1;
	if (cosom > 0.9995) {
		// quaternions almost parallel — normalized lerp avoids a divide-by-~0
		s0 = 1 - t;
		s1 = t;
	} else {
		const omega = Math.acos(cosom);
		const sinom = Math.sin(omega);
		s0 = Math.sin((1 - t) * omega) / sinom;
		s1 = Math.sin(t * omega) / sinom;
	}
	let ox = s0 * ax + s1 * bx;
	let oy = s0 * ay + s1 * by;
	let oz = s0 * az + s1 * bz;
	let ow = s0 * aw + s1 * bw;
	const len = Math.hypot(ox, oy, oz, ow) || 1;
	ox /= len;
	oy /= len;
	oz /= len;
	ow /= len;
	out[0] = ox;
	out[1] = oy;
	out[2] = oz;
	out[3] = ow;
	return out;
}

/**
 * Sample one animation channel at time `t`, writing `channel.stride` components
 * into `out`. Rotation channels (stride 4) use {@link slerpQuat}; translation /
 * scale (stride 3) use component-wise linear interpolation. `STEP` holds the
 * lower keyframe; `CUBICSPLINE` uses the keyframe value (its tangents are
 * ignored — a deliberate Tier-1 approximation, not full spline evaluation).
 * @param {{times: ArrayLike<number>, values: ArrayLike<number>, stride: number, interpolation: string}} channel
 * @param {number} t - sample time in seconds
 * @param {number[]} out - destination, at least `channel.stride` long
 * @returns {number[]} `out`
 * @ignore
 */
export function sampleChannel(channel, t, out) {
	const { times, values, stride, interpolation } = channel;
	let { i0, i1, alpha } = findKeyframe(times, t);
	if (interpolation === "STEP") {
		alpha = 0;
	}
	// CUBICSPLINE stores 3 values per keyframe (inTangent, value, outTangent);
	// the actual value is the middle third. We sample that value and linearly
	// blend (tangents ignored). LINEAR / STEP store a single value per keyframe.
	const cubic = interpolation === "CUBICSPLINE";
	const block = cubic ? stride * 3 : stride;
	const valueOffset = cubic ? stride : 0;
	const o0 = i0 * block + valueOffset;
	const o1 = i1 * block + valueOffset;
	if (stride === 4) {
		return slerpQuat(values, o0, o1, alpha, out);
	}
	for (let c = 0; c < stride; c++) {
		out[c] = values[o0 + c] + (values[o1 + c] - values[o0 + c]) * alpha;
	}
	return out;
}
