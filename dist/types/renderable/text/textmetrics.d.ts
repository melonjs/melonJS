/**
 * @classdesc
 * a Text Metrics object that contains helper for text manipulation
 * @augments Bounds
 */
export default class TextMetrics extends Bounds {
    /**
     * @param {Text|BitmapText} ancestor - the parent object that contains this TextMetrics object
     */
    constructor(ancestor: Text | BitmapText);
    /**
     * a reference to the parent object that contains this TextMetrics object
     * @public
     * @type {Renderable}
     * @default undefined
     */
    public ancestor: Renderable;
    /**
     * Returns the height of a segment of inline text in CSS pixels.
     * @returns {number} the height of a segment of inline text in CSS pixels.
     */
    lineHeight(): number;
    /**
     * Returns the width of the given segment of inline text in CSS pixels.
     * @param {string} text - the text to be measured
     * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
     * @returns {number} the width of the given segment of inline text in CSS pixels.
     */
    lineWidth(text: string, context?: CanvasRenderingContext2D | undefined): number;
    /**
     * measure the given text size in CSS pixels
     * @param {string} text - the text to be measured
     * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
     * @returns {TextMetrics} this
     */
    measureText(text: string, context?: CanvasRenderingContext2D | undefined): TextMetrics;
    /**
     * wrap the given text based on the given width
     * @param {string|string[]} text - the text to be wrapped
     * @param {number} width - maximum width of one segment of text in css pixel
     * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
     * @returns {string[]} an array of string representing wrapped text
     */
    wordWrap(text: string | string[], width: number, context?: CanvasRenderingContext2D | undefined): string[];
}
import Bounds from "../../physics/bounds.js";
import Text from "./text.js";
