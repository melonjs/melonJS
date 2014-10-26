/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {

    /**
     * The canvas renderer object
     * There is no constructor function for me.CanvasRenderer
     * @namespace me.CanvasRenderer
     * @memberOf me
     */
    me.CanvasRenderer = (function () {
        var api = {},
        canvas = null,
        context = null,
        doubleBuffering = null,
        backBufferCanvas = null,
        backBufferContext2D = null,
        gameHeightZoom = 0,
        gameWidthZoom = 0;

        /**
         * initializes the canvas renderer, creating the requried contexts
         * @name init
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Canvas} canvas - the html canvas tag to draw to on screen.
         * @param {Number} game_width - the width of the canvas without scaling
         * @param {Number} game_height - the height of the canvas without scaling
         * @param {Boolean} double_buffering - whether to enable double buffering.
         * @param {Number} game_width_zoom - The actual width of the canvas with scaling applied
         * @param {Number} game_height_zoom - The actual height of the canvas with scaling applied
         */
        api.init = function (c, game_width, game_height, double_buffering, game_width_zoom, game_height_zoom) {
            canvas = c;
            context = this.getContext2d(canvas);
            doubleBuffering = double_buffering;

            // create the back buffer if we use double buffering
            if (doubleBuffering) {
                backBufferCanvas = me.video.createCanvas(game_width, game_height, false);
                backBufferContext2D = this.getContext2d(backBufferCanvas);
            }
            else {
                backBufferCanvas = canvas;
                backBufferContext2D = context;
            }

            gameWidthZoom = game_width_zoom;
            gameHeightZoom = game_height_zoom;

            return this;
        };

        /**
         * @private
         */
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
        };

        /**
         * render the main framebuffer on screen
         * @name blitSurface
         * @memberOf me.CanvasRenderer
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
                api.blitSurface = function () {};
            }
            api.blitSurface();
        };

        /**
         * Clear the specified context with the given color
         * @name clearSurface
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Context2d} [ctx=null] canvas context, defaults to system context.
         * @param {me.Color|String} color CSS color.
         */
        api.clearSurface = function (ctx, col) {
            if (!ctx) {
                ctx = backBufferContext2D;
            }
            var _canvas = ctx.canvas;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = (col instanceof me.Color) ? col.toRGBA() : col;
            ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            ctx.restore();
        };

        /**
         * Quick helper method to draw the font on the backbuffer context. Useful for when using webgl with canvas fallback
         * for different platforms.
         * @name drawFont
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Font} fontObject an instance of me.Font
         * @param {String} text the string of text to draw
         * @param {Number} x the x position to draw at
         * @param {Number} y the y position to draw at
         */
        api.drawFont = function (fontObject, text, x, y) {
            fontObject.draw(backBufferContext2D, text, x, y);
        };

        /**
         * Draw a line from the given point to the destination point.
         * @name drawLine
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} startX start x position
         * @param {Number} startY start y position
         * @param {Number} endX end x position
         * @param {Number} endY end y position
         */
        api.drawLine = function (startX, startY, endX, endY) {
            backBufferContext2D.translate(startX, startY);
            backBufferContext2D.beginPath();
            backBufferContext2D.moveTo(0, 0);
            backBufferContext2D.lineTo(endX, endY);
            backBufferContext2D.stroke();
            backBufferContext2D.closePath();
            backBufferContext2D.translate(-startX, -startY);
        };

        /**
         * Draw an image using the canvas api
         * @name drawImage
         * @memberOf me.CanvasRenderer
         * @function
         * @param {image} image html image element
         * @param {Number} sx sx value, from the source image.
         * @param {Number} sy sy value, from the source image.
         * @param {Number} sw sw the width of the image to be drawn
         * @param {Number} sh sh the height of the image to be drawn
         * @param {Number} dx dx the x position to draw the image at on the screen
         * @param {Number} dy dy the y position to draw the image at on the screen
         * @param {Number} dw dw the width value to draw the image at on the screen
         * @param {Number} dh dh the height value to draw the image at on the screen
         * @example
         * Can be used in three ways:
         * me.CanvasRenderer.drawImage(image, dx, dy);
         * me.CanvasRenderer.drawImage(image, dx, dy, dw, dh);
         * me.CanvasRenderer.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
         * dx, dy, dw, dh being the destination target & dimensions. sx, sy, sw, sh being the position & dimensions to take from the image
         */
        api.drawImage = function () {
            backBufferContext2D.drawImage.apply(backBufferContext2D, arguments);
        };

        /**
         * Fill an arc at the specified coordinates with given radius, start and end points
         * @name fillArc
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x arc center point x-axis
         * @param {Number} y arc center point y-axis
         * @param {Number} radius
         * @param {Number} start start angle in radians
         * @param {Number} end end angle in radians
         * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
         */
        api.fillArc = function (x, y, radius, start, end, antiClockwise) {
            backBufferContext2D.save();
            backBufferContext2D.beginPath();
            backBufferContext2D.translate(x + radius, y + radius);
            backBufferContext2D.arc(0, 0, radius, start, end, antiClockwise || false);
            backBufferContext2D.fill();
            backBufferContext2D.closePath();
            backBufferContext2D.restore();
        };

        /**
         * Draw a filled rectangle at the specified coordinates
         * @name fillRect
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} width
         * @param {Number} height
         */
        api.fillRect = function (x, y, width, height) {
            backBufferContext2D.fillRect(x, y, width, height);
        };

        /**
         * return a reference to the screen canvas
         * @name getScreenCanvas
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Canvas}
         */
        api.getScreenCanvas = function () {
            return canvas;
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
         * @name getContext2d
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Canvas} [canvas=canvas instance of the renderer]
         * @return {Context2d}
         */
        api.getContext2d = function (c) {
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
            if (navigator.isCocoonJS) {
                // cocoonJS specific extension
                _context = c.getContext("2d", {
                    "antialias" : me.sys.scalingInterpolation
                });
            }
            else {
                _context = c.getContext("2d");
            }
            if (!_context.canvas) {
                _context.canvas = c;
            }
            this.setImageSmoothing(_context, me.sys.scalingInterpolation);
            return _context;
        };

        /**
         * return a reference to the system canvas
         * @name getCanvas
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Canvas}
         */
        api.getCanvas = function () {
            return backBufferCanvas;
        };

        /**
         * returns the current color of the context
         * @name getColor
         * @memberOf me.CanvasRenderer
         * @function
         * @return {me.Color}
         */
        api.getColor = function () {
            var color = me.pool.pull("me.Color");
            return color.parseCSS(backBufferContext2D.fillStyle);
        };

        /**
         * return a reference to the system 2d Context
         * @name getContext
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Context2d}
         */
        api.getContext = function () {
            return backBufferContext2D;
        };

        /**
         * return the width of the system 2d Context
         * @name getWidth
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Number}
         */
        api.getWidth = function () {
            return backBufferCanvas.width;
        };

        /**
         * return the height of the system 2d Context
         * @name getHeight
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Number}
         */
        api.getHeight = function () {
            return backBufferCanvas.height;
        };

        /**
         * return the current global alpha
         * @name globalAlpha
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Number}
         */
        api.globalAlpha = function () {
            return backBufferContext2D.globalAlpha;
        };

        /**
         * returns the text size based on dimensions from the font. Uses the backbuffer context
         * @name measureText
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Font} the instance of the font object
         * @param {String} text
         * @return {Object}
         */
        api.measureText = function (fontObject, text) {
            return fontObject.measureText(backBufferContext2D, text);
        };

        /**
         * resets the canvas transform to identity
         * @name resetTransform
         * @memberOf me.CanvasRenderer
         * @function
         */
        api.resetTransform = function () {
            backBufferContext2D.setTransform(1, 0, 0, 1, 0, 0);
        };

        /**
         * resizes the canvas & 2d Context
         * @name resize
         * @memberOf me.CanvasRenderer
         * @function
         */
        api.resize = function (scaleX, scaleY) {
            canvas.width = gameWidthZoom = backBufferCanvas.width * scaleX;
            canvas.height = gameHeightZoom = backBufferCanvas.height * scaleY;

            // adjust CSS style for High-DPI devices
            if (me.device.getPixelRatio() > 1) {
                canvas.style.width = (canvas.width / me.device.getPixelRatio()) + "px";
                canvas.style.height = (canvas.height / me.device.getPixelRatio()) + "px";
            }
            this.setImageSmoothing(context, me.sys.scalingInterpolation);
            this.blitSurface();
        };

        /**
         * save the canvas context
         * @name save
         * @memberOf me.CanvasRenderer
         * @function
         */
        api.save = function () {
            backBufferContext2D.save();
        };

        /**
         * restores the canvas context
         * @name restore
         * @memberOf me.CanvasRenderer
         * @function
         */
        api.restore = function () {
            backBufferContext2D.restore();
        };

        /**
         * rotates the canvas context
         * @name rotate
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} angle in radians
         */
        api.rotate = function (angle) {
            backBufferContext2D.rotate(angle);
        };

        /**
         * scales the canvas context
         * @name scale
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        api.scale = function (x, y) {
            backBufferContext2D.scale(x, y);
        };

        /**
         * @private
         */
        api.setAlpha = function (enable) {
            backBufferContext2D.globalCompositeOperation = enable ? "source-over" : "copy";
        };

        /**
         * Sets the fill & stroke style colors for the context.
         * @name setColor
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Color|String} color css color value
         */
        api.setColor = function (color) {
            color = (color instanceof me.Color) ? color.toRGBA() : color;
            backBufferContext2D.strokeStyle = color;
            backBufferContext2D.fillStyle = color;
        };

        /**
         * Sets the global alpha on the canvas context
         * @name setGlobalAlpha
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} alpha 0.0 to 1.0 values accepted.
         */
        api.setGlobalAlpha = function (a) {
            backBufferContext2D.globalAlpha = a;
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

        /**
         * sets the line width on the context
         * @name setLineWidth
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} width the width to set;
         */
        api.setLineWidth = function (width) {
            backBufferContext2D.lineWidth = width;
        };

        /**
         * Stroke an arc at the specified coordinates with given radius, start and end points
         * @name strokeArc
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x arc center point x-axis
         * @param {Number} y arc center point y-axis
         * @param {Number} radius
         * @param {Number} start start angle in radians
         * @param {Number} end end angle in radians
         * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
         */
        api.strokeArc = function (x, y, radius, start, end, antiClockwise) {
            backBufferContext2D.beginPath();
            backBufferContext2D.translate(x + radius, y + radius);
            backBufferContext2D.arc(0, 0, radius, start, end, antiClockwise || false);
            backBufferContext2D.stroke();
            backBufferContext2D.closePath();
        };

        /**
         * Stroke a line of the given two points
         * @name strokeLine
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} startX the start x coordinate
         * @param {Number} startY the start y coordinate
         * @param {Number} endX the end x coordinate
         * @param {Number} endY the end y coordinate
         */
        api.strokeLine = function (startX, startY, endX, endY) {
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
            context.stroke();
        };

        /**
         * Strokes a me.Polygon on the screen with a specified color
         * @name strokePolygon
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Polygon} poly the shape to draw
         */
        api.strokePolygon = function (poly) {
            backBufferContext2D.translate(poly.pos.x, poly.pos.y);
            backBufferContext2D.beginPath();
            backBufferContext2D.moveTo(poly.points[0].x, poly.points[0].y);
            var point;
            for (var i = 1; i < poly.points.length; i++) {
                point = poly.points[i];
                backBufferContext2D.lineTo(point.x, point.y);
            }
            backBufferContext2D.lineTo(poly.points[0].x, poly.points[0].y);
            backBufferContext2D.stroke();
            backBufferContext2D.closePath();
            backBufferContext2D.translate(-poly.pos.x, -poly.pos.y);
        };

        /**
         * Stroke a rectangle at the specified coordinates with a given color
         * @name strokeRect
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} width
         * @param {Number} height
         */
        api.strokeRect = function (x, y, width, height) {
            backBufferContext2D.strokeRect(x, y, width, height);
        };

        /**
         * draw the given shape
         * @name drawShape
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object
         */
        api.drawShape = function (shape) {
            if (shape instanceof me.Rect) {
                api.strokeRect(shape.left, shape.top, shape.width, shape.height);
            } else if (shape instanceof me.Line || shape instanceof me.Polygon) {
                api.save();
                api.strokePolygon(shape);
                api.restore();
            } else if (shape instanceof me.Ellipse) {
                api.save();
                api.strokeArc(
                    shape.pos.x - shape.radius,
                    shape.pos.y - shape.radius,
                    shape.radius,
                    0,
                    2 * Math.PI
                );
                api.restore();
            }
        };

        /**
         * transforms the context. Accepts any number of integer arguments
         * @name transform
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} m11
         * @param {Number} m12
         * @param {Number} m21
         * @param {Number} m22
         * @param {Number} dx
         * @param {Number} dy
         */
        api.transform = function () {
            backBufferContext2D.transform(
                arguments[0],
                arguments[1],
                arguments[2],
                arguments[3],
                arguments[4],
                arguments[5]
            );
        };

        /**
         * Translates the context to the given position
         * @name translate
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        api.translate = function (x, y) {
            backBufferContext2D.translate(x, y);
        };

        return api;
    })();

})();
