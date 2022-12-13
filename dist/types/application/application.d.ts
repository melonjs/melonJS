/**
 * @classdesc
 * An Application represents a single melonJS game.
 * An Application is responsible for updating (each frame) all the related object status and draw them.
 * @see game
 */
export default class Application {
    /**
     * the parent HTML element holding the main canvas of this application
     * @type {HTMLElement}
     */
    parentElement: HTMLElement;
    /**
     * the active stage "default" camera
     * @type {Camera2d}
     */
    viewport: Camera2d;
    /**
     * a reference to the game world, <br>
     * a world is a virtual environment containing all the game objects
     * @type {World}
     */
    world: World;
    /**
     * when true, all objects will be added under the root world container.<br>
     * When false, a `me.Container` object will be created for each corresponding groups
     * @type {boolean}
     * @default true
     */
    mergeGroup: boolean;
    /**
     * Specify the property to be used when sorting renderables.
     * Accepted values : "x", "y", "z"
     * @type {string}
     * @default "z"
     */
    sortOn: string;
    /**
     * Last time the game update loop was executed. <br>
     * Use this value to implement frame prediction in drawing events,
     * for creating smooth motion while running game update logic at
     * a lower fps.
     * @type {DOMHighResTimeStamp}
     */
    lastUpdate: DOMHighResTimeStamp;
    /**
     * true when this app instance has been initialized
     * @type {boolean}
     * @default false
     */
    isInitialized: boolean;
    isDirty: boolean;
    isAlwaysDirty: boolean;
    frameCounter: number;
    frameRate: number;
    accumulator: number;
    accumulatorMax: number;
    accumulatorUpdateDelta: number;
    stepSize: number;
    updateDelta: number;
    lastUpdateStart: number | null;
    updateAverageDelta: number;
    /**
     * init the game instance (create a physic world, update starting time, etc..)
     */
    init(): void;
    /**
     * reset the game Object manager
     * destroy all current objects
     */
    reset(): void;
    /**
     * Fired when a level is fully loaded and all renderable instantiated. <br>
     * Additionnaly the level id will also be passed to the called function.
     * @example
     * // call myFunction () everytime a level is loaded
     * me.game.onLevelLoaded = this.myFunction.bind(this);
     */
    onLevelLoaded(): void;
    /**
     * Update the renderer framerate using the system config variables.
     * @see timer.maxfps
     * @see World.fps
     */
    updateFrameRate(): void;
    /**
     * Returns the parent HTML Element holding the main canvas of this application
     * @returns {HTMLElement}
     */
    getParentElement(): HTMLElement;
    /**
     * force the redraw (not update) of all objects
     */
    repaint(): void;
    /**
     * update all objects related to this game active scene/stage
     * @param {number} time - current timestamp as provided by the RAF callback
     * @param {Stage} stage - the current stage
     */
    update(time: number, stage: Stage): void;
    /**
     * draw the active scene/stage associated to this game
     * @param {Stage} stage - the current stage
     */
    draw(stage: Stage): void;
}
import World from "./../physics/world.js";
