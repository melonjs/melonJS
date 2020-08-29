// ES5 polyfills
import "./polyfill/console.js";
import "./polyfill/requestAnimationFrame.js";

// external dependencies
import "jay-extend";
// jay-extend does not properly export Jay
var Jay = window.Jay;

// utility classes
import audio from "./audio/audio.js";
import collision from "./physics/collision.js";
import device from "./system/device.js";
import event from "./system/event.js";
import game from "./game.js";
import loader from "./loader/loader.js";
import * as Math from "./math/math.js";
import utils from "./utils/utils.js";
import * as input from "./input/input.js";
import { plugin, plugins } from "./plugin/plugin.js";
import video from "./video/video.js";
import save from "./system/save.js";
import timer from "./system/timer.js";
import pool from "./system/pooling.js";
import state from "./state/state.js";
import level from "./level/level.js";

// class definition
import Color from "./math/color.js";
import Vector2d from "./math/vector2.js";
import Vector3d from "./math/vector3.js";
import ObservableVector2d from "./math/observable_vector2.js";
import ObservableVector3d from "./math/observable_vector3.js";
import Matrix2d from "./math/matrix2.js";
import Matrix3d from "./math/matrix3.js";
import Polygon from "./shapes/poly.js";
import Line from "./shapes/line.js";
import Ellipse from "./shapes/ellipse.js";
import Rect from "./shapes/rectangle.js";
import QuadTree from "./physics/quadtree.js";
import Tween from "./tweens/tween.js";
import GLShader from "./video/webgl/glshader.js";
import WebGLCompositor from "./video/webgl/webgl_compositor.js";
import Renderer from "./video/renderer.js";
import WebGLRenderer from "./video/webgl/webgl_renderer.js";
import CanvasRenderer from "./video/canvas/canvas_renderer.js";
import Renderable from "./renderable/renderable.js";
import Text from "./text/text.js";
import BitmapText from "./text/bitmaptext.js";
import BitmapTextData from "./text/bitmaptextdata.js";
import TMXRenderer from "./level/tiled/renderer/TMXRenderer.js";
import TMXOrthogonalRenderer from "./level/tiled/renderer/TMXOrthogonalRenderer.js";
import TMXIsometricRenderer from "./level/tiled/renderer/TMXIsometricRenderer.js";
import TMXHexagonalRenderer from "./level/tiled/renderer/TMXHexagonalRenderer.js";
import TMXStaggeredRenderer from "./level/tiled/renderer/TMXStaggeredRenderer.js";
import Tile from "./level/tiled/TMXTile.js";
import TMXTileset from "./level/tiled/TMXTileset.js";
import TMXTilesetGroup from "./level/tiled/TMXTilesetGroup.js";
import TMXTileMap from "./level/tiled/TMXTileMap.js";
import TMXLayer from "./level/tiled/TMXLayer.js";
import Pointer from "./input/pointer.js";
import Stage from "./state/stage.js";
import Camera2d from "./camera/camera2d.js";


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
    collision,
    device,
    event,
    game,
    loader,
    level,
    input,
    Math,
    plugin,
    plugins,
    utils,
    save,
    timer,
    pool,
    state,
    video
};

// export all class definition
export {
    // export as me.Object for backward compatibility
    Jay as Object,
    Color,
    Vector2d,
    Vector3d,
    ObservableVector2d,
    ObservableVector3d,
    Matrix2d,
    Matrix3d,
    Polygon,
    Line,
    Ellipse,
    Rect,
    Tween,
    QuadTree,
    GLShader,
    WebGLCompositor,
    Renderer,
    WebGLRenderer,
    CanvasRenderer,
    Renderable,
    Text,
    BitmapText,
    BitmapTextData,
    TMXRenderer,
    TMXOrthogonalRenderer,
    TMXIsometricRenderer,
    TMXHexagonalRenderer,
    TMXStaggeredRenderer,
    Tile,
    TMXTileset,
    TMXTilesetGroup,
    TMXTileMap,
    TMXLayer,
    Pointer,
    Stage,
    Camera2d
};

// Backward compatibility for deprecated method or properties are
// automatically applied when generating the UMD module through rollup
export {
    deprecated
};


/**
* a flag indicating that melonJS is fully initialized
* @type {Boolean}
* @default false
* @readonly
* @memberOf me
*/
export var initialized = false;

/**
 * disable melonJS auto-initialization
 * @type {Boolean}
 * @default false
 * @see me.boot
 * @memberOf me
 */
export var skipAutoInit = false;

/**
 * initialize the melonJS library.
 * this is automatically called unless me.skipAutoInit is set to true,
 * to allow asynchronous loaders to work.
 * @name boot
 * @memberOf me
 * @see me.skipAutoInit
 * @public
 * @function
 */
export function boot() {
    // don't do anything if already initialized (should not happen anyway)
    if (initialized === true) {
        return;
    }

    // check the device capabilites
    device._check();

    // register all built-ins objects into the object pool
    pool.register("me.Entity", me.Entity);
    pool.register("me.CollectableEntity", me.CollectableEntity);
    pool.register("me.LevelEntity", me.LevelEntity);
    pool.register("me.Tween", Tween, true);
    pool.register("me.Color", Color, true);
    pool.register("me.Particle", me.Particle, true);
    pool.register("me.Sprite", me.Sprite);
    pool.register("me.Text", Text, true);
    pool.register("me.BitmapText", BitmapText, true);
    pool.register("me.BitmapTextData", BitmapTextData, true);
    pool.register("me.ImageLayer", me.ImageLayer, true);
    pool.register("me.ColorLayer", me.ColorLayer, true);
    pool.register("me.Vector2d", Vector2d, true);
    pool.register("me.Vector3d", Vector3d, true);
    pool.register("me.ObservableVector2d", ObservableVector2d, true);
    pool.register("me.ObservableVector3d", ObservableVector3d, true);
    pool.register("me.Matrix2d", Matrix2d, true);
    pool.register("me.Matrix3d", Matrix3d, true);
    pool.register("me.Rect", Rect, true);
    pool.register("me.Polygon", Polygon, true);
    pool.register("me.Line", Line, true);
    pool.register("me.Ellipse", Ellipse, true);

    // if use with no namespace (e.g. es6)
    pool.register("Tween", Tween, true);
    pool.register("Color", Color, true);
    pool.register("Vector2d", Vector2d, true);
    pool.register("Vector3d", Vector3d, true);
    pool.register("ObservableVector2d", ObservableVector2d, true);
    pool.register("ObservableVector3d", ObservableVector3d, true);
    pool.register("Matrix2d", Matrix2d, true);
    pool.register("Matrix3d", Matrix3d, true);
    pool.register("BitmapTextData", BitmapTextData, true);

    // initialize me.save
    save.init();

    // init the FPS counter if needed
    timer.init();

    // enable/disable the cache
    me.loader.setNocache( utils.getUriFragment().nocache || false );

    // init the stage Manager
    state.init();

    // automatically enable keyboard events
    input.initKeyboardEvent();

    // game instance init
    game.init();

    // mark melonJS as initialized
    initialized = true;

    /// if auto init is disable and this function was called manually
    if (skipAutoInit === true) {
        device._domReady();
    }
};

// call the library init function when ready
device.onReady(function () {
    if (skipAutoInit === false) {
       boot();
    }
});
