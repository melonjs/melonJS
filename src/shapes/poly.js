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
     * @param {Number} x origin point of the PolyShape
     * @param {Number} y origin point of the PolyShape
     * @param {me.Vector2d[]} points array of vector defining the polyshape
     * @param {boolean} closed true if a polygone, false if a polyline
     */
    me.PolyShape = Object.extend(
    /** @scope me.PolyShape.prototype */ {

        /** @ignore */
        init : function (x, y, points, closed) {
            /**
             * origin point of the PolyShape
             * @public
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.PolyShape
             */
            this.pos = new me.Vector2d(x, y);

            /**
             * The bounding rectangle for this shape
             * @protected
             * @type {me.Rect}
             * @name bounds
             * @memberOf me.PolyShape
             */
            this.bounds = undefined;

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
            this.setShape(this.pos, points, closed);
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
            this.recalc();
            // TODO probably implement an updateBounds() function too
            //this.getBounds();
           
            return this;
        },
        
        
        /**
         * Computes the calculated collision polygon. 
         * This **must** be called if the `points` array, `angle`, or `offset` is modified manualy.
         * @name recalc
         * @memberOf me.PolyShape
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

            // Calculate the edges/normals
            for (i = 0; i < len; i++) {
                var p1 = points[i];
                var p2 = i < len - 1 ? points[i + 1] : points[0];
                var e = new me.Vector2d().copy(p2).sub(p1);
                var n = new me.Vector2d().copy(e).perp().normalize();
                edges.push(e);
                normals.push(n);
            }
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
            this.bounds.translate(x, y);
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
            this.bounds.translateV(v);
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
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        getBounds : function () {
            if (!this.bounds) {
                var pos = this.pos.clone(), right = 0, bottom = 0;
                this.points.forEach(function (point) {
                    pos.x = Math.min(pos.x, point.x);
                    pos.y = Math.min(pos.y, point.y);
                    right = Math.max(right, point.x);
                    bottom = Math.max(bottom, point.y);
                });
                this.bounds = new me.Rect(pos.x, pos.y, right - pos.x, bottom - pos.y);
            }
            return this.bounds;
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
            return new me.PolyShape(this.pos.x, this.pos.y, copy, this.closed);
        },

        /**
         * debug purpose
         * @ignore
         */
        draw : function (renderer, color) {
            renderer.save();
            renderer.strokePolyShape(this, color);
            renderer.restore();
        }
    });
})();
