import { createCanvas } from "./../video.js";
import { setPrefixed } from "./../../utils/agent.js";

// default canvas settings
var defaultAttributes = {
    offscreenCanvas : false,
    willReadFrequently : false,
    antiAlias : false,
    context: "2d"
};

/**
 * Creates a Canvas Texture of the given size
 */
class CanvasTexture {
    /**
     * @param {number} width the desired width of the canvas
     * @param {number} height the desired height of the canvas
     * @param {object} attributes The attributes to create both the canvas and context
     * @param {boolean} [attributes.context="2d"] the context type to be created ("2d", "webgl", "webgl2")
     * @param {boolean} [attributes.offscreenCanvas=false] will create an offscreenCanvas if true instead of a standard canvas
     * @param {boolean} [attributes.willReadFrequently=false] Indicates whether or not a lot of read-back operations are planned
     * @param {boolean} [attributes.antiAlias=false] Whether to enable anti-aliasing, use false (default) for a pixelated effect.
     */
    constructor(width, height, attributes = defaultAttributes) {

        // clean up the given attributes
        attributes = Object.assign(defaultAttributes, attributes || {});

        /**
         * the canvas created for this CanvasTexture
         * @type {HTMLCanvasElement|OffscreenCanvas}
         */
        this.canvas = createCanvas(width, height, attributes.offscreenCanvas);

        /**
         * the rendering context of this CanvasTexture
         * @type {CanvasRenderingContext2D}
         */
        this.context = this.canvas.getContext("2d", { willReadFrequently: attributes.willReadFrequently });

        // enable or disable antiAlias if specified
        this.setAntiAlias(attributes.antiAlias);
    }

    /**
     * @ignore
     */
    onResetEvent(width, height) {
        this.clear();
        this.resize(width, height);
    }

    /**
     * Clears the content of the canvas texture
     */
    clear() {
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * enable/disable image smoothing (scaling interpolation)
     * @param {boolean} [enable=false]
     */
    setAntiAlias(enable = false) {
        var canvas = this.canvas;

        // enable/disable antialias on the given Context2d object
        setPrefixed("imageSmoothingEnabled", enable, this.context);

        // set antialias CSS property on the main canvas
        if (typeof canvas.style !== "undefined") {
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
    }

    /**
     * Resizes the canvas texture to the given width and height.
     * @param {number} width the desired width
     * @param {number} height the desired height
     */
    resize(width, height) {
        this.canvas.width = Math.round(width);
        this.canvas.height = Math.round(height);
    }

    /**
     * @ignore
     */
    destroy() {
        this.context = undefined;
        this.canvas = undefined;
    }

    /**
     * The width of this canvas texture in pixels
     * @public
     * @type {number}
     */
    get width() {
        return this.canvas.width;
    }

    set width(val) {
        this.canvas.width = Math.round(val);
    }

    /**
     * The height of this canvas texture in pixels
     * @public
     * @type {number}
     */
    get height() {
        return this.canvas.height;
    }

    set height(val) {
        this.canvas.height = Math.round(val);
    }
}

export default CanvasTexture;
