/**
 * Pixel snapping, the rule every renderer follows when `subPixel` is false.
 *
 * A draw is snapped ONCE, when it is drawn, on where it lands: its box after
 * the current transform, before the projection (so a zoomed camera snaps in
 * world units, and zoom 2 moves in 2 px steps). Each edge of that box is
 * rounded to the nearest pixel, and the draw is moved and stretched by less
 * than a pixel to fit. Rounding the edges rather than a position and a size
 * keeps pieces that share an edge (tiles, the parts of a nine-slice) sharing
 * it, and is what a GPU already does when it fills a quad: a box from 10.25
 * to 15.75 covers pixels 10 to 15. A flipped draw has the same box as the
 * unflipped one, so it covers the same pixels.
 *
 * Translations are not snapped as they are applied: rounding at every
 * `translate` added the errors of nested translations up (10.6 then -6.5,
 * 4.1 exactly, landed on 5 or 3 depending on the backend), and made a flip
 * move a sprite by a pixel, its pivot rounding the same half the same way
 * twice instead of cancelling out.
 *
 * Rounding, not truncating: a position a float error short of a whole pixel
 * (223.99999999999997, as a body resting on the floor can come out of a
 * collision push-out) lands on that pixel, not the one before it.
 *
 * A rotated or skewed draw cannot sit on the pixel grid and is drawn where it
 * is, as is anything drawn under a perspective projection.
 * @ignore
 */

/** [kx, ox, ky, oy]: the correction {@link pixelSnap} returns */
const correction = new Float64Array(4);

/**
 * Round one axis of a box, `[min, max]`, into `correction` at `at`.
 * @ignore
 * @param {number} min - the box's low edge
 * @param {number} max - its high edge
 * @param {number} at - 0 for x, 2 for y
 * @returns {boolean} whether the axis moves or stretches
 */
function snapAxis(min, max, at) {
	const low = Math.round(min);
	let high = Math.round(max);
	// a draw thinner than a pixel keeps one, rather than vanishing
	if (high === low && max > min) {
		high = low + 1;
	}
	const size = max - min;
	const k = size > 0 ? (high - low) / size : 1;
	correction[at] = k;
	correction[at + 1] = low - k * min;
	return k !== 1 || low !== min;
}

/**
 * The correction that puts a draw on whole pixels: each output coordinate
 * `x` becomes `kx * x + ox`, and `y` becomes `ky * y + oy`.
 *
 * The transform maps the draw's local space to the renderer's:
 * `x' = a * x + c * y + e`, `y' = b * x + d * y + f`.
 * @ignore
 * @param {number} a - transform, x scale
 * @param {number} b - transform, y skew
 * @param {number} c - transform, x skew
 * @param {number} d - transform, y scale
 * @param {number} e - transform, x translation
 * @param {number} f - transform, y translation
 * @param {number} x - the local box the draw covers
 * @param {number} y - the local box the draw covers
 * @param {number} w - the local box the draw covers
 * @param {number} h - the local box the draw covers
 * @param {number} [pad=0] - added around the box on every side, in local
 * units: half the line width of a stroke, whose ink reaches past its path
 * @returns {Float64Array|null} `[kx, ox, ky, oy]`, valid until the next call,
 * or null when the draw is already on whole pixels or cannot be snapped
 */
export function pixelSnap(a, b, c, d, e, f, x, y, w, h, pad = 0) {
	// rotated or skewed: no box edge stays on the grid
	if (b !== 0 || c !== 0) {
		return null;
	}
	let minX = a * x + e;
	let maxX = minX + a * w;
	if (maxX < minX) {
		const t = minX;
		minX = maxX;
		maxX = t;
	}
	let minY = d * y + f;
	let maxY = minY + d * h;
	if (maxY < minY) {
		const t = minY;
		minY = maxY;
		maxY = t;
	}
	if (pad !== 0) {
		const px = Math.abs(a) * pad;
		const py = Math.abs(d) * pad;
		minX -= px;
		maxX += px;
		minY -= py;
		maxY += py;
	}
	// a draw as wide as a `ColorLayer` (Infinity), or broken input
	if (
		!Number.isFinite(minX) ||
		!Number.isFinite(maxX) ||
		!Number.isFinite(minY) ||
		!Number.isFinite(maxY)
	) {
		return null;
	}
	const movesX = snapAxis(minX, maxX, 0);
	const movesY = snapAxis(minY, maxY, 2);
	return movesX || movesY ? correction : null;
}

/**
 * Whether a `Matrix3d` is a 2D transform: x and y out depend on x and y in
 * only, with no perspective. A `Camera3d` view is not.
 * @ignore
 * @param {Float32Array|number[]} v - the matrix values, column-major
 * @returns {boolean}
 */
export function is2dTransform(v) {
	return (
		v[2] === 0 &&
		v[3] === 0 &&
		v[6] === 0 &&
		v[7] === 0 &&
		v[8] === 0 &&
		v[9] === 0 &&
		v[11] === 0 &&
		v[15] === 1
	);
}
