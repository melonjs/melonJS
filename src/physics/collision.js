import { rayCast, globalResponse } from "./detector.js";

/**
 * Collision detection (and projection-based collision response) of 2D shapes.<br>
 * Based on the Separating Axis Theorem and supports detecting collisions between simple Axis-Aligned Boxes, convex polygons and circles based shapes.
 * @namespace collision
 * @memberof me
 */

var collision = {

     /**
      * The maximum number of children that a quadtree node can contain before it is split into sub-nodes.
      * @name maxChildren
      * @memberof me.collision
      * @public
      * @type {number}
      * @default 8
      * @see me.game.world.broadphase
      */
     maxChildren : 8,

     /**
      * The maximum number of levels that the quadtree will create.
      * @name maxDepth
      * @memberof me.collision
      * @public
      * @type {number}
      * @default 4
      * @see me.game.world.broadphase
      */
     maxDepth : 4,

    /**
     * Enum for collision type values.
     * @property {number} NO_OBJECT to disable collision check
     * @property {number} PLAYER_OBJECT playbable characters
     * @property {number} NPC_OBJECT non playable characters
     * @property {number} ENEMY_OBJECT enemies objects
     * @property {number} COLLECTABLE_OBJECT collectable objects
     * @property {number} ACTION_OBJECT e.g. doors
     * @property {number} PROJECTILE_OBJECT e.g. missiles
     * @property {number} WORLD_SHAPE e.g. walls; for map collision shapes
     * @property {number} USER user-defined collision types (see example)
     * @property {number} ALL_OBJECT all of the above (including user-defined types)
     * @readonly
     * @enum {number}
     * @name types
     * @memberof me.collision
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
     * @memberof me.collision
     * @public
     * @type {me.collision.ResponseObject}
     */
    response : globalResponse,

    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @memberof me.collision
     * @public
     * @function
     * @param {me.Line} line line to be tested for collision
     * @param {Array.<me.Renderable>} [result] a user defined array that will be populated with intersecting physic objects.
     * @returns {Array.<me.Renderable>} an array of intersecting physic objects
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
    rayCast(line, result) { return rayCast(line, result); }
};

export default collision;
