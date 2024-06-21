export default collision;
declare namespace collision {
    let maxChildren: number;
    let maxDepth: number;
    namespace types {
        let NO_OBJECT: number;
        let PLAYER_OBJECT: number;
        let NPC_OBJECT: number;
        let ENEMY_OBJECT: number;
        let COLLECTABLE_OBJECT: number;
        let ACTION_OBJECT: number;
        let PROJECTILE_OBJECT: number;
        let WORLD_SHAPE: number;
        let USER: number;
        let ALL_OBJECT: number;
    }
    /**
     * Checks for object colliding with the given line
     * @name rayCast
     * @memberof collision
     * @public
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
    function rayCast(line: Line, result?: Renderable[] | undefined): Array<Renderable>;
}
import type Line from "./../geometries/line.js";
import type Renderable from "./../renderable/renderable.js";
