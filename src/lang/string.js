/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/**
 * The built in String Object
 * @external String
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String|String}
 */

/* eslint-disable no-extend-native, yoda */

if (!String.prototype.trim) {
    if (!String.prototype.trim) {
      (function() {
        // Make sure we trim BOM and NBSP
        var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
        /**
         * removes whitespace from both ends of a string. Whitespace in this context is all the whitespace characters (space, tab, no-break space, etc.) and all the line terminator characters (LF, CR, etc.).
         * @memberof! external:String#
         * @alias trim
         * @return {string} the string stripped of whitespace from both ends.
         */
        String.prototype.trim = function() {
          return this.replace(rtrim, "");
        };
      })();
    }
}

if (!String.prototype.trimLeft) {
    /**
     * returns the string stripped of whitespace from the left.
     * @memberof! external:String#
     * @alias trimLeft
     * @return {string} trimmed string
     */
    String.prototype.trimLeft = function () {
        return this.replace(/^\s+/, "");
    };
}

if (!String.prototype.trimRight) {
    /**
     * returns the string stripped of whitespace from the right.
     * @memberof! external:String#
     * @alias trimRight
     * @return {string} trimmed string
     */
    String.prototype.trimRight = function () {
        return this.replace(/\s+$/, "");
    };
}

/**
 * add isNumeric fn to the string object
 * @memberof! external:String#
 * @alias isNumeric
 * @return {boolean} true if string contains only digits
 */
String.prototype.isNumeric = function () {
    return (!isNaN(this) && this.trim() !== "");
};

/**
 * add a isBoolean fn to the string object
 * @memberof! external:String#
 * @alias isBoolean
 * @return {boolean} true if the string is either true or false
 */
String.prototype.isBoolean = function () {
    var trimmed = this.trim();
    return ("true" === trimmed) || ("false" === trimmed);
};

if (!String.prototype.includes) {
    /**
     * determines whether one string may be found within another string.
     * @memberof! external:String#
     * @alias includes
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
     * @param {string} searchString A string to be searched for within this string.
     * @param {number} [position=0] The position in this string at which to begin searching for the given string.
     * @return {boolean} true if contains the specified string
     */
  String.prototype.includes = function() {
    return String.prototype.indexOf.apply(this, arguments) !== -1;
  };
}

/**
 * convert the string to hex value
 * @memberof! external:String#
 * @alias toHex
 * @return {string}
 */
String.prototype.toHex = function () {
    var res = "", c = 0;
    while (c < this.length) {
        res += this.charCodeAt(c++).toString(16);
    }
    return res;
};
/* eslint-enable no-extend-native */
