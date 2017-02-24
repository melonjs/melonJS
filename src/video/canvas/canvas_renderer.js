/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot, Jason Oster, Aaron McLeod
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
     * @param {Canvas} canvas The html canvas tag to draw to on screen.
     * @param {Number} width The width of the canvas without scaling
     * @param {Number} height The height of the canvas without scaling
     * @param {Object} [options] The renderer parameters
     * @param {Boolean} [options.doubleBuffering=false] Whether to enable double buffering
     * @param {Boolean} [options.antiAlias=false] Whether to enable anti-aliasing
     * @param {Boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
     * @param {Boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
     * @param {Boolean} [options.textureSeamFix=true] enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
     * @param {Number} [options.zoomX=width] The actual width of the canvas with scaling applied
     * @param {Number} [options.zoomY=height] The actual height of the canvas with scaling applied
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
            this.setColor(this.currentColor);

            // create a texture cache
            this.cache = new me.Renderer.TextureCache();

            if (options.textureSeamFix !== false  && !this.antiAlias) {
                // enable the tile texture seam fix with the canvas renderer
                this.uvOffset = 1;
            }

            return this;
        },

        /**
         * prepare the framebuffer for drawing a new frame
         * @name clear
         * @memberOf me.CanvasRenderer
         * @function
         */
        clear : function () {
            if (this.transparent) {
                this.clearColor("rgba(0,0,0,0)", true);
            }
        },

        /**
         * render the main framebuffer on screen
         * @name flush
         * @memberOf me.CanvasRenderer
         * @function
         */
        flush : function () {
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
         * Clears the main framebuffer with the given color
         * @name clearColor
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Color|String} color CSS color.
         * @param {Boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
         */
        clearColor : function (col, opaque) {
            var _ctx = this.backBufferContext2D;
            var _canvas = _ctx.canvas;

            _ctx.save();
            _ctx.setTransform(1, 0, 0, 1, 0, 0);
            _ctx.globalCompositeOperation = opaque ? "copy" : "source-over";
            _ctx.fillStyle = (col instanceof me.Color) ? col.toRGBA() : col;
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            _ctx.restore();
        },

        /**
         * Sets all pixels in the given rectangle to transparent black, <br>
         * erasing any previously drawn content.
         * @name clearRect
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} x x axis of the coordinate for the rectangle starting point.
         * @param {Number} y y axis of the coordinate for the rectangle starting point.
         * @param {Number} width The rectangle's width.
         * @param {Number} height The rectangle's height.
         */
        clearRect : function (x, y, width, height) {
            this.backBufferContext2D.clearRect(x, y, width, height);
        },

        /**
         * Create a pattern with the specified repition
         * @name createPattern
         * @memberOf me.CanvasRenderer
         * @function
         * @param {image} image Source image
         * @param {String} repeat Define how the pattern should be repeated
         * @return {CanvasPattern}
         * @see me.ImageLayer#repeat
         * @example
         * var tileable   = renderer.createPattern(image, "repeat");
         * var horizontal = renderer.createPattern(image, "repeat-x");
         * var vertical   = renderer.createPattern(image, "repeat-y");
         * var basic      = renderer.createPattern(image, "no-repeat");
         */
        createPattern : function (image, repeat) {
            return this.backBufferContext2D.createPattern(image, repeat);
        },

        /**
         * Draw an image using the canvas api
         * @name drawImage
         * @memberOf me.CanvasRenderer
         * @function
         * @param {image} image Source image
         * @param {Number} sx Source x-coordinate
         * @param {Number} sy Source y-coordinate
         * @param {Number} sw Source width
         * @param {Number} sh Source height
         * @param {Number} dx Destination x-coordinate
         * @param {Number} dy Destination y-coordinate
         * @param {Number} dw Destination width
         * @param {Number} dh Destination height
         * @example
         * // Can be used in three ways:
         * renderer.drawImage(image, dx, dy);
         * renderer.drawImage(image, dx, dy, dw, dh);
         * renderer.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
         * // dx, dy, dw, dh being the destination target & dimensions. sx, sy, sw, sh being the position & dimensions to take from the image
         */
        drawImage : function (image, sx, sy, sw, sh, dx, dy, dw, dh) {
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

            if (this.subPixel === false) {
                if (typeof sw === "undefined") {
                    sw = dw = image.width;
                    sh = dh = image.height;
                    dx = sx;
                    dy = sy;
                    sx = 0;
                    sy = 0;
                }
                else if (typeof dx === "undefined") {
                    dx = sx;
                    dy = sy;
                    dw = sw;
                    dh = sh;
                    sw = image.width;
                    sh = image.height;
                    sx = 0;
                    sy = 0;
                }
                this.backBufferContext2D.drawImage(image, sx, sy, sw, sh, ~~dx, ~~dy, dw, dh);
            } else {
                this.backBufferContext2D.drawImage.apply(this.backBufferContext2D, arguments);
            }
        },

        /**
         * Draw a pattern within the given rectangle.
         * @name drawPattern
         * @memberOf me.CanvasRenderer
         * @function
         * @param {CanvasPattern} pattern Pattern object
         * @param {Number} x
         * @param {Number} y
         * @param {Number} width
         * @param {Number} height
         * @see me.CanvasRenderer#createPattern
         */
        drawPattern : function (pattern, x, y, width, height) {
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }
            var fillStyle = this.backBufferContext2D.fillStyle;
            this.backBufferContext2D.fillStyle = pattern;
            this.backBufferContext2D.fillRect(x, y, width, height);
            this.backBufferContext2D.fillStyle = fillStyle;
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
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

            this.translate(x + radius, y + radius);
            this.backBufferContext2D.beginPath();
            this.backBufferContext2D.arc(0, 0, radius, start, end, antiClockwise || false);
            this.backBufferContext2D.fill();
            this.backBufferContext2D.closePath();
            this.translate(- (x + radius), -(y + radius));
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
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }
            this.backBufferContext2D.fillRect(x, y, width, height);
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
         * return a reference to the font 2d Context
         * @ignore
         */
        getFontContext : function () {
            // in canvas more we can directly use the 2d context
            return this.getContext();
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
         * scales the canvas & 2d Context
         * @name scaleCanvas
         * @memberOf me.CanvasRenderer
         * @function
         */
        scaleCanvas : function (scaleX, scaleY) {
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
            this.setAntiAlias(this.context, this.antiAlias);
            this.flush();
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
            this.currentColor.glArray[3] = this.backBufferContext2D.globalAlpha;
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
            this.backBufferContext2D.globalAlpha = this.currentColor.glArray[3] = a;
        },

        /**
         * sets the line width on the context
         * @name setLineWidth
         * @memberOf me.CanvasRenderer
         * @function
         * @param {Number} width Line width
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
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }
            this.translate(x + radius, y + radius);
            this.backBufferContext2D.beginPath();
            this.backBufferContext2D.arc(0, 0, radius, start, end, antiClockwise || false);
            this.backBufferContext2D.stroke();
            this.backBufferContext2D.closePath();
            this.translate(-(x + radius), -(y + radius));
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
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

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

            this.backBufferContext2D.beginPath();
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
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

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
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

            this.translate(poly.pos.x, poly.pos.y);
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
            this.translate(-poly.pos.x, -poly.pos.y);
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
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }
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
            if (shape.shapeType === "Rectangle") {
                this.strokeRect(shape.left, shape.top, shape.width, shape.height);
            } else if (shape instanceof me.Line || shape instanceof me.Polygon) {
                this.strokePolygon(shape);
            } else if (shape instanceof me.Ellipse) {
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
            }
        },

        /**
         * Resets (overrides) the renderer transformation matrix to the
         * identity one, and then apply the given transformation matrix.
         * @name setTransform
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Matrix2d} mat2d Matrix to transform by
         */
        setTransform : function (mat2d) {
            this.resetTransform();
            this.transform(mat2d);
        },

        /**
         * Multiply given matrix into the renderer tranformation matrix
         * @name transform
         * @memberOf me.CanvasRenderer
         * @function
         * @param {me.Matrix2d} mat2d Matrix to transform by
         */
        transform : function (mat2d) {
            var a = mat2d.val;
            var tx = a[6],
                ty = a[7];

            if (this.subPixel === false) {
                tx = ~~tx;
                ty = ~~ty;
            }

            this.backBufferContext2D.transform(
                a[0],
                a[1],
                a[3],
                a[4],
                tx,
                ty
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
            if (this.subPixel === false) {
                this.backBufferContext2D.translate(~~x, ~~y);
            } else {
                this.backBufferContext2D.translate(x, y);
            }
        }

    });

})();
