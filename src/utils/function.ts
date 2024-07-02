/**
 * a collection of utility functions
 */

/**
 * Executes a function as soon as the interpreter is idle (stack empty).
 * @param func - The function to be deferred.
 * @param thisArg - The value to be passed as the this parameter to the target function when the deferred function is called
 * @param args - Optional additional arguments to carry for the function.
 * @returns id that can be used to clear the deferred function using
 * clearTimeout
 * @example
 * // execute myFunc() when the stack is empty,
 * // with the current context and [1, 2, 3] as parameter
 * me.utils.function.defer(myFunc, this, 1, 2, 3);
 */
export function defer(
	func: () => unknown,
	thisArg: unknown,
	...args: unknown[]
) {
	return setTimeout(func.bind(thisArg), 0, ...args);
}

/**
 * returns a function that, when invoked will only be triggered at most once during a given window of time
 * @param fn - the function to be throttled.
 * @param delay - the delay in ms
 * @returns the function that will be throttled
 */
export const throttle = <R, A extends any[]>(
	fn: (...args: A) => R,
	delay: number,
): [(...args: A) => R | undefined, () => void] => {
	let wait = false;
	let timeout: undefined | number;
	let cancelled = false;

	return [
		(...args: A) => {
			if (cancelled) return undefined;
			if (wait) return undefined;

			const val = fn(...args);

			wait = true;

			timeout = window.setTimeout(() => {
				wait = false;
			}, delay);

			return val;
		},
		() => {
			cancelled = true;
			clearTimeout(timeout);
		},
	];
};
