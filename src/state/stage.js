/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 * Stages & State machine
 *
 */

(function () {
    /**
     * A class skeleton for "Stage" Object <br>
     * every "stage" object (title screen, credits, ingame, etc...) to be managed <br>
     * through the state manager must inherit from this base class.
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @see me.state
     */
    me.Stage = me.Object.extend(
    /** @scope me.Stage.prototype */
    {
        /** @ignore */
        init: function () {},

        /**
         * Object reset function
         * @ignore
         */
        reset : function () {
            // reset the game manager
            me.game.reset();
            // call the onReset Function
            this.onResetEvent.apply(this, arguments);
        },

        /**
         * destroy function
         * @ignore
         */
        destroy : function () {
            // notify the object
            this.onDestroyEvent.apply(this, arguments);
        },

        /**
         * onResetEvent function<br>
         * called by the state manager when reseting the object
         * this is typically where you will load a level, add renderables, etc...
         * @name onResetEvent
         * @memberOf me.Stage
         * @function
         * @param {} [arguments...] optional arguments passed when switching state
         * @see me.state#change
         */
        onResetEvent : function () {
            // to be extended
        },

        /**
         * onDestroyEvent function<br>
         * called by the state manager before switching to another state
         * @name onDestroyEvent
         * @memberOf me.Stage
         * @function
         */
        onDestroyEvent : function () {
            // to be extended
        }
    });

    /**
     * @ignore
     * for backward compatiblity
     */
    me.ScreenObject = me.Stage;

})();
