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
		const result = "Matrix2d(1, 2, 0, 5, 6, 0, 13, 14, 1)";

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

	describe("transform(a, b, c, d, e, f)", () => {
		it("should not change when multiplied by identity values", () => {
			const m = new Matrix2d(2, 0, 0, 0, 3, 0, 10, 20, 1);
			const before = m.toArray().slice();
			m.transform(1, 0, 0, 1, 0, 0);
			for (let i = 0; i < 9; i++) {
				expect(m.val[i]).toBeCloseTo(before[i]);
			}
		});

		it("should apply a translation", () => {
			const m = new Matrix2d();
			m.transform(1, 0, 0, 1, 100, 200);
			expect(m.val[6]).toBeCloseTo(100); // e (translate x)
			expect(m.val[7]).toBeCloseTo(200); // f (translate y)
			expect(m.val[0]).toBeCloseTo(1);
			expect(m.val[4]).toBeCloseTo(1);
		});

		it("should apply a scale", () => {
			const m = new Matrix2d();
			m.transform(2, 0, 0, 3, 0, 0);
			expect(m.val[0]).toBeCloseTo(2); // a (scale x)
			expect(m.val[4]).toBeCloseTo(3); // d (scale y)
		});

		it("should apply a rotation", () => {
			const m = new Matrix2d();
			const angle = Math.PI / 4;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			m.transform(cos, sin, -sin, cos, 0, 0);
			expect(m.val[0]).toBeCloseTo(cos);
			expect(m.val[1]).toBeCloseTo(sin);
			expect(m.val[3]).toBeCloseTo(-sin);
			expect(m.val[4]).toBeCloseTo(cos);
		});

		it("should accumulate with existing transform", () => {
			const m = new Matrix2d();
			// translate then scale
			m.transform(1, 0, 0, 1, 10, 20);
			m.transform(2, 0, 0, 2, 0, 0);
			expect(m.val[0]).toBeCloseTo(2);
			expect(m.val[4]).toBeCloseTo(2);
			expect(m.val[6]).toBeCloseTo(10); // translation preserved
			expect(m.val[7]).toBeCloseTo(20);
		});

		it("should produce same result as multiply()", () => {
			const m1 = new Matrix2d(2, 1, 0, 1, 3, 0, 5, 10, 1);
			const m2 = new Matrix2d(2, 1, 0, 1, 3, 0, 5, 10, 1);
			const other = new Matrix2d(0.5, 0, 0, 0, 0.5, 0, 3, 7, 1);

			m1.multiply(other);
			m2.transform(0.5, 0, 0, 0.5, 3, 7);

			for (let i = 0; i < 9; i++) {
				expect(m2.val[i]).toBeCloseTo(m1.val[i]);
			}
		});

		it("should return this for chaining", () => {
			const m = new Matrix2d();
			const result = m.transform(1, 0, 0, 1, 0, 0);
			expect(result).toBe(m);
		});

		it("should handle combined scale + translate", () => {
			const m = new Matrix2d();
			m.transform(2, 0, 0, 3, 50, 100);
			expect(m.val[0]).toBeCloseTo(2);
			expect(m.val[4]).toBeCloseTo(3);
			expect(m.val[6]).toBeCloseTo(50);
			expect(m.val[7]).toBeCloseTo(100);
		});

		it("should handle zero scale", () => {
			const m = new Matrix2d();
			m.transform(0, 0, 0, 0, 0, 0);
			expect(m.val[0]).toBeCloseTo(0);
			expect(m.val[4]).toBeCloseTo(0);
		});

		it("should handle negative scale (flip)", () => {
			const m = new Matrix2d();
			m.transform(-1, 0, 0, -1, 0, 0);
			expect(m.val[0]).toBeCloseTo(-1);
			expect(m.val[4]).toBeCloseTo(-1);
		});
	});
});
