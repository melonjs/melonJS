// ES5 polyfills
import "./polyfill/console.js";
import "./polyfill/requestAnimationFrame.js";

// import all ES6 Class definition
import audio from "./audio/audio.js";
import math from "./math/math.js";
import utils from "./utils/utils.js";

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
    math as Math,
    utils
    // work in progress during the es5->es6 transition
};
