import pool from "./../system/pooling.js";
import { TAU } from "./../math/math.js";
import earcut from "earcut";

/**
 * @classdesc
 * a simplified path2d implementation, supporting only one path
 */
 export default class Path2D {
    constructor() {
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
    }

    /**
     * begin a new path
     */
    beginPath() {
        // empty the cache and recycle all vectors
        this.points.forEach((point) => {
            pool.push(point);
        });
        this.points.length = 0;
    }

    /**
     * causes the point of the pen to move back to the start of the current path.
     * It tries to draw a straight line from the current point to the start.
     * If the shape has already been closed or has only one point, this function does nothing.
     */
    closePath() {
        let points = this.points;
        if (points.length > 1 && !points[points.length-1].equals(points[0])) {
            points.push(pool.pull("Point", points[0].x, points[0].y));
        }
    }

    /**
     * triangulate the shape defined by this path into an array of triangles
     * @returns {Point[]}
     */
    triangulatePath() {
        let i = 0;
        let points = this.points;
        let vertices = this.vertices;
        let indices = earcut(points.flatMap(p => [p.x, p.y]));

        // pre-allocate vertices if necessary
        while (vertices.length < indices.length) {
            vertices.push(pool.pull("Point"));
        }

        // calculate all vertices
        for (i = 0; i < indices.length; i++ ) {
            let point = points[indices[i]];
            vertices[i].set(point.x, point.y);
        }

        // recycle overhead from a previous triangulation
        while (vertices.length > indices.length) {
            pool.push(vertices[vertices.length-1]);
            vertices.length -= 1;
        }

        return vertices;
    }

    /**
     * moves the starting point of the current path to the (x, y) coordinates.
     * @param {number} x - the x-axis (horizontal) coordinate of the point.
     * @param {number} y - the y-axis (vertical) coordinate of the point.
     */
    moveTo(x, y) {
      this.points.push(pool.pull("Point", x, y));
    }

    /**
     * connects the last point in the current patch to the (x, y) coordinates with a straight line.
     * @param {number} x - the x-axis coordinate of the line's end point.
     * @param {number} y - the y-axis coordinate of the line's end point.
     */
    lineTo(x, y) {
        this.points.push(pool.pull("Point", x, y));
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
        let points = this.points;
        // based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
        //bring angles all in [0, 2*PI] range
        if (startAngle === endAngle) return;
        const fullCircle = anticlockwise ? Math.abs(startAngle-endAngle) >= (TAU) : Math.abs(endAngle-startAngle) >= (TAU);

        startAngle = startAngle % (TAU);
        endAngle = endAngle % (TAU);

        if (startAngle < 0) startAngle += TAU;
        if (endAngle < 0) endAngle += TAU;

        if (startAngle >= endAngle) {
            endAngle+= TAU;
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

        let angle = startAngle;
        for (let j = 0; j < nr_of_interpolation_points; j++) {
            points.push(pool.pull("Point", x + radius * Math.cos(angle), y + radius * Math.sin(angle)));
            angle += direction * dangle;
        }
        points.push(pool.pull("Point", x + radius * Math.cos(endAngle), y + radius * Math.sin(endAngle)));
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
        // based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
        let x0 = points[points.length-1].x, y0 = points[points.length-1].y;

        //a = -incoming vector, b = outgoing vector to x1, y1
        let a0 = x0 - x1, a1 = y0 - y1;
        let b0 = x2 - x1, b1 = y2 - y1;

        //normalize
        let l_a = Math.sqrt(Math.pow(a0, 2) + Math.pow(a1, 2));
        let l_b = Math.sqrt(Math.pow(b0, 2) + Math.pow(b1, 2));
        a0 /= l_a; a1 /= l_a; b0 /= l_b; b1 /= l_b;
        let angle = Math.atan2(a1, a0) - Math.atan2(b1, b0);

        //work out tangent points using tan(θ) = opposite / adjacent; angle/2 because hypotenuse is the bisection of a,b
        let tan_angle_div2 = Math.tan(angle/2);
        let adj_l = (radius/tan_angle_div2);

        let tangent1_pointx = x1 + a0 * adj_l, tangent1_pointy = y1 + a1 * adj_l;
        let tangent2_pointx = x1 + b0 * adj_l, tangent2_pointy = y1 + b1 * adj_l;

        points.push(pool.pull("Point", tangent1_pointx, tangent1_pointy));

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
        let points = this.points;
        // based on from https://github.com/karellodewijk/canvas-webgl/blob/master/canvas-webgl.js
        if (startAngle === endAngle) return;
        let fullCircle = anticlockwise ? Math.abs(startAngle-endAngle) >= (TAU) : Math.abs(endAngle-startAngle) >= (TAU);

        //bring angles all in [0, 2*PI] range
        startAngle = startAngle % (TAU);
        endAngle = endAngle % (TAU);
        if (startAngle < 0) startAngle += TAU;
        if (endAngle < 0) endAngle += TAU;

        if (startAngle>=endAngle) {
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

        let angle = startAngle;
        const cos_rotation = Math.cos(rotation);
        const sin_rotation = Math.sin(rotation);
        for (let j = 0; j < nr_of_interpolation_points; j++) {
            const _x1 = radiusX * Math.cos(angle);
            const _y1 = radiusY * Math.sin(angle);
            const _x2 = x + _x1 * cos_rotation - _y1 * sin_rotation;
            const _y2 = y + _x1 * sin_rotation + _y1 * cos_rotation;
            points.push(pool.pull("Point", _x2, _y2));
            angle += direction * dangle;
        }
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
        this.lineTo(x + width, y + height - radius);
        this.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        this.lineTo(x + radius, y + height);
        this.arcTo(x, y + height, x, y + height - radius, radius);
        this.lineTo(x, y + radius);
        this.arcTo(x, y, x + radius, y, radius);
    }
}
