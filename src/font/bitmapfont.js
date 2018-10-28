/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 * Font / Bitmap font
 *
 * -> first char " " 32d (0x20);
 */
(function () {

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
            var glyph = font.bitmapFontData.glyphs[ch];
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
        return font.bitmapFontData.capHeight * font.lineHeight * font.fontScale.y;
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
     * // two possibilities for using "myFont"
     * // either call the draw function from your Renderable draw function
     * myFont.draw(renderer, "Hello!", 0, 0);
     * // or add it to the word container
     * myFont.pos.set(0, 0);
     * myFont.setText("Hello");
     * me.game.world.addChild(myFont);
     */
    me.BitmapFont = me.Renderable.extend(
    /** @scope me.BitmapFont.prototype */ {
        /** @ignore */
        init : function (data, fontImage, scale, textAlign, textBaseline) {
            // call the parent constructor
            this._super(me.Renderable, "init", [0, 0, 0, 0]);

            /**
             * The instance of me.BitmapFontData
             * @type {me.BitmapFontData}
             * @name bitmapFontData
             * @memberOf me.BitmapFont
             */
            this.bitmapFontData = new me.BitmapFontData(data);

            /**
             * Set the default text alignment (or justification),<br>
             * possible values are "left", "right", and "center".
             * @public
             * @type String
             * @default "left"
             * @name textAlign
             * @memberOf me.BitmapFont
             */
            this.textAlign = textAlign || "left";

            /**
             * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
             * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
             * @public
             * @type String
             * @default "top"
             * @name textBaseline
             * @memberOf me.BitmapFont
             */
            this.textBaseline = textBaseline || "top";

            /**
             * Set the line spacing height (when displaying multi-line strings). <br>
             * Current font height will be multiplied with this value to set the line height.
             * @public
             * @type Number
             * @default 1.0
             * @name lineHeight
             * @memberOf me.BitmapFont
             */
            this.lineHeight = 1;

            /** @ignore */
            // scaled font size;
            this.sSize = me.pool.pull("me.Vector2d", 0, 0);
            this.fontScale = me.pool.pull("me.Vector2d", 1, 1);

            this.fontImage = fontImage;
            this.charCount = 0;

            // resize if necessary
            if (scale) {
                this.resize(scale);
            }

            // the text displayed by this bitmapFont object
            this.text = "";

            // bounds will be recalcutated when true
            this.isDirty = true;
        },

        /**
         * change the font settings
         * @name set
         * @memberOf me.BitmapFont
         * @function
         * @param {String} textAlign ("left", "center", "right")
         * @param {Number} [scale]
         * @return this object for chaining
         */
        set : function (textAlign, scale) {
            this.textAlign = textAlign;
            // updated scaled Size
            if (scale) {
                this.resize(scale);
            }
            this.isDirty = true;

            return this;
        },

        /**
         * change the text to be displayed
         * @name setText
         * @memberOf me.BitmapFont
         * @function
         * @param {(string|string[])} value a string, or an array of strings
         * @return this object for chaining
         */
        setText : function (value) {
            if (this.text !== value) {
                if (typeof value !== "undefined") {
                    if (Array.isArray(value)) {
                        value = value.join("\n");
                    } else {
                        this.text = "" + value;
                    }
                } else {
                    value = "";
                }
                this.isDirty = true;
            }
            return this;
        },

        /**
         * change the font display size
         * @name resize
         * @memberOf me.BitmapFont
         * @function
         * @param {Number} scale ratio
         * @return this object for chaining
         */
        resize : function (scale) {
            this.fontScale.set(scale, scale);
            // clear the cache text to recalculate bounds
            this.isDirty = true;

            return this;
        },


        /**
         * measure the given text size in pixels
         * @name measureText
         * @memberOf me.BitmapFont
         * @function
         * @param {String} text
         * @param {Object} [ret] a object in which to store the text metrics
         * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
         */
        measureText : function (text, ret) {
            var strings = ("" + text).split("\n");
            var stringHeight = measureTextHeight(this);
            var textMetrics  = ret || {};

            textMetrics.height = textMetrics.width = 0;

            for (var i = 0; i < strings.length; i++) {
                textMetrics.width = Math.max(measureTextWidth(this, strings[i]), textMetrics.width);
                textMetrics.height += stringHeight;
            }
            return textMetrics;
        },

        /**
         * @ignore
         */
        update : function (/* dt */) {
            if (this.isDirty === true) {
                this.measureText(this.text, this.getBounds());
            }
            return this.isDirty;
        },

        /**
         * draw the bitmap font
         * @name draw
         * @memberOf me.BitmapFont
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {String} [text]
         * @param {Number} [x]
         * @param {Number} [y]
         */
        draw : function (renderer, text, x, y) {
            // allows to provide backward compatibility when
            // adding Bitmap Font to an object container
            if (typeof this.ancestor === "undefined") {
                // update cache
                this.setText(text);
                // force update bounds
                this.update(0);
                // save the previous global alpha value
                var _alpha = renderer.globalAlpha();
                renderer.setGlobalAlpha(_alpha * this.getOpacity());
            } else {
                // added directly to an object container
                text = this.text;
                x = this.pos.x;
                y = this.pos.y;
            }

            var strings = ("" + text).split("\n");
            var lX = x;
            var stringHeight = measureTextHeight(this);
            var maxWidth = 0;

            for (var i = 0; i < strings.length; i++) {
                x = lX;
                var string = me.utils.string.trimRight(strings[i]);
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
                    var glyph = this.bitmapFontData.glyphs[ch];
                    var glyphWidth = glyph.width;
                    var glyphHeight = glyph.height;
                    var kerning = (lastGlyph && lastGlyph.kerning) ? lastGlyph.getKerning(ch) : 0;

                    // draw it
                    if (glyphWidth !== 0 && glyphHeight !== 0) {
                        // some browser throw an exception when drawing a 0 width or height image
                        renderer.drawImage(this.fontImage,
                            glyph.src.x, glyph.src.y,
                            glyphWidth, glyphHeight,
                            x + glyph.offset.x,
                            y + glyph.offset.y * this.fontScale.y,
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

            // clear the dirty flag
            this.isDirty = false;
        }
    });
})();
