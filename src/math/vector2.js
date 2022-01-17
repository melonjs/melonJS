import {clamp} from "./math.js";
import pool from "./../system/pooling.js";

/**
 * @classdesc
 * a generic 2D Vector Object
 * @class Vector2d
 * @memberof me
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 */
class Vector2d {

    constructor(...args) {
        this.onResetEvent(...args);
    }

    /**
     * @ignore
     */
    onResetEvent(x = 0, y = 0) {
        // this is to enable proper object pooling
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * @ignore
     */
    _set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberof me.Vector2d
     * @function
     * @param {number} x
     * @param {number} y
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    set(x, y) {
        if (x !== +x || y !== +y) {
            throw new Error(
                "invalid x,y parameters (not a number)"
            );
        }

        /**
         * x value of the vector
         * @public
         * @type {number}
         * @name x
         * @memberof me.Vector2d
         */
        //this.x = x;

        /**
         * y value of the vector
         * @public
         * @type {number}
         * @name y
         * @memberof me.Vector2d
         */
        //this.y = y;

        return this._set(x, y);
    }

    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    setZero() {
        return this.set(0, 0);
    }

    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    setV(v) {
        return this._set(v.x, v.y);
    }

    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this.x + v.x, this.y + v.y);
    }

    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this.x - v.x, this.y - v.y);
    }

    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof me.Vector2d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    scale(x, y) {
        return this._set(this.x * x, this.y * (typeof (y) !== "undefined" ? y : x));
    }

    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    toIso() {
        return this._set(this.x - this.y, (this.x + this.y) * 0.5);
    }

    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    to2d() {
        return this._set(this.y + this.x / 2, this.y - this.x / 2);
    }

    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this._set(this.x * v.x, this.y * v.y);
    }

    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof me.Vector2d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this.x / n, this.y / n);
    }

    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    abs() {
        return this._set((this.x < 0) ? -this.x : this.x, (this.y < 0) ? -this.y : this.y);
    }

    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof me.Vector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector2d} new me.Vector2d
     */
    clamp(low, high) {
        return new Vector2d(clamp(this.x, low, high), clamp(this.y, low, high));
    }

    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof me.Vector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(clamp(this.x, low, high), clamp(this.y, low, high));
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    minV(v) {
        return this._set((this.x < v.x) ? this.x : v.x, (this.y < v.y) ? this.y : v.y);
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    maxV(v) {
        return this._set((this.x > v.x) ? this.x : v.x, (this.y > v.y) ? this.y : v.y);
    }

    /**
     * Floor the vector values
     * @name floor
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    floor() {
        return new Vector2d(Math.floor(this.x), Math.floor(this.y));
    }

    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this.x), Math.floor(this.y));
    }

    /**
     * Ceil the vector values
     * @name ceil
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    ceil() {
        return new Vector2d(Math.ceil(this.x), Math.ceil(this.y));
    }

    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this.x), Math.ceil(this.y));
    }

    /**
     * Negate the vector values
     * @name negate
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    negate() {
        return new Vector2d(-this.x, -this.y);
    }

    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this.x, -this.y);
    }

    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y);
    }

    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberof me.Vector2d
     * @function
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    equals() {
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
        return ((this.x === _x) && (this.y === _y));
    }

    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    normalize() {
        return this.div(this.length() || 1);
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this.y, -this.x);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof me.Vector2d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    rotate(angle, v) {
        var cx = 0;
        var cy = 0;

        if (typeof v === "object") {
            cx = v.x;
            cy = v.y;
        }

        var x = this.x - cx;
        var y = this.y - cy;

        var c = Math.cos(angle);
        var s = Math.sin(angle);

        return this._set(x * c - y * s + cx, x * s + y * c + cy);
    }

    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {number} The dot product.
     */
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    /**
     * return the cross product of this vector and the passed one
     * @name cross
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {number} The cross product.
     */
    cross(v) {
        return this.x * v.y - this.y * v.x;
    }

   /**
    * return the square length of this vector
    * @name length2
    * @memberof me.Vector2d
    * @function
    * @returns {number} The length^2 of this vector.
    */
    length2() {
        return this.dot(this);
    }

    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberof me.Vector2d
     * @function
     * @returns {number} the length of this vector
     */
    length() {
        return Math.sqrt(this.length2());
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        this.x += ( v.x - this.x ) * alpha;
        this.y += ( v.y - this.y ) * alpha;
        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {number}
     */
    distance(v) {
        var dx = this.x - v.x, dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v
     * @returns {number} angle in radians
     */
    angle(v) {
        return Math.acos(clamp(this.dot(v) / (this.length() * v.length()), -1, 1));
    }

    /**
     * project this vector on to another vector.
     * @name project
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v The vector to project onto.
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    project(v) {
        return this.scale(this.dot(v) / v.length2());
    }

    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberof me.Vector2d
     * @function
     * @param {me.Vector2d} v The unit vector to project onto.
     * @returns {me.Vector2d} Reference to this object for method chaining
     */
    projectN(v) {
        return this.scale(this.dot(v));
    }

    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof me.Vector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    clone() {
        return pool.pull("Vector2d", this.x, this.y);
    }

    /**
     * convert the object to a string representation
     * @name toString
     * @memberof me.Vector2d
     * @function
     * @returns {string}
     */
    toString() {
        return "x:" + this.x + ",y:" + this.y;
    }
};

export default Vector2d;
