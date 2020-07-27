(function (api) {

    /**
     * a collection of string utility functions
     * @namespace me.utils.string
     * @memberOf me
     */
    var string = (function () {
        // hold public stuff in our singleton
        var api = {};

        /**
         * converts the first character of the given string to uppercase
         * @public
         * @function
         * @memberOf me.utils.string
         * @name capitalize
         * @param {String} string the string to be capitalized
         * @return {string} the capitalized string
         */
        api.capitalize = function (str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        };

        /**
         * returns the string stripped of whitespace from the left.
         * @public
         * @function
         * @memberOf me.utils.string
         * @name trimLeft
         * @param {String} string the string to be trimmed
         * @return {string} trimmed string
         */
        api.trimLeft = function (str) {
            return str.replace(/^\s+/, "");
        };

        /**
         * returns the string stripped of whitespace from the right.
         * @public
         * @function
         * @memberOf me.utils.string
         * @name trimRight
         * @param {String} string the string to be trimmed
         * @return {string} trimmed string
         */
        api.trimRight = function (str) {
            return str.replace(/\s+$/, "");
        };

        /**
         * returns true if the given string contains a numeric value
         * @public
         * @function
         * @memberOf me.utils.string
         * @name isNumeric
         * @param {String} string the string to be tested
         * @return {Boolean} true if string contains only digits
         */
        api.isNumeric = function (str) {
            return (!isNaN(str) && str.trim() !== "");
        };

        /**
         * returns true if the given string contains a true or false
         * @public
         * @function
         * @memberOf me.utils.string
         * @name isBoolean
         * @param {String} string the string to be tested
         * @return {Boolean} true if the string is either true or false
         */
        api.isBoolean = function (str) {
            var trimmed = str.trim();
            return (trimmed === "true") || (trimmed === "false");
        };

        /**
         * convert a string to the corresponding hexadecimal value
         * @public
         * @function
         * @memberOf me.utils.string
         * @name toHex
         * @param {String} string the string to be converted
         * @return {String}
         */
        api.toHex = function (str) {
            var res = "", c = 0;
            while (c < str.length) {
                res += str.charCodeAt(c++).toString(16);
            }
            return res;
        };

        // return our object
        return api;
    })();

    api.string = string;

})(me.utils);
