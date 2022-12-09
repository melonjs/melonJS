/**
 * @classdesc
 * a Matrix2d Object.<br>
 * the identity matrix and parameters position : <br>
 * <img src="images/identity-matrix_2x.png"/>
 */
export default class Matrix2d {
    /**
     * @param {(Matrix2d|Matrix3d|...number)} args - an instance of me.Matrix2d or me.Matrix3d to copy from, or individual matrix components (See {@link Matrix2d.setTransform}). If not arguments are given, the matrix will be set to Identity.
     */
    constructor(...args: any[]);
    /**
     * @ignore
     */
    onResetEvent(...args: any[]): Matrix2d;
    val: Float32Array | undefined;
    /**
     * tx component of the matrix
     * @public
     * @type {number}
     * @see Matrix2d.translate
     * @name tx
     * @memberof Matrix2d
     */
    public get tx(): number;
    /**
     * ty component of the matrix
     * @public
     * @type {number}
     * @see Matrix2d.translate
     * @name ty
     * @memberof Matrix2d
     */
    public get ty(): number;
    /**
     * reset the transformation matrix to the identity matrix (no transformation).<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @name identity
     * @memberof Matrix2d
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    identity(): Matrix2d;
    /**
     * set the matrix to the specified value
     * @name setTransform
     * @memberof Matrix2d
     * @param {number} a
     * @param {number} b
     * @param {number} c
     * @param {number} d
     * @param {number} e
     * @param {number} f
     * @param {number} [g=0]
     * @param {number} [h=0]
     * @param {number} [i=1]
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    setTransform(...args: any[]): Matrix2d;
    /**
     * Copies over the values from another me.Matrix2d.
     * @name copy
     * @memberof Matrix2d
     * @param {Matrix2d} m - the matrix object to copy from
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    copy(m: Matrix2d): Matrix2d;
    /**
     * Copies over the upper-left 3x3 values from the given me.Matrix3d
     * @name fromMat3d
     * @memberof Matrix2d
     * @param {Matrix3d} m - the matrix object to copy from
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    fromMat3d(m: Matrix3d): Matrix2d;
    /**
     * multiply both matrix
     * @name multiply
     * @memberof Matrix2d
     * @param {Matrix2d} m - the other matrix
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    multiply(m: Matrix2d): Matrix2d;
    /**
     * Transpose the value of this matrix.
     * @name transpose
     * @memberof Matrix2d
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    transpose(): Matrix2d;
    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @name invert
     * @memberof Matrix2d
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    invert(): Matrix2d;
    /**
     * apply the current transform to the given 2d or 3d vector
     * @name apply
     * @memberof Matrix2d
     * @param {Vector2d|Vector3d} v - the vector object to be transformed
     * @returns {Vector2d|Vector3d} result vector object.
     */
    apply(v: Vector2d | Vector3d): Vector2d | Vector3d;
    /**
     * apply the inverted current transform to the given 2d vector
     * @name applyInverse
     * @memberof Matrix2d
     * @param {Vector2d} v - the vector object to be transformed
     * @returns {Vector2d} result vector object.
     */
    applyInverse(v: Vector2d): Vector2d;
    /**
     * scale the matrix
     * @name scale
     * @memberof Matrix2d
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Matrix2d;
    /**
     * adds a 2D scaling transformation.
     * @name scaleV
     * @memberof Matrix2d
     * @param {Vector2d} v - scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Matrix2d;
    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @name scaleX
     * @memberof Matrix2d
     * @param {number} x - x scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleX(x: number): Matrix2d;
    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @name scaleY
     * @memberof Matrix2d
     * @param {number} y - y scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleY(y: number): Matrix2d;
    /**
     * rotate the matrix (counter-clockwise) by the specified angle (in radians).
     * @name rotate
     * @memberof Matrix2d
     * @param {number} angle - Rotation angle in radians.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    rotate(angle: number): Matrix2d;
    /**
     * translate the matrix position on the horizontal and vertical axis
     * @name translate
     * @memberof Matrix2d
     * @method
     * @param {number} x - the x coordindates to translate the matrix by
     * @param {number} y - the y coordindates to translate the matrix by
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    /**
     * translate the matrix by a vector on the horizontal and vertical axis
     * @name translateV
     * @memberof Matrix2d
     * @param {Vector2d} v - the vector to translate the matrix by
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    translate(...args: any[]): Matrix2d;
    /**
     * returns true if the matrix is an identity matrix.
     * @name isIdentity
     * @memberof Matrix2d
     * @returns {boolean}
     */
    isIdentity(): boolean;
    /**
     * return true if the two matrices are identical
     * @name equals
     * @memberof Matrix2d
     * @param {Matrix2d} m - the other matrix
     * @returns {boolean} true if both are equals
     */
    equals(m: Matrix2d): boolean;
    /**
     * Clone the Matrix
     * @name clone
     * @memberof Matrix2d
     * @returns {Matrix2d}
     */
    clone(): Matrix2d;
    /**
     * return an array representation of this Matrix
     * @name toArray
     * @memberof Matrix2d
     * @returns {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * convert the object to a string representation
     * @name toString
     * @memberof Matrix2d
     * @returns {string}
     */
    toString(): string;
}
import Matrix3d from "./matrix3.js";
