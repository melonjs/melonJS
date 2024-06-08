/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import Color from '../../math/color.js';
import { renderer } from '../../video/video.js';
import pool from '../../system/pooling.js';
import Renderable from '../renderable.js';
import { nextPowerOfTwo } from '../../math/math.js';
import setContextStyle from './textstyle.js';
import TextMetrics from './textmetrics.js';

/*
* ASCII Table
* http://www.asciitable.com/
* [ !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz]
*
* -> first char " " 32d (0x20);
*/

const runits = ["ex", "em", "pt", "px"];
const toPX = [12, 24, 0.75, 1];

/**
 * @classdesc
 * a generic system font object.
 * @augments Renderable
 */
class Text extends Renderable {
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
    constructor(x, y, settings) {
        // call the parent constructor
        super(x, y, settings.width || 0, settings.height || 0);

        /**
         * defines the color used to draw the font.
         * @type {Color}
         * @default black
         */
        this.fillStyle = pool.pull("Color", 0, 0, 0);

        /**
         * defines the color used to draw the font stroke.<br>
         * @type {Color}
         * @default black
         */
        this.strokeStyle = pool.pull("Color", 0, 0, 0);

        /**
         * sets the current line width, in pixels, when drawing stroke
         * @type {number}
         * @default 0
         */
        this.lineWidth = 0;

        /**
         * Set the default text alignment (or justification),<br>
         * possible values are "left", "right", and "center".<br>
         * @type {string}
         * @default "left"
         */
        this.textAlign = "left";

        /**
         * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
         * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
         * @type {string}
         * @default "top"
         */
        this.textBaseline = "top";

        /**
         * Set the line spacing height (when displaying multi-line strings). <br>
         * Current font height will be multiplied with this value to set the line height.
         * @type {number}
         * @default 1.0
         */
        this.lineHeight = 1.0;

        /**
         * the maximum length in CSS pixel for a single segment of text.
         * (use -1 to disable word wrapping)
         * @type {number}
         * @default -1
         */
        this.wordWrapWidth = -1;

        /**
         * the font size (in px)
         * @type {number}
         * @default 10
         */
        this.fontSize = 10;

        /**
         * the text to be displayed
         * @private
         */
        this._text = [];

        // initalize the object based on the given settings
        this.onResetEvent(x, y, settings);
    }

    /** @ignore */
    onResetEvent(x, y, settings) {

        if (typeof this.fillStyle === "undefined") {
            this.fillStyle = pool.pull("Color", 0, 0, 0);
        }

        if (typeof this.strokeStyle === "undefined") {
            this.strokeStyle = pool.pull("Color", 0, 0, 0);
        }

        if (typeof settings.fillStyle !== "undefined") {
            if (settings.fillStyle instanceof Color) {
                this.fillStyle.copy(settings.fillStyle);
            } else {
                // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
                this.fillStyle.parseCSS(settings.fillStyle);
            }
        }

        if (typeof settings.strokeStyle !== "undefined") {
            if (settings.strokeStyle instanceof Color) {
                this.strokeStyle.copy(settings.strokeStyle);
            } else {
                // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
                this.strokeStyle.parseCSS(settings.strokeStyle);
            }
        }

        this.lineWidth = settings.lineWidth || 0;
        this.textAlign = settings.textAlign || "left";
        this.textBaseline = settings.textBaseline || "top";
        this.lineHeight = settings.lineHeight || 1.0;
        this.wordWrapWidth = settings.wordWrapWidth || -1;
        this.fontSize = 10;

        // anchor point
        if (typeof settings.anchorPoint !== "undefined") {
            this.anchorPoint.setV(settings.anchorPoint);
        } else {
            this.anchorPoint.set(0, 0);
        }

        // if floating was specified through settings
        if (typeof settings.floating !== "undefined") {
            this.floating = !!settings.floating;
        }

        // font name and type
        this.setFont(settings.font, settings.size);

        // aditional
        if (settings.bold === true) {
            this.bold();
        }
        if (settings.italic === true) {
            this.italic();
        }

        // the canvas Texture used to render this text
        // XXX: offscreenCanvas is currently disabled for text rendering due to issue in WebGL mode
        this.canvasTexture = pool.pull("CanvasRenderTarget", 2, 2, { offscreenCanvas: false });

        // instance to text metrics functions
        this.metrics = new TextMetrics(this);

        // set the text
        this.setText(settings.text);
    }

    /**
     * make the font bold
     * @returns {Text} this object for chaining
     */
    bold() {
        this.font = "bold " + this.font;
        this.isDirty = true;
        return this;
    }

    /**
     * make the font italic
     * @returns {Text} this object for chaining
     */
    italic() {
        this.font = "italic " + this.font;
        this.isDirty = true;
        return this;
    }

    /**
     * set the font family and size
     * @param {string} font - a CSS font name
     * @param {number|string} [size=10] - size in px, or size + suffix (px, em, pt)
     * @returns {Text} this object for chaining
     * @example
     * font.setFont("Arial", 20);
     * font.setFont("Arial", "1.5em");
     */
    setFont(font, size = 10) {
        // font name and type
        let font_names = font.split(",").map((value) => {
            value = value.trim();
            return (
                !/(^".*"$)|(^'.*'$)/.test(value)
            ) ? "\"" + value + "\"" : value;
        });

        // font size
        if (typeof size === "number") {
            this.fontSize = size;
            size += "px";
        } else /* string */ {
            // extract the units and convert if necessary
            let CSSval = size.match(/([-+]?[\d.]*)(.*)/);
            this.fontSize = parseFloat(CSSval[1]);
            if (CSSval[2]) {
                this.fontSize *= toPX[runits.indexOf(CSSval[2])];
            } else {
                // no unit define, assume px
                size += "px";
            }
        }
        this.height = this.fontSize;
        this.font = size + " " + font_names.join(",");

        this.isDirty = true;

        return this;
    }

    /**
     * change the text to be displayed
     * @param {number|string|string[]} value - a string, or an array of strings
     * @returns {Text} this object for chaining
     */
    setText(value = "") {
        let bounds = this.getBounds();

        // set the next text
        if (this._text.toString() !== value.toString()) {
            if (!Array.isArray(value)) {
                this._text = ("" + value).split("\n");
            } else {
                this._text = value;
            }
        }

        // word wrap if necessary
        if (this._text.length > 0 && this.wordWrapWidth > 0) {
            this._text = this.metrics.wordWrap(this._text, this.wordWrapWidth, this.canvasTexture.context);
        }

        // calculcate the text size and update the bounds accordingly
        bounds.addBounds(this.metrics.measureText(this._text, this.canvasTexture.context), true);

        // update the offScreenCanvas texture if required
        let width = Math.ceil(this.metrics.width),
            height = Math.ceil(this.metrics.height);

        if (renderer.WebGLVersion === 1) {
            // round size to next Pow2
            width = nextPowerOfTwo(this.metrics.width);
            height = nextPowerOfTwo(this.metrics.height);
        }

        // invalidate the texture
        this.canvasTexture.invalidate(renderer);

        // resize the cache canvas if necessary
        if (this.canvasTexture.width < width || this.canvasTexture.height < height) {
            this.canvasTexture.resize(width, height);
        }

        this.canvasTexture.clear();
        this._drawFont(this.canvasTexture.context, this._text,  this.pos.x - this.metrics.x, this.pos.y - this.metrics.y);

        this.isDirty = true;

        return this;
    }

    /**
     * measure the given text size in pixels
     * @param {CanvasRenderer|WebGLRenderer} renderer - reference to the active renderer
     * @param {string} [text] - the text to be measured
     * @returns {TextMetrics} a TextMetrics object defining the dimensions of the given piece of text
     */
    measureText(renderer, text = this._text) {
        return this.metrics.measureText(text, this.canvasTexture.context);
    }


    /**
     * draw a text at the specified coord
     * @param {CanvasRenderer|WebGLRenderer} renderer - Reference to the destination renderer instance
     * @param {string} [text]
     * @param {number} [x]
     * @param {number} [y]
     */
    draw(renderer, text, x = this.pos.x, y = this.pos.y) {
        // "hacky patch" for backward compatibilty
        if (typeof this.ancestor === "undefined") {

            // update position if changed
            if (this.pos.x !== x || this.pos.y !== y) {
                this.pos.x = x;
                this.pos.y = y;
                this.isDirty = true;
            }

            // update text cache
            this.setText(text);

            // save the previous context
            renderer.save();

            // apply the defined alpha value
            renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

        }

        // adjust x,y position based on the bounding box
        x = this.metrics.x;
        y = this.metrics.y;

        // clamp to pixel grid if required
        if (renderer.settings.subPixel === false) {
            x = ~~x;
            y = ~~y;
        }

        // draw the text
        renderer.drawImage(this.canvasTexture.canvas, x, y);

        // for backward compatibilty
        if (typeof this.ancestor === "undefined") {
            // restore previous context
            renderer.restore();
        }
    }

    /**
     * draw a stroke text at the specified coord, as defined by the `lineWidth` and `fillStroke` properties.
     * @deprecated since 15.0.0
     * @param {CanvasRenderer|WebGLRenderer} renderer - Reference to the destination renderer instance
     * @param {string} text
     * @param {number} x
     * @param {number} y
     */
    drawStroke(renderer, text, x, y) {
        this.draw(renderer, text, x, y);
    }

    /**
     * @ignore
     */
    _drawFont(context, text, x, y) {
        setContextStyle(context, this);

        for (let i = 0; i < text.length; i++) {
            const string = text[i].trimEnd();
            // draw the string
            if (this.fillStyle.alpha > 0) {
                context.fillText(string, x, y);
            }
            // stroke the text
            if (this.lineWidth > 0 && this.strokeStyle.alpha > 0) {
                context.strokeText(string, x, y);
            }
            // add leading space
            y += this.metrics.lineHeight();
        }
        return this.metrics;
    }

    /**
     * Destroy function
     * @ignore
     */
    destroy() {
        if (typeof renderer.gl !== "undefined") {
            // make sure the right compositor is active
            renderer.setCompositor("quad");
            renderer.currentCompositor.deleteTexture2D(renderer.currentCompositor.getTexture2D(this.glTextureUnit));
            this.glTextureUnit = undefined;
        }
        renderer.cache.delete(this.canvasTexture.canvas);
        pool.push(this.canvasTexture);
        this.canvasTexture = undefined;
        pool.push(this.fillStyle);
        pool.push(this.strokeStyle);
        this.fillStyle = this.strokeStyle = undefined;
        this.metrics = undefined;
        this._text.length = 0;
        super.destroy();
    }
}

export { Text as default };
