import { Vector3d } from "../../math/vector3d.ts";
import { transformedBounds } from "../../math/vertex.ts";
import type { XYZPoint } from "../../utils/types.ts";

// column-major 4×4 identity, used when `fromVertices` is called without a matrix
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Module scratch for `fromVertices`. `transformedBounds` (the shared vertex.ts
// helper) writes into `[x, y, z]` number arrays, but AABB3d stores `{x, y, z}`
// objects — these bridge the two without per-call allocation. Reused across
// calls; never escapes the method.
const _fvMin = [Infinity, Infinity, Infinity];
const _fvMax = [-Infinity, -Infinity, -Infinity];

/**
 * A 3D axis-aligned bounding box — the 3D sibling of {@link Bounds}.
 *
 * Used by {@link Octree} as the bounding primitive of every node
 * (root, subnodes, queries). Intentionally minimal: only the
 * operations the {@link Octree} hot path needs are implemented, with
 * a small handful of helpers ({@link AABB3d#contains},
 * {@link AABB3d#overlaps}, {@link AABB3d#overlapsSphere}) for
 * test-driven `querySphere` / `queryAABB` callers.
 *
 * Coordinate convention matches the rest of melonJS 3D code (see
 * {@link Camera3d}): **Y-down, +Z forward / away from the camera.**
 *
 * Lives next to {@link Octree} under `physics/broadphase/` rather
 * than `math/` to mirror {@link Bounds} (which lives in `physics/`,
 * not `math/`). It originated as a broadphase-internal primitive; it is
 * now also the public 3D-bounds type returned by {@link Mesh#getBounds3d}
 * (the 3D analog of {@link Renderable#getBounds} → {@link Bounds}), built
 * from mesh geometry via {@link AABB3d#fromVertices}.
 * @category Geometry
 */
export class AABB3d {
	min: XYZPoint;
	max: XYZPoint;

	/**
	 * Construct an empty AABB (min = +∞, max = −∞). The empty AABB
	 * satisfies `addPoint(p)` => `min = max = p` for the first point
	 * added, and `overlaps(b)` => `false` against any other AABB —
	 * same convention as {@link Bounds}.
	 * @param [min] - optional initial minimum corner
	 * @param [max] - optional initial maximum corner
	 */
	constructor(min?: XYZPoint, max?: XYZPoint) {
		this.min = { x: Infinity, y: Infinity, z: Infinity };
		this.max = { x: -Infinity, y: -Infinity, z: -Infinity };
		if (min && max) {
			this.setMinMax(min.x, min.y, min.z, max.x, max.y, max.z);
		}
	}

	/**
	 * Reset the AABB to its empty state.
	 */
	clear() {
		this.min.x = Infinity;
		this.min.y = Infinity;
		this.min.z = Infinity;
		this.max.x = -Infinity;
		this.max.y = -Infinity;
		this.max.z = -Infinity;
	}

	/**
	 * Set min and max corners directly. Mirror of `Bounds.setMinMax`.
	 * @param minX - minimum corner x
	 * @param minY - minimum corner y
	 * @param minZ - minimum corner z
	 * @param maxX - maximum corner x
	 * @param maxY - maximum corner y
	 * @param maxZ - maximum corner z
	 */
	setMinMax(
		minX: number,
		minY: number,
		minZ: number,
		maxX: number,
		maxY: number,
		maxZ: number,
	) {
		this.min.x = minX;
		this.min.y = minY;
		this.min.z = minZ;
		this.max.x = maxX;
		this.max.y = maxY;
		this.max.z = maxZ;
	}

	get x(): number {
		return this.min.x;
	}
	get y(): number {
		return this.min.y;
	}
	get z(): number {
		return this.min.z;
	}

	get width(): number {
		return this.max.x - this.min.x;
	}
	get height(): number {
		return this.max.y - this.min.y;
	}
	get depth(): number {
		return this.max.z - this.min.z;
	}

	get left(): number {
		return this.min.x;
	}
	get right(): number {
		return this.max.x;
	}
	get top(): number {
		return this.min.y;
	}
	get bottom(): number {
		return this.max.y;
	}
	get front(): number {
		return this.min.z;
	}
	get back(): number {
		return this.max.z;
	}

	get centerX(): number {
		return (this.min.x + this.max.x) * 0.5;
	}
	get centerY(): number {
		return (this.min.y + this.max.y) * 0.5;
	}
	get centerZ(): number {
		return (this.min.z + this.max.z) * 0.5;
	}

	/**
	 * True if every coordinate is a finite number. Used by the
	 * {@link Octree} to reject inserts whose bounding box is the
	 * empty AABB (a sprite with no shape and never updated) — without
	 * this guard a `±Infinity` corner would silently classify into
	 * an arbitrary octant and never come back out via `remove`.
	 */
	isFinite() {
		return (
			isFinite(this.min.x) &&
			isFinite(this.min.y) &&
			isFinite(this.min.z) &&
			isFinite(this.max.x) &&
			isFinite(this.max.y) &&
			isFinite(this.max.z)
		);
	}

	/**
	 * True if this AABB fully encloses the given point.
	 * @param x - point x
	 * @param y - point y
	 * @param z - point z
	 */
	contains(x: number, y: number, z: number) {
		return (
			x >= this.min.x &&
			x <= this.max.x &&
			y >= this.min.y &&
			y <= this.max.y &&
			z >= this.min.z &&
			z <= this.max.z
		);
	}

	/**
	 * True if this AABB overlaps the given AABB on every axis. The
	 * intersection includes the boundary (shared face/edge/corner
	 * counts as overlap), same convention as {@link Bounds.overlaps}
	 * so {@link Octree} candidate sets don't drop items that sit
	 * exactly on an octant boundary.
	 * @param aabb - the other AABB to test against
	 */
	overlaps(aabb: AABB3d) {
		return !(
			this.right < aabb.left ||
			this.left > aabb.right ||
			this.bottom < aabb.top ||
			this.top > aabb.bottom ||
			this.back < aabb.front ||
			this.front > aabb.back
		);
	}

	/**
	 * True if this AABB overlaps a sphere. Computes the squared
	 * distance from the sphere center to the nearest point on the
	 * AABB and compares against `r²` — avoids the `sqrt` on the hot
	 * path. Used by `Octree.querySphere`.
	 * @param cx - sphere center x
	 * @param cy - sphere center y
	 * @param cz - sphere center z
	 * @param r - sphere radius (must be ≥ 0; `r=0` becomes a point-in-AABB test)
	 */
	overlapsSphere(cx: number, cy: number, cz: number, r: number) {
		// per-axis closest-point: clamp center into the AABB extents
		const dx =
			cx < this.min.x ? this.min.x - cx : cx > this.max.x ? cx - this.max.x : 0;
		const dy =
			cy < this.min.y ? this.min.y - cy : cy > this.max.y ? cy - this.max.y : 0;
		const dz =
			cz < this.min.z ? this.min.z - cz : cz > this.max.z ? cz - this.max.z : 0;
		return dx * dx + dy * dy + dz * dz <= r * r;
	}

	/**
	 * Expand this AABB to include the given point.
	 * @param p - the point to fold in
	 */
	addPoint(p: XYZPoint | Vector3d) {
		if (p.x < this.min.x) this.min.x = p.x;
		if (p.y < this.min.y) this.min.y = p.y;
		if (p.z < this.min.z) this.min.z = p.z;
		if (p.x > this.max.x) this.max.x = p.x;
		if (p.y > this.max.y) this.max.y = p.y;
		if (p.z > this.max.z) this.max.z = p.z;
	}

	/**
	 * Expand this AABB to include the given AABB. With `clear=true`,
	 * copies the input AABB directly — same shape as {@link Bounds.addBounds}.
	 * @param aabb - the AABB to fold in
	 * @param [clear] - reset this AABB before folding
	 */
	addAABB(aabb: AABB3d, clear = false) {
		if (clear) {
			this.min.x = aabb.min.x;
			this.min.y = aabb.min.y;
			this.min.z = aabb.min.z;
			this.max.x = aabb.max.x;
			this.max.y = aabb.max.y;
			this.max.z = aabb.max.z;
			return;
		}
		if (aabb.min.x < this.min.x) this.min.x = aabb.min.x;
		if (aabb.min.y < this.min.y) this.min.y = aabb.min.y;
		if (aabb.min.z < this.min.z) this.min.z = aabb.min.z;
		if (aabb.max.x > this.max.x) this.max.x = aabb.max.x;
		if (aabb.max.y > this.max.y) this.max.y = aabb.max.y;
		if (aabb.max.z > this.max.z) this.max.z = aabb.max.z;
	}

	/**
	 * Build this AABB from a flat vertex buffer (`x,y,z` triplets), optionally
	 * transformed by a column-major 4×4 matrix — the bridge from raw mesh /
	 * glTF geometry (e.g. a {@link Mesh}'s vertices or a parsed glTF node) to an
	 * `AABB3d`. **Replaces** the current bounds (seeds empty, then folds in the
	 * `count` vertices); for the point-array form use {@link AABB3d#addPoint}.
	 *
	 * The per-vertex math is **delegated to {@link transformedBounds}** (the
	 * shared `math/vertex.ts` helper) rather than duplicated here, so the
	 * flat-buffer ↔ AABB conversion stays in one place. Allocation-free.
	 * @param src - source vertex positions (`x,y,z` triplets)
	 * @param count - number of vertices to read from `src`
	 * @param [matrix] - optional column-major 4×4 (16 elements); identity if omitted
	 * @returns this AABB, for chaining
	 * @example
	 * // bounds of a glTF node's geometry under its world transform
	 * const box = new AABB3d().fromVertices(node.vertices, node.vertexCount, node.world);
	 */
	fromVertices(src: Float32Array, count: number, matrix?: ArrayLike<number>) {
		// seed empty so the result is built purely from these vertices
		_fvMin[0] = _fvMin[1] = _fvMin[2] = Infinity;
		_fvMax[0] = _fvMax[1] = _fvMax[2] = -Infinity;
		transformedBounds(src, count, matrix ?? IDENTITY, _fvMin, _fvMax);
		this.setMinMax(
			_fvMin[0],
			_fvMin[1],
			_fvMin[2],
			_fvMax[0],
			_fvMax[1],
			_fvMax[2],
		);
		return this;
	}

	/**
	 * Returns a deep copy of this AABB.
	 */
	clone() {
		return new AABB3d(this.min, this.max);
	}
}
