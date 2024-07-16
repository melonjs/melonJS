import { Point } from "../geometries/point.ts";
import { createPool } from "../system/pool.ts";
import { EPSILON } from "./math.ts";
import { Matrix2d } from "./matrix2d.ts";
import { Vector2d } from "./vector2d.ts";
import { Vector3d } from "./vector3d.ts";

type SixteenNumbers = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
];

type ConstructorArg = [Matrix3d] | SixteenNumbers | [undefined] | [];

const reset = (instance: Matrix3d, ...value: ConstructorArg) => {
	if (value[0] instanceof Matrix3d) {
		instance.copy(value[0]);
	} else if (typeof value[0] === "number") {
		instance.setTransform(...value);
	} else {
		instance.identity();
	}
};

/**
 * a 4x4 Matrix3d Object
 */
export class Matrix3d {
	/**
	 * The matrix values
	 */
	val: Float32Array;

	/**
	 * Constructs a new Matrix3d object.
	 * @param value - The values to initialize the matrix with.
	 */
	constructor(...value: ConstructorArg) {
		this.val = new Float32Array(16);
		reset(this, ...value);
	}

	/**
	 * Gets the tx component of the matrix.
	 * @returns The tx component of the matrix.
	 */
	get tx() {
		return this.val[12];
	}

	/**
	 * Gets the ty component of the matrix.
	 * @returns The ty component of the matrix.
	 */
	get ty() {
		return this.val[13];
	}

	/**
	 * Gets the tz component of the matrix.
	 * @returns The tz component of the matrix.
	 */
	get tz() {
		return this.val[14];
	}

	/**
	 * reset the transformation matrix to the identity matrix (no transformation).<br>
	 * the identity matrix and parameters position : <br>
	 * <img src="images/identity-matrix_2x.png"/>
	 * @returns Reference to this object for method chaining
	 */
	identity() {
		return this.setTransform(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
	}

	/**
	 * Set the matrix to the specified value.
	 * @param values - The matrix components.
	 * @returns Reference to this object for method chaining
	 */
	setTransform(...values: SixteenNumbers) {
		const a = this.val;

		a[0] = values[0];
		a[1] = values[1];
		a[2] = values[2];
		a[3] = values[3];
		a[4] = values[4];
		a[5] = values[5];
		a[6] = values[6];
		a[7] = values[7];
		a[8] = values[8];
		a[9] = values[9];
		a[10] = values[10];
		a[11] = values[11];
		a[12] = values[12];
		a[13] = values[13];
		a[14] = values[14];
		a[15] = values[15];

		return this;
	}

	/**
	 * Copies over the values from another me.Matrix3d.
	 * @param m - the matrix object to copy from
	 * @returns Reference to this object for method chaining
	 */
	copy(m: Matrix3d) {
		this.val.set(m.val);
		return this;
	}

	/**
	 * Copies over the upper-left 2x2 values from the given me.Matrix2d
	 * @param m - the matrix object to copy from
	 * @returns Reference to this object for method chaining
	 */
	fromMat2d(m: Matrix2d) {
		const b = m.val;
		return this.setTransform(
			b[0],
			b[3],
			b[6],
			0,
			b[1],
			b[4],
			b[7],
			0,
			b[2],
			b[5],
			b[8],
			0,
			0,
			0,
			0,
			1,
		);
	}

	/**
	 * multiply both matrix
	 * @param m - Other matrix
	 * @returns Reference to this object for method chaining
	 */
	multiply(m: Matrix3d) {
		const a = this.val;
		const b = m.val;

		const a00 = a[0];
		const a01 = a[1];
		const a02 = a[2];
		const a03 = a[3];
		const a10 = a[4];
		const a11 = a[5];
		const a12 = a[6];
		const a13 = a[7];
		const a20 = a[8];
		const a21 = a[9];
		const a22 = a[10];
		const a23 = a[11];
		const a30 = a[12];
		const a31 = a[13];
		const a32 = a[14];
		const a33 = a[15];
		let b0 = b[0];
		let b1 = b[1];
		let b2 = b[2];
		let b3 = b[3];

		a[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		a[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		a[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		a[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

		b0 = b[4];
		b1 = b[5];
		b2 = b[6];
		b3 = b[7];

		a[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		a[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		a[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		a[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

		b0 = b[8];
		b1 = b[9];
		b2 = b[10];
		b3 = b[11];

		a[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		a[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		a[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		a[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

		b0 = b[12];
		b1 = b[13];
		b2 = b[14];
		b3 = b[15];

		a[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		a[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		a[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		a[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

		return this;
	}

	/**
	 * Transpose the value of this matrix.
	 * @returns Reference to this object for method chaining
	 */
	transpose() {
		const a = this.val;
		const a01 = a[1];
		const a02 = a[2];
		const a03 = a[3];
		const a12 = a[6];
		const a13 = a[7];
		const a23 = a[11];

		a[1] = a[4];
		a[2] = a[8];
		a[3] = a[12];
		a[4] = a01;
		a[6] = a[9];
		a[7] = a[13];
		a[8] = a02;
		a[9] = a12;
		a[11] = a[14];
		a[12] = a03;
		a[13] = a13;
		a[14] = a23;

		return this;
	}

	/**
	 * invert this matrix, causing it to apply the opposite transformation.
	 * @returns Reference to this object for method chaining
	 */
	invert() {
		const a = this.val;

		const a00 = a[0];
		const a01 = a[1];
		const a02 = a[2];
		const a03 = a[3];
		const a10 = a[4];
		const a11 = a[5];
		const a12 = a[6];
		const a13 = a[7];
		const a20 = a[8];
		const a21 = a[9];
		const a22 = a[10];
		const a23 = a[11];
		const a30 = a[12];
		const a31 = a[13];
		const a32 = a[14];
		const a33 = a[15];

		const b00 = a00 * a11 - a01 * a10;
		const b01 = a00 * a12 - a02 * a10;
		const b02 = a00 * a13 - a03 * a10;
		const b03 = a01 * a12 - a02 * a11;

		const b04 = a01 * a13 - a03 * a11;
		const b05 = a02 * a13 - a03 * a12;
		const b06 = a20 * a31 - a21 * a30;
		const b07 = a20 * a32 - a22 * a30;

		const b08 = a20 * a33 - a23 * a30;
		const b09 = a21 * a32 - a22 * a31;
		const b10 = a21 * a33 - a23 * a31;
		const b11 = a22 * a33 - a23 * a32;

		// Calculate the determinant
		let det =
			b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

		if (!det) {
			return this.identity();
		}

		det = 1 / det;

		a[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
		a[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
		a[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
		a[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
		a[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
		a[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
		a[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
		a[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
		a[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
		a[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
		a[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
		a[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
		a[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
		a[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
		a[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
		a[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

		return this;
	}

	/**
	 * apply the current transform to the given 2d or 3d vector or point
	 * @param v - the vector object to be transformed
	 * @returns result vector object.
	 */
	apply(v: Vector3d | Vector2d | Point) {
		const a = this.val;
		const x = v.x;
		const y = v.y;
		const z = "z" in v ? v.z : 1;

		const w = a[3] * x + a[7] * y + a[11] * z + a[15] || 1.0;

		v.x = (a[0] * x + a[4] * y + a[8] * z + a[12]) / w;
		v.y = (a[1] * x + a[5] * y + a[9] * z + a[13]) / w;

		if ("z" in v) {
			v.z = (a[2] * x + a[6] * y + a[10] * z + a[14]) / w;
		}

		return v;
	}

	/**
	 * apply the inverted current transform to the given 2d or 3d vector
	 * @param v - the vector object to be transformed
	 * @returns result vector object.
	 */
	applyInverse(v: Vector3d | Vector2d) {
		// invert the current matrix
		const im = matrix3dPool.get(this).invert();
		// apply the inverted matrix
		im.apply(v);

		matrix3dPool.release(im);

		return v;
	}

	/**
	 * generate an orthogonal projection matrix, with the result replacing the current matrix
	 * <img src="images/glOrtho.gif"/><br>
	 * @param left - farthest left on the x-axis
	 * @param right - farthest right on the x-axis
	 * @param bottom - farthest down on the y-axis
	 * @param top - farthest up on the y-axis
	 * @param near - distance to the near clipping plane along the -Z axis
	 * @param far - distance to the far clipping plane along the -Z axis
	 * @returns Reference to this object for method chaining
	 */
	ortho(
		left: number,
		right: number,
		bottom: number,
		top: number,
		near: number,
		far: number,
	) {
		const a = this.val;
		const leftRight = 1.0 / (left - right);
		const bottomTop = 1.0 / (bottom - top);
		const nearFar = 1.0 / (near - far);

		a[0] = -2.0 * leftRight;
		a[1] = 0.0;
		a[2] = 0.0;
		a[3] = 0.0;
		a[4] = 0.0;
		a[5] = -2.0 * bottomTop;
		a[6] = 0.0;
		a[7] = 0.0;
		a[8] = 0.0;
		a[9] = 0.0;
		a[10] = 2.0 * nearFar;
		a[11] = 0.0;
		a[12] = (left + right) * leftRight;
		a[13] = (top + bottom) * bottomTop;
		a[14] = (far + near) * nearFar;
		a[15] = 1.0;

		return this;
	}

	/**
	 * scale the matrix
	 * @param x - a number representing the abscissa of the scaling vector.
	 * @param [y] - a number representing the ordinate of the scaling vector.
	 * @param [z] - a number representing the depth vector
	 * @returns Reference to this object for method chaining
	 */
	scale(x: number, y = x, z = 0) {
		const a = this.val;

		a[0] = a[0] * x;
		a[1] = a[1] * x;
		a[2] = a[2] * x;
		a[3] = a[3] * x;

		a[4] = a[4] * y;
		a[5] = a[5] * y;
		a[6] = a[6] * y;
		a[7] = a[7] * y;

		a[8] = a[8] * z;
		a[9] = a[9] * z;
		a[10] = a[10] * z;
		a[11] = a[11] * z;

		return this;
	}

	/**
	 * adds a 2D scaling transformation.
	 * @param v - scaling vector
	 * @returns Reference to this object for method chaining
	 */
	scaleV(v: Vector3d) {
		return this.scale(v.x, v.y, v.z);
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
	 * rotate this matrix (counter-clockwise) by the specified angle (in radians).
	 * @param angle - Rotation angle in radians.
	 * @param v - the axis to rotate around
	 * @returns Reference to this object for method chaining
	 */
	rotate(angle: number, v: Vector3d) {
		if (angle !== 0) {
			const a = this.val;
			let x = v.x;
			let y = v.y;
			let z = v.z;

			let len = Math.sqrt(x * x + y * y + z * z);

			if (len < EPSILON) {
				return null;
			}

			len = 1 / len;
			x *= len;
			y *= len;
			z *= len;

			const s = Math.sin(angle);
			const c = Math.cos(angle);
			const t = 1 - c;

			const a00 = a[0];
			const a01 = a[1];
			const a02 = a[2];
			const a03 = a[3];
			const a10 = a[4];
			const a11 = a[5];
			const a12 = a[6];
			const a13 = a[7];
			const a20 = a[8];
			const a21 = a[9];
			const a22 = a[10];
			const a23 = a[11];

			// Construct the elements of the rotation matrix
			const b00 = x * x * t + c;
			const b01 = y * x * t + z * s;
			const b02 = z * x * t - y * s;
			const b10 = x * y * t - z * s;
			const b11 = y * y * t + c;
			const b12 = z * y * t + x * s;
			const b20 = x * z * t + y * s;
			const b21 = y * z * t - x * s;
			const b22 = z * z * t + c;

			// Perform rotation-specific matrix multiplication
			a[0] = a00 * b00 + a10 * b01 + a20 * b02;
			a[1] = a01 * b00 + a11 * b01 + a21 * b02;
			a[2] = a02 * b00 + a12 * b01 + a22 * b02;
			a[3] = a03 * b00 + a13 * b01 + a23 * b02;
			a[4] = a00 * b10 + a10 * b11 + a20 * b12;
			a[5] = a01 * b10 + a11 * b11 + a21 * b12;
			a[6] = a02 * b10 + a12 * b11 + a22 * b12;
			a[7] = a03 * b10 + a13 * b11 + a23 * b12;
			a[8] = a00 * b20 + a10 * b21 + a20 * b22;
			a[9] = a01 * b20 + a11 * b21 + a21 * b22;
			a[10] = a02 * b20 + a12 * b21 + a22 * b22;
			a[11] = a03 * b20 + a13 * b21 + a23 * b22;
		}
		return this;
	}

	/**
	 * translate the matrix position using the given vector
	 * @param x - a number representing the abscissa of the vector, or a vector object
	 * @param [y] - a number representing the ordinate of the vector.
	 * @param [z] - a number representing the depth of the vector
	 * @returns Reference to this object for method chaining
	 */
	translate(x: number, y: number, z?: number | undefined): Matrix3d;
	translate(vector: Vector3d | Vector2d): Matrix3d;
	translate(xOrVector: Vector3d | Vector2d | number, y?: number, z?: number) {
		const a = this.val;
		let _x: number;
		let _y: number;
		let _z: number;

		if (xOrVector instanceof Vector3d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
			_z = xOrVector.z;
		} else if (xOrVector instanceof Vector2d) {
			_x = xOrVector.x;
			_y = xOrVector.y;
			_z = 0;
		} else {
			_x = xOrVector;
			_y = y!;
			_z = z ?? 0;
		}

		a[12] = a[0] * _x + a[4] * _y + a[8] * _z + a[12];
		a[13] = a[1] * _x + a[5] * _y + a[9] * _z + a[13];
		a[14] = a[2] * _x + a[6] * _y + a[10] * _z + a[14];
		a[15] = a[3] * _x + a[7] * _y + a[11] * _z + a[15];

		return this;
	}

	/**
	 * Check if the matrix is an identity matrix.
	 * @returns true if the matrix is an identity matrix
	 */
	isIdentity() {
		const a = this.val;

		return (
			a[0] === 1 &&
			a[1] === 0 &&
			a[2] === 0 &&
			a[3] === 0 &&
			a[4] === 0 &&
			a[5] === 1 &&
			a[6] === 0 &&
			a[7] === 0 &&
			a[8] === 0 &&
			a[9] === 0 &&
			a[10] === 1 &&
			a[11] === 0 &&
			a[12] === 0 &&
			a[13] === 0 &&
			a[14] === 0 &&
			a[15] === 1
		);
	}

	/**
	 * return true if the two matrices are identical
	 * @param m - the other matrix
	 * @returns true if both are equals
	 */
	equals(m: Matrix3d) {
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
			a[8] === b[8] &&
			a[9] === b[9] &&
			a[10] === b[10] &&
			a[11] === b[11] &&
			a[12] === b[12] &&
			a[13] === b[13] &&
			a[14] === b[14] &&
			a[15] === b[15]
		);
	}

	/**
	 * Clone the Matrix
	 * @returns a cloned matrix
	 */
	clone() {
		return matrix3dPool.get(this);
	}

	/**
	 * return an array representation of this Matrix
	 * @returns internal matrix values
	 */
	toArray() {
		return this.val;
	}

	/**
	 * convert the object to a string representation
	 * @returns stringified representation
	 */
	toString() {
		const a = this.val;

		return `Matrix3d(${a[0]}, ${a[1]}, ${a[2]}, ${a[3]}, ${a[4]}, ${a[5]}, ${
			a[6]
		}, ${a[7]}, ${a[8]}, ${a[9]}, ${a[10]}, ${a[11]}, ${a[12]}, ${a[13]}, ${
			a[14]
		}, ${a[15]})`;
	}
}

export const matrix3dPool = createPool<Matrix3d, ConstructorArg>(
	(...values) => {
		const instance = new Matrix3d(...values);

		return {
			instance,
			reset(...value) {
				reset(instance, ...value);
			},
		};
	},
);
