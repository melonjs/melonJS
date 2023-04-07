/**
 * @classdesc
 * An Application represents a single melonJS game.
 * An Application is responsible for updating (each frame) all the related object status and draw them.
 * @see game
 */
export default class Application {
    /**
     * @param {number} width - The width of the canvas viewport
     * @param {number} height - The height of the canvas viewport
     * @param {object} [options] - The optional video/renderer parameters.<br> (see Renderer(s) documentation for further specific options)
     * @param {string|HTMLElement} [options.parent=document.body] - the DOM parent element to hold the canvas in the HTML file
     * @param {number|Renderer} [options.renderer=AUTO] - renderer to use (CANVAS, WEBGL, AUTO), or a custom renderer class
     * @param {number|string} [options.scale=1.0] - enable scaling of the canvas ('auto' for automatic scaling)
     * @param {string} [options.scaleMethod="fit"] - screen scaling modes ('fit','fill-min','fill-max','flex','flex-width','flex-height','stretch')
     * @param {boolean} [options.preferWebGL1=false] - if true the renderer will only use WebGL 1
     * @param {boolean} [options.depthTest="sorting"] - ~Experimental~ the default method to sort object on the z axis in WebGL ("sorting", "z-buffer")
     * @param {string} [options.powerPreference="default"] - a hint to the user agent indicating what configuration of GPU is suitable for the WebGL context ("default", "high-performance", "low-power"). To be noted that Safari and Chrome (since version 80) both default to "low-power" to save battery life and improve the user experience on these dual-GPU machines.
     * @param {boolean} [options.transparent=false] - whether to allow transparent pixels in the front buffer (screen).
     * @param {boolean} [options.antiAlias=false] - whether to enable or not video scaling interpolation
     * @param {boolean} [options.consoleHeader=true] - whether to display melonJS version and basic device information in the console
     * @throws Will throw an exception if it fails to instantiate a renderer
     * @example
     * let my game = new Application(640, 480, {renderer: me.video.AUTO}) {
     *     ....
     * }
     */
    constructor(width: number, height: number, options?: {
        parent?: string | HTMLElement | undefined;
        renderer?: number | Renderer;
        scale?: string | number | undefined;
        scaleMethod?: string | undefined;
        preferWebGL1?: boolean | undefined;
        depthTest?: boolean | undefined;
        powerPreference?: string | undefined;
        transparent?: boolean | undefined;
        antiAlias?: boolean | undefined;
        consoleHeader?: boolean | undefined;
    } | undefined);
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
     * @type {Object}
     */
    settings: Object;
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
    init(width: any, height: any, options: any): void;
    /**
     * reset the game Object manager
     * destroy all current objects
     */
    reset(): void;
    set sortOn(arg: string);
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
import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
import World from "./../physics/world.js";
