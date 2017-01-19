/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Font / Bitmap font
 *
 * -> first char " " 32d (0x20);
 */
(function () {

    /**
     * Measures a single line of text, does not account for \n
     * @ignore
     */
    var measureTextWidth = function(font, text) {
        var characters = text.split("");
        var width = 0;
        var lastGlyph = null;
        for (var i = 0; i < characters.length; i++) {
            var ch = characters[i].charCodeAt(0);
            var glyph = font.bitmapFontData.glyphs[ch];
            var kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;
            width += (glyph.xadvance + kerning) * font.fontScale.x;
            lastGlyph = glyph;
        }

        return width;
    };

    /**
     * a bitmap font object
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {Object} font the font object data. Should be retrieved from the loader
     * @param {Image} image the font image itself Should be retrieved from the loader
     * @param {Number} [scale=1.0]
     * @param {String} [textAlign="left"]
     * @param {String} [textBaseline="top"]
     * @example
     * // Use me.loader.preload or me.loader.load to load assets
     * me.loader.preload([
     * { name: "arial", type: "binary" src: "data/font/arial.fnt" },
     * { name: "arial", type: "image" src: "data/font/arial.png" },
     * ])
     * // Then create an instance of your bitmap font:
     * var myFont = new me.BitmapFont(me.loader.getBinary("arial"), me.loader.getImage("arial"));
     * // And draw it inside your Renderable, just like me.Font
     * myFont.draw(renderer, "Hello!", 0, 0);
     */
    me.BitmapFont = me.Renderable.extend(
    /** @scope me.BitmapFont.prototype */ {
        /** @ignore */
        init : function (data, fontImage, scale, textAlign, textBaseline) {
            /** @ignore */
            // scaled font size;
            this.sSize = me.pool.pull("me.Vector2d", 0, 0);

            this.fontImage = fontImage;

            /**
             * The instance of me.BitmapFontData
             * @type {me.BitmapFontData}
             * @name bitmapFontData
             * @memberOf me.BitmapFont
             */
            this.bitmapFontData = new me.BitmapFontData(data);
            this.fontScale = me.pool.pull("me.Vector2d", 1, 1);

            this.charCount = 0;
            this._super(me.Renderable, "init", [0, 0, 0, 0, 0, 0]);

            // set a default alignement
            this.textAlign = textAlign || "left";
            this.textBaseline = textBaseline || "top";
            this.lineHeight = 1;
            // resize if necessary
            if (scale) {
                this.resize(scale);
            }
        },

        /**
         * change the font settings
         * @name set
         * @memberOf me.BitmapFont
         * @function
         * @param {String} textAlign ("left", "center", "right")
         * @param {Number} [scale]
         */
        set : function (textAlign, scale) {
            this.textAlign = textAlign;
            // updated scaled Size
            if (scale) {
                this.resize(scale);
            }
        },

        /**
         * change the font display size
         * @name resize
         * @memberOf me.BitmapFont
         * @function
         * @param {Number} scale ratio
         */
        resize : function (scale) {
            this.fontScale.set(scale, scale);
        },


        /**
         * measure the given text size in pixels
         * @name measureText
         * @memberOf me.BitmapFont
         * @function
         * @param {String} text
         * @returns {Object} an object with two properties: `width` and `height`, defining the output dimensions
         */
        measureText : function (text) {
            var strings = ("" + text).split("\n");
            var width = 0;
            var height = 0;
            var stringHeight = this.bitmapFontData.capHeight * this.lineHeight;
            for (var i = 0; i < strings.length; i++) {
                width = Math.max(measureTextWidth(this, strings[i]), width);
                height += stringHeight;
            }

            return {width: width, height: height * this.fontScale.y};
        },

        /**
         * draw a text at the specified coord
         * @name draw
         * @memberOf me.BitmapFont
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {String} text
         * @param {Number} x
         * @param {Number} y
         */
        draw : function (renderer, text, x, y) {
            var strings = ("" + text).split("\n");
            var lX = x;
            var stringHeight = this.bitmapFontData.capHeight * this.lineHeight * this.fontScale.y;

            // save the previous global alpha value
            var _alpha = renderer.globalAlpha();
            renderer.setGlobalAlpha(_alpha * this.getOpacity());

            // update initial position
            this.pos.set(x, y, this.pos.z); // TODO : z ?
            for (var i = 0; i < strings.length; i++) {
                x = lX;
                var string = strings[i].trimRight();
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

                // x *= this.fontScale.x;
                // y *= this.fontScale.y;

                // draw the string
                var lastGlyph = null;
                for (var c = 0, len = string.length; c < len; c++) {
                    // calculate the char index
                    var ch = string.charCodeAt(c);
                    var glyph = this.bitmapFontData.glyphs[ch];
                    var kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;

                    // draw it
                    if (glyph.width !== 0 && glyph.height !== 0) {
                        // some browser throw an exception when drawing a 0 width or height image
                        renderer.drawImage(this.fontImage,
                            glyph.src.x, glyph.src.y,
                            glyph.width, glyph.height,
                            x + glyph.offset.x,
                            y + glyph.offset.y * this.fontScale.y,
                            glyph.width * this.fontScale.x, glyph.height * this.fontScale.y
                        );
                    }

                    // increment position
                    x += (glyph.xadvance + kerning) * this.fontScale.x;
                    lastGlyph = glyph;
                }
                // increment line
                y += stringHeight;
            }
            // restore the previous global alpha value
            renderer.setGlobalAlpha(_alpha);
        }
    });
})();
