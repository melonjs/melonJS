import {
	testEllipsePolygon,
	testPolygonEllipse,
	testPolygonPolygon,
} from "./sat.js";

/**
 * @import {Box3d} from "../../geometries/box3d.ts";
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
 */
function absCenter(renderable, box, out) {
	const anc = renderable.ancestor.getAbsolutePosition();
	out[0] = renderable.pos.x + anc.x + box.pos.x;
	out[1] = renderable.pos.y + anc.y + box.pos.y;
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

		// Smallest positive penetration wins. Ties resolve X → Y → Z, which
		// keeps a body resting on a floor being pushed straight up rather
		// than sideways out of a corner when two axes penetrate equally.
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
 */
export function testBox3dPolygon(a, boxA, b, polyB, response) {
	return testPolygonPolygon(a, boxA._footprint, b, polyB, response);
}

/**
 * Planar-shape-first form of {@link testBox3dPolygon}.
 * @ignore
 */
export function testPolygonBox3d(a, polyA, b, boxB, response) {
	return testPolygonPolygon(a, polyA, b, boxB._footprint, response);
}

/**
 * {@link Box3d} against an {@link Ellipse}, with the ellipse unbounded along
 * Z. See {@link testBox3dPolygon}.
 * @ignore
 */
export function testBox3dEllipse(a, boxA, b, ellipseB, response) {
	return testPolygonEllipse(a, boxA._footprint, b, ellipseB, response);
}

/**
 * {@link Ellipse} against a {@link Box3d}, with the ellipse unbounded along
 * Z. See {@link testBox3dPolygon}.
 * @ignore
 */
export function testEllipseBox3d(a, ellipseA, b, boxB, response) {
	return testEllipsePolygon(a, ellipseA, b, boxB._footprint, response);
}
