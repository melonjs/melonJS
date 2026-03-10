import { describe, expect, it } from "vitest";
import { Interpolation } from "../src/tweens/interpolation.js";

describe("Interpolation", () => {
	describe("Linear", () => {
		it("should return the first value at k=0", () => {
			expect(Interpolation.Linear([0, 10], 0)).toBeCloseTo(0, 6);
		});

		it("should return the last value at k=1", () => {
			expect(Interpolation.Linear([0, 10], 1)).toBeCloseTo(10, 6);
		});

		it("should return the midpoint at k=0.5 with two values", () => {
			expect(Interpolation.Linear([0, 10], 0.5)).toBeCloseTo(5, 6);
		});

		it("should interpolate between multiple values", () => {
			const values = [0, 10, 20];
			// k=0 -> 0, k=0.5 -> 10, k=1 -> 20
			expect(Interpolation.Linear(values, 0)).toBeCloseTo(0, 6);
			expect(Interpolation.Linear(values, 0.5)).toBeCloseTo(10, 6);
			expect(Interpolation.Linear(values, 1)).toBeCloseTo(20, 6);
		});

		it("should interpolate at quarter points with multiple values", () => {
			const values = [0, 10, 20];
			// k=0.25 -> halfway between 0 and 10 = 5
			expect(Interpolation.Linear(values, 0.25)).toBeCloseTo(5, 6);
			// k=0.75 -> halfway between 10 and 20 = 15
			expect(Interpolation.Linear(values, 0.75)).toBeCloseTo(15, 6);
		});

		it("should handle a single-element array at boundaries", () => {
			// With a single value [5], m=0, any k will use linear(v[0], v[0+1>0?0:1], ...)
			// This is an edge case; just confirm it doesn't throw
			const result = Interpolation.Linear([5], 0);
			expect(typeof result).toBe("number");
		});

		it("should handle equal values", () => {
			expect(Interpolation.Linear([5, 5], 0.5)).toBeCloseTo(5, 6);
		});

		it("should handle negative values", () => {
			expect(Interpolation.Linear([-10, 10], 0.5)).toBeCloseTo(0, 6);
			expect(Interpolation.Linear([-10, 10], 0)).toBeCloseTo(-10, 6);
			expect(Interpolation.Linear([-10, 10], 1)).toBeCloseTo(10, 6);
		});
	});

	describe("Bezier", () => {
		it("should return the first control point at k=0", () => {
			expect(Interpolation.Bezier([0, 5, 10], 0)).toBeCloseTo(0, 6);
		});

		it("should return the last control point at k=1", () => {
			expect(Interpolation.Bezier([0, 5, 10], 1)).toBeCloseTo(10, 6);
		});

		it("should compute a quadratic Bezier at k=0.5", () => {
			// Quadratic Bezier with control points [0, 10, 0]:
			// B(0.5) = (1-0.5)^2 * 0 + 2*(1-0.5)*0.5 * 10 + 0.5^2 * 0 = 5
			expect(Interpolation.Bezier([0, 10, 0], 0.5)).toBeCloseTo(5, 6);
		});

		it("should compute a linear Bezier (two control points)", () => {
			// With two points, Bezier should reduce to linear interpolation
			expect(Interpolation.Bezier([0, 10], 0)).toBeCloseTo(0, 6);
			expect(Interpolation.Bezier([0, 10], 0.5)).toBeCloseTo(5, 6);
			expect(Interpolation.Bezier([0, 10], 1)).toBeCloseTo(10, 6);
		});

		it("should handle a symmetric quadratic Bezier curve", () => {
			// Symmetric control points [0, 20, 0] should give same value at 0.25 and 0.75
			const v1 = Interpolation.Bezier([0, 20, 0], 0.25);
			const v2 = Interpolation.Bezier([0, 20, 0], 0.75);
			expect(v1).toBeCloseTo(v2, 4);
		});

		it("should handle cubic Bezier with four control points", () => {
			const points = [0, 10, 20, 30];
			expect(Interpolation.Bezier(points, 0)).toBeCloseTo(0, 6);
			expect(Interpolation.Bezier(points, 1)).toBeCloseTo(30, 6);
			// At k=0.5 with evenly spaced points, the curve should be at 15
			expect(Interpolation.Bezier(points, 0.5)).toBeCloseTo(15, 4);
		});

		it("should return values between control point extremes", () => {
			const points = [0, 100, 0];
			for (let k = 0; k <= 1.0; k += 0.1) {
				const val = Interpolation.Bezier(points, k);
				expect(val).toBeGreaterThanOrEqual(0 - 0.001);
				expect(val).toBeLessThanOrEqual(100 + 0.001);
			}
		});
	});

	describe("CatmullRom", () => {
		it("should return the first value at k=0", () => {
			expect(Interpolation.CatmullRom([0, 10, 20, 30], 0)).toBeCloseTo(0, 4);
		});

		it("should return the last value at k=1", () => {
			expect(Interpolation.CatmullRom([0, 10, 20, 30], 1)).toBeCloseTo(30, 4);
		});

		it("should pass through intermediate control points", () => {
			const values = [0, 10, 20, 30];
			// With 4 values, m=3, at k=1/3 we should be at values[1]=10
			expect(Interpolation.CatmullRom(values, 1 / 3)).toBeCloseTo(10, 4);
			// At k=2/3 we should be at values[2]=20
			expect(Interpolation.CatmullRom(values, 2 / 3)).toBeCloseTo(20, 4);
		});

		it("should handle evenly spaced linear values", () => {
			// For linearly spaced data, CatmullRom should produce near-linear results
			const values = [0, 25, 50, 75, 100];
			const midVal = Interpolation.CatmullRom(values, 0.5);
			expect(midVal).toBeCloseTo(50, 2);
		});

		it("should handle a closed curve (first == last)", () => {
			// When first and last values are equal, CatmullRom uses modular indexing
			const values = [0, 10, 20, 10, 0];
			const val = Interpolation.CatmullRom(values, 0);
			expect(typeof val).toBe("number");
			expect(isNaN(val)).toBe(false);
		});

		it("should produce smooth results between points", () => {
			const values = [0, 10, 20, 30];
			// Sample the curve and verify it doesn't produce NaN or Infinity
			for (let k = 0; k <= 1.0; k += 0.05) {
				const val = Interpolation.CatmullRom(values, k);
				expect(isNaN(val)).toBe(false);
				expect(isFinite(val)).toBe(true);
			}
		});

		it("should handle two values", () => {
			const values = [0, 10];
			expect(Interpolation.CatmullRom(values, 0)).toBeCloseTo(0, 4);
			expect(Interpolation.CatmullRom(values, 1)).toBeCloseTo(10, 4);
		});

		it("should handle negative values", () => {
			const values = [-20, -10, 0, 10, 20];
			expect(Interpolation.CatmullRom(values, 0)).toBeCloseTo(-20, 4);
			expect(Interpolation.CatmullRom(values, 1)).toBeCloseTo(20, 4);
			const midVal = Interpolation.CatmullRom(values, 0.5);
			expect(midVal).toBeCloseTo(0, 2);
		});
	});
});
