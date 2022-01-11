import { renderer } from "./../video/video.js";
import * as  game from "./../game.js";
import Camera2d from "./../camera/camera2d.js";

// a default camera instance to use across all stages
var default_camera;

// default stage settings
var default_settings = {
    cameras : []
};

/**
 * @classdesc
 * a default "Stage" object.
 * every "stage" object (title screen, credits, ingame, etc...) to be managed
 * through the state manager must inherit from this base class.
 * @class Stage
 * @augments me.Object
 * @memberof me
 * @param {object} [options] The stage` parameters
 * @param {me.Camera2d[]} [options.cameras=[new me.Camera2d()]] a list of cameras (experimental)
 * @param {Function} [options.onResetEvent] called by the state manager when reseting the object
 * @param {Function} [options.onDestroyEvent] called by the state manager before switching to another state
 * @see me.state
 */
class Stage {

    /**
     * @ignore
     */
    constructor(settings) {
        /**
         * The list of active cameras in this stage.
         * Cameras will be renderered based on this order defined in this list.
         * Only the "default" camera will be resized when the window or canvas is resized.
         * @public
         * @type {Map}
         * @name cameras
         * @memberof me.Stage
         */
        this.cameras = new Map();

        /**
         * The given constructor options
         * @public
         * @name settings
         * @memberof me.Stage
         * @type {object}
         */
        this.settings = Object.assign(default_settings, settings || {});
    }

    /**
     * Object reset function
     * @ignore
     */
    reset() {

        // add all defined cameras
        this.settings.cameras.forEach((camera) => {
            this.cameras.set(camera.name, camera);
        });

        // empty or no default camera
        if (this.cameras.has("default") === false) {
            if (typeof default_camera === "undefined") {
                var width = renderer.getWidth();
                var height = renderer.getHeight();
                // new default camera instance
                default_camera = new Camera2d(0, 0, width, height);
            }
            this.cameras.set("default", default_camera);
        }

        // reset the game
        game.reset();

        // call the onReset Function
        this.onResetEvent.apply(this, arguments);
    }

    /**
     * update function
     * @name update
     * @memberof me.Stage
     * @ignore
     * @function
     * @param {number} dt time since the last update in milliseconds.
     * @returns {boolean}
     */
    update(dt) {
        // update all objects (and pass the elapsed time since last frame)
        var isDirty = game.world.update(dt);

        // update the camera/viewport
        // iterate through all cameras
        this.cameras.forEach(function(camera) {
            if (camera.update(dt)) {
                isDirty = true;
            };
        });

        return isDirty;
    }

    /**
     * draw the current stage
     * @name draw
     * @memberof me.Stage
     * @ignore
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
     */
    draw(renderer) {
        // iterate through all cameras
        this.cameras.forEach(function(camera) {
            // render the root container
            camera.draw(renderer, game.world);
        });
    }

    /**
     * destroy function
     * @ignore
     */
    destroy() {
        // clear all cameras
        this.cameras.clear();
        // notify the object
        this.onDestroyEvent.apply(this, arguments);
    }

    /**
     * onResetEvent function<br>
     * called by the state manager when reseting the object
     * this is typically where you will load a level, add renderables, etc...
     * @name onResetEvent
     * @memberof me.Stage
     * @function
     * @param {object} [...arguments] optional arguments passed when switching state
     * @see me.state#change
     */
    onResetEvent() {
        // execute onResetEvent function if given through the constructor
        if (typeof this.settings.onResetEvent === "function") {
            this.settings.onResetEvent.apply(this, arguments);
        }

    }

    /**
     * onDestroyEvent function<br>
     * called by the state manager before switching to another state
     * @name onDestroyEvent
     * @memberof me.Stage
     * @function
     */
    onDestroyEvent() {
        // execute onDestroyEvent function if given through the constructor
        if (typeof this.settings.onDestroyEvent === "function") {
            this.settings.onDestroyEvent.apply(this, arguments);
        }
    }
};

export default Stage;
