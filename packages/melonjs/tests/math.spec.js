import { describe, expect, it } from "vitest";
import { math } from "../src/index.js";

describe("Math", () => {
	describe("degToRad", () => {
		it("0 should be 0", () => {
			expect(math.degToRad(0)).toEqual(0);
		});

		it("180 should be Pi", () => {
			expect(math.degToRad(180)).toEqual(Math.PI);
		});

		it("360 should be Pi * 2", () => {
			expect(math.degToRad(360)).toEqual(Math.PI * 2);
		});
	});

	describe("clamp", () => {
		it("should clamp low", () => {
			expect(math.clamp(-30, 1, 10)).toEqual(1);
		});

		it("should clamp high", () => {
			expect(math.clamp(30, 1, 10)).toEqual(10);
		});

		it("should not clamp", () => {
			expect(math.clamp(Math.PI, 1, 10)).toEqual(Math.PI);
		});
	});

	describe("random", () => {
		const a = math.random(1, 10);

		it("should be >= 1", () => {
			expect(a).toBeGreaterThanOrEqual(1);
		});

		it("should be < 10", () => {
			expect(a).toBeLessThanOrEqual(10);
		});

		it("should be a whole number", () => {
			expect(Math.floor(a)).toEqual(a);
		});
	});

	describe("randomFloat", () => {
		const a = math.randomFloat(1, 10);

		it("should be >= 1", () => {
			expect(a).toBeGreaterThanOrEqual(1);
		});

		it("should be < 10", () => {
			expect(a).toBeLessThanOrEqual(10);
		});
	});

	describe("weightedRandom", () => {
		const a = math.weightedRandom(1, 10);

		it("should be >= 1", () => {
			expect(a).toBeGreaterThanOrEqual(1);
		});

		it("should be < 10", () => {
			expect(a).toBeLessThanOrEqual(10);
		});

		it("should be a whole number", () => {
			expect(Math.floor(a)).toEqual(a);
		});
	});

	describe("round", () => {
		const a = math.round(Math.PI, 4);

		it("Pi should be 3.1416", () => {
			expect(a).toEqual(3.1416);
		});
	});

	describe("POT", () => {
		it("32 is a Power of 2", () => {
			expect(math.isPowerOfTwo(32)).toEqual(true);
		});
		it("1027 is not a Power of 2", () => {
			expect(math.isPowerOfTwo(1027)).toEqual(false);
		});

		it("next Power of 2 for 1000", () => {
			expect(math.nextPowerOfTwo(1000)).toEqual(1024);
		});
		it("next Power of 2 for 32", () => {
			expect(math.nextPowerOfTwo(32)).toEqual(32);
		});
	});

	describe("Power of 4", () => {
		it("16 is a Power of 4", () => {
			expect(math.isPowerOfFour(16)).toEqual(true);
		});
		it("64 is a Power of 4", () => {
			expect(math.isPowerOfFour(64)).toEqual(true);
		});
		it("3 is not a Power of 4", () => {
			expect(math.isPowerOfFour(3)).toEqual(false);
		});
		it("15 is not a Power of 4", () => {
			expect(math.isPowerOfFour(15)).toEqual(false);
		});
	});

	describe("lerpArray", () => {
		it("should return the single value for a 1-element array", () => {
			expect(math.lerpArray([5], 0)).toBe(5);
			expect(math.lerpArray([5], 0.5)).toBe(5);
			expect(math.lerpArray([5], 1)).toBe(5);
		});

		it("should interpolate linearly between two values", () => {
			expect(math.lerpArray([0, 10], 0)).toBe(0);
			expect(math.lerpArray([0, 10], 0.25)).toBe(2.5);
			expect(math.lerpArray([0, 10], 0.5)).toBe(5);
			expect(math.lerpArray([0, 10], 0.75)).toBe(7.5);
			expect(math.lerpArray([0, 10], 1)).toBe(10);
		});

		it("should interpolate across multiple segments", () => {
			expect(math.lerpArray([0, 10, 20], 0)).toBe(0);
			expect(math.lerpArray([0, 10, 20], 0.25)).toBe(5);
			expect(math.lerpArray([0, 10, 20], 0.5)).toBe(10);
			expect(math.lerpArray([0, 10, 20], 0.75)).toBe(15);
			expect(math.lerpArray([0, 10, 20], 1)).toBe(20);
		});

		it("should handle non-uniform values", () => {
			expect(math.lerpArray([1, 0.5, 0], 0)).toBe(1);
			expect(math.lerpArray([1, 0.5, 0], 0.5)).toBe(0.5);
			expect(math.lerpArray([1, 0.5, 0], 1)).toBe(0);
		});

		it("should handle boundaries correctly with 4+ values", () => {
			expect(math.lerpArray([10, 20, 30, 40], 0)).toBe(10);
			expect(math.lerpArray([10, 20, 30, 40], 1)).toBe(40);
		});

		it("should interpolate at segment boundaries", () => {
			// [0, 100, 200, 300] has 3 segments, each at 1/3 intervals
			expect(math.lerpArray([0, 100, 200, 300], 1 / 3)).toBeCloseTo(100, 10);
			expect(math.lerpArray([0, 100, 200, 300], 2 / 3)).toBeCloseTo(200, 10);
		});

		it("should handle position at exactly 1.0", () => {
			expect(math.lerpArray([0, 50, 100], 1)).toBe(100);
			expect(math.lerpArray([10, 20], 1)).toBe(20);
		});

		it("should handle position at exactly 0.0", () => {
			expect(math.lerpArray([42, 99], 0)).toBe(42);
			expect(math.lerpArray([0, 10, 20, 30], 0)).toBe(0);
		});

		it("should handle position beyond 1.0", () => {
			// position > 1 hits the idx >= last early return
			expect(math.lerpArray([0, 10, 20], 1.5)).toBe(20);
			expect(math.lerpArray([5, 15], 2)).toBe(15);
		});

		it("should handle negative position", () => {
			// ~~(negative) truncates toward zero → idx = 0, frac is negative
			// result extrapolates below first value
			expect(math.lerpArray([10, 20], -0.5)).toBe(5);
		});

		it("should handle identical values", () => {
			expect(math.lerpArray([7, 7, 7], 0)).toBe(7);
			expect(math.lerpArray([7, 7, 7], 0.5)).toBe(7);
			expect(math.lerpArray([7, 7, 7], 1)).toBe(7);
		});

		it("should handle two identical values", () => {
			expect(math.lerpArray([3, 3], 0.5)).toBe(3);
		});

		it("should handle descending values", () => {
			expect(math.lerpArray([100, 0], 0.5)).toBe(50);
			expect(math.lerpArray([100, 50, 0], 0.5)).toBe(50);
		});

		it("should handle negative values in the array", () => {
			expect(math.lerpArray([-10, 10], 0.5)).toBe(0);
			expect(math.lerpArray([-20, -10, 0], 0.5)).toBe(-10);
		});

		it("should handle very small fractional positions", () => {
			expect(math.lerpArray([0, 1000], 0.001)).toBeCloseTo(1, 5);
			expect(math.lerpArray([0, 1000], 0.999)).toBeCloseTo(999, 5);
		});
	});

	describe("toBeCloseTo", () => {
		it("4.3546731 is closed to 4.3547", () => {
			const value = 4.3546731;
			expect(math.toBeCloseTo(4.3547, value, 0)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 1)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 2)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 3)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 4)).toEqual(true);
			expect(math.toBeCloseTo(4.3547, value, 5)).toEqual(false);
			expect(math.toBeCloseTo(4.3547, value, 6)).toEqual(false);
		});

		it("4.8 is closed to 5 but not to 4", () => {
			const value = 4.8;
			expect(math.toBeCloseTo(5, value, 0)).toEqual(true);
			expect(math.toBeCloseTo(4, value, 0)).toEqual(false);
		});
	});
});
