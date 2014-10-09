/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a line segment Object.<br>
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {Number} x origin point of the Line
     * @param {Number} y origin point of the Line
     * @param {me.Vector2d[]} points array of vector defining the Line
     */
    me.Line = Object.extend(
    /** @scope me.Line.prototype */ {

        /** @ignore */
        init : function (x, y, points) {
            /**
             * origin point of the Line
             * @public
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.Line
             */
            this.pos = new me.Vector2d();

            /**
             * The bounding rectangle for this shape
             * @protected
             * @type {me.Rect}
             * @name bounds
             * @memberOf me.Line
             */
            this.bounds = undefined;

            /**
             * Array of points defining the Line
             * @public
             * @type {me.Vector2d[]}
             * @name points
             * @memberOf me.Line
             */
            this.points = null;

            // the shape type
            this.shapeType = "Line";
            this.setShape(x, y, points);
        },

        /**
         * set new value to the Line
         * @name setShape
         * @memberOf me.Line
         * @function
         * @param {Number} x position of the Line
         * @param {Number} y position of the Line
         * @param {me.Vector2d[]} points array of vector defining the Line
         */
        setShape : function (x, y, points) {
            this.pos.set(x, y);
            this.points = points;
            this.recalc();
            this.updateBounds();
            return this;
        },
        
        
        /**
         * Computes the calculated collision polygon. 
         * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
         * @name recalc
         * @memberOf me.Line
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

            if (len !== 2) {
                throw new me.Line.Error("Requires exactly 2 points");
            }

            // Calculate the edges/normals
            for (i = 0; i < len; i++) {
                var p1 = points[i];
                var p2 = points[(i + 1) % len];
                var e = new me.Vector2d().copy(p2).sub(p1);
                var n = new me.Vector2d().copy(e).perp().normalize();
                edges.push(e);
                normals.push(n);
            }
            return this;
        },

        /**
         * translate the Line by the specified offset
         * @name translate
         * @memberOf me.Line
         * @function
         * @param {Number} x x offset
         * @param {Number} y y offset
         * @return {me.Line} this Line
         */
        translate : function (x, y) {
            this.pos.x += x;
            this.pos.y += y;
            this.bounds.translate(x, y);
            return this;
        },

        /**
         * translate the Line by the specified vector
         * @name translateV
         * @memberOf me.Line
         * @function
         * @param {me.Vector2d} v vector offset
         * @return {me.Line} this Line
         */
        translateV : function (v) {
            this.pos.add(v);
            this.bounds.translateV(v);
            return this;
        },

        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.Line
         * @function
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        getBounds : function () {
            return this.bounds;
        },

        /**
         * update the bounding box for this shape.
         * @name updateBounds
         * @memberOf me.Line
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

            if (!this.bounds) {
                this.bounds = new me.Rect(x, y, right - x, bottom - y);
            } else {
                this.bounds.setShape(x, y, right - x, bottom - y);
            }
            
            return this.bounds.translateV(this.pos);
        },
        
        /**
         * clone this Line
         * @name clone
         * @memberOf me.Line
         * @function
         * @return {me.Line} new Line
         */
        clone : function () {
            var copy = [];
            this.points.forEach(function (point) {
                copy.push(new me.Vector2d(point.x, point.y));
            });
            return new me.Line(this.pos.x, this.pos.y, copy);
        },

        /**
         * debug purpose
         * @ignore
         */
        draw : function (renderer, color) {
            renderer.save();
            renderer.setColor(color || "purple");
            renderer.setLineWidth(1);
            renderer.strokeLine(this);
            renderer.restore();
        }
    });

    /**
     * Base class for Line exception handling.
     * @name Error
     * @class
     * @memberOf me.Line
     * @constructor
     * @param {String} msg Error message.
     */
    me.Line.Error = me.Error.extend({
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Line.Error";
        }
    });
})();
