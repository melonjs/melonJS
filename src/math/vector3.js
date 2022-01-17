import {clamp} from "./math.js";
import pool from "./../system/pooling.js";

/**
 * @classdesc
 * a generic 3D Vector Object
 * @class Vector3d
 * @memberof me
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 * @param {number} [z=0] z value of the vector
 */

class Vector3d {

    constructor(...args) {
        this.onResetEvent(...args);
    }

    /**
     * @ignore
     */
    onResetEvent(x = 0, y = 0, z = 0) {
        // this is to enable proper object pooling
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    /**
     * @ignore
     */
    _set(x, y, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberof me.Vector3d
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} [z=0]
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    set(x, y, z) {
        if (x !== +x || y !== +y || (typeof z !== "undefined" && z !== +z)) {
            throw new Error(
                "invalid x, y, z parameters (not a number)"
            );
        }

        /**
         * x value of the vector
         * @public
         * @type {number}
         * @name x
         * @memberof me.Vector3d
         */
        //this.x = x;

        /**
         * y value of the vector
         * @public
         * @type {number}
         * @name y
         * @memberof me.Vector3d
         */
        //this.y = y;

        /**
         * z value of the vector
         * @public
         * @type {number}
         * @name z
         * @memberof me.Vector3d
         */
        //this.z = z;

        return this._set(x, y, z);
    }

    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    setZero() {
        return this.set(0, 0, 0);
    }

    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    setV(v) {
        return this._set(v.x, v.y, v.z);
    }

    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this.x + v.x, this.y + v.y, this.z + (v.z || 0));
    }

    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this.x - v.x, this.y - v.y, this.z - (v.z || 0));
    }

    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof me.Vector3d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @param {number} [z=1]
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    scale(x, y, z) {
        y = (typeof (y) !== "undefined" ? y : x);
        return this._set(this.x * x, this.y * y, this.z * (z || 1));
    }

    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this.scale(v.x, v.y, v.z);
    }

    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    toIso() {
        return this._set(this.x - this.y, (this.x + this.y) * 0.5, this.z);
    }

    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    to2d() {
        return this._set(this.y + this.x / 2, this.y - this.x / 2, this.z);
    }

    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof me.Vector3d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this.x / n, this.y / n, this.z / n);
    }

    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    abs() {
        return this._set((this.x < 0) ? -this.x : this.x, (this.y < 0) ? -this.y : this.y, (this.z < 0) ? -this.z : this.z);
    }

    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof me.Vector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector3d} new me.Vector3d
     */
    clamp(low, high) {
        return new Vector3d(clamp(this.x, low, high), clamp(this.y, low, high), clamp(this.z, low, high));
    }

    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof me.Vector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(clamp(this.x, low, high), clamp(this.y, low, high), clamp(this.z, low, high));
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    minV(v) {
        var _vz = v.z || 0;
        return this._set((this.x < v.x) ? this.x : v.x, (this.y < v.y) ? this.y : v.y, (this.z < _vz) ? this.z : _vz);
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    maxV(v) {
        var _vz = v.z || 0;
        return this._set((this.x > v.x) ? this.x : v.x, (this.y > v.y) ? this.y : v.y, (this.z > _vz) ? this.z : _vz);
    }

    /**
     * Floor the vector values
     * @name floor
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    floor() {
        return new Vector3d(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }

    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }

    /**
     * Ceil the vector values
     * @name ceil
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    ceil() {
        return new Vector3d(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
    }

    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
    }

    /**
     * Negate the vector values
     * @name negate
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    negate() {
        return new Vector3d(-this.x, -this.y, -this.z);
    }

    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this.x, -this.y, -this.z);
    }

    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y, v.z || 0);
    }

    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberof me.Vector3d
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} [z]
     * @returns {boolean}
     */
    equals() {
        var _x, _y, _z;
        if (arguments.length >= 2) {
            // x, y, z
            _x = arguments[0];
            _y = arguments[1];
            _z = arguments[2];
        } else {
            // vector
            _x = arguments[0].x;
            _y = arguments[0].y;
            _z = arguments[0].z;
        }

        if (typeof _z === "undefined") {
            _z = this.z;
        }

        return ((this.x === _x) && (this.y === _y) && (this.z === _z));
    }

    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    normalize() {
        return this.div(this.length() || 1);
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
     * @name perp
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this.y, -this.x, this.z);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
     * @name rotate
     * @memberof me.Vector3d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    rotate(angle, v) {
        var cx = 0;
        var cy = 0;

        if (typeof v === "object") {
            cx = v.x;
            cy = v.y;
        }

        // TODO also rotate on the z axis if the given vector is a 3d one
        var x = this.x - cx;
        var y = this.y - cy;

        var c = Math.cos(angle);
        var s = Math.sin(angle);

        return this._set(x * c - y * s + cx, x * s + y * c + cy, this.z);
    }

    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {number} The dot product.
     */
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * (typeof(v.z) !== "undefined" ? v.z : this.z);
    }

    /**
     * calculate the cross product of this vector and the passed one
     * @name cross
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector3d} v
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    cross(v) {
        var ax = this.x, ay = this.y, az = this.z;
        var bx = v.x, by = v.y, bz = v.z;

        this.x = ay * bz - az * by;
        this.y = az * bx - ax * bz;
        this.z = ax * by - ay * bx;

        return this;
    }

   /**
    * return the square length of this vector
    * @name length2
    * @memberof me.Vector3d
    * @function
    * @returns {number} The length^2 of this vector.
    */
    length2() {
        return this.dot(this);
    }

    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberof me.Vector3d
     * @function
     * @returns {number} the length of this vector
     */
    length() {
        return Math.sqrt(this.length2());
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector3d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        this.x += ( v.x - this.x ) * alpha;
        this.y += ( v.y - this.y ) * alpha;
        this.z += ( v.z - this.z ) * alpha;
        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {number}
     */
    distance(v) {
        var dx = this.x - v.x;
        var dy = this.y - v.y;
        var dz = this.z - (v.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v
     * @returns {number} angle in radians
     */
    angle(v) {
        return Math.acos(clamp(this.dot(v) / (this.length() * v.length()), -1, 1));
    }

    /**
     * project this vector on to another vector.
     * @name project
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v The vector to project onto.
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    project(v) {
        var ratio = this.dot(v) / v.length2();
        return this.scale(ratio, ratio, ratio);
    }

    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberof me.Vector3d
     * @function
     * @param {me.Vector2d|me.Vector3d} v The unit vector to project onto.
     * @returns {me.Vector3d} Reference to this object for method chaining
     */
    projectN(v) {
        var ratio = this.dot(v) / v.length2();
        return this.scale(ratio, ratio, ratio);
    }

    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof me.Vector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    clone() {
        return pool.pull("Vector3d", this.x, this.y, this.z);
    }

    /**
     * convert the object to a string representation
     * @name toString
     * @memberof me.Vector3d
     * @function
     * @returns {string}
     */
    toString() {
        return "x:" + this.x + ",y:" + this.y + ",z:" + this.z;
    }
};

export default Vector3d;
