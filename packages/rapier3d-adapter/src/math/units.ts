/**
 * Pixels and meters. melonJS works in pixels; Rapier is tuned for objects
 * about a meter across, so the adapter converts at every boundary.
 */
import type { Vector3Like } from "../types";

/** A point or a vector in three dimensions, in pixels or meters. */
export type XYZ = { x: number; y: number; z: number };

/**
 * The `z` of a vector that may not have one.
 * @param v - the vector
 * @returns its `z`, or `undefined`
 */
export function zOf(v: Vector3Like): number | undefined {
	return typeof v.z === "number" ? v.z : undefined;
}

/** The scale between melonJS pixels and Rapier meters. */
export class Units {
	readonly pixelsPerMeter: number;

	/**
	 * @param pixelsPerMeter - how many pixels make a meter
	 */
	constructor(pixelsPerMeter: number) {
		this.pixelsPerMeter = pixelsPerMeter;
	}

	/**
	 * @param px - a length in pixels
	 * @returns the same length in meters
	 */
	toMeters(px: number): number {
		return px / this.pixelsPerMeter;
	}

	/**
	 * @param m - a length in meters
	 * @returns the same length in pixels
	 */
	toPixels(m: number): number {
		return m * this.pixelsPerMeter;
	}

	/**
	 * A point or a vector in pixels, in meters.
	 * @param x - along X, in pixels
	 * @param y - along Y, in pixels
	 * @param z - along Z, in pixels
	 * @returns a new point in meters
	 */
	inMeters(x: number, y: number, z: number): XYZ {
		return { x: this.toMeters(x), y: this.toMeters(y), z: this.toMeters(z) };
	}
}
