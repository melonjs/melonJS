import pool from "./../system/pooling.js";
import Polygon from "./poly.js";

/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2d.js";
 */

/**
 * @classdesc
 * a line segment Object
 * @augments Polygon
 * @param {number} x - origin point of the Line
 * @param {number} y - origin point of the Line
 * @param {Vector2d[]} points - array of vectors defining the Line
 */

export default class Line extends Polygon {

    /**
     * Returns true if the Line contains the given point
     * @param {number|Vector2d} x -  x coordinate or a vector point to check
     * @param {number} [y] -  y coordinate
     * @returns {boolean} true if contains
     * @example
     * if (line.contains(10, 10)) {
     *   // do something
     * }
     * // or
     * if (line.contains(myVector2d)) {
     *   // do something
     * }
     */
    contains() {
        let _x, _y;

        if (arguments.length === 2) {
            // x, y
            _x = arguments[0];
            _y = arguments[1];
        } else {
            // vector
            _x = arguments[0].x;
            _y = arguments[0].y;
        }

        // translate the given coordinates,
        // rather than creating temp translated vectors
        _x -= this.pos.x; // Cx
        _y -= this.pos.y; // Cy
        let start = this.points[0]; // Ax/Ay
        let end = this.points[1]; // Bx/By

        //(Cy - Ay) * (Bx - Ax) = (By - Ay) * (Cx - Ax)
        return (_y - start.y) * (end.x - start.x) === (end.y - start.y) * (_x - start.x);
    }

    /**
     * Computes the calculated collision edges and normals.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @returns {Line} this instance for objecf chaining
     */
    recalc() {
        let edges = this.edges;
        let normals = this.normals;
        let indices = this.indices;

        // Copy the original points array and apply the offset/angle
        let points = this.points;

        if (points.length !== 2) {
            throw new Error("Requires exactly 2 points");
        }

        // Calculate the edges/normals
        if (edges[0] === undefined) {
            edges[0] = pool.pull("Vector2d");
        }
        edges[0].copy(points[1]).sub(points[0]);
        if (normals[0] === undefined) {
            normals[0] = pool.pull("Vector2d");
        }
        normals[0].copy(edges[0]).perp().normalize();

        // do not do anything here, indices will be computed by
        // toIndices if array is empty upon function call
        indices.length = 0;

        return this;
    }

    /**
     * clone this line segment
     * @returns {Line} new Line
     */
    clone() {
        let copy = [];
        this.points.forEach((point) => {
            copy.push(point.clone());
        });
        return new Line(this.pos.x, this.pos.y, copy);
    }

}
