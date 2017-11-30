/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org
 */

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
        define(function () { return me; });
    } // CommonJS and Node.js module support.
    else if (typeof exports !== "undefined") {
        // Support Node.js specific `module.exports` (which can be a function)
        if (typeof module !== "undefined" && module.exports) {
            exports = module.exports = me;
        }
        // CommonJS module 1.1.1 spec (`exports` cannot be a function)
        exports.me = me;
    } else {
        global.me = me;
    }
}(this));
/* eslint-enable no-undef */
