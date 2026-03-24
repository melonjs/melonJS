// ES5/ES6 polyfills
import "./polyfill/index.ts";

import Application from "./application/application.js";
import Camera2d from "./camera/camera2d.ts";
import { initKeyboardEvent } from "./input/keyboard.ts";
import Pointer from "./input/pointer.js";
import TMXHexagonalRenderer from "./level/tiled/renderer/TMXHexagonalRenderer.js";
import TMXIsometricRenderer from "./level/tiled/renderer/TMXIsometricRenderer.js";
import TMXOrthogonalRenderer from "./level/tiled/renderer/TMXOrthogonalRenderer.js";
import TMXRenderer from "./level/tiled/renderer/TMXRenderer.js";
import TMXStaggeredRenderer from "./level/tiled/renderer/TMXStaggeredRenderer.js";
import TMXLayer from "./level/tiled/TMXLayer.js";
import Tile from "./level/tiled/TMXTile.js";
import TMXTileMap from "./level/tiled/TMXTileMap.js";
import TMXTileset from "./level/tiled/TMXTileset.js";
import TMXTilesetGroup from "./level/tiled/TMXTilesetGroup.js";
import * as TMXUtils from "./level/tiled/TMXUtils.js";
import { setNocache } from "./loader/loader.js";
import ParticleEmitter from "./particles/emitter.ts";
import Particle from "./particles/particle.ts";
import ParticleEmitterSettings from "./particles/settings.js";
import Body from "./physics/body.js";
// class definition
import QuadTree from "./physics/quadtree.js";
import World from "./physics/world.js";
// utility classes
import { cache as plugins } from "./plugin/plugin.ts";
import Collectable from "./renderable/collectable.js";
import ColorLayer from "./renderable/colorlayer.js";
import Container from "./renderable/container.js";
import { Draggable } from "./renderable/draggable.js";
import { DropTarget } from "./renderable/dragndrop.js";
import Entity from "./renderable/entity/entity.js";
import ImageLayer from "./renderable/imagelayer.js";
import Light2d from "./renderable/light2d.js";
import NineSliceSprite from "./renderable/nineslicesprite.js";
import Renderable from "./renderable/renderable.js";
import Sprite from "./renderable/sprite.js";
import BitmapText from "./renderable/text/bitmaptext.js";
import BitmapTextData from "./renderable/text/bitmaptextdata.ts";
import Text from "./renderable/text/text.js";
import Trigger from "./renderable/trigger.js";
import UIBaseElement from "./renderable/ui/uibaseelement.js";
import UISpriteElement from "./renderable/ui/uispriteelement.js";
import UITextButton from "./renderable/ui/uitextbutton.js";
import Stage from "./state/stage.js";
import state from "./state/state.ts";
import { initVisibilityEvents } from "./system/device.js";
import { DOMContentLoaded } from "./system/dom.ts";
import { BOOT, DOM_READY, eventEmitter } from "./system/event.ts";
import pool from "./system/legacy_pool.js";
import save from "./system/save.ts";
import timer from "./system/timer.ts";
import Tween from "./tweens/tween.ts";
import { getUriFragment } from "./utils/utils.ts";
import { version } from "./version.ts";
import CanvasRenderer from "./video/canvas/canvas_renderer.js";
import Renderer from "./video/renderer.js";
import RenderState from "./video/renderstate.js";
import CanvasRenderTarget from "./video/rendertarget/canvasrendertarget.js";
import { TextureAtlas } from "./video/texture/atlas.js";
import { Batcher } from "./video/webgl/batchers/batcher.js";
import PrimitiveBatcher from "./video/webgl/batchers/primitive_batcher.js";
import QuadBatcher from "./video/webgl/batchers/quad_batcher.js";
import GLShader from "./video/webgl/glshader.js";
import ShaderEffect from "./video/webgl/shadereffect.js";
import WebGLRenderer from "./video/webgl/webgl_renderer.js";

export * from "./application/scaleMethods.ts";
export * from "./application/settings.ts";
// export all utility function
export * as audio from "./audio/audio.ts";
export * as input from "./input/input.js";
export { level } from "./level/level.js";
export * as loader from "./loader/loader.js";
export * as math from "./math/math.ts";
export { collision } from "./physics/collision.js";
export * as plugin from "./plugin/plugin.ts";
export * as device from "./system/device.js";
export * as event from "./system/event.ts";
export * as utils from "./utils/utils.ts";
export * from "./version.ts";
export * as video from "./video/video.js";
export { plugins, save, timer, pool, state };
export { Ellipse } from "./geometries/ellipse.ts";
export { Line } from "./geometries/line.ts";
export { ObservablePoint } from "./geometries/observablePoint.ts";
export { Point } from "./geometries/point.ts";
export { Polygon } from "./geometries/polygon.ts";
export { Rect } from "./geometries/rectangle.ts";
export { RoundRect } from "./geometries/roundrect.ts";
export { Color } from "./math/color.ts";
export { Matrix2d } from "./math/matrix2d.ts";
export { Matrix3d } from "./math/matrix3d.ts";
export { ObservableVector2d } from "./math/observableVector2d.ts";
export { ObservableVector3d } from "./math/observableVector3d.ts";
export { Vector2d } from "./math/vector2d.ts";
export { Vector3d } from "./math/vector3d.ts";
export { Bounds } from "./physics/bounds.ts";
export { getPool } from "./pool.ts";

// export all class definition
export {
	Tween,
	QuadTree,
	GLShader,
	ShaderEffect,
	Batcher,
	PrimitiveBatcher,
	QuadBatcher,
	Renderer,
	RenderState,
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

// export all public constants
export * from "./const.ts";
// Backward compatibility for deprecated method or properties
export * from "./lang/deprecated.js";

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
	console.log("melonJS 2 (v" + version + ") | http://melonjs.org");

	// register all built-ins objects into the object legacy pool
	pool.register("Entity", Entity);
	pool.register("Collectable", Collectable);
	pool.register("Trigger", Trigger);
	pool.register("Light2d", Light2d);
	pool.register("Particle", Particle, true);
	pool.register("Sprite", Sprite);
	pool.register("NineSliceSprite", NineSliceSprite);
	pool.register("Renderable", Renderable);
	pool.register("Text", Text, true);
	pool.register("BitmapText", BitmapText);
	pool.register("ImageLayer", ImageLayer);
	pool.register("Tween", Tween, true);
	pool.register("ColorLayer", ColorLayer, true);

	// publish Boot notification
	eventEmitter.emit(BOOT);

	// enable/disable the cache
	setNocache(getUriFragment().nocache || false);

	// automatically enable keyboard events
	initKeyboardEvent();

	// register blur/focus and visibility change handlers
	initVisibilityEvents();

	// mark melonJS as initialized
	initialized = true;

	// notify that the engine is ready
	eventEmitter.emit(DOM_READY);
}

// call the library init function when ready
DOMContentLoaded(() => {
	if (skipAutoInit === false) {
		boot();
	}
});
