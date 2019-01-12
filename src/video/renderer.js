/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 */

(function () {

    /**
     * a base renderer object
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {HTMLCanvasElement} canvas The html canvas tag to draw to on screen.
     * @param {Number} width The width of the canvas without scaling
     * @param {Number} height The height of the canvas without scaling
     * @param {Object} [options] The renderer parameters
     * @param {Boolean} [options.doubleBuffering=false] Whether to enable double buffering
     * @param {Boolean} [options.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
     * @param {Boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @param {Boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
     * @param {Boolean} [options.blendMode="normal"] the default blend mode to use ("normal", "multiply")
     * @param {Boolean} [options.subPixel=false] Whether to enable subpixel rendering (performance hit when enabled)
     * @param {Boolean} [options.verbose=false] Enable the verbose mode that provides additional details as to what the renderer is doing
     * @param {Number} [options.zoomX=width] The actual width of the canvas with scaling applied
     * @param {Number} [options.zoomY=height] The actual height of the canvas with scaling applied
     */
    me.Renderer = me.Object.extend(
    /** @scope me.Renderer.prototype */
    {
        /**
         * @ignore
         */
        init : function (c, width, height, options) {
            /**
             * The given constructor options
             * @public
             * @name settings
             * @memberOf me.Renderer
             * @enum {Object}
             */
            this.settings = options;

            /**
             * @ignore
             */
            this.currentScissor = new Int32Array([ 0, 0, this.width, this.height ]);

            /**
             * @ignore
             */
            this.currentBlendMode = "normal";

            // canvas size after scaling
            this.gameWidthZoom = this.settings.zoomX || width;
            this.gameHeightZoom = this.settings.zoomY || height;

            // canvas object and context
            this.canvas = this.backBufferCanvas = c;
            this.context = null;

            // global color
            this.currentColor = new me.Color(0, 0, 0, 1.0);

            // global tint color
            this.currentTint = new me.Color(255, 255, 255, 1.0);

            // default uvOffset
            this.uvOffset = 0;

            // reset the instantiated renderer on game reset
            me.event.subscribe(me.event.GAME_RESET, function () {
                me.video.renderer.reset();
            });

            return this;
        },

        /**
         * @ignore
         */
        clear : function () {},

        /**
         * @ignore
         */
        reset : function () {
            this.resetTransform();
            this.setBlendMode(this.settings.blendMode);
            this.setColor("#000000");
            this.currentTint.setColor(255, 255, 255, 1.0);
            this.cache.reset();
            this.currentScissor[0] = 0;
            this.currentScissor[1] = 0;
            this.currentScissor[2] = this.backBufferCanvas.width;
            this.currentScissor[3] = this.backBufferCanvas.height;
        },

        /**
         * return a reference to the system canvas
         * @name getCanvas
         * @memberOf me.Renderer
         * @function
         * @return {HTMLCanvasElement}
         */
        getCanvas : function () {
            return this.backBufferCanvas;
        },

        /**
         * return a reference to the screen canvas
         * @name getScreenCanvas
         * @memberOf me.Renderer
         * @function
         * @return {HTMLCanvasElement}
         */
        getScreenCanvas : function () {
            return this.canvas;
        },

        /**
         * return a reference to the screen canvas corresponding 2d Context<br>
         * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
         * @name getScreenContext
         * @memberOf me.Renderer
         * @function
         * @return {Context2d}
         */
        getScreenContext : function () {
            return this.context;
        },

        /**
         * returns the current blend mode for this renderer
         * @name getBlendMode
         * @memberOf me.Renderer
         * @function
         * @return {String} blend mode
         */
        getBlendMode : function () {
            return this.currentBlendMode;
        },

        /**
         * Returns the 2D Context object of the given Canvas<br>
         * Also configures anti-aliasing and blend modes based on constructor options.
         * @name getContext2d
         * @memberOf me.Renderer
         * @function
         * @param {HTMLCanvasElement} canvas
         * @param {Boolean} [transparent=true] use false to disable transparency
         * @return {Context2d}
         */
        getContext2d : function (c, transparent) {
            if (typeof c === "undefined" || c === null) {
                throw new me.video.Error(
                    "You must pass a canvas element in order to create " +
                    "a 2d context"
                );
            }

            if (typeof c.getContext === "undefined") {
                throw new me.video.Error(
                    "Your browser does not support HTML5 canvas."
                );
            }

            if (typeof transparent !== "boolean") {
                transparent = true;
            }

            var _context;
            if (me.device.cocoon) {
                // cocoonJS specific extension
                _context = c.getContext("2d", {
                    "antialias" : this.settings.antiAlias,
                    "alpha" : transparent
                });
            }
            else {
                _context = c.getContext("2d", {
                    "alpha" : transparent
                });
            }
            if (!_context.canvas) {
                _context.canvas = c;
            }
            this.setAntiAlias(_context, this.settings.antiAlias);
            return _context;
        },

        /**
         * return the width of the system Canvas
         * @name getWidth
         * @memberOf me.Renderer
         * @function
         * @return {Number}
         */
        getWidth : function () {
            return this.backBufferCanvas.width;
        },

        /**
         * return the height of the system Canvas
         * @name getHeight
         * @memberOf me.Renderer
         * @function
         * @return {Number}
         */
        getHeight : function () {
            return this.backBufferCanvas.height;
        },

        /**
         * get the current fill & stroke style color.
         * @name getColor
         * @memberOf me.Renderer
         * @function
         * @param {me.Color} current global color
         */
        getColor : function () {
            return this.currentColor;
        },

        /**
         * return the current global alpha
         * @name globalAlpha
         * @memberOf me.Renderer
         * @function
         * @return {Number}
         */
        globalAlpha : function () {
            return this.currentColor.glArray[3];
        },

        /**
         * check if the given rectangle overlaps with the renderer screen coordinates
         * @name overlaps
         * @memberOf me.Renderer
         * @function
         * @param  {me.Rect} rect
         * @return {boolean} true if overlaps
         */
        overlaps : function (rect) {
            return (
                rect.left < this.getWidth() && rect.right > 0 &&
                rect.top < this.getHeight() && rect.bottom > 0
            );
        },


        /**
         * resizes the system canvas
         * @name resize
         * @memberOf me.Renderer
         * @function
         * @param {Number} width new width of the canvas
         * @param {Number} height new height of the canvas
         */
        resize : function (width, height) {
            if (width !== this.backBufferCanvas.width || height !== this.backBufferCanvas.height) {
                this.backBufferCanvas.width = width;
                this.backBufferCanvas.height = height;
                this.currentScissor[0] = 0;
                this.currentScissor[1] = 0;
                this.currentScissor[2] = width;
                this.currentScissor[3] = height;
                // publish the corresponding event
                me.event.publish(me.event.CANVAS_ONRESIZE, [ width, height ]);
            }
        },

        /**
         * enable/disable image smoothing (scaling interpolation) for the given context
         * @name setAntiAlias
         * @memberOf me.Renderer
         * @function
         * @param {Context2d} context
         * @param {Boolean} [enable=false]
         */
        setAntiAlias : function (context, enable) {
            var canvas = context.canvas;

            // enable/disable antialis on the given Context2d object
            me.agent.setPrefixed("imageSmoothingEnabled", enable === true, context);

            // set antialias CSS property on the main canvas
            if (enable !== true) {
                // https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering
                canvas.style["image-rendering"] = "pixelated";
                canvas.style["image-rendering"] = "crisp-edges";
                canvas.style["image-rendering"] = "-moz-crisp-edges";
                canvas.style["image-rendering"] = "-o-crisp-edges";
                canvas.style["image-rendering"] = "-webkit-optimize-contrast";
                canvas.style.msInterpolationMode = "nearest-neighbor";
            } else {
                canvas.style["image-rendering"] = "auto";
            }
        },

        /**
         * stroke the given shape
         * @name stroke
         * @memberOf me.Renderer
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to stroke
         */
        stroke : function (shape, fill) {
            if (shape.shapeType === "Rectangle") {
                this.strokeRect(shape.left, shape.top, shape.width, shape.height, fill);
            } else if (shape instanceof me.Line || shape instanceof me.Polygon) {
                this.strokePolygon(shape, fill);
            } else if (shape instanceof me.Ellipse) {
                this.strokeEllipse(
                    shape.pos.x,
                    shape.pos.y,
                    shape.radiusV.x,
                    shape.radiusV.y,
                    fill
                );
            }
        },

        /**
         * fill the given shape
         * @name fill
         * @memberOf me.Renderer
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to fill
         */
        fill : function (shape) {
            this.stroke(shape, true);
        },

        /**
         * A mask limits rendering elements to the shape and position of the given mask object.
         * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
         * Mask are not preserved through renderer context save and restore.
         * @name setMask
         * @memberOf me.Renderer
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
         */
        setMask : function (mask) {},

        /**
         * disable (remove) the rendering mask set through setMask.
         * @name clearMask
         * @see setMask
         * @memberOf me.Renderer
         * @function
         */
        clearMask : function() {},

        /**
         * set a rendering tint (WebGL only) for sprite based renderables.
         * @name setTint
         * @memberOf me.Renderer
         * @function
         * @param {me.Color} [tint] the tint color
         */
        setTint : function (tint) {
            // global tint color
            this.currentTint.copy(tint);
        },

        /**
         * clear the rendering tint set through setTint.
         * @name clearTint
         * @see setTint
         * @memberOf me.Renderer
         * @function
         */
        clearTint : function() {
            // reset to default
            this.currentTint.setColor(255, 255, 255, 1.0);
        },

        /**
         * @ignore
         */
        drawFont : function (/*bounds*/) {}

    });

})();
