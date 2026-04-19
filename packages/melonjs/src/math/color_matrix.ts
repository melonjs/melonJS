import { Matrix3d } from "./matrix3d.ts";

/**
 * A 4x4 color transformation matrix extending {@link Matrix3d}.
 * Provides chainable methods for common color adjustments.
 * @category Math
 * @example
 * // grayscale
 * const cm = new ColorMatrix().saturate(0.0);
 * @example
 * // combine brightness + contrast
 * const cm = new ColorMatrix().brightness(1.3).contrast(1.5);
 */
export class ColorMatrix extends Matrix3d {
	/**
	 * Apply a brightness adjustment.
	 * @param amount - brightness multiplier (1.0 = normal, >1 brighter, <1 darker)
	 * @returns this instance for chaining
	 */
	brightness(amount: number): this {
		return this.transform(
			amount,
			0,
			0,
			0,
			0,
			amount,
			0,
			0,
			0,
			0,
			amount,
			0,
			0,
			0,
			0,
			1,
		);
	}

	/**
	 * Apply a contrast adjustment.
	 * @param amount - contrast multiplier (1.0 = normal, >1 more contrast, <1 less)
	 * @returns this instance for chaining
	 */
	contrast(amount: number): this {
		const o = (1 - amount) / 2;
		return this.transform(
			amount,
			0,
			0,
			0,
			0,
			amount,
			0,
			0,
			0,
			0,
			amount,
			0,
			o,
			o,
			o,
			1,
		);
	}

	/**
	 * Apply a saturation adjustment.
	 * @param amount - saturation level (0.0 = grayscale, 1.0 = normal, >1 over-saturated)
	 * @returns this instance for chaining
	 */
	saturate(amount: number): this {
		const ir = 0.299 * (1 - amount);
		const ig = 0.587 * (1 - amount);
		const ib = 0.114 * (1 - amount);
		return this.transform(
			ir + amount,
			ir,
			ir,
			0,
			ig,
			ig + amount,
			ig,
			0,
			ib,
			ib,
			ib + amount,
			0,
			0,
			0,
			0,
			1,
		);
	}

	/**
	 * Apply a hue rotation.
	 * @param angle - rotation angle in radians
	 * @returns this instance for chaining
	 */
	hueRotate(angle: number): this {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const lumR = 0.299;
		const lumG = 0.587;
		const lumB = 0.114;
		return this.transform(
			lumR + cos * (1 - lumR) + sin * -lumR,
			lumR + cos * -lumR + sin * 0.143,
			lumR + cos * -lumR + sin * -(1 - lumR),
			0,
			lumG + cos * -lumG + sin * -lumG,
			lumG + cos * (1 - lumG) + sin * 0.14,
			lumG + cos * -lumG + sin * lumG,
			0,
			lumB + cos * -lumB + sin * (1 - lumB),
			lumB + cos * -lumB + sin * -0.283,
			lumB + cos * (1 - lumB) + sin * lumB,
			0,
			0,
			0,
			0,
			1,
		);
	}

	/**
	 * Apply a sepia tone.
	 * @param amount - sepia intensity (0.0 = original, 1.0 = full sepia)
	 * @returns this instance for chaining
	 */
	sepia(amount: number = 1.0): this {
		if (amount >= 1.0) {
			return this.transform(
				0.393,
				0.349,
				0.272,
				0,
				0.769,
				0.686,
				0.534,
				0,
				0.189,
				0.168,
				0.131,
				0,
				0,
				0,
				0,
				1,
			);
		}
		const a = amount;
		const b = 1 - a;
		return this.transform(
			b + 0.393 * a,
			0.349 * a,
			0.272 * a,
			0,
			0.769 * a,
			b + 0.686 * a,
			0.534 * a,
			0,
			0.189 * a,
			0.168 * a,
			b + 0.131 * a,
			0,
			0,
			0,
			0,
			1,
		);
	}

	/**
	 * Apply a color inversion.
	 * @param amount - inversion amount (0.0 = original, 1.0 = fully inverted)
	 * @returns this instance for chaining
	 */
	invertColors(amount: number = 1.0): this {
		const c = 1 - 2 * amount;
		return this.transform(
			c,
			0,
			0,
			0,
			0,
			c,
			0,
			0,
			0,
			0,
			c,
			0,
			amount,
			amount,
			amount,
			1,
		);
	}
}
