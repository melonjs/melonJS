/**
 * @classdesc
 * a rectangle object with rounded corners
 * @augments Rect
 */
export default class RoundRect extends Rect {
    /**
     * @param {number} x - position of the rounded rectangle
     * @param {number} y - position of the rounded rectangle
     * @param {number} width - the rectangle width
     * @param {number} height - the rectangle height
     * @param {number} [radius=20] - the radius of the rounded corner
     */
    constructor(x: number, y: number, width: number, height: number, radius?: number | undefined);
    set radius(value: number);
    /**
     * the radius of the rounded corner
     * @type {number}
     * @default 20
     */
    get radius(): number;
    /** @ignore */
    onResetEvent(x: any, y: any, w: any, h: any, radius: any): void;
    _radius: number | undefined;
    /**
     * copy the position, size and radius of the given rounded rectangle into this one
     * @param {RoundRect} rrect - source rounded rectangle
     * @returns {RoundRect} new rectangle
     */
    copy(rrect: RoundRect): RoundRect;
    /**
     * check if this RoundRect is identical to the specified one
     * @param {RoundRect} rrect
     * @returns {boolean} true if equals
     */
    equals(rrect: RoundRect): boolean;
    /**
     * clone this RoundRect
     * @returns {RoundRect} new RoundRect
     */
    clone(): RoundRect;
}
import Rect from "./rectangle.js";
