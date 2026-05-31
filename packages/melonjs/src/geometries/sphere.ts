import { Vector3d } from "../math/vector3d.ts";
import { AABB3d } from "../physics/broadphase/aabb3d.ts";
import { createPool } from "../system/pool.ts";

/**
 * A 3D sphere — `{ centre, radius }`. Sibling of {@link Ellipse} in
 * the geometry surface; used by {@link Octree} / `adapter.querySphere`
 * as the canonical 3D region-query shape, and by user code for any
 * sphere-vs-sphere / sphere-vs-AABB collision check under
 * {@link Camera3d}.
 *
 * Not currently part of the {@link BodyShape} union — `Body` is 2D-
 * only in melonJS today; Sphere is a math/geometry primitive that
 * would slot in once a 3D physics adapter ships.
 * @category Geometry
 * @example
 * import { Sphere } from "melonjs";
 *
 * const a = new Sphere(0, 0, 0, 10);
 * const b = new Sphere(15, 0, 0, 10);
 * a.overlaps(b); // true — surfaces touch at x = 5
 */
export class Sphere {
	/** Centre coordinates of the sphere (Y-down, +Z forward — Camera3d convention). */
	pos: Vector3d;

	/** Sphere radius. Negative values are treated like their absolute value in {@link Sphere.overlaps} / {@link Sphere.contains}. */
	radius: number;

	/**
	 * Cached AABB for this sphere. Allocated lazily on the first
	 * {@link Sphere.getBounds} call so a sphere used only for inline
	 * `overlaps` checks doesn't pay for the AABB.
	 * @ignore
	 */
	_bounds?: AABB3d;

	/**
	 * @param x - centre x
	 * @param y - centre y
	 * @param z - centre z
	 * @param radius - sphere radius
	 */
	constructor(x: number, y: number, z: number, radius: number) {
		this.pos = new Vector3d(x, y, z);
		this.radius = radius;
	}

	/**
	 * Re-position and resize the sphere in one shot. Mirrors
	 * {@link Ellipse.setShape}.
	 * @param x - centre x
	 * @param y - centre y
	 * @param z - centre z
	 * @param radius - sphere radius
	 * @returns this sphere for chaining
	 */
	setShape(x: number, y: number, z: number, radius: number) {
		this.pos.set(x, y, z);
		this.radius = radius;
		// Invalidate the cached AABB — next `getBounds` call rebuilds.
		if (typeof this._bounds !== "undefined") {
			this._updateBounds();
		}
		return this;
	}

	/**
	 * Test whether a point lies inside the sphere (boundary inclusive).
	 * Squared-distance test — no `sqrt` on the hot path. Matches the
	 * boundary convention of {@link AABB3d.contains}.
	 * @param x - point x
	 * @param y - point y
	 * @param z - point z
	 */
	contains(x: number, y: number, z: number): boolean;
	/**
	 * Vector form of {@link Sphere.contains}.
	 * @param v - point
	 */
	contains(v: Vector3d): boolean;
	contains(xOrV: Vector3d | number, y?: number, z?: number): boolean {
		let px: number;
		let py: number;
		let pz: number;
		if (xOrV instanceof Vector3d) {
			px = xOrV.x;
			py = xOrV.y;
			pz = xOrV.z;
		} else {
			px = xOrV;
			py = y!;
			pz = z!;
		}
		const dx = px - this.pos.x;
		const dy = py - this.pos.y;
		const dz = pz - this.pos.z;
		// Use radius², handle negative-radius callers via `r * r`
		// (which is positive regardless of sign).
		return dx * dx + dy * dy + dz * dz <= this.radius * this.radius;
	}

	/**
	 * Test whether this sphere overlaps another. Boundary inclusive
	 * (touching surfaces count as overlap), matching
	 * {@link AABB3d.overlaps}.
	 * @param other - the other sphere
	 */
	overlaps(other: Sphere): boolean {
		const dx = this.pos.x - other.pos.x;
		const dy = this.pos.y - other.pos.y;
		const dz = this.pos.z - other.pos.z;
		// Use |r| on each side so negative radii behave like their
		// absolute value (matches the documented contract in
		// {@link Sphere.radius} and the sign-cancelling `r * r` in
		// {@link Sphere.contains}). A naked `this.radius + other.radius`
		// would collapse to ~0 when one side passes a negative.
		const r = Math.abs(this.radius) + Math.abs(other.radius);
		return dx * dx + dy * dy + dz * dz <= r * r;
	}

	/**
	 * Test whether this sphere overlaps an axis-aligned box. Delegates
	 * to {@link AABB3d.overlapsSphere} so the two shapes agree on
	 * boundary semantics.
	 * @param aabb - the box
	 */
	overlapsAABB(aabb: AABB3d): boolean {
		return aabb.overlapsSphere(this.pos.x, this.pos.y, this.pos.z, this.radius);
	}

	/**
	 * Smallest {@link AABB3d} containing this sphere. Cached — repeat
	 * calls without a `setShape` between return the same instance and
	 * the same values.
	 */
	getBounds(): AABB3d {
		if (typeof this._bounds === "undefined") {
			this._bounds = new AABB3d();
			this._updateBounds();
		}
		return this._bounds;
	}

	/** @ignore */
	_updateBounds() {
		const r = Math.abs(this.radius);
		this._bounds!.setMinMax(
			this.pos.x - r,
			this.pos.y - r,
			this.pos.z - r,
			this.pos.x + r,
			this.pos.y + r,
			this.pos.z + r,
		);
	}

	/**
	 * Reset the sphere to a zero-radius point at the origin.
	 */
	clear() {
		this.pos.set(0, 0, 0);
		this.radius = 0;
		if (typeof this._bounds !== "undefined") {
			this._updateBounds();
		}
		return this;
	}

	/**
	 * Deep copy of this sphere. The clone shares NOTHING with the
	 * original — independent `pos` Vector3d, independent AABB cache.
	 * Pulls from {@link spherePool} so back-to-back clones are
	 * allocation-free.
	 */
	clone() {
		return spherePool.get(this.pos.x, this.pos.y, this.pos.z, this.radius);
	}
}

/**
 * A pool of {@link Sphere} instances. Mirrors {@link ellipsePool} —
 * `spherePool.get(x, y, z, r)` recycles an existing instance via
 * `setShape` before allocating a new one; release via the
 * matching `.release()` (the `createPool` contract).
 */
export const spherePool = createPool<
	Sphere,
	[x: number, y: number, z: number, radius: number]
>((x, y, z, radius) => {
	const instance = new Sphere(x, y, z, radius);
	return {
		instance,
		reset(x, y, z, radius) {
			instance.setShape(x, y, z, radius);
		},
	};
});
