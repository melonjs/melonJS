import { Ellipse } from "../../geometries/ellipse.ts";
import {
	testEllipseEllipse,
	testEllipsePolygon,
	testPolygonEllipse,
	testPolygonPolygon,
} from "./sat.js";

/**
 * @import {Box3d} from "../../geometries/box3d.ts";
 * @import {Sphere} from "../../geometries/sphere.ts";
 * @import {Polygon} from "../../geometries/polygon.ts";
 * @import {Ellipse} from "../../geometries/ellipse.ts";
 * @import Renderable from "../../renderable/renderable.js";
 */

/**
 * Absolute (world) center of a {@link Box3d} shape on one axis.
 *
 * Mirrors the convention the 2D SAT tests use — a shape's world position is
 * `renderable.pos + renderable.ancestor.getAbsolutePosition() + shape.pos` —
 * except that all three terms are read in 3D. `getAbsolutePosition()` already
 * sums z across the whole ancestor chain.
 * @ignore
 * @internal
 */
function absCenter(renderable, box, out) {
	const anc = renderable.ancestor.getAbsolutePosition();
	// `anchorPoint` moves the drawn frame in XY; shapes are measured from
	// it, so the same offset comes off here. It has no Z term.
	//
	// Unless the renderable opts out of the anchor the way `preDraw` reads it,
	// which is the normal case for the things that carry a `Box3d`: a
	// `GLTFModel` sets `applyAnchorTransform = false` outright, and a `Mesh`
	// clears it on the `Camera3d` world-space path, because both emit world
	// coordinates and pivot about their own model origin. Taking an anchor off
	// those moved each body by half its OWN bounds box, and a scene sizes that
	// box per node, so a hull and the props it should hit were displaced by
	// different amounts and the contact was simply never reported.
	const anchored = renderable.applyAnchorTransform !== false;
	const ax =
		anchored && Number.isFinite(renderable.width)
			? renderable.width * renderable.anchorPoint.x
			: 0;
	const ay =
		anchored && Number.isFinite(renderable.height)
			? renderable.height * renderable.anchorPoint.y
			: 0;
	out[0] = renderable.pos.x + anc.x + box.pos.x - ax;
	out[1] = renderable.pos.y + anc.y + box.pos.y - ay;
	out[2] = renderable.pos.z + anc.z + box.pos.z;
	return out;
}

// module scratch for the two box centers; never escapes testBox3dBox3d
const _centerA = [0, 0, 0];
const _centerB = [0, 0, 0];

/**
 * Check whether two axis-aligned 3D boxes collide.
 *
 * This is the only narrowphase in the engine that can produce a **Z**
 * pushback. The separating-axis set of two AABBs is just the three world axes,
 * so there is no projection loop: penetration on each axis is
 * `(halfA + halfB) - |centerDelta|`, a non-positive value on any axis means
 * separated, and the minimum translation vector is the axis with the smallest
 * positive penetration.
 *
 * The MTV is a single axis, so exactly one of `overlapN.x`, `overlapN.y` and
 * `overlapNZ` comes back non-zero — see {@link ResponseObject#overlapNZ}. When
 * that axis is Z the 2D fields stay at zero, which is what makes a legacy 2D
 * `onCollision` handler safely inert on a depth-only contact rather than
 * wrong.
 * @ignore
 * @internal
 * @param {Renderable} a - a reference to the object A.
 * @param {Box3d} boxA - a reference to the object A Box3d to be tested
 * @param {Renderable} b - a reference to the object B.
 * @param {Box3d} boxB - a reference to the object B Box3d to be tested
 * @param {object} [response] - Response object that will be populated if they intersect.
 * @returns {boolean} true if they intersect, false if they don't.
 */
export function testBox3dBox3d(a, boxA, b, boxB, response) {
	const ca = absCenter(a, boxA, _centerA);
	const cb = absCenter(b, boxB, _centerB);

	const ha = boxA.halfExtents;
	const hb = boxB.halfExtents;

	const dx = cb[0] - ca[0];
	const dy = cb[1] - ca[1];
	const dz = cb[2] - ca[2];

	const px = ha.x + hb.x - Math.abs(dx);
	if (px <= 0) {
		return false;
	}
	const py = ha.y + hb.y - Math.abs(dy);
	if (py <= 0) {
		return false;
	}
	const pz = ha.z + hb.z - Math.abs(dz);
	if (pz <= 0) {
		return false;
	}

	if (response) {
		response.a = a;
		response.b = b;

		// Smallest positive penetration wins, which is what pushes a body
		// resting on a floor straight up: it has barely sunk along Y and
		// overlaps the floor's whole width along X. An exact tie between two
		// axes has no better answer than a deterministic one, and resolves
		// X → Y → Z.
		if (px <= py && px <= pz) {
			// `dx === 0` (perfectly concentric on this axis) has no
			// meaningful side, so bias to +1 rather than emitting a zero
			// normal, which would make the push-out a no-op and leave the
			// pair overlapping forever.
			const n = dx < 0 ? -1 : 1;
			response.overlap = px;
			response.overlapN.set(n, 0);
			response.overlapV.set(n * px, 0);
			response.overlapNZ = 0;
			response.overlapZ = 0;
		} else if (py <= pz) {
			const n = dy < 0 ? -1 : 1;
			response.overlap = py;
			response.overlapN.set(0, n);
			response.overlapV.set(0, n * py);
			response.overlapNZ = 0;
			response.overlapZ = 0;
		} else {
			const n = dz < 0 ? -1 : 1;
			response.overlap = pz;
			response.overlapN.set(0, 0);
			response.overlapV.set(0, 0);
			response.overlapNZ = n;
			response.overlapZ = n * pz;
		}

		response.aInB =
			ha.x <= hb.x &&
			ha.y <= hb.y &&
			ha.z <= hb.z &&
			Math.abs(dx) <= hb.x - ha.x &&
			Math.abs(dy) <= hb.y - ha.y &&
			Math.abs(dz) <= hb.z - ha.z;
		response.bInA =
			hb.x <= ha.x &&
			hb.y <= ha.y &&
			hb.z <= ha.z &&
			Math.abs(dx) <= ha.x - hb.x &&
			Math.abs(dy) <= ha.y - hb.y &&
			Math.abs(dz) <= ha.z - hb.z;
	}

	return true;
}

// module scratch for the sphere tests; never escapes the call that fills it
const _centerS = [0, 0, 0];
const _centerT = [0, 0, 0];

/**
 * Write a 3D contact into a response, from a separating direction and a
 * penetration depth.
 *
 * The response splits a 3D normal across a 2D vector and a scalar z, which
 * is how the whole pipeline carries depth: `overlapN` / `overlapV` are the
 * XY part and `overlapNZ` / `overlapZ` the Z part. Doing it in one place
 * keeps the sphere tests from each re-deriving the convention.
 * @ignore
 * @internal
 */
function writeContact(response, nx, ny, nz, depth) {
	response.overlap = depth;
	response.overlapN.set(nx, ny);
	response.overlapV.set(nx * depth, ny * depth);
	response.overlapNZ = nz;
	response.overlapZ = nz * depth;
}

/**
 * Check whether two {@link Sphere} shapes collide.
 *
 * The simplest test there is — centres closer than the sum of the radii —
 * and the only 3D shape that needs no orientation, which is why it is the
 * one to reach for when the things being tested tumble or sit on a curved
 * surface.
 * @param {Renderable} a - a reference to the object A.
 * @param {Sphere} sphereA - a reference to the object A Sphere to be tested
 * @param {Renderable} b - a reference to the object B.
 * @param {Sphere} sphereB - a reference to the object B Sphere to be tested
 * @param {object} [response] - Response object that will be populated if they intersect.
 * @returns {boolean} true if they intersect, false if they don't.
 */
export function testSphereSphere(a, sphereA, b, sphereB, response) {
	const ca = absCenter(a, sphereA, _centerS);
	const cb = absCenter(b, sphereB, _centerT);

	// negative radii behave as their absolute value, matching
	// `Sphere.overlaps` and `Sphere.contains`
	const ra = Math.abs(sphereA.radius);
	const rb = Math.abs(sphereB.radius);

	const dx = cb[0] - ca[0];
	const dy = cb[1] - ca[1];
	const dz = cb[2] - ca[2];
	const distSq = dx * dx + dy * dy + dz * dz;
	const reach = ra + rb;
	if (distSq > reach * reach) {
		return false;
	}

	if (response) {
		response.a = a;
		response.b = b;
		const dist = Math.sqrt(distSq);
		if (dist > 0) {
			writeContact(response, dx / dist, dy / dist, dz / dist, reach - dist);
		} else {
			// concentric: there is no meaningful direction, so pick one
			// rather than emitting a zero normal, which would make the
			// push-out a no-op and leave the pair overlapping forever
			writeContact(response, 1, 0, 0, reach);
		}
		response.aInB = ra <= rb && dist <= rb - ra;
		response.bInA = rb <= ra && dist <= ra - rb;
	}

	return true;
}

/**
 * Check whether a {@link Sphere} collides with a {@link Box3d}.
 *
 * Against the closest point on the box, which is the centre clamped to the
 * box's extents. That point is the centre itself when the sphere is INSIDE
 * the box, leaving no direction to separate along, so that case falls back
 * to the least-penetrated face, which is the rule {@link testBox3dBox3d}
 * uses throughout, down to resolving an exact tie X → Y → Z.
 * @param {Renderable} a - a reference to the object A.
 * @param {Sphere} sphereA - a reference to the object A Sphere to be tested
 * @param {Renderable} b - a reference to the object B.
 * @param {Box3d} boxB - a reference to the object B Box3d to be tested
 * @param {object} [response] - Response object that will be populated if they intersect.
 * @returns {boolean} true if they intersect, false if they don't.
 */
export function testSphereBox3d(a, sphereA, b, boxB, response) {
	const cs = absCenter(a, sphereA, _centerS);
	const cb = absCenter(b, boxB, _centerT);
	const r = Math.abs(sphereA.radius);
	const h = boxB.halfExtents;

	// the sphere centre relative to the box centre, and clamped into it
	const dx = cs[0] - cb[0];
	const dy = cs[1] - cb[1];
	const dz = cs[2] - cb[2];
	const qx = Math.max(-h.x, Math.min(h.x, dx));
	const qy = Math.max(-h.y, Math.min(h.y, dy));
	const qz = Math.max(-h.z, Math.min(h.z, dz));

	const ox = dx - qx;
	const oy = dy - qy;
	const oz = dz - qz;
	const distSq = ox * ox + oy * oy + oz * oz;
	if (distSq > r * r) {
		return false;
	}

	if (response) {
		response.a = a;
		response.b = b;
		if (distSq > 0) {
			// outside the box: separate along the line to the closest point,
			// pointing from the sphere toward the box
			const dist = Math.sqrt(distSq);
			writeContact(response, -ox / dist, -oy / dist, -oz / dist, r - dist);
		} else {
			// inside it: out through the nearest face
			const px = h.x - Math.abs(dx);
			const py = h.y - Math.abs(dy);
			const pz = h.z - Math.abs(dz);
			if (px <= py && px <= pz) {
				writeContact(response, dx < 0 ? 1 : -1, 0, 0, px + r);
			} else if (py <= pz) {
				writeContact(response, 0, dy < 0 ? 1 : -1, 0, py + r);
			} else {
				writeContact(response, 0, 0, dz < 0 ? 1 : -1, pz + r);
			}
		}
		response.aInB =
			Math.abs(dx) + r <= h.x &&
			Math.abs(dy) + r <= h.y &&
			Math.abs(dz) + r <= h.z;
		// a box is inside a sphere when its furthest corner is
		response.bInA =
			(Math.abs(dx) + h.x) ** 2 +
				(Math.abs(dy) + h.y) ** 2 +
				(Math.abs(dz) + h.z) ** 2 <=
			r * r;
	}

	return true;
}

/**
 * Box-first form of {@link testSphereBox3d}.
 *
 * The response is written from the SPHERE's point of view by the call it
 * delegates to, so the normal is flipped back afterwards — the same shape
 * the planar pairs use for their mirrored entries.
 * @param {Renderable} a - a reference to the object A.
 * @param {Box3d} boxA - a reference to the object A Box3d to be tested
 * @param {Renderable} b - a reference to the object B.
 * @param {Sphere} sphereB - a reference to the object B Sphere to be tested
 * @param {object} [response] - Response object that will be populated if they intersect.
 * @returns {boolean} true if they intersect, false if they don't.
 */
export function testBox3dSphere(a, boxA, b, sphereB, response) {
	const hit = testSphereBox3d(b, sphereB, a, boxA, response);
	if (hit && response) {
		response.a = a;
		response.b = b;
		writeContact(
			response,
			-response.overlapN.x,
			-response.overlapN.y,
			-response.overlapNZ,
			response.overlap,
		);
		const aInB = response.aInB;
		response.aInB = response.bInA;
		response.bInA = aInB;
	}
	return hit;
}

/**
 * Check whether a {@link Box3d} collides with a planar shape.
 *
 * The planar shape is treated as **unbounded along Z** — an infinitely
 * extruded prism of its own outline — so the pair reduces to the ordinary 2D
 * test between the box's XY footprint and that outline, and the box's z can
 * never make it miss. See {@link Box3d} for why that is the compatible
 * reading: it is what keeps an existing 2D game's world shapes colliding
 * unchanged the moment one `Box3d` body is introduced.
 *
 * `overlapZ` is left at `0` by construction, since neither participant has a
 * finite depth to resolve against.
 * @ignore
 * @internal
 */
export function testBox3dPolygon(a, boxA, b, polyB, response) {
	return testPolygonPolygon(a, boxA._footprint, b, polyB, response);
}

/**
 * Planar-shape-first form of {@link testBox3dPolygon}.
 * @ignore
 * @internal
 */
export function testPolygonBox3d(a, polyA, b, boxB, response) {
	return testPolygonPolygon(a, polyA, b, boxB._footprint, response);
}

/**
 * {@link Box3d} against an {@link Ellipse}, with the ellipse unbounded along
 * Z. See {@link testBox3dPolygon}.
 * @ignore
 * @internal
 */
export function testBox3dEllipse(a, boxA, b, ellipseB, response) {
	return testPolygonEllipse(a, boxA._footprint, b, ellipseB, response);
}

/**
 * {@link Ellipse} against a {@link Box3d}, with the ellipse unbounded along
 * Z. See {@link testBox3dPolygon}.
 * @ignore
 * @internal
 */
export function testEllipseBox3d(a, ellipseA, b, boxB, response) {
	return testEllipsePolygon(a, ellipseA, b, boxB._footprint, response);
}

/**
 * A {@link Sphere}'s XY footprint, for the degraded mixed pairs below.
 *
 * ONE instance for the whole engine, rewritten per test rather than kept per
 * sphere. A sphere is moved by whoever owns it — directly through `pos`, not
 * only through `setShape` — so a footprint cached on the shape would need
 * invalidating on every write to it; and the narrowphase never nests, so a
 * single scratch shape is enough for every body in the world. Contrast
 * {@link Box3d}, whose footprint is a `Polygon` whose edge normals cost real
 * work to rebuild, and so is kept on the shape instead.
 * @ignore
 * @internal
 */
const _footprint = new Ellipse(0, 0, 1, 1);

/**
 * Point `_footprint` at a sphere's XY silhouette, which is a circle of the
 * sphere's own radius — exact, not an approximation, unlike a box's.
 * @param {Sphere} sphere - the sphere to take the footprint of
 * @returns {Ellipse} the shared footprint, rewritten
 * @ignore
 * @internal
 */
function footprintOf(sphere) {
	const d = Math.abs(sphere.radius) * 2;
	// `Ellipse.setShape` normalizes a zero-size shape into `NaN` ratios, the
	// same trap `Box3d._syncFootprint` floors its edges for. A zero-radius
	// sphere is a legal body shape, so the diameter is floored here too.
	return _footprint.setShape(
		sphere.pos.x,
		sphere.pos.y,
		Math.max(d, 0.000001),
		Math.max(d, 0.000001),
	);
}

/**
 * {@link Sphere} against a {@link Polygon} (so also a `Rect`, a `RoundRect`
 * and a `Line`), with the polygon **unbounded along Z**.
 *
 * The same degradation `Box3d` makes against a planar shape, and for the same
 * reason: a 2D world shape has no depth to resolve against, so it is read as
 * an infinitely extruded prism of its own outline and the pair reduces to the
 * ordinary 2D test. That is what lets a sphere body collide with a Tiled
 * collision layer, which is `Polygon` and `Rectangle` shapes and nothing else.
 *
 * `overlapZ` is left at `0` by construction, since only one participant has a
 * finite depth. Note the asymmetry with a sphere-vs-sphere or sphere-vs-box
 * contact, which DOES resolve along depth: give both sides a 3D shape when
 * the depth result is what you are after.
 * @param {Renderable} a - renderable owning the sphere
 * @param {Sphere} sphereA - the sphere
 * @param {Renderable} b - renderable owning the polygon
 * @param {Polygon} polyB - the polygon
 * @param {object} [response] - the response to write into
 * @returns {boolean} true when the two overlap
 * @ignore
 * @internal
 */
export function testSpherePolygon(a, sphereA, b, polyB, response) {
	return testEllipsePolygon(a, footprintOf(sphereA), b, polyB, response);
}

/**
 * Planar-shape-first form of {@link testSpherePolygon}.
 * @param {Renderable} a - renderable owning the polygon
 * @param {Polygon} polyA - the polygon
 * @param {Renderable} b - renderable owning the sphere
 * @param {Sphere} sphereB - the sphere
 * @param {object} [response] - the response to write into
 * @returns {boolean} true when the two overlap
 * @ignore
 * @internal
 */
export function testPolygonSphere(a, polyA, b, sphereB, response) {
	return testPolygonEllipse(a, polyA, b, footprintOf(sphereB), response);
}

/**
 * {@link Sphere} against an {@link Ellipse}, with the ellipse unbounded along
 * Z. See {@link testSpherePolygon}.
 * @param {Renderable} a - renderable owning the sphere
 * @param {Sphere} sphereA - the sphere
 * @param {Renderable} b - renderable owning the ellipse
 * @param {Ellipse} ellipseB - the ellipse
 * @param {object} [response] - the response to write into
 * @returns {boolean} true when the two overlap
 * @ignore
 * @internal
 */
export function testSphereEllipse(a, sphereA, b, ellipseB, response) {
	return testEllipseEllipse(a, footprintOf(sphereA), b, ellipseB, response);
}

/**
 * {@link Ellipse} against a {@link Sphere}, with the ellipse unbounded along
 * Z. See {@link testSpherePolygon}.
 * @param {Renderable} a - renderable owning the ellipse
 * @param {Ellipse} ellipseA - the ellipse
 * @param {Renderable} b - renderable owning the sphere
 * @param {Sphere} sphereB - the sphere
 * @param {object} [response] - the response to write into
 * @returns {boolean} true when the two overlap
 * @ignore
 * @internal
 */
export function testEllipseSphere(a, ellipseA, b, sphereB, response) {
	return testEllipseEllipse(a, ellipseA, b, footprintOf(sphereB), response);
}
