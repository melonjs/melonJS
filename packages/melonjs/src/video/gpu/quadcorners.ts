import type { Matrix3d } from "../../math/matrix3d.ts";
import { Vector3d } from "../../math/vector3d.ts";

/**
 * The quad corner transform shared by the quad batchers of both backends
 * (and their lit variants) — pure CPU code, no GPU references.
 *
 * A reusable pool of four `Vector3d` corners: the per-sprite depth rides
 * `z` so `Matrix3d.apply` fully rotates the vertex under a `Camera3d`
 * view matrix, while 2D-only matrices leave (x, y) bit-identical to the
 * legacy `Vector2d` path with z passing through unchanged. Callers must
 * always pass `z` explicitly — the vectors are shared, so leftover depth
 * from a previous quad would otherwise leak into a z = 0 blit.
 *
 * Module-level sharing is safe: a quad is assembled synchronously and the
 * corners are consumed before the next call, whichever backend (or
 * coexisting renderer) drives it.
 * @ignore
 * @internal
 */
const corners = [
	new Vector3d(),
	new Vector3d(),
	new Vector3d(),
	new Vector3d(),
];

/**
 * Set the four corners of an axis-aligned quad and transform them by `m`
 * (skipped when `m` is null/identity — the common untransformed case).
 * Returns the shared corner pool, valid until the next call:
 * `[topLeft, topRight, bottomLeft, bottomRight]`.
 * @ignore
 * @internal
 */
export function transformQuadCorners(
	m: Matrix3d | null | undefined,
	x: number,
	y: number,
	w: number,
	h: number,
	z: number,
): Vector3d[] {
	corners[0].set(x, y, z);
	corners[1].set(x + w, y, z);
	corners[2].set(x, y + h, z);
	corners[3].set(x + w, y + h, z);
	if (m && !m.isIdentity()) {
		m.apply(corners[0]);
		m.apply(corners[1]);
		m.apply(corners[2]);
		m.apply(corners[3]);
	}
	return corners;
}

/**
 * The scaled quad {@link scaleQuad} returns, shared like the corners.
 * @ignore
 * @internal
 */
const scaled = new Float64Array(4);

/**
 * Scale a quad's width by `sx` and its height by `sy` about its centre,
 * leaving its UVs alone: the texture stretches across the larger quad. This
 * is an effect's vertex stage (`ShaderEffect#_vertexScale`), the
 * `VERTEX *= factor` a shader with a vertex function would write, run here
 * because the quad batchers transform corners on the CPU. The effect's
 * fragment undoes the stretch, which leaves it room to draw past the
 * sprite's own edges.
 * Returns the shared array, valid until the next call: `[x, y, w, h]`.
 * @ignore
 * @internal
 */
export function scaleQuad(
	x: number,
	y: number,
	w: number,
	h: number,
	sx: number,
	sy: number,
): Float64Array {
	scaled[0] = x + (w * (1 - sx)) / 2;
	scaled[1] = y + (h * (1 - sy)) / 2;
	scaled[2] = w * sx;
	scaled[3] = h * sy;
	return scaled;
}
