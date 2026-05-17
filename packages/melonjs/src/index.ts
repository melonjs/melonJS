// ES5/ES6 polyfills
import "./polyfill/index.ts";

import Application, { setDefaultGame } from "./application/application.ts";
import Camera2d from "./camera/camera2d.ts";
import CameraEffect from "./camera/effects/camera_effect.ts";
import FadeEffect from "./camera/effects/fade_effect.ts";
import MaskEffect from "./camera/effects/mask_effect.ts";
import ShakeEffect from "./camera/effects/shake_effect.ts";
import Pointer from "./input/pointer.ts";
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
import { ColorMatrix } from "./math/color_matrix.ts";
import ParticleEmitter from "./particles/emitter.ts";
import Particle from "./particles/particle.ts";
import ParticleEmitterSettings from "./particles/settings.js";
import Body from "./physics/builtin/body.js";
// class definition
import QuadTree from "./physics/builtin/quadtree.js";
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
import Mesh from "./renderable/mesh.js";
import NineSliceSprite from "./renderable/nineslicesprite.js";
import Renderable from "./renderable/renderable.js";
import Sprite from "./renderable/sprite.js";
import BitmapText from "./renderable/text/bitmaptext.js";
import BitmapTextData from "./renderable/text/bitmaptextdata.ts";
import Text from "./renderable/text/text.js";
import Trail from "./renderable/trail.js";
import Trigger from "./renderable/trigger.js";
import UIBaseElement from "./renderable/ui/uibaseelement.ts";
import UISpriteElement from "./renderable/ui/uispriteelement.ts";
import UITextButton from "./renderable/ui/uitextbutton.ts";
import Stage from "./state/stage.ts";
import state from "./state/state.ts";
import { boot } from "./system/bootstrap.ts";
import { DOMContentLoaded } from "./system/dom.ts";
import pool from "./system/legacy_pool.js";
import save from "./system/save.ts";
import timer from "./system/timer.ts";
import Tween from "./tweens/tween.ts";
import CanvasRenderer from "./video/canvas/canvas_renderer.js";
import { Gradient } from "./video/gradient.js";
import Renderer from "./video/renderer.js";
import RenderState from "./video/renderstate.js";
import CanvasRenderTarget from "./video/rendertarget/canvasrendertarget.js";
import RenderTarget from "./video/rendertarget/rendertarget.ts";
import { TextureAtlas } from "./video/texture/atlas.js";
import { Batcher } from "./video/webgl/batchers/batcher.js";
import PrimitiveBatcher from "./video/webgl/batchers/primitive_batcher.js";
import QuadBatcher from "./video/webgl/batchers/quad_batcher.js";
import BlurEffect from "./video/webgl/effects/blur.js";
import ChromaticAberrationEffect from "./video/webgl/effects/chromaticAberration.js";
import ColorMatrixEffect from "./video/webgl/effects/colorMatrix.js";
import DesaturateEffect from "./video/webgl/effects/desaturate.js";
import DissolveEffect from "./video/webgl/effects/dissolve.js";
import DropShadowEffect from "./video/webgl/effects/dropShadow.js";
import FlashEffect from "./video/webgl/effects/flash.js";
import GlowEffect from "./video/webgl/effects/glow.js";
import HologramEffect from "./video/webgl/effects/hologram.js";
import InvertEffect from "./video/webgl/effects/invert.js";
import OutlineEffect from "./video/webgl/effects/outline.js";
import PixelateEffect from "./video/webgl/effects/pixelate.js";
import ScanlineEffect from "./video/webgl/effects/scanline.js";
import SepiaEffect from "./video/webgl/effects/sepia.js";
import ShineEffect from "./video/webgl/effects/shine.js";
import TintPulseEffect from "./video/webgl/effects/tintPulse.js";
import VignetteEffect from "./video/webgl/effects/vignette.js";
import WaveEffect from "./video/webgl/effects/wave.js";
import GLShader from "./video/webgl/glshader.js";
import ShaderEffect from "./video/webgl/shadereffect.js";
import WebGLRenderer from "./video/webgl/webgl_renderer.js";

export * from "./application/scaleMethods.ts";
export * from "./application/settings.ts";
// export all utility function
export * as audio from "./audio/audio.ts";
// export all public constants
export * from "./const.ts";
export { Ellipse } from "./geometries/ellipse.ts";
export { Line } from "./geometries/line.ts";
export { ObservablePoint } from "./geometries/observablePoint.ts";
export { Point } from "./geometries/point.ts";
export { Polygon } from "./geometries/polygon.ts";
export { Rect } from "./geometries/rectangle.ts";
export { RoundRect } from "./geometries/roundrect.ts";
export * as input from "./input/input.ts";
// Backward compatibility for deprecated method or properties
export * from "./lang/deprecated.js";
export { level } from "./level/level.js";
export {
	registerTiledObjectClass,
	registerTiledObjectFactory,
} from "./level/tiled/TMXObjectFactory.js";

export * as loader from "./loader/loader.js";
export { Color } from "./math/color.ts";
export * as math from "./math/math.ts";
export { Matrix2d } from "./math/matrix2d.ts";
export { Matrix3d } from "./math/matrix3d.ts";
export { ObservableVector2d } from "./math/observableVector2d.ts";
export { ObservableVector3d } from "./math/observableVector3d.ts";
export { Vector2d } from "./math/vector2d.ts";
export { Vector3d } from "./math/vector3d.ts";
export type {
	AdapterCapabilities,
	AdapterOptions,
	BodyDefinition,
	BodyShape,
	BodyType,
	CollisionResponse,
	PhysicsAdapter,
	PhysicsBody,
	RaycastHit,
} from "./physics/adapter.ts";
export { Bounds } from "./physics/bounds.ts";
export { default as BuiltinAdapter } from "./physics/builtin/builtin-adapter.js";
export { collision } from "./physics/collision.js";
export * as plugin from "./plugin/plugin.ts";
export { getPool } from "./pool.ts";
export * as device from "./system/device.js";
export * as event from "./system/event.ts";
export * as utils from "./utils/utils.ts";
export * from "./version.ts";
export * as video from "./video/video.js";
// export all class definition
export {
	Application,
	Batcher,
	BitmapText,
	BitmapTextData,
	BlurEffect,
	Body,
	Camera2d,
	CameraEffect,
	CanvasRenderer,
	CanvasRenderTarget,
	ChromaticAberrationEffect,
	Collectable,
	ColorLayer,
	ColorMatrix,
	ColorMatrixEffect,
	Container,
	DesaturateEffect,
	DissolveEffect,
	Draggable,
	DropShadowEffect,
	DropTarget,
	Entity, // eslint-disable-line @typescript-eslint/no-deprecated
	FadeEffect,
	FlashEffect,
	GLShader,
	GlowEffect,
	Gradient,
	HologramEffect,
	ImageLayer,
	InvertEffect,
	Light2d,
	MaskEffect,
	Mesh,
	NineSliceSprite,
	OutlineEffect,
	Particle,
	ParticleEmitter,
	ParticleEmitterSettings,
	PixelateEffect,
	Pointer,
	PrimitiveBatcher,
	plugins,
	pool,
	QuadBatcher,
	QuadTree,
	Renderable,
	Renderer,
	RenderState,
	RenderTarget,
	ScanlineEffect,
	SepiaEffect,
	ShaderEffect,
	ShakeEffect,
	ShineEffect,
	Sprite,
	Stage,
	save,
	state,
	Text,
	TextureAtlas,
	Tile,
	TintPulseEffect,
	TMXHexagonalRenderer,
	TMXIsometricRenderer,
	TMXLayer,
	TMXOrthogonalRenderer,
	TMXRenderer,
	TMXStaggeredRenderer,
	TMXTileMap,
	TMXTileset,
	TMXTilesetGroup,
	TMXUtils,
	Trail,
	Trigger,
	Tween,
	timer,
	UIBaseElement,
	UISpriteElement,
	UITextButton,
	VignetteEffect,
	WaveEffect,
	WebGLRenderer,
	World,
};

/**
 * disable melonJS auto-initialization
 * @see {@link boot}
 */
// eslint-disable-next-line prefer-const
export let skipAutoInit = false;

export { initialized } from "./system/bootstrap.ts";

// create and register the default game application instance
setDefaultGame(new Application(0, 0, { legacy: true }));

export { game } from "./application/application.ts";

/**
 * initialize the melonJS library.
 * this is automatically called unless skipAutoInit is set to true,
 * to allow asynchronous loaders to work.
 * @see {@link skipAutoInit}
 */
export { boot } from "./system/bootstrap.ts";

// call the library init function when ready
DOMContentLoaded(() => {
	if (!skipAutoInit) {
		boot();
	}
});
