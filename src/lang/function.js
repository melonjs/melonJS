/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/* eslint-disable no-extend-native */

/**
 * The built in Function Object
 * @external Function
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function|Function}
 */
if (!Function.prototype.bind) {
    /** @ignore */
    var Empty = function () {};

    /**
     * Binds this function to the given context by wrapping it in another function and returning the wrapper.<p>
     * Whenever the resulting "bound" function is called, it will call the original ensuring that this is set to context. <p>
     * Also optionally curries arguments for the function.
     * @memberof! external:Function#
     * @alias bind
     * @param {Object} that the object to bind to.
     * @param {} [arguments...] Optional additional arguments to curry for the function.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind|Function.bind}
     * @example
     * // Ensure that our callback is triggered with the right object context (this):
     * myObject.onComplete(this.callback.bind(this));
     */
    Function.prototype.bind = function bind(that) {
        // ECMAScript 5 compliant implementation
        // http://es5.github.com/#x15.3.4.5
        // from https://github.com/kriskowal/es5-shim
        var target = this;
        if (typeof target !== "function") {
            throw new TypeError("Function.prototype.bind called on incompatible " + target);
        }
        var args = Array.prototype.slice.call(arguments, 1);
        var bound = function () {
            if (this instanceof bound) {
                var result = target.apply(this, args.concat(Array.prototype.slice.call(arguments)));
                if (Object(result) === result) {
                    return result;
                }
                return this;
            }
            else {
                return target.apply(that, args.concat(Array.prototype.slice.call(arguments)));
            }
        };
        if (target.prototype) {
            Empty.prototype = target.prototype;
            bound.prototype = new Empty();
            Empty.prototype = null;
        }
        return bound;
    };
}

/**
 * Executes a function as soon as the interpreter is idle (stack empty).
 * @memberof! external:Function#
 * @alias defer
 * @param {Object} context The execution context of the deferred function.
 * @param {} [arguments...] Optional additional arguments to carry for the
 * function.
 * @return {Number} id that can be used to clear the deferred function using
 * clearTimeout
 * @example
 * // execute myFunc() when the stack is empty,
 * // with the current context and 'myArgument' as parameter
 * myFunc.defer(this, 'myArgument');
 */
Function.prototype.defer = function () {
    return setTimeout(this.bind.apply(this, arguments), 0.01);
};
/* eslint-enable no-extend-native */
