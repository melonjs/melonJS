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
         * PUBLIC STUFF
         */

        /**
         * constant to convert from degrees to radians
         * @public
         * @type {Number}
         * @name DEG_TO_RAD
         * @memberOf me.Math
         */
        api.DEG_TO_RAD = Math.PI / 180.0;

        /**
         * constant to convert from radians to degrees
         * @public
         * @type {Number}
         * @name RAD_TO_DEG
         * @memberOf me.Math
         */
        api.RAD_TO_DEG = 180.0 / Math.PI;

        /**
         * constant equals to 2 times pi
         * @public
         * @type {Number}
         * @name TAU
         * @memberOf me.Math
         */
        api.TAU = Math.PI * 2;

        /**
         * constant equals to half pi
         * @public
         * @type {Number}
         * @name ETA
         * @memberOf me.Math
         */
        api.ETA = Math.PI * 0.5;

        /**
         * the difference between 1 and the smallest floating point number greater than 1
         * @public
         * @type {Number}
         * @name EPSILON
         * @memberOf me.Math
         */
        api.EPSILON = 0.000001;

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
         * me.Math.degToRad(60); // return 1.0471...
         */
        api.degToRad = function (angle) {
            return angle * api.DEG_TO_RAD;
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
         * me.Math.radToDeg(1.0471975511965976); // return 60
         */
        api.radToDeg = function (radians) {
            return radians * api.RAD_TO_DEG;
        };

        /**
         * clamp the given value
         * @public
         * @function
         * @memberOf me.Math
         * @name clamp
         * @param {number} val the value to clamp
         * @param {number} low lower limit
         * @param {number} high higher limit
         * @return {number} clamped value
         */
        api.clamp = function (val, low, high) {
            return val < low ? low : val > high ? high : +val;
        };

        /**
         * return a random integer between min (included) and max (excluded)
         * @public
         * @function
         * @memberOf me.Math
         * @name random
         * @param {number} min minimum value.
         * @param {number} max maximum value.
         * @return {number} random value
         * @example
         * // Print a random number; one of 5, 6, 7, 8, 9
         * console.log(me.Math.random(5, 10) );
         */
        api.random = function (min, max) {
            return (~~(Math.random() * (max - min)) + min);
        };

        /**
         * return a random float between min, max (exclusive)
         * @public
         * @function
         * @memberOf me.Math
         * @name randomFloat
         * @param {number} min minimum value.
         * @param {number} max maximum value.
         * @return {number} random value
         * @example
         * // Print a random number; one of 5, 6, 7, 8, 9
         * console.log(me.Math.randomFloat(5, 10) );
         */
        api.randomFloat = function (min, max) {
            return (Math.random() * (max - min)) + min;
        };

        /**
         * return a weighted random between min, max (exclusive)
         * @public
         * @function
         * @memberOf me.Math
         * @name weightedRandom
         * @param {number} min minimum value.
         * @param {number} max maximum value.
         * @return {number} random value
         * @example
         * // Print a random number; one of 5, 6, 7, 8, 9
         * console.log(me.Math.weightedRandom(5, 10) );
         */
        api.weightedRandom = function (min, max) {
            return (~~(Math.pow(Math.random(), 2) * (max - min)) + min);
        };

        /**
         * round a value to the specified number of digit
         * @public
         * @function
         * @memberOf me.Math
         * @name round
         * @param {number} num value to be rounded.
         * @param {number} [dec=0] number of decimal digit to be rounded to.
         * @return {number} rounded value
         * @example
         * // round a specific value to 2 digits
         * me.Math.round(10.33333, 2); // return 10.33
         */
        api.round = function (num, dec) {
            // if only one argument use the object value
            var powres = Math.pow(10, dec || 0);
            return (~~(0.5 + num * powres) / powres);
        };

        /**
         * check if the given value is close to the expected one
         * @public
         * @function
         * @memberOf me.Math
         * @name toBeCloseTo
         * @param {number} expected value to be compared with.
         * @param {number} actual actual value to compare
         * @param {number} [precision=2] float precision for the comparison
         * @return {boolean} if close to
         * @example
         * // test if the given value is close to 10
         * if (me.Math.toBeCloseTo(10, value)) {
         *     // do something
         * }
         */
        api.toBeCloseTo = function (expected, actual, precision) {
            if (typeof precision !== "number") {
                precision = 2;
            }
            return Math.abs(expected - actual) < (Math.pow(10, -precision) / 2);
        };

        // return our object
        return api;
    })();
})();
