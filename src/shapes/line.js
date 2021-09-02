import Vector2d from "./../math/vector2.js";
import Polygon from "./poly.js";

/**
 * a line segment Object.<br>
 * @class
 * @extends me.Polygon
 * @memberOf me
 * @constructor
 * @param {Number} x origin point of the Line
 * @param {Number} y origin point of the Line
 * @param {me.Vector2d[]} points array of vectors defining the Line
 */
var Line = Polygon.extend({

    /**
     * Returns true if the Line contains the given point
     * @name contains
     * @memberOf me.Line.prototype
     * @function
     * @param  {me.Vector2d} point
     * @return {boolean} true if contains
     */

    /**
     * Returns true if the Line contains the given point
     * @name contains
     * @memberOf me.Line.prototype
     * @function
     * @param  {Number} x x coordinate
     * @param  {Number} y y coordinate
     * @return {boolean} true if contains
     */
    contains: function () {
        var _x, _y;

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
        var start = this.points[0]; // Ax/Ay
        var end = this.points[1]; // Bx/By

        //(Cy - Ay) * (Bx - Ax) = (By - Ay) * (Cx - Ax)
        return (_y - start.y) * (end.x - start.x) === (end.y - start.y) * (_x - start.x);
    },

    /**
     * Computes the calculated collision edges and normals.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @name recalc
     * @memberOf me.Line.prototype
     * @function
     */
    recalc : function () {
        var edges = this.edges;
        var normals = this.normals;
        var indices = this.indices;

        // Copy the original points array and apply the offset/angle
        var points = this.points;

        if (points.length !== 2) {
            throw new Error("Requires exactly 2 points");
        }

        // Calculate the edges/normals
        if (edges[0] === undefined) {
            edges[0] = new Vector2d();
        }
        edges[0].copy(points[1]).sub(points[0]);
        if (normals[0] === undefined) {
            normals[0] = new Vector2d();
        }
        normals[0].copy(edges[0]).perp().normalize();

        // do not do anything here, indices will be computed by
        // toIndices if array is empty upon function call
        indices.length = 0;

        return this;
    },

    /**
     * clone this line segment
     * @name clone
     * @memberOf me.Line.prototype
     * @function
     * @return {me.Line} new Line
     */
    clone : function () {
        var copy = [];
        this.points.forEach(function (point) {
            copy.push(point.clone());
        });
        return new Line(this.pos.x, this.pos.y, copy);
    }
});
export default Line;
