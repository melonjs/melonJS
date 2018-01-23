/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 */
(function (api) {

    /**
     * a collection of array utility functions
     * @namespace me.utils.array
     * @memberOf me
     */
    var array = (function () {
        // hold public stuff in our singleton
        var api = {};

        /**
         * return a random array element
         * @public
         * @function
         * @memberOf me.utils.array
         * @name random
         * @param {array} arr array to pick a element
         * @return {any} random member of array
         * @example
         * // Select a random array element
         * var arr = [ "foo", "bar", "baz" ];
         * console.log(me.utils.array.random(arr));
         */
        api.random = function (arr) {
            return arr[me.Math.random(0, arr.length)];
        };

        /**
         * return a weighted random array element, favoring the earlier entries
         * @public
         * @function
         * @memberOf me.utils.array
         * @name weightedRandom
         * @param {array} arr array to pick a element
         * @return {any} random member of array
         */
        api.weightedRandom = function (arr) {
            return arr[me.Math.weightedRandom(0, arr.length)];
        };

        // return our object
        return api;
    })();

    api.array = array;

})(me.utils);
