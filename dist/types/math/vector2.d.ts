/**
 * @classdesc
 * a generic 2D Vector Object
 */
export default class Vector2d {
    /**
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     */
    constructor(x?: number | undefined, y?: number | undefined);
    /**
     * @ignore
     */
    onResetEvent(x?: number, y?: number): Vector2d;
    x: any;
    y: any;
    /**
     * @ignore
     */
    _set(x: any, y: any): Vector2d;
    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberof Vector2d
     * @param {number} x
     * @param {number} y
     * @returns {Vector2d} Reference to this object for method chaining
     */
    set(x: number, y: number): Vector2d;
    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    setZero(): Vector2d;
    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    setV(v: Vector2d): Vector2d;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    add(v: Vector2d): Vector2d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    sub(v: Vector2d): Vector2d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof Vector2d
     * @param {number} x
     * @param {number} [y=x]
     * @returns {Vector2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Vector2d;
    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    toIso(): Vector2d;
    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    to2d(): Vector2d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Vector2d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof Vector2d
     * @param {number} n - the value to divide the vector by
     * @returns {Vector2d} Reference to this object for method chaining
     */
    div(n: number): Vector2d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    abs(): Vector2d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof Vector2d
     * @param {number} low
     * @param {number} high
     * @returns {Vector2d} new me.Vector2d
     */
    clamp(low: number, high: number): Vector2d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof Vector2d
     * @param {number} low
     * @param {number} high
     * @returns {Vector2d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): Vector2d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    minV(v: Vector2d): Vector2d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    maxV(v: Vector2d): Vector2d;
    /**
     * Floor the vector values
     * @name floor
     * @memberof Vector2d
     * @returns {Vector2d} new me.Vector2d
     */
    floor(): Vector2d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    floorSelf(): Vector2d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberof Vector2d
     * @returns {Vector2d} new me.Vector2d
     */
    ceil(): Vector2d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    ceilSelf(): Vector2d;
    /**
     * Negate the vector values
     * @name negate
     * @memberof Vector2d
     * @returns {Vector2d} new me.Vector2d
     */
    negate(): Vector2d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    negateSelf(): Vector2d;
    /**
     * Copy the x,y values of the passed vector to this one
     * @name copy
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    copy(v: Vector2d): Vector2d;
    /**
     * return true if the two vectors are the same
     * @name equals
     * @memberof Vector2d
     * @method
     * @param {Vector2d} v
     * @returns {boolean}
     */
    /**
     * return true if this vector is equal to the given values
     * @name equals
     * @memberof Vector2d
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    normalize(): Vector2d;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @name perp
     * @memberof Vector2d
     * @returns {Vector2d} Reference to this object for method chaining
     */
    perp(): Vector2d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof Vector2d
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {Vector2d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d): Vector2d;
    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {number} The dot product.
     */
    dot(v: Vector2d): number;
    /**
     * return the cross product of this vector and the passed one
     * @name cross
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {number} The cross product.
     */
    cross(v: Vector2d): number;
    /**
     * return the square length of this vector
     * @name length2
     * @memberof Vector2d
     * @returns {number} The length^2 of this vector.
     */
    length2(): number;
    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberof Vector2d
     * @returns {number} the length of this vector
     */
    length(): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof Vector2d
     * @param {Vector2d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {Vector2d} Reference to this object for method chaining
     */
    lerp(v: Vector2d, alpha: number): Vector2d;
    /**
     * interpolate the position of this vector towards the given one by the given maximum step.
     * @name moveTowards
     * @memberof Vector2d
     * @param {Vector2d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {Vector2d} Reference to this object for method chaining
     */
    moveTowards(target: Vector2d, step: number): Vector2d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {number}
     */
    distance(v: Vector2d): number;
    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberof Vector2d
     * @param {Vector2d} v
     * @returns {number} angle in radians
     */
    angle(v: Vector2d): number;
    /**
     * project this vector on to another vector.
     * @name project
     * @memberof Vector2d
     * @param {Vector2d} v - The vector to project onto.
     * @returns {Vector2d} Reference to this object for method chaining
     */
    project(v: Vector2d): Vector2d;
    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberof Vector2d
     * @param {Vector2d} v - The unit vector to project onto.
     * @returns {Vector2d} Reference to this object for method chaining
     */
    projectN(v: Vector2d): Vector2d;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof Vector2d
     * @returns {Vector2d} new me.Vector2d
     */
    clone(): Vector2d;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberof Vector2d
     * @returns {string}
     */
    toString(): string;
}
