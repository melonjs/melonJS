/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import pool from '../system/pooling.js';
import Vector2d from '../math/vector2.js';

/**
 * @import Point from "./../geometries/point.js";
 * @import Rect from "./../geometries/rectangle.js";
 * @import Polygon from "./../geometries/poly.js";
 **/

/**
 * @classdesc
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 */
class Bounds {
    /**
     * @param {Vector2d[]|Point[]} [vertices] - an array of Vector2d or Point
     */
    constructor(vertices) {
        // @ignore
        this._center = new Vector2d();
        this.onResetEvent(vertices);

        /**
         * the object type (used internally)
         * @type {string}
         * @default "Bounds"
         */
        this.type = "Bounds";
    }

    /**
     * @ignore
     */
    onResetEvent(vertices) {
        if (typeof this.min === "undefined") {
            this.min = { x: Infinity,  y: Infinity };
            this.max = { x: -Infinity, y: -Infinity };
        } else {
            this.clear();
        }
        if (typeof vertices !== "undefined") {
            this.update(vertices);
        }
    }

    /**
     * reset the bound
     */
    clear() {
        this.setMinMax(Infinity, Infinity, -Infinity, -Infinity);

    }

    /**
     * sets the bounds to the given min and max value
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     */
    setMinMax(minX, minY, maxX, maxY) {
        this.min.x = minX;
        this.min.y = minY;

        this.max.x = maxX;
        this.max.y = maxY;
    }

    /**
     * x position of the bound
     * @type {number}
     */
    get x() {
        return this.min.x;
    }

    set x(value) {
        let deltaX = this.max.x - this.min.x;
        this.min.x = value;
        this.max.x = value + deltaX;
    }

    /**
     * y position of the bounds
     * @type {number}
     */
    get y() {
        return this.min.y;
    }

    set y(value) {
        let deltaY = this.max.y - this.min.y;

        this.min.y = value;
        this.max.y = value + deltaY;
    }

    /**
     * width of the bounds
     * @type {number}
     */
    get width() {
        return this.max.x - this.min.x;
    }

    set width(value) {
        this.max.x = this.min.x + value;
    }

    /**
     * width of the bounds
     * @type {number}
     */
    get height() {
        return this.max.y - this.min.y;
    }

    set height(value) {
        this.max.y = this.min.y + value;
    }

    /**
     * left coordinate of the bound
     * @type {number}
     */
    get left() {
        return this.min.x;
    }

    /**
     * right coordinate of the bound
     * @type {number}
     */
    get right() {
        return this.max.x;
    }

    /**
     * top coordinate of the bound
     * @type {number}
     */
    get top() {
        return this.min.y;
    }

    /**
     * bottom coordinate of the bound
     * @type {number}
     */
    get bottom() {
        return this.max.y;
    }

    /**
     * center position of the bound on the x axis
     * @type {number}
     */
    get centerX() {
        return this.min.x + (this.width / 2);
    }

    /**
     * center position of the bound on the y axis
     * @type {number}
     */
    get centerY() {
        return this.min.y + (this.height / 2);
    }

    /**
     * return the center position of the bound
     * @type {Vector2d}
     */
    get center() {
        return this._center.set(this.centerX, this.centerY);
    }

    /**
     * center the bounds position around the given coordinates
     * @param {number} x - the x coordinate around which to center this bounds
     * @param {number} y - the y coordinate around which to center this bounds
     */
    centerOn(x, y) {
        this.shift(x - this.width / 2, y - this.height / 2);
        return this;
    }

    /**
     * Updates bounds using the given vertices
     * @param {Vector2d[]|Point[]} vertices - an array of Vector2d or Point
     */
    update(vertices) {
        this.add(vertices, true);
    }

    /**
     * add the given vertices to the bounds definition.
     * @param {Vector2d[]|Point[]} vertices - an array of Vector2d or Point
     * @param {boolean} [clear=false] - either to reset the bounds before adding the new vertices
     */
    add(vertices, clear = false) {
        const verticeCount = vertices.length;
        if (clear === true) {
            this.clear();
        }
        for (let i = 0; i < verticeCount; i++) {
            const vertex = vertices[i];
            if (vertex.x > this.max.x) this.max.x = vertex.x;
            if (vertex.x < this.min.x) this.min.x = vertex.x;
            if (vertex.y > this.max.y) this.max.y = vertex.y;
            if (vertex.y < this.min.y) this.min.y = vertex.y;
        }
    }

    /**
     * add the given bounds to the bounds definition.
     * @param {Bounds} bounds
     * @param {boolean} [clear=false] - either to reset the bounds before adding the new vertices
     */
    addBounds(bounds, clear = false) {
        if (clear === true) {
            this.max.x = bounds.max.x;
            this.min.x = bounds.min.x;
            this.max.y = bounds.max.y;
            this.min.y = bounds.min.y;
        } else {
            if (bounds.max.x > this.max.x) this.max.x = bounds.max.x;
            if (bounds.min.x < this.min.x) this.min.x = bounds.min.x;
            if (bounds.max.y > this.max.y) this.max.y = bounds.max.y;
            if (bounds.min.y < this.min.y) this.min.y = bounds.min.y;
        }
    }

    /**
     * add the given point to the bounds definition.
     * @param {Vector2d|Point} point - the vector or point to be added to the bounds
     * @param {Matrix2d} [m] - an optional transform to apply to the given point (if the given point is a Vector2d)
     */
    addPoint(point, m) {
        if ((typeof m !== "undefined")) {
            // only Vectors object have a rotate function
            point = m.apply(point);
        }
        this.min.x = Math.min(this.min.x, point.x);
        this.max.x = Math.max(this.max.x, point.x);
        this.min.y = Math.min(this.min.y, point.y);
        this.max.y = Math.max(this.max.y, point.y);
    }

    /**
     * add the given quad coordinates to this bound definition, multiplied by the given matrix
     * @param {number} x0 - left X coordinates of the quad
     * @param {number} y0 - top Y coordinates of the quad
     * @param {number} x1 - right X coordinates of the quad
     * @param {number} y1 - bottom y coordinates of the quad
     * @param {Matrix2d} [m] - an optional transform to apply to the given frame coordinates
     */
    addFrame(x0, y0, x1, y1, m) {
        let v = pool.pull("Point");

        this.addPoint(v.set(x0, y0), m);
        this.addPoint(v.set(x1, y0), m);
        this.addPoint(v.set(x0, y1), m);
        this.addPoint(v.set(x1, y1), m);

        pool.push(v);
    }

    /**
     * Returns true if the bounds contains the given point.
     * @param {number|Vector2d} x -  x coordinate or a vector point to check
     * @param {number} [y] - y coordinate
     * @returns {boolean} True if the bounds contain the point, otherwise false
     * @example
     * if (bounds.contains(10, 10)) {
     *   // do something
     * }
     * // or
     * if (bounds.contains(myVector2d)) {
     *   // do something
     * }
     */
    contains() {
        let arg0 = arguments[0];
        let _x1, _x2, _y1, _y2;
        if (arguments.length === 2) {
            // x, y
            _x1 = _x2 = arg0;
            _y1 = _y2 = arguments[1];
        } else {
            if (typeof arg0.max !== "undefined") {
                // only bounds define min and max properties
                _x1 = arg0.min.x;
                _x2 = arg0.max.x;
                _y1 = arg0.min.y;
                _y2 = arg0.max.y;
            } else {
                // vector
                _x1 = _x2 = arg0.x;
                _y1 = _y2 = arg0.y;
            }
        }

        return _x1 >= this.min.x && _x2 <= this.max.x
            && _y1 >= this.min.y && _y2 <= this.max.y;
    }

    /**
     * Returns true if the two bounds intersect.
     * @param {Bounds|Rect} bounds
     * @returns {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds) {
        return !(this.right < bounds.left || this.left > bounds.right ||
                 this.bottom < bounds.top || this.top > bounds.bottom);
    }

    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite() {
        return (isFinite(this.min.x) && isFinite(this.max.x) && isFinite(this.min.y) && isFinite(this.max.y));
    }

    /**
     * Translates the bounds by the given point
     * @param {number|Vector2d} x -  x coordinate or a vector point to translate by
     * @param {number} [y]
     * @example
     * bounds.translate(10, 10);
     * // or
     * bounds.translate(myVector2d);
     */
    translate() {
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
        this.min.x += _x;
        this.max.x += _x;
        this.min.y += _y;
        this.max.y += _y;
    }

    /**
     * Shifts the bounds to the given x, y position.
     * @param {number|Vector2d} x -  x coordinate or a vector point to shift to
     * @param {number} [y]
     * @example
     * bounds.shift(10, 10);
     * // or
     * bounds.shift(myVector2d);
     */
    shift() {
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

        let deltaX = this.max.x - this.min.x,
            deltaY = this.max.y - this.min.y;

        this.min.x = _x;
        this.max.x = _x + deltaX;
        this.min.y = _y;
        this.max.y = _y + deltaY;
    }

    /**
     * clone this bounds
     * @returns {Bounds}
     */
    clone() {
        let bounds = new Bounds();
        bounds.addBounds(this);
        return bounds;
    }

    /**
     * Returns a polygon whose edges are the same as this bounds.
     * @returns {Polygon} a new Polygon that represents this bounds.
     */
    toPolygon () {
        return pool.pull("Polygon", this.x, this.y, [
            pool.pull("Vector2d", 0,          0),
            pool.pull("Vector2d", this.width, 0),
            pool.pull("Vector2d", this.width, this.height),
            pool.pull("Vector2d", 0,          this.height)
        ]);
    }

}

export { Bounds as default };
