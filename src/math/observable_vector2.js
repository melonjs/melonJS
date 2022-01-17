import pool from "./../system/pooling.js";
import Vector2d from "./vector2.js";
import {clamp} from "./math.js";

/**
 * @classdesc
 * A Vector2d object that provide notification by executing the given callback when the vector is changed.
 * @class ObservableVector2d
 * @augments me.Vector2d
 * @memberof me
 * @param {number} [x=0] x value of the vector
 * @param {number} [y=0] y value of the vector
 * @param {object} settings additional required parameters
 * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
 * @param {Function} [settings.scope] the value to use as this when calling onUpdate
 */
class ObservableVector2d extends Vector2d {

    constructor(x = 0, y = 0, settings) {
        super(x, y);
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
    onResetEvent(x = 0, y = 0, settings) {
        // init is call by the constructor and does not trigger the cb
        this.setMuted(x, y);
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
     * @memberof me.ObservableVector2d
     */

    get x() {
        return this._x;
    }

    set x(value) {
        var ret = this.onUpdate.call(this.scope, value, this._y, this._x, this._y);
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
     * @memberof me.ObservableVector2d
     */

    get y() {
        return this._y;
    }

    set y(value) {
        var ret = this.onUpdate.call(this.scope, this._x, value, this._x, this._y);
        if (ret && "y" in ret) {
            this._y = ret.y;
        } else {
            this._y = value;
        }
    }

    /** @ignore */
    _set(x, y) {
        var ret = this.onUpdate.call(this.scope, x, y, this._x, this._y);
        if (ret && "x" in ret && "y" in ret) {
            this._x = ret.x;
            this._y = ret.y;
        } else {
          this._x = x;
          this._y = y;
       }
       return this;
    }

    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberof me.ObservableVector2d
     * @function
     * @param {number} x x value of the vector
     * @param {number} y y value of the vector
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    setMuted(x, y) {
        this._x = x;
        this._y = y;
        return this;
    }

    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberof me.ObservableVector2d
     * @function
     * @param {Function} fn callback
     * @param {Function} [scope=null] scope
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
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
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this._x + v.x, this._y + v.y);
    }

    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this._x - v.x, this._y - v.y);
    }

    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof me.ObservableVector2d
     * @function
     * @param {number} x
     * @param {number} [y=x]
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    scale(x, y) {
        return this._set(this._x * x, this._y * (typeof (y) !== "undefined" ? y : x));
    }

    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this._set(this._x * v.x, this._y * v.y);
    }

    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof me.ObservableVector2d
     * @function
     * @param {number} n the value to divide the vector by
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this._x / n, this._y / n);
    }

    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    abs() {
        return this._set((this._x < 0) ? -this._x : this._x, (this._y < 0) ? -this._y : this._y);
    }

    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof me.ObservableVector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    clamp(low, high) {
        return new ObservableVector2d(clamp(this.x, low, high), clamp(this.y, low, high), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof me.ObservableVector2d
     * @function
     * @param {number} low
     * @param {number} high
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(clamp(this._x, low, high), clamp(this._y, low, high));
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    minV(v) {
        return this._set((this._x < v.x) ? this._x : v.x, (this._y < v.y) ? this._y : v.y);
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    maxV(v) {
        return this._set((this._x > v.x) ? this._x : v.x, (this._y > v.y) ? this._y : v.y);
    }

    /**
     * Floor the vector values
     * @name floor
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    floor() {
        return new ObservableVector2d(Math.floor(this._x), Math.floor(this._y), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this._x), Math.floor(this._y));
    }

    /**
     * Ceil the vector values
     * @name ceil
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    ceil() {
        return new ObservableVector2d(Math.ceil(this._x), Math.ceil(this._y), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this._x), Math.ceil(this._y));
    }

    /**
     * Negate the vector values
     * @name negate
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    negate() {
        return new ObservableVector2d(-this._x, -this._y, {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this._x, -this._y);
    }

    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y);
    }

    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {boolean}
     */
    equals(v) {
        return ((this._x === v.x) && (this._y === v.y));
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this._y, -this._x);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof me.ObservableVector2d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    rotate(angle, v) {
        var cx = 0;
        var cy = 0;

        if (typeof v === "object") {
            cx = v.x;
            cy = v.y;
        }

        var x = this._x - cx;
        var y = this._y - cy;

        var c = Math.cos(angle);
        var s = Math.sin(angle);

        return this._set(x * c - y * s + cx, x * s + y * c + cy);
    }

    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @returns {number} The dot product.
     */
    dot(v) {
        return this._x * v.x + this._y * v.y;
    }

    /**
     * return the cross product of this vector and the passed one
     * @name cross
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @returns {number} The cross product.
     */
    cross(v) {
        return this._x * v.y - this._y * v.x;
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @param {number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {me.ObservableVector2d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        this._x += ( v.x - this._x ) * alpha;
        this._y += ( v.y - this._y ) * alpha;
        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @returns {number}
     */
    distance(v) {
        return Math.sqrt((this._x - v.x) * (this._x - v.x) + (this._y - v.y) * (this._y - v.y));
    }

    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.ObservableVector2d} new me.ObservableVector2d
     */
    clone() {
        return pool.pull("ObservableVector2d", this._x, this._y, {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
     * @name toVector2d
     * @memberof me.ObservableVector2d
     * @function
     * @returns {me.Vector2d} new me.Vector2d
     */
    toVector2d() {
        return pool.pull("Vector2d", this._x, this._y);
    }

    /**
     * convert the object to a string representation
     * @name toString
     * @memberof me.ObservableVector2d
     * @function
     * @returns {string}
     */
    toString() {
        return "x:" + this._x + ",y:" + this._y;
    }
};

export default ObservableVector2d;
