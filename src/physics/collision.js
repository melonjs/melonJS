import Vector2d from "./../math/vector2.js";
import { rayCast } from "./detector.js";
import { world } from "./../game.js";

/**
 * Collision detection (and projection-based collision response) of 2D shapes.<br>
 * Based on the Separating Axis Theorem and supports detecting collisions between simple Axis-Aligned Boxes, convex polygons and circles based shapes.
 * @namespace collision
 * @memberOf me
 */

/**
 * a callback used to determine if two objects should collide (based on both respective objects collision mask and type).<br>
 * you can redefine this function if you need any specific rules over what should collide with what.
 * @name shouldCollide
 * @memberOf me.collision
 * @ignore
 * @function
 * @param {me.Renderable} a a reference to the object A.
 * @param {me.Renderable} b a reference to the object B.
 * @return {Boolean} true if they should collide, false otherwise
 */
function shouldCollide(a, b) {
    return (
        a.isKinematic !== true && b.isKinematic !== true &&
        a.body && b.body &&
        (a.body.collisionMask & b.body.collisionType) !== 0 &&
        (a.body.collisionType & b.body.collisionMask) !== 0
    );
}

/**
 * @classdesc
 * An object representing the result of an intersection.
 * @property {me.Renderable} a The first object participating in the intersection
 * @property {me.Renderable} b The second object participating in the intersection
 * @property {Number} overlap Magnitude of the overlap on the shortest colliding axis
 * @property {me.Vector2d} overlapV The overlap vector (i.e. `overlapN.scale(overlap, overlap)`). If this vector is subtracted from the position of a, a and b will no longer be colliding
 * @property {me.Vector2d} overlapN The shortest colliding axis (unit-vector)
 * @property {Boolean} aInB Whether the first object is entirely inside the second
 * @property {Boolean} bInA Whether the second object is entirely inside the first
 * @property {Number} indexShapeA The index of the colliding shape for the object a body
 * @property {Number} indexShapeB The index of the colliding shape for the object b body
 * @name ResponseObject
 * @memberOf me.collision
 * @public
 * @see me.collision.check
 */
class ResponseObject {
    constructor() {
        this.a = null;
        this.b = null;
        this.overlapN = new Vector2d();
        this.overlapV = new Vector2d();
        this.aInB = true;
        this.bInA = true;
        this.indexShapeA = -1;
        this.indexShapeB = -1;
        this.overlap = Number.MAX_VALUE;
        return this;
    }

    /**
     * Set some values of the response back to their defaults. <br>
     * Call this between tests if you are going to reuse a single <br>
     * Response object for multiple intersection tests <br>
     * (recommended as it will avoid allocating extra memory) <br>
     * @name clear
     * @memberOf me.collision.ResponseObject
     * @public
     * @function
     */
    clear () {
        this.aInB = true;
        this.bInA = true;
        this.overlap = Number.MAX_VALUE;
        this.indexShapeA = -1;
        this.indexShapeB = -1;
        return this;
    }
}


var collision = {

     /**
      * The maximum number of children that a quadtree node can contain before it is split into sub-nodes.
      * @name maxChildren
      * @memberOf me.collision
      * @public
      * @type {Number}
      * @default 8
      * @see me.game.world.broadphase
      */
     maxChildren : 8,

     /**
      * The maximum number of levels that the quadtree will create.
      * @name maxDepth
      * @memberOf me.collision
      * @public
      * @type {Number}
      * @default 4
      * @see me.game.world.broadphase
      *
      */
     maxDepth : 4,

    /**
     * Enum for collision type values.
     * @property NO_OBJECT to disable collision check
     * @property PLAYER_OBJECT
     * @property NPC_OBJECT
     * @property ENEMY_OBJECT
     * @property COLLECTABLE_OBJECT
     * @property ACTION_OBJECT e.g. doors
     * @property PROJECTILE_OBJECT e.g. missiles
     * @property WORLD_SHAPE e.g. walls; for map collision shapes
     * @property USER user-defined collision types (see example)
     * @property ALL_OBJECT all of the above (including user-defined types)
     * @readonly
     * @enum {Number}
     * @name types
     * @memberOf me.collision
     * @see me.body.setCollisionMask
     * @see me.body.collisionType
     * @example
     * // set the body collision type
     * myEntity.body.collisionType = me.collision.types.PLAYER_OBJECT;
     *
     * // filter collision detection with collision shapes, enemies and collectables
     * myEntity.body.setCollisionMask(
     *     me.collision.types.WORLD_SHAPE |
     *     me.collision.types.ENEMY_OBJECT |
     *     me.collision.types.COLLECTABLE_OBJECT
     * );
     *
     * // User-defined collision types are defined using BITWISE LEFT-SHIFT:
     * game.collisionTypes = {
     *     LOCKED_DOOR : me.collision.types.USER << 0,
     *     OPEN_DOOR   : me.collision.types.USER << 1,
     *     LOOT        : me.collision.types.USER << 2,
     * };
     *
     * // Set collision type for a door entity
     * myDoorEntity.body.collisionType = game.collisionTypes.LOCKED_DOOR;
     *
     * // Set collision mask for the player entity, so it collides with locked doors and loot
     * myPlayerEntity.body.setCollisionMask(
     *     me.collision.types.ENEMY_OBJECT |
     *     me.collision.types.WORLD_SHAPE |
     *     game.collisionTypes.LOCKED_DOOR |
     *     game.collisionTypes.LOOT
     * );
     */
    types : {
        /** to disable collision check */
        NO_OBJECT           : 0,
        PLAYER_OBJECT       : 1 << 0,
        NPC_OBJECT          : 1 << 1,
        ENEMY_OBJECT        : 1 << 2,
        COLLECTABLE_OBJECT  : 1 << 3,
        ACTION_OBJECT       : 1 << 4, // door, etc...
        PROJECTILE_OBJECT   : 1 << 5, // missiles, etc...
        WORLD_SHAPE         : 1 << 6, // walls, etc...
        USER                : 1 << 7, // user-defined types start here...
        ALL_OBJECT          : 0xFFFFFFFF // all objects
    },


    /**
     * a global instance of a response object used for collision detection <br>
     * this object will be reused amongst collision detection call if not user-defined response is specified
     * @name response
     * @memberOf me.collision
     * @public
     * @type {me.collision.ResponseObject}
     */
    response : new ResponseObject(),


    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @memberOf me.collision
     * @public
     * @function
     * @param {me.Line} line line to be tested for collision
     * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
     * @return {Array.<me.Renderable>} an array of intersecting physic objects
     * @example
     *    // define a line accross the viewport
     *    var ray = new me.Line(
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
    rayCast(line, resultArray) { return rayCast(line, resultArray); }

};

export default collision;
