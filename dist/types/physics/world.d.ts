/**
 * @import Application from "./../application/application.js";
 */
/**
 * @classdesc
 * an object representing the physic world, and responsible for managing and updating all childs and physics
 * @augments Container
 */
export default class World extends Container {
    /**
     * @param {number} [x=0] - position of the container (accessible via the inherited pos.x property)
     * @param {number} [y=0] - position of the container (accessible via the inherited pos.y property)
     * @param {number} [width=game.viewport.width] - width of the container
     * @param {number} [height=game.viewport.height] - height of the container
     */
    constructor(x?: number | undefined, y?: number | undefined, width?: number | undefined, height?: number | undefined);
    /**
     * the application (game) this physic world belong to
     * @type {Application}
     */
    app: Application;
    /**
     * the physic engine used by melonJS
     * @see ApplicationSettings.physic
     * @type {string}
     * @default "builtin"
     * @example
     * // disable builtin physic
     * me.game.world.physic = "none";
     */
    physic: string;
    /**
     * the rate at which the game world is updated,
     * may be greater than or lower than the display fps
     * @default 60
     * @see timer.maxfps
     */
    fps: number;
    /**
     * world gravity
     * @type {Vector2d}
     * @default <0,0.98>
     */
    gravity: Vector2d;
    /**
     * Enabled pre-rendering for all tile layers. <br>
     * If false layers are rendered dynamically, if true layers are first fully rendered into an offscreen canvas.<br>
     * the "best" rendering method depends of your game (amount of layer, layer size, amount of tiles per layer, etc.)<br>
     * Note : rendering method is also configurable per layer by adding a boolean "preRender" property to your layer in Tiled ({@link https://doc.mapeditor.org/en/stable/manual/custom-properties/#adding-properties}).
     * @type {boolean}
     * @default false
     */
    preRender: boolean;
    /**
     * the active physic bodies in this simulation
     * @type {Set<Body>}
     */
    bodies: Set<Body>;
    /**
     * the instance of the game world quadtree used for broadphase (used by the builtin physic and pointer event implementation)
     * @type {QuadTree}
     */
    broadphase: QuadTree;
    /**
     * the collision detector instance used by this world instance
     * @type {Detector}
     */
    detector: Detector;
    /**
     * Add a physic body to the game world
     * @see Container.addChild
     * @param {Body} body
     * @returns {World} this game world
     */
    addBody(body: Body): World;
    /**
     * Remove a physic body from the game world
     * @see Container.removeChild
     * @param {Body} body
     * @returns {World} this game world
     */
    removeBody(body: Body): World;
    /**
     * Apply gravity to the given body
     * @private
     * @param {Body} body
     */
    private bodyApplyGravity;
    /**
     * update the builtin physic simulation by one step (called by the game world update method)
     * @param {number} dt - the time passed since the last frame update
     */
    step(dt: number): void;
}
import Container from "../renderable/container.js";
import type Application from "./../application/application.js";
import Vector2d from "./../math/vector2.js";
import QuadTree from "./quadtree.js";
import Detector from "./detector.js";
