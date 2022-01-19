import Color from "./../../math/color.js";
import Renderer from "./../renderer.js";
import TextureCache from "./../texture_cache.js";
import Ellipse from "./../../geometries/ellipse.js";
import { createCanvas } from "./../video.js";



/**
 * @classdesc
 * a canvas renderer object
 * @class CanvasRenderer
 * @augments me.Renderer
 * @memberof me
 * @param {object} options The renderer parameters
 * @param {number} options.width The width of the canvas without scaling
 * @param {number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing
 * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {boolean} [options.subPixel=false] Whether to enable subpixel renderering (performance hit when enabled)
 * @param {boolean} [options.textureSeamFix=true] enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
 * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
 */
class CanvasRenderer extends Renderer {

    constructor(options) {
        // parent constructor
        super(options);

        // defined the 2d context
        this.context = this.getContext2d(this.getScreenCanvas(), this.settings.transparent);

        // create the back buffer if we use double buffering
        if (this.settings.doubleBuffering) {
            this.backBufferCanvas = createCanvas(this.settings.width, this.settings.height, true);
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
        this.cache = new TextureCache();

        if (this.settings.textureSeamFix !== false && !this.settings.antiAlias) {
            // enable the tile texture seam fix with the canvas renderer
            this.uvOffset = 1;
        }

        return this;
    }

    /**
     * Reset context state
     * @name reset
     * @memberof me.CanvasRenderer.prototype
     * @function
     */
    reset() {
        super.reset();
        this.clearColor(this.currentColor, this.settings.transparent !== true);
    }

    /**
     * Reset the canvas transform to identity
     * @name resetTransform
     * @memberof me.CanvasRenderer.prototype
     * @function
     */
    resetTransform() {
        this.backBufferContext2D.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * Set a blend mode for the given context
     * @name setBlendMode
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {string} [mode="normal"] blend mode : "normal", "multiply"
     * @param {CanvasRenderingContext2D} [context]
     */
    setBlendMode(mode, context) {
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
    }

    /**
     * prepare the framebuffer for drawing a new frame
     * @name clear
     * @memberof me.CanvasRenderer.prototype
     * @function
     */
    clear() {
        if (this.settings.transparent) {
            this.clearColor("rgba(0,0,0,0)", true);
        }
    }

    /**
     * render the main framebuffer on screen
     * @name flush
     * @memberof me.CanvasRenderer.prototype
     * @function
     */
    flush() {
        if (this.settings.doubleBuffering) {
            this.context.drawImage(this.backBufferCanvas, 0, 0);
        }
    }

    /**
     * Clears the main framebuffer with the given color
     * @name clearColor
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {me.Color|string} [color="#000000"] CSS color.
     * @param {boolean} [opaque=false] Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(color = "#000000", opaque) {
        this.save();
        this.resetTransform();
        this.backBufferContext2D.globalCompositeOperation = opaque ? "copy" : "source-over";
        this.backBufferContext2D.fillStyle = (color instanceof Color) ? color.toRGBA() : color;
        this.fillRect(0, 0, this.backBufferCanvas.width, this.backBufferCanvas.height);
        this.restore();
    }

    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @name clearRect
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x x axis of the coordinate for the rectangle starting point.
     * @param {number} y y axis of the coordinate for the rectangle starting point.
     * @param {number} width The rectangle's width.
     * @param {number} height The rectangle's height.
     */
    clearRect(x, y, width, height) {
        this.backBufferContext2D.clearRect(x, y, width, height);
    }

    /**
     * Create a pattern with the specified repetition
     * @name createPattern
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {Image} image Source image
     * @param {string} repeat Define how the pattern should be repeated
     * @returns {CanvasPattern}
     * @see me.ImageLayer#repeat
     * @example
     * var tileable   = renderer.createPattern(image, "repeat");
     * var horizontal = renderer.createPattern(image, "repeat-x");
     * var vertical   = renderer.createPattern(image, "repeat-y");
     * var basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image, repeat) {
        return this.backBufferContext2D.createPattern(image, repeat);
    }

    /**
     * Draw an image onto the main using the canvas api
     * @name drawImage
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {Image} image An element to draw into the context. The specification permits any canvas image source (CanvasImageSource), specifically, a CSSImageValue, an HTMLImageElement, an SVGImageElement, an HTMLVideoElement, an HTMLCanvasElement, an ImageBitmap, or an OffscreenCanvas.
     * @param {number} sx The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sy The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sw The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {number} sh The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} dx The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dy The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dw The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {number} dh The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
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
    }

    /**
     * Draw a pattern within the given rectangle.
     * @name drawPattern
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {CanvasPattern} pattern Pattern object
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @see me.CanvasRenderer#createPattern
     */
    drawPattern(pattern, x, y, width, height) {
        if (this.backBufferContext2D.globalAlpha < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        var fillStyle = this.backBufferContext2D.fillStyle;
        this.backBufferContext2D.fillStyle = pattern;
        this.backBufferContext2D.fillRect(x, y, width, height);
        this.backBufferContext2D.fillStyle = fillStyle;
    }

    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @name strokeArc
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeArc(x, y, radius, start, end, antiClockwise, fill = false) {
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
    }

    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @name fillArc
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x arc center point x-axis
     * @param {number} y arc center point y-axis
     * @param {number} radius
     * @param {number} start start angle in radians
     * @param {number} end end angle in radians
     * @param {boolean} [antiClockwise=false] draw arc anti-clockwise
     */
    fillArc(x, y, radius, start, end, antiClockwise) {
        this.strokeArc(x, y, radius, start, end, antiClockwise || false, true);
    }

    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @name strokeEllipse
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeEllipse(x, y, w, h, fill = false) {
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
    }

    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @name fillEllipse
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x ellipse center point x-axis
     * @param {number} y ellipse center point y-axis
     * @param {number} w horizontal radius of the ellipse
     * @param {number} h vertical radius of the ellipse
     */
    fillEllipse(x, y, w, h) {
        this.strokeEllipse(x, y, w, h, true);
    }

    /**
     * Stroke a line of the given two points
     * @name strokeLine
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    strokeLine(startX, startY, endX, endY) {
        var context = this.backBufferContext2D;

        if (context < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }

        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
    }

    /**
     * Fill a line of the given two points
     * @name fillLine
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} startX the start x coordinate
     * @param {number} startY the start y coordinate
     * @param {number} endX the end x coordinate
     * @param {number} endY the end y coordinate
     */
    fillLine(startX, startY, endX, endY) {
        this.strokeLine(startX, startY, endX, endY);
    }

    /**
     * Stroke the given me.Polygon on the screen
     * @name strokePolygon
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokePolygon(poly, fill = false) {
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
    }

    /**
     * Fill the given me.Polygon on the screen
     * @name fillPolygon
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {me.Polygon} poly the shape to draw
     */
    fillPolygon(poly) {
        this.strokePolygon(poly, true);
    }

    /**
     * Stroke a rectangle at the specified coordinates
     * @name strokeRect
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [fill=false] also fill the shape with the current color if true
     */
    strokeRect(x, y, width, height, fill = false) {
        if (fill === true ) {
            this.fillRect(x, y, width, height);
        } else {
            if (this.backBufferContext2D.globalAlpha < 1 / 255) {
                // Fast path: don't draw fully transparent
                return;
            }
            this.backBufferContext2D.strokeRect(x, y, width, height);
        }
    }

    /**
     * Draw a filled rectangle at the specified coordinates
     * @name fillRect
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRect(x, y, width, height) {
        if (this.backBufferContext2D.globalAlpha < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        this.backBufferContext2D.fillRect(x, y, width, height);
    }


    /**
     * return a reference to the system 2d Context
     * @name getContext
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @returns {CanvasRenderingContext2D}
     */
    getContext() {
        return this.backBufferContext2D;
    }

    /**
     * return a reference to the font 2d Context
     * @ignore
     */
    getFontContext() {
        // in canvas mode we can directly use the 2d context
        return this.getContext();
    }

    /**
     * save the canvas context
     * @name save
     * @memberof me.CanvasRenderer.prototype
     * @function
     */
    save() {
        this.backBufferContext2D.save();
    }

    /**
     * restores the canvas context
     * @name restore
     * @memberof me.CanvasRenderer.prototype
     * @function
     */
    restore() {
        this.backBufferContext2D.restore();
        this.currentColor.glArray[3] = this.backBufferContext2D.globalAlpha;
        this.currentScissor[0] = 0;
        this.currentScissor[1] = 0;
        this.currentScissor[2] = this.backBufferCanvas.width;
        this.currentScissor[3] = this.backBufferCanvas.height;
    }

    /**
     * rotates the canvas context
     * @name rotate
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} angle in radians
     */
    rotate(angle) {
        this.backBufferContext2D.rotate(angle);
    }

    /**
     * scales the canvas context
     * @name scale
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    scale(x, y) {
        this.backBufferContext2D.scale(x, y);
    }

    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @name setColor
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {me.Color|string} color css color value
     */
    setColor(color) {
        this.backBufferContext2D.strokeStyle =
        this.backBufferContext2D.fillStyle = (
            color instanceof Color ?
            color.toRGBA() :
            color
        );
    }

    /**
     * Set the global alpha on the canvas context
     * @name setGlobalAlpha
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} alpha 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(alpha) {
        this.backBufferContext2D.globalAlpha = this.currentColor.glArray[3] = alpha;
    }

    /**
     * Set the line width on the context
     * @name setLineWidth
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} width Line width
     */
    setLineWidth(width) {
        this.backBufferContext2D.lineWidth = width;
    }

    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @name setTransform
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    setTransform(mat2d) {
        this.resetTransform();
        this.transform(mat2d);
    }

    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @name transform
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {me.Matrix2d} mat2d Matrix to transform by
     */
    transform(mat2d) {
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
    }

    /**
     * Translates the context to the given position
     * @name translate
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     */
    translate(x, y) {
        if (this.settings.subPixel === false) {
            this.backBufferContext2D.translate(~~x, ~~y);
        } else {
            this.backBufferContext2D.translate(x, y);
        }
    }

    /**
     * clip the given region from the original canvas. Once a region is clipped,
     * all future drawing will be limited to the clipped region.
     * You can however save the current region using the save(),
     * and restore it (with the restore() method) any time in the future.
     * (<u>this is an experimental feature !</u>)
     * @name clipRect
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    clipRect(x, y, width, height) {
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
    }

    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @name setMask
     * @memberof me.CanvasRenderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
     */
    setMask(mask) {
        var context = this.backBufferContext2D;
        var _x = mask.pos.x, _y = mask.pos.y;

        context.save();

        // https://github.com/melonjs/melonJS/issues/648
        if (mask instanceof Ellipse) {
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
            context.beginPath();
            context.moveTo(_x + mask.points[0].x, _y + mask.points[0].y);
            var point;
            for (var i = 1; i < mask.points.length; i++) {
                point = mask.points[i];
                context.lineTo(_x + point.x, _y + point.y);
            }
        }

        context.clip();
    }

    /**
     * disable (remove) the rendering mask set through setMask.
     * @name clearMask
     * @see me.CanvasRenderer#setMask
     * @memberof me.CanvasRenderer.prototype
     * @function
     */
    clearMask() {
        this.backBufferContext2D.restore();
    }

};

export default CanvasRenderer;
