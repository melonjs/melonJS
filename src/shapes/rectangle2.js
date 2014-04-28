/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function (window) {
    
    // vertices indexes
    // v1-----v2
    //  |-----|
    // v4-----v3     
    var TOP_LEFT = 0;
    var TOP_RIGHT = 1;
    var BOTTOM_RIGHT = 2;
    var BOTTOM_LEFT = 3;

    
    /**
     * a Rectangle Object
     * @class
     * @extends me.PolyShape
     * @memberOf me
     * @constructor
     * @param {me.Vector2d} v x,y position of the rectange
     * @param {int} w width of the rectangle
     * @param {int} h height of the rectangle
     */
    me.Rect = me.PolyShape.extend(
    /** @scope me.Rect.prototype */ {

        /**
         * left coordinate of the Rectange<br>
         * takes in account the adjusted size of the rectangle (if set)
         * @public
         * @type Int
         * @name left
         * @memberOf me.Rect
         */
         // define later in the constructor
        
        /**
         * right coordinate of the Rectange<br>
         * takes in account the adjusted size of the rectangle (if set)
         * @public
         * @type Int
         * @name right
         * @memberOf me.Rect
         */
         // define later in the constructor
         
        /**
         * bottom coordinate of the Rectange<br>
         * takes in account the adjusted size of the rectangle (if set)
         * @public
         * @type Int
         * @name bottom
         * @memberOf me.Rect
         */
        // define later in the constructor
        
        /**
         * top coordinate of the Rectange<br>
         * takes in account the adjusted size of the rectangle (if set)
         * @public
         * @type Int
         * @name top
         * @memberOf me.Rect
         */
        // define later in the constructor
         
        /**
         * width of the Rectange
         * @public
         * @type Int
         * @name width
         * @memberOf me.Rect
         */
        width : 0,
        /**
         * height of the Rectange
         * @public
         * @type Int
         * @name height
         * @memberOf me.Rect
         */
        height : 0,

        // half width/height
        hWidth : 0,
        hHeight : 0,

        // the shape type
        shapeType : "Rectangle",
        
        /** @ignore */
        init : function (v, w, h) {
            /**
             * allow expanding and contracting the rect with a vector<br>
             * while keeping its original size and shape<br>
             * @ignore
             * @type me.Vector2d
             * @name rangeV
             * @memberOf me.Rect
             * @see me.Rect#addV
             */
            this.rangeV = new me.Vector2d();
            // create 4 default vertices
            this.points = [
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d()
            ];

            // this will actually call this object setShspe function..
            this._super(me.PolyShape, "init", [v, w, h]);
   
            // Allow expanding and contracting the rect with a vector
            // while keeping its original size and shape
            this.rangeV.set(0, 0);
            
            // redefine some properties to ease our life when getting the rectangle coordinates
            // redefine some properties to ease our life when getting the rectangle coordinates
            Object.defineProperty(this, "left", {
                get : function () {
                    var x = this.pos.x;
                    var xv = x + this.rangeV.x;
                    return x < xv ? x : xv;
                },
                configurable : true
            });
            
            Object.defineProperty(this, "right", {
                get : function () {
                    var x = this.pos.x + this.width;
                    var xv = x + this.rangeV.x;
                    return x > xv ? x : xv;
                },
                configurable : true
            });

            Object.defineProperty(this, "top", {
                get : function () {
                    var y = this.pos.y;
                    var yv = y + this.rangeV.y;
                    return y < yv ? y : yv;
                },
                configurable : true
            });

            Object.defineProperty(this, "bottom", {
                get : function () {
                    var y = this.pos.y + this.height;
                    var yv = y + this.rangeV.y;
                    return y > yv ? y : yv;
                },
                configurable : true
            });

        },

        /**
         * set new value to the rectangle shape
         * @name setShape
         * @memberOf me.Rect
         * @function
         * @param {me.Vector2d} v x,y position for the rectangle
         * @param {Number} w width of the rectangle
         * @param {Number} h height of the rectangle
         * @return {me.Rect} this rectangle
         */
        setShape : function (v, w, h) {
            this.pos.setV(v);

            this.points[TOP_LEFT].setV(v); //v1
            this.points[TOP_RIGHT].set(v.x + w, v.y); //v2
            this.points[BOTTOM_RIGHT].set(v.x + w, v.y + h); //v3
            this.points[BOTTOM_LEFT].set(v.x, v.y + h); //v4

            this.closed = true;
                     
            this.width = w;
            this.height = h;

            // half width/height
            this.hWidth = ~~(this.width / 2);
            this.hHeight = ~~(this.height / 2);
          
            return this;
        },
  
        /**
         * resize the rectangle
         * @name resize
         * @memberOf me.Rect
         * @function
         * @param {Number} w new width of the rectangle
         * @param {Number} h new height of the rectangle
         * @return {me.Rect} this rectangle
         */
        resize : function (w, h) {
            this.points[TOP_RIGHT].x = this.points[TOP_LEFT].x + w;
            this.points[BOTTOM_RIGHT].x = this.points[BOTTOM_LEFT].x + w;

            this.points[BOTTOM_LEFT].y = this.points[TOP_LEFT].y + h;
            this.points[BOTTOM_RIGHT].y = this.points[TOP_RIGHT].y + h;
            
            this.width = w;
            this.height = h;
            
            // half width/height
            this.hWidth = ~~(this.width / 2);
            this.hHeight = ~~(this.height / 2);
            
            return this;
        },

        /**
         * returns the bounding box for this shape, the smallest rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.Rect
         * @function
         * @param {me.Rect} [rect] an optional rectangle object to use when returning the bounding rect(else returns a new object)
         * @return {me.Rect} new rectangle    
         */
        getBounds : function (rect) {
            if (typeof(rect) !== "undefined") {
                return rect.setShape(this.pos, this.width, this.height);
            } else {
                return this.clone();
            }
        },
        
        /**
         * clone this rectangle
         * @name clone
         * @memberOf me.Rect
         * @function
         * @return {me.Rect} new rectangle    
         */
        clone : function () {
            return new me.Rect(this.pos, this.width, this.height);
        },
        

        /**
         * add a vector to this rect
         * @name addV
         * @memberOf me.Rect
         * @function
         * @param {me.Vector2d} v vector offset
         * @return {me.Rect} this rectangle
         */
        addV : function (v) {
            this.rangeV.setV(v);
            return this;
        },

        /**
         * merge this rectangle with another one
         * @name union
         * @memberOf me.Rect
         * @function
         * @param {me.Rect} rect other rectangle to union with
         * @return {me.Rect} the union(ed) rectangle     
         */
        union : function (/** {me.Rect} */ r) {
            var x1 = Math.min(this.left, r.left);
            var y1 = Math.min(this.top, r.top);

            this.resize (
                Math.max(this.right, r.right) - x1,
                Math.max(this.bottom, r.bottom) - y1
            );
            
            this.pos.set(x1, y1);
           
            return this;
        },

        /**
         *    
         * flip on X axis
         * usefull when used as collision box, in a non symetric way
         * @ignore
         * @param sw the sprite width
         */
        flipX : function (sw) {
            this.pos.x = sw - this.width - this.pos.x;
            return this;
        },

        /**
         *    
         * flip on Y axis
         * usefull when used as collision box, in a non symetric way
         * @ignore
         * @param sh the height width
         */
        flipY : function (sh) {
            this.pos.y = sh - this.height - this.pos.y;
            return this;
        },
        
        /**
         * return true if this rectangle is equal to the specified one
         * @name equals
         * @memberOf me.Rect
         * @function
         * @param {me.Rect} rect
         * @return {Boolean}
         */
        equals : function (r) {
            return (this.left   === r.left  && 
                    this.right  === r.right && 
                    this.top    === r.top   &&
                    this.bottom === r.bottom);
        },

        /**
         * check if this rectangle is intersecting with the specified one
         * @name overlaps
         * @memberOf me.Rect
         * @function
         * @param  {me.Rect} rect
         * @return {boolean} true if overlaps
         */
        overlaps : function (r)    {
            return (this.left < r.right && 
                    r.left < this.right && 
                    this.top < r.bottom &&
                    r.top < this.bottom);
        },
        
        /**
         * check if this rectangle is within the specified one
         * @name within
         * @memberOf me.Rect
         * @function
         * @param  {me.Rect} rect
         * @return {boolean} true if within
         */
        within: function (r) {
            return r.contains(this);
        },
        
        /**
         * check if this rectangle contains the specified one
         * @name contains
         * @memberOf me.Rect
         * @function
         * @param  {me.Rect} rect
         * @return {boolean} true if contains
         */
        contains: function (r) {
            return (r.left >= this.left && 
                    r.right <= this.right &&
                    r.top >= this.top && 
                    r.bottom <= this.bottom);
        },
        
        /**
         * check if this rectangle contains the specified point
         * @name containsPointV
         * @memberOf me.Rect
         * @function
         * @param  {me.Vector2d} point
         * @return {boolean} true if contains
         */
        containsPointV: function (v) {
            return this.containsPoint(v.x, v.y);
        },

        /**
         * check if this rectangle contains the specified point
         * @name containsPoint
         * @memberOf me.Rect
         * @function
         * @param  {Number} x x coordinate
         * @param  {Number} y y coordinate
         * @return {boolean} true if contains
         */
        containsPoint: function (x, y) {
            return  (x >= this.left && x <= this.right && 
                    (y >= this.top) && y <= this.bottom);
        },

        /**
         * AABB vs AABB collission dectection<p>
         * If there was a collision, the return vector will contains the following values: 
         * @example
         * if (v.x != 0 || v.y != 0)
         * {
         *   if (v.x != 0)
         *   {
         *      // x axis
         *      if (v.x<0)
         *         console.log("x axis : left side !");
         *      else
         *         console.log("x axis : right side !");
         *   }
         *   else
         *   {
         *      // y axis
         *      if (v.y<0)
         *         console.log("y axis : top side !");
         *      else
         *         console.log("y axis : bottom side !");            
         *   }
         *        
         * }
         * @ignore
         * @param {me.Rect} rect
         * @return {me.Vector2d} 
         */
        collideWithRectangle : function (/** {me.Rect} */ rect) {
            // response vector
            var p = new me.Vector2d(0, 0);

            // check if both box are overlaping
            if (this.overlaps(rect)) {
                // compute delta between this & rect
                var dx = this.left + this.hWidth  - rect.left - rect.hWidth;
                var dy = this.top  + this.hHeight - rect.top  - rect.hHeight;

                // compute penetration depth for both axis
                p.x = (rect.hWidth  + this.hWidth)  - (dx < 0 ? -dx : dx); // - Math.abs(dx);
                p.y = (rect.hHeight + this.hHeight) - (dy < 0 ? -dy : dy); // - Math.abs(dy);

                // check and "normalize" axis
                if (p.x < p.y) {
                    p.y = 0;
                    p.x = dx < 0 ? -p.x : p.x;
                } else {
                    p.x = 0;
                    p.y = dy < 0 ? -p.y : p.y;
                }
            }
            return p;
        },

        /**
         * debug purpose
         * @ignore
         */
        draw : function (context, color) {
            // draw the rectangle
            context.strokeStyle = color || "red";
            context.strokeRect(this.left, this.top, this.width, this.height);

        }
    });

})(window);
