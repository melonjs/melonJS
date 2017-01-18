/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a generic 3D Vector Object
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {Number} [x=0] x value of the vector
     * @param {Number} [y=0] y value of the vector
     * @param {Number} [z=0] z value of the vector
     */
    me.Vector3d = me.Object.extend(
    /** @scope me.Vector3d.prototype */
    {
        /** @ignore */
        init : function (x, y, z) {
            return this.set(x || 0, y || 0, z || 0);
        },

        /**
         * @ignore */
        _set : function (x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        },

        /**
         * set the Vector x and y properties to the given values<br>
         * @name set
         * @memberOf me.Vector3d
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} z
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        set : function (x, y, z) {
            if (x !== +x || y !== +y || z !== +z) {
                throw new me.Vector3d.Error(
                    "invalid x, y, z parameters (not a number)"
                );
            }

            /**
             * x value of the vector
             * @public
             * @type Number
             * @name x
             * @memberOf me.Vector3d
             */
            //this.x = x;

            /**
             * y value of the vector
             * @public
             * @type Number
             * @name y
             * @memberOf me.Vector3d
             */
            //this.y = y;

            /**
             * z value of the vector
             * @public
             * @type Number
             * @name z
             * @memberOf me.Vector3d
             */
            //this.z = z;

            return this._set(x, y, z);
        },

        /**
         * set the Vector x and y properties to 0
         * @name setZero
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        setZero : function () {
            return this.set(0, 0, 0);
        },

        /**
         * set the Vector x and y properties using the passed vector
         * @name setV
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        setV : function (v) {
            return this._set(v.x, v.y, typeof (v.z) !== "undefined" ? v.z : this.z);
        },

        /**
         * Add the passed vector to this vector
         * @name add
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        add : function (v) {
            return this._set(this.x + v.x, this.y + v.y, this.z + (v.z || 0));
        },

        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        sub : function (v) {
            return this._set(this.x - v.x, this.y - v.y, this.z - (v.z || 0));
        },

        /**
         * Multiply this vector values by the given scalar
         * @name scale
         * @memberOf me.Vector3d
         * @function
         * @param {Number} x
         * @param {Number} [y=x]
         * @param {Number} [z=x]
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        scale : function (x, y, z) {
            y = (typeof (y) !== "undefined" ? y : x);
            z = (typeof (z) !== "undefined" ? z : x);
            return this._set(this.x * x, this.y * y, this.z * z);
        },

        /**
         * Multiply this vector values by the passed vector
         * @name scaleV
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        scaleV : function (v) {
            return this._set(this.x * v.x, this.y * v.y, this.z * (v.z || 1));
        },

        /**
         * Convert this vector into isometric coordinate space
         * @name toIso
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        toIso : function () {
            return this._set(this.x - this.y, (this.x + this.y) * 0.5, this.z);
        },

        /**
         * Convert this vector into 2d coordinate space
         * @name to2d
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        to2d : function () {
            return this._set(this.y + this.x / 2, this.y - this.x / 2, this.z);
        },

        /**
         * Divide this vector values by the passed value
         * @name div
         * @memberOf me.Vector3d
         * @function
         * @param {Number} value
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        div : function (n) {
            return this._set(this.x / n, this.y / n, this.z / n);
        },

        /**
         * Update this vector values to absolute values
         * @name abs
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        abs : function () {
            return this._set((this.x < 0) ? -this.x : this.x, (this.y < 0) ? -this.y : this.y, (this.z < 0) ? -this.z : this.z);
        },

        /**
         * Clamp the vector value within the specified value range
         * @name clamp
         * @memberOf me.Vector3d
         * @function
         * @param {Number} low
         * @param {Number} high
         * @return {me.Vector3d} new me.Vector3d
         */
        clamp : function (low, high) {
            return new me.Vector3d(this.x.clamp(low, high), this.y.clamp(low, high), this.z.clamp(low, high));
        },

        /**
         * Clamp this vector value within the specified value range
         * @name clampSelf
         * @memberOf me.Vector3d
         * @function
         * @param {Number} low
         * @param {Number} high
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        clampSelf : function (low, high) {
            return this._set(this.x.clamp(low, high), this.y.clamp(low, high), this.z.clamp(low, high));
        },

        /**
         * Update this vector with the minimum value between this and the passed vector
         * @name minV
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        minV : function (v) {
            var _vz = v.z || 0;
            return this._set((this.x < v.x) ? this.x : v.x, (this.y < v.y) ? this.y : v.y, (this.z < _vz) ? this.z : _vz);
        },

        /**
         * Update this vector with the maximum value between this and the passed vector
         * @name maxV
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        maxV : function (v) {
            var _vz = v.z || 0;
            return this._set((this.x > v.x) ? this.x : v.x, (this.y > v.y) ? this.y : v.y, (this.z > _vz) ? this.z : _vz);
        },

        /**
         * Floor the vector values
         * @name floor
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} new me.Vector3d
         */
        floor : function () {
            return new me.Vector3d(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
        },

        /**
         * Floor this vector values
         * @name floorSelf
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        floorSelf : function () {
            return this._set(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
        },

        /**
         * Ceil the vector values
         * @name ceil
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} new me.Vector3d
         */
        ceil : function () {
            return new me.Vector3d(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
        },

        /**
         * Ceil this vector values
         * @name ceilSelf
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        ceilSelf : function () {
            return this._set(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.z));
        },

        /**
         * Negate the vector values
         * @name negate
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} new me.Vector3d
         */
        negate : function () {
            return new me.Vector3d(-this.x, -this.y, -this.z);
        },

        /**
         * Negate this vector values
         * @name negateSelf
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        negateSelf : function () {
            return this._set(-this.x, -this.y, -this.z);
        },

        /**
         * Copy the x,y values of the passed vector to this one
         * @name copy
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        copy : function (v) {
            return this._set(v.x, v.y, typeof (v.z) !== "undefined" ? v.z : this.z);
        },

        /**
         * return true if the two vectors are the same
         * @name equals
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {Boolean}
         */
        equals : function (v) {
            return ((this.x === v.x) && (this.y === v.y) && (this.z === (v.z || this.z)));
        },

        /**
         * normalize this vector (scale the vector so that its magnitude is 1)
         * @name normalize
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        normalize : function () {
            var d = this.length();
            if (d > 0) {
                return this._set(this.x / d, this.y / d, this.z / d);
            }
            return this;
        },

        /**
         * change this vector to be perpendicular to what it was before.<br>
         * (Effectively rotates it 90 degrees in a clockwise direction around the z axis)
         * @name perp
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        perp : function () {
            return this._set(this.y, -this.x, this.z);
        },

        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians) around the z axis
         * @name rotate
         * @memberOf me.Vector3d
         * @function
         * @param {number} angle The angle to rotate (in radians)
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        rotate : function (angle) {
            var x = this.x;
            var y = this.y;
            return this._set(x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), this.z);
        },

        /**
         * return the dot product of this vector and the passed one
         * @name dotProduct
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {Number} The dot product.
         */
        dotProduct : function (v) {
            return this.x * v.x + this.y * v.y + this.z * (v.z || 1);
        },

       /**
         * return the square length of this vector
         * @name length2
         * @memberOf me.Vector3d
         * @function
         * @return {Number} The length^2 of this vector.
         */
        length2 : function () {
            return this.dotProduct(this);
        },

        /**
         * return the length (magnitude) of this vector
         * @name length
         * @memberOf me.Vector3d
         * @function
         * @return {Number} the length of this vector
         */
        length : function () {
            return Math.sqrt(this.length2());
        },

        /**
         * return the distance between this vector and the passed one
         * @name distance
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {Number}
         */
        distance : function (v) {
            var dx = this.x - v.x, dy = this.y - v.y, dz = this.z - (v.z || 0);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        },

        /**
         * return the angle between this vector and the passed one
         * @name angle
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v
         * @return {Number} angle in radians
         */
        angle : function (v) {
            return Math.acos((this.dotProduct(v) / (this.length() * v.length())).clamp(-1, 1));
        },

        /**
         * project this vector on to another vector.
         * @name project
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v The vector to project onto.
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        project : function (v) {
            return this.scale(this.dotProduct(v) / v.length2());
        },

        /**
         * Project this vector onto a vector of unit length.<br>
         * This is slightly more efficient than `project` when dealing with unit vectors.
         * @name projectN
         * @memberOf me.Vector3d
         * @function
         * @param {me.Vector2d|me.Vector3d} v The unit vector to project onto.
         * @return {me.Vector3d} Reference to this object for method chaining
         */
        projectN : function (v) {
            return this.scale(this.dotProduct(v));
        },

        /**
         * return a clone copy of this vector
         * @name clone
         * @memberOf me.Vector3d
         * @function
         * @return {me.Vector3d} new me.Vector3d
         */
        clone : function () {
            return new me.Vector3d(this.x, this.y, this.z);
        },

        /**
         * convert the object to a string representation
         * @name toString
         * @memberOf me.Vector3d
         * @function
         * @return {String}
         */
        toString : function () {
            return "x:" + this.x + ",y:" + this.y + ",z:" + this.z;
        }
    });

    /**
     * Base class for Vector3d exception handling.
     * @name Error
     * @class
     * @memberOf me.Vector3d
     * @constructor
     * @param {String} msg Error message.
     */
    me.Vector3d.Error = me.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Vector3d.Error";
        }
    });
})();
