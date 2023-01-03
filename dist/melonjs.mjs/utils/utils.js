/*!
 * melonJS Game Engine - v14.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import * as agent from './agent.js';
import * as array from './array.js';
import * as file from './file.js';
import * as string from './string.js';
import { toHex } from './string.js';
import * as _function from './function.js';

/**
 * a collection of utility functions
 * @namespace utils
 */

// guid default value
var GUID_base  = "";
var GUID_index = 0;

var utils = {

    agent : agent,
    array : array,
    file : file,
    string : string,
    function : _function,

    /**
     * Compare two version strings
     * @public
     * @memberof utils
     * @name checkVersion
     * @param {string} first - Ffrst version string to compare
     * @param {string} second - second version string to compare
     * @returns {number} comparison result <br>&lt; 0 : first &lt; second<br>
     * 0 : first == second<br>
     * &gt; 0 : first &gt; second
     * @example
     * if (me.utils.checkVersion("7.0.0") > 0) {
     *     console.error(
     *         "melonJS is too old. Expected: 7.0.0, Got: 6.3.0"
     *     );
     * }
     */
    checkVersion : function (first, second) {
        var a = first.split(".");
        var b = second.split(".");
        var len = Math.min(a.length, b.length);
        var result = 0;

        for (var i = 0; i < len; i++) {
            if ((result = +a[i] - +b[i])) {
                break;
            }
        }

        return result ? result : a.length - b.length;
    },

    /**
     * parse the fragment (hash) from a URL and returns them into
     * @public
     * @memberof utils
     * @name getUriFragment
     * @param {string} [url=document.location] - an optional params string or URL containing fragment (hash) params to be parsed
     * @returns {object} an object representing the deserialized params string.
     * @property {boolean} [hitbox=false] draw the hitbox in the debug panel (if enabled)
     * @property {boolean} [velocity=false] draw the entities velocity in the debug panel (if enabled)
     * @property {boolean} [quadtree=false] draw the quadtree in the debug panel (if enabled)
     * @property {boolean} [webgl=false] force the renderer to WebGL
     * @property {boolean} [debug=false] display the debug panel (if preloaded)
     * @property {string} [debugToggleKey="s"] show/hide the debug panel (if preloaded)
     * @example
     * // http://www.example.com/index.html#debug&hitbox=true&mytag=value
     * var UriFragment = me.utils.getUriFragment();
     * console.log(UriFragment["mytag"]); //> "value"
     */
    getUriFragment : function (url) {
        var hash = {};

        if (typeof url === "undefined") {
            if (typeof globalThis.document !== "undefined") {
                var location = globalThis.document.location;

                if (location && location.hash) {
                    url = location.hash;
                } else {
                    // No "document.location" exist for Wechat mini game platform.
                    return hash;
                }
            } else {
                // "document" undefined on node.js
                return hash;
            }
        } else {
            // never cache if a url is passed as parameter
            var index = url.indexOf("#");
            if (index !== -1) {
                url = url.slice(index, url.length);
            } else {
                return hash;
            }
        }

        // parse the url
        url.slice(1).split("&").filter((value) => {
            return (value !== "");
        }).forEach((value) => {
            var kv = value.split("=");
            var k = kv.shift();
            var v = kv.join("=");
            hash[k] = v || true;
        });

        return hash;
    },

    /**
     * reset the GUID Base Name
     * the idea here being to have a unique ID
     * per level / object
     * @ignore
     */
    resetGUID : function (base, index = 0) {
        // also ensure it's only 8bit ASCII characters
        GUID_base  = toHex(base.toString().toUpperCase());
        GUID_index = index;
    },

    /**
     * create and return a very simple GUID
     * Game Unique ID
     * @ignore
     */
    createGUID : function (index = 1) {
        // to cover the case of undefined id for groups
        GUID_index += index;
        return GUID_base + "-" + (index || GUID_index);
    }
};

var utils$1 = utils;

export { utils$1 as default };
