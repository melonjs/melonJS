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
         * @ignore
         * redefine the private _set function
         */
        _set : function (x, y) {
            this.onUpdate(x, y, this._x, this._y);
            this._x = x;
            this._y = y;
            return this;
        }
    });
})();