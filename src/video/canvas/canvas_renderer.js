(function () {

    /**
     * a canvas renderer object
     * @class
     * @extends me.Renderer
     * @memberOf me
     * @constructor
     * @param {Object} options The renderer parameters
     * @param {Number} options.width The width of the canvas without scaling
     * @param {Number} options.height The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
     * @param {Boolean} [options.doubleBuffering=false] Whether to enable double buffering
     * @param {Boolean} [options.antiAlias=false] Whether to enable anti-aliasing
     * @param {Boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
     * @param {Boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
     * @param {Boolean} [options.textureSeamFix=true] enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
     * @param {Number} [options.zoomX=width] The actual width of the canvas with scaling applied
     * @param {Number} [options.zoomY=height] The actual height of the canvas with scaling applied
     */
    me.CanvasRenderer = me.Renderer.extend({
        /**
         * @ignore
         */
        init : function (options) {
            // parent constructor
            this._super(me.Renderer, "init", [options]);

            // defined the 2d context
            this.context = this.getContext2d(this.getScreenCanvas(), this.settings.transparent);

            // create the back buffer if we use double buffering
            if (this.settings.doubleBuffering) {
                this.backBufferCanvas = me.video.createCanvas(this.settings.width, this.settings.height, true);
                this.backBufferContext2D = this.getContext2d(this.backBufferCanvas);
            }
            else {
                this.backBufferCanvas = this.getScreenCanvas();
                this.backBufferContext2D = this.context;
            }

            this.setBlendMode(this.settings.blendMode);

            // apply the default color to the 2d context
            this.setColor(this.currentColor);

            // create a texture cache
            this.cache = new me.Renderer.TextureCache();

            if (this.settings.textureSeamFix !== false && !this.settings.antiAlias) {
                // enable the tile texture seam fix with the canvas renderer
                this.uvOffset = 1;
            }

            return this;
        },

        /**
         * Reset context state
         * @name reset
         * @memberOf me.CanvasRenderer.prototype
         * @function
         */
        reset : function () {
            this._super(me.Renderer, "reset");
            this.clearColor(this.currentColor, this.settings.transparent !== true);
        },

        /**
         * Reset the canvas transform to identity
         * @name resetTransform
         * @memberOf me.CanvasRenderer.prototype
         * @function
         */
        resetTransform : function () {
            this.backBufferContext2D.setTransform(1, 0, 0, 1, 0, 0);
        },

        /**
         * Set a blend mode for the given context
         * @name setBlendMode
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {String} [mode="normal"] blend mode : "normal", "multiply"
         * @param {Context2d} [context]
         */
        setBlendMode : function (mode, context) {
            context = context || this.getContext();
            this.currentBlendMode = mode;
            switch (mode) {
                case "multiply" :
                    context.globalCompositeOperation = "multiply";
                    break;

                default : // normal
                    context.globalCompositeOperation = "source-over";
                    this.currentBlendMode = "normal";
                    break;
            }

            // transparent setting will override the given blendmode for this.context
            if (this.settings.doubleBuffering && this.settings.transparent) {
                // Clears the front buffer for each frame blit
                this.context.globalCompositeOperation = "copy";
            }
        },

        /**
         * prepare the framebuffer for drawing a new frame
         * @name clear
         * @memberOf me.CanvasRenderer.prototype
         * @function
         */
        clear : function () {
            if (this.settings.transparent) {
                this.clearColor("rgba(0,0,0,0)", true);
            }
        },

        /**
         * render the main framebuffer on screen
         * @name flush
         * @memberOf me.CanvasRenderer.prototype
         * @function
         */
        flush : function () {
            if (this.settings.doubleBuffering) {
                this.context.drawImage(this.backBufferCanvas, 0, 0);
            }
        },

        /**
         * Clears the main framebuffer with the given color
         * @name clearColor
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {me.Color|String} color CSS color.
         * @param {Boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
         */
        clearColor : function (col, opaque) {
            this.save();
            this.resetTransform();
            this.backBufferContext2D.globalCompositeOperation = opaque ? "copy" : "source-over";
            this.backBufferContext2D.fillStyle = (col instanceof me.Color) ? col.toRGBA() : col;
            this.fillRect(0, 0, this.backBufferCanvas.width, this.backBufferCanvas.height);
            this.restore();
        },

        /**
         * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
         * @name clearRect
         * @memberOf me.CanvasRenderer.prototype
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
         * Create a pattern with the specified repetition
         * @name createPattern
         * @memberOf me.CanvasRenderer.prototype
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
         * Draw an image onto the main using the canvas api
         * @name drawImage
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
         * @param {Number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
         * @param {Number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
         * @param {Number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
         * @param {Number} sh The height of the sub-rectangle of the source image to draw into the destination context.
         * @param {Number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
         * @param {Number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
         * @param {Number} dWidth The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
         * @param {Number} dHeight The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
         * @example
         * // Position the image on the canvas:
         * renderer.drawImage(image, dx, dy);
         * // Position the image on the canvas, and specify width and height of the image:
         * renderer.drawImage(image, dx, dy, dWidth, dHeight);
         * // Clip the image and position the clipped part on the canvas:
         * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
         */
        drawImage : function (image, sx, sy, sw, sh, dx, dy, dw, dh) {
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

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

            if (this.settings.subPixel === false) {
                // clamp to pixel grid
                dx = ~~dx;
                dy = ~~dy;
            }

            // apply a tint if required
            var source = image;
            var tint = this.currentTint.toArray();
            if (tint[0] !== 1.0 || tint[1] !== 1.0 || tint[2] !== 1.0) {
                // get a tinted version of this image from the texture cache
                source = this.cache.tint(image, this.currentTint.toRGB());
            }
            this.backBufferContext2D.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
        },

        /**
         * Draw a pattern within the given rectangle.
         * @name drawPattern
         * @memberOf me.CanvasRenderer.prototype
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
         * Stroke an arc at the specified coordinates with given radius, start and end points
         * @name strokeArc
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x arc center point x-axis
         * @param {Number} y arc center point y-axis
         * @param {Number} radius
         * @param {Number} start start angle in radians
         * @param {Number} end end angle in radians
         * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
         */
        strokeArc : function (x, y, radius, start, end, antiClockwise, fill) {
            var context = this.backBufferContext2D;

            if (context.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }
            context.translate(x, y);
            context.beginPath();
            context.arc(0, 0, radius, start, end, antiClockwise || false);
            context[fill === true ? "fill" : "stroke"]();
            context.translate(-x, -y);
        },

        /**
         * Fill an arc at the specified coordinates with given radius, start and end points
         * @name fillArc
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x arc center point x-axis
         * @param {Number} y arc center point y-axis
         * @param {Number} radius
         * @param {Number} start start angle in radians
         * @param {Number} end end angle in radians
         * @param {Boolean} [antiClockwise=false] draw arc anti-clockwise
         */
        fillArc : function (x, y, radius, start, end, antiClockwise) {
            this.strokeArc(x, y, radius, start, end, antiClockwise || false, true);
        },

        /**
         * Stroke an ellipse at the specified coordinates with given radius
         * @name strokeEllipse
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x ellipse center point x-axis
         * @param {Number} y ellipse center point y-axis
         * @param {Number} w horizontal radius of the ellipse
         * @param {Number} h vertical radius of the ellipse
         */
        strokeEllipse : function (x, y, w, h, fill) {
            var context = this.backBufferContext2D;

            if (context.globalAlpha < 1 / 255) {
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

            context.beginPath();
            context.moveTo(x, ty);
            context.bezierCurveTo(xmax, ty, rx, ymin, rx, y);
            context.bezierCurveTo(rx, ymax, xmax, by, x, by);
            context.bezierCurveTo(xmin, by, lx, ymax, lx, y);
            context.bezierCurveTo(lx, ymin, xmin, ty, x, ty);
            context[fill === true ? "fill" : "stroke"]();
            context.closePath();

        },

        /**
         * Fill an ellipse at the specified coordinates with given radius
         * @name fillEllipse
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x ellipse center point x-axis
         * @param {Number} y ellipse center point y-axis
         * @param {Number} w horizontal radius of the ellipse
         * @param {Number} h vertical radius of the ellipse
         */
        fillEllipse : function (x, y, w, h) {
            this.strokeEllipse(x, y, w, h, true);
        },

        /**
         * Stroke a line of the given two points
         * @name strokeLine
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} startX the start x coordinate
         * @param {Number} startY the start y coordinate
         * @param {Number} endX the end x coordinate
         * @param {Number} endY the end y coordinate
         */
        strokeLine : function (startX, startY, endX, endY) {
            var context = this.backBufferContext2D;

            if (context < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(endX, endY);
            context.stroke();
        },

        /**
         * Fill a line of the given two points
         * @name fillLine
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} startX the start x coordinate
         * @param {Number} startY the start y coordinate
         * @param {Number} endX the end x coordinate
         * @param {Number} endY the end y coordinate
         */
        fillLine : function (startX, startY, endX, endY) {
            this.strokeLine(startX, startY, endX, endY);
        },

        /**
         * Stroke the given me.Polygon on the screen
         * @name strokePolygon
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {me.Polygon} poly the shape to draw
         */
        strokePolygon : function (poly, fill) {
            var context = this.backBufferContext2D;

            if (context.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }

            this.translate(poly.pos.x, poly.pos.y);
            context.beginPath();
            context.moveTo(poly.points[0].x, poly.points[0].y);
            var point;
            for (var i = 1; i < poly.points.length; i++) {
                point = poly.points[i];
                context.lineTo(point.x, point.y);
            }
            context.lineTo(poly.points[0].x, poly.points[0].y);
            context[fill === true ? "fill" : "stroke"]();
            context.closePath();
            this.translate(-poly.pos.x, -poly.pos.y);
        },

        /**
         * Fill the given me.Polygon on the screen
         * @name fillPolygon
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {me.Polygon} poly the shape to draw
         */
        fillPolygon : function (poly) {
            this.strokePolygon(poly, true);
        },

        /**
         * Stroke a rectangle at the specified coordinates
         * @name strokeRect
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} width
         * @param {Number} height
         */
        strokeRect : function (x, y, width, height, fill) {
            if (fill === true ) {
                this.fillRect(x, y, width, height);
            } else {
                if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                    // Fast path: don't draw fully transparent
                    return;
                }
                this.backBufferContext2D.strokeRect(x, y, width, height);
            }
        },

        /**
         * Draw a filled rectangle at the specified coordinates
         * @name fillRect
         * @memberOf me.CanvasRenderer.prototype
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
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @return {CanvasRenderingContext2D}
         */
        getContext : function () {
            return this.backBufferContext2D;
        },

        /**
         * return a reference to the font 2d Context
         * @ignore
         */
        getFontContext : function () {
            // in canvas mode we can directly use the 2d context
            return this.getContext();
        },

        /**
         * save the canvas context
         * @name save
         * @memberOf me.CanvasRenderer.prototype
         * @function
         */
        save : function () {
            this.backBufferContext2D.save();
        },

        /**
         * restores the canvas context
         * @name restore
         * @memberOf me.CanvasRenderer.prototype
         * @function
         */
        restore : function () {
            this.backBufferContext2D.restore();
            this.currentColor.glArray[3] = this.backBufferContext2D.globalAlpha;
            this.currentScissor[0] = 0;
            this.currentScissor[1] = 0;
            this.currentScissor[2] = this.backBufferCanvas.width;
            this.currentScissor[3] = this.backBufferCanvas.height;
        },

        /**
         * rotates the canvas context
         * @name rotate
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} angle in radians
         */
        rotate : function (angle) {
            this.backBufferContext2D.rotate(angle);
        },

        /**
         * scales the canvas context
         * @name scale
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        scale : function (x, y) {
            this.backBufferContext2D.scale(x, y);
        },

        /**
         * Set the current fill & stroke style color.
         * By default, or upon reset, the value is set to #000000.
         * @name setColor
         * @memberOf me.CanvasRenderer.prototype
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
         * Set the global alpha on the canvas context
         * @name setGlobalAlpha
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} alpha 0.0 to 1.0 values accepted.
         */
        setGlobalAlpha : function (a) {
            this.backBufferContext2D.globalAlpha = this.currentColor.glArray[3] = a;
        },

        /**
         * Set the line width on the context
         * @name setLineWidth
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} width Line width
         */
        setLineWidth : function (width) {
            this.backBufferContext2D.lineWidth = width;
        },

        /**
         * Reset (overrides) the renderer transformation matrix to the
         * identity one, and then apply the given transformation matrix.
         * @name setTransform
         * @memberOf me.CanvasRenderer.prototype
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
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {me.Matrix2d} mat2d Matrix to transform by
         */
        transform : function (mat2d) {
            var m = mat2d.toArray(),
                a = m[0],
                b = m[1],
                c = m[3],
                d = m[4],
                e = m[6],
                f = m[7];

            if (this.settings.subPixel === false) {
                e |= 0;
                f |= 0;
            }

            this.backBufferContext2D.transform(a, b, c, d, e, f);
        },

        /**
         * Translates the context to the given position
         * @name translate
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x
         * @param {Number} y
         */
        translate : function (x, y) {
            if (this.settings.subPixel === false) {
                this.backBufferContext2D.translate(~~x, ~~y);
            } else {
                this.backBufferContext2D.translate(x, y);
            }
        },

        /**
         * clip the given region from the original canvas. Once a region is clipped,
         * all future drawing will be limited to the clipped region.
         * You can however save the current region using the save(),
         * and restore it (with the restore() method) any time in the future.
         * (<u>this is an experimental feature !</u>)
         * @name clipRect
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {Number} x
         * @param {Number} y
         * @param {Number} width
         * @param {Number} height
         */
        clipRect : function (x, y, width, height) {
            var canvas = this.backBufferCanvas;
            // if requested box is different from the current canvas size;
            if (x !== 0 || y !== 0 || width !== canvas.width || height !== canvas.height) {
                var currentScissor = this.currentScissor;
                // if different from the current scissor box
                if (currentScissor[0] !== x || currentScissor[1] !== y ||
                    currentScissor[2] !== width || currentScissor[3] !== height) {
                    var context = this.backBufferContext2D;
                    context.beginPath();
                    context.rect(x, y, width, height);
                    context.clip();
                    // save the new currentScissor box
                    currentScissor[0] = x;
                    currentScissor[1] = y;
                    currentScissor[2] = width;
                    currentScissor[3] = height;
                }
            }
        },

        /**
         * A mask limits rendering elements to the shape and position of the given mask object.
         * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
         * Mask are not preserved through renderer context save and restore.
         * @name setMask
         * @memberOf me.CanvasRenderer.prototype
         * @function
         * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
         */
        setMask : function (mask) {
            var context = this.backBufferContext2D;
            var _x = mask.pos.x, _y = mask.pos.y;

            // https://github.com/melonjs/melonJS/issues/648
            if (mask instanceof me.Ellipse) {
                var hw = mask.radiusV.x,
                    hh = mask.radiusV.y,
                    lx = _x - hw,
                    rx = _x + hw,
                    ty = _y - hh,
                    by = _y + hh;

                var xmagic = hw * 0.551784,
                    ymagic = hh * 0.551784,
                    xmin = _x - xmagic,
                    xmax = _x + xmagic,
                    ymin = _y - ymagic,
                    ymax = _y + ymagic;

                context.beginPath();
                context.moveTo(_x, ty);
                context.bezierCurveTo(xmax, ty, rx, ymin, rx, _y);
                context.bezierCurveTo(rx, ymax, xmax, by, _x, by);
                context.bezierCurveTo(xmin, by, lx, ymax, lx, _y);
                context.bezierCurveTo(lx, ymin, xmin, ty, _x, ty);
            } else {
                context.save();
                context.beginPath();
                context.moveTo(_x + mask.points[0].x, _y + mask.points[0].y);
                var point;
                for (var i = 1; i < mask.points.length; i++) {
                    point = mask.points[i];
                    context.lineTo(_x + point.x, _y + point.y);
                }
                context.closePath();
            }
            context.clip();
        },

        /**
         * disable (remove) the rendering mask set through setMask.
         * @name clearMask
         * @see me.CanvasRenderer#setMask
         * @memberOf me.CanvasRenderer.prototype
         * @function
         */
        clearMask : function() {
            this.backBufferContext2D.restore();
        }

    });

})();
