/**
 * @classdesc
 * a bound object contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
 */
export default class Bounds {
    /**
     * @param {Vector2d[]} [vertices] - an array of me.Vector2d points
     */
    constructor(vertices?: Vector2d[] | undefined);
    _center: Vector2d;
    /**
     * @ignore
     */
    onResetEvent(vertices: any): void;
    min: {
        x: number;
        y: number;
    } | undefined;
    max: {
        x: number;
        y: number;
    } | undefined;
    /**
     * reset the bound
     * @name clear
     * @memberof Bounds
     */
    clear(): void;
    /**
     * sets the bounds to the given min and max value
     * @name setMinMax
     * @memberof Bounds
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     */
    setMinMax(minX: number, minY: number, maxX: number, maxY: number): void;
    public set x(arg: number);
    /**
     * x position of the bound
     * @public
     * @type {number}
     * @name x
     * @memberof Bounds
     */
    public get x(): number;
    public set y(arg: number);
    /**
     * y position of the bounds
     * @public
     * @type {number}
     * @name y
     * @memberof Bounds
     */
    public get y(): number;
    public set width(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberof Bounds
     */
    public get width(): number;
    public set height(arg: number);
    /**
     * width of the bounds
     * @public
     * @type {number}
     * @name width
     * @memberof Bounds
     */
    public get height(): number;
    /**
     * left coordinate of the bound
     * @public
     * @type {number}
     * @name left
     * @memberof Bounds
     */
    public get left(): number;
    /**
     * right coordinate of the bound
     * @public
     * @type {number}
     * @name right
     * @memberof Bounds
     */
    public get right(): number;
    /**
     * top coordinate of the bound
     * @public
     * @type {number}
     * @name top
     * @memberof Bounds
     */
    public get top(): number;
    /**
     * bottom coordinate of the bound
     * @public
     * @type {number}
     * @name bottom
     * @memberof Bounds
     */
    public get bottom(): number;
    /**
     * center position of the bound on the x axis
     * @public
     * @type {number}
     * @name centerX
     * @memberof Bounds
     */
    public get centerX(): number;
    /**
     * center position of the bound on the y axis
     * @public
     * @type {number}
     * @name centerY
     * @memberof Bounds
     */
    public get centerY(): number;
    /**
     * return the center position of the bound
     * @public
     * @type {Vector2d}
     * @name center
     * @memberof Bounds
     */
    public get center(): Vector2d;
    /**
     * Updates bounds using the given vertices
     * @name update
     * @memberof Bounds
     * @param {Vector2d[]} vertices - an array of me.Vector2d points
     */
    update(vertices: Vector2d[]): void;
    /**
     * add the given vertices to the bounds definition.
     * @name add
     * @memberof Bounds
     * @param {Vector2d[]} vertices - an array of me.Vector2d points
     * @param {boolean} [clear=false] - either to reset the bounds before adding the new vertices
     */
    add(vertices: Vector2d[], clear?: boolean | undefined): void;
    /**
     * add the given bounds to the bounds definition.
     * @name addBounds
     * @memberof Bounds
     * @param {Bounds} bounds
     * @param {boolean} [clear=false] - either to reset the bounds before adding the new vertices
     */
    addBounds(bounds: Bounds, clear?: boolean | undefined): void;
    /**
     * add the given point to the bounds definition.
     * @name addPoint
     * @memberof Bounds
     * @param {Vector2d|Point} point - the point to be added to the bounds
     * @param {Matrix2d} [m] - an optional transform to apply to the given point (only if the given point is a vector)
     */
    addPoint(point: Vector2d | Point, m?: any): void;
    /**
     * add the given quad coordinates to this bound definition, multiplied by the given matrix
     * @name addFrame
     * @memberof Bounds
     * @param {number} x0 - left X coordinates of the quad
     * @param {number} y0 - top Y coordinates of the quad
     * @param {number} x1 - right X coordinates of the quad
     * @param {number} y1 - bottom y coordinates of the quad
     * @param {Matrix2d} [m] - an optional transform to apply to the given frame coordinates
     */
    addFrame(x0: number, y0: number, x1: number, y1: number, m?: any): void;
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberof Bounds
     * @method
     * @param {Vector2d} point
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    /**
     * Returns true if the bounds contains the given point.
     * @name contains
     * @memberof Bounds
     * @param {number} x
     * @param {number} y
     * @returns {boolean} True if the bounds contain the point, otherwise false
     */
    contains(...args: any[]): boolean;
    /**
     * Returns true if the two bounds intersect.
     * @name overlaps
     * @memberof Bounds
     * @param {Bounds|Rect} bounds
     * @returns {boolean} True if the bounds overlap, otherwise false
     */
    overlaps(bounds: Bounds | Rect): boolean;
    /**
     * determines whether all coordinates of this bounds are finite numbers.
     * @name isFinite
     * @memberof Bounds
     * @returns {boolean} false if all coordinates are positive or negative Infinity or NaN; otherwise, true.
     */
    isFinite(): boolean;
    /**
     * Translates the bounds by the given vector.
     * @name translate
     * @memberof Bounds
     * @method
     * @param {Vector2d} vector
     */
    /**
     * Translates the bounds by x on the x axis, and y on the y axis
     * @name translate
     * @memberof Bounds
     * @param {number} x
     * @param {number} y
     */
    translate(...args: any[]): void;
    /**
     * Shifts the bounds to the given position vector.
     * @name shift
     * @memberof Bounds
     * @method
     * @param {Vector2d} position
     */
    /**
     * Shifts the bounds to the given x, y position.
     * @name shift
     * @memberof Bounds
     * @param {number} x
     * @param {number} y
     */
    shift(...args: any[]): void;
    /**
     * clone this bounds
     * @name clone
     * @memberof Bounds
     * @returns {Bounds}
     */
    clone(): Bounds;
    /**
     * Returns a polygon whose edges are the same as this bounds.
     * @name toPolygon
     * @memberof Bounds
     * @returns {Polygon} a new Polygon that represents this bounds.
     */
    toPolygon(): Polygon;
}
import Vector2d from "./../math/vector2.js";
