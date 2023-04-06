/**
 * a collection of string utility functions
 * @namespace utils.string
 */

/**
 * converts the first character of the given string to uppercase
 * @public
 * @memberof utils.string
 * @name capitalize
 * @param {string} str - the string to be capitalized
 * @returns {string} the capitalized string
 */
export function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * returns true if the given string contains a numeric integer or float value
 * @public
 * @memberof utils.string
 * @name isNumeric
 * @param {string} str - the string to be tested
 * @returns {boolean} true if string contains only digits
 */
export function isNumeric(str) {
    if (typeof str === "string") {
        str = str.trim();
    }
    return !isNaN(str) && /^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(str);
}

/**
 * returns true if the given string contains a true or false
 * @public
 * @memberof utils.string
 * @name isBoolean
 * @param {string} str - the string to be tested
 * @returns {boolean} true if the string is either true or false
 */
export function isBoolean(str) {
    const trimmed = str.trim();
    return (trimmed === "true") || (trimmed === "false");
}

/**
 * convert a string to the corresponding hexadecimal value
 * @public
 * @memberof utils.string
 * @name toHex
 * @param {string} str - the string to be converted
 * @returns {string} the converted hexadecimal value
 */
export function toHex(str) {
    let res = "", c = 0;
    while (c < str.length) {
        res += str.charCodeAt(c++).toString(16);
    }
    return res;
}

/**
 * returns true if the given string is a data url in the `data:[<mediatype>][;base64],<data>` format.
 * (this will not test the validity of the Data or Base64 encoding)
 * @public
 * @memberof utils.string
 * @name isDataUrl
 * @param {string} str - the string (url) to be tested
 * @returns {boolean} true if the string is a data url
 */
export function isDataUrl(str) {
    return /^data:(.+);base64,(.+)$/.test(str);
}
