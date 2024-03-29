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
    constructor(settings?: {
        cameras?: Camera2d[] | undefined;
        onResetEvent?: Function | undefined;
        onDestroyEvent?: Function | undefined;
    } | undefined);
    /**
     * The list of active cameras in this stage.
     * Cameras will be renderered based on this order defined in this list.
     * Only the "default" camera will be resized when the window or canvas is resized.
     * @public
     * @type {Map<Camera2d>}
     * @name cameras
     * @memberof Stage
     */
    public cameras: Map<Camera2d, any>;
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
    public lights: Map<Light2d, any>;
    /**
     * an ambient light that will be added to the stage rendering
     * @public
     * @type {Color}
     * @name ambientLight
     * @memberof Stage
     * @default "#000000"
     * @see Light2d
     */
    public ambientLight: Color;
    /**
     * The given constructor options
     * @public
     * @name settings
     * @memberof Stage
     * @type {object}
     */
    public settings: object;
    /**
     * Object reset function
     * @ignore
     */
    reset(...args: any[]): void;
    /**
     * update function
     * @name update
     * @memberof Stage
     * @ignore
     * @param {number} dt - time since the last update in milliseconds.
     * @returns {boolean}
     */
    update(dt: number): boolean;
    /**
     * draw the current stage
     * @name draw
     * @memberof Stage
     * @ignore
     * @param {Renderer} renderer - the renderer object to draw with
     * @param {World} world - the world object to draw
     */
    draw(renderer: Renderer, world: World): void;
    /**
     * destroy function
     * @ignore
     */
    destroy(...args: any[]): void;
    /**
     * onResetEvent function<br>
     * called by the state manager when reseting the object
     * this is typically where you will load a level, add renderables, etc...
     * @name onResetEvent
     * @memberof Stage
     * @param {...*} [args] - optional arguments passed when switching state
     * @see state#change
     */
    onResetEvent(...args: any[]): void;
    /**
     * onDestroyEvent function<br>
     * called by the state manager before switching to another state
     * @name onDestroyEvent
     * @memberof Stage
     */
    onDestroyEvent(...args: any[]): void;
}
import Camera2d from "./../camera/camera2d.js";
import Color from "./../math/color.js";
