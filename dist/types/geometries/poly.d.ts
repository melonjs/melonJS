/**
 * additional import for TypeScript
 * @import Vector2d from "./../math/vector2.js";
 * @import ObservableVector2d from "./../math/observable_vector2.js";
 * @import Matrix2d from "./../math/matrix2.js";
 * @import Bounds from "./../physics/bounds.js";
 */
/**
 * @classdesc
 * a polygon Object.<br>
 * Please do note that melonJS implements a simple Axis-Aligned Boxes collision algorithm, which requires all polygons used for collision to be convex with all vertices defined with clockwise winding.
 * A polygon is convex when all line segments connecting two points in the interior do not cross any edge of the polygon
 * (which means that all angles are less than 180 degrees), as described here below : <br>
 * <center><img src="images/convex_polygon.png"/></center><br>
 * A polygon's `winding` is clockwise if its vertices (points) are declared turning to the right. The image above shows COUNTERCLOCKWISE winding.
 */
export default class Polygon {
    /**
     * @param {number} [x=0] - origin point of the Polygon
     * @param {number} [y=0] - origin point of the Polygon
     * @param {Vector2d[]} points - array of vector defining the Polygon
     */
    constructor(x?: number | undefined, y?: number | undefined, points: Vector2d[]);
    /**
     * origin point of the Polygon
     * @type {Vector2d}
     */
    pos: Vector2d;
    /**
     * Array of points defining the Polygon <br>
     * Note: If you manually change `points`, you **must** call `recalc`afterwards so that the changes get applied correctly.
     * @type {Vector2d[]}
     */
    points: Vector2d[];
    /**
     * The edges here are the direction of the `n`th edge of the polygon, relative to
     * the `n`th point. If you want to draw a given edge from the edge value, you must
     * first translate to the position of the starting point.
     * @ignore
     */
    edges: any[];
    /**
     * a list of indices for all vertices composing this polygon (@see earcut)
     * @ignore
     */
    indices: any[];
    /**
     * The normals here are the direction of the normal for the `n`th edge of the polygon, relative
     * to the position of the `n`th point. If you want to draw an edge normal, you must first
     * translate to the position of the starting point.
     * @ignore
     */
    normals: any[];
    /**
     * the shape type (used internally)
     * @type {string}
     * @default "Polygon"
     */
    type: string;
    /** @ignore */
    onResetEvent(x: any, y: any, points: any): void;
    /**
     * set new value to the Polygon
     * @param {number} x - position of the Polygon
     * @param {number} y - position of the Polygon
     * @param {Vector2d[]|number[]} points - array of vector or vertice defining the Polygon
     * @returns {Polygon} this instance for objecf chaining
     */
    setShape(x: number, y: number, points: Vector2d[] | number[]): Polygon;
    /**
     * set the vertices defining this Polygon
     * @param {Vector2d[]} vertices - array of vector or vertice defining the Polygon
     * @returns {Polygon} this instance for objecf chaining
     */
    setVertices(vertices: Vector2d[]): Polygon;
    /**
     * apply the given transformation matrix to this Polygon
     * @param {Matrix2d} m - the transformation matrix
     * @returns {Polygon} Reference to this object for method chaining
     */
    transform(m: Matrix2d): Polygon;
    /**
     * apply an isometric projection to this shape
     * @returns {Polygon} Reference to this object for method chaining
     */
    toIso(): Polygon;
    /**
     * apply a 2d projection to this shapen
     * @returns {Polygon} Reference to this object for method chaining
     */
    to2d(): Polygon;
    /**
     * Rotate this Polygon (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {Polygon} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d | undefined): Polygon;
    /**
     * Scale this Polygon by the given scalar.
     * @param {number} x
     * @param {number} [y=x]
     * @returns {Polygon} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Polygon;
    /**
     * Scale this Polygon by the given vector
     * @param {Vector2d} v
     * @returns {Polygon} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Polygon;
    /**
     * Computes the calculated collision polygon.
     * This **must** be called if the `points` array, `angle`, or `offset` is modified manually.
     * @returns {Polygon} Reference to this object for method chaining
     */
    recalc(): Polygon;
    /**
     * returns a list of indices for all triangles defined in this polygon
     * @returns {Array.<number>} an array of vertex indices for all triangles forming this polygon.
     */
    getIndices(): Array<number>;
    /**
     * Returns true if the vertices composing this polygon form a convex shape (vertices must be in clockwise order).
     * @returns {boolean} true if the vertices are convex, false if not, null if not computable
     */
    isConvex(): boolean;
    /**
     * translate the Polygon by the specified offset
     * @param {number|Vector2d} x -  x offset or a vector point to translate by
     * @param {number} [y] - y offset
     * @returns {Polygon} Reference to this object for method chaining
     * @example
     * polygon.translate(10, 10);
     * // or
     * polygon.translate(myVector2d);
     */
    translate(...args: any[]): Polygon;
    /**
     * Shifts the Polygon to the given position vector.
     * @param {number|Vector2d} x -  x coordinate or a vector point to shift to
     * @param {number} [y]
     * @example
     * polygon.shift(10, 10);
     * // or
     * polygon.shift(myVector2d);
     */
    shift(...args: any[]): void;
    /**
     * Returns true if the polygon contains the given point. <br>
     * (Note: it is highly recommended to first do a hit test on the corresponding <br>
     *  bounding rect, as the function can be highly consuming with complex shapes)
     * @param {number|Vector2d} x -  x coordinate or a vector point to check
     * @param {number} [y] - y coordinate
     * @returns {boolean} True if the polygon contain the point, otherwise false
     * @example
     * if (polygon.contains(10, 10)) {
     *   // do something
     * }
     * // or
     * if (polygon.contains(myVector2d)) {
     *   // do something
     * }
     */
    contains(...args: any[]): boolean;
    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    getBounds(): Bounds;
    _bounds: object | undefined;
    /**
     * update the bounding box for this shape.
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    updateBounds(): Bounds;
    /**
     * clone this Polygon
     * @returns {Polygon} new Polygon
     */
    clone(): Polygon;
}
import type Vector2d from "./../math/vector2.js";
import type Matrix2d from "./../math/matrix2.js";
import type ObservableVector2d from "./../math/observable_vector2.js";
import type Bounds from "./../physics/bounds.js";
