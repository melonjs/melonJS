/**
 * additional import for TypeScript
 * @import Rect from "./../../geometries/rectangle.js";
 * @import RoundRect from "./../../geometries/roundrect.js";
 * @import Polygon from "./../../geometries/poly.js";
 * @import Line from "./../../geometries/line.js";
 * @import Ellipse from "./../../geometries/ellipse.js";
 * @import Matrix2d from "./../../math/matrix2.js";
 */
/**
 * @classdesc
 * a canvas renderer object
 * @augments Renderer
 */
export default class CanvasRenderer extends Renderer {
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
     * starts a new path by emptying the list of sub-paths. Call this method when you want to create a new path
     * @example
     * // First path
     * renderer.beginPath();
     * renderer.setColor("blue");
     * renderer.moveTo(20, 20);
     * renderer.lineTo(200, 20);
     * renderer.stroke();
     * // Second path
     * renderer.beginPath();
     * renderer.setColor("green");
     * renderer.moveTo(20, 20);
     * renderer.lineTo(120, 120);
     * renderer.stroke();
     */
    beginPath(): void;
    /**
     * begins a new sub-path at the point specified by the given (x, y) coordinates.
     * @param {number} x - The x axis of the point.
     * @param {number} y - The y axis of the point.
     */
    moveTo(x: number, y: number): void;
    /**
     * adds a straight line to the current sub-path by connecting the sub-path's last point to the specified (x, y) coordinates.
     */
    lineTo(x: any, y: any): void;
    /**
     * creates a rectangular path whose starting point is at (x, y) and whose size is specified by width and height.
     * @param {number} x - The x axis of the coordinate for the rectangle starting point.
     * @param {number} y - The y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     */
    rect(x: number, y: number, width: number, height: number): void;
    /**
     * adds a rounded rectangle to the current path.
     * @param {number} x - The x axis of the coordinate for the rectangle starting point.
     * @param {number} y - The y axis of the coordinate for the rectangle starting point.
     * @param {number} width - The rectangle's width.
     * @param {number} height - The rectangle's height.
     * @param {number} radius - The corner radius.
     */
    roundRect(x: number, y: number, width: number, height: number, radii: any): void;
    /**
     * stroke the given shape or the current defined path
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [shape] - a shape object to stroke
     * @param {boolean} [fill=false] - fill the shape with the current color if true
     */
    stroke(shape?: Rect | Polygon | Line | Ellipse | RoundRect | undefined, fill?: boolean | undefined): void;
    /**
     * fill the given shape or the current defined path
     * @param {Rect|RoundRect|Polygon|Line|Ellipse} [shape] - a shape object to fill
     */
    fill(shape?: Rect | Polygon | Line | Ellipse | RoundRect | undefined): void;
    /**
     * add a straight line from the current point to the start of the current sub-path. If the shape has already been closed or has only one point, this function does nothing
    */
    closePath(): void;
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
     * restores the most recently saved renderer state by popping the top entry in the drawing state stack
     * @example
     * // Save the current state
     * renderer.save();
     *
     * // apply a transform and draw a rect
     * renderer.tranform(matrix);
     * renderer.fillRect(10, 10, 100, 100);
     *
     * // Restore to the state saved by the most recent call to save()
     * renderer.restore();
     */
    restore(): void;
    /**
     * saves the entire state of the renderer by pushing the current state onto a stack.
     * @example
     * // Save the current state
     * renderer.save();
     *
     * // apply a transform and draw a rect
     * renderer.tranform(matrix);
     * renderer.fillRect(10, 10, 100, 100);
     *
     * // Restore to the state saved by the most recent call to save()
     * renderer.restore();
     */
    save(): void;
    /**
     * adds a rotation to the transformation matrix.
     * @param {number} angle - the rotation angle, clockwise in radians
     * @example
     * // Rotated rectangle
     * renderer.rotate((45 * Math.PI) / 180);
     * renderer.setColor("red");
     * renderer.fillRect(10, 10, 100, 100);
     *
     * // Reset transformation matrix to the identity matrix
     * renderer.setTransform(1, 0, 0, 1, 0, 0);
     */
    rotate(angle: number): void;
    /**
     * adds a scaling transformation to the renderer units horizontally and/or vertically
     * @param {number} x - Scaling factor in the horizontal direction. A negative value flips pixels across the vertical axis. A value of 1 results in no horizontal scaling.
     * @param {number} y - Scaling factor in the vertical direction. A negative value flips pixels across the horizontal axis. A value of 1 results in no vertical scaling
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
     * @ignore
     */
    set lineWidth(value: number);
    /**
     * sets or returns the thickness of lines for shape drawing
     * @type {number}
     * @default 1
     */
    get lineWidth(): number;
    /**
     * @ignore
     */
    set lineJoin(value: string);
    /**
     * sets or returns the shape used to join two line segments where they meet.
     * There are three possible values for this property: "round", "bevel", and "miter"
     * @type {string}
     * @default "miter"
     */
    get lineJoin(): string;
    /**
     * Reset (overrides) the renderer transformation matrix to the
     * identity one, and then apply the given transformation matrix.
     * @param {Matrix2d|number} a - a matrix2d to transform by, or a the a component to multiply the current matrix by
     * @param {number} b - the b component to multiply the current matrix by
     * @param {number} c - the c component to multiply the current matrix by
     * @param {number} d - the d component to multiply the current matrix by
     * @param {number} e - the e component to multiply the current matrix by
     * @param {number} f - the f component to multiply the current matrix by
     */
    setTransform(a: Matrix2d | number, b: number, c: number, d: number, e: number, f: number): void;
    /**
     * Multiply given matrix into the renderer tranformation matrix
     * @see {@link CanvasRenderer.setTransform} which will reset the current transform matrix prior to performing the new transformation
     * @param {Matrix2d|number} a - a matrix2d to transform by, or a the a component to multiply the current matrix by
     * @param {number} b - the b component to multiply the current matrix by
     * @param {number} c - the c component to multiply the current matrix by
     * @param {number} d - the d component to multiply the current matrix by
     * @param {number} e - the e component to multiply the current matrix by
     * @param {number} f - the f component to multiply the current matrix by
     */
    transform(a: Matrix2d | number, b: number, c: number, d: number, e: number, f: number): void;
    /**
     * adds a translation transformation to the current matrix.
     * @param {number} x - Distance to move in the horizontal direction. Positive values are to the right, and negative to the left.
     * @param {number} y - Distance to move in the vertical direction. Positive values are down, and negative are up.
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
}
import Renderer from "./../renderer.js";
import TextureCache from "./../texture/cache.js";
import Color from "./../../math/color.js";
import type Rect from "./../../geometries/rectangle.js";
import type Polygon from "./../../geometries/poly.js";
import type Line from "./../../geometries/line.js";
import type Ellipse from "./../../geometries/ellipse.js";
import type RoundRect from "./../../geometries/roundrect.js";
import type Matrix2d from "./../../math/matrix2.js";
