/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a rectangle Object
     * @class
     * @extends me.Polygon
     * @memberOf me
     * @constructor
     * @param {Number} x position of the Rectangle
     * @param {Number} y position of the Rectangle
     * @param {Number} w width of the rectangle
     * @param {Number} h height of the rectangle
     */
    me.Rect = me.Polygon.extend(
    /** @scope me.Rect.prototype */ {

        /** @ignore */
        init : function (x, y, w, h) {

            this.pos = new me.Vector2d();

            // pre-allocate the vector array
            this.points = [
                new me.Vector2d(), new me.Vector2d(),
                new me.Vector2d(), new me.Vector2d()
            ];

            this.shapeType = "Rectangle";
            this.setShape(x, y, w, h);
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

            this.points[0].set(0, 0); // 0, 0
            this.points[1].set(w, 0); // 1, 0
            this.points[2].set(w, h); // 1, 1
            this.points[3].set(0, h); // 0, 1

            this._super(me.Polygon, "setShape", [x, y, this.points]);

            // private properties to cache w & h
            this._width = w;
            this._height = h;

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
         * resize the rectangle to contain all the given points coordinates.
         * @name setPoints
         * @memberOf me.Rect
         * @function
         * @param {me.Vector2d[]} points array of vector defining a shape
         * @return {me.Rect} this shape bounding box Rectangle object
         */
        setPoints : function (points) {
            var x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
            points.forEach(function (point) {
                x = Math.min(x, point.x);
                y = Math.min(y, point.y);
                right = Math.max(right, point.x);
                bottom = Math.max(bottom, point.y);
            });
            this.setShape(x, y, right - x, bottom - y);
            return this;
        },

        /**
         * Computes the calculated collision polygon.
         * This **must** be called if the `points` array is modified manually.
         * @ignore
         * @name recalc
         * @memberOf me.Rect
         * @function
         */
        recalc : function () {
            this._super(me.Polygon, "recalc");
            this._width = this.points[2].x;
            this._height = this.points[2].y;
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
            return new me.Rect(this.pos.x, this.pos.y, this._width, this._height);
        },

        /**
         * copy the position and size of the given rectangle into this one
         * @name copy
         * @memberOf me.Rect
         * @function
         * @param {me.Rect} rect Source rectangle
         * @return {me.Rect} new rectangle
         */
        copy : function (rect) {
            return this.setShape(rect.pos.x, rect.pos.y, rect._width, rect._height);
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
         * @return {me.Polygon} a new Polygon that represents this rectangle.
         */
        toPolygon: function () {
            return new me.Polygon(
                this.pos.x, this.pos.y, this.points
            );
        }
    });

    // redefine some properties to ease our life when getting the rectangle coordinates

    /**
     * left coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name left
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "left", {
        /**
         * @ignore
         */
        get : function () {
            return this.pos.x;
        },
        configurable : true
    });

    /**
     * right coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name right
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "right", {
        /**
         * @ignore
         */
        get : function () {
            var w = this._width;
            return (this.pos.x + w) || w;
        },
        configurable : true
    });

    /**
     * top coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name top
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "top", {
        /**
         * @ignore
         */
        get : function () {
            return this.pos.y;
        },
        configurable : true
    });

    /**
     * bottom coordinate of the Rectangle
     * @public
     * @type {Number}
     * @name bottom
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "bottom", {
        /**
         * @ignore
         */
        get : function () {
            var h = this._height;
            return (this.pos.y + h) || h;
        },
        configurable : true
    });

    /**
     * width of the Rectangle
     * @public
     * @type {Number}
     * @name width
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "width", {
        /**
         * @ignore
         */
        get : function () {
            return this._width;
        },
        /**
         * @ignore
         */
        set : function (value) {
            this.points[1].x = this.points[2].x = value;
            // _width updated in recalc
            this.recalc();
        },
        configurable : true
    });

    /**
     * height of the Rectangle
     * @public
     * @type {Number}
     * @name height
     * @memberOf me.Rect
     */
    Object.defineProperty(me.Rect.prototype, "height", {
        /**
         * @ignore
         */
        get : function () {
            return this._height;
        },
        /**
         * @ignore
         */
        set : function (value) {
            this.points[2].y = this.points[3].y = value;
            // _height updated in recalc
            this.recalc();
        },
        configurable : true
    });

})();
