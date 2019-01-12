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
     * apply the current font style to the given context
     * @ignore
     */
    var setContextStyle = function(context, font, stroke) {
        context.font = font.font;
        context.fillStyle = font.fillStyle.toRGBA();
        if (stroke === true) {
            context.strokeStyle = font.strokeStyle.toRGBA();
            context.lineWidth = font.lineWidth;
        }
        context.textAlign = font.textAlign;
        context.textBaseline = font.textBaseline;
    };

    /**
     * a generic system font object.
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {Number} x position of the text object
     * @param {Number} y position of the text object
     * @param {Object} settings the text configuration
     * @param {String} settings.font a CSS family font name
     * @param {Number|String} settings.size size, or size + suffix (px, em, pt)
     * @param {me.Color|String} [settings.fillStyle="#000000"] a CSS color value
     * @param {me.Color|String} [settings.strokeStyle="#000000"] a CSS color value
     * @param {Number} [settings.lineWidth=1] line width, in pixels, when drawing stroke
     * @param {String} [settings.textAlign="left"] horizontal text alignment
     * @param {String} [settings.textBaseline="top"] the text baseline
     * @param {Number} [settings.lineHeight=1.0] line spacing height
     * @param {me.Vector2d} [settings.anchorPoint={x:0.0, y:0.0}] anchor point to draw the text at
     * @param {(String|String[])} [settings.text] a string, or an array of strings
     */
    me.Text = me.Renderable.extend(
    /** @scope me.Font.prototype */ {

        /** @ignore */
        init : function (x, y, settings) {
            // call the parent constructor
            this._super(me.Renderable, "init", [x, y, settings.width || 0, settings.height || 0]);

            /**
             * defines the color used to draw the font.<br>
             * @public
             * @type me.Color
             * @default black
             * @name me.Font#fillStyle
             */
            if (typeof settings.fillStyle !== "undefined") {
                if (settings.fillStyle instanceof me.Color) {
                    this.fillStyle = settings.fillStyle;
                } else {
                    // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
                    this.fillStyle = me.pool.pull("me.Color").parseCSS(settings.fillStyle);
                }
            } else {
                this.fillStyle = me.pool.pull("me.Color", 0, 0, 0);
            }

            /**
             * defines the color used to draw the font stroke.<br>
             * @public
             * @type me.Color
             * @default black
             * @name me.Font#strokeStyle
             */
             if (typeof settings.strokeStyle !== "undefined") {
                 if (settings.strokeStyle instanceof me.Color) {
                     this.strokeStyle = settings.strokeStyle;
                 } else {
                     // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
                     this.strokeStyle = me.pool.pull("me.Color").parseCSS(settings.strokeStyle);
                 }
             } else {
                 this.strokeStyle = me.pool.pull("me.Color", 0, 0, 0);
             }

            /**
             * sets the current line width, in pixels, when drawing stroke
             * @public
             * @type Number
             * @default 1
             * @name me.Font#lineWidth
             */
            this.lineWidth = settings.lineWidth || 1;

            /**
             * Set the default text alignment (or justification),<br>
             * possible values are "left", "right", and "center".<br>
             * @public
             * @type String
             * @default "left"
             * @name me.Font#textAlign
             */
            this.textAlign = settings.textAlign || "left";

            /**
             * Set the text baseline (e.g. the Y-coordinate for the draw operation), <br>
             * possible values are "top", "hanging, "middle, "alphabetic, "ideographic, "bottom"<br>
             * @public
             * @type String
             * @default "top"
             * @name me.Font#textBaseline
             */
            this.textBaseline = settings.textBaseline || "top";

            /**
             * Set the line spacing height (when displaying multi-line strings). <br>
             * Current font height will be multiplied with this value to set the line height.
             * @public
             * @type Number
             * @default 1.0
             * @name me.Font#lineHeight
             */
            this.lineHeight = settings.lineHeight || 1.0;

            // private font properties
            this._fontSize = 0;

            // the text displayed by this bitmapFont object
            this._text = "";

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
            if (settings.italic  === true) {
                this.italic();
            }

            // set the text
            this.setText(settings.text);
        },

        /**
         * make the font bold
         * @name bold
         * @memberOf me.Text
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
         * @memberOf me.Text
         * @function
         * @return this object for chaining
         */
        italic : function () {
            this.font = "italic " + this.font;
            this.isDirty = true;
            return this;
        },

        /**
         * set the font family and size
         * @name setFont
         * @memberOf me.Text
         * @function
         * @param {String} font a CSS font name
         * @param {Number|String} size size, or size + suffix (px, em, pt)
         * @return this object for chaining
         * @example
         * font.setFont("Arial", 20);
         * font.setFont("Arial", "1.5em");
         */
        setFont : function (font, size) {
            // font name and type
            var font_names = font.split(",").map(function (value) {
                value = value.trim();
                return (
                    !/(^".*"$)|(^'.*'$)/.test(value)
                ) ? "\"" + value + "\"" : value;
            });

            // font size
            if (typeof size === "number") {
                this._fontSize = size;
                size += "px";
            } else /* string */ {
                // extract the units and convert if necessary
                var CSSval =  size.match(/([-+]?[\d.]*)(.*)/);
                this._fontSize = parseFloat(CSSval[1]);
                if (CSSval[2]) {
                    this._fontSize *= toPX[runits.indexOf(CSSval[2])];
                } else {
                    // no unit define, assume px
                    size += "px";
                }
            }
            this.height = this._fontSize;
            this.font = size + " " + font_names.join(",");

            this.isDirty = true;

            return this;
        },

        /**
         * change the text to be displayed
         * @name setText
         * @memberOf me.Text
         * @function
         * @param {(Number|String|String[])}} value a string, or an array of strings
         * @return this object for chaining
         */
        setText : function (value) {
            value = "" + value;
            if (this._text !== value) {
                if (Array.isArray(value)) {
                    this._text = value.join("\n");
                } else {
                    this._text = value;
                }
                this.isDirty = true;
            }
            return this;
        },

        /**
         * measure the given text size in pixels
         * @name measureText
         * @memberOf me.Text
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} [renderer] reference a renderer instance
         * @param {String} [text] the text to be measured
         * @param {me.Rect} [ret] a object in which to store the text metrics
         * @returns {TextMetrics} a TextMetrics object with two properties: `width` and `height`, defining the output dimensions
         */
        measureText : function (renderer, text, ret) {
            text = text || this._text;

            var context;

            if (typeof renderer === "undefined") {
                context = me.video.renderer.getFontContext()
            } else if (renderer instanceof me.Renderer) {
                context = renderer.getFontContext();
            } else {
                // else it's a 2d rendering context object
                context = renderer;
            }

            var textMetrics = ret || this.getBounds();
            var lineHeight = this._fontSize * this.lineHeight;
            var strings = ("" + (text)).split("\n");

            // save the previous context
            context.save();

            // apply the style font
            setContextStyle(context, this);

            // compute the bounding box size
            this.height = this.width = 0;
            for (var i = 0; i < strings.length; i++) {
                this.width = Math.max(context.measureText(me.utils.string.trimRight(strings[i])).width, this.width);
                this.height += lineHeight;
            }
            textMetrics.width = Math.ceil(this.width);
            textMetrics.height = Math.ceil(this.height);

            // compute the bounding box position
            textMetrics.pos.x = Math.floor((this.textAlign === "right" ? this.pos.x - this.width : (
                this.textAlign === "center" ? this.pos.x - (this.width / 2) : this.pos.x
            )));
            textMetrics.pos.y = Math.floor((this.textBaseline.search(/^(top|hanging)$/) === 0) ? this.pos.y : (
                this.textBaseline === "middle" ? this.pos.y - (textMetrics.height / 2) : this.pos.y - textMetrics.height
            ));

            // restore the context
            context.restore();

            // returns the Font bounds me.Rect by default
            return textMetrics;
        },

        /**
         * @ignore
         */
        update : function (/* dt */) {
            if (this.isDirty === true) {
                this.measureText();
            }
            return this.isDirty;
        },

        /**
         * draw a text at the specified coord
         * @name draw
         * @memberOf me.Text
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

                // save the previous context
                renderer.save();

                // apply the defined alpha value
                renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

            } else {
                // added directly to an object container
                x = this.pos.x;
                y = this.pos.y;
            }

            if (renderer.settings.subPixel === false) {
                // clamp to pixel grid if required
                x = ~~x;
                y = ~~y;
            }

            // draw the text
            renderer.drawFont(this._drawFont(renderer.getFontContext(), this._text, x, y, stroke || false));

            // for backward compatibilty
            if (typeof this.ancestor === "undefined") {
                // restore previous context
                renderer.restore();
            }

            // clear the dirty flag
            this.isDirty = false;
        },

        /**
         * draw a stroke text at the specified coord, as defined <br>
         * by the `lineWidth` and `fillStroke` properties. <br>
         * Note : using drawStroke is not recommended for performance reasons
         * @name drawStroke
         * @memberOf me.Text
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
            setContextStyle(context, this, stroke);

            var strings = ("" + text).split("\n");
            var lineHeight = this._fontSize * this.lineHeight;
            for (var i = 0; i < strings.length; i++) {
                var string = me.utils.string.trimRight(strings[i]);
                // draw the string
                context[stroke ? "strokeText" : "fillText"](string, x, y);
                // add leading space
                y += lineHeight;
            }
            return this.getBounds();
        },

        /**
         * Destroy function
         * @ignore
         */
        destroy : function () {
            me.pool.push(this.fillStyle);
            me.pool.push(this.strokeStyle);
            this.fillStyle = this.strokeStyle = undefined;
            this._super(me.Renderable, "destroy");
        }
    });
})();
