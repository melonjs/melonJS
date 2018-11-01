/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
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
            // call the parent constructor
            this._super(me.Renderable, "init", [0, 0, 0, 0]);

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

            // private font properties
            this.fontSize = new me.Vector2d();

            // font name and type
            this.setFont(font, size, fillStyle, textAlign);

            // the text displayed by this bitmapFont object
            this.text = "";

            // bounds will be recalcutated when true
            this.isDirty = true;
        },

        /**
         * make the font bold
         * @name bold
         * @memberOf me.Font
         * @function
         * @return this object for chaining
         */
        bold : function () {
            this.font = "bold " + this.font;
            this.isDirty = true;
            return this;
        },

        /**
         * make the font italic
         * @name italic
         * @memberOf me.Font
         * @function
         * @return this object for chaining
         */
        italic : function () {
            this.font = "italic " + this.font;
            this.isDirty = true;
            return this;
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
         * @return this object for chaining
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
            this.isDirty = true;
            return this;
        },

        /**
         * change the text to be displayed
         * @name setText
         * @memberOf me.Font
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
         * measure the given text size in pixels
         * @name measureText
         * @memberOf me.Font
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {String} text
         * @param {me.Rect} [ret] a object in which to store the text metrics
         * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
         */
        measureText : function (renderer, text, ret) {
            var context = renderer.getFontContext();
            var textMetrics = ret || this.getBounds();
            var lineHeight = this.fontSize.y * this.lineHeight;
            var strings = ("" + text).split("\n");

            // save the font context
            context.save();

            // set the context font properties
            context.font = this.font;
            context.fillStyle = this.fillStyle.toRGBA();
            context.textAlign = this.textAlign;
            context.textBaseline = this.textBaseline;

            // compute the bounding box size
            this.height = this.width = 0;
            for (var i = 0; i < strings.length; i++) {
                this.width = Math.max(context.measureText(me.utils.string.trimRight(strings[i])).width, this.width);
                this.height += lineHeight;
            }
            textMetrics.width = this.width;
            textMetrics.height = this.height;

            // compute the bounding box position
            this.pos.x = (this.textAlign === "right" ? this.pos.x - this.width : (
                this.textAlign === "center" ? this.pos.x - (this.width / 2) : this.pos.x
            ));
            this.pos.y = (this.textBaseline.search(/^(top|hanging)$/) === 0) ? this.pos.y : (
                this.textBaseline === "middle" ? this.pos.y - (this.height / 2) : this.pos.y - this.height
            );

            // restore the font context
            context.restore();

            // returns the Font bounds me.Rect by default
            return textMetrics;
        },

        /**
         * @ignore
         */
        update : function (/* dt */) {
            if (this.isDirty === true) {
                this.measureText(me.video.renderer, this.text, this.getBounds());
            }
            return this.isDirty;
        },

        /**
         * draw a text at the specified coord
         * @name draw
         * @memberOf me.Font
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer Reference to the destination renderer instance
         * @param {String} [text]
         * @param {Number} [x]
         * @param {Number} [y]
         */
        draw : function (renderer, text, x, y, stroke) {
            // "hacky patch" for backward compatibilty
            if (typeof this.ancestor === "undefined") {
                // update text cache
                this.setText(text);

                // update position if changed
                if (this.pos.x !== x || this.pos.y !== y) {
                    this.pos.x = x;
                    this.pos.y = y;
                    this.isDirty = true;
                }

                // force update bounds
                this.update(0);

                // save the previous global alpha value
                var _alpha = renderer.globalAlpha();

                renderer.setGlobalAlpha(_alpha * this.getOpacity());

                // save the previous context
                renderer.save();
            } else {
                // added directly to an object container
                text = this.text;
                x = this.pos.x;
                y = this.pos.y;
            }

            if (renderer.settings.subPixel === false) {
                // clamp to pixel grid if required
                x = ~~x;
                y = ~~y;
            }

            // draw the text
            renderer.drawFont(this._drawFont(renderer.getFontContext(), text, x, y, stroke || false));

            // for backward compatibilty
            if (typeof this.ancestor === "undefined") {
                // restore previous context
                renderer.restore();
                // restore the previous global alpha value
                renderer.setGlobalAlpha(_alpha);
            }

            // clear the dirty flag
            this.isDirty = false;
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
            this.draw.call(this, renderer, text, x, y, true);
        },

        /**
         * @ignore
         */
        _drawFont : function (context, text, x, y, stroke) {
            context.save();
            context.font = this.font;
            context.fillStyle = this.fillStyle.toRGBA();
            if (stroke) {
                context.strokeStyle = this.strokeStyle.toRGBA();
                context.lineWidth = this.lineWidth;
            }
            context.textAlign = this.textAlign;
            context.textBaseline = this.textBaseline;

            var strings = ("" + text).split("\n");
            var lineHeight = this.fontSize.y * this.lineHeight;
            for (var i = 0; i < strings.length; i++) {
                var string = me.utils.string.trimRight(strings[i]);
                // draw the string
                context[stroke ? "strokeText" : "fillText"](string, x, y);
                // add leading space
                y += lineHeight;
            }
            context.restore();
            return this.getBounds();
        }
    });
})();
