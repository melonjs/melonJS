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
