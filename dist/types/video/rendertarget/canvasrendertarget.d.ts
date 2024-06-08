export default CanvasRenderTarget;
/**
 * CanvasRenderTarget is 2D render target which exposes a Canvas interface.
 */
declare class CanvasRenderTarget {
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
    constructor(width: number, height: number, attributes?: {
        context?: string | undefined;
        preferWebGL1?: boolean | undefined;
        transparent?: boolean | undefined;
        offscreenCanvas?: boolean | undefined;
        willReadFrequently?: boolean | undefined;
        antiAlias?: boolean | undefined;
    });
    /**
     * the canvas created for this CanvasRenderTarget
     * @type {HTMLCanvasElement|OffscreenCanvas}
     */
    canvas: HTMLCanvasElement | OffscreenCanvas;
    /**
     * the rendering context of this CanvasRenderTarget
     * @type {CanvasRenderingContext2D|WebGLRenderingContext}
     */
    context: CanvasRenderingContext2D | WebGLRenderingContext;
    attributes: {
        offscreenCanvas: boolean;
        willReadFrequently: boolean;
        antiAlias: boolean;
        context: string;
        transparent: boolean;
        premultipliedAlpha: boolean;
        stencil: boolean;
        blendMode: string;
        failIfMajorPerformanceCaveat: boolean;
        preferWebGL1: boolean;
        powerPreference: string;
    } & {
        context?: string | undefined;
        preferWebGL1?: boolean | undefined;
        transparent?: boolean | undefined;
        offscreenCanvas?: boolean | undefined;
        willReadFrequently?: boolean | undefined;
        antiAlias?: boolean | undefined;
    };
    WebGLVersion: any;
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
     * @returns {ImageData} The ImageData extracted from this CanvasRenderTarget.
     */
    getImageData(x: number, y: number, width: number, height: number): ImageData;
    /**
     * creates a Blob object representing the image contained in this canvas texture
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a Blob object representing the image contained in this canvas texture
     * @example
     * renderTarget.convertToBlob().then((blob) => console.log(blob));
     */
    toBlob(type?: string | undefined, quality?: number | undefined): Promise<any>;
    /**
     * creates an ImageBitmap object from the most recently rendered image of this canvas texture
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning an ImageBitmap.
     * @example
     * renderTarget.transferToImageBitmap().then((bitmap) => console.log(bitmap));
     */
    toImageBitmap(type?: string | undefined, quality?: number | undefined): Promise<any>;
    /**
     * returns a data URL containing a representation of the most recently rendered image of this canvas texture
     * (not supported by OffscreenCanvas)
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a string containing the requested data URL.
     * @example
     * renderer.toDataURL().then((dataURL) => console.log(dataURL));
     */
    toDataURL(type?: string | undefined, quality?: number | undefined): Promise<any>;
    /**
     * invalidate the current CanvasRenderTarget, and force a reupload of the corresponding texture
     * (call this if you modify the canvas content between two draw calls)
     * @param {CanvasRenderer|WebGLRenderer} renderer - the renderer to which this canvas texture is attached
     */
    invalidate(renderer: CanvasRenderer | WebGLRenderer): void;
    glTextureUnit: any;
    /**
     * @ignore
     */
    destroy(): void;
    public set width(val: number);
    /**
     * The width of this canvas texture in pixels
     * @public
     * @type {number}
     */
    public get width(): number;
    public set height(val: number);
    /**
     * The height of this canvas texture in pixels
     * @public
     * @type {number}
     */
    public get height(): number;
}
import type CanvasRenderer from "./../canvas/canvas_renderer.js";
import type WebGLRenderer from "./../webgl/webgl_renderer.js";
