/**
 * additional import for TypeScript
 * @import Matrix2d from "./matrix2.js";
 * @import Vector2d from "./vector2.js";
 * @import Vector3d from "./vector3.js";
 */
/**
 * @classdesc
 * a 4x4 Matrix3d Object
 */
export default class Matrix3d {
    /**
     * @param {(Matrix3d|...number)} args - An instance of me.Matrix3d to copy from, or individual Matrix components (See {@link Matrix3d.setTransform}). If not arguments are given, the matrix will be set to Identity.
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
     */
    get tx(): number;
    /**
     * ty component of the matrix
     * @type {number}
     */
    get ty(): number;
    /**
     * ty component of the matrix
     * @type {number}
     */
    get tz(): number;
    /**
     * reset the transformation matrix to the identity matrix (no transformation).<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    identity(): Matrix3d;
    /**
     * set the matrix to the specified value
     * @param {number} m00
     * @param {number} m01
     * @param {number} m02
     * @param {number} m03
     * @param {number} m10
     * @param {number} m11
     * @param {number} m12
     * @param {number} m13
     * @param {number} m20
     * @param {number} m21
     * @param {number} m22
     * @param {number} m23
     * @param {number} m30
     * @param {number} m31
     * @param {number} m32
     * @param {number} m33
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    setTransform(m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number): Matrix3d;
    /**
     * Copies over the values from another me.Matrix3d.
     * @param {Matrix3d} m - the matrix object to copy from
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    copy(m: Matrix3d): Matrix3d;
    /**
     * Copies over the upper-left 2x2 values from the given me.Matrix2d
     * @param {Matrix2d} m - the matrix object to copy from
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    fromMat2d(m: Matrix2d): Matrix2d;
    /**
     * multiply both matrix
     * @param {Matrix3d} m - Other matrix
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    multiply(m: Matrix3d): Matrix3d;
    /**
     * Transpose the value of this matrix.
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    transpose(): Matrix3d;
    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    invert(): Matrix3d;
    /**
     * apply the current transform to the given 2d or 3d vector
     * @param {Vector2d|Vector3d} v - the vector object to be transformed
     * @returns {Vector2d|Vector3d} result vector object.
     */
    apply(v: Vector2d | Vector3d): Vector2d | Vector3d;
    /**
      * apply the inverted current transform to the given 2d or 3d vector
      * @param {Vector2d|Vector3d} v - the vector object to be transformed
      * @returns {Vector2d|Vector3d} result vector object.
      */
    applyInverse(v: Vector2d | Vector3d): Vector2d | Vector3d;
    /**
     * generate an orthogonal projection matrix, with the result replacing the current matrix
     * <img src="images/glOrtho.gif"/><br>
     * @param {number} left - farthest left on the x-axis
     * @param {number} right - farthest right on the x-axis
     * @param {number} bottom - farthest down on the y-axis
     * @param {number} top - farthest up on the y-axis
     * @param {number} near - distance to the near clipping plane along the -Z axis
     * @param {number} far - distance to the far clipping plane along the -Z axis
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix3d;
    /**
     * scale the matrix
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @param {number} [z=0] - a number representing the depth vector
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    scale(x: number, y?: number | undefined, z?: number | undefined): Matrix3d;
    /**
     * adds a 2D scaling transformation.
     * @param {Vector2d|Vector3d} v - scaling vector
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    scaleV(v: Vector2d | Vector3d): Matrix3d;
    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @param {number} x - x scaling vector
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    scaleX(x: number): Matrix3d;
    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @param {number} y - y scaling vector
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    scaleY(y: number): Matrix3d;
    /**
     * rotate this matrix (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - Rotation angle in radians.
     * @param {Vector3d} v - the axis to rotate around
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    rotate(angle: number, v: Vector3d): Matrix3d;
    /**
     * translate the matrix position using the given vector
     * @param {number|Vector2d|Vector3d} x - a number representing the abscissa of the vector, or a vector object
     * @param {number} [y] - a number representing the ordinate of the vector.
     * @param {number} [z=0] - a number representing the depth of the vector
     * @returns {Matrix3d} Reference to this object for method chaining
     */
    translate(...args: any[]): Matrix3d;
    /**
     * returns true if the matrix is an identity matrix.
     * @returns {boolean}
     */
    isIdentity(): boolean;
    /**
     * return true if the two matrices are identical
     * @param {Matrix3d} m - the other matrix
     * @returns {boolean} true if both are equals
     */
    equals(m: Matrix3d): boolean;
    /**
     * Clone the Matrix
     * @returns {Matrix3d}
     */
    clone(): Matrix3d;
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
import type Matrix2d from "./matrix2.js";
import type Vector2d from "./vector2.js";
import type Vector3d from "./vector3.js";
