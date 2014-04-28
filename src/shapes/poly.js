/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a polyshape (polygone/polyline) Object
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {me.Vector2d} v origin point of the PolyShape
     * @param {me.Vector2d[]} points array of vector defining the polyshape
     * @param {boolean} closed true if a polygone, false if a polyline
     */
    me.PolyShape = Object.extend(
    /** @scope me.PolyShape.prototype */ {

        /** @ignore */
        init : function (v, points, closed) {
            /**
             * origin point of the PolyShape
             * @public
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.PolyShape
             */
            this.pos = new me.Vector2d();

            /**
             * Array of points defining the polyshape
             * @public
             * @type {me.Vector2d[]}
             * @name points
             * @memberOf me.PolyShape
             */
            this.points = null;

            /**
             * Specified if the shape is closed (i.e. polygon)
             * @public
             * @type {boolean}
             * @name closed
             * @memberOf me.PolyShape
             */
            this.closed = false;


            // the shape type
            this.shapeType = "PolyShape";
            this.setShape(v, points, closed);
        },

        /**
         * set new value to the PolyShape
         * @name setShape
         * @memberOf me.PolyShape
         * @function
         * @param {me.Vector2d} v origin point of the PolyShape
         * @param {me.Vector2d[]} points array of vector defining the polyshape
         * @param {boolean} closed true if a polygone, false if a polyline
         */
        setShape : function (v, points, closed) {
            this.pos.setV(v);
            this.points = points;
            this.closed = (closed === true);
            this.getBounds();

            return this;
        },

        /**
         * translate the polyShape by the specified offset
         * @name translate
         * @memberOf me.PolyShape
         * @function
         * @param {Number} x x offset
         * @param {Number} y y offset
         * @return {me.PolyShape} this polyShape
         */
        translate : function (x, y) {
            this.pos.x += x;
            this.pos.y += y;
            return this;
        },

        /**
         * translate the polyShape by the specified vector
         * @name translateV
         * @memberOf me.PolyShape
         * @function
         * @param {me.Vector2d} v vector offset
         * @return {me.PolyShape} this polyShape
         */
        translateV : function (v) {
            this.pos.add(v);
            return this;
        },

        /**
         * check if this polyShape contains the specified point
         * @name containsPointV
         * @memberOf me.polyShape
         * @function
         * @param  {me.Vector2d} point
         * @return {boolean} true if contains
         */
        containsPointV: function (v) {
            return this.containsPoint(v.x, v.y);
        },

        /**
         * check if this polyShape contains the specified point <br>
         * (Note: it is highly recommended to first do a hit test on the corresponding <br>
         *  bounding rect, as the function can be highly consuming with complex shapes)
         * @name containsPoint
         * @memberOf me.polyShape
         * @function
         * @param  {Number} x x coordinate
         * @param  {Number} y y coordinate
         * @return {boolean} true if contains
         */
        containsPoint: function (x, y) {
            var intersects = false;
            var posx = this.pos.x, posy = this.pos.y;
            var points = this.points;
            var len = points.length;

            //http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
            for (var i = 0, j = len - 1; i < len; j = i++) {
                var iy = points[i].y + posy, ix = points[i].x + posx,
                    jy = points[j].y + posy, jx = points[j].x + posx;
                if (((iy > y) !== (jy > y)) && (x < (jx - ix) * (y - iy) / (jy - iy) + ix)) {
                    intersects = !intersects;
                }
            }
            return intersects;
        },

        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.PolyShape
         * @function
         * @param {me.Rect} [rect] an optional rectangle object to use when returning the bounding rect(else returns a new object)
         * @return {me.Rect} the bounding box Rectangle object
         */
        getBounds : function (rect) {
            var pos = this.pos.clone(), right = 0, bottom = 0;
            this.points.forEach(function (point) {
                pos.x = Math.min(pos.x, point.x);
                pos.y = Math.min(pos.y, point.y);
                right = Math.max(right, point.x);
                bottom = Math.max(bottom, point.y);
            });
            if (typeof(rect) !== "undefined") {
                return rect.setShape(pos, right - pos.x, bottom - pos.y);
            }
            else {
                return new me.Rect(pos, right - pos.x, bottom - pos.y);
            }
        },

        /**
         * clone this PolyShape
         * @name clone
         * @memberOf me.PolyShape
         * @function
         * @return {me.PolyShape} new PolyShape
         */
        clone : function () {
            var copy = [];
            this.points.forEach(function (point) {
                copy.push(new me.Vector2d(point.x, point.y));
            });
            return new me.PolyShape(this.pos.clone(), copy, this.closed);
        },

        /**
         * debug purpose
         * @ignore
         */
        draw : function (context, color) {
            context.save();
            context.translate(-this.pos.x, -this.pos.y);
            context.strokeStyle = color || "red";
            context.beginPath();
            context.moveTo(this.points[0].x, this.points[0].y);
            this.points.forEach(function (point) {
                context.lineTo(point.x, point.y);
                context.moveTo(point.x, point.y);

            });
            if (this.closed === true) {
                context.lineTo(this.points[0].x, this.points[0].y);
            }
            context.stroke();
            context.restore();
        }
    });
})();
