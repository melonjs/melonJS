import Color from "../../math/color.js";
import pool from "../../system/pooling.js";
import { getImage, getBinary } from "../../loader/loader.js";
import Renderable from "../renderable.js";
import TextMetrics from "./textmetrics.js";

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
    constructor(x, y, settings) {
        // call the parent constructor
        super(x, y, settings.width || 0, settings.height || 0);

        /**
         * Set the default text alignment (or justification),<br>
         * possible values are "left", "right", and "center".
         * @public
         * @type {string}
         * @default "left"
         */
        this.textAlign = settings.textAlign || "left";

        /**
         * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
         * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
         * @public
         * @type {string}
         * @default "top"
         */
        this.textBaseline = settings.textBaseline || "top";

        /**
         * Set the line spacing height (when displaying multi-line strings). <br>
         * Current font height will be multiplied with this value to set the line height.
         * @public
         * @type {number}
         * @default 1.0
         */
        this.lineHeight = settings.lineHeight || 1.0;

        /**
         * the maximum length in CSS pixel for a single segment of text.
         * (use -1 to disable word wrapping)
         * @public
         * @type {number}
         * @default -1
         */
        this.wordWrapWidth = settings.wordWrapWidth || -1;

        /**
         * the text to be displayed
         * @private
         */
        this._text = [];

        /**
         * scaled font size
         * @private
         */
        this.fontScale = pool.pull("Vector2d", 1.0, 1.0);

        /**
         * font image
         * @private
         */
        this.fontImage = (typeof settings.font === "object") ? settings.font : getImage(settings.font);

        if (typeof settings.fontData !== "string") {
            /**
             * font data
             * @private
             */
            // use settings.font to retreive the data from the loader
            this.fontData = pool.pull("BitmapTextData", getBinary(settings.font));
        } else {
            this.fontData = pool.pull("BitmapTextData",
                // if starting/includes "info face" the whole data string was passed as parameter
                (settings.fontData.includes("info face")) ? settings.fontData : getBinary(settings.fontData)
            );
        }

        // if floating was specified through settings
        if (typeof settings.floating !== "undefined") {
            this.floating = !!settings.floating;
        }

        // apply given fillstyle
        if (typeof settings.fillStyle !== "undefined") {
            this.fillStyle = settings.fillStyle;
        }

        // update anchorPoint if provided
        if (typeof settings.anchorPoint !== "undefined") {
            this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
        } else {
            this.anchorPoint.set(0, 0);
        }

        // instance to text metrics functions
        this.metrics = new TextMetrics(this);

        // resize if necessary
        if (typeof settings.size === "number" && settings.size !== 1.0) {
            this.resize(settings.size);
        }

        // set the text
        this.setText(settings.text);
    }

    /**
     * change the font settings
     * @param {string} textAlign - ("left", "center", "right")
     * @param {number} [scale]
     * @returns {BitmapText} this object for chaining
     */
    set(textAlign, scale) {
        this.textAlign = textAlign;
        // updated scaled Size
        if (scale) {
            this.resize(scale);
        }
        this.isDirty = true;

        return this;
    }

    /**
     * change the text to be displayed
     * @param {number|string|string[]} value - a string, or an array of strings
     * @returns {BitmapText} this object for chaining
     */
    setText(value = "") {
        if (this._text.toString() !== value.toString()) {
            if (!Array.isArray(value)) {
                this._text = ("" + value).split("\n");
            } else {
                this._text = value;
            }
            this.isDirty = true;
        }

        if (this._text.length > 0 && this.wordWrapWidth > 0) {
            this._text = this.metrics.wordWrap(this._text, this.wordWrapWidth);
        }

        this.updateBounds();

        return this;
    }

    /**
     * update the bounding box for this Bitmap Text.
     * @param {boolean} [absolute=true] - update the bounds size and position in (world) absolute coordinates
     * @returns {Bounds} this Bitmap Text bounding box Rectangle object
     */
    updateBounds(absolute = true) {
        let bounds = this.getBounds();

        bounds.clear();

        if (typeof this.metrics !== "undefined") {
            let ax, ay;

            bounds.addBounds(this.metrics.measureText(this._text));

            switch (this.textAlign) {
                case "right":
                    ax = this.metrics.width * 1.0;
                    break;

                case "center":
                    ax = this.metrics.width * 0.5;
                    break;

                default :
                    ax = 0; //this.metrics.width * 0.0;
                    break;
            }

            // adjust y pos based on alignment value
            switch (this.textBaseline) {
                case "middle":
                    ay = this.metrics.height * 0.5;
                    break;

                case "ideographic":
                case "alphabetic":
                case "bottom":
                    ay = this.metrics.height * 1.0;
                    break;

                default :
                    ay = 0; //this.metrics.height * 0.0;
                    break;
            }

            // translate the bounds accordingly
            bounds.translate(ax, ay);
        }

        if (absolute === true) {
            if (typeof this.ancestor !== "undefined" && typeof this.ancestor.getAbsolutePosition === "function" && this.floating !== true) {
                bounds.translate(this.ancestor.getAbsolutePosition());
            }
        }

        return bounds;
    }

    /**
     * defines the color used to tint the bitmap text
     * @public
     * @type {Color}
     * @see Renderable#tint
     */
    get fillStyle() {
        return this.tint;
    }
    set fillStyle(value) {
        if (value instanceof Color) {
            this.tint.copy(value);
        } else {
            // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
            this.tint.parseCSS(value);
        }
    }

    /**
     * change the font display size
     * @param {number} scale - ratio
     * @returns {BitmapText} this object for chaining
     */
    resize(scale) {
        this.fontScale.set(scale, scale);

        this.updateBounds();

        this.isDirty = true;

        return this;
    }

    /**
     * measure the given text size in pixels
     * @param {string} [text]
     * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
     */
    measureText(text = this._text) {
        return this.metrics.measureText(text);
    }

    /**
     * draw the bitmap font
     * @param {CanvasRenderer|WebGLRenderer} renderer - Reference to the destination renderer instance
     * @param {string} [text]
     * @param {number} [x]
     * @param {number} [y]
     */
    draw(renderer, text, x, y) {
        // save the previous global alpha value
        let _alpha = renderer.globalAlpha();

        // allows to provide backward compatibility when
        // adding Bitmap Font to an object container
        if (typeof this.ancestor === "undefined") {
            // update cache
            this.setText(text);
            renderer.setGlobalAlpha(_alpha * this.getOpacity());
        } else {
            // added directly to an object container
            x = this.pos.x;
            y = this.pos.y;
        }

        let lX = x;
        let stringHeight = this.metrics.lineHeight();
        let maxWidth = 0;

        for (let i = 0; i < this._text.length; i++) {
            x = lX;
            const string = this._text[i].trimEnd();
            // adjust x pos based on alignment value
            let stringWidth = this.metrics.lineWidth(string);
            switch (this.textAlign) {
                case "right":
                    x -= stringWidth;
                    break;

                case "center":
                    x -= stringWidth * 0.5;
                    break;

                default :
                    break;
            }

            // adjust y pos based on alignment value
            switch (this.textBaseline) {
                case "middle":
                    y -= stringHeight * 0.5;
                    break;

                case "ideographic":
                case "alphabetic":
                case "bottom":
                    y -= stringHeight;
                    break;

                default :
                    break;
            }

            // update initial position if required
            if (this.isDirty === true && typeof this.ancestor === "undefined") {
                if (i === 0) {
                    this.pos.y = y;
                }
                if (maxWidth < stringWidth) {
                    maxWidth = stringWidth;
                    this.pos.x = x;
                }
            }

            // draw the string
            let lastGlyph = null;
            for (let c = 0, len = string.length; c < len; c++) {
                // calculate the char index
                let ch = string.charCodeAt(c);
                let glyph = this.fontData.glyphs[ch];

                if (typeof glyph !== "undefined") {
                    let glyphWidth = glyph.width;
                    let glyphHeight = glyph.height;
                    let kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;
                    let scaleX = this.fontScale.x;
                    let scaleY = this.fontScale.y;

                    // draw it
                    if (glyphWidth !== 0 && glyphHeight !== 0) {
                        // some browser throw an exception when drawing a 0 width or height image
                        renderer.drawImage(this.fontImage,
                            glyph.x, glyph.y,
                            glyphWidth, glyphHeight,
                            x + glyph.xoffset * scaleX,
                            y + glyph.yoffset * scaleY,
                            glyphWidth * scaleX, glyphHeight * scaleY
                        );
                    }

                    // increment position
                    x += (glyph.xadvance + kerning) * scaleX;
                    lastGlyph = glyph;
                } else {
                    console.warn("BitmapText: no defined Glyph in for " + String.fromCharCode(ch));
                }
            }
            // increment line
            y += stringHeight;
        }

        if (typeof this.ancestor === "undefined") {
            // restore the previous global alpha value
            renderer.setGlobalAlpha(_alpha);
        }

        // clear the dirty flag here for
        // backward compatibility
        this.isDirty = false;
    }

    /**
     * Destroy function
     * @ignore
     */
    destroy() {
        pool.push(this.fontScale);
        this.fontScale = undefined;
        pool.push(this.fontData);
        this.fontData = undefined;
        this._text.length = 0;
        this.metrics = undefined;
        super.destroy();
    }

}
