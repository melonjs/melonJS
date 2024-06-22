/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 */
/**
 * @classdesc
 * a generic Image Layer Object
 * @augments Sprite
 */
export default class ImageLayer extends Sprite {
    /**
     * @param {number} x - x coordinate
     * @param {number} y - y coordinate
     * @param {object} settings - ImageLayer properties
     * @param {HTMLImageElement|HTMLCanvasElement|string} settings.image - Image reference. See {@link loader.getImage}
     * @param {string} [settings.name="me.ImageLayer"] - layer name
     * @param {number} [settings.z=0] - z-index position
     * @param {number|Vector2d} [settings.ratio=1.0] - Scrolling ratio to be applied. See {@link ImageLayer#ratio}
     * @param {"repeat"|"repeat-x"|"repeat-y"|"no-repeat"} [settings.repeat="repeat"] - define if and how an Image Layer should be repeated. See {@link ImageLayer#repeat}
     * @param {number|Vector2d} [settings.anchorPoint=<0.0,0.0>] - Define how the image is anchored to the viewport bound. By default, its upper-left corner is anchored to the viewport bounds upper left corner.
     * @example
     * // create a repetitive background pattern on the X axis using the citycloud image asset
     * me.game.world.addChild(new me.ImageLayer(0, 0, {
     *     image:"citycloud",
     *     repeat :"repeat-x"
     * }), 1);
     */
    constructor(x: number, y: number, settings: {
        image: HTMLImageElement | HTMLCanvasElement | string;
        name?: string | undefined;
        z?: number | undefined;
        ratio?: number | Vector2d | undefined;
        repeat?: "repeat" | "no-repeat" | "repeat-x" | "repeat-y" | undefined;
        anchorPoint?: number | Vector2d | undefined;
    });
    /**
     * Define the image scrolling ratio<br>
     * Scrolling speed is defined by multiplying the viewport delta position by the specified ratio.
     * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
     * To specify a value through Tiled, use one of the following format : <br>
     * - a number, to change the value for both axis <br>
     * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
     * @type {Vector2d}
     * @default <1.0,1.0>
     */
    ratio: Vector2d;
    set repeat(value: string);
    /**
     * Define if and how an Image Layer should be repeated.<br>
     * By default, an Image Layer is repeated both vertically and horizontally.<br>
     * Acceptable values : <br>
     * - 'repeat' - The background image will be repeated both vertically and horizontally <br>
     * - 'repeat-x' - The background image will be repeated only horizontally.<br>
     * - 'repeat-y' - The background image will be repeated only vertically.<br>
     * - 'no-repeat' - The background-image will not be repeated.<br>
     * @type {string}
     * @default 'repeat'
     */
    get repeat(): string;
    _repeat: string | undefined;
    repeatX: boolean | undefined;
    repeatY: boolean | undefined;
    onActivateEvent(): void;
    /**
     * createPattern function
     * @ignore
     */
    createPattern(): void;
    _pattern: any;
    /**
     * updateLayer function
     * @ignore
     */
    updateLayer(): void;
    /**
    * override the default predraw function
    * as repeat and anchor are managed directly in the draw method
    * @ignore
    */
    preDraw(renderer: any): void;
    /**
     * draw this ImageLayer (automatically called by melonJS)
     * @protected
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    protected draw(renderer: CanvasRenderer | WebGLRenderer, viewport?: any): void;
    onDeactivateEvent(): void;
}
import Sprite from "./sprite.js";
import type Vector2d from "./../math/vector2.js";
