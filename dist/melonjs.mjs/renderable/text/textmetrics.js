/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import Bounds from '../../physics/bounds.js';
import Text from './text.js';
import setContextStyle from './textstyle.js';

/**
 * @classdesc
 * a Text Metrics object that contains helper for text manipulation
 * @augments Bounds
 */
class TextMetrics extends Bounds {

    /**
     * @param {Text|BitmapText} ancestor - the parent object that contains this TextMetrics object
     */
    constructor(ancestor) {

        // parent constructor
        super();

        /**
         * a reference to the parent object that contains this TextMetrics object
         * @public
         * @type {Renderable}
         * @default undefined
         */
        this.ancestor = ancestor;

        this.setMinMax(0, 0, 0, 0);
    }

    /**
     * Returns the height of a segment of inline text in CSS pixels.
     * @returns {number} the height of a segment of inline text in CSS pixels.
     */
    lineHeight() {
        if (this.ancestor instanceof Text) {
            return this.ancestor.fontSize * this.ancestor.lineHeight;
        } else { // it's a BitmapText
            return this.ancestor.fontData.capHeight * this.ancestor.lineHeight * this.ancestor.fontScale.y;
        }
    }

    /**
     * Returns the width of the given segment of inline text in CSS pixels.
     * @param {string} text - the text to be measured
     * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
     * @returns {number} the width of the given segment of inline text in CSS pixels.
     */
    lineWidth(text, context) {
        if (this.ancestor instanceof Text) {
            return context.measureText(text).width;
        } else { // it's a BitmapText
            let characters = text.split("");
            const charactersLength = characters.length;
            let width = 0;
            let lastGlyph = null;
            for (let i = 0; i < charactersLength; i++) {
                let ch = characters[i].charCodeAt(0);
                let glyph = this.ancestor.fontData.glyphs[ch];
                if (typeof glyph !== "undefined") {
                    let kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;
                    width += (glyph.xadvance + kerning) * this.ancestor.fontScale.x;
                    lastGlyph = glyph;
                }
            }
            return width;
        }
    }

    /**
     * measure the given text size in CSS pixels
     * @param {string} text - the text to be measured
     * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
     * @returns {TextMetrics} this
     */
    measureText(text, context) {
        let strings;

        if (!Array.isArray(text)) {
            strings = ("" + text).split("\n");
        } else {
            strings = text;
        }

        if (typeof context !== "undefined") {
            // save the previous context
            context.save();

            // apply the style font
            setContextStyle(context, this.ancestor);
        }

        // compute the bounding box size
        this.width = this.height = 0;

        for (let i = 0; i < strings.length; i++) {
            this.width = Math.max(this.lineWidth(strings[i].trimEnd(), context), this.width);
            this.height += this.lineHeight();
        }
        this.width = Math.ceil(this.width);
        this.height = Math.ceil(this.height);

        // compute the bounding box position
        this.x = Math.floor((this.ancestor.textAlign === "right" ? this.ancestor.pos.x - this.width : (
            this.ancestor.textAlign === "center" ? this.ancestor.pos.x - (this.width / 2) : this.ancestor.pos.x
        )));
        this.y = Math.floor((this.ancestor.textBaseline.search(/^(top|hanging)$/) === 0) ? this.ancestor.pos.y : (
            this.ancestor.textBaseline === "middle" ? this.ancestor.pos.y - (this.lineHeight() / 2) : this.ancestor.pos.y - this.lineHeight()
        ));

        if (typeof context !== "undefined") {
            // restore the context
            context.restore();
        }

        return this;
    }

    /**
     * wrap the given text based on the given width
     * @param {string|string[]} text - the text to be wrapped
     * @param {number} width - maximum width of one segment of text in css pixel
     * @param {CanvasRenderingContext2D} [context] - reference to an active 2d context for canvas rendering
     * @returns {string[]} an array of string representing wrapped text
     */
    wordWrap(text, width, context) {
        let words;
        let currentLine = "";
        let output = [];

        if (Array.isArray(text)) {
            // join into a single string
            text = text.join(" ");
        }
        // word splitting to be improved as it replaces \n by space if present
        words = text.replace(/[\r\n]+/g, " ").split(" ");

        if (typeof context !== "undefined") {
            // save the previous context
            context.save();

            // apply the style font
            setContextStyle(context, this.ancestor);
        }

        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            let lineWidth = this.lineWidth(currentLine + word + " ", context);
            if (lineWidth < width) {
                // add the word to the current line
                currentLine += word + " ";
            } else {
                output.push(currentLine + "\n");
                currentLine = word + " ";
            }
        }
        // last line
        output.push(currentLine);

        if (typeof context !== "undefined") {
            // restore the context
            context.restore();
        }

        return output;
    }
}

export { TextMetrics as default };
