/**
 * @classdesc
 * represents a point in a 2d space
 */
export default class Point {
    constructor(x?: number, y?: number);
    /**
     * the position of the point on the horizontal axis
     * @public
     * @type {Number}
     * @default 0
     */
    public x: number;
    /**
     * the position of the point on the vertical axis
     * @public
     * @type {Number}
     * @default 0
     */
    public y: number;
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
     * return true if the two points are the same
     * @name equals
     * @memberof Point
     * @method
     * @param {Point} point
     * @returns {boolean}
     */
    /**
     * return true if this point is equal to the given values
     * @name equals
     * @memberof Point
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    equals(...args: any[]): boolean;
    /**
     * clone this Point
     * @name clone
     * @returns {Point} new Point
     */
    clone(): Point;
}
