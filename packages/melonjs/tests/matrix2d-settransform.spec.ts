import { describe, expect, it } from "vitest";
import { Matrix2d, Vector2d } from "../src/index.js";

/**
 * Matrix2d stores column-major (val[0..2] = first column m00/m10/m20;
 * translation at val[6]/val[7] — see the tx/ty getters and apply()).
 *
 * Written failing-first: the 6-argument canvas-convention form
 * (a, b, c, d, e, f) stored its components ROW-major into that column-major
 * layout — rotation came out transposed (inverted) and e/f landed in the
 * unused projective row, so translation was silently dropped:
 * new Matrix2d(1, 0, 0, 1, x, y) produced the identity with NO translation.
 */
describe("Matrix2d 6-argument (canvas convention) setTransform", () => {
	it("keeps translation — e and f map to tx/ty", () => {
		const m = new Matrix2d(1, 0, 0, 1, 10, 20);
		expect(m.tx).toEqual(10);
		expect(m.ty).toEqual(20);
	});

	it("applies rotation with canvas semantics, not transposed", () => {
		// 90° CCW (a=cos=0, b=sin=1, c=-sin=-1, d=cos=0) + translate(5, 7):
		// (1, 0) rotates to (0, 1), then translates to (5, 8)
		const m = new Matrix2d().setTransform(0, 1, -1, 0, 5, 7);
		const v = m.apply(new Vector2d(1, 0));
		expect(v.x).toBeCloseTo(5, 10);
		expect(v.y).toBeCloseTo(8, 10);
	});

	it("matches the equivalent 9-argument column-major form", () => {
		const six = new Matrix2d().setTransform(2, 0.5, -0.5, 3, 11, 13);
		const nine = new Matrix2d().setTransform(2, 0.5, 0, -0.5, 3, 0, 11, 13, 1);
		expect(Array.from(six.val)).toEqual(Array.from(nine.val));
	});
});
