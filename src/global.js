/* eslint-disable no-undef */
(function (global) {
    "use strict";

   /**
    * (<b>m</b>)elonJS (<b>e</b>)ngine : All melonJS functions are defined inside
    * of this namespace.
    * <p>You generally should not add new properties to this namespace as it may be
    * overwritten in future versions.</p>
    * @name me
    * @namespace
    */
    var me = {};

    // support for AMD (Asynchronous Module Definition) libraries
    if (typeof define === "function" && define.amd) {
        define([], function() {
            return {
                me: me
            };
        });
    } // CommonJS and Node.js module support.
    else if (typeof exports !== "undefined") {
        // Support Node.js specific `module.exports` (which can be a function)
        if (typeof module !== "undefined" && module.exports) {
            exports = module.exports = me;
        }
        // CommonJS module 1.1.1 spec (`exports` cannot be a function)
        exports.me = me;
    }
    // in case AMD not available or unused
    if (typeof window !== "undefined") {
        window.me = me;
    } else if (typeof global !== "undefined") {
        // Add to global in Node.js (for testing, etc).
        global.me = me;
    }
}(window));
/* eslint-enable no-undef */
