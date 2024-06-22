/**
 * @import Entity from "./../renderable/entity/entity.js";
 * @import Container from "./../renderable/container.js";
 * @import Renderable from "./../renderable/renderable.js";
 * @import Sprite from "./../renderable/sprite.js";
 * @import NineSliceSprite from "./../renderable/nineslicesprite.js";
 * @import Line from "./../geometries/line.js";
 * @import Vector2d from "./../math/vector2.js";
 * @import ObservableVector2d from "./../math/observable_vector2.js";
 **/
/**
 * @classdesc
 * a Generic Physic Body Object with some physic properties and behavior functionality, to add as a member of a Renderable.
 * @see Renderable.body
 */
export default class Body {
    /**
     * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} ancestor - the parent object this body is attached to
     * @param {Rect|Rect[]|Polygon|Polygon[]|Line|Line[]|Ellipse|Ellipse[]|Point|Point[]|Bounds|Bounds[]|object} [shapes] - a initial shape, list of shapes, or JSON object defining the body
     * @param {Function} [onBodyUpdate] - callback for when the body is updated (e.g. add/remove shapes)
     */
    constructor(ancestor: Renderable | Container | Entity | Sprite | NineSliceSprite, shapes?: object | Point | Rect | Polygon | Bounds | Point[] | Line | Ellipse | Polygon[] | Line[] | Ellipse[] | Rect[] | Bounds[] | undefined, onBodyUpdate?: Function | undefined);
    /**
     * a reference to the parent object that contains this body,
     * or undefined if it has not been added to one.
     * @public
     * @type {Renderable|Container|Entity|Sprite|NineSliceSprite}
     * @default undefined
     */
    public ancestor: Renderable | Container | Entity | Sprite | NineSliceSprite;
    /**
     * The AABB bounds box reprensenting this body
     * @public
     * @type {Bounds}
     */
    public bounds: Bounds;
    /**
     * The collision shapes of the body
     * @ignore
     * @type {Polygon[]|Line[]|Ellipse[]|Point|Point[]}
     */
    shapes: Polygon[] | Line[] | Ellipse[] | Point | Point[];
    /**
     * The body collision mask, that defines what should collide with what.<br>
     * (by default will collide with all entities)
     * @ignore
     * @type {number}
     * @default collision.types.ALL_OBJECT
     * @see collision.types
     */
    collisionMask: number;
    /**
     * define the collision type of the body for collision filtering
     * @public
     * @type {number}
     * @default collision.types.ENEMY_OBJECT
     * @see collision.types
     * @example
     * // set the body collision type
     * body.collisionType = me.collision.types.PLAYER_OBJECT;
     */
    public collisionType: number;
    /**
     * The current velocity of the body.
     * See to apply a force if you need to modify a body velocity
     * @see Body.force
     * @public
     * @type {Vector2d}
     * @default <0,0>
     */
    public vel: Vector2d;
    /**
     * body force to apply to this the body in the current step.
     * (any positive or negative force will be cancelled after every world/body update cycle)
     * @public
     * @type {Vector2d}
     * @default <0,0>
     * @see Body.setMaxVelocity
     * @example
     * // define a default maximum acceleration, initial force and friction
     * this.body.force.set(1, 0);
     * this.body.friction.set(0.4, 0);
     * this.body.setMaxVelocity(3, 15);
     *
     * // apply a postive or negative force when pressing left of right key
     * update(dt) {
     *     if (me.input.isKeyPressed("left"))    {
     *          this.body.force.x = -this.body.maxVel.x;
     *      } else if (me.input.isKeyPressed("right")) {
     *         this.body.force.x = this.body.maxVel.x;
     *     }
     * }
     */
    public force: Vector2d;
    /**
     * body friction
     * @public
     * @type {Vector2d}
     * @default <0,0>
     */
    public friction: Vector2d;
    /**
     * the body bouciness level when colliding with other solid bodies :
     * a value of 0 will not bounce, a value of 1 will fully rebound.
     * @public
     * @type {number}
     * @default 0
     */
    public bounce: number;
    /**
     * the body mass
     * @public
     * @type {number}
     * @default 1
     */
    public mass: number;
    /**
     * max velocity (to limit body velocity)
     * @public
     * @type {Vector2d}
     * @default <490,490>
     */
    public maxVel: Vector2d;
    /**
     * Either this body is a static body or not.
     * A static body is completely fixed and can never change position or angle.
     * @readonly
     * @public
     * @type {boolean}
     * @default false
     */
    public readonly isStatic: boolean;
    /**
     * The degree to which this body is affected by the world gravity
     * @public
     * @see World.gravity
     * @type {number}
     * @default 1.0
     */
    public gravityScale: number;
    /**
     * If true this body won't be affected by the world gravity
     * @public
     * @see World.gravity
     * @type {boolean}
     * @default false
     */
    public ignoreGravity: boolean;
    /**
     * falling state of the body<br>
     * true if the object is falling<br>
     * false if the object is standing on something<br>
     * @readonly
     * @public
     * @type {boolean}
     * @default false
     */
    public readonly falling: boolean;
    /**
     * jumping state of the body<br>
     * equal true if the body is jumping<br>
     * @readonly
     * @public
     * @type {boolean}
     * @default false
     */
    public readonly jumping: boolean;
    onBodyUpdate: Function | undefined;
    /**
     * set the body as a static body
     * static body do not move automatically and do not check againt collision with others
     * @param {boolean} [isStatic=true]
     */
    setStatic(isStatic?: boolean | undefined): void;
    /**
     * add a collision shape to this body <br>
     * (note: me.Rect objects will be converted to me.Polygon before being added)
     * @param {Rect|Polygon|Line|Ellipse|Point|Point[]|Bounds|object} shape - a shape or JSON object
     * @returns {number} the shape array length
     * @example
     * // add a rectangle shape
     * this.body.addShape(new me.Rect(0, 0, image.width, image.height));
     * // add a shape from a JSON object
     * this.body.addShape(me.loader.getJSON("shapesdef").banana);
     */
    addShape(shape: Rect | Polygon | Line | Ellipse | Point | Point[] | Bounds | object): number;
    /**
     * set the body vertices to the given one
     * @param {Vector2d[]} vertices - an array of me.Vector2d points defining a convex hull
     * @param {number} [index=0] - the shape object for which to set the vertices
     * @param {boolean} [clear=true] - either to reset the body definition before adding the new vertices
     */
    setVertices(vertices: Vector2d[], index?: number | undefined, clear?: boolean | undefined): void;
    /**
     * add the given vertices to the body shape
     * @param {Vector2d[]} vertices - an array of me.Vector2d points defining a convex hull
     * @param {number} [index=0] - the shape object for which to set the vertices
     */
    addVertices(vertices: Vector2d[], index?: number | undefined): void;
    /**
     * add collision mesh based on a JSON object
     * (this will also apply any physic properties defined in the given JSON file)
     * @param {object} json - a JSON object as exported from a Physics Editor tool
     * @param {string} [id] - an optional shape identifier within the given the json object
     * @see https://www.codeandweb.com/physicseditor
     * @returns {number} how many shapes were added to the body
     * @example
     * // define the body based on the banana shape
     * this.body.fromJSON(me.loader.getJSON("shapesdef").banana);
     * // or ...
     * this.body.fromJSON(me.loader.getJSON("shapesdef"), "banana");
     */
    fromJSON(json: object, id?: string | undefined): number;
    /**
     * return the collision shape at the given index
     * @param {number} [index=0] - the shape object at the specified index
     * @returns {Polygon|Line|Ellipse} shape a shape object if defined
     */
    getShape(index?: number | undefined): Polygon | Line | Ellipse;
    /**
     * returns the AABB bounding box for this body
     * @returns {Bounds} bounding box Rectangle object
     */
    getBounds(): Bounds;
    /**
     * remove the specified shape from the body shape list
     * @param {Polygon|Line|Ellipse} shape - a shape object
     * @returns {number} the shape array length
     */
    removeShape(shape: Polygon | Line | Ellipse): number;
    /**
     * remove the shape at the given index from the body shape list
     * @param {number} index - the shape object at the specified index
     * @returns {number} the shape array length
     */
    removeShapeAt(index: number): number;
    /**
     * By default all physic bodies are able to collide with all other bodies, <br>
     * but it's also possible to specify 'collision filters' to provide a finer <br>
     * control over which body can collide with each other.
     * @see collision.types
     * @param {number} [bitmask = collision.types.ALL_OBJECT] - the collision mask
     * @example
     * // filter collision detection with collision shapes, enemies and collectables
     * body.setCollisionMask(me.collision.types.WORLD_SHAPE | me.collision.types.ENEMY_OBJECT | me.collision.types.COLLECTABLE_OBJECT);
     * ...
     * // disable collision detection with all other objects
     * body.setCollisionMask(me.collision.types.NO_OBJECT);
     */
    setCollisionMask(bitmask?: number | undefined): void;
    /**
     * define the collision type of the body for collision filtering
     * @see collision.types
     * @param {number} type - the collision type
     * @example
     * // set the body collision type
     * body.collisionType = me.collision.types.PLAYER_OBJECT;
     */
    setCollisionType(type: number): void;
    /**
     * the built-in function to solve the collision response
     * @param {object} response - the collision response object (see {@link ResponseObject})
     */
    respondToCollision(response: object): void;
    /**
     * The forEach() method executes a provided function once per body shape element. <br>
     * the callback function is invoked with three arguments: <br>
     *    - The current element being processed in the array <br>
     *    - The index of element in the array. <br>
     *    - The array forEach() was called upon. <br>
     * @param {Function} callback - fnction to execute on each element
     * @param {object} [thisArg] - value to use as this(i.e reference Object) when executing callback.
     * @example
     * // iterate through all shapes of the physic body
     * mySprite.body.forEach((shape) => {
     *    shape.doSomething();
     * });
     * mySprite.body.forEach((shape, index) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... });
     * mySprite.body.forEach((shape, index, array) => { ... }, thisArg);
     */
    forEach(callback: Function, thisArg?: object | undefined, ...args: any[]): void;
    /**
     * Returns true if the any of the shape composing the body contains the given point.
     * @param {number|Vector2d} x -  x coordinate or a vector point to check
     * @param {number} [y] -  y coordinate
     * @returns {boolean} true if contains
     * @example
     * if (mySprite.body.contains(10, 10)) {
     *   // do something
     * }
     * // or
     * if (mySprite.body.contains(myVector2d)) {
     *   // do something
     * }
     */
    contains(...args: any[]): boolean;
    /**
     * Rotate this body (counter-clockwise) by the specified angle (in radians).
     * Unless specified the body will be rotated around its center point
     * @param {number} angle - The angle to rotate (in radians)
     * @param {Vector2d|ObservableVector2d} [v=Body.getBounds().center] - an optional point to rotate around
     * @returns {Body} Reference to this object for method chaining
     */
    rotate(angle: number, v?: Vector2d | ObservableVector2d | undefined): Body;
    /**
     * cap the body velocity (body.maxVel property) to the specified value<br>
     * @param {number} x - max velocity on x axis
     * @param {number} y - max velocity on y axis
     */
    setMaxVelocity(x: number, y: number): void;
    /**
     * set the body default friction
     * @param {number} x - horizontal friction
     * @param {number} y - vertical friction
     */
    setFriction(x?: number, y?: number): void;
    /**
     * Updates the parent's position as well as computes the new body's velocity based
     * on the values of force/friction.  Velocity chages are proportional to the
     * me.timer.tick value (which can be used to scale velocities).  The approach to moving the
     * parent renderable is to compute new values of the Body.vel property then add them to
     * the parent.pos value thus changing the postion the amount of Body.vel each time the
     * update call is made. <br>
     * Updates to Body.vel are bounded by maxVel (which defaults to viewport size if not set) <br>
     * At this time a call to Body.Update does not call the onBodyUpdate callback that is listed in the constructor arguments.
     * @protected
     * @param {number} dt - time since the last update in milliseconds.
     * @returns {boolean} true if resulting velocity is different than 0
     */
    protected update(dt: number): boolean;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(): void;
}
import type Renderable from "./../renderable/renderable.js";
import type Container from "./../renderable/container.js";
import type Entity from "./../renderable/entity/entity.js";
import type Sprite from "./../renderable/sprite.js";
import type NineSliceSprite from "./../renderable/nineslicesprite.js";
import Bounds from "./bounds.js";
import Polygon from "./../geometries/poly.js";
import type Line from "./../geometries/line.js";
import Ellipse from "./../geometries/ellipse.js";
import Point from "../geometries/point.js";
import type Vector2d from "./../math/vector2.js";
import Rect from "./../geometries/rectangle.js";
import type ObservableVector2d from "./../math/observable_vector2.js";
