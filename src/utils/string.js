/**
 * a collection of string utility functions
 * @namespace me.utils.string
 * @memberOf me
 */


/**
 * converts the first character of the given string to uppercase
 * @public
 * @function
 * @memberOf me.utils.string
 * @name capitalize
 * @param {String} string the string to be capitalized
 * @return {string} the capitalized string
 */
export function capitalize(str) {
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
export function trimLeft(str) {
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
export function trimRight(str) {
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
export function isNumeric(str) {
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
export function isBoolean(str) {
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
export function toHex(str) {
    var res = "", c = 0;
    while (c < str.length) {
        res += str.charCodeAt(c++).toString(16);
    }
    return res;
};
