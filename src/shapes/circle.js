/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * an ellipse Object
     * (Tiled specifies top-left coordinates, and width and height of the ellipse)
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {me.Vector2d} v top-left origin position of the Ellipse
     * @param {Number} w width of the elipse
     * @param {Number} h height of the elipse
     */
    me.Ellipse = Object.extend(
    {
        /** @scope me.Ellipse.prototype */
        /** @ignore */
        init : function (v, w, h) {
            /**
             * center point of the Ellipse
             * @public
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.Ellipse
             */
            this.pos = new me.Vector2d();

            /**
             * radius (x/y) of the ellipse
             * @public
             * @type {me.Vector2d}
             * @name radius
             * @memberOf me.Ellipse
             */
            this.radius = new me.Vector2d();

            // the shape type
            this.shapeType = "Ellipse";
            this.setShape(v, w, h);
        },

        /**
         * set new value to the Ellipse shape
         * @name setShape
         * @memberOf me.Ellipse
         * @function
         * @param {me.Vector2d} v top-left origin position of the Ellipse
         * @param {Number} w width of the Ellipse
         * @param {Number} h height of the Ellipse
         */
        setShape : function (v, w, h) {
            this.radius.set(w / 2, h / 2);
            this.pos.setV(v).add(this.radius);
            return this;
        },

        /**
         * translate the circle/ellipse by the specified offset
         * @name translate
         * @memberOf me.Ellipse
         * @function
         * @param {Number} x x offset
         * @param {Number} y y offset
         * @return {me.Ellipse} this Ellipse
         */
        translate : function (x, y) {
            this.pos.x += x;
            this.pos.y += y;
            return this;
        },

        /**
         * translate the circle/ellipse by the specified vector
         * @name translateV
         * @memberOf me.Ellipse
         * @function
         * @param {me.Vector2d} v vector offset
         * @return {me.Rect} this Ellipse
         */
        translateV : function (v) {
            this.pos.add(v);
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
                ((x * x) / (this.radius.x * this.radius.x)) +
                ((y * y) / (this.radius.y * this.radius.y))
            ) <= 1.0;
        },

        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.Ellipse
         * @function
         * @param {me.Rect} [rect] an optional rectangle object to use when returning the bounding rect(else returns a new object)
         * @return {me.Rect} the bounding box Rectangle object
         */
        getBounds : function (rect) {
            if (typeof(rect) !== "undefined") {
                return rect.setShape(
                    this.pos.clone().sub(this.radius),
                    this.radius.x * 2,
                    this.radius.y * 2
                );
            }
            else {
                //will return a rect, with pos being the top-left coordinates
                return new me.Rect(
                    this.pos.clone().sub(this.radius),
                    this.radius.x * 2,
                    this.radius.y * 2
                );
            }
        },

        /**
         * clone this Ellipse
         * @name clone
         * @memberOf me.Ellipse
         * @function
         * @return {me.Ellipse} new Ellipse
         */
        clone : function () {
            return new me.Ellipse(this.pos, this.radius.x * 2, this.radius.y * 2);
        },

        /**
         * debug purpose
         * @ignore
         */
        draw : function (context, color) {
            // http://tinyurl.com/opnro2r
            context.save();
            context.beginPath();

            context.translate(
                this.pos.x - this.radius.x,
                this.pos.y - this.radius.y
            );
            context.scale(this.radius.x, this.radius.y);
            context.arc(1, 1, 1, 0, 2 * Math.PI, false);

            context.restore();
            context.strokeStyle = color || "red";
            context.stroke();
        }
    });
})();
