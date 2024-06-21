import Color from "./../math/color.js";
import Matrix3d from "./../math/matrix3.js";
import * as event from "./../system/event.js";
import Path2D from "./../geometries/path2d.js";
import Vector2d from "../math/vector2.js";
import CanvasRenderTarget from "./rendertarget/canvasrendertarget.js";

/**
 * @import Rect from "./../geometries/rectangle.js";
 * @import RoundRect from "./../geometries/roundrect.js";
 * @import Polygon from "./../geometries/poly.js";
 * @import Line from "./../geometries/line.js";
 * @import Ellipse from "./../geometries/ellipse.js";
 * @import Bounds from "./../physics/bounds.js";
 */

/**
 * @classdesc
 * a base renderer object
 */
export default class Renderer {
    /**
     * @param {ApplicationSettings} [options] - optional parameters for the renderer
     */
    constructor(options) {

        /**
         * The renderer renderTarget
         * @name renderTarget
         * @type {CanvasRenderTarget}
         */
        this.renderTarget = new CanvasRenderTarget(options.width, options.height,
            // support case when a global canvas is available, e.g. webapp adapter for wechat
            typeof globalThis.canvas !== "undefined" ? Object.assign(options, { canvas: globalThis.canvas }) : options
        );

        /**
         * The given constructor options
         * @public
         * @type {object}
         */
        this.settings = options;

        /**
         * the requested video size ratio
         * @public
         * @type {number}
         */
        this.designRatio = this.settings.width / this.settings.height;

        /**
         * the scaling ratio to be applied to the main canvas
         * @type {Vector2d}
         * @default <1,1>
         */
        this.scaleRatio = new Vector2d(this.settings.scale, this.settings.scale);

        /**
         * true if the current rendering context is valid
         * @default true
         * @type {boolean}
         */
        this.isContextValid = true;

        /**
         * the default method to sort object ("sorting", "z-buffer")
         * @type {string}
         * @default "sorting"
         */
        this.depthTest = "sorting";


        /**
         * The Path2D instance used by the renderer to draw primitives
         * @type {Path2D}
         */
        this.path2D = new Path2D();

        /**
         * The renderer type : Canvas, WebGL, etc...
         * (override this property with a specific value when implementing a custom renderer)
         * @type {string}
         */
        this.type = "Generic";

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

        // global color
        this.currentColor = new Color(0, 0, 0, 1.0);

        // global tint color
        this.currentTint = new Color(255, 255, 255, 1.0);

        // the projectionMatrix (set through setProjection)
        this.projectionMatrix = new Matrix3d();

        // default uvOffset
        this.uvOffset = 0;
    }

    /**
     * return the height of the canvas which this renderer draws to
     * @returns {number} height of the system Canvas
     */
    get height() {
        return this.getCanvas().height;
    }

    set height(value) {
        this.resize(this.width, value);
    }

    /**
     * return the width of the canvas which this renderer draws to
     * @returns {number} width of the system Canvas
     */
    get width() {
        return this.getCanvas().width;
    }

    set width(value) {
        this.resize(value, this.height);
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
        this.currentScissor[2] = this.width;
        this.currentScissor[3] = this.height;
        this.clearMask();
    }

    /**
     * return a reference to the current render target corresponding canvas which this renderer draws to
     * @returns {HTMLCanvasElement}
     */
    getCanvas() {
        return this.renderTarget.canvas;
    }

    /**
     * return a reference to the current render target corresponding Context
     * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
     */
    getContext() {
        return this.renderTarget.context;
    }

    /**
     * returns the current blend mode for this renderer
     * @returns {string} blend mode
     */
    getBlendMode() {
        return this.currentBlendMode;
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
            bounds.left <= this.width && bounds.right >= 0 &&
            bounds.top <= this.height && bounds.bottom >= 0
        );
    }

    /**
     * resizes the system canvas
     * @param {number} width - new width of the canvas
     * @param {number} height - new height of the canvas
     */
    resize(width, height) {
        let canvas = this.getCanvas();
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
     * enable/disable image smoothing (scaling interpolation) for the current render target
     * @param {boolean} [enable=false]
     */
    setAntiAlias(enable = false) {
        this.renderTarget.setAntiAlias(enable);
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
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape - a shape object to stroke
     * @param {boolean} [fill=false] - fill the shape with the current color if true
     */
    stroke(shape, fill) {
        switch (shape.type) {

            // RoundRect
            case "RoundRect":
                this.strokeRoundRect(shape.left, shape.top, shape.width, shape.height, shape.radius, fill);
                break;

            // Rect or Bounds
            case "Rectangle":
            case "Bounds":
                this.strokeRect(shape.left, shape.top, shape.width, shape.height, fill);
                break;

            // Polygon or Line
            case "Polygon":
            case "Line":
                this.strokePolygon(shape, fill);
                break;

            case "Ellipse":
                this.strokeEllipse(shape.pos.x, shape.pos.y, shape.radiusV.x, shape.radiusV.y, fill);
                break;

            // Point
            case "Point":
                this.strokePoint(shape.x, shape.y);
                break;

            default:
                throw new Error("Invalid geometry for fill/stroke");
        }
    }

    /**
     * fill the given shape
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape - a shape object to fill
     */
    fill(shape) {
        this.stroke(shape, true);
    }

    /**
     * tint the given image or canvas using the given color
     * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} src - the source image to be tinted
     * @param {Color|string} color - the color that will be used to tint the image
     * @param {string} [mode="multiply"] - the composition mode used to tint the image
     * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas or offscreencanvas (if supported) element representing the tinted image
     */
    tint(src, color, mode = "multiply") {
        const attributes = { context:"2d", offscreenCanvas: true, transparent: true, antiAlias: this.settings.antiAlias };
        let canvasTexture = new CanvasRenderTarget(src.width, src.height, attributes);
        let context = canvasTexture.context;

        context.fillStyle = color instanceof Color ? color.toRGB() : color;
        context.fillRect(0, 0, src.width, src.height);

        context.globalCompositeOperation = mode;
        context.drawImage(src, 0, 0);
        context.globalCompositeOperation = "destination-atop";
        context.drawImage(src, 0, 0);

        return canvasTexture.canvas;
    }

    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
     * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
     */
    // eslint-disable-next-line no-unused-vars
    setMask(mask, invert = false) {}

    /**
     * disable (remove) the rendering mask set through setMask.
     * @see Renderer#setMask
     */
    clearMask() {}

    /**
     * set a coloring tint for sprite based renderables
     * @param {Color} tint - the tint color
     * @param {number} [alpha] - an alpha value to be applied to the tint
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
        this.currentTint.setFloat(1.0, 1.0, 1.0, 1.0);
    }

    /**
     * creates a Blob object representing the last rendered frame
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a Blob object representing the last rendered frame
     * @example
     * renderer.convertToBlob().then((blob) => console.log(blob));
     */
    toBlob(type = "image/png", quality) {
        return this.renderTarget.toBlob(type, quality);
    }

    /**
     * creates an ImageBitmap object of the last frame rendered
     * (not supported by standard Canvas)
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning an ImageBitmap.
     * @example
     * renderer.transferToImageBitmap().then((image) => console.log(image));
     */
    toImageBitmap(type = "image/png", quality) {
        return this.renderTarget.toImageBitmap(type, quality);
    }

    /**
     * returns a data URL containing a representation of the last frame rendered
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a string containing the requested data URL.
     * @example
     * renderer.toDataURL().then((dataURL) => console.log(dataURL));
     */
    toDataURL(type = "image/png", quality) {
        return this.renderTarget.toDataURL(type, quality);
    }
}
