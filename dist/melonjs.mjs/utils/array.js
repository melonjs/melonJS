/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { random as random$1, weightedRandom as weightedRandom$1 } from '../math/math.js';

/**
 * a collection of array utility functions
 * @namespace utils.array
 */

/**
 * Remove the specified object from the given Array
 * @public
 * @memberof utils.array
 * @name remove
 * @param {Array} arr - array from which to remove an object
 * @param {object} obj - to be removed
 * @returns {Array} the modified Array
 * let arr = [ "foo", "bar", "baz" ];
 * // remove "foo" from the array
 * me.utils.array.remove(arr, "foo");
 */
function remove(arr, obj) {
    let i = Array.prototype.indexOf.call(arr, obj);
    if (i !== -1) {
        Array.prototype.splice.call(arr, i, 1);
    }
    return arr;
}

/**
 * return a random array element
 * @public
 * @memberof utils.array
 * @name random
 * @param {Array} arr - array to pick a element
 * @returns {any} random member of array
 * @example
 * // Select a random array element
 * let arr = [ "foo", "bar", "baz" ];
 * console.log(me.utils.array.random(arr));
 */
function random(arr) {
    return arr[random$1(0, arr.length)];
}

/**
 * return a weighted random array element, favoring the earlier entries
 * @public
 * @memberof utils.array
 * @name weightedRandom
 * @param {Array} arr - array to pick a element
 * @returns {any} random member of array
 */
function weightedRandom(arr) {
    return arr[weightedRandom$1(0, arr.length)];
}

export { random, remove, weightedRandom };
