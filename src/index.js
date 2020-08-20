// ES5 polyfills
import "./polyfill/console.js";
import "./polyfill/requestAnimationFrame.js";

// utility classes
import audio from "./audio/audio.js";
import game from "./game.js";
import * as Math from "./math/math.js";
import utils from "./utils/utils.js";
import * as input from "./input/input.js";

// class definition
import Color from "./math/color.js";
import Vector2d from "./math/vector2.js";
import Vector3d from "./math/vector3.js";
import ObservableVector2d from "./math/observable_vector2.js";
import ObservableVector3d from "./math/observable_vector3.js";
import GLShader from "./video/webgl/glshader.js";
import WebGLCompositor from "./video/webgl/webgl_compositor.js";

// alias and wrapper for deprecated API
import * as deprecated from "./lang/deprecated.js";

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

// export all utility function
export {
    audio,
    game,
    Math,
    utils,
    input
};

// export all class definition
export {
    Color,
    Vector2d,
    Vector3d,
    ObservableVector2d,
    ObservableVector3d,
    GLShader,
    WebGLCompositor
};

// Backward compatibility for deprecated method or properties are
// automatically applied when generating the UMD module through rollup
export {
    deprecated
};
