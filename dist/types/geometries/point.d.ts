/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 **/
/**
 * @classdesc
 * represents a point in a 2d space
 */
export default class Point {
    constructor(x?: number, y?: number);
    /**
     * the position of the point on the horizontal axis
     * @type {number}
     * @default 0
     */
    x: number;
    /**
     * the position of the point on the vertical axis
     * @type {number}
     * @default 0
     */
    y: number;
    /**
     * the shape type (used internally)
     * @type {string}
     * @default "Point"
     */
    type: string;
    /** @ignore */
    onResetEvent(x?: number, y?: number): void;
    /**
     * set the Point x and y properties to the given values
     * @param {number} x
     * @param {number} y
     * @returns {Point} Reference to this object for method chaining
     */
    set(x?: number, y?: number): Point;
    /**
     * return true if this point is equal to the given point
     * @param {number|Point|Vector2d} x
     * @param {number} [y]
     * @returns {boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * clone this Point
     * @returns {Point} new Point
     */
    clone(): Point;
}
