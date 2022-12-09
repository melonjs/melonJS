/**
 * @classdesc
 * an ellipse Object
 */
export default class Ellipse {
    /**
     * @param {number} x - the center x coordinate of the ellipse
     * @param {number} y - the center y coordinate of the ellipse
     * @param {number} w - width (diameter) of the ellipse
     * @param {number} h - height (diameter) of the ellipse
     */
    constructor(x: number, y: number, w: number, h: number);
    /**
     * the center coordinates of the ellipse
     * @public
     * @type {Vector2d}
     * @name pos
     * @memberof Ellipse
     */
    public pos: Vector2d;
    /**
     * The bounding rectangle for this shape
     * @private
     */
    private _bounds;
    /**
     * Maximum radius of the ellipse
     * @public
     * @type {number}
     * @name radius
     * @memberof Ellipse
     */
    public radius: number;
    /**
     * Pre-scaled radius vector for ellipse
     * @public
     * @type {Vector2d}
     * @name radiusV
     * @memberof Ellipse
     */
    public radiusV: Vector2d;
    /**
     * Radius squared, for pythagorean theorom
     * @public
     * @type {Vector2d}
     * @name radiusSq
     * @memberof Ellipse
     */
    public radiusSq: Vector2d;
    /**
     * x/y scaling ratio for ellipse
     * @public
     * @type {Vector2d}
     * @name ratio
     * @memberof Ellipse
     */
    public ratio: Vector2d;
    shapeType: string;
    /** @ignore */
    onResetEvent(x: any, y: any, w: any, h: any): void;
    /**
     * set new value to the Ellipse shape
     * @name setShape
     * @memberof Ellipse
     * @param {number} x - the center x coordinate of the ellipse
     * @param {number} y - the center y coordinate of the ellipse
     * @param {number} w - width (diameter) of the ellipse
     * @param {number} h - height (diameter) of the ellipse
     * @returns {Ellipse} this instance for objecf chaining
     */
    setShape(x: number, y: number, w: number, h: number): Ellipse;
    /**
     * Rotate this Ellipse (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof Ellipse
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v] - an optional point to rotate around
     * @returns {Ellipse} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d): Ellipse;
    /**
     * Scale this Ellipse by the specified scalar.
     * @name scale
     * @memberof Ellipse
     * @param {number} x
     * @param {number} [y=x]
     * @returns {Ellipse} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Ellipse;
    /**
     * Scale this Ellipse by the specified vector.
     * @name scale
     * @memberof Ellipse
     * @param {Vector2d} v
     * @returns {Ellipse} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Ellipse;
    /**
     * apply the given transformation matrix to this ellipse
     * @name transform
     * @memberof Ellipse
     * @param {Matrix2d} matrix - the transformation matrix
     * @returns {Polygon} Reference to this object for method chaining
     */
    transform(matrix: Matrix2d): Polygon;
    /**
     * translate the circle/ellipse by the specified offset
     * @name translate
     * @memberof Ellipse
     * @method
     * @param {number} x - x offset
     * @param {number} y - y offset
     * @returns {Ellipse} this ellipse
     */
    /**
     * translate the circle/ellipse by the specified vector
     * @name translate
     * @memberof Ellipse
     * @param {Vector2d} v - vector offset
     * @returns {Ellipse} this ellipse
     */
    translate(...args: any[]): Ellipse;
    /**
     * check if this circle/ellipse contains the specified point
     * @name contains
     * @method
     * @memberof Ellipse
     * @param {Vector2d} point
     * @returns {boolean} true if contains
     */
    /**
     * check if this circle/ellipse contains the specified point
     * @name contains
     * @memberof Ellipse
     * @param  {number} x -  x coordinate
     * @param  {number} y -  y coordinate
     * @returns {boolean} true if contains
     */
    contains(...args: any[]): boolean;
    /**
     * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
     * @name getBounds
     * @memberof Ellipse
     * @returns {Bounds} this shape bounding box Rectangle object
     */
    getBounds(): Bounds;
    /**
     * clone this Ellipse
     * @name clone
     * @memberof Ellipse
     * @returns {Ellipse} new Ellipse
     */
    clone(): Ellipse;
}
