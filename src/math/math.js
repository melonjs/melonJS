/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * a collection of math utility functions
     * @namespace Math
     * @memberOf me
     */
    me.Math = (function () {
        // hold public stuff in our singleton
        var api = {};

        /*
         * PRIVATE STUFF
         */
        var DEG_TO_RAD = Math.PI / 180.0;
        var RAD_TO_DEG = 180.0 / Math.PI;

        /*
         * PUBLIC STUFF
         */

        /**
         * returns true if the given value is a power of two
         * @public
         * @function
         * @memberOf me.Math
         * @name isPowerOfTwo
         * @param {Number} val
         * @return {boolean}
         */
        api.isPowerOfTwo = function (val) {
            return (val & (val - 1)) === 0;
        };

        /**
         * returns the next power of two for the given value
         * @public
         * @function
         * @memberOf me.Math
         * @name nextPowerOfTwo
         * @param {Number} val
         * @return {boolean}
         */
        api.nextPowerOfTwo = function (val) {
            val --;
            val |= val >> 1;
            val |= val >> 2;
            val |= val >> 4;
            val |= val >> 8;
            val |= val >> 16;
            val ++;
            return val;
        };

        /**
         * Converts an angle in degrees to an angle in radians
         * @public
         * @function
         * @memberOf me.Math
         * @name degToRad
         * @param {number} angle angle in degrees
         * @return {number} corresponding angle in radians
         * @example
         * // convert a specific angle
         * me.Math.degToRad (60); // return 1.0471...
         */
        api.degToRad = function (angle) {
            return angle * DEG_TO_RAD;
        };

        /**
         * Converts an angle in radians to an angle in degrees.
         * @public
         * @function
         * @memberOf me.Math
         * @name radToDeg
         * @param {number} radians angle in radians
         * @return {number} corresponding angle in degrees
         * @example
         * // convert a specific angle
         * me.Math.radToDeg (1.0471975511965976); // return 60
         */
        api.radToDeg = function (radians) {
            return radians * RAD_TO_DEG;
        };

        // return our object
        return api;
    })();
})();
