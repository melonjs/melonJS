/**
 * a collection of math utility functions
 * @namespace Math
 * @memberof me
 */

/**
 * constant to convert from degrees to radians
 * @public
 * @type {number}
 * @name DEG_TO_RAD
 * @memberof me.Math
 */
export const DEG_TO_RAD = Math.PI / 180.0;

/**
 * constant to convert from radians to degrees
 * @public
 * @type {number}
 * @name RAD_TO_DEG
 * @memberof me.Math
 */
export const RAD_TO_DEG = 180.0 / Math.PI;

/**
 * constant equals to 2 times pi
 * @public
 * @type {number}
 * @name TAU
 * @memberof me.Math
 */
export const TAU = Math.PI * 2;

/**
 * constant equals to half pi
 * @public
 * @type {number}
 * @name ETA
 * @memberof me.Math
 */
export const ETA = Math.PI * 0.5;

/**
 * the difference between 1 and the smallest floating point number greater than 1
 * @public
 * @type {number}
 * @name EPSILON
 * @memberof me.Math
 */
export const EPSILON = 0.000001;

/**
 * returns true if the given value is a power of two
 * @public
 * @function
 * @memberof me.Math
 * @name isPowerOfTwo
 * @param {number} val
 * @returns {boolean}
 */
export function isPowerOfTwo(val) {
    return (val & (val - 1)) === 0;
};

/**
 * returns the next power of two for the given value
 * @public
 * @function
 * @memberof me.Math
 * @name nextPowerOfTwo
 * @param {number} val
 * @returns {boolean}
 */
export function nextPowerOfTwo(val) {
    val --;
    val |= val >> 1;
    val |= val >> 2;
    val |= val >> 4;
    val |= val >> 8;
    val |= val >> 16;
    val ++;
    return val;
};

/**
 * Converts an angle in degrees to an angle in radians
 * @public
 * @function
 * @memberof me.Math
 * @name degToRad
 * @param {number} angle angle in degrees
 * @returns {number} corresponding angle in radians
 * @example
 * // convert a specific angle
 * me.Math.degToRad(60); // return 1.0471...
 */
export function degToRad(angle) {
    return angle * DEG_TO_RAD;
};

/**
 * Converts an angle in radians to an angle in degrees.
 * @public
 * @function
 * @memberof me.Math
 * @name radToDeg
 * @param {number} radians angle in radians
 * @returns {number} corresponding angle in degrees
 * @example
 * // convert a specific angle
 * me.Math.radToDeg(1.0471975511965976); // return 60
 */
export function radToDeg(radians) {
    return radians * RAD_TO_DEG;
};

/**
 * clamp the given value
 * @public
 * @function
 * @memberof me.Math
 * @name clamp
 * @param {number} val the value to clamp
 * @param {number} low lower limit
 * @param {number} high higher limit
 * @returns {number} clamped value
 */
export function clamp(val, low, high) {
    return val < low ? low : val > high ? high : +val;
};

/**
 * return a random integer between min (included) and max (excluded)
 * @public
 * @function
 * @memberof me.Math
 * @name random
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.random(5, 10) );
 */
export function random(min, max) {
    return (~~(Math.random() * (max - min)) + min);
};

/**
 * return a random float between min, max (exclusive)
 * @public
 * @function
 * @memberof me.Math
 * @name randomFloat
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.randomFloat(5, 10) );
 */
export function randomFloat(min, max) {
    return (Math.random() * (max - min)) + min;
};

/**
 * return a weighted random between min, max (exclusive)
 * @public
 * @function
 * @memberof me.Math
 * @name weightedRandom
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @returns {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log(me.Math.weightedRandom(5, 10) );
 */
export function weightedRandom(min, max) {
    return (~~(Math.pow(Math.random(), 2) * (max - min)) + min);
};

/**
 * round a value to the specified number of digit
 * @public
 * @function
 * @memberof me.Math
 * @name round
 * @param {number} num value to be rounded.
 * @param {number} [dec=0] number of decimal digit to be rounded to.
 * @returns {number} rounded value
 * @example
 * // round a specific value to 2 digits
 * me.Math.round(10.33333, 2); // return 10.33
 */
export function round(num, dec = 0) {
    // if only one argument use the object value
    var powres = Math.pow(10, dec);
    return (~~(0.5 + num * powres) / powres);
};

/**
 * check if the given value is close to the expected one
 * @public
 * @function
 * @memberof me.Math
 * @name toBeCloseTo
 * @param {number} expected value to be compared with.
 * @param {number} actual actual value to compare
 * @param {number} [precision=2] float precision for the comparison
 * @returns {boolean} if close to
 * @example
 * // test if the given value is close to 10
 * if (me.Math.toBeCloseTo(10, value)) {
 *     // do something
 * }
 */
export function toBeCloseTo(expected, actual, precision = 2) {
    return Math.abs(expected - actual) < (Math.pow(10, -precision) / 2);
};
