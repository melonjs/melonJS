import { renderer } from "./../video/video.js";
import * as event from "./../system/event.js";
import timer from "./../system/timer.js";
import state from "./../state/state.js";
import World from "./../physics/world.js";

/**
 * @classdesc
 * An Application represents a single melonJS game.
 * An Application is responsible for updating (each frame) all the related object status and draw them.
 * @see game
 */
class Application {
    constructor() {
        /**
         * a reference to the current active stage "default" camera
         * @public
         * @type {Camera2d}
         */
        this.viewport = null;

        /**
         * a reference to the game world, <br>
         * a world is a virtual environment containing all the game objects
         * @public
         * @type {World}
         */
        this.world = null;

        /**
         * when true, all objects will be added under the root world container.<br>
         * When false, a `me.Container` object will be created for each corresponding groups
         * @public
         * @type {boolean}
         * @default true
         */
        this.mergeGroup = true;

        /**
         * Specify the property to be used when sorting renderables.
         * Accepted values : "x", "y", "z"
         * @public
         * @type {string}
         * @default "z"
         */
        this.sortOn = "z";

        /**
         * Last time the game update loop was executed. <br>
         * Use this value to implement frame prediction in drawing events,
         * for creating smooth motion while running game update logic at
         * a lower fps.
         * @public
         * @type {DOMHighResTimeStamp}
         * @name lastUpdate
         * @memberof Application
         */
        this.lastUpdate = 0;

        // to know when we have to refresh the display
        this.isDirty = true;

        // always refresh the display when updatesPerSecond are lower than fps
        this.isAlwaysDirty = false;

        // frame counter for frameSkipping
        // reset the frame counter
        this.frameCounter = 0;
        this.frameRate = 1;

        // time accumulation for multiple update calls
        this.accumulator = 0.0;
        this.accumulatorMax = 0.0;
        this.accumulatorUpdateDelta = 0;

        // min update step size
        this.stepSize = 1000 / 60;
        this.updateDelta = 0;
        this.lastUpdateStart = null;
        this.updateAverageDelta = 0;
    }

    /**
     * init the game instance (create a physic world, update starting time, etc..)
     */
    init() {
        // create a new physic world
        this.world = new World();
        // set the reference to this application instance
        this.world.app = this;
        this.lastUpdate = globalThis.performance.now();
        event.emit(event.GAME_INIT, this);
    }

    /**
     * reset the game Object manager
     * destroy all current objects
     */
    reset() {
        // point to the current active stage "default" camera
        var current = state.get();
        if (typeof current !== "undefined") {
            this.viewport = current.cameras.get("default");
        }

        // publish reset notification
        event.emit(event.GAME_RESET);

        // Refresh internal variables for framerate  limiting
        this.updateFrameRate();
    }

    /**
     * Fired when a level is fully loaded and all renderable instantiated. <br>
     * Additionnaly the level id will also be passed to the called function.
     * @example
     * // call myFunction () everytime a level is loaded
     * me.game.onLevelLoaded = this.myFunction.bind(this);
     */
    onLevelLoaded() {};

    /**
     * Update the renderer framerate using the system config variables.
     * @see timer.maxfps
     * @see World.fps
     */
    updateFrameRate() {
        // reset the frame counter
        this.frameCounter = 0;
        this.frameRate = ~~(0.5 + 60 / timer.maxfps);

        // set step size based on the updatesPerSecond
        this.stepSize = (1000 / this.world.fps);
        this.accumulator = 0.0;
        this.accumulatorMax = this.stepSize * 10;

        // display should always re-draw when update speed doesn't match fps
        // this means the user intends to write position prediction drawing logic
        this.isAlwaysDirty = (timer.maxfps > this.world.fps);
    }

    /**
     * Returns the parent container of the specified Child in the game world
     * @param {Renderable} child
     * @returns {Container}
     */
    getParentContainer(child) {
        return child.ancestor;
    }

    /**
     * force the redraw (not update) of all objects
     */
    repaint() {
        this.isDirty = true;
    }

    /**
     * update all objects related to this game active scene/stage
     * @param {number} time current timestamp as provided by the RAF callback
     * @param {Stage} stage the current stage
     */
    update(time, stage) {
        // handle frame skipping if required
        if ((++this.frameCounter % this.frameRate) === 0) {
            // reset the frame counter
            this.frameCounter = 0;

            // publish notification
            event.emit(event.GAME_BEFORE_UPDATE, time);

            this.accumulator += timer.getDelta();
            this.accumulator = Math.min(this.accumulator, this.accumulatorMax);

            this.updateDelta = (timer.interpolation) ? timer.getDelta() : this.stepSize;
            this.accumulatorUpdateDelta = (timer.interpolation) ? this.updateDelta : Math.max(this.updateDelta, this.updateAverageDelta);

            while (this.accumulator >= this.accumulatorUpdateDelta || timer.interpolation) {
                this.lastUpdateStart = globalThis.performance.now();

                // game update event
                if (state.isPaused() !== true) {
                    event.emit(event.GAME_UPDATE, time);
                }

                // update all objects (and pass the elapsed time since last frame)
                this.isDirty = stage.update(this.updateDelta) || this.isDirty;

                this.lastUpdate = globalThis.performance.now();
                this.updateAverageDelta = this.lastUpdate - this.lastUpdateStart;

                this.accumulator -= this.accumulatorUpdateDelta;
                if (timer.interpolation) {
                    this.accumulator = 0;
                    break;
                }
            }

            // publish notification
            event.emit(event.GAME_AFTER_UPDATE, this.lastUpdate);
        }
    }

    /**
     * draw the active scene/stage associated to this game
     * @param {Stage} stage the current stage
     */
    draw(stage) {
        if (renderer.isContextValid === true && (this.isDirty || this.isAlwaysDirty)) {
            // publish notification
            event.emit(event.GAME_BEFORE_DRAW, globalThis.performance.now());

            // prepare renderer to draw a new frame
            renderer.clear();

            // render the stage
            stage.draw(renderer);

            // set back to flag
            this.isDirty = false;

            // flush/render our frame
            renderer.flush();

            // publish notification
            event.emit(event.GAME_AFTER_DRAW, globalThis.performance.now());
        }
    }
}

export default Application;
