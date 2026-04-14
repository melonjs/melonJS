import type { XYPoint } from "../utils/types.ts";
import type { Vector2d } from "./vector2d.ts";

/**
 * Normalize a vertex array to fit within a unit cube centered at the origin.
 * Vertices are scaled uniformly so that the largest axis spans [-0.5, 0.5].
 * Modifies the array in place.
 * @param vertices - vertex positions as x,y,z triplets
 */
export function normalizeVertices(vertices: Float32Array) {
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
 * @param src - source vertex positions (x,y,z triplets)
 * @param dst - destination array (x,y,z triplets, written in place)
 * @param count - number of vertices to project
 * @param matrix - 4x4 matrix values (column-major, 16 elements)
 * @param width - display width to map projected x to
 * @param height - display height to map projected y to
 * @param offsetX - x offset added to each projected vertex
 * @param offsetY - y offset added to each projected vertex
 * @param zScale - scale factor for Z output (0 = don't compute Z)
 */
export function projectVertices(
	src: Float32Array,
	dst: Float32Array,
	count: number,
	matrix: Float32Array,
	width: number,
	height: number,
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

const _defaultNormal: XYPoint = { x: 0, y: 0 };

/**
 * Compute the averaged perpendicular normal at a vertex in a 2D polyline.
 * At interior vertices, normals from both adjacent edges are averaged
 * to produce a smooth miter direction.
 * @param points - the polyline vertices
 * @param index - the vertex index
 * @param out - output object to write into (avoids allocation)
 * @returns unit normal
 */
export function computeVertexNormal(
	points: XYPoint[],
	index: number,
	out: XYPoint = _defaultNormal,
): XYPoint {
	let nx = 0;
	let ny = 0;
	const last = points.length - 1;
	const p = points[index];

	if (index < last) {
		const dx = points[index + 1].x - p.x;
		const dy = points[index + 1].y - p.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len > 0) {
			const invLen = 1 / len;
			nx -= dy * invLen;
			ny += dx * invLen;
		}
	}
	if (index > 0) {
		const dx = p.x - points[index - 1].x;
		const dy = p.y - points[index - 1].y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len > 0) {
			const invLen = 1 / len;
			nx -= dy * invLen;
			ny += dx * invLen;
		}
	}

	const nlen = Math.sqrt(nx * nx + ny * ny);
	if (nlen > 0) {
		const invNlen = 1 / nlen;
		nx *= invNlen;
		ny *= invNlen;
	} else {
		nx = 0;
		ny = 1;
	}

	out.x = nx;
	out.y = ny;
	return out;
}

/**
 * 2D cross product of vectors (p1-p0) and (p2-p0).
 * Positive = CCW, negative = CW, zero = collinear.
 * @ignore
 */
function cross2d(p0: XYPoint, p1: XYPoint, p2: XYPoint): number {
	return (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
}

/**
 * Squared distance between two 2D points.
 * @ignore
 */
function dist2(a: XYPoint, b: XYPoint): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

/**
 * Compute the convex hull of a set of 2D points using the Graham scan algorithm.
 * The input array is sorted in place. Returns a subset of the input points
 * forming the convex hull in counter-clockwise order.
 * @param points - array of 2D points (modified in place by sorting)
 * @returns convex hull vertices in CCW order
 */
export function convexHull(points: Vector2d[]): Vector2d[] {
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
	const hull: Vector2d[] = [points[0], points[1]];
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
