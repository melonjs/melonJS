import pool from "./../system/pooling.js";

/**
 * additional import for TypeScript
 * @import Matrix3d from "./matrix3.js";
 * @import Vector2d from "./vector2.js";
 * @import Vector3d from "./vector3.js";
 */

/**
 * a Matrix2d Object.<br>
 * the identity matrix and parameters position : <br>
 * <img src="images/identity-matrix_2x.png"/>
 */
export default class Matrix2d {
	/**
	 * @param {(Matrix2d|Matrix3d|...number)} args - an instance of me.Matrix2d or me.Matrix3d to copy from, or individual matrix components (See {@link Matrix2d.setTransform}). If not arguments are given, the matrix will be set to Identity.
	 */
	constructor(...args) {
		/**
		 * The matrix values
		 * @ignore
		 */
		this.val = undefined;
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
	 * @see {@link translate}
	 */
	get tx() {
		return this.val[6];
	}

	/**
	 * ty component of the matrix
	 * @type {number}
	 * @see {@link translate}
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
		this.setTransform(1, 0, 0, 0, 1, 0, 0, 0, 1);
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
		const a = this.val;

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
		const v = this.val;
		const a0 = v[0];
		const a1 = v[1];
		const a3 = v[3];
		const a4 = v[4];
		const b0 = a;
		const b1 = b;
		const b3 = c;
		const b4 = d;
		const b6 = e;
		const b7 = f;

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
		const b = m.val;
		const a = this.val;

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
		const b = m.val;
		const a = this.val;
		const a0 = a[0];
		const a1 = a[1];
		const a3 = a[3];
		const a4 = a[4];
		const b0 = b[0];
		const b1 = b[1];
		const b3 = b[3];
		const b4 = b[4];
		const b6 = b[6];
		const b7 = b[7];

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
		const a = this.val;
		const a1 = a[1];
		const a2 = a[2];
		const a5 = a[5];

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
		const val = this.val;

		const a = val[0];
		const b = val[1];
		const c = val[2];
		const d = val[3];
		const e = val[4];
		const f = val[5];
		const g = val[6];
		const h = val[7];
		const i = val[8];

		const ta = i * e - f * h;
		const td = f * g - i * d;
		const tg = h * d - e * g;

		const n = a * ta + b * td + c * tg;

		val[0] = ta / n;
		val[1] = (c * h - i * b) / n;
		val[2] = (f * b - c * e) / n;

		val[3] = td / n;
		val[4] = (i * a - c * g) / n;
		val[5] = (c * d - f * a) / n;

		val[6] = tg / n;
		val[7] = (b * g - h * a) / n;
		val[8] = (e * a - b * d) / n;

		return this;
	}

	/**
	 * apply the current transform to the given 2d or 3d vector
	 * @param {Vector2d|Vector3d} v - the vector object to be transformed
	 * @returns {Vector2d|Vector3d} result vector object.
	 */
	apply(v) {
		const a = this.val;
		const x = v.x;
		const y = v.y;
		const z = typeof v.z !== "undefined" ? v.z : 1;

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
		const a = this.val;
		const x = v.x;
		const y = v.y;

		const invD = 1 / (a[0] * a[4] + a[3] * -a[1]);

		v.x =
			a[4] * invD * x + -a[3] * invD * y + (a[7] * a[3] - a[6] * a[4]) * invD;
		v.y =
			a[0] * invD * y + -a[1] * invD * x + (-a[7] * a[0] + a[6] * a[1]) * invD;

		return v;
	}

	/**
	 * scale the matrix
	 * @param {number} x - a number representing the abscissa of the scaling vector.
	 * @param {number} [y=x] - a number representing the ordinate of the scaling vector.
	 * @returns {Matrix2d} Reference to this object for method chaining
	 */
	scale(x, y = x) {
		const a = this.val;

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
			const a = this.val;
			const a00 = a[0];
			const a01 = a[1];
			const a02 = a[2];
			const a10 = a[3];
			const a11 = a[4];
			const a12 = a[5];
			const s = Math.sin(angle);
			const c = Math.cos(angle);

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
		const a = this.val;
		let _x;
		let _y;

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
		const a = this.val;

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
		const b = m.val;
		const a = this.val;

		return (
			a[0] === b[0] &&
			a[1] === b[1] &&
			a[2] === b[2] &&
			a[3] === b[3] &&
			a[4] === b[4] &&
			a[5] === b[5] &&
			a[6] === b[6] &&
			a[7] === b[7] &&
			a[8] === b[8]
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
		const a = this.val;

		return (
			"me.Matrix2d(" +
			a[0] +
			", " +
			a[1] +
			", " +
			a[2] +
			", " +
			a[3] +
			", " +
			a[4] +
			", " +
			a[5] +
			", " +
			a[6] +
			", " +
			a[7] +
			", " +
			a[8] +
			")"
		);
	}
}
