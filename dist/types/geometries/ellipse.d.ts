/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 * @import ObservableVector2d from "./../math/observable_vector2.js";
 * @import Matrix2d from "./../math/matrix2.js";
 * @import Bounds from "./../physics/bounds.js";
 */
/**
 * @classdesc
 * an ellipse Object
 */
export default class Ellipse {
    /**
     * @param {number} x - the center x coordinate of the ellipse
     * @param {number} y - the center y coordinate of the ellipse
     * @param {number} w - width (diameter) of the ellipse
     * @param {number} h - height (diameter) of the ellipse
     */
    constructor(x: number, y: number, w: number, h: number);
    /**
     * the center coordinates of the ellipse
     * @public
     * @type {Vector2d}
     */
    public pos: Vector2d;
    /**
     * The bounding rectangle for this shape
     * @private
     */
    private _bounds;
    /**
     * Maximum radius of the ellipse
     * @public
     * @type {number}
     */
    public radius: number;
    /**
     * Pre-scaled radius vector for ellipse
     * @public
     * @type {Vector2d}
     */
    public radiusV: Vector2d;
    /**
     * Radius squared, for pythagorean theorom
     * @public
     * @type {Vector2d}
     */
    public radiusSq: Vector2d;
    /**
     * x/y scaling ratio for ellipse
     * @public
     * @type {Vector2d}
     */
    public ratio: Vector2d;
    /**
     * the shape type (used internally)
     * @type {string}
     * @default "Ellipse"
     */
    type: string;
    /** @ignore */
    onResetEvent(x: any, y: any, w: any, h: any): void;
    /**
     * set new value to the Ellipse shape
     * @param {number} x - the center x coordinate of the ellipse
     * @param {number} y - the center y coordinate of the ellipse
     * @param {number} w - width (diameter) of the ellipse
     * @param {number} h - height (diameter) of the ellipse
     * @returns {Ellipse} this instance for objecf chaining
     */
    setShape(x: number, y: number, w: number, h: number): Ellipse;
    /**
     * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {Ellipse} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d | undefined): Ellipse;
    /**
     * Scale this Ellipse by the specified scalar.
     * @param {number} x - the scale factor along the x-axis
     * @param {number} [y=x] - the scale factor along the y-axis
     * @returns {Ellipse} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Ellipse;
    /**
     * Scale this Ellipse by the specified vector.
     * @param {Vector2d} v
     * @returns {Ellipse} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Ellipse;
    /**
     * apply the given transformation matrix to this ellipse
     * @param {Matrix2d} matrix - the transformation matrix
     * @returns {Ellipse} Reference to this object for method chaining
     */
    transform(matrix: Matrix2d): Ellipse;
    /**
     * translate the circle/ellipse by the specified offset
     * @param {number|Vector2d} x -  x coordinate or a vector point to translate by
     * @param {number} [y] - y offset
     * @returns {Ellipse} this ellipse
     * @example
     * ellipse.translate(10, 10);
     * // or
     * ellipse.translate(myVector2d);
     */
    translate(...args: any[]): Ellipse;
    /**
     * check if this circle/ellipse contains the specified point
     * @param {number|Vector2d} x -  x coordinate or a vector point to check
     * @param {number} [y] -  y coordinate
     * @returns {boolean} true if contains
     * @example
     * if (circle.contains(10, 10)) {
     *   // do something
     * }
     * // or
     * if (circle.contains(myVector2d)) {
     *  // do something
     * }
     */
    contains(...args: any[]): boolean;
    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    getBounds(): Bounds;
    /**
     * clone this Ellipse
     * @returns {Ellipse} new Ellipse
     */
    clone(): Ellipse;
}
import type Vector2d from "./../math/vector2.js";
import type ObservableVector2d from "./../math/observable_vector2.js";
import type Matrix2d from "./../math/matrix2.js";
import type Bounds from "./../physics/bounds.js";
