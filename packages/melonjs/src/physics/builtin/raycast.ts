import type { Box3d } from "../../geometries/box3d.ts";
import type { Ellipse } from "../../geometries/ellipse.ts";
import { linePool } from "../../geometries/line.ts";
import type { Polygon } from "../../geometries/polygon.ts";
import type { Sphere } from "../../geometries/sphere.ts";
import { warnOnce } from "../../lang/console.js";
import { Vector2d } from "../../math/vector2d.ts";
import type Renderable from "../../renderable/renderable.js";
import type { RaycastHit } from "../adapter.ts";
import type World from "../world.js";
import type Body from "./body.js";
import { anchorOffsetX, anchorOffsetY } from "./sat.js";

/**
 * Shared internal raycast walker for the built-in physics path. Used by
 * BOTH `BuiltinAdapter.raycast` (portable single-nearest-hit API) and
 * `Detector.rayCast` (legacy multi-hit renderable list). Single SAT walk,
 * two thin format adapters on top.
 *
 * Computes **actual entry-point geometry** per shape:
 *   point     = the parametric intersection on the shape's surface
 *   normal    = the polygon edge normal (or ellipse surface normal) at
 *               the entry, pointing back toward the ray origin
 *   fraction  = parametric `t` on `[0, 1]` along the ray (0 = `from`,
 *               1 = `to`)
 *
 * Hits are sorted nearest-first. Sub-shape edges of compound bodies are
 * collapsed to one hit per renderable (the earliest entry across all
 * shapes wins, matching what game code wants for "what did the ray
 * touch first").
 *
 * Shapes are measured as the narrowphase measures them against a planar
 * shape: a polygon (`Polygon`, `Rect`, `RoundRect`, `Line`) by its edges, an
 * `Ellipse` with its rotation, and the two 3D shapes by their XY footprint —
 * a `Box3d` as its footprint rectangle, a `Sphere` as a circle of its radius —
 * since a 2D ray is unbounded along Z. A shape with no area to cross (a
 * `Point`) or of a type this does not know is skipped, with a one-time
 * warning, rather than taking the query down.
 */

interface ShapeHit {
	t: number;
	normalX: number;
	normalY: number;
}

function _cross(ax: number, ay: number, bx: number, by: number): number {
	// 2D cross product of (a → b) and (a → c): positive if c is to the
	// left of a → b, negative if right, zero if colinear. Reused by the
	// segment-vs-segment intersection.
	return ax * by - ay * bx;
}

function _computeShapeAbsPos(
	renderable: Renderable,
	shape: { pos: { x: number; y: number } },
	outPos: Vector2d,
): void {
	// Compute the absolute world position of a shape attached to a body
	// attached to a renderable. Mirrors what SAT does, measuring the shape
	// from the frame the renderable draws in:
	//   absPos = renderable.pos - size * anchorPoint + ancestor.absPos + shape.pos
	const ancestor = renderable.ancestor as
		| { getAbsolutePosition?(): { x: number; y: number } }
		| undefined;
	const ancestorAbs =
		ancestor && typeof ancestor.getAbsolutePosition === "function"
			? ancestor.getAbsolutePosition()
			: null;
	const ax = ancestorAbs ? ancestorAbs.x : 0;
	const ay = ancestorAbs ? ancestorAbs.y : 0;
	outPos.x = renderable.pos.x - anchorOffsetX(renderable) + ax + shape.pos.x;
	outPos.y = renderable.pos.y - anchorOffsetY(renderable) + ay + shape.pos.y;
}

const _shapeAbs = new Vector2d(0, 0);

function _raycastPolygon(
	fromX: number,
	fromY: number,
	dx: number,
	dy: number,
	shape: Polygon,
	shapeAbsX: number,
	shapeAbsY: number,
): ShapeHit | null {
	// Find the smallest ray parameter `t` (in `[0, 1]`) where the ray
	// `from` → `to` enters the polygon, along with the outward normal of
	// the hit edge. Returns `null` if the ray misses every edge.
	//
	// Iterates polygon edges as line segments and solves the line-
	// segment vs line-segment intersection:
	//   ray:   from + t * (to - from), t ∈ [0, 1]
	//   edge:  A + s * (B - A),         s ∈ [0, 1]
	const points = shape.points;
	const normals = shape.edgeNormals;
	const len = points.length;
	// a two-point shape (a `Line`) is ONE segment with one normal, not a
	// closed loop of two: walking it back from the last point to the first
	// read a normal that does not exist
	const edgeCount = len === 2 ? 1 : len;
	let bestT = Infinity;
	let bestNormalIdx = -1;

	for (let i = 0; i < edgeCount; i++) {
		const p0 = points[i];
		const p1 = points[(i + 1) % len];
		const ax = shapeAbsX + p0.x;
		const ay = shapeAbsY + p0.y;
		const ex = p1.x - p0.x;
		const ey = p1.y - p0.y;

		const denom = _cross(dx, dy, ex, ey);
		// Parallel (or near-parallel) — skip; SAT handled the grazing case.
		if (Math.abs(denom) < 1e-9) {
			continue;
		}
		const fx = ax - fromX;
		const fy = ay - fromY;
		const t = _cross(fx, fy, ex, ey) / denom;
		const s = _cross(fx, fy, dx, dy) / denom;
		if (t >= 0 && t <= 1 && s >= 0 && s <= 1 && t < bestT) {
			bestT = t;
			bestNormalIdx = i;
		}
	}

	if (bestNormalIdx === -1) {
		return null;
	}
	const normal = normals[bestNormalIdx];
	return { t: bestT, normalX: normal.x, normalY: normal.y };
}

function _raycastEllipse(
	fromX: number,
	fromY: number,
	dx: number,
	dy: number,
	rx: number,
	ry: number,
	angle: number,
	shapeAbsX: number,
	shapeAbsY: number,
): ShapeHit | null {
	// Find the smallest ray parameter `t` where the ray enters the
	// ellipse, plus the surface normal at that point. Solves the
	// standard quadratic for
	// `((px - cx) / rx)² + ((py - cy) / ry)² = 1`:
	//   A·t² + B·t + C = 0
	// where:
	//   A = (dx/rx)² + (dy/ry)²
	//   B = 2 · ((dx · (fx-cx))/rx² + (dy · (fy-cy))/ry²)
	//   C = ((fx-cx)/rx)² + ((fy-cy)/ry)² - 1
	//
	// in the ellipse's OWN frame: a rotated ellipse (`Ellipse#rotate`) has
	// its radii along its turned axes, so the ray is turned into that frame
	// first — by `-angle`, as
	// `Ellipse#contains` un-rotates a point — and the normal turned back out
	// of it. A rotation leaves `t` unchanged.
	const cx = shapeAbsX;
	const cy = shapeAbsY;
	if (rx <= 0 || ry <= 0) {
		return null;
	}
	let lfx = fromX - cx;
	let lfy = fromY - cy;
	let ldx = dx;
	let ldy = dy;
	const cos = angle !== 0 ? Math.cos(angle) : 1;
	const sin = angle !== 0 ? Math.sin(angle) : 0;
	if (angle !== 0) {
		const fx = lfx * cos + lfy * sin;
		lfy = -lfx * sin + lfy * cos;
		lfx = fx;
		const ddx0 = ldx * cos + ldy * sin;
		ldy = -ldx * sin + ldy * cos;
		ldx = ddx0;
	}
	const ox = lfx / rx;
	const oy = lfy / ry;
	const ddx = ldx / rx;
	const ddy = ldy / ry;
	const A = ddx * ddx + ddy * ddy;
	const B = 2 * (ddx * ox + ddy * oy);
	const C = ox * ox + oy * oy - 1;
	const disc = B * B - 4 * A * C;
	if (disc < 0 || A < 1e-12) {
		return null;
	}
	const sqrtDisc = Math.sqrt(disc);
	const t0 = (-B - sqrtDisc) / (2 * A);
	const t1 = (-B + sqrtDisc) / (2 * A);
	// Smaller positive root in [0, 1] is the entry; if ray origin is
	// inside the ellipse (`t0 < 0`), the entry is behind us so we use
	// `t1` (the exit point on this side).
	let t: number;
	if (t0 >= 0 && t0 <= 1) {
		t = t0;
	} else if (t1 >= 0 && t1 <= 1) {
		t = t1;
	} else {
		return null;
	}
	// hit point, relative to the centre, in the ellipse's own frame
	const hitX = lfx + ldx * t;
	const hitY = lfy + ldy * t;
	// Ellipse surface normal at (x, y) is gradient of the implicit
	// form: ∇F = (2x/rx², 2y/ry²). Normalise.
	let nx = hitX / (rx * rx);
	let ny = hitY / (ry * ry);
	const nLen = Math.hypot(nx, ny);
	if (nLen > 0) {
		nx /= nLen;
		ny /= nLen;
	}
	if (angle !== 0) {
		// back out of the ellipse's frame, by `+angle`
		const wx = nx * cos - ny * sin;
		ny = nx * sin + ny * cos;
		nx = wx;
	}
	return { t, normalX: nx, normalY: ny };
}

/**
 * Entry of the ray into one shape of `renderable`'s body, measured as the
 * module comment describes, or `null` for a miss or a shape that cannot be
 * measured.
 * @param renderable - the renderable owning the shape
 * @param shape - one shape of its body
 * @param fromX - ray origin x
 * @param fromY - ray origin y
 * @param dx - ray direction x (to - from)
 * @param dy - ray direction y (to - from)
 * @returns the entry, or `null`
 */
function _raycastShape(
	renderable: Renderable,
	shape: unknown,
	fromX: number,
	fromY: number,
	dx: number,
	dy: number,
): ShapeHit | null {
	const type = (shape as { type?: unknown }).type;
	switch (type) {
		case "Ellipse": {
			const ellipse = shape as Ellipse;
			_computeShapeAbsPos(renderable, ellipse, _shapeAbs);
			return _raycastEllipse(
				fromX,
				fromY,
				dx,
				dy,
				ellipse.radiusV.x,
				ellipse.radiusV.y,
				ellipse.angle,
				_shapeAbs.x,
				_shapeAbs.y,
			);
		}
		case "Sphere": {
			// XY silhouette of a sphere: a circle of its radius, about its
			// centre (`Sphere#pos`), as the mixed SAT pairs see it
			const sphere = shape as Sphere;
			const r = Math.abs(sphere.radius);
			_computeShapeAbsPos(renderable, sphere, _shapeAbs);
			return _raycastEllipse(
				fromX,
				fromY,
				dx,
				dy,
				r,
				r,
				0,
				_shapeAbs.x,
				_shapeAbs.y,
			);
		}
		case "Box3d": {
			// the XY footprint the mixed SAT pairs test against: its `pos`
			// is the footprint's min corner, its points offsets from it
			const footprint = (shape as Box3d)._footprint;
			_computeShapeAbsPos(renderable, footprint, _shapeAbs);
			return _raycastPolygon(
				fromX,
				fromY,
				dx,
				dy,
				footprint,
				_shapeAbs.x,
				_shapeAbs.y,
			);
		}
		default: {
			// `Polygon`, `Rectangle`, `RoundRect` and `Line` (which keeps the
			// `Polygon` type), and anything else shaped like one
			const poly = shape as Partial<Polygon>;
			if (
				Array.isArray(poly.points) &&
				poly.points.length >= 2 &&
				Array.isArray(poly.edgeNormals) &&
				poly.pos !== undefined
			) {
				_computeShapeAbsPos(renderable, poly as Polygon, _shapeAbs);
				return _raycastPolygon(
					fromX,
					fromY,
					dx,
					dy,
					poly as Polygon,
					_shapeAbs.x,
					_shapeAbs.y,
				);
			}
			// a `Point` has no area for a ray to enter; anything else is a
			// shape this walker does not know how to measure. The detector
			// treats a pair it has no test for the same way.
			warnOnce(
				`melonJS: raycast cannot test a ${String(type)} shape; skipping it`,
			);
			return null;
		}
	}
}

export function raycastQuery(
	world: World,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
): RaycastHit[] {
	// Walk the world's broadphase and return every body the ray
	// `(fromX, fromY) → (toX, toY)` enters, sorted nearest-first.
	const dx = toX - fromX;
	const dy = toY - fromY;
	const segLen = Math.hypot(dx, dy);
	if (segLen < 1e-9) {
		// Degenerate ray — no direction, nothing to hit.
		return [];
	}

	// Build a Line geometry for broadphase retrieval. We only use it for
	// the bounds-based AABB query; the per-shape entry math is done
	// directly below in `_raycastPolygon` / `_raycastEllipse`.
	const line = linePool.get(fromX, fromY, [
		new Vector2d(0, 0),
		new Vector2d(dx, dy),
	]);

	// Pass our own result array to `retrieve` so we never touch the
	// broadphase's shared scratch — user code may call `adapter.raycast`
	// from inside an `onCollisionStart` handler that itself fires mid
	// iteration of the SAT detector's scratch walk; sharing would clobber
	// the outer iteration.
	const candidates: Renderable[] = [];
	world.broadphase.retrieve(line, undefined, candidates);
	const hits: RaycastHit[] = [];

	for (let i = candidates.length - 1; i >= 0; i--) {
		const objB = candidates[i];
		if (!objB.body) {
			continue;
		}
		if (!line.getBounds().overlaps(objB.getBounds())) {
			continue;
		}

		// This raycast walks the BuiltinAdapter's broadphase, so every
		// `objB.body` here is a concrete builtin `Body` — narrow from
		// the portable `PhysicsBody` interface (which doesn't expose
		// `shapes` / `getShape` since those are adapter-specific) to
		// the concrete type.
		const bodyB = objB.body as Body;
		const shapeCount = bodyB.shapes.length;
		if (shapeCount === 0) {
			continue;
		}

		// Walk every shape in the compound body and keep the earliest
		// entry — that's "what the ray hit first" for the renderable as
		// a whole.
		let bestT = Infinity;
		let bestNormalX = 0;
		let bestNormalY = 0;
		for (let j = 0; j < shapeCount; j++) {
			const shapeB = bodyB.getShape(j);
			// `isActive === false` takes a shape out of collision entirely, and
			// a ray IS a collision query — a body whose only shape is inactive
			// must not be hit (#1590)
			if ((shapeB as { isActive?: boolean }).isActive === false) {
				continue;
			}
			const hit = _raycastShape(objB, shapeB, fromX, fromY, dx, dy);
			if (hit !== null && hit.t < bestT) {
				bestT = hit.t;
				bestNormalX = hit.normalX;
				bestNormalY = hit.normalY;
			}
		}

		if (bestT === Infinity) {
			continue;
		}

		// Flip normal to point back toward the ray origin (Box2D / planck
		// convention — caller treats `normal` as "the direction the ray
		// bounces off in"). Edge normals from the polygon side already
		// point outward, so this is usually a no-op; ellipse normals
		// point outward from the centre, also a no-op for an entry hit.
		// We still check to be robust.
		const flipSign = bestNormalX * dx + bestNormalY * dy > 0 ? -1 : 1;

		hits.push({
			renderable: objB,
			point: new Vector2d(fromX + dx * bestT, fromY + dy * bestT),
			normal: new Vector2d(bestNormalX * flipSign, bestNormalY * flipSign),
			fraction: bestT,
		});
	}

	linePool.release(line);

	hits.sort((a, b) => {
		return a.fraction - b.fraction;
	});
	return hits;
}
