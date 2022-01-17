/*
* Separating Axis Theorem implementation, based on the SAT.js library by Jim Riecken <jimr@jimr.ca>
* Available under the MIT License - https://github.com/jriecken/sat-js
*/

import Vector2d from "./../math/vector2.js";

/**
 * Constants for Vornoi regions
 * @ignore
 */
var LEFT_VORNOI_REGION = -1;

/**
 * Constants for Vornoi regions
 * @ignore
 */
var MIDDLE_VORNOI_REGION = 0;

/**
 * Constants for Vornoi regions
 * @ignore
 */
var RIGHT_VORNOI_REGION = 1;


/**
 * A pool of `Vector` objects that are used in calculations to avoid allocating memory.
 * @type {Array.<me.Vector2d>}
 * @ignore
 */
var T_VECTORS = [];
for (var v = 0; v < 10; v++) { T_VECTORS.push(new Vector2d()); }

/**
 * A pool of arrays of numbers used in calculations to avoid allocating memory.
 * @type {Array.<Array.<number>>}
 * @ignore
 */
var T_ARRAYS = [];
for (var a = 0; a < 5; a++) { T_ARRAYS.push([]); }


/**
 * Flattens the specified array of points onto a unit vector axis,
 * resulting in a one dimensional range of the minimum and
 * maximum value on that axis.
 * @ignore
 * @param {Array.<me.Vector2d>} points The points to flatten.
 * @param {me.Vector2d} normal The unit vector axis to flatten on.
 * @param {Array.<number>} result An array.  After calling this function,
 *   result[0] will be the minimum value,
 *   result[1] will be the maximum value.
 */
function flattenPointsOn(points, normal, result) {
    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    var len = points.length;
    for (var i = 0; i < len; i++) {
        // The magnitude of the projection of the point onto the normal
        var dot = points[i].dot(normal);
        if (dot < min) { min = dot; }
        if (dot > max) { max = dot; }
    }
    result[0] = min;
    result[1] = max;
}

/**
 * Check whether two convex polygons are separated by the specified
 * axis (must be a unit vector).
 * @ignore
 * @param {me.Vector2d} aPos The position of the first polygon.
 * @param {me.Vector2d} bPos The position of the second polygon.
 * @param {Array.<me.Vector2d>} aPoints The points in the first polygon.
 * @param {Array.<me.Vector2d>} bPoints The points in the second polygon.
 * @param {me.Vector2d} axis The axis (unit sized) to test against.  The points of both polygons
 *   will be projected onto this axis.
 * @param {Response=} response A Response object (optional) which will be populated
 *   if the axis is not a separating axis.
 * @returns {boolean} true if it is a separating axis, false otherwise.  If false,
 *   and a response is passed in, information about how much overlap and
 *   the direction of the overlap will be populated.
 */
function isSeparatingAxis(aPos, bPos, aPoints, bPoints, axis, response) {
    var rangeA = T_ARRAYS.pop();
    var rangeB = T_ARRAYS.pop();
    // The magnitude of the offset between the two polygons
    var offsetV = T_VECTORS.pop().copy(bPos).sub(aPos);
    var projectedOffset = offsetV.dot(axis);

    // Project the polygons onto the axis.
    flattenPointsOn(aPoints, axis, rangeA);
    flattenPointsOn(bPoints, axis, rangeB);
    // Move B's range to its position relative to A.
    rangeB[0] += projectedOffset;
    rangeB[1] += projectedOffset;
    // Check if there is a gap. If there is, this is a separating axis and we can stop
    if (rangeA[0] > rangeB[1] || rangeB[0] > rangeA[1]) {
        T_VECTORS.push(offsetV);
        T_ARRAYS.push(rangeA);
        T_ARRAYS.push(rangeB);
        return true;
    }

    // This is not a separating axis. If we're calculating a response, calculate the overlap.
    if (response) {
        var overlap = 0;
        // A starts further left than B
        if (rangeA[0] < rangeB[0]) {
            response.aInB = false;
            // A ends before B does. We have to pull A out of B
            if (rangeA[1] < rangeB[1]) {
                overlap = rangeA[1] - rangeB[0];
                response.bInA = false;
            // B is fully inside A.  Pick the shortest way out.
            } else {
                var option1 = rangeA[1] - rangeB[0];
                var option2 = rangeB[1] - rangeA[0];
                overlap = option1 < option2 ? option1 : -option2;
            }
        // B starts further left than A
        } else {
            response.bInA = false;
            // B ends before A ends. We have to push A out of B
            if (rangeA[1] > rangeB[1]) {
                overlap = rangeA[0] - rangeB[1];
                response.aInB = false;
            // A is fully inside B.  Pick the shortest way out.
            } else {
                var option11 = rangeA[1] - rangeB[0];
                var option22 = rangeB[1] - rangeA[0];
                overlap = option11 < option22 ? option11 : -option22;
            }
        }

        // If this is the smallest amount of overlap we've seen so far, set it as the minimum overlap.
        var absOverlap = Math.abs(overlap);
        if (absOverlap < response.overlap) {
            response.overlap = absOverlap;
            response.overlapN.copy(axis);
            if (overlap < 0) {
                response.overlapN.negateSelf();
            }
        }
    }
    T_VECTORS.push(offsetV);
    T_ARRAYS.push(rangeA);
    T_ARRAYS.push(rangeB);
    return false;
}


/**
 * Calculates which Vornoi region a point is on a line segment. <br>
 * It is assumed that both the line and the point are relative to `(0,0)`<br>
 * <pre>
 *             |       (0)      |
 *      (-1)  [S]--------------[E]  (1)
 *             |       (0)      |
 * </pre>
 *
 * @ignore
 * @param {me.Vector2d} line The line segment.
 * @param {me.Vector2d} point The point.
 * @returns  {number} LEFT_VORNOI_REGION (-1) if it is the left region,
 *          MIDDLE_VORNOI_REGION (0) if it is the middle region,
 *          RIGHT_VORNOI_REGION (1) if it is the right region.
 */
function vornoiRegion(line, point) {
    var len2 = line.length2();
    var dp = point.dot(line);
    if (dp < 0) {
        // If the point is beyond the start of the line, it is in the
        // left vornoi region.
        return LEFT_VORNOI_REGION;
    } else if (dp > len2) {
        // If the point is beyond the end of the line, it is in the
        // right vornoi region.
        return RIGHT_VORNOI_REGION;
    } else {
        // Otherwise, it's in the middle one.
        return MIDDLE_VORNOI_REGION;
    }
}

/**
 * Checks whether polygons collide.
 * @ignore
 * @param {me.Renderable} a a reference to the object A.
 * @param {me.Polygon} polyA a reference to the object A Polygon to be tested
 * @param {me.Renderable} b a reference to the object B.
 * @param {me.Polygon} polyB a reference to the object B Polygon to be tested
 * @param {Response=} response Response object (optional) that will be populated if they intersect.
 * @returns {boolean} true if they intersect, false if they don't.
 */
export function testPolygonPolygon(a, polyA, b, polyB, response) {
    // specific point for
    var aPoints = polyA.points;
    var aNormals = polyA.normals;
    var aLen = aNormals.length;
    var bPoints = polyB.points;
    var bNormals = polyB.normals;
    var bLen = bNormals.length;
    // aboslute shape position
    var posA = T_VECTORS.pop().copy(a.pos).add(a.ancestor.getAbsolutePosition()).add(polyA.pos);
    var posB = T_VECTORS.pop().copy(b.pos).add(b.ancestor.getAbsolutePosition()).add(polyB.pos);
    var i;

    // If any of the edge normals of A is a separating axis, no intersection.
    for (i = 0; i < aLen; i++) {
        if (isSeparatingAxis(posA, posB, aPoints, bPoints, aNormals[i], response)) {
            T_VECTORS.push(posA);
            T_VECTORS.push(posB);
            return false;
        }
    }

    // If any of the edge normals of B is a separating axis, no intersection.
    for (i = 0; i < bLen; i++) {
        if (isSeparatingAxis(posA, posB, aPoints, bPoints, bNormals[i], response)) {
            T_VECTORS.push(posA);
            T_VECTORS.push(posB);
            return false;
        }
    }

    // Since none of the edge normals of A or B are a separating axis, there is an intersection
    // and we've already calculated the smallest overlap (in isSeparatingAxis).  Calculate the
    // final overlap vector.
    if (response) {
        response.a = a;
        response.b = b;
        response.overlapV.copy(response.overlapN).scale(response.overlap);
    }
    T_VECTORS.push(posA);
    T_VECTORS.push(posB);
    return true;
}

/**
 * Check if two Ellipse collide.
 * @ignore
 * @param {me.Renderable} a a reference to the object A.
 * @param {me.Ellipse} ellipseA a reference to the object A Ellipse to be tested
 * @param {me.Renderable} b a reference to the object B.
 * @param {me.Ellipse} ellipseB a reference to the object B Ellipse to be tested
 * @param {Response=} response Response object (optional) that will be populated if
 *   the circles intersect.
 * @returns {boolean} true if the circles intersect, false if they don't.
 */
export function testEllipseEllipse(a, ellipseA, b, ellipseB, response) {
    // Check if the distance between the centers of the two
    // circles is greater than their combined radius.
    var differenceV = T_VECTORS.pop().copy(b.pos).add(b.ancestor.getAbsolutePosition()).add(ellipseB.pos)
        .sub(a.pos).add(a.ancestor.getAbsolutePosition()).sub(ellipseA.pos);
    var radiusA = ellipseA.radius;
    var radiusB = ellipseB.radius;
    var totalRadius = radiusA + radiusB;
    var totalRadiusSq = totalRadius * totalRadius;
    var distanceSq = differenceV.length2();
    // If the distance is bigger than the combined radius, they don't intersect.
    if (distanceSq > totalRadiusSq) {
        T_VECTORS.push(differenceV);
        return false;
    }
    // They intersect.  If we're calculating a response, calculate the overlap.
    if (response) {
        var dist = Math.sqrt(distanceSq);
        response.a = a;
        response.b = b;
        response.overlap = totalRadius - dist;
        response.overlapN.copy(differenceV.normalize());
        response.overlapV.copy(differenceV).scale(response.overlap);
        response.aInB = radiusA <= radiusB && dist <= radiusB - radiusA;
        response.bInA = radiusB <= radiusA && dist <= radiusA - radiusB;
    }
    T_VECTORS.push(differenceV);
    return true;
}

/**
 * Check if a polygon and an ellipse collide.
 * @ignore
 * @param {me.Renderable} a a reference to the object A.
 * @param {me.Polygon} polyA a reference to the object A Polygon to be tested
 * @param {me.Renderable} b a reference to the object B.
 * @param {me.Ellipse} ellipseB a reference to the object B Ellipse to be tested
 * @param {Response=} response Response object (optional) that will be populated if they intersect.
 * @returns {boolean} true if they intersect, false if they don't.
 */
export function testPolygonEllipse(a, polyA, b, ellipseB, response) {
    // Get the position of the circle relative to the polygon.
    var circlePos = T_VECTORS.pop().copy(b.pos).add(b.ancestor.getAbsolutePosition()).add(ellipseB.pos)
        .sub(a.pos).add(a.ancestor.getAbsolutePosition()).sub(polyA.pos);
    var radius = ellipseB.radius;
    var radius2 = radius * radius;
    var points = polyA.points;
    var edges = polyA.edges;
    var len = edges.length;
    var edge = T_VECTORS.pop();
    var normal = T_VECTORS.pop();
    var point = T_VECTORS.pop();
    var dist = 0;

    // For each edge in the polygon:
    for (var i = 0; i < len; i++) {
        var next = i === len - 1 ? 0 : i + 1;
        var prev = i === 0 ? len - 1 : i - 1;
        var overlap = 0;
        var overlapN = null;

        // Get the edge.
        edge.copy(edges[i]);
        // Calculate the center of the circle relative to the starting point of the edge.
        point.copy(circlePos).sub(points[i]);

        // If the distance between the center of the circle and the point
        // is bigger than the radius, the polygon is definitely not fully in
        // the circle.
        if (response && point.length2() > radius2) {
            response.aInB = false;
        }

        // Calculate which Vornoi region the center of the circle is in.
        var region = vornoiRegion(edge, point);
        var inRegion = true;
        // If it's the left region:
        if (region === LEFT_VORNOI_REGION) {
            var point2 = null;
            if (len > 1) {
                // We need to make sure we're in the RIGHT_VORNOI_REGION of the previous edge.
                edge.copy(edges[prev]);
                // Calculate the center of the circle relative the starting point of the previous edge
                point2 = T_VECTORS.pop().copy(circlePos).sub(points[prev]);
                region = vornoiRegion(edge, point2);
                if (region !== RIGHT_VORNOI_REGION) {
                    inRegion = false;
                }
            }

            if (inRegion) {
                // It's in the region we want.  Check if the circle intersects the point.
                dist = point.length();
                if (dist > radius) {
                    // No intersection
                    T_VECTORS.push(circlePos);
                    T_VECTORS.push(edge);
                    T_VECTORS.push(normal);
                    T_VECTORS.push(point);
                    if (point2) {
                        T_VECTORS.push(point2);
                    }
                    return false;
                } else if (response) {
                    // It intersects, calculate the overlap.
                    response.bInA = false;
                    overlapN = point.normalize();
                    overlap = radius - dist;
                }
            }

            if (point2) {
                T_VECTORS.push(point2);
            }
        // If it's the right region:
        } else if (region === RIGHT_VORNOI_REGION) {
            if (len > 1) {
                // We need to make sure we're in the left region on the next edge
                edge.copy(edges[next]);
                // Calculate the center of the circle relative to the starting point of the next edge.
                point.copy(circlePos).sub(points[next]);
                region = vornoiRegion(edge, point);
                if (region !== LEFT_VORNOI_REGION) {
                    inRegion = false;
                }
            }

            if (inRegion) {
                // It's in the region we want.  Check if the circle intersects the point.
                dist = point.length();
                if (dist > radius) {
                    // No intersection
                    T_VECTORS.push(circlePos);
                    T_VECTORS.push(edge);
                    T_VECTORS.push(normal);
                    T_VECTORS.push(point);
                    return false;
                } else if (response) {
                    // It intersects, calculate the overlap.
                    response.bInA = false;
                    overlapN = point.normalize();
                    overlap = radius - dist;
                }
            }
        // Otherwise, it's the middle region:
        } else {
            // Need to check if the circle is intersecting the edge,
            // Get the normal.
            normal.copy(polyA.normals[i]);
            // Find the perpendicular distance between the center of the
            // circle and the edge.
            dist = point.dot(normal);
            var distAbs = Math.abs(dist);
            // If the circle is on the outside of the edge, there is no intersection.
            if ((len === 1 || dist > 0) && distAbs > radius) {
                // No intersection
                T_VECTORS.push(circlePos);
                T_VECTORS.push(edge);
                T_VECTORS.push(normal);
                T_VECTORS.push(point);
                return false;
            } else if (response) {
                // It intersects, calculate the overlap.
                overlapN = normal;
                overlap = radius - dist;
                // If the center of the circle is on the outside of the edge, or part of the
                // circle is on the outside, the circle is not fully inside the polygon.
                if (dist >= 0 || overlap < 2 * radius) {
                    response.bInA = false;
                }
            }
        }

        // If this is the smallest overlap we've seen, keep it.
        // (overlapN may be null if the circle was in the wrong Vornoi region).
        if (overlapN && response && Math.abs(overlap) < Math.abs(response.overlap)) {
            response.overlap = overlap;
            response.overlapN.copy(overlapN);
        }
    }

    // Calculate the final overlap vector - based on the smallest overlap.
    if (response) {
        response.a = a;
        response.b = b;
        response.overlapV.copy(response.overlapN).scale(response.overlap);
    }
    T_VECTORS.push(circlePos);
    T_VECTORS.push(edge);
    T_VECTORS.push(normal);
    T_VECTORS.push(point);
    return true;
}

/**
 * Check if an ellipse and a polygon collide. <br>
 * **NOTE:** This is slightly less efficient than testPolygonEllipse as it just
 * runs testPolygonEllipse and reverses the response at the end.
 * @ignore
 * @param {me.Renderable} a a reference to the object A.
 * @param {me.Ellipse} ellipseA a reference to the object A Ellipse to be tested
 * @param {me.Renderable} b a reference to the object B.
 * @param {me.Polygon} polyB a reference to the object B Polygon to be tested
 * @param {Response=} response Response object (optional) that will be populated if
 *   they intersect.
 * @returns {boolean} true if they intersect, false if they don't.
 */
export function testEllipsePolygon(a, ellipseA, b, polyB, response) {
    // Test the polygon against the circle.
    var result = this.testPolygonEllipse(b, polyB, a, ellipseA, response);
    if (result && response) {
        // Swap A and B in the response.
        var resa = response.a;
        var aInB = response.aInB;
        response.overlapN.negateSelf();
        response.overlapV.negateSelf();
        response.a = response.b;
        response.b = resa;
        response.aInB = response.bInA;
        response.bInA = aInB;
    }
    return result;
}
