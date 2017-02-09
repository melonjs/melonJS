/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

 /**
 * The built in Number Object
 * @external Number
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Number|Number}
 */

/* eslint-disable no-extend-native */

/**
 * add a clamp fn to the Number object
 * @memberof! external:Number#
 * @alias clamp
 * @param {number} low lower limit
 * @param {number} high higher limit
 * @return {number} clamped value
 */
Number.prototype.clamp = function (low, high) {
    return this < low ? low : this > high ? high : +this;
};

/**
 * return a random integer between min (included) and max (excluded)
 * @memberof! external:Number#
 * @alias random
 * @param {number} [min=this] minimum value.
 * @param {number} max maximum value.
 * @return {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log( (5).random(10) );
 * // Select a random array element
 * var ar = [ "foo", "bar", "baz" ];
 * console.log(ar[ (0).random(ar.length) ]);
 */
Number.prototype.random = function (min, max) {
    if (!max) {
        max = min;
        min = this;
    }
    return (~~(Math.random() * (max - min)) + min);
};

/**
 * return a random float between min, max (exclusive)
 * @memberof! external:Number#
 * @alias randomFloat
 * @param {number} [min=this] minimum value.
 * @param {number} max maximum value.
 * @return {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log( (5).random(10) );
 * // Select a random array element
 * var ar = [ "foo", "bar", "baz" ];
 * console.log(ar[ (0).random(ar.length) ]);
 */
Number.prototype.randomFloat = function (min, max) {
    if (!max) {
        max = min;
        min = this;
    }
    return (Math.random() * (max - min)) + min;
};

/**
 * return a weighted random between min, max (exclusive)
 * favoring the lower numbers
 * @memberof! external:Number#
 * @alias weightedRandom
 * @param {number} [min=this] minimum value.
 * @param {number} max maximum value.
 * @return {number} random value
 * @example
 * // Print a random number; one of 5, 6, 7, 8, 9
 * console.log( (5).random(10) );
 * // Select a random array element
 * var ar = [ "foo", "bar", "baz" ];
 * console.log(ar[ (0).random(ar.length) ]);
 */
Number.prototype.weightedRandom = function (min, max) {
    if (!max) {
        max = min;
        min = this;
    }
    return (~~(Math.pow(Math.random(), 2) * (max - min)) + min);
};

/**
 * round a value to the specified number of digit
 * @memberof! external:Number#
 * @alias round
 * @param {number} [num=this] value to be rounded.
 * @param {number} dec number of decimal digit to be rounded to.
 * @return {number} rounded value
 * @example
 * // round a specific value to 2 digits
 * Number.prototype.round (10.33333, 2); // return 10.33
 * // round a float value to 4 digits
 * num = 10.3333333
 * num.round(4); // return 10.3333
 */
Number.prototype.round = function (num, dec) {
    // if only one argument use the object value
    var powres = Math.pow(10, dec || num || 0);
    num = (arguments.length < 2) ? this : num;
    return (~~(0.5 + num * powres) / powres);
};

/**
 * a quick toHex function<br>
 * given number <b>must</b> be an int, with a value between 0 and 255
 * @memberof! external:Number#
 * @alias toHex
 * @return {string} converted hexadecimal value
 */
Number.prototype.toHex = function () {
    return "0123456789ABCDEF".charAt((this - (this % 16)) >> 4) + "0123456789ABCDEF".charAt(this % 16);
};

/**
 * Converts an angle in degrees to an angle in radians
 * @memberof! external:Number#
 * @alias degToRad
 * @param {number} [angle="angle"] angle in degrees
 * @return {number} corresponding angle in radians
 * @example
 * // convert a specific angle
 * Number.prototype.degToRad (60); // return 1.0471...
 * // convert object value
 * var num = 60
 * num.degToRad(); // return 1.0471...
 */
Number.prototype.degToRad = function (angle) {
    return (angle || this) / 180.0 * Math.PI;
};

/**
 * Converts an angle in radians to an angle in degrees.
 * @memberof! external:Number#
 * @alias radToDeg
 * @param {number} [angle="angle"] angle in radians
 * @return {number} corresponding angle in degrees
 * @example
 * // convert a specific angle
 * Number.prototype.radToDeg (1.0471975511965976); // return 59.9999...
 * // convert object value
 * num = 1.0471975511965976
 * Math.ceil(num.radToDeg()); // return 60
 */
Number.prototype.radToDeg = function (angle) {
    return (angle || this) * (180.0 / Math.PI);
};
/* eslint-enable no-extend-native */
