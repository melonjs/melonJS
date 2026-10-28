/**
 * Pixel snapping for the matrix based renderers (WebGL and WebGPU), when
 * `subPixel` is false.
 *
 * Each translation is rounded to the nearest pixel in the units it is given
 * in, before it is applied, which is what the Canvas renderer does with its
 * 2D context and what every renderer does with a `drawImage` destination, so
 * all three backends land a renderable on the same pixel under any scale or
 * flip. Rounding the accumulated matrix instead put a flipped sprite whose
 * pivot falls on a half pixel one pixel off where it sits unflipped (the
 * pivot's two translations rounded the same half the same way, instead of
 * cancelling out), and one pixel off where the Canvas renderer drew it.
 *
 * Rounding, not truncating: a position a float error short of a whole pixel
 * (223.99999999999997) lands on that pixel, not the one before it.
 * @ignore
 */

/**
 * The matrix to multiply into the current transform for `transform(m)`:
 * `m` itself when its translation is already whole, or else `out` set to a
 * copy of `m` with its translation rounded. `m` is never modified.
 * @ignore
 * @param {Matrix2d|Matrix3d} m - the matrix given to `transform`
 * @param {Matrix3d} out - a scratch matrix
 * @returns {Matrix2d|Matrix3d} `m`, or `out`
 */
export function snapMatrixTranslation(m, out) {
	const v = m.val;
	if (v.length === 9) {
		// Matrix2d: translation at [6], [7]
		if (Number.isInteger(v[6]) && Number.isInteger(v[7])) {
			return m;
		}
		return out.setTransform(
			v[0],
			v[1],
			0,
			0,
			v[3],
			v[4],
			0,
			0,
			0,
			0,
			1,
			0,
			Math.round(v[6]),
			Math.round(v[7]),
			0,
			1,
		);
	}
	// Matrix3d: translation at [12], [13]
	if (Number.isInteger(v[12]) && Number.isInteger(v[13])) {
		return m;
	}
	out.copy(m);
	out.val[12] = Math.round(v[12]);
	out.val[13] = Math.round(v[13]);
	return out;
}
