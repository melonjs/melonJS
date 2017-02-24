/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * an ellipse Object
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {Number} x the center x coordinate of the ellipse
     * @param {Number} y the center y coordinate of the ellipse
     * @param {Number} w width (diameter) of the ellipse
     * @param {Number} h height (diameter) of the ellipse
     */
    me.Ellipse = me.Object.extend(
    {
        /** @scope me.Ellipse.prototype */
        /** @ignore */
        init : function (x, y, w, h) {
            /**
             * the center coordinates of the ellipse
             * @public
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.Ellipse
             */
            this.pos = new me.Vector2d();

            /**
             * The bounding rectangle for this shape
             * @private
             * @type {me.Rect}
             * @name _bounds
             * @memberOf me.Ellipse
             */
            this._bounds = undefined;

            /**
             * Maximum radius of the ellipse
             * @public
             * @type {Number}
             * @name radius
             * @memberOf me.Ellipse
             */
            this.radius = NaN;

            /**
             * Pre-scaled radius vector for ellipse
             * @public
             * @type {me.Vector2d}
             * @name radiusV
             * @memberOf me.Ellipse
             */
            this.radiusV = new me.Vector2d();

            /**
             * Radius squared, for pythagorean theorom
             * @public
             * @type {me.Vector2d}
             * @name radiusSq
             * @memberOf me.Ellipse
             */
            this.radiusSq = new me.Vector2d();

            /**
             * x/y scaling ratio for ellipse
             * @public
             * @type {me.Vector2d}
             * @name ratio
             * @memberOf me.Ellipse
             */
            this.ratio = new me.Vector2d();

            // the shape type
            this.shapeType = "Ellipse";
            this.setShape(x, y, w, h);
        },

        /**
         * set new value to the Ellipse shape
         * @name setShape
         * @memberOf me.Ellipse
         * @function
         * @param {Number} x position of the ellipse
         * @param {Number} y position of the ellipse
         * @param {Number} w width (diameter) of the ellipse
         * @param {Number} h height (diameter) of the ellipse
         */
        setShape : function (x, y, w, h) {
            var hW = w / 2;
            var hH = h / 2;
            this.pos.set(x, y);
            this.radius = Math.max(hW, hH);
            this.ratio.set(hW / this.radius, hH / this.radius);
            this.radiusV.set(this.radius, this.radius).scaleV(this.ratio);
            var r = this.radius * this.radius;
            this.radiusSq.set(r, r).scaleV(this.ratio);
            this.updateBounds();
            return this;
        },

        /**
         * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberOf me.Ellipse
         * @function
         * @param {Number} angle The angle to rotate (in radians)
         * @return {me.Ellipse} Reference to this object for method chaining
         */
        rotate : function (/*angle*/) {
            // TODO
            return this;
        },

        /**
         * Scale this Ellipse by the specified scalar.
         * @name scale
         * @memberOf me.Ellipse
         * @function
         * @param {Number} x
         * @param {Number} [y=x]
         * @return {me.Ellipse} Reference to this object for method chaining
         */
        scale : function (x, y) {
            y = typeof (y) !== "undefined" ? y : x;
            return this.setShape(
                this.pos.x,
                this.pos.y,
                this.radiusV.x * 2 * x,
                this.radiusV.y * 2 * y
            );
        },

        /**
         * Scale this Ellipse by the specified vector.
         * @name scale
         * @memberOf me.Ellipse
         * @function
         * @param {me.Vector2d} v
         * @return {me.Ellipse} Reference to this object for method chaining
         */
        scaleV : function (v) {
            return this.scale(v.x, v.y);
        },

        /**
         * apply the given transformation matrix to this ellipse
         * @name transform
         * @memberOf me.Ellipse
         * @function
         * @param {me.Matrix2d} matrix the transformation matrix
         * @return {me.Polygon} Reference to this object for method chaining
         */
        transform : function (/* m */) {
            // TODO
            return this;
        },

        /**
         * translate the circle/ellipse by the specified offset
         * @name translate
         * @memberOf me.Ellipse
         * @function
         * @param {Number} x x offset
         * @param {Number} y y offset
         * @return {me.Ellipse} this ellipse
         */
        translate : function (x, y) {
            this.pos.x += x;
            this.pos.y += y;
            this._bounds.translate(x, y);
            return this;
        },

        /**
         * translate the circle/ellipse by the specified vector
         * @name translateV
         * @memberOf me.Ellipse
         * @function
         * @param {me.Vector2d} v vector offset
         * @return {me.Rect} this ellipse
         */
        translateV : function (v) {
            this.pos.add(v);
            this._bounds.translateV(v);
            return this;
        },

        /**
         * check if this circle/ellipse contains the specified point
         * @name containsPointV
         * @memberOf me.Ellipse
         * @function
         * @param  {me.Vector2d} point
         * @return {boolean} true if contains
         */
        containsPointV: function (v) {
            return this.containsPoint(v.x, v.y);
        },

        /**
         * check if this circle/ellipse contains the specified point
         * @name containsPoint
         * @memberOf me.Ellipse
         * @function
         * @param  {Number} x x coordinate
         * @param  {Number} y y coordinate
         * @return {boolean} true if contains
         */
        containsPoint: function (x, y) {
            // Make position relative to object center point.
            x -= this.pos.x;
            y -= this.pos.y;
            // Pythagorean theorem.
            return (
                ((x * x) / this.radiusSq.x) +
                ((y * y) / this.radiusSq.y)
            ) <= 1.0;
        },

        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.Ellipse
         * @function
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        getBounds : function () {
            return this._bounds;
        },

        /**
         * update the bounding box for this shape.
         * @name updateBounds
         * @memberOf me.Ellipse
         * @function
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        updateBounds : function () {
            var rx = this.radiusV.x,
                ry = this.radiusV.y,
                x = this.pos.x - rx,
                y = this.pos.y - ry,
                w = rx * 2,
                h = ry * 2;

            if (!this._bounds) {
                this._bounds = new me.Rect(x, y, w, h);
            }  else {
                this._bounds.setShape(x, y, w, h);
            }
            return this._bounds;
        },

        /**
         * clone this Ellipse
         * @name clone
         * @memberOf me.Ellipse
         * @function
         * @return {me.Ellipse} new Ellipse
         */
        clone : function () {
            return new me.Ellipse(
                this.pos.x,
                this.pos.y,
                this.radiusV.x * 2,
                this.radiusV.y * 2
            );
        }
    });
})();
