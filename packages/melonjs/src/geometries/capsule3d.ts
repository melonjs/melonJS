import { Vector3d } from "../math/vector3d.ts";
import { Bounds } from "../physics/bounds.ts";
import { AABB3d } from "../physics/broadphase/aabb3d.ts";
import { Box3d } from "./box3d.ts";

/**
 * A capsule standing upright: a vertical cylinder with a half-sphere on each
 * end, usable as a {@link Body} collision shape. The shape for a character in
 * a 3D world: its rounded bottom slides up slopes and steps instead of
 * catching on every edge, as a box would.
 *
 * Like {@link Box3d} and {@link Sphere}, `pos` is the **center**, and the
 * convention is the engine's 3D one (see {@link Camera3d}): Y-down, +Z
 * forward. It stands along Y; a physics engine that turns bodies turns it
 * with its body.
 *
 * A 3D physics adapter (`@melonjs/rapier3d-adapter`) builds it exactly. The
 * built-in physics approximates it by its bounding {@link Box3d}, and the 2D
 * adapters refuse it.
 * @category Geometry
 * @example
 * // a character 180 units tall, 30 across, centered on its own position
 * hero.bodyDef = { type: "dynamic", shapes: [new Capsule3d(0, 0, 0, 15, 180)] };
 */
export class Capsule3d {
	/** the center of the capsule, as an offset from the owning body's position */
	pos: Vector3d;

	/** the radius of the cylinder and of its two rounded ends */
	radius: number;

	/** the total height, rounded ends included; never less than `2 × radius` */
	height: number;

	/**
	 * the shape type (used internally)
	 * @default "Capsule3d"
	 */
	type = "Capsule3d";

	/**
	 * Optional per-shape collision settings (see {@link Body#addShape}).
	 */
	declare collisionType?: number;
	declare collisionMask?: number;
	/** `false` takes this shape out of collision without removing it */
	declare isActive?: boolean;
	/** `true` reports contacts but skips the position correction */
	declare isTrigger?: boolean;

	/**
	 * @ignore
	 * @internal
	 */
	_bounds: Bounds;

	/**
	 * @param x - center on the horizontal axis
	 * @param y - center on the vertical axis
	 * @param z - center on the depth axis
	 * @param radius - the radius of the cylinder and its ends
	 * @param height - the total height, ends included
	 */
	constructor(x = 0, y = 0, z = 0, radius = 0, height = 0) {
		this.pos = new Vector3d();
		this.radius = 0;
		this.height = 0;
		this._bounds = new Bounds();
		this.setShape(x, y, z, radius, height);
	}

	/**
	 * set a new position and size
	 * @param x - center on the horizontal axis
	 * @param y - center on the vertical axis
	 * @param z - center on the depth axis
	 * @param radius - the radius of the cylinder and its ends
	 * @param height - the total height, ends included
	 * @returns this capsule, for chaining
	 */
	setShape(x: number, y: number, z: number, radius: number, height: number) {
		this.pos.set(x, y, z);
		this.radius = Number.isFinite(radius) ? Math.abs(radius) : 0;
		const h = Number.isFinite(height) ? Math.abs(height) : 0;
		// a capsule shorter than its two ends is a sphere
		this.height = Math.max(h, this.radius * 2);
		return this;
	}

	/**
	 * half the length of the straight part between the two rounded ends: `0`
	 * for a capsule that is a sphere, and never less, whatever `radius` and
	 * `height` were set to since {@link Capsule3d#setShape}. What Rapier
	 * calls the capsule's half height.
	 */
	get halfSegment(): number {
		return Math.max(this.height / 2 - Math.abs(this.radius), 0) || 0;
	}

	/**
	 * translate this capsule by the given offset
	 * @param x - x offset, or a vector carrying the whole offset
	 * @param [y] - y offset
	 * @param [z] - z offset
	 * @returns this capsule, for chaining
	 */
	shift(x: number | Vector3d, y = 0, z = 0) {
		if (typeof x === "object") {
			this.pos.add(x);
		} else {
			this.pos.set(this.pos.x + x, this.pos.y + y, this.pos.z + z);
		}
		return this;
	}

	/**
	 * the 2D XY footprint of this capsule (see {@link Box3d#getBounds})
	 * @returns the XY footprint
	 */
	getBounds(): Bounds {
		const r = Math.abs(this.radius);
		// not `height / 2`: the two can be written apart, and a capsule is
		// never shorter than its two ends
		const h = this.halfSegment + r;
		this._bounds.setMinMax(
			this.pos.x - r,
			this.pos.y - h,
			this.pos.x + r,
			this.pos.y + h,
		);
		return this._bounds;
	}

	/**
	 * the 3D bounds of this capsule, in the body's local space
	 * @param [out] - an existing AABB3d to write into, to avoid allocating
	 * @returns the 3D bounds
	 */
	getBounds3d(out?: AABB3d): AABB3d {
		const target = out ?? new AABB3d();
		const r = Math.abs(this.radius);
		// not `height / 2`: the two can be written apart, and a capsule is
		// never shorter than its two ends
		const h = this.halfSegment + r;
		target.setMinMax(
			this.pos.x - r,
			this.pos.y - h,
			this.pos.z - r,
			this.pos.x + r,
			this.pos.y + h,
			this.pos.z + r,
		);
		return target;
	}

	/**
	 * true if this capsule contains the given point
	 * @param x - point x, or a vector carrying the whole point
	 * @param [y] - point y
	 * @param [z] - point z
	 */
	contains(x: number | Vector3d, y = 0, z = 0): boolean {
		const isVector = typeof x === "object";
		const dx = (isVector ? x.x : x) - this.pos.x;
		const dy = (isVector ? x.y : y) - this.pos.y;
		const dz = (isVector ? x.z : z) - this.pos.z;
		// distance to the axis segment, clamped to its two ends
		const s = this.halfSegment;
		const cy = Math.min(Math.max(dy, -s), s);
		const ey = dy - cy;
		return dx * dx + ey * ey + dz * dz <= this.radius * this.radius;
	}

	/**
	 * The axis-aligned box around this capsule: what the built-in physics
	 * resolves it as.
	 * @returns a new Box3d
	 */
	toBox3d(): Box3d {
		const r = Math.abs(this.radius);
		return new Box3d(
			this.pos.x,
			this.pos.y,
			this.pos.z,
			r * 2,
			(this.halfSegment + r) * 2,
			r * 2,
		);
	}

	/**
	 * clone this capsule
	 * @returns a new Capsule3d
	 */
	clone(): Capsule3d {
		return new Capsule3d(
			this.pos.x,
			this.pos.y,
			this.pos.z,
			this.radius,
			this.height,
		);
	}
}
