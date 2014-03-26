/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Font / Bitmap font
 *
 * ASCII Table
 * http://www.asciitable.com/
 * [ !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz]
 *
 * -> first char " " 32d (0x20);
 */
(function () {
    /**
     * a generic system font object.
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {String} font a CSS font name
     * @param {Number|String} size size, or size + suffix (px, em, pt)
     * @param {String} fillStyle a CSS color value
     * @param {String} [textAlign="left"] horizontal alignment
     */
    me.Font = me.Renderable.extend(
    /** @scope me.Font.prototype */ {

        /** @ignore */
        init : function (font, size, fillStyle, textAlign) {
            // private font properties
            /** @ignore */
            this.fontSize = new me.Vector2d();

            /**
             * defines the color used to draw the font.<br>
             * Default value : "#000000"
             * @public
             * @type String
             * @name me.Font#fillStyle
             */
            this.fillStyle = fillStyle || "#000000";

            /**
             * defines the color used to draw the font stroke.<br>
             * Default value : "#000000"
             * @public
             * @type String
             * @name me.Font#strokeStyle
             */
            this.strokeStyle = "#000000";

            /**
             * sets the current line width, in pixels, when drawing stroke
             * Default value : 1
             * @public
             * @type Number
             * @name me.Font#lineWidth
             */
            this.lineWidth = 1;

            /**
             * Set the default text alignment (or justification),<br>
             * possible values are "left", "right", and "center".<br>
             * Default value : "left"
             * @public
             * @type String
             * @name me.Font#textAlign
             */
            this.textAlign = textAlign || "left";

            /**
             * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
             * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
             * Default value : "top"
             * @public
             * @type String
             * @name me.Font#textBaseline
             */
            this.textBaseline = "top";

            /**
             * Set the line spacing height (when displaying multi-line strings). <br>
             * Current font height will be multiplied with this value to set the line height.
             * Default value : 1.0
             * @public
             * @type Number
             * @name me.Font#lineHeight
             */
            this.lineHeight = 1.0;
            // font name and type
            this.setFont(font, size, fillStyle, textAlign);
            // super constructor
            this.pos = new me.Vector2d(0, 0);
            this._super(me.Renderable, "init", [this.pos, 0, this.fontSize.y]);
        },

        /**
         * make the font bold
         * @name bold
         * @memberOf me.Font
         * @function
         */
        bold : function () {
            this.font = "bold " + this.font;
        },

        /**
         * make the font italic
         * @name italic
         * @memberOf me.Font
         * @function
         */
        italic : function () {
            this.font = "italic " + this.font;
        },

        /**
         * Change the font settings
         * @name setFont
         * @memberOf me.Font
         * @function
         * @param {String} font a CSS font name
         * @param {Number|String} size size, or size + suffix (px, em, pt)
         * @param {String} fillStyle a CSS color value
         * @param {String} [textAlign="left"] horizontal alignment
         * @example
         * font.setFont("Arial", 20, "white");
         * font.setFont("Arial", "1.5em", "white");
         */
        setFont : function (font, size, fillStyle, textAlign) {
            // font name and type
            var font_names = font.split(",").map(function (value) {
                value = value.trim();
                return (
                    !/(^".*"$)|(^'.*'$)/.test(value)
                ) ? "\"" + value + "\"" : value;
            });

            this.fontSize.y = parseInt(size, 10);
            this.height = this.fontSize.y;

            if (typeof size === "number") {
                size += "px";
            }
            this.font = size + " " + font_names.join(",");
            this.fillStyle = fillStyle;
            if (textAlign) {
                this.textAlign = textAlign;
            }
        },

        /**
         * measure the given text size in pixels
         * @name measureText
         * @memberOf me.Font
         * @function
         * @param {Context} context 2D Context
         * @param {String} text
         * @return {Object} returns an object, with two attributes: width (the width of the text) and height (the height of the text).
         */
        measureText : function (context, text) {
            // draw the text
            context.font = this.font;
            context.fillStyle = this.fillStyle;
            context.textAlign = this.textAlign;
            context.textBaseline = this.textBaseline;

            this.height = this.width = 0;

            var strings = ("" + text).split("\n");
            for (var i = 0; i < strings.length; i++) {
                this.width = Math.max(context.measureText(strings[i].trimRight()).width, this.width);
                this.height += this.fontSize.y * this.lineHeight;
            }
            return {
                width : this.width,
                height : this.height
            };
        },

        /**
         * draw a text at the specified coord
         * @name draw
         * @memberOf me.Font
         * @function
         * @param {Context} context 2D Context
         * @param {String} text
         * @param {Number} x
         * @param {Number} y
         */
        draw : function (context, text, x, y) {
            // update initial position
            this.pos.set(x, y);
            // draw the text
            context.font = this.font;
            context.fillStyle = this.fillStyle;
            context.textAlign = this.textAlign;
            context.textBaseline = this.textBaseline;

            var strings = ("" + text).split("\n");
            for (var i = 0; i < strings.length; i++) {
                // draw the string
                context.fillText(strings[i].trimRight(), ~~x, ~~y);
                // add leading space
                y += this.fontSize.y * this.lineHeight;
            }
        },

        /**
         * draw a stroke text at the specified coord, as defined <br>
         * by the `lineWidth` and `fillStroke` properties. <br>
         * Note : using drawStroke is not recommended for performance reasons
         * @name drawStroke
         * @memberOf me.Font
         * @function
         * @param {Context} context 2D Context
         * @param {String} text
         * @param {Number} x
         * @param {Number} y
         */
        drawStroke : function (context, text, x, y) {
            // update initial position
            this.pos.set(x, y);

            // draw the text
            context.font = this.font;
            context.fillStyle = this.fillStyle;
            context.strokeStyle = this.strokeStyle;
            context.lineWidth = this.lineWidth;
            context.textAlign = this.textAlign;
            context.textBaseline = this.textBaseline;

            var strings = ("" + text).split("\n");
            for (var i = 0; i < strings.length; i++) {
                var _string = strings[i].trimRight();
                // draw the border
                context.strokeText(_string, ~~x, ~~y);
                // draw the string
                context.fillText(_string, ~~x, ~~y);
                // add leading space
                y += this.fontSize.y * this.lineHeight;
            }
        }
    });
})();