/**
 * @classdesc
 * a generic system font object.
 * @augments Renderable
 */
export default class Text extends Renderable {
    /**
     * @param {number} x - position of the text object
     * @param {number} y - position of the text object
     * @param {object} settings - the text configuration
     * @param {string} settings.font - a CSS family font name
     * @param {number|string} settings.size - size, or size + suffix (px, em, pt)
     * @param {Color|string} [settings.fillStyle="#000000"] - a CSS color value
     * @param {Color|string} [settings.strokeStyle="#000000"] - a CSS color value
     * @param {number} [settings.lineWidth=0] - line width, in pixels, when drawing stroke
     * @param {string} [settings.textAlign="left"] - horizontal text alignment
     * @param {string} [settings.textBaseline="top"] - the text baseline
     * @param {number} [settings.lineHeight=1.0] - line spacing height
     * @param {Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] - anchor point to draw the text at
     * @param {number} [settings.wordWrapWidth] - the maximum length in CSS pixel for a single segment of text
     * @param {(string|string[])} [settings.text=""] - a string, or an array of strings
     * @example
     * let font = new me.Text(0, 0, {font: "Arial", size: 8, fillStyle: this.color});
     */
    constructor(x: number, y: number, settings: {
        font: string;
        size: number | string;
        fillStyle?: string | Color | undefined;
        strokeStyle?: string | Color | undefined;
        lineWidth?: number | undefined;
        textAlign?: string | undefined;
        textBaseline?: string | undefined;
        lineHeight?: number | undefined;
        anchorPoint?: any;
        wordWrapWidth?: number | undefined;
        text?: string | string[] | undefined;
    });
    /**
     * defines the color used to draw the font.
     * @type {Color}
     * @default black
     */
    fillStyle: Color;
    /**
     * defines the color used to draw the font stroke.<br>
     * @type {Color}
     * @default black
     */
    strokeStyle: Color;
    /**
     * sets the current line width, in pixels, when drawing stroke
     * @type {number}
     * @default 0
     */
    lineWidth: number;
    /**
     * Set the default text alignment (or justification),<br>
     * possible values are "left", "right", and "center".<br>
     * @type {string}
     * @default "left"
     */
    textAlign: string;
    /**
     * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
     * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
     * @type {string}
     * @default "top"
     */
    textBaseline: string;
    /**
     * Set the line spacing height (when displaying multi-line strings). <br>
     * Current font height will be multiplied with this value to set the line height.
     * @type {number}
     * @default 1.0
     */
    lineHeight: number;
    /**
     * the maximum length in CSS pixel for a single segment of text.
     * (use -1 to disable word wrapping)
     * @type {number}
     * @default -1
     */
    wordWrapWidth: number;
    /**
     * the font size (in px)
     * @type {number}
     * @default 10
     */
    fontSize: number;
    /**
     * the text to be displayed
     * @private
     */
    private _text;
    /** @ignore */
    onResetEvent(x: any, y: any, settings: any): void;
    canvasTexture: object | undefined;
    metrics: TextMetrics | undefined;
    /**
     * make the font bold
     * @returns {Text} this object for chaining
     */
    bold(): Text;
    font: any;
    /**
     * make the font italic
     * @returns {Text} this object for chaining
     */
    italic(): Text;
    /**
     * set the font family and size
     * @param {string} font - a CSS font name
     * @param {number|string} [size=10] - size in px, or size + suffix (px, em, pt)
     * @returns {Text} this object for chaining
     * @example
     * font.setFont("Arial", 20);
     * font.setFont("Arial", "1.5em");
     */
    setFont(font: string, size?: string | number | undefined): Text;
    /**
     * change the text to be displayed
     * @param {number|string|string[]} value - a string, or an array of strings
     * @returns {Text} this object for chaining
     */
    setText(value?: number | string | string[]): Text;
    /**
     * measure the given text size in pixels
     * @param {CanvasRenderer|WebGLRenderer} renderer - reference to the active renderer
     * @param {string} [text] - the text to be measured
     * @returns {TextMetrics} a TextMetrics object defining the dimensions of the given piece of text
     */
    measureText(renderer: CanvasRenderer | WebGLRenderer, text?: string | undefined): TextMetrics;
    /**
     * draw a text at the specified coord
     * @param {CanvasRenderer|WebGLRenderer} renderer - Reference to the destination renderer instance
     * @param {string} [text]
     * @param {number} [x]
     * @param {number} [y]
     */
    draw(renderer: CanvasRenderer | WebGLRenderer, text?: string | undefined, x?: number | undefined, y?: number | undefined): void;
    /**
     * draw a stroke text at the specified coord, as defined by the `lineWidth` and `fillStroke` properties.
     * @deprecated since 15.0.0
     * @param {CanvasRenderer|WebGLRenderer} renderer - Reference to the destination renderer instance
     * @param {string} text
     * @param {number} x
     * @param {number} y
     */
    drawStroke(renderer: CanvasRenderer | WebGLRenderer, text: string, x: number, y: number): void;
    /**
     * @ignore
     */
    _drawFont(context: any, text: any, x: any, y: any): TextMetrics | undefined;
    /**
     * Destroy function
     * @ignore
     */
    destroy(): void;
    glTextureUnit: any;
}
import Renderable from "../renderable.js";
import Color from "../../math/color.js";
import TextMetrics from "./textmetrics.js";
