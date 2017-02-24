/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * A Vector3d object that provide notification by executing the given callback when the vector is changed.
     * @class
     * @extends me.Vector3d
     * @constructor
     * @param {Number} [x=0] x value of the vector
     * @param {Number} [y=0] y value of the vector
     * @param {Number} [z=0] z value of the vector
     * @param {Object} settings additional required parameters
     * @param {Function} settings.onUpdate the callback to be executed when the vector is changed
     */
    me.ObservableVector3d = me.Vector3d.extend({
    /** @scope me.ObservableVector3d.prototype */

        /**
         * @ignore
         */
        init : function (x, y, z, settings) {
            /**
             * x value of the vector
             * @public
             * @type Number
             * @name x
             * @memberOf me.ObservableVector3d
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
                    this.onUpdate(value, this._y, this._z, this._x, this._y, this._z);
                    this._x = value;
                }
            });

            /**
             * y value of the vector
             * @public
             * @type Number
             * @name y
             * @memberOf me.ObservableVector3d
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
                    this.onUpdate(this._x, value, this._z, this._x, this._y, this._z);
                    this._y = value;
                }
            });

            /**
             * z value of the vector
             * @public
             * @type Number
             * @name z
             * @memberOf me.ObservableVector3d
             */
            Object.defineProperty(this, "z", {
                /**
                 * @ignore
                 */
                get : function () {
                    return this._z;
                },
                /**
                 * @ignore
                 */
                set : function (value) {
                    this.onUpdate(this._x, this._y, value, this._x, this._y, this._z);
                    this._z = value;
                }
            });

            if (typeof(settings) === "undefined") {
                throw new me.ObservableVector3d.Error(
                    "undefined `onUpdate` callback"
                );
            }
            this.setCallback(settings.onUpdate);
            this._x = x || 0;
            this._y = y || 0;
            this._z = z || 0;
        },

        /**
         * @ignore */
        _set : function (x, y, z) {
            this.onUpdate(x, y, z, this._x, this._y, this._z);
            this._x = x;
            this._y = y;
            this._z = z;
            return this;
        },

        /**
         * set the vector value without triggering the callback
         * @name setMuted
         * @memberOf me.ObservableVector3d
         * @function
         * @param {Number} x x value of the vector
         * @param {Number} y y value of the vector
         * @param {Number} z z value of the vector
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        setMuted : function (x, y, z) {
            this._x = x;
            this._y = y;
            this._z = z;
            return this;
        },

        /**
         * set the callback to be executed when the vector is changed
         * @name setCallback
         * @memberOf me.ObservableVector3d
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
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        add : function (v) {
            return this._set(this._x + v.x, this._y + v.y, this._z + (v.z || 0));
        },

        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        sub : function (v) {
            return this._set(this._x - v.x, this._y - v.y, this._z - (v.z || 0));
        },

        /**
         * Multiply this vector values by the given scalar
         * @name scale
         * @memberOf me.ObservableVector3d
         * @function
         * @param {Number} x
         * @param {Number} [y=x]
         * @param {Number} [z=x]
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        scale : function (x, y, z) {
            y = (typeof (y) !== "undefined" ? y : x);
            z = (typeof (z) !== "undefined" ? z : x);
            return this._set(this._x * x, this._y * y, this._z * z);
        },

        /**
         * Multiply this vector values by the passed vector
         * @name scaleV
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        scaleV : function (v) {
            return this._set(this._x * v.x, this._y * v.y, this._z * (v.z || 1));
        },

        /**
         * Divide this vector values by the passed value
         * @name div
         * @memberOf me.ObservableVector3d
         * @function
         * @param {Number} value
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        div : function (n) {
            return this._set(this._x / n, this._y / n, this._z / n);
        },

        /**
         * Update this vector values to absolute values
         * @name abs
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        abs : function () {
            return this._set(
                (this._x < 0) ? -this._x : this._x,
                (this._y < 0) ? -this._y : this._y,
                (this._Z < 0) ? -this._z : this._z
            );
        },

        /**
         * Clamp the vector value within the specified value range
         * @name clamp
         * @memberOf me.ObservableVector3d
         * @function
         * @param {Number} low
         * @param {Number} high
         * @return {me.ObservableVector3d} new me.ObservableVector3d
         */
        clamp : function (low, high) {
            return new me.ObservableVector3d(
                this._x.clamp(low, high),
                this._y.clamp(low, high),
                this._z.clamp(low, high),
                {onUpdate: this.onUpdate}
            );
        },

        /**
         * Clamp this vector value within the specified value range
         * @name clampSelf
         * @memberOf me.ObservableVector3d
         * @function
         * @param {Number} low
         * @param {Number} high
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        clampSelf : function (low, high) {
            return this._set(
                this._x.clamp(low, high),
                this._y.clamp(low, high),
                this._z.clamp(low, high)
            );
        },

        /**
         * Update this vector with the minimum value between this and the passed vector
         * @name minV
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        minV : function (v) {
            var _vz = v.z || 0;
            return this._set(
                (this._x < v.x) ? this._x : v.x,
                (this._y < v.y) ? this._y : v.y,
                (this._z < _vz) ? this._z : _vz
            );
        },

        /**
         * Update this vector with the maximum value between this and the passed vector
         * @name maxV
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        maxV : function (v) {
            var _vz = v.z || 0;
            return this._set(
                (this._x > v.x) ? this._x : v.x,
                (this._y > v.y) ? this._y : v.y,
                (this._z > _vz) ? this._z : _vz
            );
        },

        /**
         * Floor the vector values
         * @name floor
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} new me.ObservableVector3d
         */
        floor : function () {
            return new me.ObservableVector3d(
                Math.floor(this._x),
                Math.floor(this._y),
                Math.floor(this._z),
                {onUpdate: this.onUpdate}
            );
        },

        /**
         * Floor this vector values
         * @name floorSelf
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        floorSelf : function () {
            return this._set(Math.floor(this._x), Math.floor(this._y), Math.floor(this._z));
        },

        /**
         * Ceil the vector values
         * @name ceil
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} new me.ObservableVector3d
         */
        ceil : function () {
            return new me.ObservableVector3d(
                Math.ceil(this._x),
                Math.ceil(this._y),
                Math.ceil(this._z),
                {onUpdate: this.onUpdate}
            );
        },

        /**
         * Ceil this vector values
         * @name ceilSelf
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        ceilSelf : function () {
            return this._set(Math.ceil(this._x), Math.ceil(this._y), Math.ceil(this._z));
        },

        /**
         * Negate the vector values
         * @name negate
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} new me.ObservableVector3d
         */
        negate : function () {
            return new me.ObservableVector3d(
                -this._x,
                -this._y,
                -this._z,
                {onUpdate: this.onUpdate}
            );
        },

        /**
         * Negate this vector values
         * @name negateSelf
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        negateSelf : function () {
            return this._set(-this._x, -this._y, -this._z);
        },

        /**
         * Copy the x,y,z values of the passed vector to this one
         * @name copy
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        copy : function (v) {
            return this._set(v.x, v.y, typeof (v.z) !== "undefined" ? v.z : this._z);
        },

        /**
         * return true if the two vectors are the same
         * @name equals
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {Boolean}
         */
        equals : function (v) {
            return ((this._x === v.x) && (this._y === v.y) && (this._z === (v.z || this._z)));
        },

        /**
         * normalize this vector (scale the vector so that its magnitude is 1)
         * @name normalize
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        normalize : function () {
            var d = this.length();
            if (d > 0) {
                return this._set(this._x / d, this._y / d, this._z / d);
            }
            return this;
        },

        /**
         * change this vector to be perpendicular to what it was before.<br>
         * (Effectively rotates it 90 degrees in a clockwise direction)
         * @name perp
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        perp : function () {
            return this._set(this._y, -this._x, this._z);
        },

        /**
         * Rotate this vector (counter-clockwise) by the specified angle (in radians).
         * @name rotate
         * @memberOf me.ObservableVector3d
         * @function
         * @param {number} angle The angle to rotate (in radians)
         * @return {me.ObservableVector3d} Reference to this object for method chaining
         */
        rotate : function (angle) {
            var x = this._x;
            var y = this._y;
            return this._set(
                x * Math.cos(angle) - y * Math.sin(angle),
                x * Math.sin(angle) + y * Math.cos(angle),
                this._z
            );
        },

        /**
         * return the dot product of this vector and the passed one
         * @name dotProduct
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {Number} The dot product.
         */
        dotProduct : function (v) {
            return this._x * v.x + this._y * v.y + this._z * (v.z || 1);
        },

        /**
         * return the distance between this vector and the passed one
         * @name distance
         * @memberOf me.ObservableVector3d
         * @function
         * @param {me.Vector2d|me.Vector3d|me.ObservableVector2d|me.ObservableVector3d} v
         * @return {Number}
         */
        distance : function (v) {
            var dx = this._x - v.x, dy = this._y - v.y, dz = this._z - (v.z || 0);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        },

        /**
         * return a clone copy of this vector
         * @name clone
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.ObservableVector3d} new me.ObservableVector3d
         */
        clone : function () {
            // shall we return a cloned me.ObservableVector3d here ?
            return new me.ObservableVector3d(
                this._x,
                this._y,
                this._z,
                {onUpdate: this.onUpdate}
            );
        },

        /**
         * return a `me.Vector3d` copy of this `me.ObservableVector3d` object
         * @name toVector3d
         * @memberOf me.ObservableVector3d
         * @function
         * @return {me.Vector3d} new me.Vector3d
         */
        toVector3d : function () {
            return new me.Vector3d(this._x, this._y, this._z);
        },

        /**
         * convert the object to a string representation
         * @name toString
         * @memberOf me.ObservableVector3d
         * @function
         * @return {String}
         */
        toString : function () {
            return "x:" + this._x + ",y:" + this._y + ",z:" + this._z;
        }
    });

    /**
     * Base class for Vector3d exception handling.
     * @name Error
     * @class
     * @memberOf me.ObservableVector3d
     * @constructor
     * @param {String} msg Error message.
     */
    me.ObservableVector3d.Error = me.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.ObservableVector3d.Error";
        }
    });
})();
