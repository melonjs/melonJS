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
