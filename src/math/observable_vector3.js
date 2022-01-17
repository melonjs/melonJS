import Vector3d from "./vector3.js";
import {clamp} from "./math.js";
import pool from "./../system/pooling.js";

/**
 * A Vector3d object that provide notification by executing the given callback when the vector is changed.
 * @classdesc
 * @class ObservableVector3d
 * @augments me.Vector3d
 * @memberof me
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 * @param {number} [z=0] z value of the vector
 * @param {object} settings additional required parameters
 * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
 * @param {object} [settings.scope] the value to use as this when calling onUpdate
 */
class ObservableVector3d extends Vector3d {

    constructor(x = 0, y = 0, z = 0, settings) {
        super(x, y, z);
        if (typeof(settings) === "undefined") {
            throw new Error(
                "undefined `onUpdate` callback"
            );
        }
        this.setCallback(settings.onUpdate, settings.scope);
    }

    /**
     * @ignore
     */
    onResetEvent(x = 0, y = 0, z = 0, settings) {
        // init is call by the constructor and does not trigger the cb
        this.setMuted(x, y, z);
        if (typeof settings !== "undefined") {
            this.setCallback(settings.onUpdate, settings.scope);
        }
        return this;
    }

    /**
     * x value of the vector
     * @public
     * @type {number}
     * @name x
     * @memberof me.ObservableVector3d
     */

    get x() {
        return this._x;
    }

    set x(value) {
        var ret = this.onUpdate.call(this.scope, value, this._y, this._z, this._x, this._y, this._z);
        if (ret && "x" in ret) {
            this._x = ret.x;
        } else {
            this._x = value;
        }
    }

    /**
     * y value of the vector
     * @public
     * @type {number}
     * @name y
     * @memberof me.ObservableVector3d
     */

    get y() {
        return this._y;
    }

    set y(value) {
        var ret = this.onUpdate.call(this.scope, this._x, value, this._z, this._x, this._y, this._z);
        if (ret && "y" in ret) {
            this._y = ret.y;
        } else {
            this._y = value;
        }
    }


    /**
     * z value of the vector
     * @public
     * @type {number}
     * @name z
     * @memberof me.ObservableVector3d
     */


    get z() {
        return this._z;
    }

    set z(value) {
        var ret = this.onUpdate.call(this.scope, this._x, this._y, value, this._x, this._y, this._z);
        if (ret && "z" in ret) {
            this._z = ret.z;
        } else {
            this._z = value;
        }
    }

    /**
     * @ignore
     */
    _set(x, y, z) {
        var ret = this.onUpdate.call(this.scope, x, y, z, this._x, this._y, this._z);
        if (ret && "x" in ret && "y" in ret && "z" in ret) {
            this._x = ret.x;
            this._y = ret.y;
            this._z = ret.z;
        } else {
          this._x = x;
          this._y = y;
          this._z = z || 0;
        }
        return this;
    }

    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberof me.ObservableVector3d
     * @function
     * @param {number} x x value of the vector
     * @param {number} y y value of the vector
     * @param {number} [z=0] z value of the vector
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    setMuted(x, y, z) {
        this._x = x;
        this._y = y;
        this._z = z || 0;
        return this;
    }

    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberof me.ObservableVector3d
     * @function
     * @param {Function} fn callback
     * @param {Function} [scope=null] scope
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    setCallback(fn, scope = null) {
        if (typeof(fn) !== "function") {
            throw new Error(
                "invalid `onUpdate` callback"
            );
        }
        this.onUpdate = fn;
        this.scope = scope;
        return this;
    }

    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this._x + v.x, this._y + v.y, this._z + (v.z || 0));
    }

    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this._x - v.x, this._y - v.y, this._z - (v.z || 0));
    }

    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof me.ObservableVector3d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @param {number} [z=1]
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    scale(x, y, z) {
        y = (typeof (y) !== "undefined" ? y : x);
        return this._set(this._x * x, this._y * y, this._z * (z || 1));
    }

    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this._set(this._x * v.x, this._y * v.y, this._z * (v.z || 1));
    }

    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof me.ObservableVector3d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this._x / n, this._y / n, this._z / n);
    }

    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    abs() {
        return this._set(
            (this._x < 0) ? -this._x : this._x,
            (this._y < 0) ? -this._y : this._y,
            (this._Z < 0) ? -this._z : this._z
        );
    }

    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof me.ObservableVector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    clamp(low, high) {
        return new ObservableVector3d(
            clamp(this._x, low, high),
            clamp(this._y, low, high),
            clamp(this._z, low, high),
            {onUpdate: this.onUpdate, scope: this.scope}
        );
    }

    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof me.ObservableVector3d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(
            clamp(this._x, low, high),
            clamp(this._y, low, high),
            clamp(this._z, low, high)
        );
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    minV(v) {
        var _vz = v.z || 0;
        return this._set(
            (this._x < v.x) ? this._x : v.x,
            (this._y < v.y) ? this._y : v.y,
            (this._z < _vz) ? this._z : _vz
        );
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    maxV(v) {
        var _vz = v.z || 0;
        return this._set(
            (this._x > v.x) ? this._x : v.x,
            (this._y > v.y) ? this._y : v.y,
            (this._z > _vz) ? this._z : _vz
        );
    }

    /**
     * Floor the vector values
     * @name floor
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    floor() {
        return new ObservableVector3d(
            Math.floor(this._x),
            Math.floor(this._y),
            Math.floor(this._z),
            {onUpdate: this.onUpdate, scope: this.scope}
        );
    }

    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this._x), Math.floor(this._y), Math.floor(this._z));
    }

    /**
     * Ceil the vector values
     * @name ceil
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    ceil() {
        return new ObservableVector3d(
            Math.ceil(this._x),
            Math.ceil(this._y),
            Math.ceil(this._z),
            {onUpdate: this.onUpdate, scope: this.scope}
        );
    }

    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this._x), Math.ceil(this._y), Math.ceil(this._z));
    }

    /**
     * Negate the vector values
     * @name negate
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    negate() {
        return new ObservableVector3d(
            -this._x,
            -this._y,
            -this._z,
            {onUpdate: this.onUpdate, scope: this.scope}
        );
    }

    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this._x, -this._y, -this._z);
    }

    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y, v.z || 0);
    }

    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {boolean}
     */
    equals(v) {
        return ((this._x === v.x) && (this._y === v.y) && (this._z === (v.z || this._z)));
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this._y, -this._x, this._z);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof me.ObservableVector3d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around (on the same z axis)
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
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
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {number} The dot product.
     */
    dot(v) {
        return this._x * v.x + this._y * v.y + this._z * (v.z || 1);
    }

    /**
     * calculate the cross product of this vector and the passed one
     * @name cross
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector3d|me.ObservableVector3d} v
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    cross(v) {
        var ax = this._x, ay = this._y, az = this._z;
        var bx = v.x, by = v.y, bz = v.z;

        return this._set(
            ay * bz - az * by,
            az * bx - ax * bz,
            ax * by - ay * bx
        );
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector3d|me.ObservableVector3d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.ObservableVector3d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        this._x += ( v.x - this._x ) * alpha;
        this._y += ( v.y - this._y ) * alpha;
        this._z += ( v.z - this._z ) * alpha;
        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof me.ObservableVector3d
     * @function
     * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
     * @returns {number}
     */
    distance(v) {
        var dx = this._x - v.x;
        var dy = this._y - v.y;
        var dz = this._z - (v.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.ObservableVector3d} new me.ObservableVector3d
     */
    clone() {
        return pool.pull("ObservableVector3d",
            this._x,
            this._y,
            this._z,
            {onUpdate: this.onUpdate}
        );
    }

    /**
     * return a `me.Vector3d` copy of this `me.ObservableVector3d` object
     * @name toVector3d
     * @memberof me.ObservableVector3d
     * @function
     * @returns {me.Vector3d} new me.Vector3d
     */
    toVector3d() {
        return pool.pull("Vector3d", this._x, this._y, this._z);
    }

    /**
     * convert the object to a string representation
     * @name toString
     * @memberof me.ObservableVector3d
     * @function
     * @returns {string}
     */
    toString() {
        return "x:" + this._x + ",y:" + this._y + ",z:" + this._z;
    }
};

export default ObservableVector3d;
