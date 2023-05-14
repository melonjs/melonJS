/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * @classdesc
 * represents a point in a 2d space
 */
 class Point {
    constructor(x = 0, y = 0) {
        /**
         * the position of the point on the horizontal axis
         * @type {Number}
         * @default 0
         */
        this.x = x;

        /**
         * the position of the point on the vertical axis
         * @type {Number}
         * @default 0
         */
        this.y = y;
    }

    /** @ignore */
    onResetEvent(x = 0, y = 0) {
        this.set(x, y);
    }

    /**
     * set the Point x and y properties to the given values
     * @param {number} x
     * @param {number} y
     * @returns {Point} Reference to this object for method chaining
     */
    set(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        return this;
    }

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
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
     equals() {
        let _x, _y;
        if (arguments.length === 2) {
            // x, y
            _x = arguments[0];
            _y = arguments[1];
        } else {
            // point
            _x = arguments[0].x;
            _y = arguments[0].y;
        }
        return ((this.x === _x) && (this.y === _y));
    }

    /**
     * clone this Point
     * @returns {Point} new Point
     */
    clone() {
        return new Point(this.x, this.y);
    }
}

export { Point as default };
