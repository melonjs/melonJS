// ES5 polyfills
import "./polyfill/console.js";
import "./polyfill/requestAnimationFrame.js";

// import all classes declaration
import audio from "./audio/audio.js";
import game from "./game.js";
import * as Math from "./math/math.js";
import utils from "./utils/utils.js";
import deprecated from "./lang/deprecated";

/**
* (<b>m</b>)elonJS (<b>e</b>)ngine : All melonJS functions are defined inside this namespace.
* You generally should not add new properties to this namespace as it may be overwritten in future versions.
* @namespace me
*/

/**
 * current melonJS version
 * @static
 * @constant
 * @memberof me
 * @name version
 * @type {string}
 */
export const version = "__VERSION__";

// namespace "me" will be created by rollup automatically
// export everything
export {
    audio,
    game,
    Math,
    utils
};

// Backward compatibility for deprecated method or properties are
// automatically applied when generating the UMD module through rollup
export {
    deprecated
};
