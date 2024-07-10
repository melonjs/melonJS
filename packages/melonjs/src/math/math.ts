/**
 * a collection of math utility functions
 * @namespace math
 */

/**
 * constant to convert from degrees to radians
 */
export const DEG_TO_RAD = Math.PI / 180.0;

/**
 * constant to convert from radians to degrees
 */
export const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * constant equals to 2 times pi
 */
export const TAU = Math.PI * 2;

/**
 * constant equals to half pi
 */
export const ETA = Math.PI * 0.5;

/**
 * the difference between 1 and the smallest floating point number greater than 1
 */
export const EPSILON = 0.000001;

/**
 * returns true if the given value is a power of two
 * @param val number to test
 * @returns true if number is a power of two
 */
export function isPowerOfTwo(val: number) {
	return (val & (val - 1)) === 0;
}

/**
 * returns true if the given value is a power of four
 * @param val number to test
 * @returns true if number is a power of four
 */
export function isPowerOfFour(val: number) {
	if (val === 0 || val === 2 || val === 3) {
		return false;
	}
	if (val === 1) {
		return true;
	}

	if ((val & (val - 1)) === 0) {
		if ((val & 0xaaaaaaaa) === 0) {
			return true;
		}
	}
	return false;
}

/**
 * returns the next power of two for the given value
 * @param val any number
 * @returns next power of two relative to the given number
 */
export function nextPowerOfTwo(val: number) {
	val--;
	val |= val >> 1;
	val |= val >> 2;
	val |= val >> 4;
	val |= val >> 8;
	val |= val >> 16;
	val++;
	return val;
}

/**
 * Converts an angle in degrees to an angle in radians
 * @param angle - angle in degrees
 * @returns corresponding angle in radians
 * @example
 * // convert a specific angle
 * math.degToRad(60); // return 1.0471...
 */
export function degToRad(angle: number) {
	return angle * DEG_TO_RAD;
}

/**
 * Converts an angle in radians to an angle in degrees.
 * @param radians - angle in radians
 * @returns corresponding angle in degrees
 * @example
 * // convert a specific angle
 * math.radToDeg(1.0471975511965976); // return 60
 */
export function radToDeg(radians: number) {
	return radians * RAD_TO_DEG;
}

/**
 * clamp the given value
 * @param val - the value to clamp
 * @param low - lower limit
 * @param high - higher limit
 * @returns clamped value
 */
export function clamp(val: number, low: number, high: number) {
	return val < low ? low : val > high ? high : +val;
}

/**
 * return a random integer between min (included) and max (excluded)
 * @param min - minimum value.
 * @param max - maximum value.
 * @returns random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(math.random(5, 10));
 */
export function random(min: number, max: number) {
	return ~~(Math.random() * (max - min)) + min;
}

/**
 * return a random float between min, max (exclusive)
 * @param min - minimum value.
 * @param max - maximum value.
 * @returns random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(math.randomFloat(5, 10) );
 */
export function randomFloat(min: number, max: number) {
	return Math.random() * (max - min) + min;
}

/**
 * return a weighted random between min, max (exclusive)
 * @param min - minimum value.
 * @param max - maximum value.
 * @returns random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(math.weightedRandom(5, 10) );
 */
export function weightedRandom(min: number, max: number) {
	return ~~(Math.pow(Math.random(), 2) * (max - min)) + min;
}

/**
 * round a value to the specified number of digit
 * @param num - value to be rounded.
 * @param [dec] - number of decimal digit to be rounded to.
 * @returns rounded value
 * @example
 * // round a specific value to 2 digits
 * math.round(10.33333, 2); // return 10.33
 */
export function round(num: number, dec = 0) {
	// if only one argument use the object value
	const powres = Math.pow(10, dec);
	return ~~(0.5 + num * powres) / powres;
}

/**
 * check if the given value is close to the expected one
 * @param expected - value to be compared with.
 * @param actual - actual value to compare
 * @param [precision] - float precision for the comparison
 * @returns if close to
 * @example
 * // test if the given value is close to 10
 * if (math.toBeCloseTo(10, value)) {
 *     // do something
 * }
 */
export function toBeCloseTo(expected: number, actual: number, precision = 2) {
	return Math.abs(expected - actual) < Math.pow(10, -precision) / 2;
}

/**
 * Calculates the power of a number.
 * @param n - The number to be raised to the power of 2.
 * @returns The result of raising the number to the power of 2.
 */
export function pow(n: number) {
	return Math.pow(n, 2);
}
