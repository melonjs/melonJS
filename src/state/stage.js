/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 * Stages & State machine
 *
 */

(function () {

    // a default camera instance to use across all stages
    var default_camera;

    // default stage settings
    var default_settings = {
        cameras : []
    };

    /**
     * A default "Stage" object <br>
     * every "stage" object (title screen, credits, ingame, etc...) to be managed <br>
     * through the state manager must inherit from this base class.
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {Object} [options] The stage` parameters
     * @param {Boolean} [options.cameras=[new me.Camera2d()]] a list of cameras (experimental)
     * @see me.state
     */
    me.Stage = me.Object.extend(
    /** @scope me.Stage.prototype */
    {
        /** @ignore */
        init: function (settings) {
            /**
             * The list of active cameras in this stage.
             * Cameras will be renderered based on this order defined in this list.
             * Only the "default" camera will be resized when the window or canvas is resized.
             * @public
             * @type {Map}
             * @name cameras
             * @memberOf me.Stage
             */
            this.cameras = new Map();

            /**
             * The given constructor options
             * @public
             * @name settings
             * @memberOf me.Stage
             * @enum {Object}
             */
            this.settings = Object.assign(default_settings, settings || {});
        },

        /**
         * Object reset function
         * @ignore
         */
        reset : function () {
            var self = this;

            // add all defined cameras
            this.settings.cameras.forEach(function(camera) {
                self.cameras.set(camera.name, camera);
            });

            // empty or no default camera
            if (this.cameras.has("default") === false) {
                if (typeof default_camera === "undefined") {
                    var width = me.video.renderer.getWidth();
                    var height = me.video.renderer.getHeight();
                    // new default camera instance
                    default_camera = new me.Camera2d(0, 0, width, height);
                }
                this.cameras.set("default", default_camera);
            }

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
            // clear all cameras
            this.cameras.clear();
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

})();
