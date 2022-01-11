import Color from "./../math/color.js";
import * as stringUtil from "./../utils/string.js";
import pool from "./../system/pooling.js";
import loader from "./../loader/loader.js";
import Renderable from "./../renderable/renderable.js";

/**
 * Measures the width of a single line of text, does not account for \n
 * @ignore
 */
var measureTextWidth = function(font, text) {
    var characters = text.split("");
    var width = 0;
    var lastGlyph = null;
    for (var i = 0; i < characters.length; i++) {
        var ch = characters[i].charCodeAt(0);
        var glyph = font.fontData.glyphs[ch];
        var kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;
        width += (glyph.xadvance + kerning) * font.fontScale.x;
        lastGlyph = glyph;
    }

    return width;
};

/**
 * Measures the height of a single line of text, does not account for \n
 * @ignore
 */
var measureTextHeight = function(font) {
    return font.fontData.capHeight * font.lineHeight * font.fontScale.y;
};

/**
 * @classdesc
 * a bitmap font object
 * @class BitmapText
 * @augments me.Renderable
 * @memberof me
 * @param {number} x position of the text object
 * @param {number} y position of the text object
 * @param {object} settings the text configuration
 * @param {string|Image} settings.font a font name to identify the corresponing source image
 * @param {string} [settings.fontData=settings.font] the bitmap font data corresponding name, or the bitmap font data itself
 * @param {number} [settings.size] size a scaling ratio
 * @param {me.Color|string} [settings.fillStyle] a CSS color value used to tint the bitmapText (@see me.BitmapText.tint)
 * @param {number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
 * @param {string} [settings.textAlign="left"] horizontal text alignment
 * @param {string} [settings.textBaseline="top"] the text baseline
 * @param {number} [settings.lineHeight=1.0] line spacing height
 * @param {me.Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
 * @param {(string|string[])} [settings.text] a string, or an array of strings
 * @example
 * // Use me.loader.preload or me.loader.load to load assets
 * me.loader.preload([
 *     { name: "arial", type: "binary" src: "data/font/arial.fnt" },
 *     { name: "arial", type: "image" src: "data/font/arial.png" },
 * ])
 * // Then create an instance of your bitmap font:
 * var myFont = new me.BitmapText(x, y, {font:"arial", text:"Hello"});
 * // two possibilities for using "myFont"
 * // either call the draw function from your Renderable draw function
 * myFont.draw(renderer, "Hello!", 0, 0);
 * // or just add it to the word container
 * me.game.world.addChild(myFont);
 */

class BitmapText extends Renderable {

    /** @ignore */
    constructor(x, y, settings) {
        // call the parent constructor
        super(x, y, settings.width || 0, settings.height || 0);

        /**
         * Set the default text alignment (or justification),<br>
         * possible values are "left", "right", and "center".
         * @public
         * @type {string}
         * @default "left"
         * @name textAlign
         * @memberof me.BitmapText
         */
        this.textAlign = settings.textAlign || "left";

        /**
         * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
         * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
         * @public
         * @type {string}
         * @default "top"
         * @name textBaseline
         * @memberof me.BitmapText
         */
        this.textBaseline = settings.textBaseline || "top";

        /**
         * Set the line spacing height (when displaying multi-line strings). <br>
         * Current font height will be multiplied with this value to set the line height.
         * @public
         * @type {number}
         * @default 1.0
         * @name lineHeight
         * @memberof me.BitmapText
         */
        this.lineHeight = settings.lineHeight || 1.0;

        /**
         * the text to be displayed
         * @private
         * @type {string[]}
         * @name _text
         * @memberof me.BitmapText
         */
        this._text = [];

        /** @ignore */
        // scaled font size;
        this.fontScale = pool.pull("Vector2d", 1.0, 1.0);

        // get the corresponding image
        this.fontImage = (typeof settings.font === "object") ? settings.font : loader.getImage(settings.font);

        if (typeof settings.fontData !== "string") {
            // use settings.font to retreive the data from the loader
            this.fontData = pool.pull("BitmapTextData", loader.getBinary(settings.font));
        } else {
            this.fontData = pool.pull("BitmapTextData",
                // if starting/includes "info face" the whole data string was passed as parameter
                (settings.fontData.includes("info face")) ? settings.fontData : loader.getBinary(settings.fontData)
            );
        };

        // if floating was specified through settings
        if (typeof settings.floating !== "undefined") {
            this.floating = !!settings.floating;
        }

        // resize if necessary
        if (typeof settings.size === "number" && settings.size !== 1.0) {
            this.resize(settings.size);
        }

        // apply given fillstyle
        if (typeof settings.fillStyle !== "undefined") {
            if (settings.fillStyle instanceof Color) {
                this.fillStyle.setColor(settings.fillStyle);
            } else {
                // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
                this.fillStyle.parseCSS(settings.fillStyle);
            }
        }

        // update anchorPoint if provided
        if (typeof settings.anchorPoint !== "undefined") {
            this.anchorPoint.set(settings.anchorPoint.x, settings.anchorPoint.y);
        } else {
            this.anchorPoint.set(0, 0);
        }

        // set the text
        this.setText(settings.text);
    }

    /**
     * change the font settings
     * @name set
     * @memberof me.BitmapText.prototype
     * @function
     * @param {string} textAlign ("left", "center", "right")
     * @param {number} [scale]
     * @returns {me.BitmapText} this object for chaining
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
     * @name setText
     * @memberof me.BitmapText.prototype
     * @function
     * @param {number|string|string[]} value a string, or an array of strings
     * @returns {me.BitmapText} this object for chaining
     */
    setText(value) {
        if (typeof value === "undefined") {
            value = "";
        }

        if (this._text.toString() !== value.toString()) {
            if (!Array.isArray(value)) {
                this._text = ("" + value).split("\n");
            } else {
                this._text = value;
            }
            this.isDirty = true;
        }

        return this;
    }

    /**
     * defines the color used to tint the bitmap text
     * @public
     * @type {me.Color}
     * @name fillStyle
     * @see me.Renderable#tint
     * @memberof me.BitmapText
     */
    get fillStyle() {
        return this.tint;
    }
    set fillStyle(value) {
        this.tint = value;
    }

    /**
     * change the font display size
     * @name resize
     * @memberof me.BitmapText.prototype
     * @function
     * @param {number} scale ratio
     * @returns {me.BitmapText} this object for chaining
     */
    resize(scale) {
        this.fontScale.set(scale, scale);
        // clear the cache text to recalculate bounds
        this.isDirty = true;

        return this;
    }

    /**
     * measure the given text size in pixels
     * @name measureText
     * @memberof me.BitmapText.prototype
     * @function
     * @param {string} [text]
     * @param {me.Rect} [ret] a object in which to store the text metrics
     * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
     */
    measureText(text, ret) {
        text = text || this._text;

        var stringHeight = measureTextHeight(this);
        var textMetrics = ret || this.getBounds();
        var strings = typeof text === "string" ? ("" + (text)).split("\n") : text;

        textMetrics.height = textMetrics.width = 0;

        for (var i = 0; i < strings.length; i++) {
            textMetrics.width = Math.max(measureTextWidth(this, strings[i]), textMetrics.width);
            textMetrics.height += stringHeight;
        }
        return textMetrics;
    }

    /**
     * @ignore
     */
    update(/* dt */) {
        if (this.isDirty === true) {
            this.measureText();
        }
        return this.isDirty;
    }

    /**
     * draw the bitmap font
     * @name draw
     * @memberof me.BitmapText.prototype
     * @function
     * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
     * @param {string} [text]
     * @param {number} [x]
     * @param {number} [y]
     */
    draw(renderer, text, x, y) {
        // save the previous global alpha value
        var _alpha = renderer.globalAlpha();

        // allows to provide backward compatibility when
        // adding Bitmap Font to an object container
        if (typeof this.ancestor === "undefined") {
            // update cache
            this.setText(text);
            // force update bounds
            this.update(0);
            renderer.setGlobalAlpha(_alpha * this.getOpacity());
        } else {
            // added directly to an object container
            x = this.pos.x;
            y = this.pos.y;
        }

        var lX = x;
        var stringHeight = measureTextHeight(this);
        var maxWidth = 0;

        for (var i = 0; i < this._text.length; i++) {
            x = lX;
            var string = stringUtil.trimRight(this._text[i]);
            // adjust x pos based on alignment value
            var stringWidth = measureTextWidth(this, string);
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
            var lastGlyph = null;
            for (var c = 0, len = string.length; c < len; c++) {
                // calculate the char index
                var ch = string.charCodeAt(c);
                var glyph = this.fontData.glyphs[ch];
                var glyphWidth = glyph.width;
                var glyphHeight = glyph.height;
                var kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;

                // draw it
                if (glyphWidth !== 0 && glyphHeight !== 0) {
                    // some browser throw an exception when drawing a 0 width or height image
                    renderer.drawImage(this.fontImage,
                        glyph.x, glyph.y,
                        glyphWidth, glyphHeight,
                        x + glyph.xoffset,
                        y + glyph.yoffset * this.fontScale.y,
                        glyphWidth * this.fontScale.x, glyphHeight * this.fontScale.y
                    );
                }

                // increment position
                x += (glyph.xadvance + kerning) * this.fontScale.x;
                lastGlyph = glyph;
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
        super.destroy();
    }

};


export default BitmapText;
