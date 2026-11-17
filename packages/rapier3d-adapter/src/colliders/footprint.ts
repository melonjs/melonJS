/**
 * A collider's footprint in XY, as its body is turned: what `getBodyAABB`
 * reports and `queryAABB` tests against.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import type { ColliderEntry } from "./types";

/** A box in XY: min x, min y, max x, max y. */
export type Footprint = [number, number, number, number];

/**
 * An empty footprint, ready to grow.
 * @returns a box that contains nothing
 */
export function emptyFootprint(): Footprint {
	return [Infinity, Infinity, -Infinity, -Infinity];
}

/**
 * Grow a box in XY by a collider's footprint as its body is turned, in
 * pixels, relative to the body's origin.
 * @param entry - the collider's entry
 * @param q - its body's turn
 * @param box - the box to grow
 */
export function growFootprint(
	entry: ColliderEntry,
	q: RAPIER.Rotation,
	box: Footprint,
): void {
	const { min, max, round } = entry;
	// a sphere or a capsule: the two ends of its segment, turned with the
	// body, a radius wider. Any other: the eight corners of its box, turned
	// with the body
	const r = round?.r ?? 0;
	const { x, y, z, w } = q;
	// the X and Y rows of the turn's matrix, once for every corner: a
	// footprint is in XY, so the turned point's z is never needed. Written
	// out rather than through `Quaternion#apply` on a shared vector, which
	// measured slower: a query runs this for every corner of every collider
	const r00 = 1 - 2 * (y * y + z * z);
	const r01 = 2 * (x * y - w * z);
	const r02 = 2 * (x * z + w * y);
	const r10 = 2 * (x * y + w * z);
	const r11 = 1 - 2 * (x * x + z * z);
	const r12 = 2 * (y * z - w * x);
	for (let i = 0; i < (round ? 2 : 8); i++) {
		let px: number;
		let py: number;
		let pz: number;
		if (round) {
			const end = i === 0 ? round.a : round.b;
			px = end.x;
			py = end.y;
			pz = end.z;
		} else {
			px = i & 1 ? max.x : min.x;
			py = i & 2 ? max.y : min.y;
			pz = i & 4 ? max.z : min.z;
		}
		const tx = r00 * px + r01 * py + r02 * pz;
		const ty = r10 * px + r11 * py + r12 * pz;
		if (tx - r < box[0]) box[0] = tx - r;
		if (ty - r < box[1]) box[1] = ty - r;
		if (tx + r > box[2]) box[2] = tx + r;
		if (ty + r > box[3]) box[3] = ty + r;
	}
}
