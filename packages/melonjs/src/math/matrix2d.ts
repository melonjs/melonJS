import { Point } from "../geometries/point.js";
import { createPool } from "../system/pool.js";
import { Matrix3d } from "./matrix3d.js";
import { Vector2d } from "./vector2d.js";
import { Vector3d } from "./vector3d.js";

type ConstructorArg =
	| [Matrix2d]
	| [Matrix3d]
	| [number, number, number, number, number, number]
	| [number, number, number, number, number, number, number, number, number]
	| [undefined]
	| [];

const reset = (instance: Matrix2d, ...value: ConstructorArg) => {
	if (value[0] instanceof Matrix3d) {
		instance.fromMat3d(value[0]);
	} else if (value[0] instanceof Matrix2d) {
		instance.copy(value[0]);
	} else if (typeof value[0] === "number") {
		instance.setTransform(...value);
	} else {
		instance.identity();
	}
};

/**
 * a Matrix2d Object.<br>
 * the identity matrix and parameters position : <br>
 * <img src="images/identity-matrix_2x.png"/>
 */
export class Matrix2d {
	/**
	 * The matrix values
	 */
	val: Float32Array;

	/**
	 * Constructs a new Matrix2d object.
	 * @param value - The values to initialize the matrix with.
	 */
	constructor(...value: ConstructorArg) {
		this.val = new Float32Array(9);
		reset(this, ...value);
	}

	/**
	 * Gets the tx component of the matrix.
	 * @returns The tx component of the matrix.
	 */
	get tx() {
		return this.val[6];
	}

	/**
	 * Gets the ty component of the matrix.
	 * @returns The ty component of the matrix.
	 */
	get ty() {
		return this.val[7];
	}

	/**
	 * reset the transformation matrix to the identity matrix (no transformation).<br>
	 * the identity matrix and parameters position : <br>
	 * <img src="images/identity-matrix_2x.png"/>
	 * @returns Reference to this object for method chaining
	 */
	identity() {
		this.setTransform(1, 0, 0, 0, 1, 0, 0, 0, 1);
		return this;
	}

	/**
	 * Set the matrix to the specified value.
	 * @param values - The matrix components.
	 * @returns Reference to this object for method chaining
	 */
	setTransform(
		...values:
			| [number, number, number, number, number, number]
			| [number, number, number, number, number, number, number, number, number]
	) {
		if (values.length === 9) {
			this.val[0] = values[0]; // a - m00
			this.val[1] = values[1]; // b - m10
			this.val[2] = values[2]; // c - m20
			this.val[3] = values[3]; // d - m01
			this.val[4] = values[4]; // e - m11
			this.val[5] = values[5]; // f - m21
			this.val[6] = values[6]; // g - m02
			this.val[7] = values[7]; // h - m12
			this.val[8] = values[8]; // i - m22
		} else if (values.length === 6) {
			this.val[0] = values[0]; // a
			this.val[1] = values[2]; // c
			this.val[2] = values[4]; // e
			this.val[3] = values[1]; // b
			this.val[4] = values[3]; // d
			this.val[5] = values[5]; // f
			this.val[6] = 0; // g
			this.val[7] = 0; // h
			this.val[8] = 1; // i
		}

		return this;
	}

	/**
	 * Multiplies the current transformation with the matrix described by the arguments of this method.
	 * @param a a component
	 * @param b b component
	 * @param c c component
	 * @param d d component
	 * @param e e component
	 * @param f f component
	 * @returns Reference to this object for method chaining
	 */
	transform(a: number, b: number, c: number, d: number, e: number, f: number) {
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
	 * @param m - the matrix object to copy from
	 * @returns Reference to this object for method chaining
	 */
	copy(m: Matrix2d) {
		this.val.set(m.val);
		return this;
	}

	/**
	 * Copies over the upper-left 3x3 values from the given Matrix3d
	 * @param m - the matrix object to copy from
	 * @returns Reference to this object for method chaining
	 */
	fromMat3d(m: Matrix3d) {
		this.val[0] = m.val[0];
		this.val[1] = m.val[1];
		this.val[2] = m.val[2];
		this.val[3] = m.val[4];
		this.val[4] = m.val[5];
		this.val[5] = m.val[6];
		this.val[6] = m.val[8];
		this.val[7] = m.val[9];
		this.val[8] = m.val[10];

		return this;
	}

	/**
	 * multiply both matrix
	 * @param m - the other matrix
	 * @returns Reference to this object for method chaining
	 */
	multiply(m: Matrix2d) {
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
	 * @returns Reference to this object for method chaining
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
	 * @returns Reference to this object for method chaining
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
	 * apply the current transform to the given 2d or 3d vector or point
	 * @param v - the vector object to be transformed
	 * @returns result vector object.
	 */
	apply(v: Vector2d | Vector3d | Point) {
		const a = this.val;
		const x = v.x;
		const y = v.y;
		const z = "z" in v ? v.z : 1;

		v.x = x * a[0] + y * a[3] + z * a[6];
		v.y = x * a[1] + y * a[4] + z * a[7];

		if ("z" in v) {
			v.z = x * a[2] + y * a[5] + z * a[8];
		}

		return v;
	}

	/**
	 * apply the inverted current transform to the given 2d vector
	 * @param v - the vector object to be transformed
	 * @returns result vector object.
	 */
	applyInverse(v: Vector2d) {
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
	 * @param x - a number representing the abscissa of the scaling vector.
	 * @param [y] - a number representing the ordinate of the scaling vector.
	 * @returns Reference to this object for method chaining
	 */
	scale(x: number, y = x) {
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
	 * @param v - scaling vector
	 * @returns Reference to this object for method chaining
	 */
	scaleV(v: Vector2d) {
		return this.scale(v.x, v.y);
	}

	/**
	 * specifies a 2D scale operation using the [sx, 1] scaling vector
	 * @param x - x scaling vector
	 * @returns Reference to this object for method chaining
	 */
	scaleX(x: number) {
		return this.scale(x, 1);
	}

	/**
	 * specifies a 2D scale operation using the [1,sy] scaling vector
	 * @param y - y scaling vector
	 * @returns Reference to this object for method chaining
	 */
	scaleY(y: number) {
		return this.scale(1, y);
	}

	/**
	 * rotate the matrix (counter-clockwise) by the specified angle (in radians).
	 * @param angle - Rotation angle in radians.
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number) {
		if (angle !== 0) {
			const a00 = this.val[0];
			const a01 = this.val[1];
			const a02 = this.val[2];
			const a10 = this.val[3];
			const a11 = this.val[4];
			const a12 = this.val[5];
			const s = Math.sin(angle);
			const c = Math.cos(angle);

			this.val[0] = c * a00 + s * a10;
			this.val[1] = c * a01 + s * a11;
			this.val[2] = c * a02 + s * a12;

			this.val[3] = c * a10 - s * a00;
			this.val[4] = c * a11 - s * a01;
			this.val[5] = c * a12 - s * a02;
		}
		return this;
	}

	/**
	 * translate the matrix position on the horizontal and vertical axis
	 * @param x - the x coordindates or a vector to translate the matrix by
	 * @param [y] - the y coordindates to translate the matrix by
	 * @returns Reference to this object for method chaining
	 */
	translate(x: number, y: number): Matrix2d;
	translate(vector: Vector2d): Matrix2d;
	translate(xOrVector: Vector2d | number, y?: number) {
		let _x: number;
		let _y: number;

		if (xOrVector instanceof Vector2d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
		} else {
			_x = xOrVector;
			_y = y!;
		}

		this.val[6] += this.val[0] * _x + this.val[3] * _y;
		this.val[7] += this.val[1] * _x + this.val[4] * _y;

		return this;
	}

	/**
	 * Check if matrix is an identity matrix.
	 * @returns true if the matrix is an identity matrix
	 */
	isIdentity() {
		return (
			this.val[0] === 1 &&
			this.val[1] === 0 &&
			this.val[2] === 0 &&
			this.val[3] === 0 &&
			this.val[4] === 1 &&
			this.val[5] === 0 &&
			this.val[6] === 0 &&
			this.val[7] === 0 &&
			this.val[8] === 1
		);
	}

	/**
	 * return true if the two matrices are identical
	 * @param m - the other matrix
	 * @returns true if both are equals
	 */
	equals(m: Matrix2d) {
		return (
			this.val[0] === m.val[0] &&
			this.val[1] === m.val[1] &&
			this.val[2] === m.val[2] &&
			this.val[3] === m.val[3] &&
			this.val[4] === m.val[4] &&
			this.val[5] === m.val[5] &&
			this.val[6] === m.val[6] &&
			this.val[7] === m.val[7] &&
			this.val[8] === m.val[8]
		);
	}

	/**
	 * Clone the Matrix
	 * @returns a clones matrix
	 */
	clone() {
		return matrix2dPool.get(this);
	}

	/**
	 * return an array representation of this Matrix
	 * @returns the internal matrix values
	 */
	toArray() {
		return this.val;
	}

	/**
	 * convert the object to a string representation
	 * @returns string representation of the matrix
	 */
	toString() {
		const a = this.val;

		return `Matrix2d(${a[0]}, ${a[1]}, ${a[2]}, ${a[3]}, ${a[4]}, ${a[5]}, ${
			a[6]
		}, ${a[7]}, ${a[8]})`;
	}
}

export const matrix2dPool = createPool<Matrix2d, ConstructorArg>(
	(...values) => {
		const instance = new Matrix2d(...values);

		return {
			instance,
			reset(...value) {
				reset(instance, ...value);
			},
		};
	},
);
