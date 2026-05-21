import type { Ellipse } from "../../geometries/ellipse.ts";
import { linePool } from "../../geometries/line.ts";
import type { Polygon } from "../../geometries/polygon.ts";
import { Vector2d } from "../../math/vector2d.ts";
import type Renderable from "../../renderable/renderable.js";
import type { RaycastHit } from "../adapter.ts";
import type World from "../world.js";

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
	shape: Polygon | Ellipse,
	outPos: Vector2d,
): void {
	// Compute the absolute world position of a shape attached to a body
	// attached to a renderable. Mirrors what SAT does:
	//   absPos = renderable.pos + ancestor.absPos + shape.pos
	const ancestor = renderable.ancestor as
		| { getAbsolutePosition?(): { x: number; y: number } }
		| undefined;
	const ancestorAbs =
		ancestor && typeof ancestor.getAbsolutePosition === "function"
			? ancestor.getAbsolutePosition()
			: null;
	const ax = ancestorAbs ? ancestorAbs.x : 0;
	const ay = ancestorAbs ? ancestorAbs.y : 0;
	outPos.x = renderable.pos.x + ax + shape.pos.x;
	outPos.y = renderable.pos.y + ay + shape.pos.y;
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
	const normals = shape.normals;
	const len = points.length;
	let bestT = Infinity;
	let bestNormalIdx = -1;

	for (let i = 0; i < len; i++) {
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
	shape: Ellipse,
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
	const cx = shapeAbsX;
	const cy = shapeAbsY;
	const rx = shape.radiusV.x;
	const ry = shape.radiusV.y;
	if (rx <= 0 || ry <= 0) {
		return null;
	}
	const ox = (fromX - cx) / rx;
	const oy = (fromY - cy) / ry;
	const ddx = dx / rx;
	const ddy = dy / ry;
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
	const hitX = fromX + dx * t;
	const hitY = fromY + dy * t;
	// Ellipse surface normal at (x, y) is gradient of the implicit
	// form: ∇F = (2(x-cx)/rx², 2(y-cy)/ry²). Normalise.
	let nx = (hitX - cx) / (rx * rx);
	let ny = (hitY - cy) / (ry * ry);
	const nLen = Math.hypot(nx, ny);
	if (nLen > 0) {
		nx /= nLen;
		ny /= nLen;
	}
	return { t, normalX: nx, normalY: ny };
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

		const bodyB = objB.body as unknown as {
			shapes: ArrayLike<unknown>;
			getShape(i: number): Polygon | Ellipse;
		};
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
			_computeShapeAbsPos(objB, shapeB, _shapeAbs);
			const hit =
				shapeB.type === "Ellipse"
					? _raycastEllipse(
							fromX,
							fromY,
							dx,
							dy,
							shapeB as Ellipse,
							_shapeAbs.x,
							_shapeAbs.y,
						)
					: _raycastPolygon(
							fromX,
							fromY,
							dx,
							dy,
							shapeB as Polygon,
							_shapeAbs.x,
							_shapeAbs.y,
						);
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
