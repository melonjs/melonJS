/**
 * Primitive-batcher geometry assembly shared by both backends — pure CPU
 * code, no GPU references (the `meshchunk.ts` / `meshvertex.ts`
 * precedent). The vertex layout is the primitive tier's 6-float
 * `x, y, z, nx, ny, packed-color` stream on both backends.
 * @ignore
 * @internal
 */

/** the minimal vertex-buffer surface this module writes — `@ignore` */
interface PrimitiveVertexData {
	push(
		x: number,
		y: number,
		z: number,
		nx: number,
		ny: number,
		color: number,
	): void;
	isFull(count: number): boolean;
}

/** a 4×4 column-major transform (Matrix3d-shaped) — `@ignore` */
interface MatrixLike {
	val: Float32Array;
	isIdentity(): boolean;
}

interface PointLike {
	x: number;
	y: number;
}

/**
 * Push `verts[start..end)` into the vertex buffer, transformed by the
 * given view matrix. The caller guarantees the range fits.
 *
 * The transform includes the z column (m[8] / m[9] / m[10] / m[14]) so
 * Camera3d's view matrix (X/Y-axis rotation) actually rotates the
 * primitive in 3D. For 2D matrices those slots are identity, so output
 * (x, y, z) is bit-identical to the legacy 2D-only multiply.
 * @ignore
 * @internal
 */
export function pushPrimitiveRange(
	vertexData: PrimitiveVertexData,
	viewMatrix: MatrixLike,
	verts: PointLike[],
	start: number,
	end: number,
	colorUint32: number,
	z: number,
): void {
	if (!viewMatrix.isIdentity()) {
		const m = viewMatrix.val;
		for (let i = start; i < end; i++) {
			const vert = verts[i];
			const x = vert.x;
			const y = vert.y;
			vertexData.push(
				x * m[0] + y * m[4] + z * m[8] + m[12],
				x * m[1] + y * m[5] + z * m[9] + m[13],
				x * m[2] + y * m[6] + z * m[10] + m[14],
				0,
				0,
				colorUint32,
			);
		}
	} else {
		for (let i = start; i < end; i++) {
			const vert = verts[i];
			vertexData.push(vert.x, vert.y, z, 0, 0, colorUint32);
		}
	}
}

/**
 * Expand line pairs into triangles with perpendicular normals. The vertex
 * shader offsets each vertex by `aNormal * uLineWidth * 0.5`, producing
 * thick lines without manual geometry expansion in the renderer. The
 * caller has already switched its draw mode to triangles.
 *
 * Each line pair expands to 2 triangles (6 vertices) — capacity is
 * checked per pair through the `flush` callback, so a dashed/long
 * thick-line path larger than the whole buffer flushes mid-shape instead
 * of silently dropping the out-of-range writes (pairs are independent
 * quads, so a mid-shape flush is invisible).
 *
 * The view matrix is applied (z column included) without mutating the
 * inputs. Note: the perpendicular normal is computed in pre-projection
 * world space, which appears non-perpendicular under perspective — a
 * known limitation shared by both backends.
 * @param vertexData - destination vertex stream
 * @param viewMatrix - the current view matrix
 * @param verts - line vertices in pairs [from, to, from, to, ...]
 * @param vertexCount - number of vertices to consume
 * @param colorUint32 - packed line color
 * @param z - the current renderer depth
 * @param flush - drains the vertex buffer when a pair no longer fits
 * @ignore
 * @internal
 */
export function expandLinesToTriangles(
	vertexData: PrimitiveVertexData,
	viewMatrix: MatrixLike,
	verts: PointLike[],
	vertexCount: number,
	colorUint32: number,
	z: number,
	flush: () => void,
): void {
	const hasTransform = !viewMatrix.isIdentity();
	const m = hasTransform ? viewMatrix.val : null;

	for (let i = 0; i < vertexCount; i += 2) {
		const from = verts[i];
		const to = verts[i + 1];

		if (vertexData.isFull(6)) {
			flush();
		}

		let fromX: number;
		let fromY: number;
		let fromZ: number;
		let toX: number;
		let toY: number;
		let toZ: number;
		if (m !== null) {
			fromX = from.x * m[0] + from.y * m[4] + z * m[8] + m[12];
			fromY = from.x * m[1] + from.y * m[5] + z * m[9] + m[13];
			fromZ = from.x * m[2] + from.y * m[6] + z * m[10] + m[14];
			toX = to.x * m[0] + to.y * m[4] + z * m[8] + m[12];
			toY = to.x * m[1] + to.y * m[5] + z * m[9] + m[13];
			toZ = to.x * m[2] + to.y * m[6] + z * m[10] + m[14];
		} else {
			fromX = from.x;
			fromY = from.y;
			fromZ = z;
			toX = to.x;
			toY = to.y;
			toZ = z;
		}

		// compute perpendicular unit normal
		const dx = toX - fromX;
		const dy = toY - fromY;
		const len = Math.sqrt(dx * dx + dy * dy);

		if (len === 0) {
			continue;
		}

		const nx = -dy / len;
		const ny = dx / len;

		// two triangles forming a quad around the line segment
		vertexData.push(fromX, fromY, fromZ, nx, ny, colorUint32);
		vertexData.push(fromX, fromY, fromZ, -nx, -ny, colorUint32);
		vertexData.push(toX, toY, toZ, -nx, -ny, colorUint32);

		vertexData.push(fromX, fromY, fromZ, nx, ny, colorUint32);
		vertexData.push(toX, toY, toZ, -nx, -ny, colorUint32);
		vertexData.push(toX, toY, toZ, nx, ny, colorUint32);
	}
}
