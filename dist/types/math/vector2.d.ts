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
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     * @ignore
     */
    onResetEvent(x?: number | undefined, y?: number | undefined): void;
    /**
     * x value of the vector
     * @type {number}
     */
    x: number | undefined;
    /**
     * y value of the vector
     * @type {number}
     */
    y: number | undefined;
    /**
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     * @ignore
     */
    _set(x?: number | undefined, y?: number | undefined): this;
    /**
     * set the Vector x and y properties to the given values
     * @param {number} x
     * @param {number} y
     * @returns {Vector2d} Reference to this object for method chaining
     */
    set(x: number, y: number): Vector2d;
    /**
     * set the Vector x and y properties to 0
     * @returns {Vector2d} Reference to this object for method chaining
     */
    setZero(): Vector2d;
    /**
     * set the Vector x and y properties using the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    setV(v: Vector2d): Vector2d;
    /**
     * Add the passed vector to this vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    add(v: Vector2d): Vector2d;
    /**
     * Substract the passed vector to this vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    sub(v: Vector2d): Vector2d;
    /**
     * Multiply this vector values by the given scalar
     * @param {number} x
     * @param {number} [y=x]
     * @returns {Vector2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Vector2d;
    /**
     * Convert this vector into isometric coordinate space
     * @returns {Vector2d} Reference to this object for method chaining
     */
    toIso(): Vector2d;
    /**
     * Convert this vector into 2d coordinate space
     * @returns {Vector2d} Reference to this object for method chaining
     */
    to2d(): Vector2d;
    /**
     * Multiply this vector values by the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Vector2d;
    /**
     * Divide this vector values by the passed value
     * @param {number} n - the value to divide the vector by
     * @returns {Vector2d} Reference to this object for method chaining
     */
    div(n: number): Vector2d;
    /**
     * Update this vector values to absolute values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    abs(): Vector2d;
    /**
     * Clamp the vector value within the specified value range
     * @param {number} low
     * @param {number} high
     * @returns {Vector2d} new me.Vector2d
     */
    clamp(low: number, high: number): Vector2d;
    /**
     * Clamp this vector value within the specified value range
     * @param {number} low
     * @param {number} high
     * @returns {Vector2d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): Vector2d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    minV(v: Vector2d): Vector2d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    maxV(v: Vector2d): Vector2d;
    /**
     * Floor the vector values
     * @returns {Vector2d} new me.Vector2d
     */
    floor(): Vector2d;
    /**
     * Floor this vector values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    floorSelf(): Vector2d;
    /**
     * Ceil the vector values
     * @returns {Vector2d} new me.Vector2d
     */
    ceil(): Vector2d;
    /**
     * Ceil this vector values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    ceilSelf(): Vector2d;
    /**
     * Negate the vector values
     * @returns {Vector2d} new me.Vector2d
     */
    negate(): Vector2d;
    /**
     * Negate this vector values
     * @returns {Vector2d} Reference to this object for method chaining
     */
    negateSelf(): Vector2d;
    /**
     * Copy the x,y values of the passed vector to this one
     * @param {Vector2d} v
     * @returns {Vector2d} Reference to this object for method chaining
     */
    copy(v: Vector2d): Vector2d;
    /**
     * return true if this vector is equal to the given values or vector
     * @param {number|Vector2d} x
     * @param {number} [y]
     * @returns {boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @returns {Vector2d} Reference to this object for method chaining
     */
    normalize(): Vector2d;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction)
     * @returns {Vector2d} Reference to this object for method chaining
     */
    perp(): Vector2d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d} [v] - an optional point to rotate around
     * @returns {Vector2d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | undefined): Vector2d;
    /**
     * return the dot product of this vector and the passed one
     * @param {Vector2d} v
     * @returns {number} The dot product.
     */
    dot(v: Vector2d): number;
    /**
     * return the cross product of this vector and the passed one
     * @param {Vector2d} v
     * @returns {number} The cross product.
     */
    cross(v: Vector2d): number;
    /**
    * return the square length of this vector
    * @returns {number} The length^2 of this vector.
    */
    length2(): number;
    /**
     * return the length (magnitude) of this vector
     * @returns {number} the length of this vector
     */
    length(): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @param {Vector2d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {Vector2d} Reference to this object for method chaining
     */
    lerp(v: Vector2d, alpha: number): Vector2d;
    /**
     * interpolate the position of this vector towards the given one by the given maximum step.
     * @param {Vector2d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {Vector2d} Reference to this object for method chaining
     */
    moveTowards(target: Vector2d, step: number): Vector2d;
    /**
     * return the distance between this vector and the passed one
     * @param {Vector2d} v
     * @returns {number}
     */
    distance(v: Vector2d): number;
    /**
     * return the angle between this vector and the passed one
     * @param {Vector2d} v
     * @returns {number} angle in radians
     */
    angle(v: Vector2d): number;
    /**
     * project this vector on to another vector.
     * @param {Vector2d} v - The vector to project onto.
     * @returns {Vector2d} Reference to this object for method chaining
     */
    project(v: Vector2d): Vector2d;
    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @param {Vector2d} v - The unit vector to project onto.
     * @returns {Vector2d} Reference to this object for method chaining
     */
    projectN(v: Vector2d): Vector2d;
    /**
     * return a clone copy of this vector
     * @returns {Vector2d} new me.Vector2d
     */
    clone(): Vector2d;
    /**
     * convert the object to a string representation
     * @returns {string}
     */
    toString(): string;
}
