/**
 * a collection of array utility functions
 * @namespace utils.array
 */
/**
 * Remove the specified object from the given Array
 * @public
 * @memberof utils.array
 * @name remove
 * @param {Array.<number|string|Object>} arr - array from which to remove an object
 * @param {object} obj - to be removed
 * @returns {Array.<number|string|Object>} the modified Array
 * let arr = [ "foo", "bar", "baz" ];
 * // remove "foo" from the array
 * me.utils.array.remove(arr, "foo");
 */
export function remove(arr: Array<number | string | Object>, obj: object): Array<number | string | Object>;
/**
 * return a random array element
 * @public
 * @memberof utils.array
 * @name random
 * @param {Array.<number|string|Object>} arr - array to pick a element
 * @returns {any} random member of array
 * @example
 * // Select a random array element
 * let arr = [ "foo", "bar", "baz" ];
 * console.log(me.utils.array.random(arr));
 */
export function random(arr: Array<number | string | Object>): any;
/**
 * return a weighted random array element, favoring the earlier entries
 * @public
 * @memberof utils.array
 * @name weightedRandom
 * @param {Array.<number|string|Object>} arr - array to pick a element
 * @returns {any} random member of array
 */
export function weightedRandom(arr: Array<number | string | Object>): any;
