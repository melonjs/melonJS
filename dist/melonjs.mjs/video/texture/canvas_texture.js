/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { createCanvas } from '../video.js';
import { setPrefixed } from '../../utils/agent.js';
import { clamp } from '../../math/math.js';

// default canvas settings
let defaultAttributes = {
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
     * @param {number} width - the desired width of the canvas
     * @param {number} height - the desired height of the canvas
     * @param {object} attributes - The attributes to create both the canvas and context
     * @param {boolean} [attributes.context="2d"] - the context type to be created ("2d", "webgl", "webgl2")
     * @param {boolean} [attributes.offscreenCanvas=false] - will create an offscreenCanvas if true instead of a standard canvas
     * @param {boolean} [attributes.willReadFrequently=false] - Indicates whether or not a lot of read-back operations are planned
     * @param {boolean} [attributes.antiAlias=false] - Whether to enable anti-aliasing, use false (default) for a pixelated effect.
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
        this.context = this.canvas.getContext(attributes.context, { willReadFrequently: attributes.willReadFrequently });

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
     * @return {ImageData} The ImageData extracted from this CanvasTexture.
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
     * @param {Object} [options] - An object with the following properties:
     * @param {String} [options.type="image/png"] - A string indicating the image format
     * @param {Number} [options.quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @return {Promise} A Promise returning a Blob object representing the image contained in this canvas texture
     * @example
     * canvasTexture.convertToBlob().then((blob) => console.log(blob));
     */
    toBlob(options) {
        if (typeof this.canvas.convertToBlob === "function") {
            return this.canvas.convertToBlob(options);
        } else {
            return new Promise(function(resolve) {
                this.canvas.toBlob((blob) => {
                    resolve(blob);
                }, options ? options.type : undefined, options ? options.quality : undefined);
            });
        }
    }

    /**
     * creates an ImageBitmap object from the most recently rendered image of this canvas texture
     * @param {Object} [options] - An object with the following properties:
     * @param {String} [options.type="image/png"] - A string indicating the image format
     * @param {Number} [options.quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @return {Promise} A Promise returning an ImageBitmap.
     * @example
     * canvasTexture.transferToImageBitmap().then((bitmap) => console.log(bitmap));
     */
    toImageBitmap(options) {
        return new Promise((resolve) => {
            if (typeof this.canvas.transferToImageBitmap === "function") {
                resolve(this.canvas.transferToImageBitmap());
            } else {
                let image = new Image();
                image.src = this.canvas.toDataURL(options);
                image.onload = () => {
                    createImageBitmap(image).then((bitmap) => resolve(bitmap));
                };
            }
        });
    }

    /**
     * returns a data URL containing a representation of the most recently rendered image of this canvas texture
     * (not supported by OffscreenCanvas)
     * @param {Object} [options] - An object with the following properties:
     * @param {String} [options.type="image/png"] - A string indicating the image format
     * @param {Number} [options.quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @return {Promise} A Promise returning a string containing the requested data URL.
     * @example
     * renderer.toDataURL().then((dataURL) => console.log(dataURL));
     */
    toDataURL(options) {
        return new Promise((resolve) => {
            resolve(this.canvas.toDataURL(options));
        });
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

var CanvasTexture$1 = CanvasTexture;

export { CanvasTexture$1 as default };
