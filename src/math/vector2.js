import {clamp} from "./math.js";
import pool from "./../system/pooling.js";

/**
 * @classdesc
 * a generic 2D Vector Object
 */
export default class Vector2d {
    /**
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     */
    constructor(x = 0, y = 0) {
        this.onResetEvent(x, y);
    }

    /**
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     * @ignore
     */
    onResetEvent(x = 0, y = 0) {
        /**
         * x value of the vector
         * @type {number}
         */
        this.x = x;
        /**
         * y value of the vector
         * @type {number}
         */
        this.y = y;
    }

    /**
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     * @ignore
     */
    _set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    /**
     * set the Vector x and y properties to the given values
     * @param {number} x
     * @param {number} y
     * @returns {Vector2d} Reference to this object for method chaining
     */
    set(x, y) {
        if (x !== +x || y !== +y) {
            throw new Error(
                "invalid x,y parameters (not a number)"
            );
        }
        return this._set(x, y);
    }

    /**
     * set the Vector x and y properties to 0
     * @returns {Vector2d} Reference to this object for method chaining
     */
    setZero() {
        return this.set(0, 0);
    }

    /**
     * set the Vector x and y properties using the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    setV(v) {
        return this._set(v.x, v.y);
    }

    /**
     * Add the passed vector to this vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    add(v) {
        return this._set(this.x + v.x, this.y + v.y);
    }

    /**
     * Substract the passed vector to this vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    sub(v) {
        return this._set(this.x - v.x, this.y - v.y);
    }

    /**
     * Multiply this vector values by the given scalar
     * @param {number} x
     * @param {number} [y=x]
     * @returns {Vector2d} Reference to this object for method chaining
     */
    scale(x, y = x) {
        return this._set(this.x * x, this.y * y);
    }

    /**
     * Convert this vector into isometric coordinate space
     * @returns {Vector2d} Reference to this object for method chaining
     */
    toIso() {
        return this._set(this.x - this.y, (this.x + this.y) * 0.5);
    }

    /**
     * Convert this vector into 2d coordinate space
     * @returns {Vector2d} Reference to this object for method chaining
     */
    to2d() {
        return this._set(this.y + this.x / 2, this.y - this.x / 2);
    }

    /**
     * Multiply this vector values by the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this._set(this.x * v.x, this.y * v.y);
    }

    /**
     * Divide this vector values by the passed value
     * @param {number} n - the value to divide the vector by
     * @returns {Vector2d} Reference to this object for method chaining
     */
    div(n) {
        return this._set(this.x / n, this.y / n);
    }

    /**
     * Update this vector values to absolute values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    abs() {
        return this._set((this.x < 0) ? -this.x : this.x, (this.y < 0) ? -this.y : this.y);
    }

    /**
     * Clamp the vector value within the specified value range
     * @param {number} low
     * @param {number} high
     * @returns {Vector2d} new me.Vector2d
     */
    clamp(low, high) {
        return new Vector2d(clamp(this.x, low, high), clamp(this.y, low, high));
    }

    /**
     * Clamp this vector value within the specified value range
     * @param {number} low
     * @param {number} high
     * @returns {Vector2d} Reference to this object for method chaining
     */
    clampSelf(low, high) {
        return this._set(clamp(this.x, low, high), clamp(this.y, low, high));
    }

    /**
     * Update this vector with the minimum value between this and the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    minV(v) {
        return this._set((this.x < v.x) ? this.x : v.x, (this.y < v.y) ? this.y : v.y);
    }

    /**
     * Update this vector with the maximum value between this and the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    maxV(v) {
        return this._set((this.x > v.x) ? this.x : v.x, (this.y > v.y) ? this.y : v.y);
    }

    /**
     * Floor the vector values
     * @returns {Vector2d} new me.Vector2d
     */
    floor() {
        return new Vector2d(Math.floor(this.x), Math.floor(this.y));
    }

    /**
     * Floor this vector values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    floorSelf() {
        return this._set(Math.floor(this.x), Math.floor(this.y));
    }

    /**
     * Ceil the vector values
     * @returns {Vector2d} new me.Vector2d
     */
    ceil() {
        return new Vector2d(Math.ceil(this.x), Math.ceil(this.y));
    }

    /**
     * Ceil this vector values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    ceilSelf() {
        return this._set(Math.ceil(this.x), Math.ceil(this.y));
    }

    /**
     * Negate the vector values
     * @returns {Vector2d} new me.Vector2d
     */
    negate() {
        return new Vector2d(-this.x, -this.y);
    }

    /**
     * Negate this vector values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    negateSelf() {
        return this._set(-this.x, -this.y);
    }

    /**
     * Copy the x,y values of the passed vector to this one
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    copy(v) {
        return this._set(v.x, v.y);
    }

    /**
     * return true if this vector is equal to the given values or vector
     * @param {number|Vector2d} x
     * @param {number} [y]
     * @returns {boolean}
     */
    equals(...args) {
        let _x, _y;
        if (args.length === 2) {
            // x, y
            [_x, _y] = args;
        } else {
            // vector
            [_x, _y] = [args[0].x, args[0].y];
        }
        return this.x === _x && this.y === _y;
    }

    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @returns {Vector2d} Reference to this object for method chaining
     */
    normalize() {
        return this.div(this.length() || 1);
    }

    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @returns {Vector2d} Reference to this object for method chaining
     */
    perp() {
        return this._set(this.y, -this.x);
    }

    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d} [v] - an optional point to rotate around
     * @returns {Vector2d} Reference to this object for method chaining
     */
    rotate(angle, v) {
        let cx = 0;
        let cy = 0;

        if (typeof v === "object") {
            cx = v.x;
            cy = v.y;
        }

        let x = this.x - cx;
        let y = this.y - cy;

        let c = Math.cos(angle);
        let s = Math.sin(angle);

        return this._set(x * c - y * s + cx, x * s + y * c + cy);
    }

    /**
     * return the dot product of this vector and the passed one
     * @param {Vector2d} v
     * @returns {number} The dot product.
     */
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    /**
     * return the cross product of this vector and the passed one
     * @param {Vector2d} v
     * @returns {number} The cross product.
     */
    cross(v) {
        return this.x * v.y - this.y * v.x;
    }

    /**
    * return the square length of this vector
    * @returns {number} The length^2 of this vector.
    */
    length2() {
        return this.dot(this);
    }

    /**
     * return the length (magnitude) of this vector
     * @returns {number} the length of this vector
     */
    length() {
        return Math.sqrt(this.length2());
    }

    /**
     * Linearly interpolate between this vector and the given one.
     * @param {Vector2d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {Vector2d} Reference to this object for method chaining
     */
    lerp(v, alpha) {
        this.x += (v.x - this.x) * alpha;
        this.y += (v.y - this.y) * alpha;
        return this;
    }

    /**
     * interpolate the position of this vector towards the given one by the given maximum step.
     * @param {Vector2d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {Vector2d} Reference to this object for method chaining
     */
    moveTowards(target, step) {
        let angle = Math.atan2(target.y - this.y, target.x - this.x);

        let distance = this.distance(target);

        if (distance === 0 || (step >= 0 && distance <= step * step)) {
            return target;
        }

        this.x += Math.cos(angle) * step;
        this.y += Math.sin(angle) * step;

        return this;
    }

    /**
     * return the distance between this vector and the passed one
     * @param {Vector2d} v
     * @returns {number}
     */
    distance(v) {
        let dx = this.x - v.x, dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * return the angle between this vector and the passed one
     * @param {Vector2d} v
     * @returns {number} angle in radians
     */
    angle(v) {
        return Math.acos(clamp(this.dot(v) / (this.length() * v.length()), -1, 1));
    }

    /**
     * project this vector on to another vector.
     * @param {Vector2d} v - The vector to project onto.
     * @returns {Vector2d} Reference to this object for method chaining
     */
    project(v) {
        return this.scale(this.dot(v) / v.length2());
    }

    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @param {Vector2d} v - The unit vector to project onto.
     * @returns {Vector2d} Reference to this object for method chaining
     */
    projectN(v) {
        return this.scale(this.dot(v));
    }

    /**
     * return a clone copy of this vector
     * @returns {Vector2d} new me.Vector2d
     */
    clone() {
        return pool.pull("Vector2d", this.x, this.y);
    }

    /**
     * convert the object to a string representation
     * @returns {string}
     */
    toString() {
        return "x:" + this.x + ",y:" + this.y;
    }
}

