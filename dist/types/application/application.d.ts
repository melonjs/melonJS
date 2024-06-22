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
    constructor(width: number, height: number, options?: ApplicationSettings | undefined);
    /**
     * the parent HTML element holding the main canvas of this application
     * @type {HTMLElement}
     */
    parentElement: HTMLElement;
    /**
     * a reference to the active Canvas or WebGL active renderer renderer
     * @type {CanvasRenderer|WebGLRenderer}
     */
    renderer: CanvasRenderer | WebGLRenderer;
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
    /**
     * the given settings used when creating this application
     * @type {ApplicationSettings}
     */
    settings: ApplicationSettings;
    /**
     * Specify whether to pause this app when losing focus
     * @type {boolean}
     * @default true
     * @example
     *  // keep the default game instance running even when loosing focus
     *  me.game.pauseOnBlur = false;
     */
    pauseOnBlur: boolean;
    /**
     * Specify whether to unpause this app when gaining back focus
     * @type {boolean}
     * @default true
     */
    resumeOnFocus: boolean;
    /**
     * Specify whether to stop this app when losing focus
     * @type {boolean}
     * @default false
     */
    stopOnBlur: boolean;
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
     * @param {number} width - The width of the canvas viewport
     * @param {number} height - The height of the canvas viewport
     * @param {ApplicationSettings} [options] - The optional parameters for the application and default renderer
     */
    init(width: number, height: number, options?: ApplicationSettings | undefined): void;
    /**
     * reset the game Object manager
     * destroy all current objects
     */
    reset(): void;
    set sortOn(value: string);
    /**
     * Specify the property to be used when sorting renderables for this application game world.
     * Accepted values : "x", "y", "z", "depth"
     * @type {string}
     * @see World.sortOn
     */
    get sortOn(): string;
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
     * @returns {HTMLElement} the parent HTML element
     */
    getParentElement(): HTMLElement;
    /**
     * force the redraw (not update) of all objects
     */
    repaint(): void;
    /**
     * update all objects related to this game active scene/stage
     * @param {number} time - current timestamp as provided by the RAF callback
     */
    update(time: number): void;
    /**
     * draw the active scene/stage associated to this game
     */
    draw(): void;
}
import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
import type WebGLRenderer from "./../video/webgl/webgl_renderer.js";
import type Camera2d from "./../camera/camera2d.js";
import World from "./../physics/world.js";
import { ApplicationSettings } from "./settings.js";
