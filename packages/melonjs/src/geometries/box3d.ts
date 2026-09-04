import { Vector2d } from "../math/vector2d.ts";
import { Vector3d } from "../math/vector3d.ts";
import { Bounds } from "../physics/bounds.ts";
import { AABB3d } from "../physics/broadphase/aabb3d.ts";
import { createPool } from "../system/pool.ts";
import { Polygon } from "./polygon.ts";

/**
 * Smallest XY footprint edge handed to {@link Polygon#recalc}. See
 * {@link Box3d#_syncFootprint} for why a zero-length edge is unsafe.
 * @ignore
 * @internal
 */
const MIN_FOOTPRINT = 1e-6;

/**
 * An axis-aligned 3D box, usable as a {@link Body} collision shape.
 *
 * This is the shape that lets a body collide along **Z** as well as X and Y.
 * Every other built-in shape ({@link Polygon}, {@link Rect}, {@link RoundRect},
 * {@link Ellipse}) is planar and is resolved by the 2D SAT narrowphase, which
 * can only ever produce a 2D pushback — see {@link ResponseObject#overlapV}.
 * A `Box3d` pair is instead resolved by an AABB-vs-AABB narrowphase that also
 * fills {@link ResponseObject#overlapZ}.
 *
 * Coordinate convention matches the rest of melonJS 3D code (see
 * {@link Camera3d}): **Y-down, +Z forward / away from the camera.**
 *
 * ## Position is the CENTER
 *
 * Unlike {@link Rect} (top-left) and like {@link Ellipse} (center), `pos` is
 * the box **center**. That matches how 3D objects are placed everywhere else
 * in the engine — {@link Mesh}, {@link Sprite3d} and the ground-shadow
 * footprint all work from a center plus half-extents — and it keeps the
 * narrowphase free of corner/center conversions on the hot path.
 *
 * ## Mixing with 2D shapes
 *
 * A `Box3d` can collide with a planar shape. The planar shape is treated as
 * **unbounded along Z** (an infinitely extruded prism of its own outline), so
 * the pair degrades to the ordinary 2D test on the XY footprint and the box's
 * z never causes it to miss. This keeps an existing 2D game working unchanged
 * when a single `Box3d` body is introduced: its world shapes go on colliding
 * exactly as before. Use `collisionType` / `collisionMask` to opt specific
 * shapes out of a 3D body.
 * @category Geometry
 * @example
 * // a 64x16x64 floor slab centered on the origin
 * const floor = new Box3d(0, 0, 0, 64, 16, 64);
 * myFloor.body.addShape(floor);
 */
export class Box3d {
	/**
	 * the center of the box, as an offset from the owning body's position
	 */
	pos: Vector3d;

	/**
	 * half the box size on each axis. Always non-negative; a negative
	 * extent passed to {@link Box3d#setShape} is stored as its magnitude,
	 * since a box with a mirrored axis has no meaning to the narrowphase.
	 */
	halfExtents: Vector3d;

	/**
	 * the shape type (used internally)
	 * @default "Box3d"
	 */
	type = "Box3d";

	/**
	 * 2D XY footprint, kept in sync by {@link Box3d#setShape}. This is what
	 * {@link Box3d#getBounds} hands back, so every legacy 2D consumer
	 * ({@link Body#bounds}, the broadphase pre-gate, debug draw) sees a
	 * plain rectangle and needs no 3D awareness.
	 * @ignore
	 * @internal
	 */
	_bounds: Bounds;

	/**
	 * XY footprint as a {@link Polygon}, kept in sync by
	 * {@link Box3d#setShape}. The degraded `Box3d` × planar-shape tests
	 * hand this to the existing polygon SAT, so no polygon is allocated
	 * per collision test.
	 * @ignore
	 * @internal
	 */
	_footprint: Polygon;

	/**
	 * @param x - center of the box on the horizontal axis
	 * @param y - center of the box on the vertical axis
	 * @param z - center of the box on the depth axis
	 * @param width - width of the box
	 * @param height - height of the box
	 * @param depth - depth of the box
	 */
	constructor(x = 0, y = 0, z = 0, width = 0, height = 0, depth = 0) {
		this.pos = new Vector3d();
		this.halfExtents = new Vector3d();
		this._bounds = new Bounds();
		// seeded with a unit quad; setShape rewrites the points immediately
		this._footprint = new Polygon(0, 0, [
			new Vector2d(0, 0),
			new Vector2d(1, 0),
			new Vector2d(1, 1),
			new Vector2d(0, 1),
		]);
		this.setShape(x, y, z, width, height, depth);
	}

	/**
	 * set new position and size for this box
	 * @param x - center of the box on the horizontal axis
	 * @param y - center of the box on the vertical axis
	 * @param z - center of the box on the depth axis
	 * @param width - width of the box
	 * @param height - height of the box
	 * @param depth - depth of the box
	 * @returns this box, for chaining
	 */
	setShape(
		x: number,
		y: number,
		z: number,
		width: number,
		height: number,
		depth: number,
	) {
		this.pos.set(x, y, z);
		this.halfExtents.set(
			Math.abs(width) * 0.5,
			Math.abs(height) * 0.5,
			Math.abs(depth) * 0.5,
		);
		this._syncFootprint();
		return this;
	}

	/**
	 * Rebuild the cached XY footprint (both the {@link Bounds} and the
	 * {@link Polygon}) from the current center and half-extents.
	 *
	 * The footprint polygon's `pos` is the **min corner**, not the center,
	 * because the SAT narrowphase resolves a shape's absolute position as
	 * `renderable.pos + ancestor.getAbsolutePosition() + shape.pos` and
	 * then treats `points` as offsets from it.
	 * @ignore
	 * @internal
	 */
	_syncFootprint() {
		const hx = this.halfExtents.x;
		const hy = this.halfExtents.y;
		// Footprint edges are floored at MIN_FOOTPRINT. `Polygon.recalc`
		// normalizes each edge by its own length with no zero guard, so two
		// coincident points yield `0 / 0 = NaN` normals and poison every
		// later SAT axis test. A zero-width or zero-height box (including a
		// default-constructed one) would do exactly that. Z is unaffected:
		// a zero-DEPTH box is perfectly well-defined and stays exact.
		const w = Math.max(hx * 2, MIN_FOOTPRINT);
		const h = Math.max(hy * 2, MIN_FOOTPRINT);
		const minX = this.pos.x - hx;
		const minY = this.pos.y - hy;

		const points = this._footprint.points;
		points[0].set(0, 0);
		points[1].set(w, 0);
		points[2].set(w, h);
		points[3].set(0, h);
		this._footprint.pos.set(minX, minY);
		// rebuild edges / normals for the SAT axes
		this._footprint.recalc();

		this._bounds.setMinMax(minX, minY, minX + w, minY + h);
	}

	/**
	 * width of the box
	 */
	get width(): number {
		return this.halfExtents.x * 2;
	}
	set width(value: number) {
		this.halfExtents.x = Math.abs(value) * 0.5;
		this._syncFootprint();
	}

	/**
	 * height of the box
	 */
	get height(): number {
		return this.halfExtents.y * 2;
	}
	set height(value: number) {
		this.halfExtents.y = Math.abs(value) * 0.5;
		this._syncFootprint();
	}

	/**
	 * depth of the box
	 */
	get depth(): number {
		return this.halfExtents.z * 2;
	}
	set depth(value: number) {
		this.halfExtents.z = Math.abs(value) * 0.5;
		this._syncFootprint();
	}

	/**
	 * translate this box by the given offset
	 * @param x - x offset, or a vector carrying the whole offset
	 * @param [y] - y offset
	 * @param [z] - z offset
	 * @returns this box, for chaining
	 */
	shift(x: number | Vector3d, y = 0, z = 0) {
		if (typeof x === "object") {
			this.pos.add(x);
		} else {
			this.pos.set(this.pos.x + x, this.pos.y + y, this.pos.z + z);
		}
		this._syncFootprint();
		return this;
	}

	/**
	 * the 2D XY footprint of this box.
	 *
	 * Deliberately 2D: this is the {@link Renderable#getBounds} contract that
	 * {@link Body} and the broadphase pre-gate already speak. For the depth
	 * extent use {@link Box3d#getBounds3d}.
	 * @returns the XY footprint
	 */
	getBounds(): Bounds {
		return this._bounds;
	}

	/**
	 * the 3D bounds of this box, in the body's local space.
	 * @param [out] - an existing AABB3d to write into, to avoid allocating
	 * @returns the 3D bounds
	 */
	getBounds3d(out?: AABB3d): AABB3d {
		const target = out ?? new AABB3d();
		const hx = this.halfExtents.x;
		const hy = this.halfExtents.y;
		const hz = this.halfExtents.z;
		target.setMinMax(
			this.pos.x - hx,
			this.pos.y - hy,
			this.pos.z - hz,
			this.pos.x + hx,
			this.pos.y + hy,
			this.pos.z + hz,
		);
		return target;
	}

	/**
	 * true if this box contains the given point
	 * @param x - point x, or a vector carrying the whole point
	 * @param [y] - point y
	 * @param [z] - point z
	 */
	contains(x: number | Vector3d, y = 0, z = 0): boolean {
		const isVector = typeof x === "object";
		const px = isVector ? x.x : x;
		const py = isVector ? x.y : y;
		const pz = isVector ? x.z : z;
		return (
			Math.abs(px - this.pos.x) <= this.halfExtents.x &&
			Math.abs(py - this.pos.y) <= this.halfExtents.y &&
			Math.abs(pz - this.pos.z) <= this.halfExtents.z
		);
	}

	/**
	 * clone this box
	 * @returns a new Box3d
	 */
	clone(): Box3d {
		return new Box3d(
			this.pos.x,
			this.pos.y,
			this.pos.z,
			this.width,
			this.height,
			this.depth,
		);
	}
}

export const box3dPool = createPool<
	Box3d,
	[
		x?: number,
		y?: number,
		z?: number,
		width?: number,
		height?: number,
		depth?: number,
	]
>((x, y, z, width, height, depth) => {
	const instance = new Box3d(x, y, z, width, height, depth);

	return {
		instance,
		reset(x = 0, y = 0, z = 0, width = 0, height = 0, depth = 0) {
			instance.setShape(x, y, z, width, height, depth);
		},
	};
});
