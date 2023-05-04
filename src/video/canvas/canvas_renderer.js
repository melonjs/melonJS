import Color from "./../../math/color.js";
import Renderer from "./../renderer.js";
import TextureCache from "./../texture/cache.js";
import Ellipse from "./../../geometries/ellipse.js";
import RoundRect from "./../../geometries/roundrect.js";
import Rect from "./../../geometries/rectangle.js";
import Bounds from "./../../physics/bounds.js";
import * as event from "./../../system/event.js";

/**
 * @classdesc
 * a canvas renderer object
 * @augments Renderer
 */
 export default class CanvasRenderer extends Renderer {
    /**
     * @param {object} options - The renderer parameters
     * @param {number} options.width - The width of the canvas without scaling
     * @param {number} options.height - The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] - The html canvas to draw to on screen
     * @param {boolean} [options.antiAlias=false] - Whether to enable anti-aliasing
     * @param {boolean} [options.transparent=false] - Whether to enable transparency on the canvas (performance hit when enabled)
     * @param {boolean} [options.subPixel=false] - Whether to enable subpixel renderering (performance hit when enabled)
     * @param {boolean} [options.textureSeamFix=true] - enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
     * @param {number} [options.zoomX=width] - The actual width of the canvas with scaling applied
     * @param {number} [options.zoomY=height] - The actual height of the canvas with scaling applied
     */
    constructor(options) {
        // parent constructor
        super(options);

        // defined the 2d context
        this.context = this.getContext2d(this.getCanvas(), this.settings.transparent);

        this.setBlendMode(this.settings.blendMode);

        // apply the default color to the 2d context
        this.setColor(this.currentColor);

        // create a texture cache
        this.cache = new TextureCache();

        if (this.settings.textureSeamFix !== false && !this.settings.antiAlias) {
            // enable the tile texture seam fix with the canvas renderer
            this.uvOffset = 1;
        }

        // set the renderer type
        this.type = "CANVAS";

        // context lost & restore event for canvas
        this.getCanvas().addEventListener("contextlost", (e) => {
            e.preventDefault();
            this.isContextValid = false;
            event.emit(event.ONCONTEXT_LOST, this);
        }, false );
        // ctx.restoreContext()
        this.getCanvas().addEventListener("contextrestored", () => {
            this.isContextValid = true;
            event.emit(event.ONCONTEXT_RESTORED, this);
        }, false );

        // reset the renderer on game reset
        event.on(event.GAME_RESET, () => {
            this.reset();
        });
    }

    /**
     * Reset context state
     */
    reset() {
        super.reset();
        this.clearColor(this.currentColor, this.settings.transparent !== true);
    }

    /**
     * Reset the canvas transform to identity
     */
    resetTransform() {
        this.getContext().setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * set a blend mode for the given context. <br>
     * Supported blend mode between Canvas and WebGL remderer : <br>
     * - "normal" : this is the default mode and draws new content on top of the existing content <br>
     * <img src="images/normal-blendmode.png" width="510"/> <br>
     * - "multiply" : the pixels of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result. <br>
     * <img src="images/multiply-blendmode.png" width="510"/> <br>
     * - "additive or lighter" : where both content overlap the color is determined by adding color values. <br>
     * <img src="images/lighter-blendmode.png" width="510"/> <br>
     * - "screen" : The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply) <br>
     * <img src="images/screen-blendmode.png" width="510"/> <br>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
     * @param {string} [mode="normal"] - blend mode : "normal", "multiply", "lighter, "additive", "screen"
     * @param {CanvasRenderingContext2D} [context]
     */
    setBlendMode(mode = "normal", context) {
        context = context || this.getContext();
        this.currentBlendMode = mode;
        switch (mode) {
            case "screen" :
                context.globalCompositeOperation = "screen";
                break;

            case "lighter" :
            case "additive" :
                context.globalCompositeOperation = "lighter";
                break;

            case "multiply" :
                context.globalCompositeOperation = "multiply";
                break;

            default : // normal
                context.globalCompositeOperation = "source-over";
                this.currentBlendMode = "normal";
                break;
        }
    }

    /**
     * prepare the framebuffer for drawing a new frame
     */
    clear() {
        if (this.settings.transparent === false) {
            let canvas = this.getCanvas();
            let context = this.getContext();
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    /**
     * Clears the main framebuffer with the given color
     * @param {Color|string} [color="#000000"] - CSS color.
     * @param {boolean} [opaque=false] - Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(color = "#000000", opaque = false) {
        let canvas = this.getCanvas();
        let context = this.getContext();

        this.save();
        this.resetTransform();
        context.globalAlpha = 1;
        context.globalCompositeOperation = opaque === true ? "copy" : "source-over";
        context.fillStyle = (color instanceof Color) ? color.toRGBA() : color;
        this.fillRect(0, 0, canvas.width, canvas.height);
        this.restore();
    }

    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @param {number} x - x axis of the coordinate for the rectangle starting point.
     * @param {number} y - y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     */
    clearRect(x, y, width, height) {
        this.getContext().clearRect(x, y, width, height);
    }

    /**
     * Create a pattern with the specified repetition
     * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - Source image to be used as the pattern's image
     * @param {string} repeat - Define how the pattern should be repeated
     * @returns {CanvasPattern}
     * @see ImageLayer#repeat
     * @example
     * let tileable   = renderer.createPattern(image, "repeat");
     * let horizontal = renderer.createPattern(image, "repeat-x");
     * let vertical   = renderer.createPattern(image, "repeat-y");
     * let basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image, repeat) {
        return this.getContext().createPattern(image, repeat);
    }

    /**
     * Draw an image onto the main using the canvas api
     * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - An element to draw into the context.
     * @param {number} sx - The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sy - The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sw - The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {number} sh - The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} dx - The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dy - The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dw - The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {number} dh - The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        let context = this.getContext();

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
        let source = image;
        let tint = this.currentTint.toArray();
        if (tint[0] !== 1.0 || tint[1] !== 1.0 || tint[2] !== 1.0) {
            // get a tinted version of this image from the texture cache
            source = this.cache.tint(image, this.currentTint.toRGB());
        }
        context.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    /**
     * Draw a pattern within the given rectangle.
     * @param {CanvasPattern} pattern - Pattern object
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @see CanvasRenderer#createPattern
     */
    drawPattern(pattern, x, y, width, height) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        let context = this.getContext();
        let fillStyle = context.fillStyle;
        context.fillStyle = pattern;
        context.fillRect(x, y, width, height);
        context.fillStyle = fillStyle;
    }

    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius
     * @param {number} start - start angle in radians
     * @param {number} end - end angle in radians
     * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeArc(x, y, radius, start, end, antiClockwise, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        let context = this.getContext();

        context.translate(x, y);
        context.beginPath();
        context.arc(0, 0, radius, start, end, antiClockwise || false);
        context[fill === true ? "fill" : "stroke"]();
        context.translate(-x, -y);
    }

    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius
     * @param {number} start - start angle in radians
     * @param {number} end - end angle in radians
     * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
     */
    fillArc(x, y, radius, start, end, antiClockwise) {
        this.strokeArc(x, y, radius, start, end, antiClockwise || false, true);
    }

    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @param {number} x - ellipse center point x-axis
     * @param {number} y - ellipse center point y-axis
     * @param {number} w - horizontal radius of the ellipse
     * @param {number} h - vertical radius of the ellipse
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeEllipse(x, y, w, h, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        let context = this.getContext();

        let hw = w,
            hh = h,
            lx = x - hw,
            rx = x + hw,
            ty = y - hh,
            by = y + hh;

        let xmagic = hw * 0.551784,
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
     * @param {number} x - ellipse center point x-axis
     * @param {number} y - ellipse center point y-axis
     * @param {number} w - horizontal radius of the ellipse
     * @param {number} h - vertical radius of the ellipse
     */
    fillEllipse(x, y, w, h) {
        this.strokeEllipse(x, y, w, h, true);
    }

    /**
     * Stroke a line of the given two points
     * @param {number} startX - the start x coordinate
     * @param {number} startY - the start y coordinate
     * @param {number} endX - the end x coordinate
     * @param {number} endY - the end y coordinate
     */
    strokeLine(startX, startY, endX, endY) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }

        let context = this.getContext();

        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
    }

    /**
     * Fill a line of the given two points
     * @param {number} startX - the start x coordinate
     * @param {number} startY - the start y coordinate
     * @param {number} endX - the end x coordinate
     * @param {number} endY - the end y coordinate
     */
    fillLine(startX, startY, endX, endY) {
        this.strokeLine(startX, startY, endX, endY);
    }

    /**
     * Stroke the given me.Polygon on the screen
     * @param {Polygon} poly - the shape to draw
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokePolygon(poly, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        let context = this.getContext();

        this.translate(poly.pos.x, poly.pos.y);
        context.beginPath();
        context.moveTo(poly.points[0].x, poly.points[0].y);
        for (let i = 1; i < poly.points.length; i++) {
            const point = poly.points[i];
            context.lineTo(point.x, point.y);
        }
        context.lineTo(poly.points[0].x, poly.points[0].y);
        context[fill === true ? "fill" : "stroke"]();
        context.closePath();
        this.translate(-poly.pos.x, -poly.pos.y);
    }

    /**
     * Fill the given me.Polygon on the screen
     * @param {Polygon} poly - the shape to draw
     */
    fillPolygon(poly) {
        this.strokePolygon(poly, true);
    }

    /**
     * Stroke a rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRect(x, y, width, height, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        let context = this.getContext();

        context[fill === true ? "fillRect" : "strokeRect"](x, y, width, height);
    }

    /**
     * Draw a filled rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRect(x, y, width, height) {
        this.strokeRect(x, y, width, height, true);
    }

    /**
     * Stroke a rounded rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRoundRect(x, y, width, height, radius, fill = false) {
        if (this.getGlobalAlpha() < 1 / 255) {
            // Fast path: don't draw fully transparent
            return;
        }
        let context = this.getContext();

        context.beginPath();
        context.roundRect(x, y, width, height, radius);
        context[fill === true ? "fill" : "stroke"]();
    }

    /**
     * Draw a rounded filled rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     */
    fillRoundRect(x, y, width, height, radius) {
        this.strokeRoundRect(x, y, width, height, radius, true);
    }

    /**
     * Stroke a Point at the specified coordinates
     * @param {number} x
     * @param {number} y
     */
    strokePoint(x, y) {
        this.strokeLine(x, y, x + 1, y + 1);
    }

    /**
     * Draw a a point at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillPoint(x, y) {
        this.strokePoint(x, y);
    }

    /**
     * save the canvas context
     */
    save() {
        this.getContext().save();
    }

    /**
     * restores the canvas context
     */
    restore() {
        this.getContext().restore();
        this.currentColor.glArray[3] = this.getGlobalAlpha();
        this.currentScissor[0] = 0;
        this.currentScissor[1] = 0;
        this.currentScissor[2] = this.getCanvas().width;
        this.currentScissor[3] = this.getCanvas().height;
    }

    /**
     * rotates the canvas context
     * @param {number} angle - in radians
     */
    rotate(angle) {
        this.getContext().rotate(angle);
    }

    /**
     * scales the canvas context
     * @param {number} x
     * @param {number} y
     */
    scale(x, y) {
        this.getContext().scale(x, y);
    }

    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @param {Color|string} color - css color value
     */
    setColor(color) {
        let context = this.getContext();
        context.strokeStyle =
        context.fillStyle = (
            color instanceof Color ?
            color.toRGBA() :
            color
        );
    }

    /**
     * Set the global alpha
     * @param {number} alpha - 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(alpha) {
        this.getContext().globalAlpha = this.currentColor.glArray[3] = alpha;
    }

    /**
     * Return the global alpha
     * @returns {number} global alpha value
     */
    getGlobalAlpha() {
        return this.getContext().globalAlpha;
    }

    /**
     * Set the line width on the context
     * @param {number} width - Line width
     */
    setLineWidth(width) {
        this.getContext().lineWidth = width;
    }

    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @param {Matrix2d} mat2d - Matrix to transform by
     */
    setTransform(mat2d) {
        this.resetTransform();
        this.transform(mat2d);
    }

    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @param {Matrix2d} mat2d - Matrix to transform by
     */
    transform(mat2d) {
        let m = mat2d.toArray(),
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

        this.getContext().transform(a, b, c, d, e, f);
    }

    /**
     * Translates the context to the given position
     * @param {number} x
     * @param {number} y
     */
    translate(x, y) {
        if (this.settings.subPixel === false) {
            this.getContext().translate(~~x, ~~y);
        } else {
            this.getContext().translate(x, y);
        }
    }

    /**
     * clip the given region from the original canvas. Once a region is clipped,
     * all future drawing will be limited to the clipped region.
     * You can however save the current region using the save(),
     * and restore it (with the restore() method) any time in the future.
     * (<u>this is an experimental feature !</u>)
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    clipRect(x, y, width, height) {
        let canvas = this.getCanvas();
        // if requested box is different from the current canvas size;
        if (x !== 0 || y !== 0 || width !== canvas.width || height !== canvas.height) {
            let currentScissor = this.currentScissor;
            // if different from the current scissor box
            if (currentScissor[0] !== x || currentScissor[1] !== y ||
                currentScissor[2] !== width || currentScissor[3] !== height) {
                let context = this.getContext();
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
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
     * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
     */
    setMask(mask, invert = false) {
        let context = this.getContext();

        if (this.maskLevel === 0) {
            // only save context on the first mask
            context.save();
            context.beginPath();
        }

        // https://github.com/melonjs/melonJS/issues/648
        if (mask instanceof RoundRect) {
            context.roundRect(mask.top, mask.left, mask.width, mask.height, mask.radius);
        } else if (mask instanceof Rect || mask instanceof Bounds) {
            context.rect(mask.top, mask.left, mask.width, mask.height);
        } else if (mask instanceof Ellipse) {
            const _x = mask.pos.x, _y = mask.pos.y,
                hw = mask.radiusV.x,
                hh = mask.radiusV.y,
                lx = _x - hw,
                rx = _x + hw,
                ty = _y - hh,
                by = _y + hh;

            let xmagic = hw * 0.551784,
                ymagic = hh * 0.551784,
                xmin = _x - xmagic,
                xmax = _x + xmagic,
                ymin = _y - ymagic,
                ymax = _y + ymagic;

            context.moveTo(_x, ty);
            context.bezierCurveTo(xmax, ty, rx, ymin, rx, _y);
            context.bezierCurveTo(rx, ymax, xmax, by, _x, by);
            context.bezierCurveTo(xmin, by, lx, ymax, lx, _y);
            context.bezierCurveTo(lx, ymin, xmin, ty, _x, ty);
        } else {
            // polygon
            const _x = mask.pos.x, _y = mask.pos.y;
            context.moveTo(_x + mask.points[0].x, _y + mask.points[0].y);
            for (let i = 1; i < mask.points.length; i++) {
                const point = mask.points[i];
                context.lineTo(_x + point.x, _y + point.y);
            }
        }

        this.maskLevel++;

        if (invert === true) {
            context.closePath();
            context.globalCompositeOperation = "destination-atop";
            context.fill();
        } else {
            context.clip();
        }
    }

    /**
     * disable (remove) the rendering mask set through setMask.
     * @see CanvasRenderer#setMask
     */
    clearMask() {
        if (this.maskLevel > 0) {
            this.maskLevel = 0;
            this.getContext().restore();
        }
    }
}
