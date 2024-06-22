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
    constructor(options?: any);
    /**
     * The renderer renderTarget
     * @name renderTarget
     * @type {CanvasRenderTarget}
     */
    renderTarget: CanvasRenderTarget;
    /**
     * The given constructor options
     * @public
     * @type {object}
     */
    public settings: object;
    /**
     * the requested video size ratio
     * @public
     * @type {number}
     */
    public designRatio: number;
    /**
     * the scaling ratio to be applied to the main canvas
     * @type {Vector2d}
     * @default <1,1>
     */
    scaleRatio: Vector2d;
    /**
     * true if the current rendering context is valid
     * @default true
     * @type {boolean}
     */
    isContextValid: boolean;
    /**
     * the default method to sort object ("sorting", "z-buffer")
     * @type {string}
     * @default "sorting"
     */
    depthTest: string;
    /**
     * The Path2D instance used by the renderer to draw primitives
     * @type {Path2D}
     */
    path2D: Path2D;
    /**
     * The renderer type : Canvas, WebGL, etc...
     * (override this property with a specific value when implementing a custom renderer)
     * @type {string}
     */
    type: string;
    /**
     * @ignore
     */
    currentScissor: Int32Array;
    /**
     * @ignore
     */
    maskLevel: number;
    /**
     * @ignore
     */
    currentBlendMode: string;
    currentColor: Color;
    currentTint: Color;
    projectionMatrix: Matrix3d;
    uvOffset: number;
    set height(value: number);
    /**
     * return the height of the canvas which this renderer draws to
     * @returns {number} height of the system Canvas
     */
    get height(): number;
    set width(value: number);
    /**
     * return the width of the canvas which this renderer draws to
     * @returns {number} width of the system Canvas
     */
    get width(): number;
    /**
     * prepare the framebuffer for drawing a new frame
     */
    clear(): void;
    /**
     * render the main framebuffer on screen
     */
    flush(): void;
    /**
     * Reset context state
     */
    reset(): void;
    /**
     * return a reference to the current render target corresponding canvas which this renderer draws to
     * @returns {HTMLCanvasElement}
     */
    getCanvas(): HTMLCanvasElement;
    /**
     * return a reference to the current render target corresponding Context
     * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
     */
    getContext(): CanvasRenderingContext2D | WebGLRenderingContext;
    /**
     * returns the current blend mode for this renderer
     * @returns {string} blend mode
     */
    getBlendMode(): string;
    /**
     * get the current fill & stroke style color.
     * @returns {Color} current global color
     */
    getColor(): Color;
    /**
     * return the current global alpha
     * @returns {number}
     */
    globalAlpha(): number;
    /**
     * check if the given rect or bounds overlaps with the renderer screen coordinates
     * @param {Rect|Bounds} bounds
     * @returns {boolean} true if overlaps
     */
    overlaps(bounds: Rect | Bounds): boolean;
    /**
     * resizes the system canvas
     * @param {number} width - new width of the canvas
     * @param {number} height - new height of the canvas
     */
    resize(width: number, height: number): void;
    /**
     * enable/disable image smoothing (scaling interpolation) for the current render target
     * @param {boolean} [enable=false]
     */
    setAntiAlias(enable?: boolean | undefined): void;
    /**
     * set/change the current projection matrix (WebGL only)
     * @param {Matrix3d} matrix
     */
    setProjection(matrix: Matrix3d): void;
    /**
     * stroke the given shape
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape - a shape object to stroke
     * @param {boolean} [fill=false] - fill the shape with the current color if true
     */
    stroke(shape: Rect | RoundRect | Polygon | Line | Ellipse, fill?: boolean | undefined): void;
    /**
     * fill the given shape
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} shape - a shape object to fill
     */
    fill(shape: Rect | RoundRect | Polygon | Line | Ellipse): void;
    /**
     * tint the given image or canvas using the given color
     * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} src - the source image to be tinted
     * @param {Color|string} color - the color that will be used to tint the image
     * @param {string} [mode="multiply"] - the composition mode used to tint the image
     * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas or offscreencanvas (if supported) element representing the tinted image
     */
    tint(src: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas, color: Color | string, mode?: string | undefined): HTMLCanvasElement | OffscreenCanvas;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
     * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
     */
    setMask(mask?: Rect | Polygon | Line | Ellipse | RoundRect | undefined, invert?: boolean | undefined): void;
    /**
     * disable (remove) the rendering mask set through setMask.
     * @see Renderer#setMask
     */
    clearMask(): void;
    /**
     * set a coloring tint for sprite based renderables
     * @param {Color} tint - the tint color
     * @param {number} [alpha] - an alpha value to be applied to the tint
     */
    setTint(tint: Color, alpha?: number | undefined): void;
    /**
     * clear the rendering tint set through setTint.
     * @see Renderer#setTint
     */
    clearTint(): void;
    /**
     * creates a Blob object representing the last rendered frame
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a Blob object representing the last rendered frame
     * @example
     * renderer.convertToBlob().then((blob) => console.log(blob));
     */
    toBlob(type?: string | undefined, quality?: number | undefined): Promise<any>;
    /**
     * creates an ImageBitmap object of the last frame rendered
     * (not supported by standard Canvas)
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning an ImageBitmap.
     * @example
     * renderer.transferToImageBitmap().then((image) => console.log(image));
     */
    toImageBitmap(type?: string | undefined, quality?: number | undefined): Promise<any>;
    /**
     * returns a data URL containing a representation of the last frame rendered
     * @param {string} [type="image/png"] - A string indicating the image format
     * @param {number} [quality] - A Number between 0 and 1 indicating the image quality to be used when creating images using file formats that support lossy compression (such as image/jpeg or image/webp). A user agent will use its default quality value if this option is not specified, or if the number is outside the allowed range.
     * @returns {Promise} A Promise returning a string containing the requested data URL.
     * @example
     * renderer.toDataURL().then((dataURL) => console.log(dataURL));
     */
    toDataURL(type?: string | undefined, quality?: number | undefined): Promise<any>;
}
import CanvasRenderTarget from "./rendertarget/canvasrendertarget.js";
import Vector2d from "../math/vector2.js";
import Path2D from "./../geometries/path2d.js";
import Color from "./../math/color.js";
import Matrix3d from "./../math/matrix3.js";
import type Rect from "./../geometries/rectangle.js";
import type Bounds from "./../physics/bounds.js";
import type RoundRect from "./../geometries/roundrect.js";
import type Polygon from "./../geometries/poly.js";
import type Line from "./../geometries/line.js";
import type Ellipse from "./../geometries/ellipse.js";
