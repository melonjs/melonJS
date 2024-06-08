/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import { degToRad, pow } from '../math/math.js';

function correctRadii(signedRx, signedRy, x1p, y1p) {
    const prx = Math.abs(signedRx);
    const pry = Math.abs(signedRy);

    const A = pow(x1p) / pow(prx) + pow(y1p) / pow(pry);

    const rx = A > 1 ? Math.sqrt(A) * prx : prx;
    const ry = A > 1 ? Math.sqrt(A) * pry : pry;

    return [rx, ry];
}

function mat2DotVec2([m00, m01, m10, m11], [vx, vy]) {
    return [m00 * vx + m01 * vy, m10 * vx + m11 * vy];
}

function vec2Add([ux, uy], [vx, vy]) {
    return [ux + vx, uy + vy];
}

function vec2Scale([a0, a1], scalar) {
    return [a0 * scalar, a1 * scalar];
}

function vec2Dot([ux, uy], [vx, vy]) {
    return ux * vx + uy * vy;
}

function vec2Mag([ux, uy]) {
    return Math.sqrt(ux ** 2 + uy ** 2);
}

function vec2Angle(u, v) {
    const [ux, uy] = u;
    const [vx, vy] = v;
    const sign = ux * vy - uy * vx >= 0 ? 1 : -1;
    return sign * Math.acos(vec2Dot(u, v) / (vec2Mag(u) * vec2Mag(v)));
}

// From https://svgwg.org/svg2-draft/implnote.html#ArcConversionEndpointToCenter
function endpointToCenterParameterization(x1, y1, x2, y2, largeArcFlag, sweepFlag, srx, sry, xAxisRotationDeg) {
    const xAxisRotation = degToRad(xAxisRotationDeg);

    const cosphi = Math.cos(xAxisRotation);
    const sinphi = Math.sin(xAxisRotation);

    const [x1p, y1p] = mat2DotVec2(
        [cosphi, sinphi, -sinphi, cosphi],
        [(x1 - x2) / 2, (y1 - y2) / 2]
    );

    const [rx, ry] = correctRadii(srx, sry, x1p, y1p);

    const sign = largeArcFlag !== sweepFlag ? 1 : -1;
    const n = pow(rx) * pow(ry) - pow(rx) * pow(y1p) - pow(ry) * pow(x1p);
    const d = pow(rx) * pow(y1p) + pow(ry) * pow(x1p);

    const [cxp, cyp] = vec2Scale(
        [(rx * y1p) / ry, (-ry * x1p) / rx],
        sign * Math.sqrt(Math.abs(n / d))
    );

    const [cx, cy] = vec2Add(
        mat2DotVec2([cosphi, -sinphi, sinphi, cosphi], [cxp, cyp]),
        [(x1 + x2) / 2, (y1 + y2) / 2]
    );

    const a = [(x1p - cxp) / rx, (y1p - cyp) / ry];
    const b = [(-x1p - cxp) / rx, (-y1p - cyp) / ry];
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
        anticlockwise: deltaAngle < 0
    };
}

export { endpointToCenterParameterization };
