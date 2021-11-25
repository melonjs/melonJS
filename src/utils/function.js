/**
 * a collection of utility functions
 * @namespace me.utils.function
 * @memberOf me
 */


/**
 * Executes a function as soon as the interpreter is idle (stack empty).
 * @public
 * @function
 * @memberOf me.utils.function
 * @name defer
 * @param {Function} fn The function to be deferred.
 * @param {Object} thisArg The value to be passed as the this parameter to the target function when the deferred function is called
 * @param {...*} [args] Optional additional arguments to carry for the function.
 * @returns {Number} id that can be used to clear the deferred function using
 * clearTimeout
 * @example
 * // execute myFunc() when the stack is empty,
 * // with the current context and [1, 2, 3] as parameter
 * me.utils.function.defer(myFunc, this, 1, 2, 3);
 */
export function defer(func, thisArg, ...args) {
    return setTimeout(func.bind(thisArg), 0.01, ...args);
};

/**
 * returns a function that, when invoked will only be triggered at most
 * once during a given window of time
 * @public
 * @function
 * @memberOf me.utils.function
 * @name throttle
 * @param {Function} fn the function to be throttled.
 * @param {Number} delay The delay in ms
 * @param {no_trailing} no_trailing disable the execution on the trailing edge
 */
export function throttle(fn, delay, no_trailing) {
    var last = window.performance.now(), deferTimer;
    // `no_trailing` defaults to false.
    if (typeof no_trailing !== "boolean") {
        no_trailing = false;
    }
    return function () {
        var now = window.performance.now();
        var elasped = now - last;
        var args = arguments;
        if (elasped < delay) {
            if (no_trailing === false) {
                // hold on to it
                clearTimeout(deferTimer);
                deferTimer = setTimeout(function () {
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
};
