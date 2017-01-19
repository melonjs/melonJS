/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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

    var runits = ["ex", "em", "pt", "px"];
    var toPX = [12, 24, 0.75, 1];

    /**
     * a generic system font object.
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {String} font a CSS font name
     * @param {Number|String} size size, or size + suffix (px, em, pt)
     * @param {me.Color|String} fillStyle a CSS color value
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
             * @public
             * @type me.Color
             * @default black
             * @name me.Font#fillStyle
             */
            this.fillStyle = new me.Color().copy(fillStyle);

            /**
             * defines the color used to draw the font stroke.<br>
             * @public
             * @type me.Color
             * @default black
             * @name me.Font#strokeStyle
             */
            this.strokeStyle = new me.Color(0, 0, 0);

            /**
             * sets the current line width, in pixels, when drawing stroke
             * @public
             * @type Number
             * @default 1
             * @name me.Font#lineWidth
             */
            this.lineWidth = 1;

            /**
             * Set the default text alignment (or justification),<br>
             * possible values are "left", "right", and "center".<br>
             * @public
             * @type String
             * @default "left"
             * @name me.Font#textAlign
             */
            this.textAlign = textAlign || "left";

            /**
             * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
             * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
             * @public
             * @type String
             * @default "top"
             * @name me.Font#textBaseline
             */
            this.textBaseline = "top";

            /**
             * Set the line spacing height (when displaying multi-line strings). <br>
             * Current font height will be multiplied with this value to set the line height.
             * @public
             * @type Number
             * @default 1.0
             * @name me.Font#lineHeight
             */
            this.lineHeight = 1.0;

            // super constructor
            this._super(me.Renderable, "init", [0, 0, 0, 0]);

            // font name and type
            this.setFont(font, size, fillStyle, textAlign);

            if (!this.gid) {
                this.gid = me.utils.createGUID();
            }
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
         * @param {me.Color|String} [fillStyle] a CSS color value
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

            if (typeof size === "number") {
                this.fontSize.y = size;
                size += "px";
            } else /* string */ {
                // extract the units and convert if necessary
                var CSSval =  size.match(/([-+]?[\d.]*)(.*)/);
                this.fontSize.y = parseFloat(CSSval[1]);
                if (CSSval[2]) {
                    this.fontSize.y *= toPX[runits.indexOf(CSSval[2])];
                } else {
                    // no unit define, assume px
                    size += "px";
                }
            }
            this.height = this.fontSize.y;

            this.font = size + " " + font_names.join(",");
            if (typeof(fillStyle) !== "undefined") {
                this.fillStyle.copy(fillStyle);
            }
            if (textAlign) {
                this.textAlign = textAlign;
            }
        },

        /**
         * measure the given text size in pixels
         * @name measureText
         * @memberOf me.Font
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {String} text
         * @return {Object} returns an object, with two attributes: width (the width of the text) and height (the height of the text).
         */
        measureText : function (renderer, text) {
            var context = renderer.getFontContext();

            // draw the text
            context.font = this.font;
            context.fillStyle = this.fillStyle.toRGBA();
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
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {String} text
         * @param {Number} x
         * @param {Number} y
         */
        draw : function (renderer, text, x, y) {
            // save the previous global alpha value
            var _alpha = renderer.globalAlpha();

            renderer.setGlobalAlpha(_alpha * this.getOpacity());

            // draw the text
            renderer.drawFont(this._drawFont(renderer.getFontContext(), text, ~~x, ~~y, false));

            // restore the previous global alpha value
            renderer.setGlobalAlpha(_alpha);
        },

        /**
         * draw a stroke text at the specified coord, as defined <br>
         * by the `lineWidth` and `fillStroke` properties. <br>
         * Note : using drawStroke is not recommended for performance reasons
         * @name drawStroke
         * @memberOf me.Font
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {String} text
         * @param {Number} x
         * @param {Number} y
         */
        drawStroke : function (renderer, text, x, y) {
            // save the previous global alpha value
            var _alpha = renderer.globalAlpha();

            renderer.setGlobalAlpha(_alpha * this.getOpacity());

            // draw the text
            renderer.drawFont(this._drawFont(renderer.getFontContext(), text, ~~x, ~~y, true));

            // restore the previous global alpha value
            renderer.setGlobalAlpha(_alpha);
        },

        /**
         * @ignore
         */
        _drawFont : function (context, text, x, y, stroke) {
            context.font = this.font;
            context.fillStyle = this.fillStyle.toRGBA();
            if (stroke) {
                context.strokeStyle = this.strokeStyle.toRGBA();
                context.lineWidth = this.lineWidth;
            }
            context.textAlign = this.textAlign;
            context.textBaseline = this.textBaseline;

            var strings = ("" + text).split("\n"), string = "";
            var dw = 0;
            var dy = y;
            var lineHeight = this.fontSize.y * this.lineHeight;
            for (var i = 0; i < strings.length; i++) {
                string = strings[i].trimRight();
                // measure the string
                dw = Math.max(dw, context.measureText(string).width);
                // draw the string
                context[stroke ? "strokeText" : "fillText"](string, x, y);
                // add leading space
                y += lineHeight;
            }

            // compute bounds
            // TODO : memoize me !
            var dx = (this.textAlign === "right" ? x - dw : (
                this.textAlign === "center" ? x - ~~(dw / 2) : x
            ));
            dy = (this.textBaseline.search(/^(top|hanging)$/) === 0) ? dy : (
                this.textBaseline === "middle" ? dy - ~~(lineHeight / 2) : dy - lineHeight
            );

            // update the renderable bounds
            return this.getBounds().setShape(
                ~~dx,
                ~~dy,
                ~~(dw + 0.5),
                ~~(strings.length * lineHeight + 0.5)
            );
        }
    });
})();
