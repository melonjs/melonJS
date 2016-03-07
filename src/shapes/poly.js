/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a polygon Object.<br>
     * Please do note that melonJS implements a simple Axis-Aligned Boxes collision algorithm, which requires all polygons used for collision to be convex with all vertices defined with clockwise winding.
     * A polygon is convex when all line segments connecting two points in the interior do not cross any edge of the polygon
     * (which means that all angles are less than 180 degrees), as described here below : <br>
     * <center><img src="images/convex_polygon.png"/></center><br>
     * A polygon's `winding` is clockwise iff its vertices (points) are declared turning to the right. The image above shows COUNTERCLOCKWISE winding.
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {Number} x origin point of the Polygon
     * @param {Number} y origin point of the Polygon
     * @param {me.Vector2d[]} points array of vector defining the Polygon
     */
    me.Polygon = me.Object.extend(
    /** @scope me.Polygon.prototype */ {

        /** @ignore */
        init : function (x, y, points) {
            /**
             * origin point of the Polygon
             * @public
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.Polygon
             */
            this.pos = new me.Vector2d();

            /**
             * The bounding rectangle for this shape
             * @private
             * @type {me.Rect}
             * @name _bounds
             * @memberOf me.Polygon
             */
            this._bounds = undefined;

            /**
             * Array of points defining the Polygon <br>
             * Note: If you manually change `points`, you **must** call `recalc`afterwards so that the changes get applied correctly.
             * @public
             * @type {me.Vector2d[]}
             * @name points
             * @memberOf me.Polygon
             */
            this.points = null;

            // the shape type
            this.shapeType = "Polygon";
            this.setShape(x, y, points);
        },

        /**
         * set new value to the Polygon
         * @name setShape
         * @memberOf me.Polygon
         * @function
         * @param {Number} x position of the Polygon
         * @param {Number} y position of the Polygon
         * @param {me.Vector2d[]} points array of vector defining the Polygon
         */
        setShape : function (x, y, points) {
            this.pos.set(x, y);
            this.points = points;
            this.recalc();
            this.updateBounds();
            return this;
        },

        /**
         * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberOf me.Polygon
         * @function
         * @param {Number} angle The angle to rotate (in radians)
         * @return {me.Polygon} Reference to this object for method chaining
         */
        rotate : function (angle) {
            if (angle !== 0) {
                var points = this.points;
                var len = points.length;
                for (var i = 0; i < len; i++) {
                    points[i].rotate(angle);
                }
                this.recalc();
                this.updateBounds();
            }
            return this;
        },

        /**
         * Scale this Polygon by the given scalar.
         * @name scale
         * @memberOf me.Polygon
         * @function
         * @param {Number} x
         * @param {Number} [y=x]
         * @return {me.Polygon} Reference to this object for method chaining
         */
        scale : function (x, y) {
            y = typeof (y) !== "undefined" ? y : x;

            var points = this.points;
            var len = points.length;
            for (var i = 0; i < len; i++) {
                points[i].scale(x, y);
            }
            this.recalc();
            this.updateBounds();
            return this;
        },

        /**
         * Scale this Polygon by the given vector
         * @name scaleV
         * @memberOf me.Polygon
         * @function
         * @param {me.Vector2d} v
         * @return {me.Polygon} Reference to this object for method chaining
         */
        scaleV : function (v) {
            return this.scale(v.x, v.y);
        },

        /**
         * Computes the calculated collision polygon.
         * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
         * @name recalc
         * @memberOf me.Polygon
         * @function
         */
        recalc : function () {
            var i;
            // The edges here are the direction of the `n`th edge of the polygon, relative to
            // the `n`th point. If you want to draw a given edge from the edge value, you must
            // first translate to the position of the starting point.
            var edges = this.edges = [];
            // The normals here are the direction of the normal for the `n`th edge of the polygon, relative
            // to the position of the `n`th point. If you want to draw an edge normal, you must first
            // translate to the position of the starting point.
            var normals = this.normals = [];
            // Copy the original points array and apply the offset/angle
            var points = this.points;
            var len = points.length;

            if (len < 3) {
                throw new me.Polygon.Error("Requires at least 3 points");
            }

            // Calculate the edges/normals
            for (i = 0; i < len; i++) {
                var e = new me.Vector2d().copy(points[(i + 1) % len]).sub(points[i]);
                edges.push(e);
                normals.push(new me.Vector2d().copy(e).perp().normalize());
            }
            return this;
        },

        /**
         * translate the Polygon by the specified offset
         * @name translate
         * @memberOf me.Polygon
         * @function
         * @param {Number} x x offset
         * @param {Number} y y offset
         * @return {me.Polygon} this Polygon
         */
        translate : function (x, y) {
            this.pos.x += x;
            this.pos.y += y;
            this._bounds.translate(x, y);
            return this;
        },

        /**
         * translate the Polygon by the specified vector
         * @name translateV
         * @memberOf me.Polygon
         * @function
         * @param {me.Vector2d} v vector offset
         * @return {me.Polygon} this Polygon
         */
        translateV : function (v) {
            this.pos.add(v);
            this._bounds.translateV(v);
            return this;
        },

        /**
         * check if this Polygon contains the specified point
         * @name containsPointV
         * @memberOf me.Polygon
         * @function
         * @param  {me.Vector2d} point
         * @return {boolean} true if contains
         */
        containsPointV: function (v) {
            return this.containsPoint(v.x, v.y);
        },

        /**
         * check if this Polygon contains the specified point <br>
         * (Note: it is highly recommended to first do a hit test on the corresponding <br>
         *  bounding rect, as the function can be highly consuming with complex shapes)
         * @name containsPoint
         * @memberOf me.Polygon
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
         * @memberOf me.Polygon
         * @function
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        getBounds : function () {
            return this._bounds;
        },

        /**
         * update the bounding box for this shape.
         * @name updateBounds
         * @memberOf me.Polygon
         * @function
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        updateBounds : function () {
            var x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
            this.points.forEach(function (point) {
                x = Math.min(x, point.x);
                y = Math.min(y, point.y);
                right = Math.max(right, point.x);
                bottom = Math.max(bottom, point.y);
            });

            if (!this._bounds) {
                this._bounds = new me.Rect(x, y, right - x, bottom - y);
            } else {
                this._bounds.setShape(x, y, right - x, bottom - y);
            }

            return this._bounds.translateV(this.pos);
        },

        /**
         * clone this Polygon
         * @name clone
         * @memberOf me.Polygon
         * @function
         * @return {me.Polygon} new Polygon
         */
        clone : function () {
            var copy = [];
            this.points.forEach(function (point) {
                copy.push(new me.Vector2d(point.x, point.y));
            });
            return new me.Polygon(this.pos.x, this.pos.y, copy);
        }
    });

    /**
     * Base class for Polygon exception handling.
     * @name Error
     * @class
     * @memberOf me.Polygon
     * @constructor
     * @param {String} msg Error message.
     */
    me.Polygon.Error = me.Error.extend({
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Polygon.Error";
        }
    });
})();
