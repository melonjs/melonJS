/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org
 */

/* eslint-disable no-extend-native */

/**
 * The built in Function Object
 * @external Function
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function|Function}
 */


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
