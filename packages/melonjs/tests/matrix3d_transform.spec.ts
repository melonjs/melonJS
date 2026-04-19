import { describe, expect, it } from "vitest";
import { Matrix3d } from "../src/math/matrix3d.ts";

describe("Matrix3d.transform()", () => {
	describe("16-argument form (full 4x4)", () => {
		it("should not change when multiplied by identity", () => {
			const m = new Matrix3d(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 5, 6, 7, 1);
			const before = Float64Array.from(m.val);
			m.transform(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
			for (let i = 0; i < 16; i++) {
				expect(m.val[i]).toBeCloseTo(before[i]);
			}
		});

		it("should produce the same result as multiply()", () => {
			const a = new Matrix3d(
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
			const viaMultiply = new Matrix3d(
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
			const b = new Matrix3d(
				16,
				15,
				14,
				13,
				12,
				11,
				10,
				9,
				8,
				7,
				6,
				5,
				4,
				3,
				2,
				1,
			);
			viaMultiply.multiply(b);
			a.transform(16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1);
			for (let i = 0; i < 16; i++) {
				expect(a.val[i]).toBeCloseTo(viaMultiply.val[i]);
			}
		});

		it("should return this for chaining", () => {
			const m = new Matrix3d();
			const result = m.transform(
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
			);
			expect(result).toBe(m);
		});

		it("should handle zero matrix", () => {
			const m = new Matrix3d();
			m.transform(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
			for (let i = 0; i < 16; i++) {
				expect(m.val[i]).toBeCloseTo(0);
			}
		});
	});

	describe("6-argument form (2D affine)", () => {
		it("should not change when multiplied by 2D identity", () => {
			const m = new Matrix3d(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1);
			const before = Float64Array.from(m.val);
			m.transform(1, 0, 0, 1, 0, 0);
			for (let i = 0; i < 16; i++) {
				expect(m.val[i]).toBeCloseTo(before[i]);
			}
		});

		it("should apply a 2D translation", () => {
			const m = new Matrix3d();
			m.transform(1, 0, 0, 1, 100, 200);
			expect(m.val[12]).toBeCloseTo(100); // e (translate x)
			expect(m.val[13]).toBeCloseTo(200); // f (translate y)
			expect(m.val[0]).toBeCloseTo(1);
			expect(m.val[5]).toBeCloseTo(1);
		});

		it("should apply a 2D scale", () => {
			const m = new Matrix3d();
			m.transform(2, 0, 0, 3, 0, 0);
			expect(m.val[0]).toBeCloseTo(2);
			expect(m.val[5]).toBeCloseTo(3);
		});

		it("should apply a 2D rotation", () => {
			const m = new Matrix3d();
			const angle = Math.PI / 4;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			m.transform(cos, sin, -sin, cos, 0, 0);
			expect(m.val[0]).toBeCloseTo(cos);
			expect(m.val[1]).toBeCloseTo(sin);
			expect(m.val[4]).toBeCloseTo(-sin);
			expect(m.val[5]).toBeCloseTo(cos);
		});

		it("should preserve z-axis as identity", () => {
			const m = new Matrix3d();
			m.transform(2, 0, 0, 2, 50, 50);
			expect(m.val[2]).toBeCloseTo(0);
			expect(m.val[6]).toBeCloseTo(0);
			expect(m.val[10]).toBeCloseTo(1);
			expect(m.val[14]).toBeCloseTo(0);
		});

		it("should return this for chaining", () => {
			const m = new Matrix3d();
			const result = m.transform(1, 0, 0, 1, 0, 0);
			expect(result).toBe(m);
		});

		it("should accumulate with existing transform", () => {
			const m = new Matrix3d();
			m.transform(1, 0, 0, 1, 10, 20);
			m.transform(2, 0, 0, 2, 0, 0);
			expect(m.val[0]).toBeCloseTo(2);
			expect(m.val[5]).toBeCloseTo(2);
			expect(m.val[12]).toBeCloseTo(10);
			expect(m.val[13]).toBeCloseTo(20);
		});

		it("should produce same result as 16-arg equivalent", () => {
			const m1 = new Matrix3d(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1);
			const m2 = new Matrix3d(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1);
			m1.transform(0.5, 0, 0, 0.5, 5, 10);
			m2.transform(0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 5, 10, 0, 1);
			for (let i = 0; i < 16; i++) {
				expect(m1.val[i]).toBeCloseTo(m2.val[i]);
			}
		});

		it("should handle combined scale + translate", () => {
			const m = new Matrix3d();
			m.transform(2, 0, 0, 3, 50, 100);
			expect(m.val[0]).toBeCloseTo(2);
			expect(m.val[5]).toBeCloseTo(3);
			expect(m.val[12]).toBeCloseTo(50);
			expect(m.val[13]).toBeCloseTo(100);
		});

		it("should handle zero scale", () => {
			const m = new Matrix3d();
			m.transform(0, 0, 0, 0, 0, 0);
			expect(m.val[0]).toBeCloseTo(0);
			expect(m.val[5]).toBeCloseTo(0);
		});

		it("should handle negative scale (flip)", () => {
			const m = new Matrix3d();
			m.transform(-1, 0, 0, -1, 0, 0);
			expect(m.val[0]).toBeCloseTo(-1);
			expect(m.val[5]).toBeCloseTo(-1);
		});
	});
});
