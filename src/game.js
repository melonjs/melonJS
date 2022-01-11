import { renderer } from "./video/video.js";
import * as event from "./system/event.js";
import timer from "./system/timer.js";
import state from "./state/state.js";
import World from "./physics/world.js";

/**
 * me.game represents your current game, it contains all the objects,
 * tilemap layers, current viewport, collision map, etc...<br>
 * me.game is also responsible for updating (each frame) the object status and draw them.
 * @namespace me.game
 * @memberof me
 */

// to know when we have to refresh the display
var isDirty = true;

// always refresh the display when updatesPerSecond are lower than fps
var isAlwaysDirty = false;

// frame counter for frameSkipping
// reset the frame counter
var frameCounter = 0;
var frameRate = 1;

// time accumulation for multiple update calls
var accumulator = 0.0;
var accumulatorMax = 0.0;
var accumulatorUpdateDelta = 0;

// min update step size
var stepSize = 1000 / 60;
var updateDelta = 0;
var lastUpdateStart = null;
var updateAverageDelta = 0;


 // initialize the game manager on system boot
event.on(event.BOOT, () => {
    // the root object of our world is an entity container
    world = new World();
    // publish init notification
    event.emit(event.GAME_INIT);
});


/**
 * a reference to the current active stage "default" camera
 * @public
 * @type {me.Camera2d}
 * @name viewport
 * @memberof me.game
 */
export let viewport;

/**
 * a reference to the game world, <br>
 * a world is a virtual environment containing all the game objects
 * @public
 * @type {me.World}
 * @name world
 * @memberof me.game
 */
export let world;

/**
 * when true, all objects will be added under the root world container.<br>
 * When false, a `me.Container` object will be created for each corresponding groups
 * @public
 * @type {boolean}
 * @default true
 * @name mergeGroup
 * @memberof me.game
 */
export let mergeGroup = true;

/**
 * Specify the property to be used when sorting entities.
 * Accepted values : "x", "y", "z"
 * @public
 * @type {string}
 * @default "z"
 * @name sortOn
 * @memberof me.game
 */
export let sortOn = "z";

/**
 * Last time the game update loop was executed. <br>
 * Use this value to implement frame prediction in drawing events,
 * for creating smooth motion while running game update logic at
 * a lower fps.
 * @public
 * @type {DOMHighResTimeStamp}
 * @name lastUpdate
 * @memberof me.game
 */
export let lastUpdate = window.performance.now();

/**
 * Fired when a level is fully loaded and all entities instantiated. <br>
 * Additionnaly the level id will also be passed to the called function.
 * @function me.game.onLevelLoaded
 * @example
 * // call myFunction () everytime a level is loaded
 * me.game.onLevelLoaded = this.myFunction.bind(this);
 */
export function onLevelLoaded() {};

/**
 * reset the game Object manager<br>
 * destroy all current objects
 * @function me.game.reset
 */
export function reset () {
    // point to the current active stage "default" camera
    var current = state.current();
    if (typeof current !== "undefined") {
        viewport = current.cameras.get("default");
    }

    // publish reset notification
    event.emit(event.GAME_RESET);

    // Refresh internal variables for framerate  limiting
    updateFrameRate();
}

/**
 * Update the renderer framerate using the system config variables.
 * @function me.game.updateFrameRate
 * @see me.timer.maxfps
 * @see me.World.fps
 */
export function updateFrameRate() {
    // reset the frame counter
    frameCounter = 0;
    frameRate = ~~(0.5 + 60 / timer.maxfps);

    // set step size based on the updatesPerSecond
    stepSize = (1000 / world.fps);
    accumulator = 0.0;
    accumulatorMax = stepSize * 10;

    // display should always re-draw when update speed doesn't match fps
    // this means the user intends to write position prediction drawing logic
    isAlwaysDirty = (timer.maxfps > world.fps);
};

/**
 * Returns the parent container of the specified Child in the game world
 * @function me.game.getParentContainer
 * @param {me.Renderable} child
 * @returns {me.Container}
 */
export function getParentContainer(child) {
    return child.ancestor;
};

/**
 * force the redraw (not update) of all objects
 * @function me.game.repaint
 */
export function repaint() {
    isDirty = true;
};


/**
 * update all objects of the game manager
 * @ignore
 * @function me.game.update
 * @param {number} time current timestamp as provided by the RAF callback
 * @param {me.Stage} stage the current stage
 */
export function update(time, stage) {
    // handle frame skipping if required
    if ((++frameCounter % frameRate) === 0) {
        // reset the frame counter
        frameCounter = 0;

        // publish notification
        event.emit(event.GAME_BEFORE_UPDATE, time);

        accumulator += timer.getDelta();
        accumulator = Math.min(accumulator, accumulatorMax);

        updateDelta = (timer.interpolation) ? timer.getDelta() : stepSize;
        accumulatorUpdateDelta = (timer.interpolation) ? updateDelta : Math.max(updateDelta, updateAverageDelta);

        while (accumulator >= accumulatorUpdateDelta || timer.interpolation) {
            lastUpdateStart = window.performance.now();

            // game update event
            if (state.isPaused() !== true) {
                event.emit(event.GAME_UPDATE, time);
            }

            // update all objects (and pass the elapsed time since last frame)
            isDirty = stage.update(updateDelta) || isDirty;

            lastUpdate = window.performance.now();
            updateAverageDelta = lastUpdate - lastUpdateStart;

            accumulator -= accumulatorUpdateDelta;
            if (timer.interpolation) {
                accumulator = 0;
                break;
            }
        }

        // publish notification
        event.emit(event.GAME_AFTER_UPDATE, lastUpdate);
    }
};

/**
 * draw the current scene/stage
 * @function me.game.draw
 * @ignore
 * @param {me.Stage} stage the current stage
 */
export function draw(stage) {

    if (renderer.isContextValid === true && (isDirty || isAlwaysDirty)) {
        // publish notification
        event.emit(event.GAME_BEFORE_DRAW, window.performance.now());

        // prepare renderer to draw a new frame
        renderer.clear();

        // render the stage
        stage.draw(renderer);

        // set back to flag
        isDirty = false;

        // flush/render our frame
        renderer.flush();

        // publish notification
        event.emit(event.GAME_AFTER_DRAW, window.performance.now());
    }
};
