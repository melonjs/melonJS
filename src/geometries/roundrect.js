import Rect from "./rectangle.js";

// https://developer.chrome.com/blog/canvas2d/#round-rect

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
     * @memberof RoundRect
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
     * copy the position, size and radius of the given rounded rectangle into this one
     * @name copy
     * @memberof RoundRect
     * @param {RoundRect} rrect - source rounded rectangle
     * @returns {RoundRect} new rectangle
     */
    copy(rrect) {
        super.setShape(rrect.pos.x, rrect.pos.y, rrect.width, rrect.height);
        this.radius = rrect.radius;
        return this;
    }

    /**
     * Returns true if the rounded rectangle contains the given point
     * @name contains
     * @memberof RoundRect
     * @method
     * @param  {number} x -  x coordinate
     * @param  {number} y -  y coordinate
     * @returns {boolean} true if contains
     */

    /**
     * Returns true if the rounded rectangle contains the given point
     * @name contains
     * @memberof RoundRect
     * @param {Vector2d} point
     * @returns {boolean} true if contains
     */
    contains() {
        let arg0 = arguments[0];
        let _x, _y;
        if (arguments.length === 2) {
             // x, y
             _x = arg0;
             _y = arguments[1];
         } else {
             if (arg0 instanceof Rect) {
                 // good enough
                 return super.contains(arg0);
             } else {
                 // vector
                _x = arg0.x;
                _y = arg0.y;
             }
        }

        // check whether point is outside the bounding box
        if (_x < this.left || _x >= this.right || _y < this.top || _y >= this.bottom) {
            return false; // outside bounding box
        }

        // check whether point is within the bounding box minus radius
        if ((_x >= this.left + this.radius && _x <= this.right - this.radius) || (_y >= this.top + this.radius && _y <= this.bottom - this.radius)) {
            return true;
        }

        // check whether point is in one of the rounded corner areas
        let tx, ty;
        const radiusX =  Math.max(0, Math.min(this.radius, this.width / 2));
        const radiusY =  Math.max(0, Math.min(this.radius, this.height / 2));

        if (_x < this.left + radiusX && _y < this.top + radiusY) {
            tx = _x - this.left - radiusX;
            ty = _y - this.top - radiusY;
        } else if (_x > this.right - radiusX && _y < this.top + radiusY) {
            tx = _x - this.right + radiusX;
            ty = _y - this.top - radiusY;
        } else if (_x > this.right - radiusX && _y > this.bottom - radiusY) {
            tx = _x - this.right + radiusX;
            ty = _y - this.bottom + radiusY;
        } else if (_x < this.left + radiusX && _y > this.bottom - radiusY) {
            tx = _x - this.left - radiusX;
            ty = _y - this.bottom + radiusY;
        } else {
            return false; // inside and not within the rounded corner area
        }

        // Pythagorean theorem.
        return ((tx * tx) + (ty * ty) <= (radiusX * radiusY));
    }

    /**
     * check if this RoundRect is identical to the specified one
     * @name equals
     * @memberof RoundRect
     * @param {RoundRect} rrect
     * @returns {boolean} true if equals
     */
    equals(rrect) {
        return super.equals(rrect) && this.radius === rrect.radius;
    }

    /**
     * clone this RoundRect
     * @name clone
     * @memberof RoundRect
     * @returns {RoundRect} new RoundRect
     */
    clone() {
        return new RoundRect(this.pos.x, this.pos.y, this.width, this.height, this.radius);
    }
}
