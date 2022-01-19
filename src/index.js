// ES5 polyfills
import "./polyfill/console.js";
import "./polyfill/requestAnimationFrame.js";

// utility classes
import * as audio from "./audio/audio.js";
import collision from "./physics/collision.js";
import device from "./system/device.js";
import * as event from "./system/event.js";
import * as game from "./game.js";
import loader from "./loader/loader.js";
import * as Math from "./math/math.js";
import utils from "./utils/utils.js";
import * as input from "./input/input.js";
import { plugin, plugins } from "./plugin/plugin.js";
import * as video from "./video/video.js";
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
import Polygon from "./geometries/poly.js";
import Line from "./geometries/line.js";
import Ellipse from "./geometries/ellipse.js";
import Rect from "./geometries/rectangle.js";
import QuadTree from "./physics/quadtree.js";
import Body from "./physics/body.js";
import Bounds from "./physics/bounds.js";
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
import ColorLayer from "./renderable/colorlayer.js";
import ImageLayer from "./renderable/imagelayer.js";
import Sprite from "./renderable/sprite.js";
import NineSliceSprite from "./renderable/nineslicesprite.js";
import GUI_Object from "./renderable/GUI.js";
import Collectable from "./renderable/collectable.js";
import Trigger from "./renderable/trigger.js";
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
import Container from "./renderable/container.js";
import World from "./physics/world.js";
import { ParticleEmitterSettings, ParticleEmitter } from "./particles/emitter.js";
import Particle from "./particles/particle.js";
import Entity from "./entity/entity.js";
import DraggableEntity from "./entity/draggable.js";
import DroptargetEntity from "./entity/droptarget.js";



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
    Body,
    Bounds,
    Text,
    BitmapText,
    BitmapTextData,
    ColorLayer,
    ImageLayer,
    Sprite,
    NineSliceSprite,
    GUI_Object,
    Collectable,
    Trigger,
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
    Camera2d,
    Container,
    World,
    ParticleEmitter,
    ParticleEmitterSettings,
    Particle,
    Entity,
    DraggableEntity,
    DroptargetEntity
};

// Backward compatibility for deprecated method or properties
export {
    deprecated
};


/**
 * a flag indicating that melonJS is fully initialized
 * @type {boolean}
 * @default false
 * @readonly
 * @memberof me
 */
export var initialized = false;

/**
 * disable melonJS auto-initialization
 * @type {boolean}
 * @default false
 * @see me.boot
 * @memberof me
 */
export var skipAutoInit = false;

/**
 * initialize the melonJS library.
 * this is automatically called unless me.skipAutoInit is set to true,
 * to allow asynchronous loaders to work.
 * @name boot
 * @memberof me
 * @see me.skipAutoInit
 * @public
 * @function
 */
export function boot() {
    // don't do anything if already initialized (should not happen anyway)
    if (initialized === true) {
        return;
    }

    // register all built-ins objects into the object pool
    pool.register("me.Entity", Entity);
    pool.register("me.Collectable", Collectable);
    pool.register("me.Trigger", Trigger);
    pool.register("me.Tween", Tween, true);
    pool.register("me.Color", Color, true);
    pool.register("me.Particle", Particle, true);
    pool.register("me.Sprite", Sprite);
    pool.register("me.NineSliceSprite", NineSliceSprite);
    pool.register("me.Renderable", Renderable);
    pool.register("me.Text", Text, true);
    pool.register("me.BitmapText", BitmapText);
    pool.register("me.BitmapTextData", BitmapTextData, true);
    pool.register("me.ImageLayer", ImageLayer);
    pool.register("me.ColorLayer", ColorLayer, true);
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
    pool.register("me.Bounds", Bounds, true);

    // duplicate all entries if use with no namespace (e.g. es6)
    pool.register("Entity", Entity);
    pool.register("Collectable", Collectable);
    pool.register("Trigger", Trigger);
    pool.register("Tween", Tween, true);
    pool.register("Color", Color, true);
    pool.register("Particle", Particle, true);
    pool.register("Sprite", Sprite);
    pool.register("NineSliceSprite", NineSliceSprite);
    pool.register("Renderable", Renderable);
    pool.register("Text", Text, true);
    pool.register("BitmapText", BitmapText);
    pool.register("BitmapTextData", BitmapTextData, true);
    pool.register("ImageLayer", ImageLayer);
    pool.register("ColorLayer", ColorLayer, true);
    pool.register("Vector2d", Vector2d, true);
    pool.register("Vector3d", Vector3d, true);
    pool.register("ObservableVector2d", ObservableVector2d, true);
    pool.register("ObservableVector3d", ObservableVector3d, true);
    pool.register("Matrix2d", Matrix2d, true);
    pool.register("Matrix3d", Matrix3d, true);
    pool.register("Rect", Rect, true);
    pool.register("Polygon", Polygon, true);
    pool.register("Line", Line, true);
    pool.register("Ellipse", Ellipse, true);
    pool.register("Bounds", Bounds, true);

    // publish Boot notification
    event.emit(event.BOOT);

    // enable/disable the cache
    loader.setNocache( utils.getUriFragment().nocache || false );

    // automatically enable keyboard events
    input.initKeyboardEvent();

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
