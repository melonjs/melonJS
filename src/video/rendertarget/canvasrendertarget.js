import { createCanvas } from "../video.js";
import { setPrefixed } from "../../utils/agent.js";
import { clamp } from "../../math/math.js";

/**
 * additional import for TypeScript
 * @import CanvasRenderer from "./../canvas/canvas_renderer.js";
 * @import WebGLRenderer from "./../webgl/webgl_renderer.js";
 */

// default canvas settings
let defaultAttributes = {
    offscreenCanvas : false,
    willReadFrequently : false,
    antiAlias : false,
    context: "2d",
    transparent : false,
    premultipliedAlpha: true,
    stencil: true,
    blendMode : "normal",
    failIfMajorPerformanceCaveat : true,
    preferWebGL1 : false,
    powerPreference : "default"
};

// WebGL version (if a gl context is created)
let WebGLVersion;

// a helper function to create the 2d/webgl context
function createContext(canvas, attributes) {
    let context;

    if (attributes.context === "2d") {
        // 2d/canvas mode
        context = canvas.getContext(attributes.context, { willReadFrequently: attributes.willReadFrequently });
    } else if (attributes.context === "webgl") {
        let attr = {
            alpha : attributes.transparent,
            antialias : attributes.antiAlias,
            depth : attributes.depth,
            stencil: true,
            preserveDrawingBuffer : false,
            premultipliedAlpha: attributes.transparent ? attributes.premultipliedAlpha : false,
            powerPreference: attributes.powerPreference,
            failIfMajorPerformanceCaveat : attributes.failIfMajorPerformanceCaveat
        };

        // attempt to create a WebGL2 context unless not requested
        if (attributes.preferWebGL1 !== true) {
            context = canvas.getContext("webgl2", attr);
            if (context) {
                WebGLVersion = 2;
            }
        }

        // fallback to WebGL1
        if (!context) {
            WebGLVersion = 1;
            context = canvas.getContext("webgl", attr) || canvas.getContext("experimental-webgl", attr);
        }

        if (!context) {
            throw new Error(
                "A WebGL context could not be created."
            );
        }
    } else {
        throw new Error(
            "Invalid context type. Must be one of '2d' or 'webgl'"
        );
    }

    // set the context size
    return context;
}

/**
 * CanvasRenderTarget is 2D render target which exposes a Canvas interface.
 */
class CanvasRenderTarget {
    /**
     * @param {number} width - the desired width of the canvas
     * @param {number} height - the desired height of the canvas
     * @param {object} attributes - The attributes to create both the canvas and context
     * @param {string} [attributes.context="2d"] - the context type to be created ("2d", "webgl")
     * @param {boolean} [attributes.preferWebGL1=false] - set to true for force using WebGL1 instead of WebGL2 (if supported)
     * @param {boolean} [attributes.transparent=false] - specify if the canvas contains an alpha channel
     * @param {boolean} [attributes.offscreenCanvas=false] - will create an offscreenCanvas if true instead of a standard canvas
     * @param {boolean} [attributes.willReadFrequently=false] - Indicates whether or not a lot of read-back operations are planned
     * @param {boolean} [attributes.antiAlias=false] - Whether to enable anti-aliasing, use false (default) for a pixelated effect.
     */
    constructor(width, height, attributes = defaultAttributes) {
        /**
         * the canvas created for this CanvasRenderTarget
         * @type {HTMLCanvasElement|OffscreenCanvas}
         */
        this.canvas;

        /**
         * the rendering context of this CanvasRenderTarget
         * @type {CanvasRenderingContext2D|WebGLRenderingContext}
         */
        this.context;

        // clean up the given attributes
        this.attributes = Object.assign({}, defaultAttributes, attributes);

        // make sure context is defined
        if (typeof attributes.context === "undefined") {
            attributes.context = "2d";
        }

        // used the given canvas if any
        if (typeof attributes.canvas !== "undefined") {
            this.canvas = attributes.canvas;
        } else {
            this.canvas = createCanvas(width, height, this.attributes.offscreenCanvas);
        }

        // create the context
        this.context = createContext(this.canvas, this.attributes);

        this.WebGLVersion = WebGLVersion;

        // enable or disable antiAlias if specified
        this.setAntiAlias(this.attributes.antiAlias);
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
     * @param {boolean} [enable=false] - whether to enable or not image smoothing (scaling interpolation)
     */
    setAntiAlias(enable = false) {
        let canvas = this.canvas;

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
     * @param {number} width - the desired width
     * @param {number} height - the desired height
     */
    resize(width, height) {
        this.canvas.width = Math.round(width);
        this.canvas.height = Math.round(height);
    }

    /**
     * Returns an ImageData object representing the underlying pixel data for a specified portion of this canvas texture.
     * (Note: when using getImageData(), it is highly recommended to use the `willReadFrequently` attribute when creatimg the corresponding canvas texture)
     * @param {number} x - The x-axis coordinate of the top-left corner of the rectangle from which the ImageData will be extracted
     * @param {number} y - The y-axis coordinate of the top-left corner of the rectangle from which the ImageData will be extracted
     * @param {number} width - The width of the rectangle from which the ImageData will be extracted. Positive values are to the right, and negative to the left
     * @param {number} height - The height of the rectangle from which the ImageData will be extracted. Positive values are down, and negative are up
     * @returns {ImageData} The ImageData extracted from this CanvasRenderTarget.
     */
    getImageData(x, y, width, height) {
        // clamp values
        x = clamp(Math.floor(x), 0, this.canvas.width - 1);
        y = clamp(Math.floor(y), 0, this.canvas.height - 1);
        width = clamp(width, 1, this.canvas.width - x);
        height = clamp(height, 1, this.canvas.height - y);
        // return imageData
        return this.context.getImageData(x, y, width, height);
    }

    /**
     * creates a Blob object representing the image contained in this canvas texture
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a Blob object representing the image contained in this canvas texture
     * @example
     * renderTarget.convertToBlob().then((blob) => console.log(blob));
     */
    toBlob(type = "image/png", quality) {
        if (typeof this.canvas.convertToBlob === "function") {
            return this.canvas.convertToBlob(type, quality);
        } else {
            return new Promise(function(resolve) {
                this.canvas.toBlob((blob) => {
                    resolve(blob);
                }, type, quality);
            });
        }
    }

    /**
     * creates an ImageBitmap object from the most recently rendered image of this canvas texture
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning an ImageBitmap.
     * @example
     * renderTarget.transferToImageBitmap().then((bitmap) => console.log(bitmap));
     */
    toImageBitmap(type = "image/png", quality) {
        return new Promise((resolve) => {
            if (typeof this.canvas.transferToImageBitmap === "function") {
                resolve(this.canvas.transferToImageBitmap());
            } else {
                let image = new Image();
                image.src = this.canvas.toDataURL(type, quality);
                image.onload = () => {
                    globalThis.createImageBitmap(image).then((bitmap) => resolve(bitmap));
                };
            }
        });
    }

    /**
     * returns a data URL containing a representation of the most recently rendered image of this canvas texture
     * (not supported by OffscreenCanvas)
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a string containing the requested data URL.
     * @example
     * renderer.toDataURL().then((dataURL) => console.log(dataURL));
     */
    toDataURL(type = "image/png", quality) {
        return new Promise((resolve) => {
            resolve(this.canvas.toDataURL(type, quality));
        });
    }

    /**
     * invalidate the current CanvasRenderTarget, and force a reupload of the corresponding texture
     * (call this if you modify the canvas content between two draw calls)
     * @param {CanvasRenderer|WebGLRenderer} renderer - the renderer to which this canvas texture is attached
     */
    invalidate(renderer) {
        if (typeof renderer.gl !== "undefined") {
            // make sure the right compositor is active
            renderer.setCompositor("quad");
            // invalidate the previous corresponding texture so that it can reuploaded once changed
            this.glTextureUnit = renderer.cache.getUnit(renderer.cache.get(this.canvas));
            renderer.currentCompositor.unbindTexture2D(null, this.glTextureUnit);
        }
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

export default CanvasRenderTarget;
