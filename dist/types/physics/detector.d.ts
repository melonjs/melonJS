/**
 * the Detector class contains methods for detecting collisions between bodies using a broadphase algorithm.
 */
export default class Detector {
    /**
     * @param {Container} world - the physic world this detector is bind to
     */
    constructor(world: Container);
    world: Container;
    /**
     * the default response object used for collisions
     * (will be automatically populated by the collides functions)
     * @type {ResponseObject}
     */
    response: ResponseObject;
    /**
     * determine if two objects should collide (based on both respective objects body collision mask and type).<br>
     * you can redefine this function if you need any specific rules over what should collide with what.
     * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} a - a reference to the object A.
     * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} b - a reference to the object B.
     * @returns {boolean} true if they should collide, false otherwise
     */
    shouldCollide(a: Renderable | Container | Entity | Sprite | NineSliceSprite, b: Renderable | Container | Entity | Sprite | NineSliceSprite): boolean;
    /**
     * detect collision between two bodies.
     * @param {Body} bodyA - a reference to body A.
     * @param {Body} bodyB - a reference to body B.
     * @returns {boolean} true if colliding
     */
    collides(bodyA: Body, bodyB: Body, response?: ResponseObject): boolean;
    /**
     * find all the collisions for the specified object using a broadphase algorithm
     * @ignore
     * @param {Renderable|Container|Entity|Sprite|NineSliceSprite} objA - object to be tested for collision
     * @returns {boolean} in case of collision, false otherwise
     */
    collisions(objA: Renderable | Container | Entity | Sprite | NineSliceSprite): boolean;
    /**
     * Checks for object colliding with the given line
     * @ignore
     * @param {Line} line - line to be tested for collision
     * @param {Array.<Renderable>} [result] - a user defined array that will be populated with intersecting physic objects.
     * @returns {Array.<Renderable>} an array of intersecting physic objects
     * @example
     *    // define a line accross the viewport
     *    let ray = new me.Line(
     *        // absolute position of the line
     *        0, 0, [
     *        // starting point relative to the initial position
     *        new me.Vector2d(0, 0),
     *        // ending point
     *        new me.Vector2d(me.game.viewport.width, me.game.viewport.height)
     *    ]);
     *
     *    // check for collition
     *    result = me.collision.rayCast(ray);
     *
     *    if (result.length > 0) {
     *        // ...
     *    }
     */
    rayCast(line: Line, result?: Renderable[] | undefined): Array<Renderable>;
}
import type Container from "./../renderable/container.js";
import ResponseObject from "./response.js";
import type Renderable from "./../renderable/renderable.js";
import type Entity from "./../renderable/entity/entity.js";
import type Sprite from "./../renderable/sprite.js";
import type NineSliceSprite from "./../renderable/nineslicesprite.js";
import type Line from "./../geometries/line.js";
