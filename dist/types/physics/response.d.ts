/**
 * @classdesc
 * An object representing the result of an intersection.
 * @property {Renderable} a The first object participating in the intersection
 * @property {Renderable} b The second object participating in the intersection
 * @property {number} overlap Magnitude of the overlap on the shortest colliding axis
 * @property {Vector2d} overlapV The overlap vector (i.e. `overlapN.scale(overlap, overlap)`). If this vector is subtracted from the position of a, a and b will no longer be colliding
 * @property {Vector2d} overlapN The shortest colliding axis (unit-vector)
 * @property {boolean} aInB Whether the first object is entirely inside the second
 * @property {boolean} bInA Whether the second object is entirely inside the first
 * @property {number} indexShapeA The index of the colliding shape for the object a body
 * @property {number} indexShapeB The index of the colliding shape for the object b body
 * @name ResponseObject
 * @public
 */
export default class ResponseObject {
    a: any;
    b: any;
    overlapN: Vector2d;
    overlapV: Vector2d;
    aInB: boolean;
    bInA: boolean;
    indexShapeA: number;
    indexShapeB: number;
    overlap: number;
    /**
     * Set some values of the response back to their defaults. <br>
     * Call this between tests if you are going to reuse a single <br>
     * Response object for multiple intersection tests <br>
     * (recommended as it will avoid allocating extra memory) <br>
     * @name clear
     * @public
     * @returns {object} this object for chaining
     */
    public clear(): object;
}
import Vector2d from "./../math/vector2.js";
