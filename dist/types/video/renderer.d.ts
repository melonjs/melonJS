/**
 * @classdesc
 * a base renderer object
 */
export default class Renderer {
    /**
     * @param {object} options - The renderer parameters
     * @param {number} options.width - The width of the canvas without scaling
     * @param {number} options.height - The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] - The html canvas to draw to on screen
     * @param {boolean} [options.antiAlias=false] - Whether to enable anti-aliasing, use false (default) for a pixelated effect.
     * @param {boolean} [options.failIfMajorPerformanceCaveat=true] - If true, the renderer will switch to CANVAS mode if the performances of a WebGL context would be dramatically lower than that of a native application making equivalent OpenGL calls.
     * @param {boolean} [options.transparent=false] - Whether to enable transparency on the canvas
     * @param {boolean} [options.premultipliedAlpha=true] - in WebGL, whether the renderer will assume that colors have premultiplied alpha when canvas transparency is enabled
     * @param {boolean} [options.blendMode="normal"] - the default blend mode to use ("normal", "multiply")
     * @param {boolean} [options.subPixel=false] - Whether to enable subpixel rendering (performance hit when enabled)
     * @param {boolean} [options.verbose=false] - Enable the verbose mode that provides additional details as to what the renderer is doing
     * @param {number} [options.zoomX=width] - The actual width of the canvas with scaling applied
     * @param {number} [options.zoomY=height] - The actual height of the canvas with scaling applied
     */
    constructor(options: {
        width: number;
        height: number;
        canvas?: HTMLCanvasElement | undefined;
        antiAlias?: boolean | undefined;
        failIfMajorPerformanceCaveat?: boolean | undefined;
        transparent?: boolean | undefined;
        premultipliedAlpha?: boolean | undefined;
        blendMode?: boolean | undefined;
        subPixel?: boolean | undefined;
        verbose?: boolean | undefined;
        zoomX?: number | undefined;
        zoomY?: number | undefined;
    });
    /**
     * The given constructor options
     * @public
     * @type {object}
     */
    public settings: object;
    /**
     * the requested video size ratio
     * @public
     * @type {Number}
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
    canvas: any;
    currentColor: Color;
    currentTint: Color;
    projectionMatrix: Matrix3d;
    uvOffset: number;
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
     * return a reference to the canvas which this renderer draws to
     * @returns {HTMLCanvasElement}
     */
    getCanvas(): HTMLCanvasElement;
    /**
     * return a reference to this renderer canvas corresponding Context
     * @returns {CanvasRenderingContext2D|WebGLRenderingContext}
     */
    getContext(): CanvasRenderingContext2D | WebGLRenderingContext;
    /**
     * returns the current blend mode for this renderer
     * @returns {string} blend mode
     */
    getBlendMode(): string;
    /**
     * Returns the 2D Context object of the given Canvas<br>
     * Also configures anti-aliasing and blend modes based on constructor options.
     * @param {HTMLCanvasElement} canvas
     * @param {boolean} [transparent=true] - use false to disable transparency
     * @returns {CanvasRenderingContext2D}
     */
    getContext2d(canvas: HTMLCanvasElement, transparent?: boolean | undefined): CanvasRenderingContext2D;
    /**
     * return the width of the system Canvas
     * @returns {number}
     */
    getWidth(): number;
    /**
     * return the height of the system Canvas
     * @returns {number} height of the system Canvas
     */
    getHeight(): number;
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
     * enable/disable image smoothing (scaling interpolation) for the given context
     * @param {CanvasRenderingContext2D} context
     * @param {boolean} [enable=false]
     */
    setAntiAlias(context: CanvasRenderingContext2D, enable?: boolean | undefined): void;
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
     * @returns {HTMLCanvasElement|OffscreenCanvas} a new canvas element representing the tinted image
     */
    tint(src: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas, color: Color | string, mode?: string | undefined): HTMLCanvasElement | OffscreenCanvas;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
     * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
     */
    setMask(mask?: Rect | Polygon | Ellipse | RoundRect | Line | undefined): void;
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
     * @ignore
     */
    drawFont(): void;
}
import Vector2d from "../math/vector2.js";
import Path2D from "./../geometries/path2d.js";
import Color from "./../math/color.js";
import Matrix3d from "./../math/matrix3.js";
import Rect from "./../geometries/rectangle.js";
import Bounds from "./../physics/bounds.js";
import RoundRect from "./../geometries/roundrect.js";
import Polygon from "./../geometries/poly.js";
import Line from "./../geometries/line.js";
import Ellipse from "./../geometries/ellipse.js";
