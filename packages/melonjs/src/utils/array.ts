import {
	random as mathRandom,
	weightedRandom as mathWeightedRandom,
} from "../math/math.js";

/**
 * a collection of array utility functions
 */

/**
 * Remove the specified object from the given Array
 * @param arr - array from which to remove an object
 * @param obj - to be removed
 * @returns the modified Array
 * let arr = [ "foo", "bar", "baz" ];
 * // remove "foo" from the array
 * me.utils.array.remove(arr, "foo");
 */
export function remove<T>(arr: T[], obj: T): T[] {
	const i = Array.prototype.indexOf.call(arr, obj);
	if (i !== -1) {
		Array.prototype.splice.call(arr, i, 1);
	}
	return arr;
}

/**
 * return a random array element
 * @param arr - array to pick a element
 * @returns random member of array
 * @example
 * // Select a random array element
 * let arr = [ "foo", "bar", "baz" ];
 * console.log(me.utils.array.random(arr));
 */
export function random<T>(arr: T[]) {
	return arr[mathRandom(0, arr.length)];
}

/**
 * return a weighted random array element, favoring the earlier entries
 * @param arr - array to pick a element
 * @returns random member of array
 */
export function weightedRandom<T>(arr: T[]) {
	return arr[mathWeightedRandom(0, arr.length)];
}
