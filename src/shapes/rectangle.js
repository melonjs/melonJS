/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a rectangle Object
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {Number} x position of the Rectangle
     * @param {Number} y position of the Rectangle
     * @param {Number} w width of the rectangle
     * @param {Number} h height of the rectangle
     */
    me.Rect = Object.extend(
    /** @scope me.Rect.prototype */ {

        /** @ignore */
        init : function (x, y, w, h) {
            /**
             * position of the Rectangle
             * @public
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.Rect
             */
            this.pos = new me.Vector2d(x, y);

            /**
             * width of the Rectangle
             * @public
             * @type {Number}
             * @name width
             * @memberOf me.Rect
             */
            this.width = w;
            /**
             * height of the Rectangle
             * @public
             * @type {Number}
             * @name height
             * @memberOf me.Rect
             */
            this.height = h;

            // the shape type
            this.shapeType = "Rectangle";

            // half width/height
            this.hWidth = ~~(w / 2);
            this.hHeight = ~~(h / 2);
        },

        /**
         * set new value to the rectangle shape
         * @name setShape
         * @memberOf me.Rect
         * @function
         * @param {Number} x position of the Rectangle
         * @param {Number} y position of the Rectangle
         * @param {Number} w width of the rectangle
         * @param {Number} h height of the rectangle
         * @return {me.Rect} this rectangle
         */
        setShape : function (x, y, w, h) {
            // set the new position vector
            this.pos.set(x, y);

            // resize
            this.resize(w, h);

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
            this.width = w;
            this.height = h;

            this.hWidth = ~~(w / 2);
            this.hHeight = ~~(h / 2);

            return this;
        },

        /**
         * returns the bounding box for this shape, the smallest rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.Rect
         * @function
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        getBounds : function () {
            return this;
        },
        
        /**
         * update the bounding box for this shape.
         * @name updateBounds
         * @memberOf me.Rect
         * @function
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        updateBounds : function () {
            return this;
        },
        
        /**
         * clone this rectangle
         * @name clone
         * @memberOf me.Rect
         * @function
         * @return {me.Rect} new rectangle
         */
        clone : function () {
            return new me.Rect(this.pos.x, this.pos.y, this.width, this.height);
        },

        /**
         * translate the rect by the specified offset
         * @name translate
         * @memberOf me.Rect
         * @function
         * @param {Number} x x offset
         * @param {Number} y y offset
         * @return {me.Rect} this rectangle
         */
        translate : function (x, y) {
            this.pos.x += x;
            this.pos.y += y;
            return this;
        },

        /**
         * translate the rect by the specified vector
         * @name translateV
         * @memberOf me.Rect
         * @function
         * @param {me.Vector2d} v vector offset
         * @return {me.Rect} this rectangle
         */
        translateV : function (v) {
            return this.translate(v.x, v.y);
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

            this.resize(
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
            return (
                this.left   === r.left  &&
                this.right  === r.right &&
                this.top    === r.top   &&
                this.bottom === r.bottom
            );
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
            return (
                this.left < r.right &&
                r.left < this.right &&
                this.top < r.bottom &&
                r.top < this.bottom
            );
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
            return (
                r.left >= this.left &&
                r.right <= this.right &&
                r.top >= this.top &&
                r.bottom <= this.bottom
            );
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
            return (
                x >= this.left &&
                x <= this.right &&
                y >= this.top &&
                y <= this.bottom
            );
        },

        /**
         * Returns a polygon whose edges are the same as this box.
         * @name toPolygon
         * @memberOf me.Rect
         * @function
         * @return {me.PolyShape} a new Polygon that represents this rectangle.
         */
        toPolygon: function () {
            var pos = this.pos;
            var w = this.width;
            var h = this.height;
            return new me.PolyShape(
                pos.x, pos.y, [
                    new me.Vector2d(), new me.Vector2d(w, 0),
                    new me.Vector2d(w, h), new me.Vector2d(0, h)
                ],
                true
            );
        },

        /**
         * debug purpose
         * @ignore
         */
        draw : function (renderer, color) {
            // draw the rectangle
            renderer.strokeRect(this.left, this.top, this.width, this.height, color || "red");
        }
    });

    // redefine some properties to ease our life when getting the rectangle coordinates
    /**
     * left coordinate of the Rectangle<br>
     * takes in account the adjusted size of the rectangle (if set)
     * @public
     * @type {Number}
     * @name left
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "left", {
        get : function () {
            return this.pos.x;
        },
        configurable : true
    });
    
    /**
     * right coordinate of the Rectangle<br>
     * takes in account the adjusted size of the rectangle (if set)
     * @public
     * @type {Number}
     * @name right
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "right", {
        get : function () {
            return this.pos.x + this.width;
        },
        configurable : true
    });

    /**
     * top coordinate of the Rectangle<br>
     * takes in account the adjusted size of the rectangle (if set)
     * @public
     * @type {Number}
     * @name top
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "top", {
        get : function () {
            return this.pos.y;
        },
        configurable : true
    });

    /**
     * bottom coordinate of the Rectangle<br>
     * takes in account the adjusted size of the rectangle (if set)
     * @public
     * @type {Number}
     * @name bottom
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "bottom", {
        get : function () {
            return this.pos.y + this.height;
        },
        configurable : true
    });

})();
