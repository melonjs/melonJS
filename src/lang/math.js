/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

 /**
 * The built in Math Object
 * @external Math
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Math|Math}
 */

if (!Math.sign) {
    /**
     * The Math.sign() function returns the sign of a number, indicating whether the number is positive, negative or zero.
     * @memberof! external:Math#
     * @alias sign
     * @param {number} x a number.
     * @return {number} sign of the number
     */
    Math.sign = function(x) {
        // If x is NaN, the result is NaN.
        // If x is -0, the result is -0.
        // If x is +0, the result is +0.
        // If x is negative and not -0, the result is -1.
        // If x is positive and not +0, the result is +1.
        x = +x; // convert to a number
        if (x === 0 || isNaN(x)) {
            return Number(x);
        }
        return x > 0 ? 1 : -1;
    };
}
