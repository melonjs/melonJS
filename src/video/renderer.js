import Color from "./../math/color.js";
import Matrix3d from "./../math/matrix3.js";
import { createCanvas, renderer } from "./video.js";
import * as event from "./../system/event.js";
import device from "./../system/device.js";
import { setPrefixed } from "./../utils/agent.js";
import { Texture } from "./texture.js";
import Rect from "./../geometries/rectangle.js";
import Ellipse from "./../geometries/ellipse.js";
import Polygon from "./../geometries/poly.js";
import Line from "./../geometries/line.js";
import Bounds from "./../physics/bounds.js";

/**
 * @classdesc
 * a base renderer object
 * @class Renderer
 * @memberof me
 * @param {object} options The renderer parameters
 * @param {number} options.width The width of the canvas without scaling
 * @param {number} options.height The height of the canvas without scaling
 * @param {HTMLCanvasElement} [options.canvas] The html canvas to draw to on screen
 * @param {boolean} [options.doubleBuffering=false] Whether to enable double buffering
 * @param {boolean} [options.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
 * @param {boolean} [options.failIfMajorPerformanceCaveat=true] If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
 * @param {boolean} [options.transparent=false] Whether to enable transparency on the canvas (performance hit when enabled)
 * @param {boolean} [options.blendMode="normal"] the default blend mode to use ("normal", "multiply")
 * @param {boolean} [options.subPixel=false] Whether to enable subpixel rendering (performance hit when enabled)
 * @param {boolean} [options.verbose=false] Enable the verbose mode that provides additional details as to what the renderer is doing
 * @param {number} [options.zoomX=width] The actual width of the canvas with scaling applied
 * @param {number} [options.zoomY=height] The actual height of the canvas with scaling applied
 */
class Renderer {

    constructor(options) {
        /**
         * The given constructor options
         * @public
         * @name settings
         * @memberof me.Renderer#
         * @enum {object}
         */
        this.settings = options;

        /**
         * true if the current rendering context is valid
         * @name isContextValid
         * @memberof me.Renderer
         * @default true
         * type {boolean}
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
        if (device.ejecta === true) {
            // a main canvas is already automatically created by Ejecta
            this.canvas = document.getElementById("canvas");
        } else if (typeof window.canvas !== "undefined") {
            // a global canvas is available, e.g. webapp adapter for wechat
            this.canvas = window.canvas;
        } else if (typeof this.settings.canvas !== "undefined") {
            this.canvas = this.settings.canvas;
        } else {
            this.canvas = createCanvas(this.settings.zoomX, this.settings.zoomY);
        }

        // canvas object and context
        this.backBufferCanvas = this.canvas;
        this.context = null;

        // global color
        this.currentColor = new Color(0, 0, 0, 1.0);

        // global tint color
        this.currentTint = new Color(255, 255, 255, 1.0);

        // the projectionMatrix (set through setProjection)
        this.projectionMatrix = new Matrix3d();

        // default uvOffset
        this.uvOffset = 0;

        this.Texture = Texture;

        // reset the instantiated renderer on game reset
        event.on(event.GAME_RESET, () => {
            renderer.reset();
        });

        return this;
    }

    /**
     * prepare the framebuffer for drawing a new frame
     * @name clear
     * @memberof me.Renderer.prototype
     * @function
     */
    clear() {}

    /**
     * Reset context state
     * @name reset
     * @memberof me.Renderer.prototype
     * @function
     */
    reset() {
        this.resetTransform();
        this.setBlendMode(this.settings.blendMode);
        this.setColor("#000000");
        this.clearTint();
        this.cache.clear();
        this.currentScissor[0] = 0;
        this.currentScissor[1] = 0;
        this.currentScissor[2] = this.backBufferCanvas.width;
        this.currentScissor[3] = this.backBufferCanvas.height;
    }

    /**
     * return a reference to the system canvas
     * @name getCanvas
     * @memberof me.Renderer.prototype
     * @function
     * @returns {HTMLCanvasElement}
     */
    getCanvas() {
        return this.backBufferCanvas;
    }

    /**
     * return a reference to the screen canvas
     * @name getScreenCanvas
     * @memberof me.Renderer.prototype
     * @function
     * @returns {HTMLCanvasElement}
     */
    getScreenCanvas() {
        return this.canvas;
    }

    /**
     * return a reference to the screen canvas corresponding 2d Context<br>
     * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
     * @name getScreenContext
     * @memberof me.Renderer.prototype
     * @function
     * @returns {CanvasRenderingContext2D}
     */
    getScreenContext() {
        return this.context;
    }

    /**
     * returns the current blend mode for this renderer
     * @name getBlendMode
     * @memberof me.Renderer.prototype
     * @function
     * @returns {string} blend mode
     */
    getBlendMode() {
        return this.currentBlendMode;
    }

    /**
     * Returns the 2D Context object of the given Canvas<br>
     * Also configures anti-aliasing and blend modes based on constructor options.
     * @name getContext2d
     * @memberof me.Renderer.prototype
     * @function
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
     * @name getWidth
     * @memberof me.Renderer.prototype
     * @function
     * @returns {number}
     */
    getWidth() {
        return this.backBufferCanvas.width;
    }

    /**
     * return the height of the system Canvas
     * @name getHeight
     * @memberof me.Renderer.prototype
     * @function
     * @returns {number} height of the system Canvas
     */
    getHeight() {
        return this.backBufferCanvas.height;
    }

    /**
     * get the current fill & stroke style color.
     * @name getColor
     * @memberof me.Renderer.prototype
     * @function
     * @returns {me.Color} current global color
     */
    getColor() {
        return this.currentColor;
    }

    /**
     * return the current global alpha
     * @name globalAlpha
     * @memberof me.Renderer.prototype
     * @function
     * @returns {number}
     */
    globalAlpha() {
        return this.currentColor.glArray[3];
    }

    /**
     * check if the given rect or bounds overlaps with the renderer screen coordinates
     * @name overlaps
     * @memberof me.Renderer.prototype
     * @function
     * @param  {me.Rect|me.Bounds} bounds
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
     * @name resize
     * @memberof me.Renderer.prototype
     * @function
     * @param {number} width new width of the canvas
     * @param {number} height new height of the canvas
     */
    resize(width, height) {
        if (width !== this.backBufferCanvas.width || height !== this.backBufferCanvas.height) {
            this.canvas.width = this.backBufferCanvas.width = width;
            this.canvas.height = this.backBufferCanvas.height = height;
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
     * @name setAntiAlias
     * @memberof me.Renderer.prototype
     * @function
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
     * @name setProjection
     * @memberof me.Renderer.prototype
     * @function
     * @param {me.Matrix3d} matrix
     */
    setProjection(matrix) {
        this.projectionMatrix.copy(matrix);
    }

    /**
     * stroke the given shape
     * @name stroke
     * @memberof me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to stroke
     * @param {boolean} [fill=false] fill the shape with the current color if true
     */
    stroke(shape, fill) {
        if (shape instanceof Rect || shape instanceof Bounds) {
            this.strokeRect(shape.left, shape.top, shape.width, shape.height, fill);
        } else if (shape instanceof Line || shape instanceof Polygon) {
            this.strokePolygon(shape, fill);
        } else if (shape instanceof Ellipse) {
            this.strokeEllipse(
                shape.pos.x,
                shape.pos.y,
                shape.radiusV.x,
                shape.radiusV.y,
                fill
            );
        }
    }

    /**
     * tint the given image or canvas using the given color
     * @name tint
     * @memberof me.Renderer.prototype
     * @function
     * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} src the source image to be tinted
     * @param {me.Color|string} color the color that will be used to tint the image
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
     * fill the given shape
     * @name fill
     * @memberof me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} shape a shape object to fill
     */
    fill(shape) {
        this.stroke(shape, true);
    }

    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @name setMask
     * @memberof me.Renderer.prototype
     * @function
     * @param {me.Rect|me.Polygon|me.Line|me.Ellipse} [mask] the shape defining the mask to be applied
     */
    // eslint-disable-next-line no-unused-vars
    setMask(mask) {}

    /**
     * disable (remove) the rendering mask set through setMask.
     * @name clearMask
     * @see me.Renderer#setMask
     * @memberof me.Renderer.prototype
     * @function
     */
    clearMask() {}

    /**
     * set a coloring tint for sprite based renderables
     * @name setTint
     * @memberof me.Renderer.prototype
     * @function
     * @param {me.Color} tint the tint color
     * @param {number} [alpha] an alpha value to be applied to the tint
     */
    setTint(tint, alpha = tint.alpha) {
        // global tint color
        this.currentTint.copy(tint);
        this.currentTint.alpha *= alpha;
    }

    /**
     * clear the rendering tint set through setTint.
     * @name clearTint
     * @see me.Renderer#setTint
     * @memberof me.Renderer.prototype
     * @function
     */
    clearTint() {
        // reset to default
        this.currentTint.setColor(255, 255, 255, 1.0);
    }

    /**
     * @ignore
     */
    drawFont(/*bounds*/) {}

};

export default Renderer;
