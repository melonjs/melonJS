/**
 * `math.round` and `math.isPowerOfFour` were written with 32-bit integer
 * bitwise tricks, and inherited their limits:
 *
 * - `round` was `~~(0.5 + n * 10^dec) / 10^dec`. `~~` truncates toward zero,
 *   so adding 0.5 rounded a negative value the wrong way (`round(-2.7)` gave
 *   -2), and it wraps past 2^31 (`round(3e9)` came back negative).
 * - `isPowerOfFour` tested `val & (val - 1)` and `val & 0xaaaaaaaa`, which
 *   truncate to int32 first: a fraction passed (4.5 read as 4, 16.25 as 16)
 *   and 2^33 read as 0, a "power of four".
 *
 * `round` now rounds like `Math.round` (to the nearest value, a tie toward
 * +∞: `round(-2.5)` is -2), and `isPowerOfFour` builds on `isPowerOfTwo`,
 * so only a positive integer qualifies.
 */
import { describe, expect, it } from "vitest";
import { math } from "../src/index.js";

describe("math.round", () => {
	it("rounds positive values to the nearest value", () => {
		expect(math.round(2.7)).toBe(3);
		expect(math.round(2.2)).toBe(2);
		expect(math.round(2.5)).toBe(3);
		expect(math.round(10.33333, 2)).toBeCloseTo(10.33, 10);
		expect(math.round(10.336, 2)).toBeCloseTo(10.34, 10);
	});

	it("rounds negative values to the nearest value, not toward zero", () => {
		expect(math.round(-2.7)).toBe(-3);
		expect(math.round(-2.2)).toBe(-2);
		expect(math.round(-0.6)).toBe(-1);
		expect(math.round(-10.336, 2)).toBeCloseTo(-10.34, 10);
		expect(math.round(-10.334, 2)).toBeCloseTo(-10.33, 10);
	});

	it("breaks a tie toward +∞, as Math.round does", () => {
		expect(math.round(-2.5)).toBe(-2);
		expect(math.round(-0.5)).toBe(0);
		expect(math.round(0.5)).toBe(1);
		for (const n of [-3.5, -1.5, 1.5, 3.5, -7.25, 7.25]) {
			expect(math.round(n)).toBe(Math.round(n));
		}
	});

	it("never returns -0", () => {
		expect(Object.is(math.round(-0.4), 0)).toBe(true);
		expect(Object.is(math.round(-0.5), 0)).toBe(true);
		expect(Object.is(math.round(-0.004, 2), 0)).toBe(true);
	});

	it("handles values beyond the 32-bit integer range", () => {
		expect(math.round(3e9 + 0.7)).toBe(3e9 + 1);
		expect(math.round(-3e9 - 0.7)).toBe(-3e9 - 1);
		expect(math.round(2 ** 40 + 0.25)).toBe(2 ** 40);
		expect(math.round(12345678901.234, 1)).toBeCloseTo(12345678901.2, 3);
	});

	it("leaves integers alone", () => {
		for (const n of [0, 1, -1, 42, -42, 2 ** 31, -(2 ** 31) - 1]) {
			expect(math.round(n)).toBe(n);
		}
	});
});

describe("math.isPowerOfFour", () => {
	it("accepts the powers of four", () => {
		for (let e = 0; e <= 30; e++) {
			expect(math.isPowerOfFour(4 ** e)).toBe(true);
		}
	});

	it("rejects the other powers of two", () => {
		for (let e = 1; e <= 61; e += 2) {
			expect(math.isPowerOfFour(2 ** e)).toBe(false);
		}
		expect(math.isPowerOfFour(2 ** 33)).toBe(false);
	});

	it("rejects fractions, as isPowerOfTwo does", () => {
		expect(math.isPowerOfTwo(4.5)).toBe(false);
		expect(math.isPowerOfFour(4.5)).toBe(false);
		expect(math.isPowerOfFour(16.25)).toBe(false);
		expect(math.isPowerOfFour(0.25)).toBe(false);
		expect(math.isPowerOfFour(1.5)).toBe(false);
	});

	it("rejects zero, negatives, non-powers and non-finite values", () => {
		for (const n of [0, -1, -4, -16, 2, 3, 5, 8, 12, 20, 32, 48, 63, 65]) {
			expect(math.isPowerOfFour(n)).toBe(false);
		}
		expect(math.isPowerOfFour(NaN)).toBe(false);
		expect(math.isPowerOfFour(Infinity)).toBe(false);
		expect(math.isPowerOfFour(-Infinity)).toBe(false);
	});

	it("agrees with a reference definition over a range of integers", () => {
		const powers = new Set();
		for (let p = 1; p <= 1 << 20; p *= 4) {
			powers.add(p);
		}
		for (let n = -8; n <= 4100; n++) {
			expect(math.isPowerOfFour(n)).toBe(powers.has(n));
		}
	});
});
