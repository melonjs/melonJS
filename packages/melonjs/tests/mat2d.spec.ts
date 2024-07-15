import { describe, expect, it } from "vitest";
import { Matrix2d, Matrix3d, Vector2d } from "../src/index.js";

describe("Matrix2d", () => {
	it("should be initialized to a 3x3 identity matrix", () => {
		const matA = new Matrix2d();
		const result = "Matrix2d(1, 0, 0, 0, 1, 0, 0, 0, 1)";
		expect(matA.toString() === result).toEqual(true);
	});

	it("should be initialized properly with a 2x2 identity matrix", () => {
		const matA = new Matrix2d(1, 0, 0, 1, 0, 0);

		expect(matA.isIdentity()).toEqual(true);
	});

	it("could be initialized using a given 4x4 matrix", () => {
		const matA = new Matrix2d();
		const matB = new Matrix3d(
			1,
			2,
			3,
			4,
			5,
			6,
			7,
			8,
			9,
			10,
			11,
			12,
			13,
			14,
			15,
			16,
		);
		const result = "Matrix2d(1, 2, 3, 5, 6, 7, 9, 10, 11)";

		matA.fromMat3d(matB);

		expect(matA.toString() === result).toEqual(true);
	});

	it("should multiply all values properly", () => {
		const matA = new Matrix2d(1, 2, 0, 3, 4, 0, 5, 6, 1);
		const matB = new Matrix2d(7, 8, 0, 9, 10, 0, 11, 12, 1);
		const result = "Matrix2d(31, 46, 0, 39, 58, 0, 52, 76, 1)";

		matA.multiply(matB);

		expect(matA.toString() === result).toEqual(true);
	});

	it("should reset to an identity matrix", () => {
		const matA = new Matrix2d(1, 2, 3, 4, 5, 6, 7, 8, 9);

		matA.identity();

		expect(matA.isIdentity()).toEqual(true);
	});

	it("should rotate all values properly", () => {
		const matA = new Matrix2d(1, 2, 0, 3, 4, 0, 5, 6, 1);
		const result = "Matrix2d(3, 4, 0, -1, -2, 0, 5, 6, 1)";

		matA.rotate(Math.PI * 0.5);

		expect(matA.toString() === result).toEqual(true);
	});

	it("should scale all values properly", () => {
		const matA = new Matrix2d().setTransform(1, 2, 0, 3, 4, 0, 5, 6, 1);
		const result = "Matrix2d(2, 4, 0, 9, 12, 0, 5, 6, 1)";

		matA.scale(2, 3);

		expect(matA.toString() === result).toEqual(true);
	});

	it("should translate all values properly", () => {
		const matA = new Matrix2d(1, 2, 0, 3, 4, 0, 5, 6, 1);
		const result = "Matrix2d(1, 2, 0, 3, 4, 0, 16, 22, 1)";

		matA.translate(2, 3);

		expect(matA.toString() === result).toEqual(true);
		expect(matA.tx === 16).toEqual(true);
		expect(matA.ty === 22).toEqual(true);
	});

	it("should transpose the matrix properly", () => {
		const matA = new Matrix2d(1, 2, 3, 4, 5, 6, 7, 8, 9);
		const result = "Matrix2d(1, 4, 7, 2, 5, 8, 3, 6, 9)";

		matA.transpose();

		expect(matA.toString() === result).toEqual(true);
	});

	it("should invert the matrix properly", () => {
		const matA = new Matrix2d(4, 2, 3, 3, 1, 3, 2, -1, 4);
		const result = "Matrix2d(7, -11, 3, -6, 10, -3, -5, 8, -2)";

		matA.invert();

		expect(matA.toString() === result).toEqual(true);
	});

	it("should multiply a 2d vector properly with the inverted matrix", () => {
		const matA = new Matrix2d(1, 2, 3, 4, 5, 6, 7, 8, 9);
		const vecA = new Vector2d(3, 7);

		matA.apply(vecA);
		// multiply back with the inverted matrix
		matA.applyInverse(vecA);

		// and we should have back the original vector values
		expect(vecA.toString()).toEqual("x:3,y:7");
	});

	it("should be clonable", () => {
		const matA = new Matrix2d(1, 2, 3, 4, 5, 6, 7, 8, 9);
		const matB = matA.clone();

		// and we should have back the original vector values
		expect(matA.equals(matB)).toEqual(true);
	});

	it("should be copiable", () => {
		const matA = new Matrix2d(1, 2, 3, 4, 5, 6, 7, 8, 9);
		const matB = new Matrix2d().copy(matA);

		// and we should have back the original vector values
		expect(matA.equals(matB)).toEqual(true);
	});
});
