/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import pool from '../system/pooling.js';
import Polygon from './poly.js';

/**
 * @classdesc
 * a rectangle Object
 * @augments Polygon
 */
 class Rect extends Polygon {
    /**
     * @param {number} x - position of the Rectangle
     * @param {number} y - position of the Rectangle
     * @param {number} w - width of the rectangle
     * @param {number} h - height of the rectangle
     */
    constructor(x, y, w, h) {
        // parent constructor
        super(x, y, [
            pool.pull("Vector2d", 0, 0), // 0, 0
            pool.pull("Vector2d", w, 0), // 1, 0
            pool.pull("Vector2d", w, h), // 1, 1
            pool.pull("Vector2d", 0, h)  // 0, 1
        ]);
        this.shapeType = "Rectangle";
    }

    /** @ignore */
    onResetEvent(x, y, w, h) {
        this.setShape(x, y, w, h);
    }

    /**
     * set new value to the rectangle shape
     * @name setShape
     * @memberof Rect
     * @param {number} x - position of the Rectangle
     * @param {number} y - position of the Rectangle
     * @param {number|Vector2d[]} w - width of the rectangle, or an array of vector defining the rectangle
     * @param {number} [h] - height of the rectangle, if a numeral width parameter is specified
     * @returns {Rect} this rectangle
     */
    setShape(x, y, w, h) {
        let points = w; // assume w is an array by default

        this.pos.set(x, y);

        if (arguments.length === 4) {
            points = this.points;
            points[0].set(0, 0); // 0, 0
            points[1].set(w, 0); // 1, 0
            points[2].set(w, h); // 1, 1
            points[3].set(0, h); // 0, 1
        }

        this.setVertices(points);
        return this;
    }


    /**
     * left coordinate of the Rectangle
     * @public
     * @type {number}
     * @name left
     * @memberof Rect
     */
    get left() {
        return this.pos.x;
    }

    /**
     * right coordinate of the Rectangle
     * @public
     * @type {number}
     * @name right
     * @memberof Rect
     */
    get right() {
        let w = this.width;
        return (this.left + w) || w;
    }

    /**
     * top coordinate of the Rectangle
     * @public
     * @type {number}
     * @name top
     * @memberof Rect
     */
    get top() {
        return this.pos.y;
    }

    /**
     * bottom coordinate of the Rectangle
     * @public
     * @type {number}
     * @name bottom
     * @memberof Rect
     */
    get bottom() {
        let h = this.height;
        return (this.top + h) || h;
    }

    /**
     * width of the Rectangle
     * @public
     * @type {number}
     * @name width
     * @memberof Rect
     */
    get width() {
        return this.points[2].x;
    }
    set width(value) {
        this.points[1].x = this.points[2].x = value;
        this.recalc();
        this.updateBounds();
    }

    /**
     * height of the Rectangle
     * @public
     * @type {number}
     * @name height
     * @memberof Rect
     */
    get height() {
        return this.points[2].y;
    }
    set height(value) {
        this.points[2].y = this.points[3].y = value;
        this.recalc();
        this.updateBounds();
    }

    /**
     * absolute center of this rectangle on the horizontal axis
     * @public
     * @type {number}
     * @name centerX
     * @memberof Rect
     */
    get centerX() {
        if (isFinite(this.width)) {
            return this.left + (this.width / 2);
        } else {
            return this.width;
        }
    }
    set centerX (value) {
        this.pos.x = value - (this.width / 2);
        this.recalc();
        this.updateBounds();
    }

    /**
     * absolute center of this rectangle on the vertical axis
     * @public
     * @type {number}
     * @name centerY
     * @memberof Rect
     */
    get centerY() {
        if (isFinite(this.height)) {
            return this.top + (this.height / 2);
        } else {
            return this.height;
        }
    }
    set centerY(value) {
        this.pos.y = value - (this.height / 2);
        this.recalc();
        this.updateBounds();
    }

    /**
     * center the rectangle position around the given coordinates
     * @name centerOn
     * @memberof Rect
     * @param {number} x - the x coordinate around which to center this rectangle
     * @param {number} y - the y coordinate around which to center this rectangle
     * @returns {Rect} this rectangle
     */
    centerOn(x, y) {
        this.centerX = x;
        this.centerY = y;
        return this;
    }

    /**
     * resize the rectangle
     * @name resize
     * @memberof Rect
     * @param {number} w - new width of the rectangle
     * @param {number} h - new height of the rectangle
     * @returns {Rect} this rectangle
     */
    resize(w, h) {
        this.width = w;
        this.height = h;
        return this;
    }

    /**
     * scale the rectangle
     * @name scale
     * @memberof Rect
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @returns {Rect} this rectangle
     */
    scale(x, y = x) {
        this.width *= x;
        this.height *= y;
        return this;
    }

    /**
     * clone this rectangle
     * @name clone
     * @memberof Rect
     * @returns {Rect} new rectangle
     */
    clone() {
        return new Rect(this.left, this.top, this.width, this.height);
    }

    /**
     * copy the position and size of the given rectangle into this one
     * @name copy
     * @memberof Rect
     * @param {Rect} rect - Source rectangle
     * @returns {Rect} new rectangle
     */
    copy(rect) {
        return this.setShape(rect.left, rect.top, rect.width, rect.height);
    }

    /**
     * merge this rectangle with another one
     * @name union
     * @memberof Rect
     * @param {Rect} rect - other rectangle to union with
     * @returns {Rect} the union(ed) rectangle
     */
    union(rect) {
        let x1 = Math.min(this.left, rect.left);
        let y1 = Math.min(this.top, rect.top);

        this.resize(
            Math.max(this.right, rect.right) - x1,
            Math.max(this.bottom, rect.bottom) - y1
        );

        this.pos.set(x1, y1);

        return this;
    }

    /**
     * check if this rectangle is intersecting with the specified one
     * @name overlaps
     * @memberof Rect
     * @param {Rect} rect
     * @returns {boolean} true if overlaps
     */
    overlaps(rect) {
        return (
            this.left < rect.right &&
            rect.left < this.right &&
            this.top < rect.bottom &&
            rect.top < this.bottom
        );
    }

    /**
     * Returns true if the rectangle contains the given rectangle
     * @name contains
     * @memberof Rect
     * @method
     * @param {Rect} rect
     * @returns {boolean} true if contains
     */

    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberof Rect
     * @method
     * @param  {number} x -  x coordinate
     * @param  {number} y -  y coordinate
     * @returns {boolean} true if contains
     */

    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberof Rect
     * @param {Vector2d} point
     * @returns {boolean} true if contains
     */
    contains() {
        let arg0 = arguments[0];
        let _x1, _x2, _y1, _y2;
        if (arguments.length === 2) {
             // x, y
             _x1 = _x2 = arg0;
             _y1 = _y2 = arguments[1];
         } else {
             if (arg0 instanceof Rect) {
                 // me.Rect
                 _x1 = arg0.left;
                 _x2 = arg0.right;
                 _y1 = arg0.top;
                 _y2 = arg0.bottom;
             } else {
                 // vector
                 _x1 = _x2 = arg0.x;
                 _y1 = _y2 = arg0.y;
             }
         }
         return (
             _x1 >= this.left &&
             _x2 <= this.right &&
             _y1 >= this.top &&
             _y2 <= this.bottom
         );
    }

    /**
     * check if this rectangle is identical to the specified one
     * @name equals
     * @memberof Rect
     * @param {Rect} rect
     * @returns {boolean} true if equals
     */
    equals(rect) {
        return (
            rect.left === this.left &&
            rect.right === this.right &&
            rect.top === this.top &&
            rect.bottom === this.bottom
        );
    }

    /**
     * determines whether all coordinates of this rectangle are finite numbers.
     * @name isFinite
     * @memberof Rect
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite() {
        return (isFinite(this.left) && isFinite(this.top) && isFinite(this.width) && isFinite(this.height));
    }

    /**
     * Returns a polygon whose edges are the same as this box.
     * @name toPolygon
     * @memberof Rect
     * @returns {Polygon} a new Polygon that represents this rectangle.
     */
    toPolygon() {
        return pool.pull("Polygon",
            this.left, this.top, this.points
        );
    }
}

export { Rect as default };
