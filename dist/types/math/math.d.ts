/**
 * returns true if the given value is a power of two
 * @memberof Math
 * @param {number} val
 * @returns {boolean}
 */
export function isPowerOfTwo(val: number): boolean;
/**
 * returns true if the given value is a power of four
 * @memberof Math
 * @param {number} val
 * @returns {boolean}
 */
export function isPowerOfFour(val: number): boolean;
/**
 * returns the next power of two for the given value
 * @memberof Math
 * @param {number} val
 * @returns {boolean}
 */
export function nextPowerOfTwo(val: number): boolean;
/**
 * Converts an angle in degrees to an angle in radians
 * @memberof Math
 * @param {number} angle - angle in degrees
 * @returns {number} corresponding angle in radians
 * @example
 * // convert a specific angle
 * me.Math.degToRad(60); // return 1.0471...
 */
export function degToRad(angle: number): number;
/**
 * Converts an angle in radians to an angle in degrees.
 * @memberof Math
 * @param {number} radians - angle in radians
 * @returns {number} corresponding angle in degrees
 * @example
 * // convert a specific angle
 * me.Math.radToDeg(1.0471975511965976); // return 60
 */
export function radToDeg(radians: number): number;
/**
 * clamp the given value
 * @memberof Math
 * @param {number} val - the value to clamp
 * @param {number} low - lower limit
 * @param {number} high - higher limit
 * @returns {number} clamped value
 */
export function clamp(val: number, low: number, high: number): number;
/**
 * return a random integer between min (included) and max (excluded)
 * @memberof Math
 * @param {number} min - minimum value.
 * @param {number} max - maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.random(5, 10) );
 */
export function random(min: number, max: number): number;
/**
 * return a random float between min, max (exclusive)
 * @memberof Math
 * @param {number} min - minimum value.
 * @param {number} max - maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.randomFloat(5, 10) );
 */
export function randomFloat(min: number, max: number): number;
/**
 * return a weighted random between min, max (exclusive)
 * @memberof Math
 * @param {number} min - minimum value.
 * @param {number} max - maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.weightedRandom(5, 10) );
 */
export function weightedRandom(min: number, max: number): number;
/**
 * round a value to the specified number of digit
 * @memberof Math
 * @param {number} num - value to be rounded.
 * @param {number} [dec=0] - number of decimal digit to be rounded to.
 * @returns {number} rounded value
 * @example
 * // round a specific value to 2 digits
 * me.Math.round(10.33333, 2); // return 10.33
 */
export function round(num: number, dec?: number | undefined): number;
/**
 * check if the given value is close to the expected one
 * @memberof Math
 * @param {number} expected - value to be compared with.
 * @param {number} actual - actual value to compare
 * @param {number} [precision=2] - float precision for the comparison
 * @returns {boolean} if close to
 * @example
 * // test if the given value is close to 10
 * if (me.Math.toBeCloseTo(10, value)) {
 *     // do something
 * }
 */
export function toBeCloseTo(expected: number, actual: number, precision?: number | undefined): boolean;
/**
 * Calculates the power of a number.
 * @memberof Math
 * @param {number} n - The number to be raised to the power of 2.
 * @returns {number} The result of raising the number to the power of 2.
 */
export function pow(n: number): number;
/**
 * a collection of math utility functions
 * @namespace Math
 */
/**
 * constant to convert from degrees to radians
 * @type {number}
 * @memberof Math
 */
export const DEG_TO_RAD: number;
/**
 * constant to convert from radians to degrees
 * @type {number}
 * @memberof Math
 */
export const RAD_TO_DEG: number;
/**
 * constant equals to 2 times pi
 * @type {number}
 * @memberof Math
 */
export const TAU: number;
/**
 * constant equals to half pi
 * @type {number}
 * @memberof Math
 */
export const ETA: number;
/**
 * the difference between 1 and the smallest floating point number greater than 1
 * @type {number}
 * @memberof Math
 */
export const EPSILON: number;
