/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

me.ObservableVector2d = me.Vector2d.extend({
    /**
     * A Vector2d object that executes an onUpdate function. Use this over me.Vector2d when you need to know each time the vector is moved.
     * @class
     * @extends me.Vector2d
     * @constructor
     * @param {Number} [x=0] x value of the vector
     * @param {Number} [y=0] y value of the vector
     */
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
                this.onUpdate(this._x, value, this._y, this._y);
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
                this.onUpdate(this._x, this._x, this._y, value);
                this._y = value;
            }
        });

        this.onUpdate = settings.onUpdate;
        this._super(me.Vector2d, "init", [x, y]);
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

        this._x = x;
        this._y = y;
        this.onUpdate();

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
    }
});