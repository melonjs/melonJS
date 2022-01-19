import Vector2d from "./../math/vector2.js";
import Polygon from "./../geometries/poly.js";

/**
 * @classdesc
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 * @class Bounds
 * @memberof me
 * @param {me.Vector2d[]} [vertices] an array of me.Vector2d points
 * @returns {me.Bounds} A new bounds object
 */

class Bounds {

    constructor(vertices) {
        this.onResetEvent(vertices);
    }

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

        // @ignore
        this._center = new Vector2d();
    }

    /**
     * reset the bound
     * @name clear
     * @memberof me.Bounds
     * @function
     */
    clear() {
        this.setMinMax(Infinity, Infinity, -Infinity, -Infinity);

    }

    /**
     * sets the bounds to the given min and max value
     * @name setMinMax
     * @memberof me.Bounds
     * @function
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
     * @public
     * @type {number}
     * @name x
     * @memberof me.Bounds
     */
    get x() {
        return this.min.x;
    }

    set x(value) {
        var deltaX = this.max.x - this.min.x;
        this.min.x = value;
        this.max.x = value + deltaX;
    }

    /**
     * y position of the bounds
     * @public
     * @type {number}
     * @name y
     * @memberof me.Bounds
     */
    get y() {
        return this.min.y;
    }

    set y(value) {
        var deltaY = this.max.y - this.min.y;

        this.min.y = value;
        this.max.y = value + deltaY;
    }

    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberof me.Bounds
     */
    get width() {
        return this.max.x - this.min.x;
    }

    set width(value) {
        this.max.x = this.min.x + value;
    }

    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberof me.Bounds
     */
    get height() {
        return this.max.y - this.min.y;
    }

    set height(value) {
        this.max.y = this.min.y + value;
    }

    /**
     * left coordinate of the bound
     * @public
     * @type {number}
     * @name left
     * @memberof me.Bounds
     */
    get left() {
        return this.min.x;
    }

    /**
     * right coordinate of the bound
     * @public
     * @type {number}
     * @name right
     * @memberof me.Bounds
     */
    get right() {
        return this.max.x;
    }

    /**
     * top coordinate of the bound
     * @public
     * @type {number}
     * @name top
     * @memberof me.Bounds
     */
    get top() {
        return this.min.y;
    }

    /**
     * bottom coordinate of the bound
     * @public
     * @type {number}
     * @name bottom
     * @memberof me.Bounds
     */
    get bottom() {
        return this.max.y;
    }

    /**
     * center position of the bound on the x axis
     * @public
     * @type {number}
     * @name centerX
     * @memberof me.Bounds
     */
    get centerX() {
        return this.min.x + (this.width / 2);
    }

    /**
     * center position of the bound on the y axis
     * @public
     * @type {number}
     * @name centerY
     * @memberof me.Bounds
     */
    get centerY() {
        return this.min.y + (this.height / 2);
    }

    /**
     * return the center position of the bound
     * @public
     * @type {me.Vector2d}
     * @name center
     * @memberof me.Bounds
     */
    get center() {
        return this._center.set(this.centerX, this.centerY);
    }

    /**
     * Updates bounds using the given vertices
     * @name update
     * @memberof me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     */
    update(vertices) {
        this.add(vertices, true);
    }

    /**
     * add the given vertices to the bounds definition.
     * @name add
     * @memberof me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    add(vertices, clear = false) {
        if (clear === true) {
            this.clear();
        }
        for (var i = 0; i < vertices.length; i++) {
            var vertex = vertices[i];
            if (vertex.x > this.max.x) this.max.x = vertex.x;
            if (vertex.x < this.min.x) this.min.x = vertex.x;
            if (vertex.y > this.max.y) this.max.y = vertex.y;
            if (vertex.y < this.min.y) this.min.y = vertex.y;
        }
    }

    /**
     * add the given bounds to the bounds definition.
     * @name addBounds
     * @memberof me.Bounds
     * @function
     * @param {me.Bounds} bounds
     * @param {boolean} [clear=false] either to reset the bounds before adding the new vertices
     */
    addBounds(bounds, clear = false) {
        if (clear === true) {
            this.clear();
        }

        if (bounds.max.x > this.max.x) this.max.x = bounds.max.x;
        if (bounds.min.x < this.min.x) this.min.x = bounds.min.x;
        if (bounds.max.y > this.max.y) this.max.y = bounds.max.y;
        if (bounds.min.y < this.min.y) this.min.y = bounds.min.y;
    }

    /**
     * add the given point to the bounds definition.
     * @name addPoint
     * @memberof me.Bounds
     * @function
     * @param {me.Vector2d} v
     * @param {me.Matrix2d} [m] an optional transform to apply to the given point
     */
    addPoint(v, m) {
        if (typeof m !== "undefined") {
            v = m.apply(v);
        }
        this.min.x = Math.min(this.min.x, v.x);
        this.max.x = Math.max(this.max.x, v.x);
        this.min.y = Math.min(this.min.y, v.y);
        this.max.y = Math.max(this.max.y, v.y);
    }

    /**
     * add the given quad coordinates to this bound definition, multiplied by the given matrix
     * @name addFrame
     * @memberof me.Bounds
     * @function
     * @param {number} x0 - left X coordinates of the quad
     * @param {number} y0 - top Y coordinates of the quad
     * @param {number} x1 - right X coordinates of the quad
     * @param {number} y1 - bottom y coordinates of the quad
     * @param {me.Matrix2d} [m] an optional transform to apply to the given frame coordinates
     */
    addFrame(x0, y0, x1, y1, m) {
        var v = me.pool.pull("Vector2d");

        // transform all points and add to the bound definition
        this.addPoint(v.set(x0, y0), m);
        this.addPoint(v.set(x1, y0), m);
        this.addPoint(v.set(x0, y1), m);
        this.addPoint(v.set(x1, y1), m);

        me.pool.push(v);
    }

    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberof me.Bounds
     * @function
     * @param {me.Vector2d} point
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberof me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    contains() {
        var arg0 = arguments[0];
        var _x1, _x2, _y1, _y2;
        if (arguments.length === 2) {
            // x, y
            _x1 = _x2 = arg0;
            _y1 = _y2 = arguments[1];
        } else {
            if (arg0 instanceof Bounds) {
                // bounds
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
     * @name overlaps
     * @memberof me.Bounds
     * @function
     * @param {me.Bounds|me.Rect} bounds
     * @returns {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds) {
        return !(this.right < bounds.left || this.left > bounds.right ||
                 this.bottom < bounds.top || this.top > bounds.bottom);
    }

    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @name isFinite
     * @memberof me.Bounds
     * @function
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite() {
        return (isFinite(this.min.x) && isFinite(this.max.x) && isFinite(this.min.y) && isFinite(this.max.y));
    }

    /**
     * Translates the bounds by the given vector.
     * @name translate
     * @memberof me.Bounds
     * @function
     * @param {me.Vector2d} vector
     */
    /**
     * Translates the bounds by x on the x axis, and y on the y axis
     * @name translate
     * @memberof me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     */
    translate() {
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
        this.min.x += _x;
        this.max.x += _x;
        this.min.y += _y;
        this.max.y += _y;
    }

    /**
     * Shifts the bounds to the given position vector.
     * @name shift
     * @memberof me.Bounds
     * @function
     * @param {me.Vector2d} position
     */
    /**
     * Shifts the bounds to the given x, y position.
     * @name shift
     * @memberof me.Bounds
     * @function
     * @param {number} x
     * @param {number} y
     */
    shift() {
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

        var deltaX = this.max.x - this.min.x,
            deltaY = this.max.y - this.min.y;

        this.min.x = _x;
        this.max.x = _x + deltaX;
        this.min.y = _y;
        this.max.y = _y + deltaY;
    }

    /**
     * clone this bounds
     * @name clone
     * @memberof me.Bounds
     * @function
     * @returns {me.Bounds}
     */
    clone() {
        var bounds = new Bounds();
        bounds.addBounds(this);
        return bounds;
    }

    /**
     * Returns a polygon whose edges are the same as this bounds.
     * @name toPolygon
     * @memberof me.Bounds
     * @function
     * @returns {me.Polygon} a new Polygon that represents this bounds.
     */
    toPolygon () {
        return new Polygon(this.x, this.y, [
            new Vector2d(0,          0),
            new Vector2d(this.width, 0),
            new Vector2d(this.width, this.height),
            new Vector2d(0,          this.height)
        ]);
    }

};
export default Bounds;
