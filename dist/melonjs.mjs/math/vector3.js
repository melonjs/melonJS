/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { clamp } from './math.js';
import pool from '../system/pooling.js';

/**
 * @classdesc
 * a generic 3D Vector Object
 */
 class Vector3d {
    /**
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     * @param {number} [z=0] - z value of the vector
     */
    constructor(x = 0, y = 0, z = 0) {
        this.onResetEvent(x, y, z);
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
     * @memberof Vector3d
     * @param {number} x
     * @param {number} y
     * @param {number} [z=0]
     * @returns {Vector3d} Reference to this object for method chaining
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
         * @member {number}
         * @name x
         * @memberof Vector3d
         */
        //this.x = x;

        /**
         * y value of the vector
         * @public
         * @member {number}
         * @name y
         * @memberof Vector3d
         */
        //this.y = y;

        /**
         * z value of the vector
         * @public
         * @member {number}
         * @name z
         * @memberof Vector3d
         */
        //this.z = z;

        return this._set(x, y, z);
    }

    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    setZero() {
        return this.set(0, 0, 0);
    }

    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    setV(v) {
        return this._set(v.x, v.y, v.z);
    }

    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this.x + v.x, this.y + v.y, this.z + (v.z || 0));
    }

    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this.x - v.x, this.y - v.y, this.z - (v.z || 0));
    }

    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof Vector3d
     * @param {number} x
     * @param {number} [y=x]
     * @param {number} [z=1]
     * @returns {Vector3d} Reference to this object for method chaining
     */
    scale(x, y = x, z = 1) {
        return this._set(this.x * x, this.y * y, this.z * z);
    }

    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this.scale(v.x, v.y, v.z);
    }

    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    toIso() {
        return this._set(this.x - this.y, (this.x + this.y) * 0.5, this.z);
    }

    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    to2d() {
        return this._set(this.y + this.x / 2, this.y - this.x / 2, this.z);
    }

    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof Vector3d
     * @param {number} n - the value to divide the vector by
     * @returns {Vector3d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this.x / n, this.y / n, this.z / n);
    }

    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    abs() {
        return this._set((this.x < 0) ? -this.x : this.x, (this.y < 0) ? -this.y : this.y, (this.z < 0) ? -this.z : this.z);
    }

    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof Vector3d
     * @param {number} low
     * @param {number} high
     * @returns {Vector3d} new me.Vector3d
     */
    clamp(low, high) {
        return new Vector3d(clamp(this.x, low, high), clamp(this.y, low, high), clamp(this.z, low, high));
    }

    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof Vector3d
     * @param {number} low
     * @param {number} high
     * @returns {Vector3d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(clamp(this.x, low, high), clamp(this.y, low, high), clamp(this.z, low, high));
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    minV(v) {
        let _vz = v.z || 0;
        return this._set((this.x < v.x) ? this.x : v.x, (this.y < v.y) ? this.y : v.y, (this.z < _vz) ? this.z : _vz);
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    maxV(v) {
        let _vz = v.z || 0;
        return this._set((this.x > v.x) ? this.x : v.x, (this.y > v.y) ? this.y : v.y, (this.z > _vz) ? this.z : _vz);
    }

    /**
     * Floor the vector values
     * @name floor
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    floor() {
        return new Vector3d(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }

    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    }

    /**
     * Ceil the vector values
     * @name ceil
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    ceil() {
        return new Vector3d(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
    }

    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
    }

    /**
     * Negate the vector values
     * @name negate
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    negate() {
        return new Vector3d(-this.x, -this.y, -this.z);
    }

    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this.x, -this.y, -this.z);
    }

    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y, v.z || 0);
    }

    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof Vector3d
     * @method
     * @param {Vector2d|Vector3d} v
     * @returns {boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberof Vector3d
     * @param {number} x
     * @param {number} y
     * @param {number} [z]
     * @returns {boolean}
     */
    equals() {
        let _x, _y, _z;
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
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    normalize() {
        return this.div(this.length() || 1);
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
     * @name perp
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this.y, -this.x, this.z);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
     * @name rotate
     * @memberof Vector3d
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around (on the same z axis)
     * @returns {Vector3d} Reference to this object for method chaining
     */
    rotate(angle, v) {
        let cx = 0;
        let cy = 0;

        if (typeof v === "object") {
            cx = v.x;
            cy = v.y;
        }

        // TODO also rotate on the z axis if the given vector is a 3d one
        let x = this.x - cx;
        let y = this.y - cy;

        let c = Math.cos(angle);
        let s = Math.sin(angle);

        return this._set(x * c - y * s + cx, x * s + y * c + cy, this.z);
    }

    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {number} The dot product.
     */
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * (typeof(v.z) !== "undefined" ? v.z : this.z);
    }

    /**
     * calculate the cross product of this vector and the passed one
     * @name cross
     * @memberof Vector3d
     * @param {Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    cross(v) {
        let ax = this.x, ay = this.y, az = this.z;
        let bx = v.x, by = v.y, bz = v.z;

        this.x = ay * bz - az * by;
        this.y = az * bx - ax * bz;
        this.z = ax * by - ay * bx;

        return this;
    }

   /**
    * return the square length of this vector
    * @name length2
    * @memberof Vector3d
    * @returns {number} The length^2 of this vector.
    */
    length2() {
        return this.dot(this);
    }

    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberof Vector3d
     * @returns {number} the length of this vector
     */
    length() {
        return Math.sqrt(this.length2());
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof Vector3d
     * @param {Vector3d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {Vector3d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        this.x += ( v.x - this.x ) * alpha;
        this.y += ( v.y - this.y ) * alpha;
        this.z += ( v.z - this.z ) * alpha;
        return this;
    }

    /**
     * interpolate the position of this vector on the x and y axis towards the given one by the given maximum step.
     * @name moveTowards
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {Vector3d} Reference to this object for method chaining
     */
    moveTowards(target, step) {
        let angle = Math.atan2(target.y - this.y, target.x - this.x);

        let dx = this.x - target.x;
        let dy = this.y - target.y;

        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0 || (step >= 0 && distance <= step * step)) {
            return target;
        }

        this.x += Math.cos(angle) * step;
        this.y += Math.sin(angle) * step;

        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {number}
     */
    distance(v) {
        let dx = this.x - v.x;
        let dy = this.y - v.y;
        let dz = this.z - (v.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {number} angle in radians
     */
    angle(v) {
        return Math.acos(clamp(this.dot(v) / (this.length() * v.length()), -1, 1));
    }

    /**
     * project this vector on to another vector.
     * @name project
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v - The vector to project onto.
     * @returns {Vector3d} Reference to this object for method chaining
     */
    project(v) {
        let ratio = this.dot(v) / v.length2();
        return this.scale(ratio, ratio, ratio);
    }

    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v - The unit vector to project onto.
     * @returns {Vector3d} Reference to this object for method chaining
     */
    projectN(v) {
        let ratio = this.dot(v) / v.length2();
        return this.scale(ratio, ratio, ratio);
    }

    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    clone() {
        return pool.pull("Vector3d", this.x, this.y, this.z);
    }

    /**
     * convert the object to a string representation
     * @name toString
     * @memberof Vector3d
     * @returns {string}
     */
    toString() {
        return "x:" + this.x + ",y:" + this.y + ",z:" + this.z;
    }
}

export { Vector3d as default };
