/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */

(function () {

    /**
     * a canvas renderer object
     * @class
     * @extends me.Renderer
     * @memberOf me
     * @constructor
     * @param {Canvas} canvas - the html canvas tag to draw to on screen.
     * @param {Number} game_width - the width of the canvas without scaling
     * @param {Number} game_height - the height of the canvas without scaling
     * @param {Object} [options] The renderer parameters
     * @param {Boolean} [options.doubleBuffering] - whether to enable double buffering.
     * @param {Number} [options.zoomX] - The actual width of the canvas with scaling applied
     * @param {Number} [options.zoomY] - The actual height of the canvas with scaling applied
     */
    me.CanvasRenderer = me.Renderer.extend(
    /** @scope me.CanvasRenderer.prototype */
    {
        /**
         * @ignore
         */
        init : function (c, width, height, options) {
            // parent constructor
            this._super(me.Renderer, "init", [c, width, height, options]);

            // defined the 2d context
            this.context = this.getContext2d(this.canvas, !this.transparent);

            // create the back buffer if we use double buffering
            if (this.doubleBuffering) {
                this.backBufferCanvas = me.video.createCanvas(width, height, false);
                this.backBufferContext2D = this.getContext2d(this.backBufferCanvas);

                if (this.transparent) {
                    // Clears the front buffer for each frame blit
                    this.context.globalCompositeOperation = "copy";
                }
            }
            else {
                this.backBufferCanvas = this.canvas;
                this.backBufferContext2D = this.context;
            }

            // apply the default color to the 2d context
            this.setColor(this.globalColor);

            // create a texture cache
            this.cache = new me.Renderer.TextureCache();

            return this;
        },

        /**
         * prepare the framebuffer for drawing a new frame
         * @name prepareSurface
         * @memberOf me.CanvasRenderer
         * @function
         */
        prepareSurface : function () {
            if (this.transparent) {
                this.clearSurface(null, "rgba(0,0,0,0)", true);
            }
        },

        /**
         * render the main framebuffer on screen
         * @name blitSurface
         * @memberOf me.CanvasRenderer
         * @function
         */
        blitSurface : function () {
            if (this.doubleBuffering) {
                this.context.drawImage(
                    this.backBufferCanvas, 0, 0,
                    this.backBufferCanvas.width, this.backBufferCanvas.height,
                    0, 0,
                    this.gameWidthZoom, this.gameHeightZoom
                );
            }
        },

        /**
         * Clear the specified context with the given color
         * @name clearSurface
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Context2d} [ctx=null] canvas context, defaults to system context.
         * @param {me.Color|String} color CSS color.
         * @param {Boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
         */
        clearSurface : function (ctx, col, opaque) {
            if (!ctx) {
                ctx = this.backBufferContext2D;
            }
            var _canvas = ctx.canvas;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = opaque ? "copy" : "source-over";
            ctx.fillStyle = (col instanceof me.Color) ? col.toRGBA() : col;
            ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            ctx.restore();
        },

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
        drawFont : function (fontObject, text, x, y) {
            fontObject.draw(this.backBufferContext2D, text, x, y);
        },

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
        drawImage : function () {
            this.backBufferContext2D.drawImage.apply(this.backBufferContext2D, arguments);
        },

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
        fillArc : function (x, y, radius, start, end, antiClockwise) {
            this.backBufferContext2D.save();
            this.backBufferContext2D.beginPath();
            this.backBufferContext2D.translate(x + radius, y + radius);
            this.backBufferContext2D.arc(0, 0, radius, start, end, antiClockwise || false);
            this.backBufferContext2D.fill();
            this.backBufferContext2D.closePath();
            this.backBufferContext2D.restore();
        },

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
        fillRect : function (x, y, width, height) {
            this.backBufferContext2D.fillRect(x, y, width, height);
        },

        /**
         * return a reference to the system canvas
         * @name getCanvas
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Canvas}
         */
        getCanvas : function () {
            return this.backBufferCanvas;
        },

        /**
         * return a reference to the system 2d Context
         * @name getContext
         * @memberOf me.CanvasRenderer
         * @function
         * @return {Context2d}
         */
        getContext : function () {
            return this.backBufferContext2D;
        },

        /**
         * returns the text size based on dimensions from the font. Uses the backbuffer context
         * @name measureText
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Font} the instance of the font object
         * @param {String} text
         * @return {Object}
         */
        measureText : function (fontObject, text) {
            return fontObject.measureText(this.backBufferContext2D, text);
        },

        /**
         * resets the canvas transform to identity
         * @name resetTransform
         * @memberOf me.CanvasRenderer
         * @function
         */
        resetTransform : function () {
            this.backBufferContext2D.setTransform(1, 0, 0, 1, 0, 0);
        },

        /**
         * resizes the canvas & 2d Context
         * @name resize
         * @memberOf me.CanvasRenderer
         * @function
         */
        resize : function (scaleX, scaleY) {
            this.canvas.width = this.gameWidthZoom = this.backBufferCanvas.width * scaleX;
            this.canvas.height = this.gameHeightZoom = this.backBufferCanvas.height * scaleY;

            // adjust CSS style for High-DPI devices
            if (me.device.getPixelRatio() > 1) {
                this.canvas.style.width = (this.canvas.width / me.device.getPixelRatio()) + "px";
                this.canvas.style.height = (this.canvas.height / me.device.getPixelRatio()) + "px";
            }
            if (this.doubleBuffering && this.transparent) {
                // Clears the front buffer for each frame blit
                this.context.globalCompositeOperation = "copy";
            }
            this.setImageSmoothing(this.context, this.antiAlias);
            this.blitSurface();
        },

        /**
         * save the canvas context
         * @name save
         * @memberOf me.CanvasRenderer
         * @function
         */
        save : function () {
            this.backBufferContext2D.save();
        },

        /**
         * restores the canvas context
         * @name restore
         * @memberOf me.CanvasRenderer
         * @function
         */
        restore : function () {
            this.backBufferContext2D.restore();
            this.globalColor.glArray[3] = this.backBufferContext2D.globalAlpha;
        },

        /**
         * rotates the canvas context
         * @name rotate
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} angle in radians
         */
        rotate : function (angle) {
            this.backBufferContext2D.rotate(angle);
        },

        /**
         * scales the canvas context
         * @name scale
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        scale : function (x, y) {
            this.backBufferContext2D.scale(x, y);
        },

        /**
         * Sets the fill & stroke style colors for the context.
         * @name setColor
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Color|String} color css color value
         */
        setColor : function (color) {
            this.backBufferContext2D.strokeStyle =
            this.backBufferContext2D.fillStyle = (
                color instanceof me.Color ?
                color.toRGBA() :
                color
            );
        },

        /**
         * Sets the global alpha on the canvas context
         * @name setGlobalAlpha
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} alpha 0.0 to 1.0 values accepted.
         */
        setGlobalAlpha : function (a) {
            this.backBufferContext2D.globalAlpha = this.globalColor.glArray[3] = a;
        },

        /**
         * sets the line width on the context
         * @name setLineWidth
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} width the width to set;
         */
        setLineWidth : function (width) {
            this.backBufferContext2D.lineWidth = width;
        },

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
        strokeArc : function (x, y, radius, start, end, antiClockwise) {
            this.backBufferContext2D.beginPath();
            this.backBufferContext2D.translate(x + radius, y + radius);
            this.backBufferContext2D.arc(0, 0, radius, start, end, antiClockwise || false);
            this.backBufferContext2D.stroke();
            this.backBufferContext2D.closePath();
        },

        /**
         * Stroke an ellipse at the specified coordinates with given radius, start and end points
         * @name strokeEllipse
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x arc center point x-axis
         * @param {Number} y arc center point y-axis
         * @param {Number} w horizontal radius of the ellipse
         * @param {Number} h vertical radius of the ellipse
         */
        strokeEllipse : function (x, y, w, h) {
            this.context.beginPath();
            var hw = w,
                hh = h,
                lx = x - hw,
                rx = x + hw,
                ty = y - hh,
                by = y + hh;

            var xmagic = hw * 0.551784,
                ymagic = hh * 0.551784,
                xmin = x - xmagic,
                xmax = x + xmagic,
                ymin = y - ymagic,
                ymax = y + ymagic;

            this.backBufferContext2D.moveTo(x, ty);
            this.backBufferContext2D.bezierCurveTo(xmax, ty, rx, ymin, rx, y);
            this.backBufferContext2D.bezierCurveTo(rx, ymax, xmax, by, x, by);
            this.backBufferContext2D.bezierCurveTo(xmin, by, lx, ymax, lx, y);
            this.backBufferContext2D.bezierCurveTo(lx, ymin, xmin, ty, x, ty);
            this.backBufferContext2D.stroke();
        },

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
        strokeLine : function (startX, startY, endX, endY) {
            this.backBufferContext2D.beginPath();
            this.backBufferContext2D.moveTo(startX, startY);
            this.backBufferContext2D.lineTo(endX, endY);
            this.backBufferContext2D.stroke();
        },

        /**
         * Strokes a me.Polygon on the screen with a specified color
         * @name strokePolygon
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Polygon} poly the shape to draw
         */
        strokePolygon : function (poly) {
            this.backBufferContext2D.translate(poly.pos.x, poly.pos.y);
            this.backBufferContext2D.beginPath();
            this.backBufferContext2D.moveTo(poly.points[0].x, poly.points[0].y);
            var point;
            for (var i = 1; i < poly.points.length; i++) {
                point = poly.points[i];
                this.backBufferContext2D.lineTo(point.x, point.y);
            }
            this.backBufferContext2D.lineTo(poly.points[0].x, poly.points[0].y);
            this.backBufferContext2D.stroke();
            this.backBufferContext2D.closePath();
            this.backBufferContext2D.translate(-poly.pos.x, -poly.pos.y);
        },

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
        strokeRect : function (x, y, width, height) {
            this.backBufferContext2D.strokeRect(x, y, width, height);
        },

        /**
         * draw the given shape
         * @name drawShape
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object
         */
        drawShape : function (shape) {
            if (shape instanceof me.Rect) {
                this.strokeRect(shape.left, shape.top, shape.width, shape.height);
            } else if (shape instanceof me.Line || shape instanceof me.Polygon) {
                this.save();
                this.strokePolygon(shape);
                this.restore();
            } else if (shape instanceof me.Ellipse) {
                this.save();
                if (shape.radiusV.x === shape.radiusV.y) {
                    // it's a circle
                    this.strokeArc(
                        shape.pos.x - shape.radius,
                        shape.pos.y - shape.radius,
                        shape.radius,
                        0,
                        2 * Math.PI
                    );
                } else {
                    // it's an ellipse
                    this.strokeEllipse(
                        shape.pos.x,
                        shape.pos.y,
                        shape.radiusV.x,
                        shape.radiusV.y
                    );
                }
                this.restore();
            }
        },

        /**
         * Multiply given matrix into the renderer tranformation matrix
         * @name multiplyMatrix
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Matrix2d} mat2d Matrix to transform by
         */
        transform : function (mat2d) {
            var a = mat2d.val;
            this.backBufferContext2D.transform(
                a[0],
                a[1],
                a[3],
                a[4],
                a[6],
                a[7]
            );
        },

        /**
         * Translates the context to the given position
         * @name translate
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        translate : function (x, y) {
            this.backBufferContext2D.translate(x, y);
        }

    });

})();
