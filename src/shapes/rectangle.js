import Vector2d from "./../math/vector2.js";
import Polygon from "./poly.js";

/**
 * @classdesc
 * a rectangle Object
 * @class Rect
 * @augments me.Polygon
 * @memberof me
 * @param {number} x position of the Rectangle
 * @param {number} y position of the Rectangle
 * @param {number} w width of the rectangle
 * @param {number} h height of the rectangle
 */

class Rect extends Polygon {

    constructor(x, y, w, h) {
        // parent constructor
        super(x, y, [
            new Vector2d(0, 0), // 0, 0
            new Vector2d(w, 0), // 1, 0
            new Vector2d(w, h), // 1, 1
            new Vector2d(0, h)  // 0, 1
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
     * @memberof me.Rect.prototype
     * @function
     * @param {number} x position of the Rectangle
     * @param {number} y position of the Rectangle
     * @param {number|me.Vector2d[]} w width of the rectangle, or an array of vector defining the rectangle
     * @param {number} [h] height of the rectangle, if a numeral width parameter is specified
     * @returns {me.Rect} this rectangle
     */
    setShape(x, y, w, h) {
        var points = w; // assume w is an array by default

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
     * @memberof me.Rect
     */
    get left() {
        return this.pos.x;
    }

    /**
     * right coordinate of the Rectangle
     * @public
     * @type {number}
     * @name right
     * @memberof me.Rect
     */
    get right() {
        var w = this.width;
        return (this.pos.x + w) || w;
    }

    /**
     * top coordinate of the Rectangle
     * @public
     * @type {number}
     * @name top
     * @memberof me.Rect
     */
    get top() {
        return this.pos.y;
    }

    /**
     * bottom coordinate of the Rectangle
     * @public
     * @type {number}
     * @name bottom
     * @memberof me.Rect
     */
    get bottom() {
        var h = this.height;
        return (this.pos.y + h) || h;
    }

    /**
     * width of the Rectangle
     * @public
     * @type {number}
     * @name width
     * @memberof me.Rect
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
     * @memberof me.Rect
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
     * @memberof me.Rect
     */
    get centerX() {
        if (isFinite(this.width)) {
            return this.pos.x + (this.width / 2);
        } else {
            return this.width;
        }
    }
    set centerX (value) {
        this.pos.x = value - (this.width / 2);
    }

    /**
     * absolute center of this rectangle on the vertical axis
     * @public
     * @type {number}
     * @name centerY
     * @memberof me.Rect
     */
    get centerY() {
        if (isFinite(this.height)) {
            return this.pos.y + (this.height / 2);
        } else {
            return this.height;
        }
    }
    set centerY(value) {
        this.pos.y = value - (this.height / 2);
    }

    /**
     * resize the rectangle
     * @name resize
     * @memberof me.Rect.prototype
     * @function
     * @param {number} w new width of the rectangle
     * @param {number} h new height of the rectangle
     * @returns {me.Rect} this rectangle
     */
    resize(w, h) {
        this.width = w;
        this.height = h;
        return this;
    }

    /**
     * scale the rectangle
     * @name scale
     * @memberof me.Rect.prototype
     * @function
     * @param {number} x a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] a number representing the ordinate of the scaling vector.
     * @returns {me.Rect} this rectangle
     */
    scale(x, y = x) {
        this.width *= x;
        this.height *= y;
        return this;
    }

    /**
     * clone this rectangle
     * @name clone
     * @memberof me.Rect.prototype
     * @function
     * @returns {me.Rect} new rectangle
     */
    clone() {
        return new Rect(this.pos.x, this.pos.y, this.width, this.height);
    }

    /**
     * copy the position and size of the given rectangle into this one
     * @name copy
     * @memberof me.Rect.prototype
     * @function
     * @param {me.Rect} rect Source rectangle
     * @returns {me.Rect} new rectangle
     */
    copy(rect) {
        return this.setShape(rect.pos.x, rect.pos.y, rect.width, rect.height);
    }

    /**
     * merge this rectangle with another one
     * @name union
     * @memberof me.Rect.prototype
     * @function
     * @param {me.Rect} rect other rectangle to union with
     * @returns {me.Rect} the union(ed) rectangle
     */
    union(rect) {
        var x1 = Math.min(this.left, rect.left);
        var y1 = Math.min(this.top, rect.top);

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
     * @memberof me.Rect.prototype
     * @function
     * @param  {me.Rect} rect
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
     * @memberof me.Rect.prototype
     * @function
     * @param {me.Rect} rect
     * @returns {boolean} true if contains
     */

    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberof me.Rect.prototype
     * @function
     * @param  {number} x x coordinate
     * @param  {number} y y coordinate
     * @returns {boolean} true if contains
     */

    /**
     * Returns true if the rectangle contains the given point
     * @name contains
     * @memberof me.Rect
     * @function
     * @param {me.Vector2d} point
     * @returns {boolean} true if contains
     */
    contains() {
        var arg0 = arguments[0];
        var _x1, _x2, _y1, _y2;
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
     * @memberof me.Rect.prototype
     * @function
     * @param  {me.Rect} rect
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
     * @memberof me.Rect.prototype
     * @function
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite() {
        return (isFinite(this.pos.x) && isFinite(this.pos.y) && isFinite(this.width) && isFinite(this.height));
    }

    /**
     * Returns a polygon whose edges are the same as this box.
     * @name toPolygon
     * @memberof me.Rect.prototype
     * @function
     * @returns {me.Polygon} a new Polygon that represents this rectangle.
     */
    toPolygon() {
        return new Polygon(
            this.pos.x, this.pos.y, this.points
        );
    }
};


export default Rect;
