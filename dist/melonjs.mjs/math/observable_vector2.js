/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import pool from '../system/pooling.js';
import Vector2d from './vector2.js';
import { clamp } from './math.js';

/**
 * @classdesc
 * A Vector2d object that provide notification by executing the given callback when the vector is changed.
 * @augments Vector2d
 */
class ObservableVector2d extends Vector2d {
    /**
     * @param {number} x - x value of the vector
     * @param {number} y - y value of the vector
     * @param {object} settings - additional required parameters
     * @param {Function} settings.onUpdate - the callback to be executed when the vector is changed
     * @param {Function} [settings.scope] - the value to use as this when calling onUpdate
     */
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
    }

    /**
     * x value of the vector
     * @public
     * @type {number}
     * @name x
     * @memberof ObservableVector2d
     */

    get x() {
        return this._x;
    }

    set x(value) {
        let ret = this.onUpdate.call(this.scope, value, this._y, this._x, this._y);
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
     * @memberof ObservableVector2d
     */

    get y() {
        return this._y;
    }

    set y(value) {
        let ret = this.onUpdate.call(this.scope, this._x, value, this._x, this._y);
        if (ret && "y" in ret) {
            this._y = ret.y;
        } else {
            this._y = value;
        }
    }

    /** @ignore */
    _set(x, y) {
        let ret = this.onUpdate.call(this.scope, x, y, this._x, this._y);
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
     * @memberof ObservableVector2d
     * @param {number} x - x value of the vector
     * @param {number} y - y value of the vector
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    setMuted(x, y) {
        this._x = x;
        this._y = y;
        return this;
    }

    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberof ObservableVector2d
     * @param {Function} fn - callback
     * @param {Function} [scope=null] - scope
     * @returns {ObservableVector2d} Reference to this object for method chaining
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
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this._x + v.x, this._y + v.y);
    }

    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this._x - v.x, this._y - v.y);
    }

    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof ObservableVector2d
     * @param {number} x
     * @param {number} [y=x]
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    scale(x, y = x) {
        return this._set(this._x * x, this._y * y);
    }

    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this._set(this._x * v.x, this._y * v.y);
    }

    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof ObservableVector2d
     * @param {number} n - the value to divide the vector by
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this._x / n, this._y / n);
    }

    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    abs() {
        return this._set((this._x < 0) ? -this._x : this._x, (this._y < 0) ? -this._y : this._y);
    }

    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof ObservableVector2d
     * @param {number} low
     * @param {number} high
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    clamp(low, high) {
        return new ObservableVector2d(clamp(this.x, low, high), clamp(this.y, low, high), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof ObservableVector2d
     * @param {number} low
     * @param {number} high
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(clamp(this._x, low, high), clamp(this._y, low, high));
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    minV(v) {
        return this._set((this._x < v.x) ? this._x : v.x, (this._y < v.y) ? this._y : v.y);
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    maxV(v) {
        return this._set((this._x > v.x) ? this._x : v.x, (this._y > v.y) ? this._y : v.y);
    }

    /**
     * Floor the vector values
     * @name floor
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    floor() {
        return new ObservableVector2d(Math.floor(this._x), Math.floor(this._y), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this._x), Math.floor(this._y));
    }

    /**
     * Ceil the vector values
     * @name ceil
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    ceil() {
        return new ObservableVector2d(Math.ceil(this._x), Math.ceil(this._y), {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this._x), Math.ceil(this._y));
    }

    /**
     * Negate the vector values
     * @name negate
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    negate() {
        return new ObservableVector2d(-this._x, -this._y, {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this._x, -this._y);
    }

    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y);
    }

    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {boolean}
     */
    equals(v) {
        return ((this._x === v.x) && (this._y === v.y));
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this._y, -this._x);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof ObservableVector2d
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    rotate(angle, v) {
        let cx = 0;
        let cy = 0;

        if (typeof v === "object") {
            cx = v.x;
            cy = v.y;
        }

        let x = this._x - cx;
        let y = this._y - cy;

        let c = Math.cos(angle);
        let s = Math.sin(angle);

        return this._set(x * c - y * s + cx, x * s + y * c + cy);
    }

    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} v
     * @returns {number} The dot product.
     */
    dot(v) {
        return this._x * v.x + this._y * v.y;
    }

    /**
     * return the cross product of this vector and the passed one
     * @name cross
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} v
     * @returns {number} The cross product.
     */
    cross(v) {
        return this._x * v.y - this._y * v.x;
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        return this._set(
            this._x + (v.x - this._x) * alpha,
            this._y + (v.y - this._y) * alpha
        );
    }

    /**
     * interpolate the position of this vector towards the given one while nsure that the distance never exceeds the given step.
     * @name moveTowards
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    moveTowards(target, step) {
        let angle = Math.atan2(target.y - this._y, target.x - this._x);

        let distance = this.distance(target);

        if (distance === 0 || (step >= 0 && distance <= step * step)) {
            return target;
        }

        this._x += Math.cos(angle) * step;
        this._y += Math.sin(angle) * step;

        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {number}
     */
    distance(v) {
        return Math.sqrt((this._x - v.x) * (this._x - v.x) + (this._y - v.y) * (this._y - v.y));
    }

    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    clone() {
        return pool.pull("ObservableVector2d", this._x, this._y, {onUpdate: this.onUpdate, scope: this.scope});
    }

    /**
     * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
     * @name toVector2d
     * @memberof ObservableVector2d
     * @returns {Vector2d} new me.Vector2d
     */
    toVector2d() {
        return pool.pull("Vector2d", this._x, this._y);
    }

    /**
     * convert the object to a string representation
     * @name toString
     * @memberof ObservableVector2d
     * @returns {string}
     */
    toString() {
        return "x:" + this._x + ",y:" + this._y;
    }
}

export { ObservableVector2d as default };
