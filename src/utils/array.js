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
         * Remove the specified object from the given Array
         * @public
         * @function
         * @memberOf me.utils.array
         * @name remove
         * @param {Array} arr array from which to remove an object
         * @param {Object} object to be removed
         * @return {Array} the modified Array
         */
        api.remove = function (arr, obj) {
            var i = Array.prototype.indexOf.call(arr, obj);
            if (i !== -1) {
                Array.prototype.splice.call(arr, i, 1);
            }
            return arr;
        };


        /**
         * return a random array element
         * @public
         * @function
         * @memberOf me.utils.array
         * @name random
         * @param {Array} arr array to pick a element
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
         * @param {Array} arr array to pick a element
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
