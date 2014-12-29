/**
 * MelonJS Game Engine
 * (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

/**
 * The built in Object object.
 * @external Object
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object|Object}
 */

if (!Object.defineProperty) {
    /**
     * simple defineProperty function definition (if not supported by the browser)<br>
     * if defineProperty is redefined, internally use __defineGetter__/__defineSetter__ as fallback
     * @param {Object} obj The object on which to define the property.
     * @param {string} prop The name of the property to be defined or modified.
     * @param {Object} desc The descriptor for the property being defined or modified.
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

if (typeof Object.create !== "function") {
    /**
     * Prototypal Inheritance Create Helper
     * @name create
     * @memberOf external:Object#
     * @function
     * @param {Object} Object
     * @example
     * // declare oldObject
     * oldObject = new Object();
     * // make some crazy stuff with oldObject (adding functions, etc...)
     * ...
     * ...
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

/**
 * The built in Function Object
 * @external Function
 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function|Function}
 */

if (!Function.prototype.bind) {
    /** @ignore */
    var Empty = function () {};

    /**
     * Binds this function to the given context by wrapping it in another function and returning the wrapper.<p>
     * Whenever the resulting "bound" function is called, it will call the original ensuring that this is set to context. <p>
     * Also optionally curries arguments for the function.
     * @memberof! external:Function#
     * @alias bind
     * @param {Object} context the object to bind to.
     * @param {} [arguments...] Optional additional arguments to curry for the function.
     * @example
     * // Ensure that our callback is triggered with the right object context (this):
     * myObject.onComplete(this.callback.bind(this));
     */
    Function.prototype.bind = function bind(that) {
        // ECMAScript 5 compliant implementation
        // http://es5.github.com/#x15.3.4.5
        // from https://github.com/kriskowal/es5-shim
        var target = this;
        if (typeof target !== "function") {
            throw new TypeError("Function.prototype.bind called on incompatible " + target);
        }
        var args = Array.prototype.slice.call(arguments, 1);
        var bound = function () {
            if (this instanceof bound) {
                var result = target.apply(this, args.concat(Array.prototype.slice.call(arguments)));
                if (Object(result) === result) {
                    return result;
                }
                return this;
            } else {
                return target.apply(that, args.concat(Array.prototype.slice.call(arguments)));
            }
        };
        if (target.prototype) {
            Empty.prototype = target.prototype;
            bound.prototype = new Empty();
            Empty.prototype = null;
        }
        return bound;
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
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
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
    Object.is = function (a, b) {
        if (a === 0 && b === 0) {
            return 1 / a === 1 / b;
        }
        if (a !== a) {
            return b !== b;
        }
        return a === b;
    };
}

if (!Object.assign) {
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

    Object.defineProperty(Object, "assign", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (target) {
            "use strict";
            if (target === undefined || target === null) {
                throw new TypeError("Cannot convert first argument to object");
            }
            var to = Object(target);
            for (var i = 1; i < arguments.length; i++) {
                var nextSource = arguments[i];
                if (nextSource === undefined || nextSource === null) {
                    continue;
                }
                var keysArray = Object.keys(Object(nextSource));
                for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
                    var nextKey = keysArray[nextIndex];
                    var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
                    if (desc !== undefined && desc.enumerable) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
            return to;
        }
    });
}

/**
 * Sourced from: https://gist.github.com/parasyte/9712366
 * Extend a class prototype with the provided mixin descriptors.
 * Designed as a faster replacement for John Resig's Simple Inheritance.
 * @name extend
 * @memberOf external:Object#
 * @function
 * @param {Object[]} mixins... Each mixin is a dictionary of functions, or a
 * previously extended class whose methods will be applied to the target class
 * prototype.
 * @return {Object}
 * @example
 * var Person = Object.extend({
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
    Object.defineProperty(Object.prototype, "extend", {
        "value" : function () {
            var methods = {};
            var mixins = Array.prototype.slice.call(arguments, 0);

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

            return Class;
        }
    });

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
})();
