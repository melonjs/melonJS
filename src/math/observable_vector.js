/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
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

        init : function (x, y, settings) {
            /**
             * x value of the vector
             * @public
             * @type Number
             * @name x
             * @memberOf me.ObservableVector2d
             */
            Object.defineProperty(this, "x", {
                get : function () {
                    return this._x;
                },

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
                get : function () {
                    return this._y;
                },

                set : function (value) {
                    this.onUpdate(this._x, value, this._x, this._y);
                    this._y = value;
                }
            });

            this.onUpdate = settings.onUpdate;
            this._x = x;
            this._y = y;
        },

        /**
         * Add the passed vector to this vector
         * @name add
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.Vector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        add : function (v) {
            this.onUpdate(this._x + v.x, this._x + v.y, this._x, this._y);
            this._x += v.x;
            this._y += v.y;
            return this;
        },

        /**
         * set the Vector x and y properties to the given values<br>
         * @name set
         * @memberOf me.ObservableVector2d
         * @function
         * @param {Number} x
         * @param {Number} y
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        set : function (x, y) {
            if (x !== +x || y !== +y) {
                throw new me.Vector2d.Error(
                    "invalid x,y parameters (not a number)"
                );
            }

            this.onUpdate(x, y, this._x, this._y);
            this._x = x;
            this._y = y;

            return this;
        },

        /**
         * set the Vector x and y properties using the passed vector
         * @name setV
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.ObservableVector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        setV : function (v) {
            return this.set(v.x, v.y);
        },

        /**
         * Substract the passed vector to this vector
         * @name sub
         * @memberOf me.ObservableVector2d
         * @function
         * @param {me.Vector2d} v
         * @return {me.ObservableVector2d} Reference to this object for method chaining
         */
        sub : function (v) {
            this.onUpdate(this._x - v.x, this._x - v.y, this._x, this._y);
            this._x -= v.x;
            this._y -= v.y;
            return this;
        }
    });
})();