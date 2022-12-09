/**
 * @classdesc
 * a generic 3D Vector Object
 */
export default class Vector3d {
    /**
     * @param {number} [x=0] - x value of the vector
     * @param {number} [y=0] - y value of the vector
     * @param {number} [z=0] - z value of the vector
     */
    constructor(x?: number | undefined, y?: number | undefined, z?: number | undefined);
    /**
     * @ignore
     */
    onResetEvent(x?: number, y?: number, z?: number): Vector3d;
    x: any;
    y: any;
    z: any;
    /**
     * @ignore
     */
    _set(x: any, y: any, z?: number): Vector3d;
    /**
     * set the Vector x and y properties to the given values<br>
     * @name set
     * @memberof Vector3d
     * @param {number} x
     * @param {number} y
     * @param {number} [z=0]
     * @returns {Vector3d} Reference to this object for method chaining
     */
    set(x: number, y: number, z?: number | undefined): Vector3d;
    /**
     * set the Vector x and y properties to 0
     * @name setZero
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    setZero(): Vector3d;
    /**
     * set the Vector x and y properties using the passed vector
     * @name setV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    setV(v: Vector2d | Vector3d): Vector3d;
    /**
     * Add the passed vector to this vector
     * @name add
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    add(v: Vector2d | Vector3d): Vector3d;
    /**
     * Substract the passed vector to this vector
     * @name sub
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    sub(v: Vector2d | Vector3d): Vector3d;
    /**
     * Multiply this vector values by the given scalar
     * @name scale
     * @memberof Vector3d
     * @param {number} x
     * @param {number} [y=x]
     * @param {number} [z=1]
     * @returns {Vector3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined, z?: number | undefined): Vector3d;
    /**
     * Multiply this vector values by the passed vector
     * @name scaleV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    scaleV(v: Vector2d | Vector3d): Vector3d;
    /**
     * Convert this vector into isometric coordinate space
     * @name toIso
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    toIso(): Vector3d;
    /**
     * Convert this vector into 2d coordinate space
     * @name to2d
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    to2d(): Vector3d;
    /**
     * Divide this vector values by the passed value
     * @name div
     * @memberof Vector3d
     * @param {number} n - the value to divide the vector by
     * @returns {Vector3d} Reference to this object for method chaining
     */
    div(n: number): Vector3d;
    /**
     * Update this vector values to absolute values
     * @name abs
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    abs(): Vector3d;
    /**
     * Clamp the vector value within the specified value range
     * @name clamp
     * @memberof Vector3d
     * @param {number} low
     * @param {number} high
     * @returns {Vector3d} new me.Vector3d
     */
    clamp(low: number, high: number): Vector3d;
    /**
     * Clamp this vector value within the specified value range
     * @name clampSelf
     * @memberof Vector3d
     * @param {number} low
     * @param {number} high
     * @returns {Vector3d} Reference to this object for method chaining
     */
    clampSelf(low: number, high: number): Vector3d;
    /**
     * Update this vector with the minimum value between this and the passed vector
     * @name minV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    minV(v: Vector2d | Vector3d): Vector3d;
    /**
     * Update this vector with the maximum value between this and the passed vector
     * @name maxV
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    maxV(v: Vector2d | Vector3d): Vector3d;
    /**
     * Floor the vector values
     * @name floor
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    floor(): Vector3d;
    /**
     * Floor this vector values
     * @name floorSelf
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    floorSelf(): Vector3d;
    /**
     * Ceil the vector values
     * @name ceil
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    ceil(): Vector3d;
    /**
     * Ceil this vector values
     * @name ceilSelf
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    ceilSelf(): Vector3d;
    /**
     * Negate the vector values
     * @name negate
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    negate(): Vector3d;
    /**
     * Negate this vector values
     * @name negateSelf
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    negateSelf(): Vector3d;
    /**
     * Copy the components of the given vector into this one
     * @name copy
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    copy(v: Vector2d | Vector3d): Vector3d;
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
    equals(...args: any[]): boolean;
    /**
     * normalize this vector (scale the vector so that its magnitude is 1)
     * @name normalize
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    normalize(): Vector3d;
    /**
     * change this vector to be perpendicular to what it was before.<br>
     * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
     * @name perp
     * @memberof Vector3d
     * @returns {Vector3d} Reference to this object for method chaining
     */
    perp(): Vector3d;
    /**
     * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
     * @name rotate
     * @memberof Vector3d
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around (on the same z axis)
     * @returns {Vector3d} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d): Vector3d;
    /**
     * return the dot product of this vector and the passed one
     * @name dot
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {number} The dot product.
     */
    dot(v: Vector2d | Vector3d): number;
    /**
     * calculate the cross product of this vector and the passed one
     * @name cross
     * @memberof Vector3d
     * @param {Vector3d} v
     * @returns {Vector3d} Reference to this object for method chaining
     */
    cross(v: Vector3d): Vector3d;
    /**
     * return the square length of this vector
     * @name length2
     * @memberof Vector3d
     * @returns {number} The length^2 of this vector.
     */
    length2(): number;
    /**
     * return the length (magnitude) of this vector
     * @name length
     * @memberof Vector3d
     * @returns {number} the length of this vector
     */
    length(): number;
    /**
     * Linearly interpolate between this vector and the given one.
     * @name lerp
     * @memberof Vector3d
     * @param {Vector3d} v
     * @param {number} alpha - distance along the line (alpha = 0 will be this vector, and alpha = 1 will be the given one).
     * @returns {Vector3d} Reference to this object for method chaining
     */
    lerp(v: Vector3d, alpha: number): Vector3d;
    /**
     * interpolate the position of this vector on the x and y axis towards the given one by the given maximum step.
     * @name moveTowards
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} target
     * @param {number} step - the maximum step per iteration (Negative values will push the vector away from the target)
     * @returns {Vector3d} Reference to this object for method chaining
     */
    moveTowards(target: Vector2d | Vector3d, step: number): Vector3d;
    /**
     * return the distance between this vector and the passed one
     * @name distance
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {number}
     */
    distance(v: Vector2d | Vector3d): number;
    /**
     * return the angle between this vector and the passed one
     * @name angle
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v
     * @returns {number} angle in radians
     */
    angle(v: Vector2d | Vector3d): number;
    /**
     * project this vector on to another vector.
     * @name project
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v - The vector to project onto.
     * @returns {Vector3d} Reference to this object for method chaining
     */
    project(v: Vector2d | Vector3d): Vector3d;
    /**
     * Project this vector onto a vector of unit length.<br>
     * This is slightly more efficient than `project` when dealing with unit vectors.
     * @name projectN
     * @memberof Vector3d
     * @param {Vector2d|Vector3d} v - The unit vector to project onto.
     * @returns {Vector3d} Reference to this object for method chaining
     */
    projectN(v: Vector2d | Vector3d): Vector3d;
    /**
     * return a clone copy of this vector
     * @name clone
     * @memberof Vector3d
     * @returns {Vector3d} new me.Vector3d
     */
    clone(): Vector3d;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberof Vector3d
     * @returns {string}
     */
    toString(): string;
}
