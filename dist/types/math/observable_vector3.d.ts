/**
 * additional import for TypeScript
 * @import ObservableVector2d from "./observable_vector2.js";
 * @import Vector2d from "./vector2.js";
 */
/**
 * @classdesc
 * A Vector3d object that provide notification by executing the given callback when the vector is changed.
 * @augments Vector3d
 */
export default class ObservableVector3d extends Vector3d {
    /**
     * @param {number} x - x value of the vector
     * @param {number} y - y value of the vector
     * @param {number} z - z value of the vector
     * @param {object} settings - additional required parameters
     * @param {Function} settings.onUpdate - the callback to be executed when the vector is changed
     * @param {object} [settings.scope] - the value to use as this when calling onUpdate
     */
    constructor(x: number | undefined, y: number | undefined, z: number | undefined, settings: {
        onUpdate: Function;
        scope?: object | undefined;
    });
    /**
     * @ignore
     */
    onResetEvent(x: number | undefined, y: number | undefined, z: number | undefined, settings: any): this;
    public set x(value: number);
    /**
     * x value of the vector
     * @public
     * @type {number}
     * @name x
     * @memberof ObservableVector3d
     */
    public get x(): number;
    _x: any;
    public set y(value: number);
    /**
     * y value of the vector
     * @public
     * @type {number}
     * @name y
     * @memberof ObservableVector3d
     */
    public get y(): number;
    _y: any;
    public set z(value: number);
    /**
     * z value of the vector
     * @public
     * @type {number}
     * @name z
     * @memberof ObservableVector3d
     */
    public get z(): number;
    _z: any;
    /**
     * @ignore
     */
    _set(x: any, y: any, z: any): this;
    /**
     * set the vector value without triggering the callback
     * @name setMuted
     * @memberof ObservableVector3d
     * @param {number} x - x value of the vector
     * @param {number} y - y value of the vector
     * @param {number} [z=0] - z value of the vector
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    setMuted(x: number, y: number, z?: number | undefined): ObservableVector3d;
    /**
     * set the callback to be executed when the vector is changed
     * @name setCallback
     * @memberof ObservableVector3d
     * @param {Function} fn - callback
     * @param {Function} [scope=null] - scope
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    setCallback(fn: Function, scope?: Function | undefined): ObservableVector3d;
    onUpdate: Function | undefined;
    scope: Function | undefined;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    add(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    sub(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof ObservableVector3d
     * @param {number} x
     * @param {number} [y=x]
     * @param {number} [z=1]
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined, z?: number | undefined): ObservableVector3d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    scaleV(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof ObservableVector3d
     * @param {number} n - the value to divide the vector by
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    div(n: number): ObservableVector3d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    abs(): ObservableVector3d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof ObservableVector3d
     * @param {number} low
     * @param {number} high
     * @returns {ObservableVector3d} new me.ObservableVector3d
     */
    clamp(low: number, high: number): ObservableVector3d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof ObservableVector3d
     * @param {number} low
     * @param {number} high
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): ObservableVector3d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    minV(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    maxV(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
    /**
     * Floor the vector values
     * @name floor
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} new me.ObservableVector3d
     */
    floor(): ObservableVector3d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    floorSelf(): ObservableVector3d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} new me.ObservableVector3d
     */
    ceil(): ObservableVector3d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    ceilSelf(): ObservableVector3d;
    /**
     * Negate the vector values
     * @name negate
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} new me.ObservableVector3d
     */
    negate(): ObservableVector3d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    negateSelf(): ObservableVector3d;
    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    copy(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): ObservableVector3d;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {boolean}
     */
    equals(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): boolean;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    perp(): ObservableVector3d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof ObservableVector3d
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around (on the same z axis)
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d | undefined): ObservableVector3d;
    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {number} The dot product.
     */
    dot(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): number;
    /**
     * calculate the cross product of this vector and the passed one
     * @name cross
     * @memberof ObservableVector3d
     * @param {Vector3d|ObservableVector3d} v
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    cross(v: Vector3d | ObservableVector3d): ObservableVector3d;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof ObservableVector3d
     * @param {Vector3d|ObservableVector3d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    lerp(v: Vector3d | ObservableVector3d, alpha: number): ObservableVector3d;
    /**
     * interpolate the position of this vector on the x and y axis towards the given one while ensure that the distance never exceeds the given step.
     * @name moveTowards
     * @memberof ObservableVector3d
     * @param {Vector2d|ObservableVector2d|Vector3d|ObservableVector3d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {ObservableVector3d} Reference to this object for method chaining
     */
    moveTowards(target: Vector2d | ObservableVector2d | Vector3d | ObservableVector3d, step: number): ObservableVector3d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof ObservableVector3d
     * @param {Vector2d|Vector3d|ObservableVector2d|ObservableVector3d} v
     * @returns {number}
     */
    distance(v: Vector2d | Vector3d | ObservableVector2d | ObservableVector3d): number;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof ObservableVector3d
     * @returns {ObservableVector3d} new me.ObservableVector3d
     */
    clone(): ObservableVector3d;
    /**
     * return a `me.Vector3d` copy of this `me.ObservableVector3d` object
     * @name toVector3d
     * @memberof ObservableVector3d
     * @returns {Vector3d} new me.Vector3d
     */
    toVector3d(): Vector3d;
}
import Vector3d from "./vector3.js";
import type Vector2d from "./vector2.js";
import type ObservableVector2d from "./observable_vector2.js";
