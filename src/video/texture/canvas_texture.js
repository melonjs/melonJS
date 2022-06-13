import { createCanvas } from "./../video.js";

// default video settings
var defaultAttributes = {
    offscreenCanvas : false,
    willReadFrequently : false
};

/**
 * Creates a Canvas Texture of the given size
 */
class CanvasTexture {
    /**
     * @param {number} width the desired width of the canvas
     * @param {number} height the desired height of the canvas
     * @param {object} attributes The attributes to create both the canvas and 2d context
     * @param {boolean} [attributes.offscreenCanvas=false] will create an offscreenCanvas if true instead of a standard canvas
     * @param {boolean} [attributes.willReadFrequently=false] Indicates whether or not a lot of read-back operations are planned
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
