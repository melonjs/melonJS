/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 **/

/**
 * @classdesc
 * represents a point in a 2d space
 */
class Point {
    constructor(x = 0, y = 0) {
        /**
         * the position of the point on the horizontal axis
         * @type {number}
         * @default 0
         */
        this.x = x;

        /**
         * the position of the point on the vertical axis
         * @type {number}
         * @default 0
         */
        this.y = y;

        /**
         * the shape type (used internally)
         * @type {string}
         * @default "Point"
         */
        this.type = "Point";
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
     * return true if this point is equal to the given point
     * @param {number|Point|Vector2d} x
     * @param {number} [y]
     * @returns {boolean}
     */
    equals(...args) {
        let _x, _y;
        if (args.length === 2) {
            // x, y
            [_x, _y] = args;
        } else {
            // point
            [_x, _y] = [args[0].x, args[0].y];
        }
        return this.x === _x && this.y === _y;
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
