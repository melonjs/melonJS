import { Vector3d } from "../math/vector3d.ts";
import { Bounds } from "../physics/bounds.ts";
import { AABB3d } from "../physics/broadphase/aabb3d.ts";
import type { Box3d } from "./box3d.ts";
import {
	bakeMeshVertices,
	boundsOfVertices,
	boxOf,
	type MeshGeometrySource,
} from "./trianglemesh3d.ts";

/**
 * A collision shape that wraps a set of points in the tightest convex solid
 * around them: the shape for a **moving** object with an irregular outline, a
 * rock, a barrel or a glTF prop, that should tumble and stack as it looks.
 * Concave parts are filled in; build a concave object from several shapes,
 * or, if it never moves, give it a {@link TriangleMesh3d}.
 *
 * The points are in the body's space, relative to the renderable's `pos`, in
 * the engine's 3D convention (Y-down, +Z forward); the physics engine works
 * out the hull. {@link ConvexHull3d.fromMesh} takes them from a {@link Mesh}
 * as it is drawn, a glTF part included.
 *
 * A 3D physics adapter (`@melonjs/rapier3d-adapter`) builds it exactly. The
 * built-in physics approximates it by its bounding {@link Box3d}, and the 2D
 * adapters refuse it.
 * @category Geometry
 * @example
 * // a loaded rock that falls and rolls as the shape it is drawn
 * rock.bodyDef = { type: "dynamic", shapes: [ConvexHull3d.fromMesh(rock)] };
 */
export class ConvexHull3d {
	/** an offset from the owning body's position, added to every point */
	pos: Vector3d;

	/** the points, `[x, y, z, ...]`, relative to `pos` */
	points: Float32Array;

	/**
	 * the shape type (used internally)
	 * @default "ConvexHull3d"
	 */
	type = "ConvexHull3d";

	/** Optional per-shape collision settings (see {@link Body#addShape}). */
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
	 * @ignore
	 * @internal
	 */
	_bounds3d: AABB3d;

	/**
	 * @param points - the points, `[x, y, z, ...]`; at least four, not all in
	 * one plane, for a solid
	 * @throws {Error} when there is not a whole number of points, or fewer
	 * than four
	 */
	constructor(points: ArrayLike<number>) {
		if (points.length % 3 !== 0) {
			throw new Error(
				`ConvexHull3d: points must be x, y, z triples (got ${points.length} numbers)`,
			);
		}
		if (points.length < 12) {
			throw new Error(
				`ConvexHull3d: a solid needs at least four points (got ${points.length / 3})`,
			);
		}
		this.pos = new Vector3d();
		this.points = Float32Array.from(points);
		this._bounds = new Bounds();
		this._bounds3d = new AABB3d();
	}

	/**
	 * The hull of a {@link Mesh} as it is drawn, relative to its `pos`:
	 * through its transform, scale and handedness. A physics engine that
	 * turns the body turns it from there.
	 * @param mesh - the mesh, a glTF part included
	 * @returns a new ConvexHull3d
	 */
	static fromMesh(mesh: MeshGeometrySource): ConvexHull3d {
		return new ConvexHull3d(bakeMeshVertices(mesh));
	}

	/**
	 * translate this shape by the given offset
	 * @param x - x offset, or a vector carrying the whole offset
	 * @param [y] - y offset
	 * @param [z] - z offset
	 * @returns this shape, for chaining
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
	 * the 3D bounds of this shape, in the body's local space
	 * @param [out] - an existing AABB3d to write into, to avoid allocating
	 * @returns the 3D bounds
	 */
	getBounds3d(out?: AABB3d): AABB3d {
		return boundsOfVertices(this.points, this.pos, out ?? new AABB3d());
	}

	/**
	 * the 2D XY footprint of this shape (see {@link Box3d#getBounds})
	 * @returns the XY footprint
	 */
	getBounds(): Bounds {
		const b = this.getBounds3d(this._bounds3d);
		this._bounds.setMinMax(b.min.x, b.min.y, b.max.x, b.max.y);
		return this._bounds;
	}

	/**
	 * The axis-aligned box around this shape: what the built-in physics
	 * resolves it as.
	 * @returns a new Box3d
	 */
	toBox3d(): Box3d {
		return boxOf(this.getBounds3d(this._bounds3d));
	}

	/**
	 * clone this shape
	 * @returns a new ConvexHull3d
	 */
	clone(): ConvexHull3d {
		const copy = new ConvexHull3d(this.points);
		copy.pos.set(this.pos.x, this.pos.y, this.pos.z);
		return copy;
	}
}
