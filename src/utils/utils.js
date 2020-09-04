import * as agentUtils from "./agent.js";
import * as arrayUtils from "./array.js";
import * as fileUtils from "./file.js";
import * as stringUtils from "./string.js";
import * as fnUtils from "./function.js";
import video from "./../video/video.js";
import CanvasRenderer from "./../video/canvas/canvas_renderer.js";
import { version } from "./../index.js";

/**
 * a collection of utility functions
 * @namespace me.utils
 * @memberOf me
 */

// guid default value
var GUID_base  = "";
var GUID_index = 0;

var utils = {

    agent : agentUtils,
    array : arrayUtils,
    file : fileUtils,
    string : stringUtils,
    function : fnUtils,

    /**
     * Get image pixels
     * @public
     * @function
     * @memberOf me.utils
     * @name getPixels
     * @param {Image|Canvas} image Image to read
     * @return {ImageData} Canvas ImageData object
     */
    getPixels : function (arg) {
        if (arg instanceof HTMLImageElement) {
            var _context = CanvasRenderer.getContext2d(
                video.createCanvas(arg.width, arg.height)
            );
            _context.drawImage(arg, 0, 0);
            return _context.getImageData(0, 0, arg.width, arg.height);
        }
        else {
            // canvas !
            return arg.getContext("2d").getImageData(0, 0, arg.width, arg.height);
        }
    },

    /**
     * Compare two version strings
     * @public
     * @function
     * @memberOf me.utils
     * @name checkVersion
     * @param {String} first First version string to compare
     * @param {String} [second=me.version] Second version string to compare
     * @return {Number} comparison result <br>&lt; 0 : first &lt; second<br>
     * 0 : first == second<br>
     * &gt; 0 : first &gt; second
     * @example
     * if (me.utils.checkVersion("7.0.0") > 0) {
     *     console.error(
     *         "melonJS is too old. Expected: 7.0.0, Got: 6.3.0"
     *     );
     * }
     */
    checkVersion : function (first, second = version) {
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
     * @function
     * @memberOf me.utils
     * @name getUriFragment
     * @param {String} [url=document.location] an optional params string or URL containing fragment (hash) params to be parsed
     * @return {Object} an object representing the deserialized params string.
     * @property {Boolean} [hitbox=false] draw the hitbox in the debug panel (if enabled)
     * @property {Boolean} [velocity=false] draw the entities velocity in the debug panel (if enabled)
     * @property {Boolean} [quadtree=false] draw the quadtree in the debug panel (if enabled)
     * @property {Boolean} [webgl=false] force the renderer to WebGL
     * @property {Boolean} [debug=false] display the debug panel (if preloaded)
     * @property {String} [debugToggleKey="s"] show/hide the debug panel (if preloaded)
     * @example
     * // http://www.example.com/index.html#debug&hitbox=true&mytag=value
     * var UriFragment = me.utils.getUriFragment();
     * console.log(UriFragment["mytag"]); //> "value"
     */
    getUriFragment : (function (url) {
        var UriFragments = {};
        var parsed = false;
        return function (url) {
            var hash;
            if (typeof url === "undefined") {
                hash = UriFragments;
                if (parsed === true) {
                    return hash;
                }
                url = document.location;
                parsed = true;
            } else {
                // never cache if a url is passed as parameter
                hash = {};
            }
            // No "document.location" exist for Wechat mini game platform.
            if (url && url.hash) {
                url.hash.substr(1).split("&").filter(function (value) {
                    return (value !== "");
                }).forEach(function (value) {
                    var kv = value.split("=");
                    var k = kv.shift();
                    var v = kv.join("=");
                    hash[k] = v || true;
                });
            }
            return hash;
        };
    })(),

    /**
     * reset the GUID Base Name
     * the idea here being to have a unique ID
     * per level / object
     * @ignore
     */
    resetGUID : function (base, index = 0) {
        // also ensure it's only 8bit ASCII characters
        GUID_base  = stringUtils.toHex(base.toString().toUpperCase());
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

export default utils;
