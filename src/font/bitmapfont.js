/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Font / Bitmap font
 *
 * -> first char " " 32d (0x20);
 */
(function () {
    /**
     * a bitmap font object
     * Use me.loader.preload or me.loader.load to load assets
     * me.loader.preload([
     * { name: "arial", type: "binary" src: "data/font/arial.fnt" },
     * { name: "arial", type: "image" src: "data/font/arial.png" },
     * ])
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {String} font font name
     * @param {Number} [scale=1.0]
     * @param {String} [textAlign=left]
     * @param {String} [textBaseline=top]
     */
    me.BitmapFont = me.Renderable.extend(
    /** @scope me.BitmapFont.prototype */ {
        /** @ignore */
        init : function (fontName, scale, textAlign, textBaseline) {
            /** @ignore */
            // scaled font size;
            this.sSize = me.pool.pull("me.Vector2d", 0, 0);

            var fontData = me.loader.getBinary(fontName);
            this.fontImage = me.loader.getImage(fontName);

            this.bitmapFontData = new me.BitmapFontData(false);
            this.bitmapFontData.parse(fontData);
            this.fontScale = me.pool.pull("me.Vector2d", 1, 1);

            if (!fontData) {
                throw "Font data for font name: " + fontName + " not found";
            }

            if (!this.fontImage) {
                throw "Font image for font name: " + fontName + " not found";
            }

            // #char per row
            this.charCount = 0;
            // font name and type
            this._super(me.Renderable, "init", [0, 0, 0, 0, 0, 0]);

            // set a default alignement
            this.textAlign = textAlign || "left";
            this.textBaseline = textBaseline || "top";
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
         * Does not account for \n
         * @name measureTextLineWidth
         * @memberOf me.BitmapFont
         * @function
         * @param {String} text
         * @return {Number} the calculated width
         */
        measureTextWidth : function(text) {
            var characters = text.split("");
            var width = 0;
            var lastGlyph = null;
            for (var i = 0; i < characters.length; i++) {
                var ch = characters[i].charCodeAt(0);
                var glyph = this.bitmapFontData.glyphs[ch];
                width += glyph.xadvance + (lastGlyph ? lastGlyph.getKerning(ch) : 0);
            }

            return width;
        },

        /**
         * measure the given text size in pixels
         * @name measureText
         * @memberOf me.BitmapFont
         * @function
         * @param {String} text
         * @return {Object} an object with two properties: `width` and `height`, defining the output dimensions
         */
        measureText : function (text) {
            var strings = ("" + text).split("\n");

            this.height = this.width = 0;

            for (var i = 0; i < strings.length; i++) {
                this.width = Math.max((strings[i].trimRight().length * this.sSize.x), this.width);
                this.height += this.sSize.y * this.lineHeight;
            }
            return {width: this.width, height: this.height};
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
         * @param {Number} width [optional] - the width at which to wrap the text
         */
        draw : function (renderer, text, x, y, width) {
            var strings = ("" + text).split("\n");
            var lX = x;
            var height = this.sSize.y * this.lineHeight;

            // save the previous global alpha value
            var _alpha = renderer.globalAlpha();
            renderer.setGlobalAlpha(_alpha * this.getOpacity());

            // update initial position
            this.pos.set(x, y, this.pos.z); // TODO : z ?
            for (var i = 0; i < strings.length; i++) {
                x = lX;
                var string = strings[i].trimRight();
                // adjust x pos based on alignment value
                var width = this.measureTextWidth(string);
                switch (this.textAlign) {
                    case "right":
                        x -= width;
                        break;

                    case "center":
                        x -= width * 0.5;
                        break;

                    default :
                        break;
                }

                // adjust y pos based on alignment value
                switch (this.textBaseline) {
                    case "middle":
                        y -= height * 0.5;
                        break;

                    case "ideographic":
                    case "alphabetic":
                    case "bottom":
                        y -= height;
                        break;

                    default :
                        break;
                }

                // draw the string
                for (var c = 0, len = string.length; c < len; c++) {
                    // calculate the char index
                    var idx = string.charCodeAt(c) - this.firstChar;
                    if (idx >= 0) {
                        // draw it
                        renderer.drawImage(this.font,
                            this.fontSize.x * (idx % this.charCount),
                            this.fontSize.y * ~~(idx / this.charCount),
                            this.fontSize.x, this.fontSize.y,
                            ~~x, ~~y,
                            this.sSize.x, this.sSize.y);
                    }
                    x += this.sSize.x;
                }
                // increment line
                y += height;
            }
            // restore the previous global alpha value
            renderer.setGlobalAlpha(_alpha);
        }
    });

    /**
     * Class for storing relevant data from the font file.
     * @private
     * @class me.BitmapFontData
     * @memberOf me
     * @constructor
     */
    me.BitmapFontData = me.Object.extend({
        init: function (flipped) {
            this.flipped = flipped;
            this.padTop = 0;
            this.padRight = 0;
            this.padBottom = 0;
            this.padLeft = 0;
            // The distance from one line of text to the next. To set this value, use {@link #setLineHeight(float)}.
            this.lineHeight = 0;
            // The distance from the top of most uppercase characters to the baseline. Since the drawing position is the cap height of
            // the first line, the cap height can be used to get the location of the baseline.
            this.capHeight = 1;
            // The distance from the cap height to the top of the tallest glyph.
            this.ascent = 0;
            // The distance from the bottom of the glyph that extends the lowest to the baseline. This number is negative.
            this.descent = 0;
            this.down = 0;
            this.scale = new me.Vector2d();
            // The amount to add to the glyph X position when drawing a cursor between glyphs. This field is not set by the BMFont
            // file, it needs to be set manually depending on how the glyphs are rendered on the backing textures.
            this.cursorX = 0;

            /**
             * The map of glyphs, each key is a char code.
             * @name glyphs
             * @property
             * @memberOf me.BitmapFontData
             */
            this.glyphs = {};

            // The width of the space character.
            this.spaceWidth = 0;
            // The x-height, which is the distance from the top of most lowercase characters to the baseline.
            this.xHeight = 1;

            this.xChars = ["x", "e", "a", "o", "n", "s", "r", "c", "u", "m", "v", "w", "z"];
            this.capChars = ["M", "N", "B", "D", "C", "E", "F", "K", "A", "G", "H", "I", "J", "L", "O", "P", "Q", "R", "S",
                "T", "U", "V", "W", "X", "Y", "Z"];
        },

        _createSpaceGlyph: function () {
            var spaceCharCode = " ".charCodeAt(0);
            if (!this.glyphs[spaceCharCode]) {
                var glyph = me.pool.pull("me.Glyph");
                glyph.id = spaceCharCode;
                glyph.xadvance = this._getFirstGlyph().xadvance;
                this.glyphs[spaceCharCode] = glyph;

                if (glyph.width === 0) {
                    glyph.width = ~~(this.padLeft + glyph.xadvance + this.padRight);
                    glyph.offset.set(-this.padLeft, 0);
                }

                this.spaceWidth = glyph.width;
            }
        },

        _getFirstGlyph: function () {
            return this.glyphs[Object.keys(this.glyphs)[0]];
        },

        _getValueFromPair: function (string, pattern) {
            var value = string.match(pattern);
            if (!value) {
                throw "Could not find pattern " + pattern + " in string: " + string;
            }

            return value[0].split("=")[1];
        },

        /**
         * This parses the font data text and builds a map of glyphs containing the data for each character
         * @name parse
         * @memberOf me.BitmapFontData
         * @function
         * @param {String} fontData
         */
        parse: function (fontData) {
            if (!fontData) {
                throw "File containing font data was empty, cannot load the bitmap font.";
            }
            var lines = fontData.split(/\r\n|\n/);
            var padding = fontData.match(/padding\=\d+,\d+,\d+,\d+/g);
            if (!padding) {
                throw "Padding not found in first line";
            }
            var paddingValues = padding[0].split("=")[1].split(",");
            this.padTop = parseFloat(paddingValues[0]);
            this.padLeft = parseFloat(paddingValues[1]);
            this.padBottom = parseFloat(paddingValues[2]);
            this.padRight = parseFloat(paddingValues[3]);

            this.lineHeight = parseFloat(this._getValueFromPair(lines[1], /lineHeight\=\d+/g));

            var baseLine = parseFloat(this._getValueFromPair(lines[1], /base\=\d+/g));

            var padY = this.padTop + this.padBottom;

            var glyph = null;

            for (var i = 4; i < lines.length; i++) {
                var line = lines[i];
                var characterValues = line.split(/=|\s/);
                if (!line || /^kernings/.test(line)) {
                    continue;
                }
                if (/^kerning\s/.test(line)) {
                    var first = parseFloat(characterValues[2]);
                    var second = parseFloat(characterValues[4]);
                    var amount = parseFloat(characterValues[6]);

                    glyph = this.glyphs[first];
                    if (glyph !== null && typeof glyph !== "undefined") {
                        glyph.setKerning(second, amount);
                    }
                } else {
                    glyph = me.pool.pull("me.Glyph");

                    var ch = parseFloat(characterValues[2]);
                    glyph.id = ch;
                    glyph.src.set(parseFloat(characterValues[4]), parseFloat(characterValues[6]));
                    glyph.width = parseFloat(characterValues[8]);
                    glyph.height = parseFloat(characterValues[10]);
                    var y = parseFloat(characterValues[14]);
                    if (this.flipped) {
                        y = -(glyph.height + parseFloat(characterValues[14]));
                    }
                    glyph.offset.set(parseFloat(characterValues[12]), y);

                    glyph.xadvance = parseFloat(characterValues[16]);

                    if (glyph.width > 0 && glyph.height > 0) {
                        this.descent = Math.min(baseLine + glyph.yoffset, this.descent);
                    }

                    this.glyphs[ch] = glyph;
                }
            }

            this.descent += this.padBottom;

            this._createSpaceGlyph();

            var xGlyph = null;
            for (i = 0; i < this.xChars.length; i++) {
                var xChar = this.xChars[i];
                xGlyph = this.glyphs[xChar.charCodeAt(0)];
                if (xGlyph) {
                    break;
                }
            }
            if (!xGlyph) {
                xGlyph = this._getFirstGlyph();
            }

            var capGlyph = null;
            for (i = 0; i < this.capChars.length; i++) {
                var capChar = this.capChars[i];
                capGlyph = this.glyphs[capChar.charCodeAt(0)];
                if (capGlyph) {
                    break;
                }
            }
            if (!capGlyph) {
                for (var charCode in this.glyphs) {
                    if (this.glyphs.hasOwnProperty(charCode)) {
                        glyph = this.glyphs[charCode];
                        if (glyph.height === 0 || glyph.width === 0) {
                            continue;
                        }
                        this.capHeight = Math.max(this.capHeight, glyph.height);
                    }
                }
            } else {
                this.capHeight = capGlyph.height;
            }

            this.capHeight -= padY;

            this.ascent = this.baseLine - this.capHeight;
            this.down = -this.lineHeight;

            if (this.flipped) {
                this.ascent = -this.ascent;
                this.down = -this.down;
            }
        },

        setLineHeight: function (height) {
            this.lineHeight = height * this.scale.y;
            this.down = this.flipped ? this.lineHeight : -this.lineHeight;
        },
    });
})();
