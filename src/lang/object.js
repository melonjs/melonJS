/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/**
 * The built in Object object.
 * @external Object
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object|Object}
 */

/* eslint-disable no-self-compare */

if (!Object.defineProperty) {
    /**
     * simple defineProperty function definition (if not supported by the browser)<br>
     * if defineProperty is redefined, internally use __defineGetter__/__defineSetter__ as fallback
     * @param {Object} obj The object on which to define the property.
     * @param {string} prop The name of the property to be defined or modified.
     * @param {Object} desc The descriptor for the property being defined or modified.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty|Object.defineProperty}
     */
    Object.defineProperty = function (obj, prop, desc) {
        // check if Object support __defineGetter function
        if (obj.__defineGetter__) {
            if (desc.get) {
                obj.__defineGetter__(prop, desc.get);
            }
            if (desc.set) {
                obj.__defineSetter__(prop, desc.set);
            }
        } else {
            // we should never reach this point....
            throw new TypeError("Object.defineProperty not supported");
        }
    };
}

if (!Object.create) {
    /**
     * Prototypal Inheritance Create Helper
     * @name create
     * @memberOf external:Object#
     * @function
     * @param {Object} o
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create|Object.create}
     * @example
     * // declare oldObject
     * oldObject = new Object();
     * // make some crazy stuff with oldObject (adding functions, etc...)
     * // ...
     *
     * // make newObject inherits from oldObject
     * newObject = Object.create(oldObject);
     */
    Object.create = function (o) {
        var Fn = function () {};
        Fn.prototype = o;
        return new Fn();
    };
}

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
}

/**
 * Extend a class prototype with the provided mixin descriptors.
 * Designed as a faster replacement for John Resig's Simple Inheritance.
 * @name extend
 * @memberOf me.Object
 * @function
 * @param {Object[]} mixins... Each mixin is a dictionary of functions, or a
 * previously extended class whose methods will be applied to the target class
 * prototype.
 * @return {Object}
 * @example
 * var Person = me.Object.extend({
 *     "init" : function (isDancing) {
 *         this.dancing = isDancing;
 *     },
 *     "dance" : function () {
 *         return this.dancing;
 *     }
 * });
 *
 * var Ninja = Person.extend({
 *     "init" : function () {
 *         // Call the super constructor, passing a single argument
 *         this._super(Person, "init", [false]);
 *     },
 *     "dance" : function () {
 *         // Call the overridden dance() method
 *         return this._super(Person, "dance");
 *     },
 *     "swingSword" : function () {
 *         return true;
 *     }
 * });
 *
 * var Pirate = Person.extend(Ninja, {
 *     "init" : function () {
 *         // Call the super constructor, passing a single argument
 *         this._super(Person, "init", [true]);
 *     }
 * });
 *
 * var p = new Person(true);
 * console.log(p.dance()); // => true
 *
 * var n = new Ninja();
 * console.log(n.dance()); // => false
 * console.log(n.swingSword()); // => true
 *
 * var r = new Pirate();
 * console.log(r.dance()); // => true
 * console.log(r.swingSword()); // => true
 *
 * console.log(
 *     p instanceof Person &&
 *     n instanceof Ninja &&
 *     n instanceof Person &&
 *     r instanceof Pirate &&
 *     r instanceof Person
 * ); // => true
 *
 * console.log(r instanceof Ninja); // => false
 */
(function () {
    function extend() {
        var methods = {};
        var mixins = new Array(arguments.length);
        for (var i = 0; i < arguments.length; i++) {
            mixins.push(arguments[i]);
        }

        /**
         * The class constructor which calls the user `init` constructor.
         * @ignore
         */
        function Class() {
            // Call the user constructor
            this.init.apply(this, arguments);
            return this;
        }

        // Apply superClass
        Class.prototype = Object.create(this.prototype);

        // Apply all mixin methods to the class prototype
        mixins.forEach(function (mixin) {
            apply_methods(Class, methods, mixin.__methods__ || mixin);
        });

        // Verify constructor exists
        if (!("init" in Class.prototype)) {
            throw new TypeError(
                "extend: Class is missing a constructor named `init`"
            );
        }

        // Apply syntactic sugar for accessing methods on super classes
        Object.defineProperty(Class.prototype, "_super", {
            "value" : _super
        });

        // Create a hidden property on the class itself
        // List of methods, used for applying classes as mixins
        Object.defineProperty(Class, "__methods__", {
            "value" : methods
        });

        // Make this class extendable
        Class.extend = extend;

        return Class;
    }

    /**
     * Apply methods to the class prototype.
     * @ignore
     */
    function apply_methods(Class, methods, descriptor) {
        Object.keys(descriptor).forEach(function (method) {
            methods[method] = descriptor[method];

            if (typeof(descriptor[method]) !== "function") {
                throw new TypeError(
                    "extend: Method `" + method + "` is not a function"
                );
            }

            Object.defineProperty(Class.prototype, method, {
                "configurable" : true,
                "value" : descriptor[method]
            });
        });
    }

    /**
     * Special method that acts as a proxy to the super class.
     * @name _super
     * @ignore
     */
    function _super(superClass, method, args) {
        return superClass.prototype[method].apply(this, args);
    }

    /**
     * The base class from which all jay-extend classes inherit.
     * @ignore
     */
    var Jay = function () {
        Object.apply(this, arguments);
    };
    Jay.prototype = Object.create(Object.prototype);
    Jay.prototype.constructor = Jay;

    Object.defineProperty(Jay, "extend", {
        "value" : extend
    });

    /**
     * The base class from which all melonJS objects inherit.
     * See: {@link https://github.com/parasyte/jay-extend}
     * @class
     * @extends external:Object#
     * @memberOf me
     */
    me.Object = Jay;
})();
/* eslint-enable no-self-compare */
