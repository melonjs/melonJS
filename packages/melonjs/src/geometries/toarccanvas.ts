import { degToRad, pow } from "../math/math.ts";

/**
 * @ignore
 */
function correctRadii(
	signedRx: number,
	signedRy: number,
	x1p: number,
	y1p: number,
) {
	const prx = Math.abs(signedRx);
	const pry = Math.abs(signedRy);

	const A = pow(x1p) / pow(prx) + pow(y1p) / pow(pry);

	const rx = A > 1 ? Math.sqrt(A) * prx : prx;
	const ry = A > 1 ? Math.sqrt(A) * pry : pry;

	return [rx, ry];
}

/**
 * @ignore
 */
function mat2DotVec2(
	[m00, m01, m10, m11]: [number, number, number, number],
	[vx, vy]: [number, number],
) {
	return [m00 * vx + m01 * vy, m10 * vx + m11 * vy] as [number, number];
}

/**
 * @ignore
 */
function vec2Add([ux, uy]: [number, number], [vx, vy]: [number, number]) {
	return [ux + vx, uy + vy];
}

/**
 * @ignore
 */
function vec2Scale([a0, a1]: [number, number], scalar: number) {
	return [a0 * scalar, a1 * scalar];
}

/**
 * @ignore
 */
function vec2Dot([ux, uy]: [number, number], [vx, vy]: [number, number]) {
	return ux * vx + uy * vy;
}

/**
 * @ignore
 */
function vec2Mag([ux, uy]: [number, number]) {
	return Math.sqrt(ux ** 2 + uy ** 2);
}

/**
 * @ignore
 */
function vec2Angle(u: [number, number], v: [number, number]) {
	const [ux, uy] = u;
	const [vx, vy] = v;
	const sign = ux * vy - uy * vx >= 0 ? 1 : -1;
	return sign * Math.acos(vec2Dot(u, v) / (vec2Mag(u) * vec2Mag(v)));
}

// From https://svgwg.org/svg2-draft/implnote.html#ArcConversionEndpointToCenter
/**
 * Converts endpoint parameterization of an SVG arc to center parameterization.
 *
 * This function calculates the center (cx, cy), radii (rx, ry), start angle,
 * end angle, x-axis rotation, and sweep flag (anticlockwise) of an SVG arc path
 * given its endpoint parameterization.
 * @param x1 - The x-coordinate of the start point of the arc.
 * @param y1 - The y-coordinate of the start point of the arc.
 * @param x2 - The x-coordinate of the end point of the arc.
 * @param y2 - The y-coordinate of the end point of the arc.
 * @param largeArcFlag - The large arc flag. If true, the arc sweep will be greater than 180 degrees.
 * @param sweepFlag - The sweep flag. If true, the arc will be drawn in a "positive-angle" direction.
 * @param srx - The x-axis radius of the arc.
 * @param sry - The y-axis radius of the arc.
 * @param xAxisRotationDeg - The rotation angle in degrees of the x-axis of the ellipse relative to the x-axis of the coordinate system.
 * @returns An object containing the center coordinates, radii, start and end angles, x-axis rotation, and sweep direction of an SVG arc given its endpoint parameters.
 */
export function endpointToCenterParameterization(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	largeArcFlag: boolean,
	sweepFlag: boolean,
	srx: number,
	sry: number,
	xAxisRotationDeg: number,
) {
	const xAxisRotation = degToRad(xAxisRotationDeg);

	const cosphi = Math.cos(xAxisRotation);
	const sinphi = Math.sin(xAxisRotation);

	const [x1p, y1p] = mat2DotVec2(
		[cosphi, sinphi, -sinphi, cosphi],
		[(x1 - x2) / 2, (y1 - y2) / 2],
	);

	const [rx, ry] = correctRadii(srx, sry, x1p, y1p);

	const sign = largeArcFlag !== sweepFlag ? 1 : -1;
	const n = pow(rx) * pow(ry) - pow(rx) * pow(y1p) - pow(ry) * pow(x1p);
	const d = pow(rx) * pow(y1p) + pow(ry) * pow(x1p);

	const [cxp, cyp] = vec2Scale(
		[(rx * y1p) / ry, (-ry * x1p) / rx],
		sign * Math.sqrt(Math.abs(n / d)),
	);

	const [cx, cy] = vec2Add(
		mat2DotVec2([cosphi, -sinphi, sinphi, cosphi], [cxp, cyp]),
		[(x1 + x2) / 2, (y1 + y2) / 2],
	);

	const a = [(x1p - cxp) / rx, (y1p - cyp) / ry] satisfies [number, number];
	const b = [(-x1p - cxp) / rx, (-y1p - cyp) / ry] satisfies [number, number];
	const startAngle = vec2Angle([1, 0], a);
	const deltaAngle0 = vec2Angle(a, b) % (2 * Math.PI);

	const deltaAngle =
		!sweepFlag && deltaAngle0 > 0
			? deltaAngle0 - 2 * Math.PI
			: sweepFlag && deltaAngle0 < 0
				? deltaAngle0 + 2 * Math.PI
				: deltaAngle0;

	const endAngle = startAngle + deltaAngle;

	return {
		cx,
		cy,
		rx,
		ry,
		startAngle,
		endAngle,
		xAxisRotation,
		anticlockwise: deltaAngle < 0,
	};
}
