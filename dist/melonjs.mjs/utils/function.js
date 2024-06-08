/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
/**
 * a collection of utility functions
 * @namespace utils.function
 */

/**
 * Executes a function as soon as the interpreter is idle (stack empty).
 * @public
 * @memberof utils.function
 * @name defer
 * @param {Function} func - The function to be deferred.
 * @param {object} thisArg - The value to be passed as the this parameter to the target function when the deferred function is called
 * @param {...*} args - Optional additional arguments to carry for the function.
 * @returns {number} id that can be used to clear the deferred function using
 * clearTimeout
 * @example
 * // execute myFunc() when the stack is empty,
 * // with the current context and [1, 2, 3] as parameter
 * me.utils.function.defer(myFunc, this, 1, 2, 3);
 */
function defer(func, thisArg, ...args) {
    return setTimeout(func.bind(thisArg), 0.01, ...args);
}

/**
 * returns a function that, when invoked will only be triggered at most once during a given window of time
 * @public
 * @memberof utils.function
 * @name throttle
 * @param {Function} fn - the function to be throttled.
 * @param {number} delay - The delay in ms
 * @param {no_trailing} no_trailing - disable the execution on the trailing edge
 * @returns {Function} the function that will be throttled
 */
function throttle(fn, delay, no_trailing) {
    let last = globalThis.performance.now(), deferTimer;
    // `no_trailing` defaults to false.
    if (typeof no_trailing !== "boolean") {
        no_trailing = false;
    }
    return function () {
        let now = globalThis.performance.now();
        let elasped = now - last;
        let args = arguments;
        if (elasped < delay) {
            if (no_trailing === false) {
                // hold on to it
                clearTimeout(deferTimer);
                deferTimer = setTimeout(() => {
                    last = now;
                    return fn.apply(null, args);
                }, elasped);
            }
        }
        else {
            last = now;
            return fn.apply(null, args);
        }
    };
}

export { defer, throttle };
