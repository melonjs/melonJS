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
 * @param [wait] - the delay in ms
 * @returns the function that will be throttled
 */
export const throttle = (fn: () => void, wait: number = 100) => {
	let inThrottle: boolean,
		lastFn: ReturnType<typeof setTimeout>,
		lastTime: number;
	return (...args: [] /* empty array */) => {
		if (!inThrottle) {
			fn.apply(this, args);
			lastTime = Date.now();
			inThrottle = true;
		} else {
			clearTimeout(lastFn);
			lastFn = setTimeout(
				() => {
					if (Date.now() - lastTime >= wait) {
						fn.apply(this, args);
						lastTime = Date.now();
					}
				},
				Math.max(wait - (Date.now() - lastTime), 0),
			);
		}
	};
};
