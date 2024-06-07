/**
 * @classdesc
 * a bitmap font object
 * @augments Renderable
 */
export default class BitmapText extends Renderable {
    /**
     * @param {number} x - position of the text object
     * @param {number} y - position of the text object
     * @param {object} settings - the text configuration
     * @param {string|Image} settings.font - a font name to identify the corresponing source image
     * @param {string} [settings.fontData=settings.font] - the bitmap font data corresponding name, or the bitmap font data itself
     * @param {number} [settings.size] - size a scaling ratio
     * @param {Color|string} [settings.fillStyle] - a CSS color value used to tint the bitmapText (@see BitmapText.tint)
     * @param {number} [settings.lineWidth=1] - line width, in pixels, when drawing stroke
     * @param {string} [settings.textAlign="left"] - horizontal text alignment
     * @param {string} [settings.textBaseline="top"] - the text baseline
     * @param {number} [settings.lineHeight=1.0] - line spacing height
     * @param {Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] - anchor point to draw the text at
     * @param {number} [settings.wordWrapWidth] - the maximum length in CSS pixel for a single segment of text
     * @param {(string|string[])} [settings.text] - a string, or an array of strings
     * @example
     * // Use me.loader.preload or me.loader.load to load assets
     * me.loader.preload([
     *     { name: "arial", type: "binary" src: "data/font/arial.fnt" },
     *     { name: "arial", type: "image" src: "data/font/arial.png" },
     * ])
     * // Then create an instance of your bitmap font:
     * let myFont = new me.BitmapText(x, y, {font:"arial", text:"Hello"});
     * // two possibilities for using "myFont"
     * // either call the draw function from your Renderable draw function
     * myFont.draw(renderer, "Hello!", 0, 0);
     * // or just add it to the word container
     * me.game.world.addChild(myFont);
     */
    constructor(x: number, y: number, settings: {
        font: string | (new (width?: number, height?: number) => HTMLImageElement);
        fontData?: string | undefined;
        size?: number | undefined;
        fillStyle?: string | Color | undefined;
        lineWidth?: number | undefined;
        textAlign?: string | undefined;
        textBaseline?: string | undefined;
        lineHeight?: number | undefined;
        anchorPoint?: any;
        wordWrapWidth?: number | undefined;
        text?: string | string[] | undefined;
    });
    /**
     * Set the default text alignment (or justification),<br>
     * possible values are "left", "right", and "center".
     * @public
     * @type {string}
     * @default "left"
     */
    public textAlign: string;
    /**
     * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
     * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
     * @public
     * @type {string}
     * @default "top"
     */
    public textBaseline: string;
    /**
     * Set the line spacing height (when displaying multi-line strings). <br>
     * Current font height will be multiplied with this value to set the line height.
     * @public
     * @type {number}
     * @default 1.0
     */
    public lineHeight: number;
    /**
     * the maximum length in CSS pixel for a single segment of text.
     * (use -1 to disable word wrapping)
     * @public
     * @type {number}
     * @default -1
     */
    public wordWrapWidth: number;
    /**
     * the text to be displayed
     * @private
     */
    private _text;
    /**
     * scaled font size
     * @private
     */
    private fontScale;
    /**
     * font image
     * @private
     */
    private fontImage;
    /**
     * font data
     * @private
     */
    private fontData;
    public set fillStyle(value: Color);
    /**
     * defines the color used to tint the bitmap text
     * @public
     * @type {Color}
     * @see Renderable#tint
     */
    public get fillStyle(): Color;
    metrics: TextMetrics;
    /**
     * change the font settings
     * @param {string} textAlign - ("left", "center", "right")
     * @param {number} [scale]
     * @returns {BitmapText} this object for chaining
     */
    set(textAlign: string, scale?: number | undefined): BitmapText;
    /**
     * change the text to be displayed
     * @param {number|string|string[]} value - a string, or an array of strings
     * @returns {BitmapText} this object for chaining
     */
    setText(value?: number | string | string[]): BitmapText;
    /**
     * update the bounding box for this Bitmap Text.
     * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
     * @returns {Bounds} this Bitmap Text bounding box Rectangle object
     */
    updateBounds(absolute?: boolean | undefined): Bounds;
    /**
     * change the font display size
     * @param {number} scale - ratio
     * @returns {BitmapText} this object for chaining
     */
    resize(scale: number): BitmapText;
    /**
     * measure the given text size in pixels
     * @param {string} [text]
     * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
     */
    measureText(text?: string | undefined): TextMetrics;
    /**
     * draw the bitmap font
     * @param {CanvasRenderer|WebGLRenderer} renderer - Reference to the destination renderer instance
     * @param {string} [text]
     * @param {number} [x]
     * @param {number} [y]
     */
    draw(renderer: CanvasRenderer | WebGLRenderer, text?: string | undefined, x?: number | undefined, y?: number | undefined): void;
    /**
     * Destroy function
     * @ignore
     */
    destroy(): void;
}
import Renderable from "../renderable.js";
import Color from "../../math/color.js";
import TextMetrics from "./textmetrics.js";
