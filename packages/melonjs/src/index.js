// ES5/ES6 polyfills
import "./polyfill/index.ts";

// class definition
import QuadTree from "./physics/quadtree.js";
import Body from "./physics/body.js";
import Tween from "./tweens/tween.ts";
import GLShader from "./video/webgl/glshader.js";
import Compositor from "./video/webgl/compositors/compositor.js";
import PrimitiveCompositor from "./video/webgl/compositors/primitive_compositor.js";
import QuadCompositor from "./video/webgl/compositors/quad_compositor.js";
import Renderer from "./video/renderer.js";
import WebGLRenderer from "./video/webgl/webgl_renderer.js";
import CanvasRenderer from "./video/canvas/canvas_renderer.js";
import CanvasRenderTarget from "./video/rendertarget/canvasrendertarget.js";
import { TextureAtlas } from "./video/texture/atlas.js";
import Renderable from "./renderable/renderable.js";
import ColorLayer from "./renderable/colorlayer.js";
import ImageLayer from "./renderable/imagelayer.js";
import Sprite from "./renderable/sprite.js";
import NineSliceSprite from "./renderable/nineslicesprite.js";
import UIBaseElement from "./renderable/ui/uibaseelement.js";
import UITextButton from "./renderable/ui/uitextbutton.js";
import UISpriteElement from "./renderable/ui/uispriteelement.js";
import Collectable from "./renderable/collectable.js";
import Trigger from "./renderable/trigger.js";
import Light2d from "./renderable/light2d.js";
import Text from "./renderable/text/text.js";
import BitmapText from "./renderable/text/bitmaptext.js";
import BitmapTextData from "./renderable/text/bitmaptextdata.ts";
import { Draggable } from "./renderable/draggable.js";
import { DropTarget } from "./renderable/dragndrop.js";
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
import * as TMXUtils from "./level/tiled/TMXUtils.js";
import Pointer from "./input/pointer.js";
import Stage from "./state/stage.js";
import Camera2d from "./camera/camera2d.js";
import Container from "./renderable/container.js";
import World from "./physics/world.js";
import ParticleEmitterSettings from "./particles/settings.js";
import ParticleEmitter from "./particles/emitter.js";
import Particle from "./particles/particle.ts";
import Entity from "./renderable/entity/entity.js";
import Application from "./application/application.js";

// utility classes
import { cache as plugins } from "./plugin/plugin.js";
import save from "./system/save.ts";
import timer from "./system/timer.ts";
import pool from "./system/legacy_pool.js";
import state from "./state/state.js";
import { BOOT, DOM_READY, eventEmitter } from "./system/event.ts";
import { setNocache } from "./loader/loader.js";
import { initKeyboardEvent } from "./input/keyboard.ts";
import { getUriFragment } from "./utils/utils.ts";
import { onReady } from "./system/device.js";
import { version } from "./version.ts";

// export all utility function
export * as audio from "./audio/audio.js";
export { collision } from "./physics/collision.js";
export * as device from "./system/device.js";
export * as event from "./system/event.ts";
export * as loader from "./loader/loader.js";
export * as math from "./math/math.ts";
export * as utils from "./utils/utils.ts";
export * as input from "./input/input.js";
export * as plugin from "./plugin/plugin.js";
export { level } from "./level/level.js";
export * as video from "./video/video.js";
export * from "./application/scaleMethods.ts";
export * from "./application/settings.ts";
export * from "./version.ts";
export { plugins, save, timer, pool, state };
export { Vector2d } from "./math/vector2d.ts";
export { Vector3d } from "./math/vector3d.ts";
export { Matrix2d } from "./math/matrix2d.ts";
export { Matrix3d } from "./math/matrix3d.ts";
export { Color } from "./math/color.ts";
export { Point } from "./geometries/point.ts";
export { ObservablePoint } from "./geometries/observablePoint.ts";
export { Bounds } from "./physics/bounds.ts";
export { Polygon } from "./geometries/polygon.ts";
export { Line } from "./geometries/line.ts";
export { Rect } from "./geometries/rectangle.ts";
export { RoundRect } from "./geometries/roundrect.ts";
export { Ellipse } from "./geometries/ellipse.ts";
export { ObservableVector2d } from "./math/observableVector2d.ts";
export { ObservableVector3d } from "./math/observableVector3d.ts";
export { getPool } from "./pool.ts";

// export all class definition
export {
	Tween,
	QuadTree,
	GLShader,
	Compositor,
	PrimitiveCompositor,
	QuadCompositor,
	Renderer,
	WebGLRenderer,
	CanvasRenderer,
	CanvasRenderTarget,
	TextureAtlas,
	Renderable,
	Body,
	Text,
	BitmapText,
	BitmapTextData,
	ColorLayer,
	ImageLayer,
	Sprite,
	NineSliceSprite,
	UIBaseElement,
	UITextButton,
	UISpriteElement,
	Collectable,
	Trigger,
	Light2d,
	Draggable,
	DropTarget,
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
	TMXUtils,
	Pointer,
	Stage,
	Camera2d,
	Container,
	World,
	ParticleEmitter,
	ParticleEmitterSettings,
	Particle,
	Entity,
	Application,
};

// Backward compatibility for deprecated method or properties
export * from "./lang/deprecated.js";

// export all public constants
export * from "./const.ts";

/**
 * a flag indicating that melonJS is fully initialized
 * @type {boolean}
 * @default false
 * @readonly
 */
export let initialized = false;

/**
 * disable melonJS auto-initialization
 * @type {boolean}
 * @see {@link boot}
 */
export let skipAutoInit = false;

/**
 * game is a default instance of a melonJS Application and represents your current game,
 * it contains all the objects, tilemap layers, current viewport, collision map, etc...<br>
 * @namespace game
 */
export const game = new Application(0, 0, { legacy: true });

/**
 * initialize the melonJS library.
 * this is automatically called unless me.skipAutoInit is set to true,
 * to allow asynchronous loaders to work.
 * @name boot
 * @see {@link skipAutoInit}
 * @public
 */
export function boot() {
	// don't do anything if already initialized (should not happen anyway)
	if (initialized === true) {
		return;
	}

	// output melonJS version in the console
	if (!("__vitest_browser__" in window)) {
		console.log("melonJS 2 (v" + version + ") | http://melonjs.org");
	}

	// register all built-ins objects into the object legacy pool
	pool.register("me.Entity", Entity);
	pool.register("me.Collectable", Collectable);
	pool.register("me.Trigger", Trigger);
	pool.register("me.Light2d", Light2d);
	pool.register("me.Particle", Particle, true);
	pool.register("me.Sprite", Sprite);
	pool.register("me.NineSliceSprite", NineSliceSprite);
	pool.register("me.Renderable", Renderable);
	pool.register("me.Text", Text, true);
	pool.register("me.BitmapText", BitmapText);
	pool.register("me.ImageLayer", ImageLayer);
	pool.register("me.Tween", Tween);
	pool.register("me.ColorLayer", ColorLayer, true);
	// duplicate all entries if use with no namespace (e.g. es6)
	pool.register("Entity", Entity);
	pool.register("Collectable", Collectable);
	pool.register("Trigger", Trigger);
	pool.register("Light2d", Light2d);
	pool.register("Tween", Tween, true);
	pool.register("Particle", Particle, true);
	pool.register("Sprite", Sprite);
	pool.register("NineSliceSprite", NineSliceSprite);
	pool.register("Renderable", Renderable);
	pool.register("Text", Text, true);
	pool.register("BitmapText", BitmapText);
	pool.register("ImageLayer", ImageLayer);
	pool.register("Tween", Tween);
	pool.register("ColorLayer", ColorLayer, true);

	// publish Boot notification
	eventEmitter.emit(BOOT);

	// enable/disable the cache
	setNocache(getUriFragment().nocache || false);

	// automatically enable keyboard events
	initKeyboardEvent();

	// mark melonJS as initialized
	initialized = true;

	/// if auto init is disable and this function was called manually
	if (skipAutoInit === true) {
		eventEmitter.emit(DOM_READY);
	}
}

// call the library init function when ready
onReady(() => {
	if (skipAutoInit === false) {
		boot();
	}
});
