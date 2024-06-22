/**
 * additional import for TypeScript
 * @import Point from "./point.js";
 */
/**
 * @classdesc
 * a simplified path2d implementation, supporting only one path
 */
export default class Path2D {
    constructor(svgPath: any);
    /**
     * the points defining the current path
     * @type {Point[]}
     */
    points: Point[];
    /**
     * space between interpolated points for quadratic and bezier curve approx. in pixels.
     * @type {number}
     * @default 5
     */
    arcResolution: number;
    vertices: any[];
    startPoint: object;
    isDirty: boolean;
    /**
     * Parses an SVG path string and adds the points to the current path.
     * @param {string} svgPath - The SVG path string to parse.
     */
    parseSVGPath(svgPath: string): void;
    /**
     * begin a new path
     */
    beginPath(): void;
    /**
     * causes the point of the pen to move back to the start of the current path.
     * It tries to draw a straight line from the current point to the start.
     * If the shape has already been closed or has only one point, this function does nothing.
     */
    closePath(): void;
    /**
     * triangulate the shape defined by this path into an array of triangles
     * @returns {Point[]} an array of vertices representing the triangulated path or shape
     */
    triangulatePath(): Point[];
    /**
     * moves the starting point of the current path to the (x, y) coordinates.
     * @param {number} x - the x-axis (horizontal) coordinate of the point.
     * @param {number} y - the y-axis (vertical) coordinate of the point.
     */
    moveTo(x: number, y: number): void;
    /**
     * connects the last point in the current path to the (x, y) coordinates with a straight line.
     * @param {number} x - the x-axis coordinate of the line's end point.
     * @param {number} y - the y-axis coordinate of the line's end point.
     */
    lineTo(x: number, y: number): void;
    /**
     * adds an arc to the current path which is centered at (x, y) position with the given radius,
     * starting at startAngle and ending at endAngle going in the given direction by counterclockwise (defaulting to clockwise).
     * @param {number} x - the horizontal coordinate of the arc's center.
     * @param {number} y - the vertical coordinate of the arc's center.
     * @param {number} radius - the arc's radius. Must be positive.
     * @param {number} startAngle - the angle at which the arc starts in radians, measured from the positive x-axis.
     * @param {number} endAngle - the angle at which the arc ends in radians, measured from the positive x-axis.
     * @param {boolean} [anticlockwise=false] - an optional boolean value. If true, draws the arc counter-clockwise between the start and end angles.
     */
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean | undefined): void;
    /**
     * adds a circular arc to the path with the given control points and radius, connected to the previous point by a straight line.
     * @param {number} x1 - the x-axis coordinate of the first control point.
     * @param {number} y1 - the y-axis coordinate of the first control point.
     * @param {number} x2 - the x-axis coordinate of the second control point.
     * @param {number} y2 - the y-axis coordinate of the second control point.
     * @param {number} radius - the arc's radius. Must be positive.
     */
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
    /**
     * adds an elliptical arc to the path which is centered at (x, y) position with the radii radiusX and radiusY
     * starting at startAngle and ending at endAngle going in the given direction by counterclockwise.
     * @param {number} x - the x-axis (horizontal) coordinate of the ellipse's center.
     * @param {number} y - the  y-axis (vertical) coordinate of the ellipse's center.
     * @param {number} radiusX - the ellipse's major-axis radius. Must be non-negative.
     * @param {number} radiusY - the ellipse's minor-axis radius. Must be non-negative.
     * @param {number} rotation - the rotation of the ellipse, expressed in radians.
     * @param {number} startAngle - the angle at which the ellipse starts, measured clockwise from the positive x-axis and expressed in radians.
     * @param {number} endAngle - the angle at which the ellipse ends, measured clockwise from the positive x-axis and expressed in radians.
     * @param {boolean} [anticlockwise=false] - an optional boolean value which, if true, draws the ellipse counterclockwise (anticlockwise).
     */
    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean | undefined): void;
    /**
     * Adds a quadratic Bézier curve to the path.
     * @param {number} cpX - The x-coordinate of the control point.
     * @param {number} cpY - The y-coordinate of the control point.
     * @param {number} x - The x-coordinate of the end point of the curve.
     * @param {number} y - The y-coordinate of the end point of the curve.
     */
    quadraticCurveTo(cpX: number, cpY: number, x: number, y: number): void;
    /**
     * Adds a cubic Bézier curve to the path.
     * @param {number} cp1X - The x-coordinate of the first control point.
     * @param {number} cp1Y - The y-coordinate of the first control point.
     * @param {number} cp2X - The x-coordinate of the second control point.
     * @param {number} cp2Y - The y-coordinate of the second control point.
     * @param {number} x - The x-coordinate of the end point of the curve.
     * @param {number} y - The y-coordinate of the end point of the curve.
     */
    bezierCurveTo(cp1X: number, cp1Y: number, cp2X: number, cp2Y: number, x: number, y: number): void;
    /**
     * creates a path for a rectangle at position (x, y) with a size that is determined by width and height.
     * @param {number} x - the x-axis coordinate of the rectangle's starting point.
     * @param {number} y - the y-axis coordinate of the rectangle's starting point.
     * @param {number} width - the rectangle's width. Positive values are to the right, and negative to the left.
     * @param {number} height - the rectangle's height. Positive values are down, and negative are up.
     */
    rect(x: number, y: number, width: number, height: number): void;
    /**
     * adds an rounded rectangle to the current path.
     * @param {number} x - the x-axis coordinate of the rectangle's starting point.
     * @param {number} y - the y-axis coordinate of the rectangle's starting point.
     * @param {number} width - the rectangle's width. Positive values are to the right, and negative to the left.
     * @param {number} height - the rectangle's height. Positive values are down, and negative are up.
     * @param {number} radius - the arc's radius to draw the borders. Must be positive.
     */
    roundRect(x: number, y: number, width: number, height: number, radius: number): void;
}
import type Point from "./point.js";
