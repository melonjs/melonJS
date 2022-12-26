/*!
 * melonJS Game Engine - v14.1.3
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2022 Olivier Biot (AltByte Pte Ltd)
 */
if (typeof globalThis !== "undefined") {
    if (typeof globalThis.console === "undefined") {
        globalThis.console = {};
        globalThis.console.log = function() {};
        globalThis.console.assert = function() {};
        globalThis.console.warn = function() {};
        globalThis.console.error = function() {
            alert(Array.prototype.slice.call(arguments).join(", "));
        };
    }
}
