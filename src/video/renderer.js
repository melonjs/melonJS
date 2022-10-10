import Color from "./../math/color.js";
import Matrix3d from "./../math/matrix3.js";
import { createCanvas, renderer } from "./video.js";
import * as event from "./../system/event.js";
import * as device from "./../system/device.js";
import { setPrefixed } from "./../utils/agent.js";
import Rect from "./../geometries/rectangle.js";
import RoundRect from "./../geometries/roundrect.js";
import Ellipse from "./../geometries/ellipse.js";
import Polygon from "./../geometries/poly.js";
import Line from "./../geometries/line.js";
import Bounds from "./../physics/bounds.js";
import Path2D from "./../geometries/path2d.js";
import Point from "../geometries/point.js";

/**
 * @classdesc
 * a base renderer object
 */
class Renderer {
    /**
     * @param {object} options The renderer parameters
     * @param {number} options.width The width of the canvas without scaling
     * @param {number} options.height The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
     * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas
     * @param {boolean} [options.premultipliedAlpha=true] in WebGL, whether the renderer will assume that colors have premultiplied alpha when canvas transparency is enabled
     * @param {boolean} [options.blendMode="normal"] the default blend mode to use ("normal", "multiply")
     * @param {boolean} [options.subPixel=false] Whether to enable subpixel rendering (performance hit when enabled)
     * @param {boolean} [options.verbose=false] Enable the verbose mode that provides additional details as to what the renderer is doing
     * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
     * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
     */
    constructor(options) {
        /**
         * The given constructor options
         * @public
         * @type {object}
         */
        this.settings = options;

        /**
         * true if the current rendering context is valid
         * @default true
         * @type {boolean}
         */
        this.isContextValid = true;

        /**
         * The Path2D instance used by the renderer to draw primitives
         * @type {Path2D}
         */
        this.path2D = new Path2D();

        /**
         * @ignore
         */
        this.currentScissor = new Int32Array([ 0, 0, this.settings.width, this.settings.height ]);

        /**
         * @ignore
         */
        this.maskLevel = 0;

        /**
         * @ignore
         */
        this.currentBlendMode = "none";

        // create the main screen canvas
        if (device.platform.ejecta === true) {
            // a main canvas is already automatically created by Ejecta
            this.canvas = document.getElementById("canvas");
        } else if (typeof globalThis.canvas !== "undefined") {
            // a global canvas is available, e.g. webapp adapter for wechat
            this.canvas = globalThis.canvas;
        } else if (typeof this.settings.canvas !== "undefined") {
            this.canvas = this.settings.canvas;
        } else {
            this.canvas = createCanvas(this.settings.width, this.settings.height);
        }

        // global color
        this.currentColor = new Color(0, 0, 0, 1.0);

        // global tint color
        this.currentTint = new Color(255, 255, 255, 1.0);

        // the projectionMatrix (set through setProjection)
        this.projectionMatrix = new Matrix3d();

        // default uvOffset
        this.uvOffset = 0;

        // reset the instantiated renderer on game reset
        event.on(event.GAME_RESET, () => {
            renderer.reset();
        });
    }

    /**
     * prepare the framebuffer for drawing a new frame
     */
    clear() {}

    /**
     * render the main framebuffer on screen
     */
    flush() {}

    /**
     * Reset context state
     */
    reset() {
        this.resetTransform();
        this.setBlendMode(this.settings.blendMode);
        this.setColor("#000000");
        this.clearTint();
        this.cache.clear();
        this.currentScissor[0] = 0;
        this.currentScissor[1] = 0;
        this.currentScissor[2] = this.getCanvas().width;
        this.currentScissor[3] = this.getCanvas().height;
        this.clearMask();
    }

    /**
     * return a reference to the canvas which this renderer draws to
     * @returns {HTMLCanvasElement}
     */
    getCanvas() {
        return this.canvas;
    }


    /**
     * return a reference to this renderer canvas corresponding Context
     * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
     */
    getContext() {
        return this.context;
    }

    /**
     * returns the current blend mode for this renderer
     * @returns {string} blend mode
     */
    getBlendMode() {
        return this.currentBlendMode;
    }

    /**
     * Returns the 2D Context object of the given Canvas<br>
     * Also configures anti-aliasing and blend modes based on constructor options.
     * @param {HTMLCanvasElement} canvas
     * @param {boolean} [transparent=true] use false to disable transparency
     * @returns {CanvasRenderingContext2D}
     */
    getContext2d(canvas, transparent) {
        if (typeof canvas === "undefined" || canvas === null) {
            throw new Error(
                "You must pass a canvas element in order to create " +
                "a 2d context"
            );
        }

        if (typeof canvas.getContext === "undefined") {
            throw new Error(
                "Your browser does not support HTML5 canvas."
            );
        }

        if (typeof transparent !== "boolean") {
            transparent = true;
        }

        var _context = canvas.getContext("2d", {
                "alpha" : transparent
        });

        if (!_context.canvas) {
            _context.canvas = canvas;
        }
        this.setAntiAlias(_context, this.settings.antiAlias);
        return _context;
    }

    /**
     * return the width of the system Canvas
     * @returns {number}
     */
    getWidth() {
        return this.getCanvas().width;
    }

    /**
     * return the height of the system Canvas
     * @returns {number} height of the system Canvas
     */
    getHeight() {
        return this.getCanvas().height;
    }

    /**
     * get the current fill & stroke style color.
     * @returns {Color} current global color
     */
    getColor() {
        return this.currentColor;
    }

    /**
     * return the current global alpha
     * @returns {number}
     */
    globalAlpha() {
        return this.currentColor.glArray[3];
    }

    /**
     * check if the given rect or bounds overlaps with the renderer screen coordinates
     * @param {Rect|Bounds} bounds
     * @returns {boolean} true if overlaps
     */
    overlaps(bounds) {
        return (
            bounds.left <= this.getWidth() && bounds.right >= 0 &&
            bounds.top <= this.getHeight() && bounds.bottom >= 0
        );
    }


    /**
     * resizes the system canvas
     * @param {number} width new width of the canvas
     * @param {number} height new height of the canvas
     */
    resize(width, height) {
        var canvas = this.getCanvas();
        if (width !== canvas.width || height !== canvas.height) {
            canvas.width = width;
            canvas.height = height;
            this.currentScissor[0] = 0;
            this.currentScissor[1] = 0;
            this.currentScissor[2] = width;
            this.currentScissor[3] = height;
            // publish the corresponding event
            event.emit(event.CANVAS_ONRESIZE, width, height);
        }
    }

    /**
     * enable/disable image smoothing (scaling interpolation) for the given context
     * @param {CanvasRenderingContext2D} context
     * @param {boolean} [enable=false]
     */
    setAntiAlias(context, enable) {
        var canvas = context.canvas;

        // enable/disable antialis on the given Context2d object
        setPrefixed("imageSmoothingEnabled", enable === true, context);

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
    }

    /**
     * set/change the current projection matrix (WebGL only)
     * @param {Matrix3d} matrix
     */
    setProjection(matrix) {
        this.projectionMatrix.copy(matrix);
    }

    /**
     * stroke the given shape
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape a shape object to stroke
     * @param {boolean} [fill=false] fill the shape with the current color if true
     */
    stroke(shape, fill) {
        if (shape instanceof RoundRect) {
            this.strokeRoundRect(shape.left, shape.top, shape.width, shape.height, shape.radius, fill);
            return;
        }
        if (shape instanceof Rect || shape instanceof Bounds) {
            this.strokeRect(shape.left, shape.top, shape.width, shape.height, fill);
            return;
        }
        if (shape instanceof Line || shape instanceof Polygon) {
            this.strokePolygon(shape, fill);
            return;
        }
        if (shape instanceof Ellipse) {
            this.strokeEllipse(
                shape.pos.x,
                shape.pos.y,
                shape.radiusV.x,
                shape.radiusV.y,
                fill
            );
            return;
        }
        if (shape instanceof Point) {
            this.strokePoint(shape.x, shape.y);
            return;
        }
        throw new Error("Invalid geometry for fill/stroke");
    }

    /**
     * fill the given shape
     * @name fill
     * @memberof Renderer
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape a shape object to fill
     */
    fill(shape) {
        this.stroke(shape, true);
    }

    /**
     * tint the given image or canvas using the given color
     * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} src the source image to be tinted
     * @param {Color|string} color the color that will be used to tint the image
     * @param {string} [mode="multiply"] the composition mode used to tint the image
     * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas element representing the tinted image
     */
    tint(src, color, mode) {
        var canvas = createCanvas(src.width, src.height, true);
        var context = this.getContext2d(canvas);

        context.save();

        context.fillStyle = color instanceof Color ? color.toRGB() : color;
        context.fillRect(0, 0, src.width, src.height);

        context.globalCompositeOperation = mode || "multiply";
        context.drawImage(src, 0, 0);
        context.globalCompositeOperation = "destination-atop";
        context.drawImage(src, 0, 0);

        context.restore();

        return canvas;
    }

    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] the shape defining the mask to be applied
     * @param {boolean} [invert=false] either the given shape should define what is visible (default) or the opposite
     */
    // eslint-disable-next-line no-unused-vars
    setMask(mask) {}

    /**
     * disable (remove) the rendering mask set through setMask.
     * @see Renderer#setMask
     */
    clearMask() {}

    /**
     * set a coloring tint for sprite based renderables
     * @param {Color} tint the tint color
     * @param {number} [alpha] an alpha value to be applied to the tint
     */
    setTint(tint, alpha = tint.alpha) {
        // global tint color
        this.currentTint.copy(tint);
        this.currentTint.alpha *= alpha;
    }

    /**
     * clear the rendering tint set through setTint.
     * @see Renderer#setTint
     */
    clearTint() {
        // reset to default
        this.currentTint.setColor(255, 255, 255, 1.0);
    }

    /**
     * @ignore
     */
    drawFont(/*bounds*/) {}

}
export default Renderer;
