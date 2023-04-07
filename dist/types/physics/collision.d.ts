export default collision;
declare namespace collision {
    const maxChildren: number;
    const maxDepth: number;
    namespace types {
        const NO_OBJECT: number;
        const PLAYER_OBJECT: number;
        const NPC_OBJECT: number;
        const ENEMY_OBJECT: number;
        const COLLECTABLE_OBJECT: number;
        const ACTION_OBJECT: number;
        const PROJECTILE_OBJECT: number;
        const WORLD_SHAPE: number;
        const USER: number;
        const ALL_OBJECT: number;
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
    function rayCast(line: Line, result?: Renderable[] | undefined): Renderable[];
}
