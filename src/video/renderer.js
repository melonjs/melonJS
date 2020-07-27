(function () {

    /**
     * a base renderer object
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {Object} options The renderer parameters
     * @param {Number} options.width The width of the canvas without scaling
     * @param {Number} options.height The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
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
    me.Renderer = me.Object.extend({
        /**
         * @ignore
         */
        init : function (options) {
            /**
             * The given constructor options
             * @public
             * @name settings
             * @memberOf me.Renderer#
             * @enum {Object}
             */
            this.settings = options;

            /**
             * true if the current rendering context is valid
             * @name isContextValid
             * @memberOf me.Renderer
             * @default true
             * type {Boolean}
             */
            this.isContextValid = true;

            /**
             * @ignore
             */
            this.currentScissor = new Int32Array([ 0, 0, this.settings.width, this.settings.height ]);

            /**
             * @ignore
             */
            this.currentBlendMode = "normal";

            // create the main screen canvas
            if (me.device.ejecta === true) {
                // a main canvas is already automatically created by Ejecta
                this.canvas = document.getElementById("canvas");
            } else if (typeof window.canvas !== "undefined") {
                // a global canvas is available, e.g. webapp adapter for wechat
                this.canvas = window.canvas;
            } else if (typeof this.settings.canvas !== "undefined") {
                this.canvas = this.settings.canvas;
            } else {
                this.canvas = me.video.createCanvas(this.settings.zoomX, this.settings.zoomY);
            }

            // canvas object and context
            this.backBufferCanvas = this.canvas;
            this.context = null;

            // global color
            this.currentColor = new me.Color(0, 0, 0, 1.0);

            // global tint color
            this.currentTint = new me.Color(255, 255, 255, 1.0);

            // the projectionMatrix (set through setProjection)
            this.projectionMatrix = new me.Matrix3d();

            // default uvOffset
            this.uvOffset = 0;

            // the parent container bouds
            this.parentBounds = new me.Rect(0, 0, 0, 0);

            // reset the instantiated renderer on game reset
            me.event.subscribe(me.event.GAME_RESET, function () {
                me.video.renderer.reset();
            });

            return this;
        },

        /**
         * prepare the framebuffer for drawing a new frame
         * @name clear
         * @memberOf me.Renderer.prototype
         * @function
         */
        clear : function () {},

        /**
         * Reset context state
         * @name reset
         * @memberOf me.Renderer.prototype
         * @function
         */
        reset : function () {
            this.resetTransform();
            this.setBlendMode(this.settings.blendMode);
            this.setColor("#000000");
            this.clearTint();
            this.cache.clear();
            this.currentScissor[0] = 0;
            this.currentScissor[1] = 0;
            this.currentScissor[2] = this.backBufferCanvas.width;
            this.currentScissor[3] = this.backBufferCanvas.height;
        },

        /**
         * return a reference to the system canvas
         * @name getCanvas
         * @memberOf me.Renderer.prototype
         * @function
         * @return {HTMLCanvasElement}
         */
        getCanvas : function () {
            return this.backBufferCanvas;
        },

        /**
         * return a reference to the screen canvas
         * @name getScreenCanvas
         * @memberOf me.Renderer.prototype
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
         * @memberOf me.Renderer.prototype
         * @function
         * @return {Context2d}
         */
        getScreenContext : function () {
            return this.context;
        },

        /**
         * returns the current blend mode for this renderer
         * @name getBlendMode
         * @memberOf me.Renderer.prototype
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
         * @memberOf me.Renderer.prototype
         * @function
         * @param {HTMLCanvasElement} canvas
         * @param {Boolean} [transparent=true] use false to disable transparency
         * @return {Context2d}
         */
        getContext2d : function (c, transparent) {
            if (typeof c === "undefined" || c === null) {
                throw new Error(
                    "You must pass a canvas element in order to create " +
                    "a 2d context"
                );
            }

            if (typeof c.getContext === "undefined") {
                throw new Error(
                    "Your browser does not support HTML5 canvas."
                );
            }

            if (typeof transparent !== "boolean") {
                transparent = true;
            }

            var _context = c.getContext("2d", {
                    "alpha" : transparent
            });

            if (!_context.canvas) {
                _context.canvas = c;
            }
            this.setAntiAlias(_context, this.settings.antiAlias);
            return _context;
        },

        /**
         * return the width of the system Canvas
         * @name getWidth
         * @memberOf me.Renderer.prototype
         * @function
         * @return {Number}
         */
        getWidth : function () {
            return this.backBufferCanvas.width;
        },

        /**
         * return the height of the system Canvas
         * @name getHeight
         * @memberOf me.Renderer.prototype
         * @function
         * @return {Number}
         */
        getHeight : function () {
            return this.backBufferCanvas.height;
        },

        /**
         * get the current fill & stroke style color.
         * @name getColor
         * @memberOf me.Renderer.prototype
         * @function
         * @param {me.Color} current global color
         */
        getColor : function () {
            return this.currentColor;
        },

        /**
         * return the current global alpha
         * @name globalAlpha
         * @memberOf me.Renderer.prototype
         * @function
         * @return {Number}
         */
        globalAlpha : function () {
            return this.currentColor.glArray[3];
        },

        /**
         * check if the given rectangle overlaps with the renderer screen coordinates
         * @name overlaps
         * @memberOf me.Renderer.prototype
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
         * @memberOf me.Renderer.prototype
         * @function
         * @param {Number} width new width of the canvas
         * @param {Number} height new height of the canvas
         */
        resize : function (width, height) {
            if (width !== this.backBufferCanvas.width || height !== this.backBufferCanvas.height) {
                this.canvas.width = this.backBufferCanvas.width = width;
                this.canvas.height = this.backBufferCanvas.height = height;
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
         * @memberOf me.Renderer.prototype
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
                canvas.style["image-rendering"] = "optimizeSpeed"; // legal fallback
                canvas.style["image-rendering"] = "-moz-crisp-edges"; // Firefox
                canvas.style["image-rendering"] = "-o-crisp-edges"; // Opera
                canvas.style["image-rendering"] = "-webkit-optimize-contrast"; // Safari
                canvas.style["image-rendering"] = "optimize-contrast"; // CSS 3
                canvas.style["image-rendering"] = "crisp-edges"; // CSS 4
                canvas.style["image-rendering"] = "pixelated"; // CSS 4
                canvas.style.msInterpolationMode = "nearest-neighbor"; // IE8+
            } else {
                canvas.style["image-rendering"] = "auto";
            }
        },

        /**
         * set/change the current projection matrix (WebGL only)
         * @name setProjection
         * @memberOf me.Renderer.prototype
         * @function
         * @param {me.Matrix3d} matrix
         */
        setProjection : function (matrix) {
            this.projectionMatrix.copy(matrix);
        },

        /**
         * stroke the given shape
         * @name stroke
         * @memberOf me.Renderer.prototype
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
         * tint the given image or canvas using the given color
         * @name tint
         * @memberOf me.Renderer.prototype
         * @function
         * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} image the source image to be tinted
         * @param {me.Color|String} color the color that will be used to tint the image
         * @param {String} [mode="multiply"] the composition mode used to tint the image
         * @return {HTMLCanvasElement|OffscreenCanvas} a new canvas element representing the tinted image
         */
        tint : function (src, color, mode) {
            var canvas = me.video.createCanvas(src.width, src.height, true);
            var context = this.getContext2d(canvas);

            context.save();

            context.fillStyle = color instanceof me.Color ? color.toRGB() : color;
            context.fillRect(0, 0, src.width, src.height);

            context.globalCompositeOperation = mode || "multiply";
            context.drawImage(src, 0, 0);
            context.globalCompositeOperation = "destination-atop";
            context.drawImage(src, 0, 0);

            context.restore();

            return canvas;
        },

        /**
         * fill the given shape
         * @name fill
         * @memberOf me.Renderer.prototype
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
         * @memberOf me.Renderer.prototype
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
         */
        setMask : function (mask) {},

        /**
         * disable (remove) the rendering mask set through setMask.
         * @name clearMask
         * @see me.Renderer#setMask
         * @memberOf me.Renderer.prototype
         * @function
         */
        clearMask : function() {},

        /**
         * set a coloring tint for sprite based renderables
         * @name setTint
         * @memberOf me.Renderer.prototype
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
         * @see me.Renderer#setTint
         * @memberOf me.Renderer.prototype
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
