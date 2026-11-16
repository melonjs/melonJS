import type { Matrix3d } from "../math/matrix3d.ts";
import { Vector3d } from "../math/vector3d.ts";
import { Bounds } from "../physics/bounds.ts";
import { AABB3d } from "../physics/broadphase/aabb3d.ts";
import { Box3d } from "./box3d.ts";

/**
 * What {@link TriangleMesh3d.fromMesh} and {@link ConvexHull3d.fromMesh} read
 * from a {@link Mesh}: its geometry as loaded, and how it is placed. Pass the
 * mesh itself, a glTF part or a `Sprite3d` included.
 * @category Geometry
 */
export interface MeshGeometrySource {
	/** the vertices as loaded, `[x, y, z, ...]` */
	originalVertices: ArrayLike<number>;
	/** how many vertices there are */
	vertexCount: number;
	/** the triangles, three vertex indices each */
	indices?: ArrayLike<number>;
	/**
	 * the triangles as loaded, before any reordering for drawing
	 * @ignore
	 */
	_indicesOriginal?: ArrayLike<number>;
	/** the mesh's turn and stretch */
	currentTransform: Matrix3d;
	/** the uniform scale the mesh is drawn at */
	meshScale: number;
	/** whether the source is right-handed (glTF) */
	rightHanded?: boolean;
}

/**
 * A mesh's vertices in its own body's space: through its `currentTransform`,
 * its scale and the Y-up → Y-down bridge, exactly as the mesh draws them
 * relative to its `pos` (see `Mesh#_projectVerticesWorld`).
 * @param mesh - the mesh to read
 * @returns the vertices, `[x, y, z, ...]`
 * @ignore
 */
export function bakeMeshVertices(mesh: MeshGeometrySource): Float32Array {
	const src = mesh.originalVertices;
	const n = mesh.vertexCount;
	const m = mesh.currentTransform.val;
	const s = mesh.meshScale;
	const zSign = mesh.rightHanded === true ? -1 : 1;
	const out = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const vx = src[i * 3];
		const vy = src[i * 3 + 1];
		const vz = src[i * 3 + 2];
		const rx = m[0] * vx + m[4] * vy + m[8] * vz + m[12];
		const ry = m[1] * vx + m[5] * vy + m[9] * vz + m[13];
		const rz = m[2] * vx + m[6] * vy + m[10] * vz + m[14];
		out[i * 3] = rx * s;
		out[i * 3 + 1] = -ry * s;
		out[i * 3 + 2] = zSign * rz * s;
	}
	return out;
}

/**
 * The 3D bounds of a vertex list, moved by an offset. A vertex with a
 * component that is not a finite number is left out.
 * @param vertices - `[x, y, z, ...]`
 * @param offset - added to every vertex (a shape's `pos`)
 * @param out - the AABB3d to write into
 * @returns `out`, a point at `offset` for no vertices
 * @ignore
 */
export function boundsOfVertices(
	vertices: ArrayLike<number>,
	offset: Vector3d,
	out: AABB3d,
) {
	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;
	for (let i = 0; i + 2 < vertices.length; i += 3) {
		const x = vertices[i];
		const y = vertices[i + 1];
		const z = vertices[i + 2];
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
			continue;
		}
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (z < minZ) minZ = z;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		if (z > maxZ) maxZ = z;
	}
	if (minX === Infinity) {
		minX = minY = minZ = maxX = maxY = maxZ = 0;
	}
	out.setMinMax(
		minX + offset.x,
		minY + offset.y,
		minZ + offset.z,
		maxX + offset.x,
		maxY + offset.y,
		maxZ + offset.z,
	);
	return out;
}

/**
 * A collision shape made of a mesh's own triangles, exact to the surface:
 * the shape for **static** level geometry, such as terrain, a ramp or a room
 * loaded from glTF, that a character walks on and objects land on.
 *
 * It is hollow, a skin of triangles with no inside, so it suits bodies that
 * do not move. A moving body is better given a {@link ConvexHull3d}, or a
 * few {@link Box3d}, {@link Sphere} and {@link Capsule3d} shapes.
 *
 * Its vertices are in the body's space, relative to the renderable's `pos`,
 * in the engine's 3D convention (Y-down, +Z forward).
 * {@link TriangleMesh3d.fromMesh} builds one from a {@link Mesh} as it is
 * drawn, a glTF part included.
 *
 * A 3D physics adapter (`@melonjs/rapier3d-adapter`) builds it exactly. The
 * built-in physics approximates it by its bounding {@link Box3d}, and the 2D
 * adapters refuse it.
 * @category Geometry
 * @example
 * // a loaded level's ground, which the player walks on
 * const ground = app.world.getChildByName("ground")[0];
 * ground.bodyDef = { type: "static", shapes: [TriangleMesh3d.fromMesh(ground)] };
 */
export class TriangleMesh3d {
	/** an offset from the owning body's position, added to every vertex */
	pos: Vector3d;

	/** the vertices, `[x, y, z, ...]`, relative to `pos` */
	vertices: Float32Array;

	/** three vertex indices per triangle */
	indices: Uint32Array;

	/**
	 * the shape type (used internally)
	 * @default "TriangleMesh3d"
	 */
	type = "TriangleMesh3d";

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
	 * @param vertices - the vertices, `[x, y, z, ...]`
	 * @param indices - three vertex indices per triangle; consecutive
	 * triples of vertices when omitted
	 * @throws {Error} when there is not a whole number of vertices, or an
	 * index names a vertex that is not there
	 */
	constructor(vertices: ArrayLike<number>, indices?: ArrayLike<number>) {
		if (vertices.length % 3 !== 0) {
			throw new Error(
				`TriangleMesh3d: vertices must be x, y, z triples (got ${vertices.length} numbers)`,
			);
		}
		const count = vertices.length / 3;
		const idx =
			indices ??
			Array.from({ length: count - (count % 3) }, (_v, i) => {
				return i;
			});
		if (idx.length % 3 !== 0) {
			throw new Error(
				`TriangleMesh3d: indices must come in threes, one per triangle (got ${idx.length})`,
			);
		}
		for (let i = 0; i < idx.length; i++) {
			const k = idx[i];
			if (!Number.isInteger(k) || k < 0 || k >= count) {
				throw new Error(
					`TriangleMesh3d: index ${k} names no vertex (there are ${count})`,
				);
			}
		}
		this.pos = new Vector3d();
		this.vertices = Float32Array.from(vertices);
		this.indices = Uint32Array.from(idx);
		this._bounds = new Bounds();
		this._bounds3d = new AABB3d();
	}

	/**
	 * A triangle mesh of a {@link Mesh} as it is drawn, relative to its `pos`:
	 * through its transform, scale and handedness, so a body given it collides
	 * with what is seen. A physics engine that turns the body turns it from
	 * there.
	 * @param mesh - the mesh, a glTF part included
	 * @returns a new TriangleMesh3d
	 */
	static fromMesh(mesh: MeshGeometrySource): TriangleMesh3d {
		const indices = mesh._indicesOriginal ?? mesh.indices;
		return new TriangleMesh3d(bakeMeshVertices(mesh), indices);
	}

	/** the number of triangles */
	get triangleCount(): number {
		return this.indices.length / 3;
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
		return boundsOfVertices(this.vertices, this.pos, out ?? new AABB3d());
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
	 * @returns a new TriangleMesh3d
	 */
	clone(): TriangleMesh3d {
		const copy = new TriangleMesh3d(this.vertices, this.indices);
		copy.pos.set(this.pos.x, this.pos.y, this.pos.z);
		return copy;
	}
}

/**
 * The Box3d spanning a 3D bounds.
 * @param b - the bounds
 * @returns a new Box3d
 * @ignore
 */
export function boxOf(b: AABB3d): Box3d {
	return new Box3d(
		(b.min.x + b.max.x) / 2,
		(b.min.y + b.max.y) / 2,
		(b.min.z + b.max.z) / 2,
		b.max.x - b.min.x,
		b.max.y - b.min.y,
		b.max.z - b.min.z,
	);
}
