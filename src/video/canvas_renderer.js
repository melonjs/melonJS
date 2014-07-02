(function () {

    me.CanvasRenderer = (function () {
        var api = {},
        canvas = null,
        context = null,
        doubleBuffering = null,
        backBufferCanvas = null,
        backBufferContext2D = null,
        gameHeightZoom = 0,
        gameWidthZoom = 0;

        api.init = function (c, db) {
            canvas = c;
            context = this.getContext2d(canvas);
            doubleBuffering = db;

            // create the back buffer if we use double buffering
            if (doubleBuffering) {
                backBufferCanvas = me.video.createCanvas(canvas.width, canvas.height, false);
                backBufferContext2D = this.getContext2d(backBufferCanvas);
            }
            else {
                backBufferCanvas = canvas;
                backBufferContext2D = context;
            }

            return this;
        };

        api.applyRGBFilter = function (object, effect, option) {
            //create a output canvas using the given canvas or image size
            var _context = api.getContext2d(me.video.createCanvas(object.width, object.height, false));
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
                    var refColor = me.pool.pull("me.Color").parseHex(option);
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
        };

        /**
         * render the main framebuffer on screen
         * @name blitSurface
         * @memberOf me.video
         * @function
         */
        api.blitSurface = function () {
            if (doubleBuffering) {
                /** @ignore */
                api.blitSurface = function () {
                    //FPS.update();
                    context.drawImage(
                        backBufferCanvas, 0, 0,
                        backBufferCanvas.width, backBufferCanvas.height, 0,
                        0, gameWidthZoom, gameHeightZoom
                    );

                };
            }
            else {
                // "empty" function, as we directly render stuff on "context2D"
                /** @ignore */
                api.blitSurface = function () {
                };
            }
            api.blitSurface();
        };

        /**
         * Clear the specified context with the given color
         * @name clearSurface
         * @memberOf me.CanvasRenderer
         * @function
         * @param {String} color a CSS color string
         */
        api.clearSurface = function (col) {
            var _canvas = context.canvas;
            context.save();
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.fillStyle = col;
            context.fillRect(0, 0, _canvas.width, _canvas.height);
            context.restore();
        };

        /**
         * return a reference to the screen canvas corresponding 2d Context<br>
         * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
         * @name getScreenContext
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Context2d}
         */
        api.getScreenContext = function () {
            return context;
        };

        /**
         * Returns the 2D Context object of the given Canvas
         * `getContext2d` will also enable/disable antialiasing features based on global settings.
         * @name getContext2D
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Canvas}
         * @return {Context2d}
         */
        api.getContext2d = function (canvas) {
            var _context;
            if (navigator.isCocoonJS) {
                // cocoonJS specific extension
                _context = canvas.getContext("2d", {
                    "antialias" : me.sys.scalingInterpolation
                });
            }
            else {
                _context = canvas.getContext("2d");
            }
            if (!_context.canvas) {
                _context.canvas = canvas;
            }
            this.setImageSmoothing(_context, me.sys.scalingInterpolation);
            return _context;
        };

        /**
         * return a reference to the system canvas
         * @name getSystemCanvas
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Canvas}
         */
        api.getSystemCanvas = function () {
            return backBufferCanvas;
        };

        /**
         * return a reference to the system 2d Context
         * @name getSystemContext
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Context2d}
         */
        api.getSystemContext = function () {
            return backBufferContext2D;
        };

        api.resize = function (scaleX, scaleY) {
            gameWidthZoom = backBufferCanvas.width * scaleX;
            gameHeightZoom = backBufferCanvas.height * scaleY;
            canvas.width = gameWidthZoom;
            canvas.height = gameHeightZoom;
            
            // adjust CSS style for High-DPI devices
            if (me.device.getPixelRatio() > 1) {
                canvas.style.width = (canvas.width / me.device.getPixelRatio()) + "px";
                canvas.style.height = (canvas.height / me.device.getPixelRatio()) + "px";
            }
            this.setImageSmoothing(context, me.sys.scalingInterpolation);
            this.blitSurface();
        };

        api.setAlpha = function (enable) {
            context.globalCompositeOperation = enable ? "source-over" : "copy";
        };

        /**
         * enable/disable image smoothing (scaling interpolation) for the specified 2d Context<br>
         * (!) this might not be supported by all browsers <br>
         * @name setImageSmoothing
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Context2d} context
         * @param {Boolean} [enable=false]
         */
        api.setImageSmoothing = function (context, enable) {
            me.agent.setPrefixed("imageSmoothingEnabled", enable === true, context);
        };

        return api;
    })();

})();