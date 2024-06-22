/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import pool from '../system/pooling.js';
import { TAU } from '../math/math.js';
import earcut from '../node_modules/earcut/src/earcut.js';
import { endpointToCenterParameterization } from './toarccanvas.js';

/**
 * additional import for TypeScript
 * @import Point from "./point.js";
 */

/**
 * @classdesc
 * a simplified path2d implementation, supporting only one path
 */
class Path2D {
    constructor(svgPath) {
        /**
         * the points defining the current path
         * @type {Point[]}
         */
        this.points = [];

        /**
         * space between interpolated points for quadratic and bezier curve approx. in pixels.
         * @type {number}
         * @default 5
         */
        this.arcResolution = 5;

        /* @ignore */
        this.vertices = [];

        /* @ignore */
        this.startPoint = pool.pull("Point");

        /* @ignore */
        this.isDirty = false;

        if (typeof svgPath === "string") {
            this.parseSVGPath(svgPath);
        }
    }

    /**
     * Parses an SVG path string and adds the points to the current path.
     * @param {string} svgPath - The SVG path string to parse.
     */
    parseSVGPath(svgPath) {
        // Split path into commands and coordinates
        const pathCommands = svgPath.match(/([a-df-z])[^a-df-z]*/gi);
        const points = this.points;
        const startPoint = this.startPoint;
        let lastPoint = startPoint;

        this.beginPath();

        // Process each command and corresponding coordinates
        for (let i = 0; i < pathCommands.length; i++) {
            const pathCommand = pathCommands[i];
            const command = pathCommand[0].toUpperCase();
            const coordinates = pathCommand.slice(1).trim().split(/[\s,]+/).map(parseFloat);

            switch (command) {
                case "A": {
                    // A command takes 5 coordinates
                    const p = endpointToCenterParameterization(...coordinates);
                    this.arc(p.x, p.y, p.radiusX, p.radiusY, p.rotation, p.startAngle, p.endAngle, p.applyanticlockwise);
                }
                    break;
                case "H":
                    // H take 1 coordinate
                    lastPoint = points.length === 0 ? startPoint : points[points.length - 1];
                    this.lineTo(lastPoint.x + coordinates[0], lastPoint.y);
                    break;
                case "V":
                    // V take 1 coordinate
                    lastPoint = points.length === 0 ? startPoint : points[points.length - 1];
                    this.lineTo(lastPoint.x, lastPoint.y + coordinates[0]);
                    break;
                case "M":
                    // M takes 2 coordinates
                    this.moveTo(...coordinates);
                    break;
                case "L":
                    // L takes 2 coordinates
                    this.lineTo(...coordinates);
                    break;
                case "Q":
                    // Q takes 4 coordinates
                    this.quadraticCurveTo(...coordinates);
                    break;
                case "C":
                    // C takes 6 coordinates
                    this.bezierCurveTo(...coordinates);
                    break;
                case "Z":
                    this.closePath();
                    break;
                default:
                    console.warn("Unsupported command:", command);
                    break;
            }
        }
    }


    /**
     * begin a new path
     */
    beginPath() {
        // empty the cache and recycle all vectors
        this.points.forEach((point) => {
            pool.push(point);
        });
        this.isDirty = true;
        this.points.length = 0;
        this.startPoint.set(0, 0);
    }

    /**
     * causes the point of the pen to move back to the start of the current path.
     * It tries to draw a straight line from the current point to the start.
     * If the shape has already been closed or has only one point, this function does nothing.
     */
    closePath() {
        let points = this.points;
        if (points.length > 0) {
            let firstPoint = points[0];
            if (!firstPoint.equals(points[points.length - 1])) {
                this.lineTo(firstPoint.x, firstPoint.y);
            }
            this.isDirty = true;
        }
    }

    /**
     * triangulate the shape defined by this path into an array of triangles
     * @returns {Point[]} an array of vertices representing the triangulated path or shape
     */
    triangulatePath() {
        let vertices = this.vertices;

        if (this.isDirty) {
            let points = this.points;
            let indices = earcut(points.flatMap(p => [p.x, p.y]));
            let indicesLength = indices.length;

            // pre-allocate vertices if necessary
            while (vertices.length < indicesLength) {
                vertices.push(pool.pull("Point"));
            }

            // calculate all vertices
            for (let i = 0; i < indicesLength; i++) {
                let point = points[indices[i]];
                vertices[i].set(point.x, point.y);
            }

            // recycle overhead from a previous triangulation
            while (vertices.length > indicesLength) {
                pool.push(vertices[vertices.length - 1]);
                vertices.length -= 1;
            }
            this.isDirty = false;
        }

        return vertices;
    }

    /**
     * moves the starting point of the current path to the (x, y) coordinates.
     * @param {number} x - the x-axis (horizontal) coordinate of the point.
     * @param {number} y - the y-axis (vertical) coordinate of the point.
     */
    moveTo(x, y) {
        this.startPoint.set(x, y);
        this.isDirty = true;
    }

    /**
     * connects the last point in the current path to the (x, y) coordinates with a straight line.
     * @param {number} x - the x-axis coordinate of the line's end point.
     * @param {number} y - the y-axis coordinate of the line's end point.
     */
    lineTo(x, y) {
        let points = this.points;
        let startPoint = this.startPoint;
        let lastPoint = points.length === 0 ? startPoint : points[points.length - 1];

        if (!startPoint.equals(lastPoint)) {
            points.push(pool.pull("Point", startPoint.x, startPoint.y));
        } else {
            points.push(pool.pull("Point", lastPoint.x, lastPoint.y));
        }
        points.push(pool.pull("Point", x, y));

        startPoint.x = x;
        startPoint.y = y;

        this.isDirty = true;
    }

    /**
     * adds an arc to the current path which is centered at (x, y) position with the given radius,
     * starting at startAngle and ending at endAngle going in the given direction by counterclockwise (defaulting to clockwise).
     * @param {number} x - the horizontal coordinate of the arc's center.
     * @param {number} y - the vertical coordinate of the arc's center.
     * @param {number} radius - the arc's radius. Must be positive.
     * @param {number} startAngle - the angle at which the arc starts in radians, measured from the positive x-axis.
     * @param {number} endAngle - the angle at which the arc ends in radians, measured from the positive x-axis.
     * @param {boolean} [anticlockwise=false] - an optional boolean value. If true, draws the arc counter-clockwise between the start and end angles.
     */
    arc(x, y, radius, startAngle, endAngle, anticlockwise = false) {
        // based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
        //bring angles all in [0, 2*PI] range
        if (startAngle === endAngle) return;
        const fullCircle = anticlockwise ? Math.abs(startAngle - endAngle) >= (TAU) : Math.abs(endAngle - startAngle) >= (TAU);

        startAngle = startAngle % (TAU);
        endAngle = endAngle % (TAU);

        if (startAngle < 0) startAngle += TAU;
        if (endAngle < 0) endAngle += TAU;

        if (startAngle >= endAngle) {
            endAngle += TAU;
        }

        let diff = endAngle - startAngle;
        let direction = 1;
        if (anticlockwise) {
            direction = -1;
            diff = TAU - diff;
        }

        if (fullCircle) diff = TAU;

        const length = diff * radius;
        const nr_of_interpolation_points = length / this.arcResolution;
        const dangle = diff / nr_of_interpolation_points;
        const angleStep = dangle * direction;

        this.moveTo(x + radius * Math.cos(startAngle), y + radius * Math.sin(startAngle));

        let angle = startAngle;
        for (let j = 0; j < nr_of_interpolation_points; j++) {
            this.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
            angle += angleStep;
        }

        this.lineTo(x + radius * Math.cos(endAngle), y + radius * Math.sin(endAngle));

        this.isDirty = true;
    }

    /**
     * adds a circular arc to the path with the given control points and radius, connected to the previous point by a straight line.
     * @param {number} x1 - the x-axis coordinate of the first control point.
     * @param {number} y1 - the y-axis coordinate of the first control point.
     * @param {number} x2 - the x-axis coordinate of the second control point.
     * @param {number} y2 - the y-axis coordinate of the second control point.
     * @param {number} radius - the arc's radius. Must be positive.
     */
    arcTo(x1, y1, x2, y2, radius) {
        let points = this.points;
        let startPoint = this.startPoint;
        let lastPoint = points.length === 0 ? startPoint : points[points.length - 1];

        // based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
        let x0 = lastPoint.x, y0 = lastPoint.y;
        //a = -incoming vector, b = outgoing vector to x1, y1
        let a0 = x0 - x1, a1 = y0 - y1;
        let b0 = x2 - x1, b1 = y2 - y1;

        //normalize
        let l_a = Math.sqrt(Math.pow(a0, 2) + Math.pow(a1, 2));
        let l_b = Math.sqrt(Math.pow(b0, 2) + Math.pow(b1, 2));
        a0 /= l_a; a1 /= l_a; b0 /= l_b; b1 /= l_b;
        let angle = Math.atan2(a1, a0) - Math.atan2(b1, b0);

        //work out tangent points using tan(θ) = opposite / adjacent; angle/2 because hypotenuse is the bisection of a,b
        let tan_angle_div2 = Math.tan(angle / 2);
        let adj_l = (radius / tan_angle_div2);

        let tangent1_pointx = x1 + a0 * adj_l, tangent1_pointy = y1 + a1 * adj_l;
        let tangent2_pointx = x1 + b0 * adj_l, tangent2_pointy = y1 + b1 * adj_l;

        this.moveTo(tangent1_pointx, tangent1_pointy);

        let bisec0 = (a0 + b0) / 2.0, bisec1 = (a1 + b1) / 2.0;
        let bisec_l = Math.sqrt(Math.pow(bisec0, 2) + Math.pow(bisec1, 2));
        bisec0 /= bisec_l; bisec1 /= bisec_l;

        let hyp_l = Math.sqrt(Math.pow(radius, 2) + Math.pow(adj_l, 2));
        let centerx = x1 + hyp_l * bisec0, centery = y1 + hyp_l * bisec1;

        let startAngle = Math.atan2(tangent1_pointy - centery, tangent1_pointx - centerx);
        let endAngle = Math.atan2(tangent2_pointy - centery, tangent2_pointx - centerx);

        this.arc(centerx, centery, radius, startAngle, endAngle);
    }

    /**
     * adds an elliptical arc to the path which is centered at (x, y) position with the radii radiusX and radiusY
     * starting at startAngle and ending at endAngle going in the given direction by counterclockwise.
     * @param {number} x - the x-axis (horizontal) coordinate of the ellipse's center.
     * @param {number} y - the  y-axis (vertical) coordinate of the ellipse's center.
     * @param {number} radiusX - the ellipse's major-axis radius. Must be non-negative.
     * @param {number} radiusY - the ellipse's minor-axis radius. Must be non-negative.
     * @param {number} rotation - the rotation of the ellipse, expressed in radians.
     * @param {number} startAngle - the angle at which the ellipse starts, measured clockwise from the positive x-axis and expressed in radians.
     * @param {number} endAngle - the angle at which the ellipse ends, measured clockwise from the positive x-axis and expressed in radians.
     * @param {boolean} [anticlockwise=false] - an optional boolean value which, if true, draws the ellipse counterclockwise (anticlockwise).
     */
    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise = false) {
        // based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
        if (startAngle === endAngle) return;
        let fullCircle = anticlockwise ? Math.abs(startAngle - endAngle) >= (TAU) : Math.abs(endAngle - startAngle) >= (TAU);

        //bring angles all in [0, 2*PI] range
        startAngle = startAngle % (TAU);
        endAngle = endAngle % (TAU);
        if (startAngle < 0) startAngle += TAU;
        if (endAngle < 0) endAngle += TAU;

        if (startAngle >= endAngle) {
            endAngle += TAU;
        }

        let diff = endAngle - startAngle;

        let direction = 1;
        if (anticlockwise) {
            direction = -1;
            diff = TAU - diff;
        }

        if (fullCircle) diff = TAU;

        const length = (diff * radiusX + diff * radiusY) / 2;
        const nr_of_interpolation_points = length / this.arcResolution;
        const dangle = diff / nr_of_interpolation_points;
        const angleStep = dangle * direction;

        let angle = startAngle;
        const cos_rotation = Math.cos(rotation);
        const sin_rotation = Math.sin(rotation);

        this.moveTo(x + radiusX * Math.cos(startAngle), y + radiusY * Math.sin(startAngle));

        for (let j = 0; j < nr_of_interpolation_points; j++) {
            const _x1 = radiusX * Math.cos(angle);
            const _y1 = radiusY * Math.sin(angle);
            const _x2 = x + _x1 * cos_rotation - _y1 * sin_rotation;
            const _y2 = y + _x1 * sin_rotation + _y1 * cos_rotation;
            this.lineTo(_x2, _y2);
            angle += angleStep;
        }
        // close the ellipse
        this.lineTo(x + radiusX * Math.cos(startAngle), y + radiusY * Math.sin(startAngle));
        this.isDirty = true;
    }

    /**
     * Adds a quadratic Bézier curve to the path.
     * @param {number} cpX - The x-coordinate of the control point.
     * @param {number} cpY - The y-coordinate of the control point.
     * @param {number} x - The x-coordinate of the end point of the curve.
     * @param {number} y - The y-coordinate of the end point of the curve.
     */
    quadraticCurveTo(cpX, cpY, x, y) {
        const points = this.points;
        const startPoint = this.startPoint;
        const lastPoint = points.length === 0 ? startPoint : points[points.length - 1];
        const endPoint = pool.pull("Point").set(x, y);
        const controlPoint = pool.pull("Point").set(cpX, cpY);
        const resolution = this.arcResolution;

        const t = 1 / resolution;
        for (let i = 1; i <= resolution; i++) {
            this.lineTo(
                lastPoint.x * Math.pow(1 - t * i, 2) + controlPoint.x * 2 * (1 - t * i) * t * i + endPoint.x * Math.pow(t * i, 2),
                lastPoint.y * Math.pow(1 - t * i, 2) + controlPoint.y * 2 * (1 - t * i) * t * i + endPoint.y * Math.pow(t * i, 2)
            );
        }
        pool.push(endPoint, controlPoint);
        this.isDirty = true;
    }

    /**
     * Adds a cubic Bézier curve to the path.
     * @param {number} cp1X - The x-coordinate of the first control point.
     * @param {number} cp1Y - The y-coordinate of the first control point.
     * @param {number} cp2X - The x-coordinate of the second control point.
     * @param {number} cp2Y - The y-coordinate of the second control point.
     * @param {number} x - The x-coordinate of the end point of the curve.
     * @param {number} y - The y-coordinate of the end point of the curve.
     */
    bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, x, y) {
        const points = this.points;
        const startPoint = this.startPoint;
        const lastPoint = points.length === 0 ? startPoint : points[points.length - 1];
        const endPoint = pool.pull("Point").set(x, y);
        const controlPoint1 = pool.pull("Point").set(cp1X, cp1Y);
        const controlPoint2 = pool.pull("Point").set(cp2X, cp2Y);
        const resolution = this.arcResolution;

        const t = 1 / resolution;
        for (let i = 1; i <= resolution; i++) {
            this.lineTo(
                lastPoint.x * Math.pow(1 - t * i, 3) + controlPoint1.x * 3 * Math.pow(1 - t * i, 2) * t * i + controlPoint2.x * 3 * (1 - t * i) * Math.pow(t * i, 2) + endPoint.x * Math.pow(t * i, 3),
                lastPoint.y * Math.pow(1 - t * i, 3) + controlPoint1.y * 3 * Math.pow(1 - t * i, 2) * t * i + controlPoint2.y * 3 * (1 - t * i) * Math.pow(t * i, 2) + endPoint.y * Math.pow(t * i, 3)
            );
        }

        pool.push(endPoint, controlPoint1, controlPoint2);
        this.isDirty = true;
    }

    /**
     * creates a path for a rectangle at position (x, y) with a size that is determined by width and height.
     * @param {number} x - the x-axis coordinate of the rectangle's starting point.
     * @param {number} y - the y-axis coordinate of the rectangle's starting point.
     * @param {number} width - the rectangle's width. Positive values are to the right, and negative to the left.
     * @param {number} height - the rectangle's height. Positive values are down, and negative are up.
     */
    rect(x, y, width, height) {
        this.moveTo(x, y);
        this.lineTo(x + width, y);

        this.moveTo(x + width, y);
        this.lineTo(x + width, y + height);

        this.moveTo(x + width, y + height);
        this.lineTo(x, y + height);

        this.moveTo(x, y + height);
        this.lineTo(x, y);

        this.isDirty = true;
    }

    /**
     * adds an rounded rectangle to the current path.
     * @param {number} x - the x-axis coordinate of the rectangle's starting point.
     * @param {number} y - the y-axis coordinate of the rectangle's starting point.
     * @param {number} width - the rectangle's width. Positive values are to the right, and negative to the left.
     * @param {number} height - the rectangle's height. Positive values are down, and negative are up.
     * @param {number} radius - the arc's radius to draw the borders. Must be positive.
     */
    roundRect(x, y, width, height, radius) {
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.arcTo(x + width, y, x + width, y + radius, radius);

        this.moveTo(x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.arcTo(x + width, y + height, x + width - radius, y + height, radius);

        this.moveTo(x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.arcTo(x, y + height, x, y + height - radius, radius);

        this.moveTo(x, y + height - radius);
        this.lineTo(x, y + radius);
        this.arcTo(x, y, x + radius, y, radius);

        this.isDirty = true;
    }
}

export { Path2D as default };
