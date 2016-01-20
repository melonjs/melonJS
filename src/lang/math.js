/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
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
        x = +x; // convert to a number
        if (x === 0 || isNaN(x)) {
            return x;
        }
        return x > 0 ? 1 : -1;
    };
}
