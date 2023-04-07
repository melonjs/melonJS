/**
 * @classdesc
 * a canvas renderer object
 * @augments Renderer
 */
export default class CanvasRenderer extends Renderer {
    /**
     * @param {object} options - The renderer parameters
     * @param {number} options.width - The width of the canvas without scaling
     * @param {number} options.height - The height of the canvas without scaling
     * @param {HTMLCanvasElement} [options.canvas] - The html canvas to draw to on screen
     * @param {boolean} [options.antiAlias=false] - Whether to enable anti-aliasing
     * @param {boolean} [options.transparent=false] - Whether to enable transparency on the canvas (performance hit when enabled)
     * @param {boolean} [options.subPixel=false] - Whether to enable subpixel renderering (performance hit when enabled)
     * @param {boolean} [options.textureSeamFix=true] - enable the texture seam fix when rendering Tile when antiAlias is off for the canvasRenderer
     * @param {number} [options.zoomX=width] - The actual width of the canvas with scaling applied
     * @param {number} [options.zoomY=height] - The actual height of the canvas with scaling applied
     */
    constructor(options: {
        width: number;
        height: number;
        canvas?: HTMLCanvasElement | undefined;
        antiAlias?: boolean | undefined;
        transparent?: boolean | undefined;
        subPixel?: boolean | undefined;
        textureSeamFix?: boolean | undefined;
        zoomX?: number | undefined;
        zoomY?: number | undefined;
    });
    context: CanvasRenderingContext2D;
    cache: TextureCache;
    /**
     * Reset the canvas transform to identity
     */
    resetTransform(): void;
    /**
     * set a blend mode for the given context. <br>
     * Supported blend mode between Canvas and WebGL remderer : <br>
     * - "normal" : this is the default mode and draws new content on top of the existing content <br>
     * <img src="images/normal-blendmode.png" width="510"/> <br>
     * - "multiply" : the pixels of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result. <br>
     * <img src="images/multiply-blendmode.png" width="510"/> <br>
     * - "additive or lighter" : where both content overlap the color is determined by adding color values. <br>
     * <img src="images/lighter-blendmode.png" width="510"/> <br>
     * - "screen" : The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply) <br>
     * <img src="images/screen-blendmode.png" width="510"/> <br>
     * @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
     * @param {string} [mode="normal"] - blend mode : "normal", "multiply", "lighter, "additive", "screen"
     * @param {CanvasRenderingContext2D} [context]
     */
    setBlendMode(mode?: string | undefined, context?: CanvasRenderingContext2D | undefined): void;
    /**
     * Clears the main framebuffer with the given color
     * @param {Color|string} [color="#000000"] - CSS color.
     * @param {boolean} [opaque=false] - Allow transparency [default] or clear the surface completely [true]
     */
    clearColor(color?: string | Color | undefined, opaque?: boolean | undefined): void;
    /**
     * Erase the pixels in the given rectangular area by setting them to transparent black (rgba(0,0,0,0)).
     * @param {number} x - x axis of the coordinate for the rectangle starting point.
     * @param {number} y - y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     */
    clearRect(x: number, y: number, width: number, height: number): void;
    /**
     * Create a pattern with the specified repetition
     * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - Source image to be used as the pattern's image
     * @param {string} repeat - Define how the pattern should be repeated
     * @returns {CanvasPattern}
     * @see ImageLayer#repeat
     * @example
     * let tileable   = renderer.createPattern(image, "repeat");
     * let horizontal = renderer.createPattern(image, "repeat-x");
     * let vertical   = renderer.createPattern(image, "repeat-y");
     * let basic      = renderer.createPattern(image, "no-repeat");
     */
    createPattern(image: HTMLImageElement | SVGImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | VideoFrame, repeat: string): CanvasPattern;
    /**
     * Draw an image onto the main using the canvas api
     * @param {HTMLImageElement|SVGImageElement|HTMLVideoElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas|VideoFrame} image - An element to draw into the context.
     * @param {number} sx - The X coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sy - The Y coordinate of the top left corner of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} sw - The width of the sub-rectangle of the source image to draw into the destination context. If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used.
     * @param {number} sh - The height of the sub-rectangle of the source image to draw into the destination context.
     * @param {number} dx - The X coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dy - The Y coordinate in the destination canvas at which to place the top-left corner of the source image.
     * @param {number} dw - The width to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in width when drawn.
     * @param {number} dh - The height to draw the image in the destination canvas. This allows scaling of the drawn image. If not specified, the image is not scaled in height when drawn.
     * @example
     * // Position the image on the canvas:
     * renderer.drawImage(image, dx, dy);
     * // Position the image on the canvas, and specify width and height of the image:
     * renderer.drawImage(image, dx, dy, dWidth, dHeight);
     * // Clip the image and position the clipped part on the canvas:
     * renderer.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
     */
    drawImage(image: HTMLImageElement | SVGImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | VideoFrame, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
    /**
     * Draw a pattern within the given rectangle.
     * @param {CanvasPattern} pattern - Pattern object
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @see CanvasRenderer#createPattern
     */
    drawPattern(pattern: CanvasPattern, x: number, y: number, width: number, height: number): void;
    /**
     * Stroke an arc at the specified coordinates with given radius, start and end points
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius
     * @param {number} start - start angle in radians
     * @param {number} end - end angle in radians
     * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean | undefined, fill?: boolean | undefined): void;
    /**
     * Fill an arc at the specified coordinates with given radius, start and end points
     * @param {number} x - arc center point x-axis
     * @param {number} y - arc center point y-axis
     * @param {number} radius
     * @param {number} start - start angle in radians
     * @param {number} end - end angle in radians
     * @param {boolean} [antiClockwise=false] - draw arc anti-clockwise
     */
    fillArc(x: number, y: number, radius: number, start: number, end: number, antiClockwise?: boolean | undefined): void;
    /**
     * Stroke an ellipse at the specified coordinates with given radius
     * @param {number} x - ellipse center point x-axis
     * @param {number} y - ellipse center point y-axis
     * @param {number} w - horizontal radius of the ellipse
     * @param {number} h - vertical radius of the ellipse
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeEllipse(x: number, y: number, w: number, h: number, fill?: boolean | undefined): void;
    /**
     * Fill an ellipse at the specified coordinates with given radius
     * @param {number} x - ellipse center point x-axis
     * @param {number} y - ellipse center point y-axis
     * @param {number} w - horizontal radius of the ellipse
     * @param {number} h - vertical radius of the ellipse
     */
    fillEllipse(x: number, y: number, w: number, h: number): void;
    /**
     * Stroke a line of the given two points
     * @param {number} startX - the start x coordinate
     * @param {number} startY - the start y coordinate
     * @param {number} endX - the end x coordinate
     * @param {number} endY - the end y coordinate
     */
    strokeLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Fill a line of the given two points
     * @param {number} startX - the start x coordinate
     * @param {number} startY - the start y coordinate
     * @param {number} endX - the end x coordinate
     * @param {number} endY - the end y coordinate
     */
    fillLine(startX: number, startY: number, endX: number, endY: number): void;
    /**
     * Stroke the given me.Polygon on the screen
     * @param {Polygon} poly - the shape to draw
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokePolygon(poly: Polygon, fill?: boolean | undefined): void;
    /**
     * Fill the given me.Polygon on the screen
     * @param {Polygon} poly - the shape to draw
     */
    fillPolygon(poly: Polygon): void;
    /**
     * Stroke a rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRect(x: number, y: number, width: number, height: number, fill?: boolean | undefined): void;
    /**
     * Draw a filled rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRect(x: number, y: number, width: number, height: number): void;
    /**
     * Stroke a rounded rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     * @param {boolean} [fill=false] - also fill the shape with the current color if true
     */
    strokeRoundRect(x: number, y: number, width: number, height: number, radius: number, fill?: boolean | undefined): void;
    /**
     * Draw a rounded filled rectangle at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} radius
     */
    fillRoundRect(x: number, y: number, width: number, height: number, radius: number): void;
    /**
     * Stroke a Point at the specified coordinates
     * @param {number} x
     * @param {number} y
     */
    strokePoint(x: number, y: number): void;
    /**
     * Draw a a point at the specified coordinates
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillPoint(x: number, y: number): void;
    /**
     * save the canvas context
     */
    save(): void;
    /**
     * restores the canvas context
     */
    restore(): void;
    /**
     * rotates the canvas context
     * @param {number} angle - in radians
     */
    rotate(angle: number): void;
    /**
     * scales the canvas context
     * @param {number} x
     * @param {number} y
     */
    scale(x: number, y: number): void;
    /**
     * Set the current fill & stroke style color.
     * By default, or upon reset, the value is set to #000000.
     * @param {Color|string} color - css color value
     */
    setColor(color: Color | string): void;
    /**
     * Set the global alpha
     * @param {number} alpha - 0.0 to 1.0 values accepted.
     */
    setGlobalAlpha(alpha: number): void;
    /**
     * Return the global alpha
     * @returns {number} global alpha value
     */
    getGlobalAlpha(): number;
    /**
     * Set the line width on the context
     * @param {number} width - Line width
     */
    setLineWidth(width: number): void;
    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @param {Matrix2d} mat2d - Matrix to transform by
     */
    setTransform(mat2d: Matrix2d): void;
    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @param {Matrix2d} mat2d - Matrix to transform by
     */
    transform(mat2d: Matrix2d): void;
    /**
     * Translates the context to the given position
     * @param {number} x
     * @param {number} y
     */
    translate(x: number, y: number): void;
    /**
     * clip the given region from the original canvas. Once a region is clipped,
     * all future drawing will be limited to the clipped region.
     * You can however save the current region using the save(),
     * and restore it (with the restore() method) any time in the future.
     * (<u>this is an experimental feature !</u>)
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    clipRect(x: number, y: number, width: number, height: number): void;
    /**
     * A mask limits rendering elements to the shape and position of the given mask object.
     * So, if the renderable is larger than the mask, only the intersecting part of the renderable will be visible.
     * Mask are not preserved through renderer context save and restore.
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [mask] - the shape defining the mask to be applied
     * @param {boolean} [invert=false] - either the given shape should define what is visible (default) or the opposite
     */
    setMask(mask?: Rect | RoundRect | Polygon | Line | Ellipse, invert?: boolean | undefined): void;
}
import Renderer from "./../renderer.js";
import TextureCache from "./../texture/cache.js";
import Color from "./../../math/color.js";
import Rect from "./../../geometries/rectangle.js";
import RoundRect from "./../../geometries/roundrect.js";
import Ellipse from "./../../geometries/ellipse.js";
