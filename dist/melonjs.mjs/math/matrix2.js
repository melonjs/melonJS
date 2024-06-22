/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import pool from '../system/pooling.js';

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
class Matrix2d {
    /**
     * @param {(Matrix2d|Matrix3d|...number)} args - an instance of me.Matrix2d or me.Matrix3d to copy from, or individual matrix components (See {@link Matrix2d.setTransform}). If not arguments are given, the matrix will be set to Identity.
     */
    constructor(...args) {
        this.onResetEvent(...args);
    }

    /**
     * @ignore
     */
    onResetEvent() {
        const arg0 = arguments[0];
        const argLen = arguments.length;

        if (typeof this.val === "undefined") {
            this.val = new Float32Array(9);
        }

        if (argLen === 1) {
            // matrix2d or matrix3d
            if (arg0.val.length === 9) {
                this.copy(arg0);
            } else if (arg0.val.length === 16) {
                this.fromMat3d(arguments[0]);
            } else {
                throw new Error("invalid Matrix2d constructor parameter");
            }
        } else if (arguments.length >= 6) {
            // individual components
            this.setTransform.apply(this, arguments);
        } else {
            // invalid or no arguments
            this.identity();
        }
    }

    /**
     * tx component of the matrix
     * @type {number}
     * @see Matrix2d.translate
     */
    get tx() {
        return this.val[6];
    }

    /**
     * ty component of the matrix
     * @type {number}
     * @see Matrix2d.translate
     */
    get ty() {
        return this.val[7];
    }

    /**
     * reset the transformation matrix to the identity matrix (no transformation).<br>
     * the identity matrix and parameters position : <br>
     * <img src="images/identity-matrix_2x.png"/>
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    identity() {
        this.setTransform(
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        );
        return this;
    }

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
    setTransform() {
        let a = this.val;

        if (arguments.length === 9) {
            a[0] = arguments[0]; // a - m00
            a[1] = arguments[1]; // b - m10
            a[2] = arguments[2]; // c - m20
            a[3] = arguments[3]; // d - m01
            a[4] = arguments[4]; // e - m11
            a[5] = arguments[5]; // f - m21
            a[6] = arguments[6]; // g - m02
            a[7] = arguments[7]; // h - m12
            a[8] = arguments[8]; // i - m22
        } else if (arguments.length === 6) {
            a[0] = arguments[0]; // a
            a[1] = arguments[2]; // c
            a[2] = arguments[4]; // e
            a[3] = arguments[1]; // b
            a[4] = arguments[3]; // d
            a[5] = arguments[5]; // f
            a[6] = 0; // g
            a[7] = 0; // h
            a[8] = 1; // i
        }

        return this;
    }

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
    transform(a, b, c, d, e, f) {
        let v = this.val,
            a0 = v[0],
            a1 = v[1],
            a3 = v[3],
            a4 = v[4],

            b0 = a,
            b1 = b,
            b3 = c,
            b4 = d,
            b6 = e,
            b7 = f;

        v[0] = a0 * b0 + a3 * b1;
        v[1] = a1 * b0 + a4 * b1;
        v[3] = a0 * b3 + a3 * b4;
        v[4] = a1 * b3 + a4 * b4;
        v[6] += a0 * b6 + a3 * b7;
        v[7] += a1 * b6 + a4 * b7;

        return this;
    }

    /**
     * Copies over the values from another me.Matrix2d.
     * @param {Matrix2d} m - the matrix object to copy from
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    copy(m) {
        this.val.set(m.val);
        return this;
    }

    /**
     * Copies over the upper-left 3x3 values from the given me.Matrix3d
     * @param {Matrix3d} m - the matrix object to copy from
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    fromMat3d(m) {
        let b = m.val;
        let a = this.val;

        a[0] = b[0];
        a[1] = b[1];
        a[2] = b[2];
        a[3] = b[4];
        a[4] = b[5];
        a[5] = b[6];
        a[6] = b[8];
        a[7] = b[9];
        a[8] = b[10];

        return this;
    }

    /**
     * multiply both matrix
     * @param {Matrix2d} m - the other matrix
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    multiply(m) {
        let b = m.val;
        let a = this.val,
            a0 = a[0],
            a1 = a[1],
            a3 = a[3],
            a4 = a[4],
            b0 = b[0],
            b1 = b[1],
            b3 = b[3],
            b4 = b[4],
            b6 = b[6],
            b7 = b[7];

        a[0] = a0 * b0 + a3 * b1;
        a[1] = a1 * b0 + a4 * b1;
        a[3] = a0 * b3 + a3 * b4;
        a[4] = a1 * b3 + a4 * b4;
        a[6] += a0 * b6 + a3 * b7;
        a[7] += a1 * b6 + a4 * b7;

        return this;
    }

    /**
     * Transpose the value of this matrix.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    transpose() {
        let a = this.val,
            a1 = a[1],
            a2 = a[2],
            a5 = a[5];

        a[1] = a[3];
        a[2] = a[6];
        a[3] = a1;
        a[5] = a[7];
        a[6] = a2;
        a[7] = a5;

        return this;
    }

    /**
     * invert this matrix, causing it to apply the opposite transformation.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    invert() {
        let val = this.val;

        let a = val[ 0 ], b = val[ 1 ], c = val[ 2 ],
            d = val[ 3 ], e = val[ 4 ], f = val[ 5 ],
            g = val[ 6 ], h = val[ 7 ], i = val[ 8 ];

        let ta = i * e - f * h,
            td = f * g - i * d,
            tg = h * d - e * g;

        let n = a * ta + b * td + c * tg;

        val[ 0 ] = ta / n;
        val[ 1 ] = (c * h - i * b) / n;
        val[ 2 ] = (f * b - c * e) / n;

        val[ 3 ] = td / n;
        val[ 4 ] = (i * a - c * g) / n;
        val[ 5 ] = (c * d - f * a) / n;

        val[ 6 ] = tg / n;
        val[ 7 ] = (b * g - h * a) / n;
        val[ 8 ] = (e * a - b * d) / n;

        return this;
    }

    /**
    * apply the current transform to the given 2d or 3d vector
    * @param {Vector2d|Vector3d} v - the vector object to be transformed
    * @returns {Vector2d|Vector3d} result vector object.
    */
    apply(v) {
        let a = this.val,
            x = v.x,
            y = v.y,
            z = (typeof v.z !== "undefined") ? v.z : 1;

        v.x = x * a[0] + y * a[3] + z * a[6];
        v.y = x * a[1] + y * a[4] + z * a[7];

        if (typeof v.z !== "undefined") {
            v.z = x * a[2] + y * a[5] + z * a[8];
        }

        return v;
    }

    /**
     * apply the inverted current transform to the given 2d vector
     * @param {Vector2d} v - the vector object to be transformed
     * @returns {Vector2d} result vector object.
     */
    applyInverse(v) {
        let a = this.val,
            x = v.x,
            y = v.y;

        let invD = 1 / ((a[0] * a[4]) + (a[3] * -a[1]));

        v.x = (a[4] * invD * x) + (-a[3] * invD * y) + (((a[7] * a[3]) - (a[6] * a[4])) * invD);
        v.y = (a[0] * invD * y) + (-a[1] * invD * x) + (((-a[7] * a[0]) + (a[6] * a[1])) * invD);

        return v;
    }

    /**
     * scale the matrix
     * @param {number} x - a number representing the abscissa of the scaling vector.
     * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scale(x, y = x) {
        let a = this.val;

        a[0] *= x;
        a[1] *= x;
        //a[2] *= x; // z axis remains unchanged for 2d scale operation

        a[3] *= y;
        a[4] *= y;
        //a[5] *= y; // w axis remains unchanged for 2d scale operation

        return this;
    }

    /**
     * adds a 2D scaling transformation.
     * @param {Vector2d} v - scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleV(v) {
        return this.scale(v.x, v.y);
    }

    /**
     * specifies a 2D scale operation using the [sx, 1] scaling vector
     * @param {number} x - x scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleX(x) {
        return this.scale(x, 1);
    }

    /**
     * specifies a 2D scale operation using the [1,sy] scaling vector
     * @param {number} y - y scaling vector
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    scaleY(y) {
        return this.scale(1, y);
    }

    /**
     * rotate the matrix (counter-clockwise) by the specified angle (in radians).
     * @param {number} angle - Rotation angle in radians.
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    rotate(angle) {
        if (angle !== 0) {
            let a = this.val,
                a00 = a[0],
                a01 = a[1],
                a02 = a[2],
                a10 = a[3],
                a11 = a[4],
                a12 = a[5],
                s = Math.sin(angle),
                c = Math.cos(angle);

            a[0] = c * a00 + s * a10;
            a[1] = c * a01 + s * a11;
            a[2] = c * a02 + s * a12;

            a[3] = c * a10 - s * a00;
            a[4] = c * a11 - s * a01;
            a[5] = c * a12 - s * a02;
        }
        return this;
    }

    /**
     * translate the matrix position on the horizontal and vertical axis
     * @param {number|Vector2d} x - the x coordindates or a vector to translate the matrix by
     * @param {number} [y] - the y coordindates to translate the matrix by
     * @returns {Matrix2d} Reference to this object for method chaining
     */
    translate() {
        let a = this.val;
        let _x, _y;

        if (arguments.length === 2) {
            // x, y
            _x = arguments[0];
            _y = arguments[1];
        } else {
            // vector
            _x = arguments[0].x;
            _y = arguments[0].y;
        }

        a[6] += a[0] * _x + a[3] * _y;
        a[7] += a[1] * _x + a[4] * _y;

        return this;
    }

    /**
     * returns true if the matrix is an identity matrix.
     * @returns {boolean}
     */
    isIdentity() {
        let a = this.val;

        return (
            a[0] === 1 &&
            a[1] === 0 &&
            a[2] === 0 &&
            a[3] === 0 &&
            a[4] === 1 &&
            a[5] === 0 &&
            a[6] === 0 &&
            a[7] === 0 &&
            a[8] === 1
        );
    }

    /**
     * return true if the two matrices are identical
     * @param {Matrix2d} m - the other matrix
     * @returns {boolean} true if both are equals
     */
    equals(m) {
        let b = m.val;
        let a = this.val;

        return (
            (a[0] === b[0]) &&
            (a[1] === b[1]) &&
            (a[2] === b[2]) &&
            (a[3] === b[3]) &&
            (a[4] === b[4]) &&
            (a[5] === b[5]) &&
            (a[6] === b[6]) &&
            (a[7] === b[7]) &&
            (a[8] === b[8])
        );
    }

    /**
     * Clone the Matrix
     * @returns {Matrix2d}
     */
    clone() {
        return pool.pull("Matrix2d", this);
    }

    /**
     * return an array representation of this Matrix
     * @returns {Float32Array}
     */
    toArray() {
        return this.val;
    }

    /**
     * convert the object to a string representation
     * @returns {string}
     */
    toString() {
        let a = this.val;

        return "me.Matrix2d(" +
            a[0] + ", " + a[1] + ", " + a[2] + ", " +
            a[3] + ", " + a[4] + ", " + a[5] + ", " +
            a[6] + ", " + a[7] + ", " + a[8] +
        ")";
    }
}

export { Matrix2d as default };
