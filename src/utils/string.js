/**
 * a collection of string utility functions
 * @namespace me.utils.string
 * @memberof me
 */


/**
 * converts the first character of the given string to uppercase
 * @public
 * @function
 * @memberof me.utils.string
 * @name capitalize
 * @param {string} str the string to be capitalized
 * @returns {string} the capitalized string
 */
export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * returns the string stripped of whitespace from the left.
 * @public
 * @function
 * @memberof me.utils.string
 * @name trimLeft
 * @param {string} str the string to be trimmed
 * @returns {string} trimmed string
 */
export function trimLeft(str) {
    return str.replace(/^\s+/, "");
};

/**
 * returns the string stripped of whitespace from the right.
 * @public
 * @function
 * @memberof me.utils.string
 * @name trimRight
 * @param {string} str the string to be trimmed
 * @returns {string} trimmed string
 */
export function trimRight(str) {
    return str.replace(/\s+$/, "");
};

/**
 * returns true if the given string contains a numeric integer or float value
 * @public
 * @function
 * @memberof me.utils.string
 * @name isNumeric
 * @param {string} str the string to be tested
 * @returns {boolean} true if string contains only digits
 */
export function isNumeric(str) {
    if (typeof str === "string") {
        str = str.trim();
    }
    return !isNaN(str) && /[+-]?([0-9]*[.])?[0-9]+/.test(str);
};

/**
 * returns true if the given string contains a true or false
 * @public
 * @function
 * @memberof me.utils.string
 * @name isBoolean
 * @param {string} str the string to be tested
 * @returns {boolean} true if the string is either true or false
 */
export function isBoolean(str) {
    var trimmed = str.trim();
    return (trimmed === "true") || (trimmed === "false");
};

/**
 * convert a string to the corresponding hexadecimal value
 * @public
 * @function
 * @memberof me.utils.string
 * @name toHex
 * @param {string} str the string to be converted
 * @returns {string} the converted hexadecimal value
 */
export function toHex(str) {
    var res = "", c = 0;
    while (c < str.length) {
        res += str.charCodeAt(c++).toString(16);
    }
    return res;
};
