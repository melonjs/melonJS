/**
 * What the adapter keeps about a collider.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import type { BodyShape, Renderable } from "melonjs";
import type { XYZ } from "../math/units";

/**
 * A sphere or a capsule as the segment its radius sweeps, in body space and
 * pixels: its bounds once turned are those of the turned segment, a radius
 * wider, where its turned box would be too large.
 */
export interface RoundShape {
	a: XYZ;
	b: XYZ;
	r: number;
}

/** What the adapter knows about one Rapier collider. */
export interface ColliderEntry {
	renderable: Renderable;
	/** the melonJS shape it was built from */
	shape: BodyShape;
	/** that shape's index in the body definition */
	index: number;
	/** the collider's box in body space, in pixels, before the body turns */
	min: XYZ;
	max: XYZ;
	round?: RoundShape;
}

/** A collider ready to be made: its description, and what is kept about it. */
export interface ColliderPart {
	shape: BodyShape;
	index: number;
	desc: RAPIER.ColliderDesc;
	min: XYZ;
	max: XYZ;
	round?: RoundShape;
}

/**
 * What was changed on every collider of a body at run time, so that
 * `updateShape()` gives it to the new ones.
 */
export interface ColliderOverrides {
	category?: number;
	mask?: number;
	sensor?: boolean;
	restitution?: number;
}
