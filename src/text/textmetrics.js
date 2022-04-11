import Bounds from "./../physics/bounds.js";
import * as stringUtil from "./../utils/string.js";
import Text from "./text.js";
//import BitmapText from "./bitmaptext.js";
import setContextStyle from "./textstyle.js";


/**
 * @classdesc
 * a Text Metrics object that contains helper for text manipulation
 * @augments Bounds
 */
class TextMetrics extends Bounds {

    /**
     * @param {Text|BitmapText} ancestor the parent object that contains this TextMetrics object
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
     * @param {string} text the text to be measured
     * @param {CanvasRenderingContext2D} [context] reference to an active 2d context for canvas rendering
     * @returns {number} the width of the given segment of inline text in CSS pixels.
     */
    lineWidth(text, context) {
        if (this.ancestor instanceof Text) {
            return context.measureText(stringUtil.trimRight(""+text)).width;
        } else { // it's a BitmapText
            var characters = text.split("");
            var width = 0;
            var lastGlyph = null;
            for (var i = 0; i < characters.length; i++) {
                var ch = characters[i].charCodeAt(0);
                var glyph = this.ancestor.fontData.glyphs[ch];
                var kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;
                width += (glyph.xadvance + kerning) * this.ancestor.fontScale.x;
                lastGlyph = glyph;
            }
            return width;
        }
    }

    /**
     * measure the given text size in CSS pixels
     * @param {CanvasRenderer|WebGLRenderer} [renderer] reference to the active renderer
     * @param {string} text the text to be measured
     * @returns {TextMetrics} this
     */
    measureText(renderer, text) {
        var context;
        var strings;

        if (!Array.isArray(text)) {
            strings = ("" + text).split("\n");
        } else {
            strings = text;
        }

        if (this.ancestor.offScreenCanvas === true) {
            context = this.ancestor.context;
        } else {
            context = renderer.getFontContext();
        }

        // save the previous context
        context.save();

        // apply the style font
        setContextStyle(context, this.ancestor);

        // compute the bounding box size
        this.width = this.height = 0;

        for (var i = 0; i < strings.length; i++) {
            this.width = Math.max(this.lineWidth(strings[i], context), this.width);
            this.height += this.lineHeight();
        }
        this.width = Math.ceil(this.width);
        this.height = Math.ceil(this.height);

        // compute the bounding box position
        this.x = Math.floor((this.ancestor.textAlign === "right" ? this.ancestor.pos.x - this.width : (
            this.ancestor.textAlign === "center" ? this.ancestor.pos.x - (this.width / 2) : this.ancestor.pos.x
        )));
        this.y = Math.floor((this.ancestor.textBaseline.search(/^(top|hanging)$/) === 0) ? this.ancestor.pos.y : (
            this.ancestor.textBaseline === "middle" ? this.ancestor.pos.y - (this.height / 2) : this.ancestor.pos.y - this.height
        ));

        // restore the context
        context.restore();

        return this;
    }
}
export default TextMetrics;
