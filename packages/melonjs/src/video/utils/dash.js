/**
 * Apply a dash pattern across an entire path (multiple connected segments).
 * Carries the dash state across segment boundaries for continuous dashing.
 * @param {Array<{x: number, y: number}>} pts - pairs of start/end points
 * @param {number[]} pattern - dash pattern [on, off, on, off, ...]
 * @returns {Array<{x: number, y: number}>} dashed segment pairs
 */
export function dashPath(pts, pattern) {
	if (
		!pattern.some((v) => {
			return v > 0;
		})
	) {
		return pts.slice();
	}

	const result = [];
	let patIdx = 0;
	let drawing = true;
	let remaining = pattern[0];

	for (let i = 0; i < pts.length - 1; i += 2) {
		const x0 = pts[i].x;
		const y0 = pts[i].y;
		const x1 = pts[i + 1].x;
		const y1 = pts[i + 1].y;
		const dx = x1 - x0;
		const dy = y1 - y0;
		const segLen = Math.sqrt(dx * dx + dy * dy);
		if (segLen === 0) {
			continue;
		}
		const nx = dx / segLen;
		const ny = dy / segLen;
		let dist = 0;

		while (dist < segLen) {
			const step = Math.min(remaining, segLen - dist);
			if (drawing) {
				result.push(
					{ x: x0 + nx * dist, y: y0 + ny * dist },
					{ x: x0 + nx * (dist + step), y: y0 + ny * (dist + step) },
				);
			}
			dist += step;
			remaining -= step;
			if (remaining <= 0) {
				drawing = !drawing;
				patIdx = (patIdx + 1) % pattern.length;
				remaining = pattern[patIdx];
				// skip zero-length entries
				while (remaining <= 0 && patIdx < pattern.length * 2) {
					drawing = !drawing;
					patIdx = (patIdx + 1) % pattern.length;
					remaining = pattern[patIdx];
				}
			}
		}
	}
	return result;
}

/**
 * Split a single line segment into dashed sub-segments.
 * @param {number} x0 - start x
 * @param {number} y0 - start y
 * @param {number} x1 - end x
 * @param {number} y1 - end y
 * @param {number[]} pattern - dash pattern [on, off, on, off, ...]
 * @returns {Array<{x: number, y: number}>} pairs of start/end points for visible segments
 */
export function dashSegments(x0, y0, x1, y1, pattern) {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const lineLen = Math.sqrt(dx * dx + dy * dy);
	if (lineLen === 0 || pattern.length === 0) {
		return [
			{ x: x0, y: y0 },
			{ x: x1, y: y1 },
		];
	}

	const nx = dx / lineLen;
	const ny = dy / lineLen;
	// bail out if pattern has no positive values (would loop forever)
	if (
		!pattern.some((v) => {
			return v > 0;
		})
	) {
		return [
			{ x: x0, y: y0 },
			{ x: x1, y: y1 },
		];
	}

	const segments = [];
	let dist = 0;
	let patIdx = 0;
	let drawing = true;

	while (dist < lineLen) {
		const dashLen = pattern[patIdx % pattern.length];
		if (dashLen <= 0) {
			patIdx++;
			drawing = !drawing;
			continue;
		}
		const segEnd = Math.min(dist + dashLen, lineLen);

		if (drawing) {
			segments.push(
				{ x: x0 + nx * dist, y: y0 + ny * dist },
				{ x: x0 + nx * segEnd, y: y0 + ny * segEnd },
			);
		}

		dist = segEnd;
		drawing = !drawing;
		patIdx++;
	}

	return segments;
}
