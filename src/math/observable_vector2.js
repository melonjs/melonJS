/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * A Vector2d object that provide notification by executing the given callback when the vector is changed.
     * @class
     * @extends me.Vector2d
     * @constructor
     * @param {Number} [x=0] x value of the vector
     * @param {Number} [y=0] y value of the vector
     * @param {Object} settings additional required parameters
     * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
     */
    me.ObservableVector2d = me.Vector2d.extend({
    /** @scope me.ObservableVector2d.prototype */

        /** @ignore */
        init : function (x, y, settings) {
            /**
             * x value of the vector
             * @public
             * @type Number
             * @name x
             * @memberOf me.ObservableVector2d
             */
            Object.defineProperty(this, "x", {
                /**
                 * @ignore
                 */
                get : function () {
                    return this._x;
                },
                /**
                 * @ignore
                 */
                set : function (value) {
                    this.onUpdate(value, this._y, this._x, this._y);
                    this._x = value;
                }
            });

            /**
             * y value of the vector
             * @public
             * @type Number
             * @name y
             * @memberOf me.ObservableVector2d
             */
            Object.defineProperty(this, "y", {
                /**
                 * @ignore
                 */
                get : function () {
                    return this._y;
                },
                /**
                 * @ignore
                 */
                set : function (value) {
                    this.onUpdate(this._x, value, this._x, this._y);
                    this._y = value;
                }
            });

            if (typeof(settings) === "undefined") {
                throw new me.ObservableVector2d.Error(
                    "undefined `onUpdate` callback"
                );
            }
            this.setCallback(settings.onUpdate);
            this._x = x || 0;
            this._y = y || 0;
        },

        /** @ignore */
        _set : function (x, y) {
            this.onUpdate(x, y, this._x, this._y);
            this._x = x;
            this._y = y;
            return this;
        },

        /**
         * set the vector value without triggering the callback
         * @name setMuted
         * @memberOf me.ObservableVector2d
         * @function
         * @param {Number} x x value of the vector
         * @param {Number} y y value of the vector
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        setMuted : function (x, y) {
            this._x = x;
            this._y = y;
            return this;
        },

        /**
         * set the callback to be executed when the vector is changed
         * @name setCallback
         * @memberOf me.ObservableVector2d
         * @function
         * @param {function} onUpdate callback
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        setCallback : function (fn) {
            if (typeof(fn) !== "function") {
                throw new me.ObservableVector2d.Error(
                    "invalid `onUpdate` callback"
                );
            }
            this.onUpdate = fn;
            return this;
        },

        /**
         * Add the passed vector to this vector
         * @name add
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        add : function (v) {
            return this._set(this._x + v.x, this._y + v.y);
        },

        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        sub : function (v) {
            return this._set(this._x - v.x, this._y - v.y);
        },

        /**
         * Multiply this vector values by the given scalar
         * @name scale
         * @memberOf me.ObservableVector2d
         * @function
         * @param {Number} x
         * @param {Number} [y=x]
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        scale : function (x, y) {
            return this._set(this._x * x, this._y * (typeof (y) !== "undefined" ? y : x));
        },

        /**
         * Multiply this vector values by the passed vector
         * @name scaleV
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        scaleV : function (v) {
            return this._set(this._x * v.x, this._y * v.y);
        },

        /**
         * Divide this vector values by the passed value
         * @name div
         * @memberOf me.ObservableVector2d
         * @function
         * @param {Number} value
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        div : function (n) {
            return this._set(this._x / n, this._y / n);
        },

        /**
         * Update this vector values to absolute values
         * @name abs
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        abs : function () {
            return this._set((this._x < 0) ? -this._x : this._x, (this._y < 0) ? -this._y : this._y);
        },

        /**
         * Clamp the vector value within the specified value range
         * @name clamp
         * @memberOf me.ObservableVector2d
         * @function
         * @param {Number} low
         * @param {Number} high
         * @return {me.ObservableVector2d} new me.ObservableVector2d
         */
        clamp : function (low, high) {
            return new me.ObservableVector2d(this.x.clamp(low, high), this.y.clamp(low, high), {onUpdate: this.onUpdate});
        },

        /**
         * Clamp this vector value within the specified value range
         * @name clampSelf
         * @memberOf me.ObservableVector2d
         * @function
         * @param {Number} low
         * @param {Number} high
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        clampSelf : function (low, high) {
            return this._set(this._x.clamp(low, high), this._y.clamp(low, high));
        },

        /**
         * Update this vector with the minimum value between this and the passed vector
         * @name minV
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        minV : function (v) {
            return this._set((this._x < v.x) ? this._x : v.x, (this._y < v.y) ? this._y : v.y);
        },

        /**
         * Update this vector with the maximum value between this and the passed vector
         * @name maxV
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        maxV : function (v) {
            return this._set((this._x > v.x) ? this._x : v.x, (this._y > v.y) ? this._y : v.y);
        },

        /**
         * Floor the vector values
         * @name floor
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} new me.ObservableVector2d
         */
        floor : function () {
            return new me.ObservableVector2d(Math.floor(this._x), Math.floor(this._y), {onUpdate: this.onUpdate});
        },

        /**
         * Floor this vector values
         * @name floorSelf
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        floorSelf : function () {
            return this._set(Math.floor(this._x), Math.floor(this._y));
        },

        /**
         * Ceil the vector values
         * @name ceil
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} new me.ObservableVector2d
         */
        ceil : function () {
            return new me.ObservableVector2d(Math.ceil(this._x), Math.ceil(this._y), {onUpdate: this.onUpdate});
        },

        /**
         * Ceil this vector values
         * @name ceilSelf
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        ceilSelf : function () {
            return this._set(Math.ceil(this._x), Math.ceil(this._y));
        },

        /**
         * Negate the vector values
         * @name negate
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} new me.ObservableVector2d
         */
        negate : function () {
            return new me.ObservableVector2d(-this._x, -this._y, {onUpdate: this.onUpdate});
        },

        /**
         * Negate this vector values
         * @name negateSelf
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        negateSelf : function () {
            return this._set(-this._x, -this._y);
        },

        /**
         * Copy the x,y values of the passed vector to this one
         * @name copy
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        copy : function (v) {
            return this._set(v.x, v.y);
        },

        /**
         * return true if the two vectors are the same
         * @name equals
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {Boolean}
         */
        equals : function (v) {
            return ((this._x === v.x) && (this._y === v.y));
        },

        /**
         * normalize this vector (scale the vector so that its magnitude is 1)
         * @name normalize
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        normalize : function () {
            var d = this.length();
            if (d > 0) {
                return this._set(this._x / d, this._y / d);
            }
            return this;
        },

        /**
         * change this vector to be perpendicular to what it was before.<br>
         * (Effectively rotates it 90 degrees in a clockwise direction)
         * @name perp
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        perp : function () {
            return this._set(this._y, -this._x);
        },

        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberOf me.ObservableVector2d
         * @function
         * @param {number} angle The angle to rotate (in radians)
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        rotate : function (angle) {
            var x = this._x;
            var y = this._y;
            return this._set(x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle));
        },

        /**
         * return the dot product of this vector and the passed one
         * @name dotProduct
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {Number} The dot product.
         */
        dotProduct : function (v) {
            return this._x * v.x + this._y * v.y;
        },

        /**
         * return the distance between this vector and the passed one
         * @name distance
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {Number}
         */
        distance : function (v) {
            return Math.sqrt((this._x - v.x) * (this._x - v.x) + (this._y - v.y) * (this._y - v.y));
        },

        /**
         * return a clone copy of this vector
         * @name clone
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.ObservableVector2d} new me.ObservableVector2d
         */
        clone : function () {
            // shall we return a cloned me.ObservableVector2d here ?
            return new me.ObservableVector2d(this._x, this._y, {onUpdate: this.onUpdate});
        },

        /**
         * return a `me.Vector2d` copy of this `me.ObservableVector2d` object
         * @name toVector2d
         * @memberOf me.ObservableVector2d
         * @function
         * @return {me.Vector2d} new me.Vector2d
         */
        toVector2d : function () {
            return new me.Vector2d(this._x, this._y);
        },

        /**
         * convert the object to a string representation
         * @name toString
         * @memberOf me.ObservableVector2d
         * @function
         * @return {String}
         */
        toString : function () {
            return "x:" + this._x + ",y:" + this._y;
        }
    });

    /**
     * Base class for Vector2d exception handling.
     * @name Error
     * @class
     * @memberOf me.ObservableVector2d
     * @constructor
     * @param {String} msg Error message.
     */
    me.ObservableVector2d.Error = me.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.ObservableVector2d.Error";
        }
    });
})();
