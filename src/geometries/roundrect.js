import Rect from "./rectangle.js";

// https://developer.chrome.com/blog/canvas2d/#round-rect

/**
 * @classdesc
 * a rectangle object with rounded corners
 * @augments Rect
 */
class RoundRect extends Rect {
    /**
     * @param {number} x position of the rounded rectangle
     * @param {number} y position of the rounded rectangle
     * @param {number} width the rectangle width
     * @param {number} height the rectangle height
     * @param {number} [radius=20] the radius of the rounded corner
     */
    constructor(x, y, width, height, radius = 20) {
        // parent constructor
        super(x, y, width, height);

        // set the corner radius
        this.radius = radius;
    }

    /** @ignore */
    onResetEvent(x, y, w, h, radius) {
        super.setShape(x, y, w, h);
        this.radius = radius;
    }


    /**
     * the radius of the rounded corner
     * @public
     * @type {number}
     * @default 20
     * @name radius
     * @memberof RoundRect.prototype
     */
    get radius() {
        return this._radius;
    }
    set radius(value) {
        // verify the rectangle is at least as wide and tall as the rounded corners.
        if (this.width < 2 * value) {
            value = this.width / 2;
        }
        if (this.height < 2 * value) {
            value = this.height / 2;
        }
        this._radius = value;
    }

    /**
     * clone this RoundRect
     * @name clone
     * @memberof RoundRect.prototype
     * @function
     * @returns {RoundRect} new RoundRect
     */
    clone() {
        return new RoundRect(this.pos.x, this.pos.y, this.width, this.height, this.radius);
    }
};

export default RoundRect;
