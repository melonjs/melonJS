/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import Color from './math/color.js';
import Vector2d from './math/vector2.js';
import Vector3d from './math/vector3.js';
import ObservableVector2d from './math/observable_vector2.js';
import ObservableVector3d from './math/observable_vector3.js';
import Matrix2d from './math/matrix2.js';
import Matrix3d from './math/matrix3.js';
import Polygon from './geometries/poly.js';
import Line from './geometries/line.js';
import Ellipse from './geometries/ellipse.js';
import Point from './geometries/point.js';
import Rect from './geometries/rectangle.js';
import RoundRect from './geometries/roundrect.js';
export { default as QuadTree } from './physics/quadtree.js';
export { default as Body } from './physics/body.js';
import Bounds from './physics/bounds.js';
import Tween from './tweens/tween.js';
export { default as GLShader } from './video/webgl/glshader.js';
export { default as Compositor } from './video/webgl/compositors/compositor.js';
export { default as PrimitiveCompositor } from './video/webgl/compositors/primitive_compositor.js';
export { default as QuadCompositor } from './video/webgl/compositors/quad_compositor.js';
export { default as Renderer } from './video/renderer.js';
export { default as WebGLRenderer } from './video/webgl/webgl_renderer.js';
export { default as CanvasRenderer } from './video/canvas/canvas_renderer.js';
import CanvasRenderTarget from './video/rendertarget/canvasrendertarget.js';
export { TextureAtlas } from './video/texture/atlas.js';
import Renderable from './renderable/renderable.js';
import ColorLayer from './renderable/colorlayer.js';
import ImageLayer from './renderable/imagelayer.js';
import Sprite from './renderable/sprite.js';
import NineSliceSprite from './renderable/nineslicesprite.js';
export { default as UIBaseElement } from './renderable/ui/uibaseelement.js';
export { default as UITextButton } from './renderable/ui/uitextbutton.js';
export { default as UISpriteElement } from './renderable/ui/uispriteelement.js';
import Collectable from './renderable/collectable.js';
import Trigger from './renderable/trigger.js';
import Light2d from './renderable/light2d.js';
import Text from './renderable/text/text.js';
import BitmapText from './renderable/text/bitmaptext.js';
import BitmapTextData from './renderable/text/bitmaptextdata.js';
export { Draggable } from './renderable/draggable.js';
export { DropTarget } from './renderable/dragndrop.js';
export { default as TMXRenderer } from './level/tiled/renderer/TMXRenderer.js';
export { default as TMXOrthogonalRenderer } from './level/tiled/renderer/TMXOrthogonalRenderer.js';
export { default as TMXIsometricRenderer } from './level/tiled/renderer/TMXIsometricRenderer.js';
export { default as TMXHexagonalRenderer } from './level/tiled/renderer/TMXHexagonalRenderer.js';
export { default as TMXStaggeredRenderer } from './level/tiled/renderer/TMXStaggeredRenderer.js';
export { default as Tile } from './level/tiled/TMXTile.js';
export { default as TMXTileset } from './level/tiled/TMXTileset.js';
export { default as TMXTilesetGroup } from './level/tiled/TMXTilesetGroup.js';
export { default as TMXTileMap } from './level/tiled/TMXTileMap.js';
export { default as TMXLayer } from './level/tiled/TMXLayer.js';
import * as TMXUtils from './level/tiled/TMXUtils.js';
export { TMXUtils };
export { default as Pointer } from './input/pointer.js';
export { default as Stage } from './state/stage.js';
export { default as Camera2d } from './camera/camera2d.js';
export { default as Container } from './renderable/container.js';
export { default as World } from './physics/world.js';
export { default as ParticleEmitterSettings } from './particles/settings.js';
export { default as ParticleEmitter } from './particles/emitter.js';
import Particle from './particles/particle.js';
import Entity from './renderable/entity/entity.js';
import Application from './application/application.js';
import * as audio from './audio/audio.js';
export { audio };
export { default as collision } from './physics/collision.js';
import { emit, BOOT } from './system/event.js';
import * as event from './system/event.js';
export { event };
import { onReady } from './system/device.js';
import * as device from './system/device.js';
export { device };
import { setNocache } from './loader/loader.js';
import * as loader from './loader/loader.js';
export { loader };
import * as math from './math/math.js';
export { math as Math };
import { getUriFragment } from './utils/utils.js';
import * as utils from './utils/utils.js';
export { utils };
import * as input from './input/input.js';
export { input };
import * as plugin from './plugin/plugin.js';
export { plugin };
export { cache as plugins } from './plugin/plugin.js';
import * as video from './video/video.js';
export { video };
export { default as save } from './system/save.js';
export { default as timer } from './system/timer.js';
import pool from './system/pooling.js';
export { default as state } from './state/state.js';
export { default as level } from './level/level.js';
export { CanvasTexture, DraggableEntity, DroptargetEntity, GUI_Object } from './lang/deprecated.js';
export { AUTO, CANVAS, WEBGL } from './const.js';
import { initKeyboardEvent } from './input/keyboard.js';

// ES5/ES6 polyfills


/**
 * current melonJS version
 * @static
 * @constant
 * @name version
 * @type {string}
 */
const version = "17.4.0";

/**
 * a flag indicating that melonJS is fully initialized
 * @type {boolean}
 * @default false
 * @readonly
 */
let initialized = false;

/**
 * disable melonJS auto-initialization
 * @type {boolean}
 * @default false
 * @see boot
 */
let skipAutoInit = false;

/**
 * game is a default instance of a melonJS Application and represents your current game,
 * it contains all the objects, tilemap layers, current viewport, collision map, etc...<br>
 * @namespace game
 * @see Application
 */
const game = new Application(0, 0, {legacy:true});

/**
 * initialize the melonJS library.
 * this is automatically called unless me.skipAutoInit is set to true,
 * to allow asynchronous loaders to work.
 * @name boot
 * @see skipAutoInit
 * @public
 */
function boot() {
    // don't do anything if already initialized (should not happen anyway)
    if (initialized === true) {
        return;
    }

    // output melonJS version in the console
    console.log("melonJS 2 (v" + version + ") | http://melonjs.org");

    // register all built-ins objects into the object pool
    pool.register("me.Entity", Entity);
    pool.register("me.Collectable", Collectable);
    pool.register("me.Trigger", Trigger);
    pool.register("me.Light2d", Light2d);
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
    pool.register("me.RoundRect", RoundRect, true);
    pool.register("me.Polygon", Polygon, true);
    pool.register("me.Line", Line, true);
    pool.register("me.Point", Point, true);
    pool.register("me.Ellipse", Ellipse, true);
    pool.register("me.Bounds", Bounds, true);

    // duplicate all entries if use with no namespace (e.g. es6)
    pool.register("Entity", Entity);
    pool.register("Collectable", Collectable);
    pool.register("Trigger", Trigger);
    pool.register("Light2d", Light2d);
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
    pool.register("RoundRect", RoundRect, true);
    pool.register("Polygon", Polygon, true);
    pool.register("Line", Line, true);
    pool.register("Point", Point, true);
    pool.register("Ellipse", Ellipse, true);
    pool.register("Bounds", Bounds, true);
    pool.register("CanvasRenderTarget", CanvasRenderTarget, true);

    // publish Boot notification
    emit(BOOT);

    // enable/disable the cache
    setNocache(getUriFragment().nocache || false);

    // automatically enable keyboard events
    initKeyboardEvent();

    // mark melonJS as initialized
    initialized = true;
}

// call the library init function when ready
onReady(() => {
    {
        boot();
    }
});

export { Application, BitmapText, BitmapTextData, Bounds, CanvasRenderTarget, Collectable, Color, ColorLayer, Ellipse, Entity, ImageLayer, Light2d, Line, Matrix2d, Matrix3d, NineSliceSprite, ObservableVector2d, ObservableVector3d, Particle, Point, Polygon, Rect, Renderable, RoundRect, Sprite, Text, Trigger, Tween, Vector2d, Vector3d, boot, game, initialized, pool, skipAutoInit, version };
