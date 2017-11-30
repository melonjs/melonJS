/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org
 */

/**
 * The built in Object object.
 * @external Object
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object|Object}
 */

/**
 * The base class from which all melonJS objects inherit.
 * See: {@link https://github.com/parasyte/jay-extend}
 * @class
 * @extends external:Object#
 * @memberOf me
 */
me.Object = window.Jay;

/* eslint-disable no-self-compare */
if (!Object.is) {
    /**
     * The Object.is() method determines whether two values are the same value.
     * @name is
     * @memberOf external:Object#
     * @function
     * @param {Object} a The first value to compare
     * @param {Object} b The second value to compare
     * @return {Boolean}
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is|Object.is}
     * @example
     * // Strings are equal
     * var s = "foo";
     * Object.is(s, "foo"); //> true
     *
     * // 0 and -0 are not equal
     * Object.is(0, -0); //>false
     *
     * // NaN and NaN are equal
     * Object.is(NaN, NaN); //> true
     *
     * // Two object references are not equal
     * Object.is({}, {}); //> false
     *
     * // Two vars referencing one object are equal
     * var a = {}, b = a;
     * Object.is(a, b); //> true
     */
    Object.is = function(a, b) {
        // SameValue algorithm
        if (a === b) { // Steps 1-5, 7-10
            // Steps 6.b-6.e: +0 != -0
            return a !== 0 || 1 / a === 1 / b;
        } else {
            // Step 6.a: NaN == NaN
            return a !== a && b !== b;
        }
  };
}

if (!Object.assign) {
    (function () {
        /**
         * The Object.assign() method is used to copy the values of all enumerable own properties from one or more source objects to a target object.
         * The Object.assign method only copies enumerable and own properties from a source object to a target object.
         * It uses [[Get]] on the source and [[Put]] on the target, so it will invoke getters and setters.
         * Therefore it assigns properties versus just copying or defining new properties.
         * This may make it unsuitable for merging new properties into a prototype if the merge sources contain getters.
         * For copying propertiy definitions, including their enumerability, into prototypes Object.getOwnPropertyDescriptor and Object.defineProperty should be used instead.
         * @name assign
         * @memberOf external:Object#
         * @function
         * @param {Object} target The target object.
         * @param {Object[]} sources The source object(s).
         * @return {Object} The target object gets returned.
         * @see {@link https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign}
         * @example
         * // Merging objects
         * var o1 = { a: 1 };
         * var o2 = { b: 2 };
         * var o3 = { c: 3 };
         *
         * var obj = Object.assign(o1, o2, o3);
         * console.log(obj);
         * // { a: 1, b: 2, c: 3 }
         */
        Object.assign = function (target) {
            "use strict";
            // We must check against these specific cases.
            if (target === undefined || target === null) {
                throw new TypeError("Cannot convert undefined or null to object");
            }

            var output = Object(target);
            for (var index = 1; index < arguments.length; index++) {
                var source = arguments[index];
                if (source !== undefined && source !== null) {
                    for (var nextKey in source) {
                        if (source.hasOwnProperty(nextKey)) {
                            output[nextKey] = source[nextKey];
                        }
                    }
                }
                }
            return output;
        };
    })();
};
/* eslint-enable no-self-compare */
