export default CanvasTexture;
/**
 * Creates a Canvas Texture of the given size
 * (when using WebGL, use `invalidate` to force a reupload of the corresponding texture)
 */
declare class CanvasTexture {
    /**
     * @param {number} width - the desired width of the canvas
     * @param {number} height - the desired height of the canvas
     * @param {object} attributes - The attributes to create both the canvas and context
     * @param {boolean} [attributes.context="2d"] - the context type to be created ("2d", "webgl", "webgl2")
     * @param {boolean} [attributes.offscreenCanvas=false] - will create an offscreenCanvas if true instead of a standard canvas
     * @param {boolean} [attributes.willReadFrequently=false] - Indicates whether or not a lot of read-back operations are planned
     * @param {boolean} [attributes.antiAlias=false] - Whether to enable anti-aliasing, use false (default) for a pixelated effect.
     */
    constructor(width: number, height: number, attributes?: {
        context?: boolean | undefined;
        offscreenCanvas?: boolean | undefined;
        willReadFrequently?: boolean | undefined;
        antiAlias?: boolean | undefined;
    });
    /**
     * the canvas created for this CanvasTexture
     * @type {HTMLCanvasElement|OffscreenCanvas}
     */
    canvas: HTMLCanvasElement | OffscreenCanvas;
    /**
     * the rendering context of this CanvasTexture
     * @type {CanvasRenderingContext2D}
     */
    context: CanvasRenderingContext2D;
    /**
     * @ignore
     */
    onResetEvent(width: any, height: any): void;
    /**
     * Clears the content of the canvas texture
     */
    clear(): void;
    /**
     * enable/disable image smoothing (scaling interpolation)
     * @param {boolean} [enable=false] - whether to enable or not image smoothing (scaling interpolation)
     */
    setAntiAlias(enable?: boolean | undefined): void;
    /**
     * Resizes the canvas texture to the given width and height.
     * @param {number} width - the desired width
     * @param {number} height - the desired height
     */
    resize(width: number, height: number): void;
    /**
     * Returns an ImageData object representing the underlying pixel data for a specified portion of this canvas texture.
     * (Note: when using getImageData(), it is highly recommended to use the `willReadFrequently` attribute when creatimg the corresponding canvas texture)
     * @param {number} x - The x-axis coordinate of the top-left corner of the rectangle from which the ImageData will be extracted
     * @param {number} y - The y-axis coordinate of the top-left corner of the rectangle from which the ImageData will be extracted
     * @param {number} width - The width of the rectangle from which the ImageData will be extracted. Positive values are to the right, and negative to the left
     * @param {number} height - The height of the rectangle from which the ImageData will be extracted. Positive values are down, and negative are up
     * @returns {ImageData} The ImageData extracted from this CanvasTexture.
     */
    getImageData(x: number, y: number, width: number, height: number): ImageData;
    /**
     * creates a Blob object representing the image contained in this canvas texture
     * @param {object} [options] - An object with the following properties:
     * @param {string} [options.type="image/png"] - A string indicating the image format
     * @param {number} [options.quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a Blob object representing the image contained in this canvas texture
     * @example
     * canvasTexture.convertToBlob().then((blob) => console.log(blob));
     */
    toBlob(options?: {
        type?: string | undefined;
        quality?: number | undefined;
    } | undefined): Promise<any>;
    /**
     * creates an ImageBitmap object from the most recently rendered image of this canvas texture
     * @param {object} [options] - An object with the following properties:
     * @param {string} [options.type="image/png"] - A string indicating the image format
     * @param {number} [options.quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning an ImageBitmap.
     * @example
     * canvasTexture.transferToImageBitmap().then((bitmap) => console.log(bitmap));
     */
    toImageBitmap(options?: {
        type?: string | undefined;
        quality?: number | undefined;
    } | undefined): Promise<any>;
    /**
     * returns a data URL containing a representation of the most recently rendered image of this canvas texture
     * (not supported by OffscreenCanvas)
     * @param {object} [options] - An object with the following properties:
     * @param {string} [options.type="image/png"] - A string indicating the image format
     * @param {number} [options.quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a string containing the requested data URL.
     * @example
     * renderer.toDataURL().then((dataURL) => console.log(dataURL));
     */
    toDataURL(options?: {
        type?: string | undefined;
        quality?: number | undefined;
    } | undefined): Promise<any>;
    /**
     * invalidate the current CanvasTexture, and force a reupload of the corresponding texture
     * (call this if you modify the canvas content between two draw calls)
     * @param {CanvasRenderer|WebGLRenderer} renderer - the renderer to which this canvas texture is attached
     */
    invalidate(renderer: CanvasRenderer | WebGLRenderer): void;
    glTextureUnit: any;
    /**
     * @ignore
     */
    destroy(): void;
    public set width(arg: number);
    /**
     * The width of this canvas texture in pixels
     * @public
     * @type {number}
     */
    public get width(): number;
    public set height(arg: number);
    /**
     * The height of this canvas texture in pixels
     * @public
     * @type {number}
     */
    public get height(): number;
}
