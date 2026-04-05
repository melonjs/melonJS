/**
 * Generate triangle fan vertices for arcs, ellipses, and rounded rect corners.
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {number} rx - horizontal radius
 * @param {number} ry - vertical radius
 * @param {number} startAngle - start angle in radians
 * @param {number} endAngle - end angle in radians
 * @param {number} segments - number of segments
 * @returns {Array<{x: number, y: number}>} triangle vertices
 */
export function generateTriangleFan(
	cx,
	cy,
	rx,
	ry,
	startAngle,
	endAngle,
	segments,
) {
	const angleStep = (endAngle - startAngle) / segments;
	const verts = [];
	for (let i = 0; i < segments; i++) {
		const a1 = startAngle + i * angleStep;
		const a2 = a1 + angleStep;
		verts.push(
			{ x: cx, y: cy },
			{ x: cx + Math.cos(a1) * rx, y: cy + Math.sin(a1) * ry },
			{ x: cx + Math.cos(a2) * rx, y: cy + Math.sin(a2) * ry },
		);
	}
	return verts;
}

/**
 * Generate triangle vertices for round line join circles at the given centers.
 * @param {Array<{x: number, y: number}>} centers - join point positions
 * @param {number} radius - join circle radius (typically lineWidth / 2)
 * @returns {Array<{x: number, y: number}>} triangle vertices
 */
export function generateJoinCircles(centers, radius) {
	const segments = 8;
	const angleStep = (Math.PI * 2) / segments;
	const verts = [];

	for (let c = 0; c < centers.length; c++) {
		const cx = centers[c].x;
		const cy = centers[c].y;
		for (let i = 0; i < segments; i++) {
			const a1 = i * angleStep;
			const a2 = a1 + angleStep;
			verts.push(
				{ x: cx, y: cy },
				{ x: cx + Math.cos(a1) * radius, y: cy + Math.sin(a1) * radius },
				{ x: cx + Math.cos(a2) * radius, y: cy + Math.sin(a2) * radius },
			);
		}
	}

	return verts;
}
