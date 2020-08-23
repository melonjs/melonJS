import pool from "./../system/pooling.js";
import Vector2d from "./vector2.js";
import {clamp} from "./math.js";

/**
 * @classdesc
 * A Vector2d object that provide notification by executing the given callback when the vector is changed.
 * @class ObservableVector2d
 * @extends me.Vector2d
 * @memberOf me
 * @constructor
 * @param {Number} [x=0] x value of the vector
 * @param {Number} [y=0] y value of the vector
 * @param {Object} settings additional required parameters
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
     * @type Number
     * @name x
     * @memberOf me.ObservableVector2d
     */

    /**
     * @ignore
     */
    get x() {
        return this._x;
    }

    /**
     * @ignore
     */
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
     * @type Number
     * @name y
     * @memberOf me.ObservableVector2d
     */

    /**
     * @ignore
     */
    get y() {
        return this._y;
    }

    /**
     * @ignore
     */
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
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} x x value of the vector
     * @param {Number} y y value of the vector
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    setMuted(x, y) {
        this._x = x;
        this._y = y;
        return this;
    }

    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberOf me.ObservableVector2d
     * @function
     * @param {function} onUpdate callback
     * @param {function} [scope=null] scope
     * @return {me.ObservableVector2d} Reference to this object for method chaining
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
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this._x + v.x, this._y + v.y);
    }

    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this._x - v.x, this._y - v.y);
    }

    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} x
     * @param {Number} [y=x]
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    scale(x, y) {
        return this._set(this._x * x, this._y * (typeof (y) !== "undefined" ? y : x));
    }

    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this._set(this._x * v.x, this._y * v.y);
    }

    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} value
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this._x / n, this._y / n);
    }

    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    abs() {
        return this._set((this._x < 0) ? -this._x : this._x, (this._y < 0) ? -this._y : this._y);
    }

    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    clamp(low, high) {
        return new ObservableVector2d(clamp(this.x, low, high), clamp(this.y, low, high), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @param {Number} low
     * @param {Number} high
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(clamp(this._x, low, high), clamp(this._y, low, high));
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    minV(v) {
        return this._set((this._x < v.x) ? this._x : v.x, (this._y < v.y) ? this._y : v.y);
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    maxV(v) {
        return this._set((this._x > v.x) ? this._x : v.x, (this._y > v.y) ? this._y : v.y);
    }

    /**
     * Floor the vector values
     * @name floor
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    floor() {
        return new ObservableVector2d(Math.floor(this._x), Math.floor(this._y), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Floor this vector values
     * @name floorSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this._x), Math.floor(this._y));
    }

    /**
     * Ceil the vector values
     * @name ceil
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    ceil() {
        return new ObservableVector2d(Math.ceil(this._x), Math.ceil(this._y), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this._x), Math.ceil(this._y));
    }

    /**
     * Negate the vector values
     * @name negate
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    negate() {
        return new ObservableVector2d(-this._x, -this._y, {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Negate this vector values
     * @name negateSelf
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this._x, -this._y);
    }

    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y);
    }

    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {Boolean}
     */
    equals(v) {
        return ((this._x === v.x) && (this._y === v.y));
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this._y, -this._x);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberOf me.ObservableVector2d
     * @function
     * @param {number} angle The angle to rotate (in radians)
     * @param {me.Vector2d|me.ObservableVector2d} [v] an optional point to rotate around
     * @return {me.ObservableVector2d} Reference to this object for method chaining
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
     * @name dotProduct
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @return {Number} The dot product.
     */
    dotProduct(v) {
        return this._x * v.x + this._y * v.y;
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.Vector2d|me.ObservableVector2d} v
     * @param {Number} alpha distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @return {me.ObservableVector2d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        this._x += ( v.x - this._x ) * alpha;
        this._y += ( v.y - this._y ) * alpha;
        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberOf me.ObservableVector2d
     * @function
     * @param {me.ObservableVector2d} v
     * @return {Number}
     */
    distance(v) {
        return Math.sqrt((this._x - v.x) * (this._x - v.x) + (this._y - v.y) * (this._y - v.y));
    }

    /**
     * return a clone copy of this vector
     * @name clone
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.ObservableVector2d} new me.ObservableVector2d
     */
    clone() {
        return pool.pull("me.ObservableVector2d", this._x, this._y, {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
     * @name toVector2d
     * @memberOf me.ObservableVector2d
     * @function
     * @return {me.Vector2d} new me.Vector2d
     */
    toVector2d() {
        return pool.pull("me.Vector2d", this._x, this._y);
    }

    /**
     * convert the object to a string representation
     * @name toString
     * @memberOf me.ObservableVector2d
     * @function
     * @return {String}
     */
    toString() {
        return "x:" + this._x + ",y:" + this._y;
    }
};

export default ObservableVector2d;
