/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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
     * @param {Canvas} canvas The html canvas tag to draw to on screen.
     * @param {Number} width The width of the canvas without scaling
     * @param {Number} height The height of the canvas without scaling
     * @param {Object} [options] The renderer parameters
     * @param {Boolean} [options.doubleBuffering=false] Whether to enable double buffering
     * @param {Boolean} [options.antiAlias=false] Whether to enable anti-aliasing
     * @param {Boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
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
            options = options || {};

            // rendering options
            this.transparent = !!(options.transparent);
            this.doubleBuffering = !!(options.doubleBuffering);
            this.antiAlias = !!(options.antiAlias);
            this.subPixel = !!(options.subPixel);
            this.verbose = !!(options.verbose);

            this.gameWidthZoom = options.zoomX || width;
            this.gameHeightZoom = options.zoomY || height;

            // canvas object and context
            this.canvas = this.backBufferCanvas = c;
            this.context = null;

            // global color
            this.currentColor = new me.Color(255, 255, 255, 1.0);

            // default uvOffset
            this.uvOffset = 0;

            return this;
        },

        /**
         * @ignore
         */
        applyRGBFilter : function (object, effect, option) {
            //create a output canvas using the given canvas or image size
            var _context = this.getContext2d(me.video.createCanvas(object.width, object.height, false));
            // get the pixels array of the give parameter
            var imgpix = me.utils.getPixels(object);
            // pointer to the pixels data
            var pix = imgpix.data;

            // apply selected effect
            var i, n;
            switch (effect) {
                case "b&w":
                    for (i = 0, n = pix.length; i < n; i += 4) {
                        var grayscale = (3 * pix[i] + 4 * pix[i + 1] + pix[i + 2]) >>> 3;
                        pix[i] = grayscale; // red
                        pix[i + 1] = grayscale; // green
                        pix[i + 2] = grayscale; // blue
                    }
                    break;

                case "brightness":
                    // make sure it's between 0.0 and 1.0
                    var brightness = Math.abs(option).clamp(0.0, 1.0);
                    for (i = 0, n = pix.length; i < n; i += 4) {

                        pix[i] *= brightness; // red
                        pix[i + 1] *= brightness; // green
                        pix[i + 2] *= brightness; // blue
                    }
                    break;

                case "transparent":
                    var refColor = me.pool.pull("me.Color").parseCSS(option);
                    var pixel = me.pool.pull("me.Color");
                    for (i = 0, n = pix.length; i < n; i += 4) {
                        pixel.setColor(pix[i], pix[i + 1], pix[i + 2]);
                        if (pixel.equals(refColor)) {
                            pix[i + 3] = 0;
                        }
                    }
                    me.pool.push(refColor);
                    me.pool.push(pixel);

                    break;


                default:
                    return null;
            }

            // put our modified image back in the new filtered canvas
            _context.putImageData(imgpix, 0, 0);

            // return it
            return _context;
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
            this.cache.reset();
        },

        /**
         * return a reference to the system canvas
         * @name getCanvas
         * @memberOf me.Renderer
         * @function
         * @return {Canvas}
         */
        getCanvas : function () {
            return this.backBufferCanvas;
        },

        /**
         * return a reference to the screen canvas
         * @name getScreenCanvas
         * @memberOf me.Renderer
         * @function
         * @return {Canvas}
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
         * Returns the 2D Context object of the given Canvas<br>
         * Also configures anti-aliasing based on constructor options.
         * @name getContext2d
         * @memberOf me.Renderer
         * @function
         * @param {Canvas} canvas
         * @param {Boolean} [opaque=false] True to disable transparency
         * @return {Context2d}
         */
        getContext2d : function (c, opaque) {
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

            var _context;
            if (me.device.cocoon) {
                // cocoonJS specific extension
                _context = c.getContext("2d", {
                    "antialias" : this.antiAlias,
                    "alpha" : !opaque
                });
            }
            else {
                _context = c.getContext("2d", {
                    "alpha" : !opaque
                });
            }
            if (!_context.canvas) {
                _context.canvas = c;
            }
            this.setAntiAlias(_context, this.antiAlias);
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
         * resizes the system canvas
         * @name resize
         * @memberOf me.Renderer
         * @function
         * @param {Number} width new width of the canvas
         * @param {Number} height new height of the canvas
         */
        resize : function (width, height) {
            this.backBufferCanvas.width = width;
            this.backBufferCanvas.height = height;
        },

        /**
         * enable/disable image smoothing (scaling interpolation) for the specified 2d Context<br>
         * (!) this might not be supported by all browsers <br>
         * @name setAntiAlias
         * @memberOf me.Renderer
         * @function
         * @param {Context2d} context
         * @param {Boolean} [enable=false]
         */
        setAntiAlias : function (context, enable) {
            if (typeof(context) !== "undefined") {
                // enable/disable antialis on the given context
                me.agent.setPrefixed("imageSmoothingEnabled", enable === true, context);
            }

            // disable antialias CSS scaling on the main canvas
            var cssStyle = context.canvas.style["image-rendering"];
            if (enable === false && (cssStyle === "" || cssStyle === "auto")) {
                // if a specific value is set through CSS or equal to the standard "auto" one
                context.canvas.style["image-rendering"] = "pixelated";
            } else if (enable === true && cssStyle === "pixelated") {
                // if set to the standard "pixelated"
                context.canvas.style["image-rendering"] = "auto";
            }
        },

        /**
         * @ignore
         */
        drawFont : function (/*bounds*/) {}

    });

})();
