/**
 * The quaternion arithmetic the adapter needs on Rapier's plain `{x, y, z, w}`
 * rotations, without allocating melonJS objects.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import type { XYZ } from "./units";

/**
 * Turn a vector by a unit quaternion.
 * @param q - the turn
 * @param v - the vector
 * @returns a new, turned vector
 */
export function rotate(q: RAPIER.Rotation, v: XYZ): XYZ {
	// v + 2w (q × v) + 2 q × (q × v)
	const tx = 2 * (q.y * v.z - q.z * v.y);
	const ty = 2 * (q.z * v.x - q.x * v.z);
	const tz = 2 * (q.x * v.y - q.y * v.x);
	return {
		x: v.x + q.w * tx + (q.y * tz - q.z * ty),
		y: v.y + q.w * ty + (q.z * tx - q.x * tz),
		z: v.z + q.w * tz + (q.x * ty - q.y * tx),
	};
}

/**
 * The inverse of a unit quaternion.
 * @param q - the turn
 * @returns the turn back
 */
export function conjugate(q: RAPIER.Rotation): RAPIER.Rotation {
	return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/**
 * Two turns composed: `a` applied after `b`.
 * @param a - the second turn
 * @param b - the first turn
 * @returns the combined turn
 */
export function multiply(
	a: RAPIER.Rotation,
	b: RAPIER.Rotation,
): RAPIER.Rotation {
	return {
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
	};
}
