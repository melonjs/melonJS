import { autoDetectRenderer } from "../video/utils/autodetect.js";
import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
import * as device from "./../system/device.js";
import * as event from "./../system/event.js";
import { getUriFragment } from "./../utils/utils.js";
import timer from "./../system/timer.js";
import state from "./../state/state.js";
import World from "./../physics/world.js";
import { onresize } from "./resize.js";
import { ApplicationSettings } from "./settings.js";
import { consoleHeader } from "./header.js";
import { CANVAS, WEBGL, AUTO } from "../const.js";

/**
 * additional import for TypeScript
 * @import WebGLRenderer from "./../video/webgl/webgl_renderer.js";
 * @import Camera2d from "./../camera/camera2d.js";
 */

/**
 * @classdesc
 * An Application represents a single melonJS game, and is responsible for updating (each frame) all the related object status and draw them.
 * @see game
 */
export default class Application {
    /**
     * @param {number} width - The width of the canvas viewport
     * @param {number} height - The height of the canvas viewport
     * @param {ApplicationSettings} [options] - The optional parameters for the application and default renderer
     * @throws Will throw an exception if it fails to instantiate a renderer
     */
    constructor(width, height, options) {

        /**
         * the parent HTML element holding the main canvas of this application
         * @type {HTMLElement}
         */
        this.parentElement = undefined;

        /**
         * a reference to the active Canvas or WebGL active renderer renderer
         * @type {CanvasRenderer|WebGLRenderer}
         */
        this.renderer = undefined;

        /**
         * the active stage "default" camera
         * @type {Camera2d}
         */
        this.viewport = undefined;

        /**
         * a reference to the game world, <br>
         * a world is a virtual environment containing all the game objects
         * @type {World}
         */
        this.world = undefined;

        /**
         * when true, all objects will be added under the root world container.<br>
         * When false, a `me.Container` object will be created for each corresponding groups
         * @type {boolean}
         * @default true
         */
        this.mergeGroup = true;

        /**
         * Last time the game update loop was executed. <br>
         * Use this value to implement frame prediction in drawing events,
         * for creating smooth motion while running game update logic at
         * a lower fps.
         * @type {DOMHighResTimeStamp}
         */
        this.lastUpdate = 0;

        /**
         * true when this app instance has been initialized
         * @type {boolean}
         * @default false
         */
        this.isInitialized = false;

        /**
         * the given settings used when creating this application
         * @type {ApplicationSettings}
         */
        this.settings = undefined;

        /**
         * Specify whether to pause this app when losing focus
         * @type {boolean}
         * @default true
         * @example
         *  // keep the default game instance running even when loosing focus
         *  me.game.pauseOnBlur = false;
         */
        this.pauseOnBlur = true;

        /**
         * Specify whether to unpause this app when gaining back focus
         * @type {boolean}
         * @default true
         */
        this.resumeOnFocus = true;

        /**
         * Specify whether to stop this app when losing focus
         * @type {boolean}
         * @default false
         */
        this.stopOnBlur = false;

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

        // when using the default game application, legacy is set to true
        // and init is called through the legacy video.init() call
        if (options.legacy !== true) {
            this.init(width, height, options);
        }
    }

    /**
     * init the game instance (create a physic world, update starting time, etc..)
     * @param {number} width - The width of the canvas viewport
     * @param {number} height - The height of the canvas viewport
     * @param {ApplicationSettings} [options] - The optional parameters for the application and default renderer
     */
    init(width, height, options) {

        this.settings = Object.assign(ApplicationSettings, options || {});

        // sanitize potential given parameters
        this.settings.width = width;
        this.settings.height = height;
        this.settings.transparent = !!(this.settings.transparent);
        this.settings.antiAlias = !!(this.settings.antiAlias);
        this.settings.failIfMajorPerformanceCaveat = !!(this.settings.failIfMajorPerformanceCaveat);
        this.settings.depthTest = this.settings.depthTest === "z-buffer" ? "z-buffer" : "sorting";
        this.settings.subPixel = !!(this.settings.subPixel);
        this.settings.verbose = !!(this.settings.verbose);
        if (this.settings.scaleMethod.search(/^(fill-(min|max)|fit|flex(-(width|height))?|stretch)$/) !== -1) {
            this.settings.autoScale = (this.settings.scale === "auto") || true;
        } else {
            // default scaling method
            this.settings.scaleMethod = "fit";
            this.settings.autoScale = (this.settings.scale === "auto") || false;
        }

        // override renderer settings if &webgl or &canvas is defined in the URL
        let uriFragment = getUriFragment();
        if (uriFragment.webgl === true || uriFragment.webgl1 === true || uriFragment.webgl2 === true) {
            this.settings.renderer = WEBGL;
            if (uriFragment.webgl1 === true) {
                this.settings.preferWebGL1 = true;
            }
        } else if (uriFragment.canvas === true) {
            this.settings.renderer = CANVAS;
        }

        // normalize scale
        this.settings.scale = (this.settings.autoScale) ? 1.0 : (+this.settings.scale || 1.0);

        // default scaled size value
        this.settings.zoomX = width * this.settings.scale;
        this.settings.zoomY = height * this.settings.scale;

        // identify parent element and/or the html target for resizing
        this.parentElement = device.getElement(this.settings.parent);
        if (typeof this.settings.scaleTarget !== "undefined") {
            this.settings.scaleTarget = device.getElement(this.settings.scaleTarget);
        }

        if (typeof this.settings.renderer === "number") {
            switch (this.settings.renderer) {
                case AUTO:
                case WEBGL:
                    this.renderer = autoDetectRenderer(this.settings);
                    break;
                default:
                    this.renderer = new CanvasRenderer(this.settings);
                    break;
            }
        } else {
            let CustomRenderer = this.settings.renderer;
            // a renderer class
            this.renderer = new CustomRenderer(this.settings);
        }

        // register to the channel
        event.on(event.WINDOW_ONRESIZE, () => onresize(this), this);
        event.on(event.WINDOW_ONORIENTATION_CHANGE, () => onresize(this), this);

        // add our canvas (default to document.body if settings.parent is undefined)
        this.parentElement.appendChild(this.renderer.getCanvas());

        // Mobile browser hacks
        if (device.platform.isMobile) {
            // Prevent the webview from moving on a swipe
            device.enableSwipe(false);
        }

        // trigger an initial resize();
        onresize(this);

        // add an observer to detect when the dom tree is modified
        if ("MutationObserver" in globalThis) {
            // Create an observer instance linked to the callback function
            let observer = new MutationObserver(() => onresize(this));

            // Start observing the target node for configured mutations
            observer.observe(this.parentElement, {
                attributes: false, childList: true, subtree: true
            });
        }

        if (this.settings.consoleHeader !== false) {
            consoleHeader(this);
        }

        // create a new physic world
        this.world = new World(0, 0, this.settings.width, this.settings.height);

        // set the reference to this application instance
        this.world.app = this;
        // set the reference to this application instance
        this.world.physic = this.settings.physic;

        // app starting time
        this.lastUpdate = globalThis.performance.now();
        // manually sort child if depthTest setting is "sorting"
        this.world.autoSort = !(this.renderer.type === "WEBGL" && this.settings.depthTest === "z-buffer");

        this.isInitialized = true;

        event.emit(event.GAME_INIT, this);
        event.on(event.STATE_CHANGE, this.repaint, this);
        event.on(event.STATE_RESTART, this.repaint, this);
        event.on(event.STATE_RESUME, this.repaint, this);
        event.on(event.STAGE_RESET, this.reset, this);
        event.on(event.TICK, (time) => {
            // update all game objects
            this.update(time);
            // render all game objects
            this.draw();
        }, this);


        // on blur event, pause the current
        event.on(event.BLUR, () => {
            if (this.stopOnBlur === true) {
                state.stop(true);
            }
            if (this.pauseOnBlur === true) {
                state.pause(true);
            }
        });

        // on focus event, restart or resume the current
        event.on(event.FOCUS, () => {
            if (this.stopOnBlur === true) {
                state.restart(true);
            }
            if (this.resumeOnFocus === true) {
                state.resume(true);
            }
        });
    }

    /**
     * reset the game Object manager
     * destroy all current objects
     */
    reset() {
        // point to the current active stage "default" camera
        let current = state.get();
        if (typeof current !== "undefined") {
            this.viewport = current.cameras.get("default");
        }

        // publish reset notification
        event.emit(event.GAME_RESET);

        // Refresh internal variables for framerate  limiting
        this.updateFrameRate();
    }

    /**
     * Specify the property to be used when sorting renderables for this application game world.
     * Accepted values : "x", "y", "z", "depth"
     * @type {string}
     * @see World.sortOn
     */
    get sortOn() {
        return this.world.sortOn;
    }
    set sortOn(value) {
        this.world.sortOn = value;
    }

    /**
     * Fired when a level is fully loaded and all renderable instantiated. <br>
     * Additionnaly the level id will also be passed to the called function.
     * @example
     * // call myFunction () everytime a level is loaded
     * me.game.onLevelLoaded = this.myFunction.bind(this);
     */
    onLevelLoaded() {}

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
     * Returns the parent HTML Element holding the main canvas of this application
     * @returns {HTMLElement} the parent HTML element
     */
    getParentElement() {
        return this.parentElement;
    }

    /**
     * force the redraw (not update) of all objects
     */
    repaint() {
        this.isDirty = true;
    }

    /**
     * update all objects related to this game active scene/stage
     * @param {number} time - current timestamp as provided by the RAF callback
     */
    update(time) {
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
                this.isDirty = this.world.update(this.updateDelta);
                this.isDirty = state.current().update(this.updateDelta) || this.isDirty;

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
     */
    draw() {
        if (this.renderer.isContextValid === true && (this.isDirty || this.isAlwaysDirty)) {
            // publish notification
            event.emit(event.GAME_BEFORE_DRAW, globalThis.performance.now());

            // prepare renderer to draw a new frame
            this.renderer.clear();

            // render the stage
            state.current().draw(this.renderer, this.world);

            // set back to flag
            this.isDirty = false;

            // flush/render our frame
            this.renderer.flush();

            // publish notification
            event.emit(event.GAME_AFTER_DRAW, globalThis.performance.now());
        }
    }
}

