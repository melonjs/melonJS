/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 **/
/**
 * @classdesc
 * a rectangle Object
 * @augments Polygon
 */
export default class Rect extends Polygon {
    /**
     * @param {number} x - position of the Rectangle
     * @param {number} y - position of the Rectangle
     * @param {number} w - width of the rectangle
     * @param {number} h - height of the rectangle
     */
    constructor(x: number, y: number, w: number, h: number);
    /** @ignore */
    onResetEvent(x: any, y: any, w: any, h: any): void;
    /**
     * set new value to the rectangle shape
     * @param {number} x - position of the Rectangle
     * @param {number} y - position of the Rectangle
     * @param {number|Vector2d[]} w - width of the rectangle, or an array of vector defining the rectangle
     * @param {number} [h] - height of the rectangle, if a numeral width parameter is specified
     * @returns {Rect} this rectangle
     */
    setShape(x: number, y: number, w: number | Vector2d[], h?: number | undefined, ...args: any[]): Rect;
    /**
     * left coordinate of the Rectangle
     * @type {number}
     */
    get left(): number;
    /**
     * right coordinate of the Rectangle
     * @type {number}
     */
    get right(): number;
    /**
     * top coordinate of the Rectangle
     * @type {number}
     */
    get top(): number;
    /**
     * bottom coordinate of the Rectangle
     * @type {number}
     */
    get bottom(): number;
    set width(value: number);
    /**
     * width of the Rectangle
     * @type {number}
     */
    get width(): number;
    set height(value: number);
    /**
     * height of the Rectangle
     * @type {number}
     */
    get height(): number;
    set centerX(value: number);
    /**
     * absolute center of this rectangle on the horizontal axis
     * @type {number}
     */
    get centerX(): number;
    set centerY(value: number);
    /**
     * absolute center of this rectangle on the vertical axis
     * @type {number}
     */
    get centerY(): number;
    /**
     * center the rectangle position around the given coordinates
     * @param {number} x - the x coordinate around which to center this rectangle
     * @param {number} y - the y coordinate around which to center this rectangle
     * @returns {Rect} this rectangle
     */
    centerOn(x: number, y: number): Rect;
    /**
     * resize the rectangle
     * @param {number} w - new width of the rectangle
     * @param {number} h - new height of the rectangle
     * @returns {Rect} this rectangle
     */
    resize(w: number, h: number): Rect;
    /**
     * scale the rectangle
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @returns {Rect} this rectangle
     */
    scale(x: number, y?: number | undefined): Rect;
    /**
     * clone this rectangle
     * @returns {Rect} new rectangle
     */
    clone(): Rect;
    /**
     * copy the position and size of the given rectangle into this one
     * @param {Rect} rect - Source rectangle
     * @returns {Rect} new rectangle
     */
    copy(rect: Rect): Rect;
    /**
     * merge this rectangle with another one
     * @param {Rect} rect - other rectangle to union with
     * @returns {Rect} the union(ed) rectangle
     */
    union(rect: Rect): Rect;
    /**
     * check if this rectangle is intersecting with the specified one
     * @param {Rect} rect
     * @returns {boolean} true if overlaps
     */
    overlaps(rect: Rect): boolean;
    /**
     * check if this rectangle is identical to the specified one
     * @param {Rect} rect
     * @returns {boolean} true if equals
     */
    equals(rect: Rect): boolean;
    /**
     * determines whether all coordinates of this rectangle are finite numbers.
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite(): boolean;
    /**
     * Returns a polygon whose edges are the same as this box.
     * @returns {Polygon} a new Polygon that represents this rectangle.
     */
    toPolygon(): Polygon;
}
import Polygon from "./poly.js";
import type Vector2d from "./../math/vector2.js";
