/**
 * @classdesc
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 * @class Bounds
 * @memberOf me
 * @constructor
 * @memberOf me
 * @param {me.Vector2d[]} [vertices] an array of me.Vector2d points
 * @return {me.Bounds} A new bounds object
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
        this._center = new me.Vector2d();
    }

    /**
     * reset the bound
     * @name clear
     * @memberOf me.Bounds
     * @function
     */
    clear() {
        this.setMinMax(Infinity, Infinity, -Infinity, -Infinity);
    }

    /**
     * sets the bounds to the given min and max value
     * @name setMinMax
     * @memberOf me.Bounds
     * @function
     * @param {Number} minX
     * @param {Number} minY
     * @param {Number} maxX
     * @param {Number} maxY
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
     * @type {Number}
     * @name x
     * @memberOf me.Bounds
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
     * @type {Number}
     * @name y
     * @memberOf me.Bounds
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
     * @type {Number}
     * @name width
     * @memberOf me.Bounds
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
     * @type {Number}
     * @name width
     * @memberOf me.Bounds
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
     * @type {Number}
     * @name left
     * @memberOf me.Bounds
     */
    get left() {
        return this.min.x;
    }

    /**
     * right coordinate of the bound
     * @public
     * @type {Number}
     * @name right
     * @memberOf me.Bounds
     */
    get right() {
        return this.max.x;
    }

    /**
     * top coordinate of the bound
     * @public
     * @type {Number}
     * @name top
     * @memberOf me.Bounds
     */
    get top() {
        return this.min.y;
    }

    /**
     * bottom coordinate of the bound
     * @public
     * @type {Number}
     * @name bottom
     * @memberOf me.Bounds
     */
    get bottom() {
        return this.max.y;
    }

    /**
     * center position of the bound on the x axis
     * @public
     * @type {Number}
     * @name centerX
     * @memberOf me.Bounds
     */
    get centerX() {
        return this.min.x + (this.width / 2);
    }

    /**
     * center position of the bound on the y axis
     * @public
     * @type {Number}
     * @name centerY
     * @memberOf me.Bounds
     */
    get centerY() {
        return this.min.y + (this.height / 2);
    }

    /**
     * return the center position of the bound
     * @public
     * @type {me.Vector2d}
     * @name center
     * @memberOf me.Bounds
     */
    get center() {
        return this._center.set(this.centerX, this.centerY);
    }

    /**
     * Updates bounds using the given vertices
     * @name update
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d[]} vertices an array of me.Vector2d points
     */
    update(vertices) {
        this.add(vertices, true);
    }

    /**
     * add the given vertices to the bounds definition.
     * @name add
     * @memberOf me.Bounds
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
     * @memberOf me.Bounds
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
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} point
     * @return {boolean} True if the bounds contain the point, otherwise false
     */
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberOf me.Bounds
     * @function
     * @param {Number} x
     * @param {Number} y
     * @return {boolean} True if the bounds contain the point, otherwise false
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
     * @memberOf me.Bounds
     * @function
     * @param {me.Bounds} bounds
     * @return {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds) {
        return (this.min.x <= bounds.max.x && this.max.x >= bounds.min.x
                && this.max.y >= bounds.min.y && this.min.y <= bounds.max.y);
    }

    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @name isFinite
     * @memberOf me.Bounds
     * @function
     * @return {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite() {
        return (isFinite(this.min.x) && isFinite(this.max.x) && isFinite(this.min.y) && isFinite(this.max.y));
    }

    /**
     * Translates the bounds by the given vector.
     * @name translate
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} vector
     */
    /**
     * Translates the bounds by x on the x axis, and y on the y axis
     * @name translate
     * @memberOf me.Bounds
     * @function
     * @param {Number} x
     * @param {Number} y
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
     * @memberOf me.Bounds
     * @function
     * @param {me.Vector2d} position
     */
    /**
     * Shifts the bounds to the given x, y position.
     * @name shift
     * @memberOf me.Bounds
     * @function
     * @param {Number} x
     * @param {Number} y
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
     * @memberOf me.Bounds
     * @function
     * @return {me.Bounds}
     */
    clone() {
        var bounds = new Bounds();
        bounds.addBounds(this);
        return bounds;
    }

};
export default Bounds;
