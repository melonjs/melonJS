/**
 * additional import for TypeScript
 * @import Matrix3d from "./matrix3.js";
 * @import Vector2d from "./vector2.js";
 * @import Vector3d from "./vector3.js";
 */
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
    onResetEvent(...args: any[]): void;
    val: Float32Array | undefined;
    /**
     * tx component of the matrix
     * @type {number}
     * @see Matrix2d.translate
     */
    get tx(): number;
    /**
     * ty component of the matrix
     * @type {number}
     * @see Matrix2d.translate
     */
    get ty(): number;
    /**
     * reset the transformation matrix to the identity matrix (no transformation).<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    identity(): Matrix2d;
    /**
     * set the matrix to the specified value
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
     * Multiplies the current transformation with the matrix described by the arguments of this method
     * @param {number} a
     * @param {number} b
     * @param {number} c
     * @param {number} d
     * @param {number} e
     * @param {number} f
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    transform(a: number, b: number, c: number, d: number, e: number, f: number): Matrix2d;
    /**
     * Copies over the values from another me.Matrix2d.
     * @param {Matrix2d} m - the matrix object to copy from
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    copy(m: Matrix2d): Matrix2d;
    /**
     * Copies over the upper-left 3x3 values from the given me.Matrix3d
     * @param {Matrix3d} m - the matrix object to copy from
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    fromMat3d(m: Matrix3d): Matrix2d;
    /**
     * multiply both matrix
     * @param {Matrix2d} m - the other matrix
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    multiply(m: Matrix2d): Matrix2d;
    /**
     * Transpose the value of this matrix.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    transpose(): Matrix2d;
    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    invert(): Matrix2d;
    /**
    * apply the current transform to the given 2d or 3d vector
    * @param {Vector2d|Vector3d} v - the vector object to be transformed
    * @returns {Vector2d|Vector3d} result vector object.
    */
    apply(v: Vector2d | Vector3d): Vector2d | Vector3d;
    /**
     * apply the inverted current transform to the given 2d vector
     * @param {Vector2d} v - the vector object to be transformed
     * @returns {Vector2d} result vector object.
     */
    applyInverse(v: Vector2d): Vector2d;
    /**
     * scale the matrix
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined): Matrix2d;
    /**
     * adds a 2D scaling transformation.
     * @param {Vector2d} v - scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleV(v: Vector2d): Matrix2d;
    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @param {number} x - x scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleX(x: number): Matrix2d;
    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @param {number} y - y scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleY(y: number): Matrix2d;
    /**
     * rotate the matrix (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - Rotation angle in radians.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    rotate(angle: number): Matrix2d;
    /**
     * translate the matrix position on the horizontal and vertical axis
     * @param {number|Vector2d} x - the x coordindates or a vector to translate the matrix by
     * @param {number} [y] - the y coordindates to translate the matrix by
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    translate(...args: any[]): Matrix2d;
    /**
     * returns true if the matrix is an identity matrix.
     * @returns {boolean}
     */
    isIdentity(): boolean;
    /**
     * return true if the two matrices are identical
     * @param {Matrix2d} m - the other matrix
     * @returns {boolean} true if both are equals
     */
    equals(m: Matrix2d): boolean;
    /**
     * Clone the Matrix
     * @returns {Matrix2d}
     */
    clone(): Matrix2d;
    /**
     * return an array representation of this Matrix
     * @returns {Float32Array}
     */
    toArray(): Float32Array;
    /**
     * convert the object to a string representation
     * @returns {string}
     */
    toString(): string;
}
import type Matrix3d from "./matrix3.js";
import type Vector2d from "./vector2.js";
import type Vector3d from "./vector3.js";
