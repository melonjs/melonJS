/**
 * Utility functions for 3D vertex operations.
 * @namespace vertexUtils
 */

/**
 * Normalize a vertex array to fit within a unit cube centered at the origin.
 * Vertices are scaled uniformly so that the largest axis spans [-0.5, 0.5].
 * Modifies the array in place.
 * @param {Float32Array} vertices - vertex positions as x,y,z triplets
 * @memberof vertexUtils
 */
export function normalizeVertices(vertices) {
	const len = vertices.length;
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;

	// single pass to find bounds — cache indexed reads
	for (let i = 0; i < len; i += 3) {
		const x = vertices[i];
		const y = vertices[i + 1];
		const z = vertices[i + 2];
		if (x < minX) {
			minX = x;
		}
		if (x > maxX) {
			maxX = x;
		}
		if (y < minY) {
			minY = y;
		}
		if (y > maxY) {
			maxY = y;
		}
		if (z < minZ) {
			minZ = z;
		}
		if (z > maxZ) {
			maxZ = z;
		}
	}

	const cx = (minX + maxX) * 0.5;
	const cy = (minY + maxY) * 0.5;
	const cz = (minZ + maxZ) * 0.5;
	// precompute reciprocal to replace division with multiplication in the loop
	const invScale =
		1.0 / Math.max(maxX - minX || 1, maxY - minY || 1, maxZ - minZ || 1);

	for (let i = 0; i < len; i += 3) {
		vertices[i] = (vertices[i] - cx) * invScale;
		vertices[i + 1] = (vertices[i + 1] - cy) * invScale;
		vertices[i + 2] = (vertices[i + 2] - cz) * invScale;
	}
}

/**
 * Project 3D vertices through a 4x4 matrix with perspective divide,
 * mapping the result to a 2D display area.
 * @param {Float32Array} src - source vertex positions (x,y,z triplets)
 * @param {Float32Array} dst - destination array (x,y,z triplets, written in place)
 * @param {number} count - number of vertices to project
 * @param {Float32Array} matrix - 4x4 matrix values (column-major, 16 elements)
 * @param {number} width - display width to map projected x to
 * @param {number} height - display height to map projected y to
 * @param {number} [offsetX=0] - x offset added to each projected vertex
 * @param {number} [offsetY=0] - y offset added to each projected vertex
 * @param {number} [zScale=0] - scale factor for Z output (0 = don't compute Z)
 * @memberof vertexUtils
 */
export function projectVertices(
	src,
	dst,
	count,
	matrix,
	width,
	height,
	offsetX = 0,
	offsetY = 0,
	zScale = 0,
) {
	// hoist all constants out of the loop
	const centerX = width * 0.5 + offsetX;
	const centerY = height * 0.5 + offsetY;
	const negHeight = -height;

	// extract matrix elements once (avoids repeated indexed access)
	const m0 = matrix[0];
	const m1 = matrix[1];
	const m2 = matrix[2];
	const m3 = matrix[3];
	const m4 = matrix[4];
	const m5 = matrix[5];
	const m6 = matrix[6];
	const m7 = matrix[7];
	const m8 = matrix[8];
	const m9 = matrix[9];
	const m10 = matrix[10];
	const m11 = matrix[11];
	const m12 = matrix[12];
	const m13 = matrix[13];
	const m14 = matrix[14];
	const m15 = matrix[15];

	if (zScale !== 0) {
		const negZScale = -zScale;
		for (let i = 0; i < count; i++) {
			const i3 = i * 3;
			const vx = src[i3];
			const vy = src[i3 + 1];
			const vz = src[i3 + 2];

			const tw = m3 * vx + m7 * vy + m11 * vz + m15;
			const invW = tw !== 0 ? 1.0 / tw : 1.0;

			dst[i3] = (m0 * vx + m4 * vy + m8 * vz + m12) * invW * width + centerX;
			dst[i3 + 1] =
				(m1 * vx + m5 * vy + m9 * vz + m13) * invW * negHeight + centerY;
			dst[i3 + 2] = (m2 * vx + m6 * vy + m10 * vz + m14) * invW * negZScale;
		}
	} else {
		// fast path: skip Z computation entirely
		for (let i = 0; i < count; i++) {
			const i3 = i * 3;
			const vx = src[i3];
			const vy = src[i3 + 1];
			const vz = src[i3 + 2];

			const tw = m3 * vx + m7 * vy + m11 * vz + m15;
			const invW = tw !== 0 ? 1.0 / tw : 1.0;

			dst[i3] = (m0 * vx + m4 * vy + m8 * vz + m12) * invW * width + centerX;
			dst[i3 + 1] =
				(m1 * vx + m5 * vy + m9 * vz + m13) * invW * negHeight + centerY;
			dst[i3 + 2] = 0;
		}
	}
}

/**
 * 2D cross product of vectors (p1-p0) and (p2-p0).
 * Positive = CCW, negative = CW, zero = collinear.
 * @param {Vector2d} p0
 * @param {Vector2d} p1
 * @param {Vector2d} p2
 * @returns {number}
 * @ignore
 */
function cross2d(p0, p1, p2) {
	return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

/**
 * Squared distance between two 2D points.
 * @param {Vector2d} a
 * @param {Vector2d} b
 * @returns {number}
 * @ignore
 */
function dist2(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

/**
 * Compute the convex hull of a set of 2D points using the Graham scan algorithm.
 * The input array is sorted in place. Returns a subset of the input points
 * forming the convex hull in counter-clockwise order.
 * @param {Vector2d[]} points - array of 2D points (modified in place by sorting)
 * @returns {Vector2d[]} convex hull vertices in CCW order
 * @memberof vertexUtils
 */
export function convexHull(points) {
	const len = points.length;
	if (len <= 3) {
		return points;
	}

	// find the bottom-most (then left-most) point as pivot
	let pivotIdx = 0;
	let pivotY = points[0].y;
	let pivotX = points[0].x;

	for (let i = 1; i < len; i++) {
		const py = points[i].y;
		const px = points[i].x;
		if (py > pivotY || (py === pivotY && px < pivotX)) {
			pivotIdx = i;
			pivotY = py;
			pivotX = px;
		}
	}

	// swap pivot to index 0
	[points[0], points[pivotIdx]] = [points[pivotIdx], points[0]];
	const p0 = points[0];

	// sort remaining points by polar angle relative to pivot
	points.sort((a, b) => {
		if (a === p0) {
			return -1;
		}
		if (b === p0) {
			return 1;
		}
		const c = cross2d(p0, a, b);
		return c !== 0 ? -c : dist2(p0, a) - dist2(p0, b);
	});

	// build hull using a stack
	const hull = [points[0], points[1]];
	for (let i = 2; i < len; i++) {
		const pt = points[i];
		while (
			hull.length > 1 &&
			cross2d(hull[hull.length - 2], hull[hull.length - 1], pt) <= 0
		) {
			hull.pop();
		}
		hull.push(pt);
	}

	return hull;
}
