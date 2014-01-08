/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function(window) {
    
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

        /**
         * origin point of the PolyShape
         * @public
         * @type me.Vector2d
         * @name pos
         * @memberOf me.PolyShape
         */
        pos : null,
         
        /**
         * Array of points defining the polyshape
         * @public
         * @type me.Vector2d[]
         * @name points
         * @memberOf me.PolyShape
         */
        points : null,

        /**
         * Specified if the shape is closed (i.e. polygon)
         * @public
         * @type boolean
         * @name closed
         * @memberOf me.PolyShape
         */
        closed : null,
        

        // the shape type
        shapeType : "PolyShape",
        
        
        /** @ignore */
        init : function(v, points, closed) {
            if (this.pos === null) {
                this.pos = new me.Vector2d();
            }
            this.set(v, points, closed);
        },

        /**
         * set new value to the PolyShape
         * @name set
         * @memberOf me.PolyShape
         * @function
         * @param {me.Vector2d} v origin point of the PolyShape
         * @param {me.Vector2d[]} points array of vector defining the polyshape
         * @param {boolean} closed true if a polygone, false if a polyline     
         */
        set : function(v, points, closed) {
            this.pos.setV(v);
            this.points = points;
            this.closed = (closed === true);
            this.getBounds();

            return this;
        },

        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.PolyShape
         * @function
         * @param {me.Rect} [rect] an optional rectangle object to use when returning the bounding rect(else returns a new object)
         * @return {me.Rect} the bounding box Rectangle object
         */
        getBounds : function(rect) {
            var pos = this.pos.clone(), right = 0, bottom = 0;
            this.points.forEach(function(point) {
                pos.x = Math.min(pos.x, point.x);
                pos.y = Math.min(pos.y, point.y);
                right = Math.max(right, point.x);
                bottom = Math.max(bottom, point.y);
            });
            if (typeof(rect) !== 'undefined') {
                return rect.set(pos, right - pos.x, bottom - pos.y);
            } else {
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
        clone : function() {
            return new me.PolyShape(this.pos.clone(), this.points, this.closed);
        },


        /**
         * debug purpose
         * @ignore
         */
        draw : function(context, color) {
            context.save();
            context.translate(-this.pos.x, -this.pos.y);
            context.strokeStyle = color || "red";
            context.beginPath();
            context.moveTo(this.points[0].x, this.points[0].y);
            this.points.forEach(function(point) {
                context.lineTo(point.x, point.y);
                context.moveTo(point.x, point.y);
            
            });
            if (this.closed===true) {
                context.lineTo(this.points[0].x, this.points[0].y);
            }
            context.stroke();
            context.restore();
        }

    });

})(window);
