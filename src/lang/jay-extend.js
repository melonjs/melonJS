/**
 * Jay Extend 1.0.1
 * https://github.com/parasyte/jay-extend
 * A super fast prototypal inheritance microlib for the modern web.
 * Copyright (c) 2014-2015 Jay Oster
 *  MIT License
 */

/**
 * Extend a class prototype with the provided mixin descriptors.
 * Designed as a faster replacement for John Resig's Simple Inheritance.
 * @name extend
 * @memberOf Jay
 * @function
 * @param {Object[]} mixins... Each mixin is a dictionary of functions, or a
 * previously extended class whose methods will be applied to the target class
 * prototype.
 * @return {Object}
 * @example
 * var Person = Jay.extend({
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
     * Export the extend method.
     * @ignore
     */
    if (typeof(window) !== "undefined") {
        window.Jay = Jay;
    }
    /*
     TODO : module support in melonJS
    else {
        module.exports = Jay;
    }
    */
})();
