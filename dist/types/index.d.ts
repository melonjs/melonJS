/**
 * initialize the melonJS library.
 * this is automatically called unless me.skipAutoInit is set to true,
 * to allow asynchronous loaders to work.
 * @name boot
 * @see skipAutoInit
 * @public
 */
export function boot(): void;
/**
 * current melonJS version
 * @static
 * @constant
 * @name version
 * @type {string}
 */
export const version: string;
export * from "./lang/deprecated.js";
export * from "./const.js";
/**
 * a flag indicating that melonJS is fully initialized
 * @type {boolean}
 * @default false
 * @readonly
 */
export let initialized: boolean;
/**
 * disable melonJS auto-initialization
 * @type {boolean}
 * @default false
 * @see boot
 */
export let skipAutoInit: boolean;
/**
 * game is a default instance of a melonJS Application and represents your current game,
 * it contains all the objects, tilemap layers, current viewport, collision map, etc...<br>
 * @namespace game
 * @see Application
 */
export const game: Application;
import * as audio from "./audio/audio.js";
import collision from "./physics/collision.js";
import * as device from "./system/device.js";
import * as event from "./system/event.js";
import * as loader from "./loader/loader.js";
import level from "./level/level.js";
import * as input from "./input/input.js";
import * as Math from "./math/math.js";
import * as plugin from "./plugin/plugin.js";
import { cache as plugins } from "./plugin/plugin.js";
import * as utils from "./utils/utils.js";
import save from "./system/save.js";
import timer from "./system/timer.js";
import pool from "./system/pooling.js";
import state from "./state/state.js";
import * as video from "./video/video.js";
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
import Point from "./geometries/point.js";
import Rect from "./geometries/rectangle.js";
import RoundRect from "./geometries/roundrect.js";
import Tween from "./tweens/tween.js";
import QuadTree from "./physics/quadtree.js";
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
import Body from "./physics/body.js";
import Bounds from "./physics/bounds.js";
import Text from "./renderable/text/text.js";
import BitmapText from "./renderable/text/bitmaptext.js";
import BitmapTextData from "./renderable/text/bitmaptextdata.js";
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
import ParticleEmitter from "./particles/emitter.js";
import ParticleEmitterSettings from "./particles/settings.js";
import Particle from "./particles/particle.js";
import Entity from "./renderable/entity/entity.js";
import Application from "./application/application.js";
export { audio, collision, device, event, loader, level, input, Math, plugin, plugins, utils, save, timer, pool, state, video, Color, Vector2d, Vector3d, ObservableVector2d, ObservableVector3d, Matrix2d, Matrix3d, Polygon, Line, Ellipse, Point, Rect, RoundRect, Tween, QuadTree, GLShader, Compositor, PrimitiveCompositor, QuadCompositor, Renderer, WebGLRenderer, CanvasRenderer, CanvasRenderTarget, TextureAtlas, Renderable, Body, Bounds, Text, BitmapText, BitmapTextData, ColorLayer, ImageLayer, Sprite, NineSliceSprite, UIBaseElement, UITextButton, UISpriteElement, Collectable, Trigger, Light2d, Draggable, DropTarget, TMXRenderer, TMXOrthogonalRenderer, TMXIsometricRenderer, TMXHexagonalRenderer, TMXStaggeredRenderer, Tile, TMXTileset, TMXTilesetGroup, TMXTileMap, TMXLayer, TMXUtils, Pointer, Stage, Camera2d, Container, World, ParticleEmitter, ParticleEmitterSettings, Particle, Entity, Application };
