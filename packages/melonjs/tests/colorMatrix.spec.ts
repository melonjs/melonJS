import { describe, expect, it } from "vitest";
import { ColorMatrix } from "../src/math/color_matrix.ts";
import { Matrix3d } from "../src/math/matrix3d.ts";

describe("ColorMatrix", () => {
	describe("constructor", () => {
		it("should create an identity matrix by default", () => {
			const cm = new ColorMatrix();
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should extend Matrix3d", () => {
			const cm = new ColorMatrix();
			expect(cm).toBeInstanceOf(Matrix3d);
		});
	});

	describe("brightness", () => {
		it("should not change colors at 1.0", () => {
			const cm = new ColorMatrix().brightness(1.0);
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should scale RGB channels", () => {
			const cm = new ColorMatrix().brightness(2.0);
			const v = cm.val;
			expect(v[0]).toBeCloseTo(2.0);
			expect(v[5]).toBeCloseTo(2.0);
			expect(v[10]).toBeCloseTo(2.0);
			expect(v[15]).toBeCloseTo(1.0); // alpha unchanged
		});

		it("should darken at values below 1", () => {
			const cm = new ColorMatrix().brightness(0.5);
			expect(cm.val[0]).toBeCloseTo(0.5);
			expect(cm.val[5]).toBeCloseTo(0.5);
			expect(cm.val[10]).toBeCloseTo(0.5);
		});
	});

	describe("contrast", () => {
		it("should not change colors at 1.0", () => {
			const cm = new ColorMatrix().contrast(1.0);
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should increase contrast above 1.0", () => {
			const cm = new ColorMatrix().contrast(2.0);
			expect(cm.val[0]).toBeCloseTo(2.0);
			expect(cm.val[5]).toBeCloseTo(2.0);
			expect(cm.val[10]).toBeCloseTo(2.0);
			// offset should be (1 - 2) / 2 = -0.5
			expect(cm.val[12]).toBeCloseTo(-0.5);
			expect(cm.val[13]).toBeCloseTo(-0.5);
			expect(cm.val[14]).toBeCloseTo(-0.5);
		});

		it("should reduce contrast below 1.0", () => {
			const cm = new ColorMatrix().contrast(0.0);
			// all channels should map to 0.5 (gray)
			expect(cm.val[0]).toBeCloseTo(0.0);
			expect(cm.val[12]).toBeCloseTo(0.5);
		});
	});

	describe("saturate", () => {
		it("should not change colors at 1.0", () => {
			const cm = new ColorMatrix().saturate(1.0);
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should produce grayscale at 0.0", () => {
			const cm = new ColorMatrix().saturate(0.0);
			const v = cm.val;
			// each row should sum to ~1.0 (luminance coefficients)
			expect(v[0] + v[4] + v[8]).toBeCloseTo(1.0);
			expect(v[1] + v[5] + v[9]).toBeCloseTo(1.0);
			expect(v[2] + v[6] + v[10]).toBeCloseTo(1.0);
			// R channel should use standard luminance weights
			expect(v[0]).toBeCloseTo(0.299);
			expect(v[4]).toBeCloseTo(0.587);
			expect(v[8]).toBeCloseTo(0.114);
		});
	});

	describe("hueRotate", () => {
		it("should not change colors at 0 radians", () => {
			const cm = new ColorMatrix().hueRotate(0);
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should produce a different matrix for non-zero rotation", () => {
			const cm = new ColorMatrix().hueRotate(Math.PI / 2);
			expect(cm.isIdentity()).toEqual(false);
		});

		it("should return to identity after full 2π rotation", () => {
			const cm = new ColorMatrix().hueRotate(Math.PI * 2);
			// should be very close to identity
			const id = new Matrix3d();
			for (let i = 0; i < 16; i++) {
				expect(cm.val[i]).toBeCloseTo(id.val[i], 3);
			}
		});
	});

	describe("sepia", () => {
		it("should apply full sepia at 1.0", () => {
			const cm = new ColorMatrix().sepia(1.0);
			expect(cm.val[0]).toBeCloseTo(0.393);
			expect(cm.val[1]).toBeCloseTo(0.349);
			expect(cm.val[2]).toBeCloseTo(0.272);
		});

		it("should not change at 0.0", () => {
			const cm = new ColorMatrix().sepia(0.0);
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should interpolate at 0.5", () => {
			const cm = new ColorMatrix().sepia(0.5);
			// should be between identity and full sepia
			expect(cm.val[0]).toBeGreaterThan(0.393);
			expect(cm.val[0]).toBeLessThan(1.0);
		});
	});

	describe("invertColors", () => {
		it("should fully invert at 1.0", () => {
			const cm = new ColorMatrix().invertColors(1.0);
			expect(cm.val[0]).toBeCloseTo(-1.0);
			expect(cm.val[5]).toBeCloseTo(-1.0);
			expect(cm.val[10]).toBeCloseTo(-1.0);
			expect(cm.val[12]).toBeCloseTo(1.0);
			expect(cm.val[13]).toBeCloseTo(1.0);
			expect(cm.val[14]).toBeCloseTo(1.0);
		});

		it("should not change at 0.0", () => {
			const cm = new ColorMatrix().invertColors(0.0);
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should half-invert at 0.5", () => {
			const cm = new ColorMatrix().invertColors(0.5);
			expect(cm.val[0]).toBeCloseTo(0.0);
			expect(cm.val[12]).toBeCloseTo(0.5);
		});
	});

	describe("chaining", () => {
		it("should support method chaining", () => {
			const cm = new ColorMatrix().brightness(1.2).contrast(1.5).saturate(0.8);
			expect(cm).toBeInstanceOf(ColorMatrix);
			expect(cm.isIdentity()).toEqual(false);
		});

		it("should return the same instance when chaining", () => {
			const cm = new ColorMatrix();
			const result = cm.brightness(1.2);
			expect(result).toBe(cm);
		});

		it("should combine transforms (order matters)", () => {
			const a = new ColorMatrix().brightness(2.0).contrast(0.5);
			const b = new ColorMatrix().contrast(0.5).brightness(2.0);
			// different order should produce different results
			let same = true;
			for (let i = 0; i < 16; i++) {
				if (Math.abs(a.val[i] - b.val[i]) > 0.001) {
					same = false;
					break;
				}
			}
			expect(same).toEqual(false);
		});
	});

	describe("reset and reuse", () => {
		it("should be resettable via identity()", () => {
			const cm = new ColorMatrix().brightness(2.0).contrast(0.5);
			expect(cm.isIdentity()).toEqual(false);
			cm.identity();
			expect(cm.isIdentity()).toEqual(true);
		});

		it("should produce correct results after reset", () => {
			const cm = new ColorMatrix().brightness(2.0);
			cm.identity();
			cm.saturate(0.0);
			// should be pure grayscale, not affected by previous brightness
			expect(cm.val[0]).toBeCloseTo(0.299);
		});
	});
});
