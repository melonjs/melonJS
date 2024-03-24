import { renderer } from "./../video/video.js";
import * as event from "./../system/event.js";
import Camera2d from "./../camera/camera2d.js";
import Color from "./../math/color.js";

// a default camera instance to use across all stages
let default_camera;

// default stage settings
let default_settings = {
    cameras : []
};

/**
 * @classdesc
 * a default "Stage" object.
 * every "stage" object (title screen, credits, ingame, etc...) to be managed
 * through the state manager must inherit from this base class.
 * @see state
 */
export default class Stage {

    /**
     * @param {object} [settings] - The stage` parameters
     * @param {Camera2d[]} [settings.cameras=[new me.Camera2d()]] - a list of cameras (experimental)
     * @param {Function} [settings.onResetEvent] - called by the state manager when reseting the object
     * @param {Function} [settings.onDestroyEvent] - called by the state manager before switching to another state
     */
    constructor(settings) {
        /**
         * The list of active cameras in this stage.
         * Cameras will be renderered based on this order defined in this list.
         * Only the "default" camera will be resized when the window or canvas is resized.
         * @public
         * @type {Map<Camera2d>}
         * @name cameras
         * @memberof Stage
         */
        this.cameras = new Map();

        /**
         * The list of active lights in this stage.
         * (Note: Canvas Renderering mode will only properly support one light per stage)
         * @public
         * @type {Map<Light2d>}
         * @name lights
         * @memberof Stage
         * @see Light2d
         * @see Stage.ambientLight
         * @example
         * // create a white spot light
         * let whiteLight = new me.Light2d(0, 0, 140, "#fff", 0.7);
         * // and add the light to this current stage
         * this.lights.set("whiteLight", whiteLight);
         * // set a dark ambient light
         * this.ambientLight.parseCSS("#1117");
         * // make the light follow the mouse
         * me.input.registerPointerEvent("pointermove", me.game.viewport, (event) => {
         *    whiteLight.centerOn(event.gameX, event.gameY);
         * });
         */
        this.lights = new Map();

        /**
         * an ambient light that will be added to the stage rendering
         * @public
         * @type {Color}
         * @name ambientLight
         * @memberof Stage
         * @default "#000000"
         * @see Light2d
         */
        this.ambientLight = new Color(0, 0, 0, 0);

        /**
         * The given constructor options
         * @public
         * @name settings
         * @memberof Stage
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
                let width = renderer.width;
                let height = renderer.height;
                // new default camera instance
                default_camera = new Camera2d(0, 0, width, height);
            }
            this.cameras.set("default", default_camera);
        }

        // reset the game
        event.emit(event.STAGE_RESET, this);

        // call the onReset Function
        this.onResetEvent.apply(this, arguments);
    }

    /**
     * update function
     * @name update
     * @memberof Stage
     * @ignore
     * @param {number} dt - time since the last update in milliseconds.
     * @returns {boolean}
     */
    update(dt) {
        let isDirty = false;

        // update the camera/viewport
        // iterate through all cameras
        this.cameras.forEach((camera) => {
            if (camera.update(dt) === true) {
                isDirty = true;
            }
        });

        // update all lights
        this.lights.forEach((light) => {
            if (light.update(dt) === true) {
                isDirty = true;
            }
        });

        return isDirty;
    }

    /**
     * draw the current stage
     * @name draw
     * @memberof Stage
     * @ignore
     * @param {Renderer} renderer - the renderer object to draw with
     * @param {World} world - the world object to draw
     */
    draw(renderer, world) {

        // iterate through all cameras
        this.cameras.forEach((camera) => {
            // render the root container
            camera.draw(renderer, world);

            // render the ambient light
            if (this.ambientLight.alpha !== 0) {
                renderer.save();
                // iterate through all lights
                this.lights.forEach((light) => {
                    // cut out all lights visible areas
                    renderer.setMask(light.getVisibleArea(), true);
                });
                // fill the screen with the ambient color
                renderer.setColor(this.ambientLight);
                renderer.fillRect(0, 0, camera.width, camera.height);
                // clear all masks
                renderer.clearMask();
                renderer.restore();
            }

            // render all lights
            this.lights.forEach((light) => {
                light.preDraw(renderer, world);
                light.draw(renderer, world);
                light.postDraw(renderer, world);
            });
        });
    }

    /**
     * destroy function
     * @ignore
     */
    destroy() {
        // clear all cameras
        this.cameras.clear();
        // clear all lights
        this.lights.forEach((light) => {
            light.destroy();
        });
        this.lights.clear();
        // notify the object
        this.onDestroyEvent.apply(this, arguments);
    }

    /**
     * onResetEvent function<br>
     * called by the state manager when reseting the object
     * this is typically where you will load a level, add renderables, etc...
     * @name onResetEvent
     * @memberof Stage
     * @param {...*} [args] - optional arguments passed when switching state
     * @see state#change
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
     * @memberof Stage
     */
    onDestroyEvent() {
        // execute onDestroyEvent function if given through the constructor
        if (typeof this.settings.onDestroyEvent === "function") {
            this.settings.onDestroyEvent.apply(this, arguments);
        }
    }
}
