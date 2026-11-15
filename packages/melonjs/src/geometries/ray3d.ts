import { Vector3d } from "../math/vector3d.ts";
import type { AABB3d } from "../physics/broadphase/aabb3d.ts";
import type Renderable from "../renderable/renderable.js";
import type { Sphere } from "./sphere.ts";

/**
 * Where a {@link Ray3d} hit a mesh: what {@link Mesh#intersectRay} and
 * {@link Camera3d#pick} return, and what a pointer event on a mesh under a
 * {@link Camera3d} carries as `pointer.hit3d`.
 * @category Geometry
 */
export interface MeshHit {
	/** the mesh that was hit (for a {@link GLTFModel}, the part) */
	renderable: Renderable;
	/** the world-space point where the ray met its surface */
	point: Vector3d;
	/** the surface's world-space normal there, of unit length, facing the ray */
	normal: Vector3d;
	/** how far along the ray, i.e. from the camera for a camera ray */
	distance: number;
	/** which triangle was hit: its first index is `indices[triangle * 3]` */
	triangle: number;
	/** which instance of an {@link InstancedMesh} was hit, `-1` for any other mesh */
	instance: number;
}

/**
 * A blank {@link MeshHit} to write into.
 * @returns the new record
 * @ignore
 * @internal
 */
export function createMeshHit(): MeshHit {
	return {
		renderable: undefined as unknown as Renderable,
		point: new Vector3d(),
		normal: new Vector3d(),
		distance: Number.POSITIVE_INFINITY,
		triangle: -1,
		instance: -1,
	};
}

// the per-candidate scratch `pickInContainer` tests into
const _candidateHit = createMeshHit();

/**
 * Copy one hit record into another.
 * @ignore
 * @internal
 */
export function copyMeshHit(out: MeshHit, from: MeshHit): MeshHit {
	out.renderable = from.renderable;
	out.point.copy(from.point);
	out.normal.copy(from.normal);
	out.distance = from.distance;
	out.triangle = from.triangle;
	out.instance = from.instance;
	return out;
}

/**
 * Anything with children to walk: a {@link Container}, duck-typed.
 * @ignore
 * @internal
 */
interface Walkable {
	getChildren(): Renderable[];
}

/**
 * Anything that can be hit by a ray: a {@link Mesh} and its subclasses, or a
 * {@link GLTFModel}. Duck-typed so the walk below needs no class imports.
 * @ignore
 * @internal
 */
interface RayTarget {
	intersectRay(ray: Ray3d, out?: MeshHit): MeshHit | null;
}

/**
 * The nearest {@link MeshHit} of `ray` among everything under `container`.
 *
 * A renderable that answers rays (`intersectRay`) is asked, and not walked
 * into: a {@link GLTFModel} answers for its own parts. Any other container is
 * walked. Screen-space (`floating`) and invisible renderables are skipped.
 * @param ray - the world-space ray
 * @param container - where to look
 * @param [out] - hit record to write into
 * @returns the nearest hit, or `null`
 * @ignore
 * @internal
 */
export function pickInContainer(
	ray: Ray3d,
	container: Walkable,
	out?: MeshHit,
): MeshHit | null {
	let best: MeshHit | null = null;
	const visit = (node: Walkable) => {
		for (const child of node.getChildren()) {
			if (
				child.isFloating ||
				!child.isRenderable ||
				child.alpha <= 0 ||
				// opted out (`Mesh#pickable`, `GLTFModel#pickable`)
				(child as { pickable?: boolean }).pickable === false
			) {
				continue;
			}
			const target = child as unknown as Partial<RayTarget>;
			if (typeof target.intersectRay === "function") {
				const hit = target.intersectRay(ray, _candidateHit);
				if (hit !== null && (best === null || hit.distance < best.distance)) {
					best = copyMeshHit(best ?? out ?? createMeshHit(), hit);
				}
				continue;
			}
			const group = child as unknown as {
				getChildren?: () => Renderable[];
			};
			if (typeof group.getChildren === "function") {
				visit(group as Walkable);
			}
		}
	};
	visit(container);
	return best;
}

/**
 * A 3D ray — an `origin` and a unit `direction` — in the engine's 3D space
 * (Y-down, +Z forward, the {@link Camera3d} convention).
 *
 * What a pointer is under a perspective camera: one screen pixel covers a
 * whole line of world points, from the camera out through that pixel.
 * {@link Camera3d#screenToRay} builds one, and {@link Mesh#intersectRay},
 * {@link Camera3d#pick} and the pointer events of a mesh under a `Camera3d`
 * all test against one.
 *
 * Every `intersect*` method returns the **distance** along the ray to the
 * first point where it enters the shape, or `null` when it misses; the shape
 * behind the ray's origin does not count. {@link Ray3d#at} turns a distance
 * into the point.
 * @category Geometry
 * @example
 * import { Ray3d, Vector3d } from "melonjs";
 *
 * // where a click meets the floor at y = 0 (Y-down: up is (0, -1, 0))
 * const ray = camera.screenToRay(pointer.gameScreenX, pointer.gameScreenY);
 * const t = ray.intersectPlane(new Vector3d(0, 0, 0), new Vector3d(0, -1, 0));
 * if (t !== null) {
 *     const onFloor = ray.at(t);
 * }
 */
export class Ray3d {
	/** where the ray starts */
	origin: Vector3d;

	/** which way it points, always of unit length */
	direction: Vector3d;

	/**
	 * @param [ox=0] - x of the origin
	 * @param [oy=0] - y of the origin
	 * @param [oz=0] - z of the origin
	 * @param [dx=0] - x of the direction
	 * @param [dy=0] - y of the direction
	 * @param [dz=1] - z of the direction (the default points down +Z, into the screen)
	 */
	constructor(ox = 0, oy = 0, oz = 0, dx = 0, dy = 0, dz = 1) {
		this.origin = new Vector3d(ox, oy, oz);
		this.direction = new Vector3d();
		this.set(ox, oy, oz, dx, dy, dz);
	}

	/**
	 * Set the origin and direction. The direction is normalized; a zero
	 * direction leaves the ray pointing down +Z.
	 * @param ox - x of the origin
	 * @param oy - y of the origin
	 * @param oz - z of the origin
	 * @param dx - x of the direction
	 * @param dy - y of the direction
	 * @param dz - z of the direction
	 * @returns this ray, for chaining
	 */
	set(
		ox: number,
		oy: number,
		oz: number,
		dx: number,
		dy: number,
		dz: number,
	): this {
		this.origin.set(ox, oy, oz);
		const len = Math.hypot(dx, dy, dz);
		if (len > 0 && Number.isFinite(len)) {
			this.direction.set(dx / len, dy / len, dz / len);
		} else {
			this.direction.set(0, 0, 1);
		}
		return this;
	}

	/**
	 * The point at a distance along the ray.
	 * @param distance - how far along the ray
	 * @param [out] - vector to write into; a new one is allocated when omitted
	 * @returns `origin + direction × distance`
	 */
	at(distance: number, out: Vector3d = new Vector3d()): Vector3d {
		return out.set(
			this.origin.x + this.direction.x * distance,
			this.origin.y + this.direction.y * distance,
			this.origin.z + this.direction.z * distance,
		);
	}

	/**
	 * Distance along the ray to a plane, given a point on it and its normal
	 * (either side: the normal need not face the ray).
	 * @param point - any point on the plane
	 * @param normal - the plane's normal (need not be unit length)
	 * @returns the distance, or `null` when the ray runs parallel to the plane or points away from it
	 */
	intersectPlane(point: Vector3d, normal: Vector3d): number | null {
		const denom =
			normal.x * this.direction.x +
			normal.y * this.direction.y +
			normal.z * this.direction.z;
		if (Math.abs(denom) < 1e-12) {
			return null;
		}
		const t =
			(normal.x * (point.x - this.origin.x) +
				normal.y * (point.y - this.origin.y) +
				normal.z * (point.z - this.origin.z)) /
			denom;
		return t >= 0 ? t : null;
	}

	/**
	 * Distance along the ray to where it enters a sphere; 0 when the origin
	 * is already inside it.
	 * @param sphere - the sphere
	 * @returns the distance, or `null` on a miss
	 */
	intersectSphere(sphere: Sphere): number | null {
		const r = Math.abs(sphere.radius);
		const ox = this.origin.x - sphere.pos.x;
		const oy = this.origin.y - sphere.pos.y;
		const oz = this.origin.z - sphere.pos.z;
		const b =
			ox * this.direction.x + oy * this.direction.y + oz * this.direction.z;
		const c = ox * ox + oy * oy + oz * oz - r * r;
		if (c <= 0) {
			return 0;
		}
		if (b > 0) {
			return null;
		}
		const disc = b * b - c;
		if (disc < 0) {
			return null;
		}
		return -b - Math.sqrt(disc);
	}

	/**
	 * Distance along the ray to where it enters an axis-aligned box; 0 when
	 * the origin is already inside it.
	 * @param box - the box
	 * @returns the distance, or `null` on a miss
	 */
	intersectAABB(box: AABB3d): number | null {
		return rayBox(
			this.origin.x,
			this.origin.y,
			this.origin.z,
			this.direction.x,
			this.direction.y,
			this.direction.z,
			box.min.x,
			box.min.y,
			box.min.z,
			box.max.x,
			box.max.y,
			box.max.z,
		);
	}

	/**
	 * Distance along the ray to a triangle (Möller–Trumbore), from either side.
	 * @param a - first corner
	 * @param b - second corner
	 * @param c - third corner
	 * @returns the distance, or `null` on a miss
	 */
	intersectTriangle(a: Vector3d, b: Vector3d, c: Vector3d): number | null {
		return rayTriangle(
			this.origin.x,
			this.origin.y,
			this.origin.z,
			this.direction.x,
			this.direction.y,
			this.direction.z,
			a.x,
			a.y,
			a.z,
			b.x,
			b.y,
			b.z,
			c.x,
			c.y,
			c.z,
		);
	}

	/**
	 * Copy another ray into this one.
	 * @param ray - the ray to copy
	 * @returns this ray, for chaining
	 */
	copy(ray: Ray3d): this {
		this.origin.copy(ray.origin);
		this.direction.copy(ray.direction);
		return this;
	}

	/**
	 * A new ray equal to this one.
	 * @returns the copy
	 */
	clone(): Ray3d {
		return new Ray3d().copy(this);
	}
}

// the [tmin, tmax] interval `rayBox` narrows, one axis at a time
const _slab = new Float64Array(2);

/**
 * Narrow `_slab` by one axis of a box; false once the interval is empty.
 * @ignore
 * @internal
 */
function slab(o: number, d: number, lo: number, hi: number): boolean {
	if (Math.abs(d) < 1e-15) {
		return o >= lo && o <= hi;
	}
	const inv = 1 / d;
	let t1 = (lo - o) * inv;
	let t2 = (hi - o) * inv;
	if (t1 > t2) {
		const t = t1;
		t1 = t2;
		t2 = t;
	}
	if (t1 > _slab[0]) {
		_slab[0] = t1;
	}
	if (t2 < _slab[1]) {
		_slab[1] = t2;
	}
	return _slab[0] <= _slab[1];
}

/**
 * Slab test of a ray against an axis-aligned box, in any units: the
 * direction need not be normalized, and the result is the ray PARAMETER,
 * which an affine change of space preserves. 0 when the origin is inside.
 * @returns the entry parameter, or `null` on a miss
 * @ignore
 * @internal
 */
export function rayBox(
	ox: number,
	oy: number,
	oz: number,
	dx: number,
	dy: number,
	dz: number,
	minX: number,
	minY: number,
	minZ: number,
	maxX: number,
	maxY: number,
	maxZ: number,
): number | null {
	// one slab per axis, narrowing [tmin, tmax]; NaN propagates as a miss
	_slab[0] = 0;
	_slab[1] = Number.POSITIVE_INFINITY;
	if (
		!slab(ox, dx, minX, maxX) ||
		!slab(oy, dy, minY, maxY) ||
		!slab(oz, dz, minZ, maxZ)
	) {
		return null;
	}
	const tmin = _slab[0];
	return tmin;
}

/**
 * Möller–Trumbore ray / triangle test, from either side. Like
 * {@link rayBox}, the result is the ray parameter, so the direction need not
 * be normalized.
 * @returns the hit parameter, or `null` on a miss (or a hit behind the origin)
 * @ignore
 * @internal
 */
export function rayTriangle(
	ox: number,
	oy: number,
	oz: number,
	dx: number,
	dy: number,
	dz: number,
	ax: number,
	ay: number,
	az: number,
	bx: number,
	by: number,
	bz: number,
	cx: number,
	cy: number,
	cz: number,
): number | null {
	const e1x = bx - ax;
	const e1y = by - ay;
	const e1z = bz - az;
	const e2x = cx - ax;
	const e2y = cy - ay;
	const e2z = cz - az;
	// p = d × e2
	const px = dy * e2z - dz * e2y;
	const py = dz * e2x - dx * e2z;
	const pz = dx * e2y - dy * e2x;
	const det = e1x * px + e1y * py + e1z * pz;
	// relative to the triangle's own size, so a tiny model is not rejected
	const scale =
		Math.hypot(e1x, e1y, e1z) *
		Math.hypot(e2x, e2y, e2z) *
		Math.hypot(dx, dy, dz);
	if (Math.abs(det) <= scale * 1e-12) {
		return null;
	}
	const inv = 1 / det;
	const sx = ox - ax;
	const sy = oy - ay;
	const sz = oz - az;
	const u = (sx * px + sy * py + sz * pz) * inv;
	if (u < 0 || u > 1) {
		return null;
	}
	// q = s × e1
	const qx = sy * e1z - sz * e1y;
	const qy = sz * e1x - sx * e1z;
	const qz = sx * e1y - sy * e1x;
	const v = (dx * qx + dy * qy + dz * qz) * inv;
	if (v < 0 || u + v > 1) {
		return null;
	}
	const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
	return t >= 0 ? t : null;
}
