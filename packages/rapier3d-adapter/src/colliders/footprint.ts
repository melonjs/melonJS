/**
 * A collider's footprint in XY, as its body is turned: what `getBodyAABB`
 * reports and `queryAABB` tests against.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import { rotate } from "../math/quaternion";
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
	for (let i = 0; i < (round ? 2 : 8); i++) {
		const p = rotate(
			q,
			round
				? i === 0
					? round.a
					: round.b
				: {
						x: i & 1 ? max.x : min.x,
						y: i & 2 ? max.y : min.y,
						z: i & 4 ? max.z : min.z,
					},
		);
		if (p.x - r < box[0]) box[0] = p.x - r;
		if (p.y - r < box[1]) box[1] = p.y - r;
		if (p.x + r > box[2]) box[2] = p.x + r;
		if (p.y + r > box[3]) box[3] = p.y + r;
	}
}
