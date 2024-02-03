/**
 * @classdesc
 * A Vector2d object that provide notification by executing the given callback when the vector is changed.
 * @augments Vector2d
 */
export default class ObservableVector2d extends Vector2d {
    /**
     * @param {number} x - x value of the vector
     * @param {number} y - y value of the vector
     * @param {object} settings - additional required parameters
     * @param {Function} settings.onUpdate - the callback to be executed when the vector is changed
     * @param {Function} [settings.scope] - the value to use as this when calling onUpdate
     */
    constructor(x: number | undefined, y: number | undefined, settings: {
        onUpdate: Function;
        scope?: Function | undefined;
    });
    /**
     * @ignore
     */
    onResetEvent(x: number | undefined, y: number | undefined, settings: any): void;
    public set x(value: number);
    /**
     * x value of the vector
     * @public
     * @type {number}
     * @name x
     * @memberof ObservableVector2d
     */
    public get x(): number;
    _x: any;
    public set y(value: number);
    /**
     * y value of the vector
     * @public
     * @type {number}
     * @name y
     * @memberof ObservableVector2d
     */
    public get y(): number;
    _y: any;
    /** @ignore */
    _set(x: any, y: any): this;
    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberof ObservableVector2d
     * @param {number} x - x value of the vector
     * @param {number} y - y value of the vector
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    setMuted(x: number, y: number): ObservableVector2d;
    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberof ObservableVector2d
     * @param {Function} fn - callback
     * @param {Function} [scope=null] - scope
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    setCallback(fn: Function, scope?: Function | undefined): ObservableVector2d;
    onUpdate: Function | undefined;
    scope: Function | undefined;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    add(v: ObservableVector2d): ObservableVector2d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    sub(v: ObservableVector2d): ObservableVector2d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof ObservableVector2d
     * @param {number} x
     * @param {number} [y=x]
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): ObservableVector2d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    scaleV(v: ObservableVector2d): ObservableVector2d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof ObservableVector2d
     * @param {number} n - the value to divide the vector by
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    div(n: number): ObservableVector2d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    abs(): ObservableVector2d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof ObservableVector2d
     * @param {number} low
     * @param {number} high
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    clamp(low: number, high: number): ObservableVector2d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof ObservableVector2d
     * @param {number} low
     * @param {number} high
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): ObservableVector2d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    minV(v: ObservableVector2d): ObservableVector2d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    maxV(v: ObservableVector2d): ObservableVector2d;
    /**
     * Floor the vector values
     * @name floor
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    floor(): ObservableVector2d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    floorSelf(): ObservableVector2d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    ceil(): ObservableVector2d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    ceilSelf(): ObservableVector2d;
    /**
     * Negate the vector values
     * @name negate
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    negate(): ObservableVector2d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    negateSelf(): ObservableVector2d;
    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    copy(v: ObservableVector2d): ObservableVector2d;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {boolean}
     */
    equals(v: ObservableVector2d): boolean;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    perp(): ObservableVector2d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof ObservableVector2d
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d | undefined): ObservableVector2d;
    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} v
     * @returns {number} The dot product.
     */
    dot(v: Vector2d | ObservableVector2d): number;
    /**
     * return the cross product of this vector and the passed one
     * @name cross
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} v
     * @returns {number} The cross product.
     */
    cross(v: Vector2d | ObservableVector2d): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    lerp(v: Vector2d | ObservableVector2d, alpha: number): ObservableVector2d;
    /**
     * interpolate the position of this vector towards the given one while nsure that the distance never exceeds the given step.
     * @name moveTowards
     * @memberof ObservableVector2d
     * @param {Vector2d|ObservableVector2d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {ObservableVector2d} Reference to this object for method chaining
     */
    moveTowards(target: Vector2d | ObservableVector2d, step: number): ObservableVector2d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof ObservableVector2d
     * @param {ObservableVector2d} v
     * @returns {number}
     */
    distance(v: ObservableVector2d): number;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof ObservableVector2d
     * @returns {ObservableVector2d} new me.ObservableVector2d
     */
    clone(): ObservableVector2d;
    /**
     * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
     * @name toVector2d
     * @memberof ObservableVector2d
     * @returns {Vector2d} new me.Vector2d
     */
    toVector2d(): Vector2d;
}
import Vector2d from "./vector2.js";
