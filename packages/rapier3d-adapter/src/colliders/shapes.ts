/**
 * The Rapier colliders melonJS's 3D shapes become.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import {
	type BodyShape,
	Box3d,
	Capsule3d,
	ConvexHull3d,
	Sphere,
	TriangleMesh3d,
} from "melonjs";
import type { Units, XYZ } from "../math/units";
import type { ColliderPart } from "./types";

/**
 * The message for a shape this adapter cannot build a collider from.
 * @param shape - the shape that was refused
 * @returns the message to throw
 */
function unsupportedShapeMessage(shape: BodyShape): string {
	// `type` rather than `constructor.name`: the class name is mangled by a
	// minifier and this string is most useful in a production build.
	const name =
		(shape as { type?: string }).type ??
		(shape as { constructor: { name: string } }).constructor.name;
	return `Rapier3dAdapter: unsupported shape type ${name}. A 3D world needs a shape with depth: this adapter builds colliders from Box3d, Sphere, Capsule3d, ConvexHull3d and TriangleMesh3d. A Rect becomes a Box3d of the same footprint, an Ellipse a Sphere.`;
}

/**
 * The colliders a list of shapes becomes, not yet in the world. A shape with
 * `isActive: false` makes none.
 * @param rapier - the Rapier module
 * @param units - the scale between pixels and meters
 * @param shapes - the shapes of a body definition
 * @returns one part per active shape
 * @throws {Error} for a shape this adapter cannot build
 */
export function buildColliderParts(
	rapier: typeof RAPIER,
	units: Units,
	shapes: BodyShape[],
): ColliderPart[] {
	const parts: ColliderPart[] = [];
	for (const [index, shape] of shapes.entries()) {
		// `isActive === false` keeps a shape out of the simulation
		if ((shape as { isActive?: boolean }).isActive === false) {
			continue;
		}
		parts.push({ shape, index, ...shapeToCollider(rapier, units, shape) });
	}
	return parts;
}

/**
 * The Rapier collider a melonJS 3D shape becomes, with its box in body space,
 * in pixels.
 * @param rapier - the Rapier module
 * @param units - the scale between pixels and meters
 * @param shape - the shape
 * @returns its collider description and box
 * @throws {Error} for a 2D shape, or anything else this adapter cannot build
 */
function shapeToCollider(
	rapier: typeof RAPIER,
	units: Units,
	shape: BodyShape,
): Omit<ColliderPart, "shape" | "index"> {
	const { ColliderDesc } = rapier;
	const m = (px: number) => {
		return units.toMeters(px);
	};
	// the box around a centre, by its half sizes, in pixels
	const box = (c: XYZ, hx: number, hy: number, hz: number) => {
		return {
			min: { x: c.x - hx, y: c.y - hy, z: c.z - hz },
			max: { x: c.x + hx, y: c.y + hy, z: c.z + hz },
		};
	};
	// a collider placed at a centre given in pixels
	const at = (desc: RAPIER.ColliderDesc, c: XYZ) => {
		return desc.setTranslation(m(c.x), m(c.y), m(c.z));
	};

	if (shape instanceof Box3d) {
		const h = shape.halfExtents;
		return {
			desc: at(ColliderDesc.cuboid(m(h.x), m(h.y), m(h.z)), shape.pos),
			...box(shape.pos, h.x, h.y, h.z),
		};
	}

	if (shape instanceof Sphere) {
		const r = shape.radius;
		const { x, y, z } = shape.pos;
		return {
			desc: at(ColliderDesc.ball(m(r)), shape.pos),
			...box(shape.pos, r, r, r),
			round: { a: { x, y, z }, b: { x, y, z }, r },
		};
	}

	if (shape instanceof Capsule3d) {
		const r = shape.radius;
		const half = shape.halfSegment;
		const { x, y, z } = shape.pos;
		// along Y, as Rapier's own capsule
		return {
			desc: at(ColliderDesc.capsule(m(half), m(r)), shape.pos),
			...box(shape.pos, r, half + r, r),
			round: { a: { x, y: y - half, z }, b: { x, y: y + half, z }, r },
		};
	}

	if (shape instanceof TriangleMesh3d || shape instanceof ConvexHull3d) {
		const source =
			shape instanceof TriangleMesh3d ? shape.vertices : shape.points;
		const meters = new Float32Array(source.length);
		const { x: ox, y: oy, z: oz } = shape.pos;
		for (let i = 0; i < source.length; i += 3) {
			meters[i] = m(source[i] + ox);
			meters[i + 1] = m(source[i + 1] + oy);
			meters[i + 2] = m(source[i + 2] + oz);
		}
		const b = shape.getBounds3d();
		const bounds = {
			min: { x: b.min.x, y: b.min.y, z: b.min.z },
			max: { x: b.max.x, y: b.max.y, z: b.max.z },
		};
		if (shape instanceof TriangleMesh3d) {
			return { desc: ColliderDesc.trimesh(meters, shape.indices), ...bounds };
		}
		const hull = ColliderDesc.convexHull(meters);
		if (hull !== null) {
			return { desc: hull, ...bounds };
		}
		// points all in one plane have no hull: their bounding box
		const c = {
			x: (bounds.min.x + bounds.max.x) / 2,
			y: (bounds.min.y + bounds.max.y) / 2,
			z: (bounds.min.z + bounds.max.z) / 2,
		};
		const half = (lo: number, hi: number) => {
			return Math.max((hi - lo) / 2, 0.5);
		};
		const hx = half(bounds.min.x, bounds.max.x);
		const hy = half(bounds.min.y, bounds.max.y);
		const hz = half(bounds.min.z, bounds.max.z);
		return {
			desc: at(ColliderDesc.cuboid(m(hx), m(hy), m(hz)), c),
			...box(c, hx, hy, hz),
		};
	}

	// refused loudly rather than skipped, as on the other adapters
	throw new Error(unsupportedShapeMessage(shape));
}
