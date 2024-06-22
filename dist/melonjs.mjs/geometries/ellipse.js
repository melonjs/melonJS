/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import pool from '../system/pooling.js';

/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 * @import ObservableVector2d from "./../math/observable_vector2.js";
 * @import Matrix2d from "./../math/matrix2.js";
 * @import Bounds from "./../physics/bounds.js";
 */

/**
 * @classdesc
 * an ellipse Object
 */
class Ellipse {
    /**
     * @param {number} x - the center x coordinate of the ellipse
     * @param {number} y - the center y coordinate of the ellipse
     * @param {number} w - width (diameter) of the ellipse
     * @param {number} h - height (diameter) of the ellipse
     */
    constructor(x, y, w, h) {
        /**
         * the center coordinates of the ellipse
         * @public
         * @type {Vector2d}
         */
        this.pos = pool.pull("Vector2d");

        /**
         * The bounding rectangle for this shape
         * @private
         */
        this._bounds = undefined;

        /**
         * Maximum radius of the ellipse
         * @public
         * @type {number}
         */
        this.radius = NaN;

        /**
         * Pre-scaled radius vector for ellipse
         * @public
         * @type {Vector2d}
         */
        this.radiusV = pool.pull("Vector2d");

        /**
         * Radius squared, for pythagorean theorom
         * @public
         * @type {Vector2d}
         */
        this.radiusSq = pool.pull("Vector2d");

        /**
         * x/y scaling ratio for ellipse
         * @public
         * @type {Vector2d}
         */
        this.ratio = pool.pull("Vector2d");

        /**
         * the shape type (used internally)
         * @type {string}
         * @default "Ellipse"
         */
        this.type = "Ellipse";
        this.setShape(x, y, w, h);
    }

    /** @ignore */
    onResetEvent(x, y, w, h) {
        this.setShape(x, y, w, h);
    }

    /**
     * set new value to the Ellipse shape
     * @param {number} x - the center x coordinate of the ellipse
     * @param {number} y - the center y coordinate of the ellipse
     * @param {number} w - width (diameter) of the ellipse
     * @param {number} h - height (diameter) of the ellipse
     * @returns {Ellipse} this instance for objecf chaining
     */
    setShape(x, y, w, h) {
        const hW = w / 2;
        const hH = h / 2;
        const radius = Math.max(hW, hH);
        const r = radius * radius;

        this.pos.set(x, y);
        this.radius = radius;
        this.ratio.set(hW / radius, hH / radius);
        this.radiusV.set(radius, radius).scaleV(this.ratio);
        this.radiusSq.set(r, r).scaleV(this.ratio);

        let bounds = this.getBounds();
        // update the corresponding bounds
        bounds.setMinMax(x, y, x + w, x + h);
        // elipse position is the center of the cirble, bounds position are top left
        bounds.translate(-this.radiusV.x, -this.radiusV.y);

        return this;
    }

    /**
     * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {Ellipse} Reference to this object for method chaining
     */
    rotate(angle, v) {
        let bounds = this.getBounds();
        // TODO : only works for circle
        this.pos.rotate(angle, v);
        bounds.shift(this.pos);
        bounds.translate(-this.radiusV.x, -this.radiusV.y);
        return this;
    }

    /**
     * Scale this Ellipse by the specified scalar.
     * @param {number} x - the scale factor along the x-axis
     * @param {number} [y=x] - the scale factor along the y-axis
     * @returns {Ellipse} Reference to this object for method chaining
     */
    scale(x, y = x) {
        return this.setShape(
            this.pos.x,
            this.pos.y,
            this.radiusV.x * 2 * x,
            this.radiusV.y * 2 * y
        );
    }

    /**
     * Scale this Ellipse by the specified vector.
     * @param {Vector2d} v
     * @returns {Ellipse} Reference to this object for method chaining
     */
    scaleV(v) {
        return this.scale(v.x, v.y);
    }

    /**
     * apply the given transformation matrix to this ellipse
     * @param {Matrix2d} matrix - the transformation matrix
     * @returns {Ellipse} Reference to this object for method chaining
     */
    transform(matrix) { // eslint-disable-line no-unused-vars
        // TODO
        return this;
    }

    /**
     * translate the circle/ellipse by the specified offset
     * @param {number|Vector2d} x -  x coordinate or a vector point to translate by
     * @param {number} [y] - y offset
     * @returns {Ellipse} this ellipse
     * @example
     * ellipse.translate(10, 10);
     * // or
     * ellipse.translate(myVector2d);
     */
    translate() {
        let _x, _y;

        if (arguments.length === 2) {
            // x, y
            _x = arguments[0];
            _y = arguments[1];
        } else {
            // vector
            _x = arguments[0].x;
            _y = arguments[0].y;
        }

        this.pos.x += _x;
        this.pos.y += _y;
        this.getBounds().translate(_x, _y);

        return this;
    }

    /**
     * check if this circle/ellipse contains the specified point
     * @param {number|Vector2d} x -  x coordinate or a vector point to check
     * @param {number} [y] -  y coordinate
     * @returns {boolean} true if contains
     * @example
     * if (circle.contains(10, 10)) {
     *   // do something
     * }
     * // or
     * if (circle.contains(myVector2d)) {
     *  // do something
     * }
     */
    contains(...args) {
        let _x, _y;

        if (args.length === 2) {
            // x, y
            [_x, _y] = args;
        } else {
            // vector
            [_x, _y] = [args[0].x, args[0].y];
        }

        // Make position relative to object center point.
        _x -= this.pos.x;
        _y -= this.pos.y;
        // Pythagorean theorem.
        return (
            ((_x * _x) / this.radiusSq.x) +
            ((_y * _y) / this.radiusSq.y)
        ) <= 1.0;
    }

    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    getBounds() {
        if (typeof this._bounds === "undefined") {
            this._bounds = pool.pull("Bounds");
        }
        return this._bounds;
    }

    /**
     * clone this Ellipse
     * @returns {Ellipse} new Ellipse
     */
    clone() {
        return new Ellipse(
            this.pos.x,
            this.pos.y,
            this.radiusV.x * 2,
            this.radiusV.y * 2
        );
    }
}

export { Ellipse as default };
