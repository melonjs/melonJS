/**
 * @license MelonJS Game Engine
 * @copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * melonJS is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 *
 */
 
 /**
 * (<b>m</b>)elonJS (<b>e</b>)ngine : All melonJS functions are defined inside
 * of this namespace.
 * <p>You generally should not add new properties to this namespace as it may be
 * overwritten in future versions.</p>
 * @namespace
 */
window.me = window.me || {};

/**
 * Add support for AMD (Asynchronous Module Definition) libraries such as
 * require.js.
 * @ignore
 */
if (typeof define === "function" && define.amd) {
    define("me", [], function () {
        return window.me;
    });
}