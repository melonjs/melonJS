export default level;
declare namespace level {
    /**
     * add a level into the game manager (usually called by the preloader)
     * @name add
     * @memberof level
     * @public
     * @param {string} format - level format (only "tmx" supported)
     * @param {string} levelId - the level id (or name)
     * @param {Function} [callback] - a function to be called once the level is loaded
     * @returns {boolean} true if the level was loaded
     */
    function add(format: string, levelId: string, callback?: Function | undefined): boolean;
    /**
     * load a level into the game manager<br>
     * (will also create all level defined entities, etc..)
     * @name load
     * @memberof level
     * @public
     * @param {string} levelId - level id
     * @param {object} [options] - additional optional parameters
     * @param {Container} [options.container=game.world] - container in which to load the specified level
     * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
     * @param {boolean} [options.flatten=game.mergeGroup] - if true, flatten all objects into the given container
     * @param {boolean} [options.setViewportBounds=true] - if true, set the viewport bounds to the map size
     * @returns {boolean} true if the level was successfully loaded
     * @example
     * // the game assets to be be preloaded
     * // TMX maps
     * let resources = [
     *     {name: "a4_level1",   type: "tmx",   src: "data/level/a4_level1.tmx"},
     *     {name: "a4_level2",   type: "tmx",   src: "data/level/a4_level2.tmx"},
     *     {name: "a4_level3",   type: "tmx",   src: "data/level/a4_level3.tmx"},
     *     // ...
     * ];
     *
     * // ...
     *
     * // load a level into the game world
     * me.level.load("a4_level1");
     * ...
     * ...
     * // load a level into a specific container
     * let levelContainer = new me.Container();
     * me.level.load("a4_level2", {container:levelContainer});
     * // add a simple transformation
     * levelContainer.currentTransform.translate(levelContainer.width / 2, levelContainer.height / 2 );
     * levelContainer.currentTransform.rotate(0.05);
     * levelContainer.currentTransform.translate(-levelContainer.width / 2, -levelContainer.height / 2 );
     * // add it to the game world
     * me.game.world.addChild(levelContainer);
     */
    function load(levelId: string, options?: {
        container?: any;
        onLoaded?: Function | undefined;
        flatten?: boolean | undefined;
        setViewportBounds?: boolean | undefined;
    } | undefined): boolean;
    /**
     * return the current level id<br>
     * @name getCurrentLevelId
     * @memberof level
     * @public
     * @returns {string}
     */
    function getCurrentLevelId(): string;
    /**
     * return the current level definition.
     * for a reference to the live instantiated level,
     * rather use the container in which it was loaded (e.g. me.game.world)
     * @name getCurrentLevel
     * @memberof level
     * @public
     * @returns {TMXTileMap}
     */
    function getCurrentLevel(): TMXTileMap;
    /**
     * reload the current level
     * @name reload
     * @memberof level
     * @public
     * @param {object} [options] - additional optional parameters
     * @param {Container} [options.container=game.world] - container in which to load the specified level
     * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
     * @param {boolean} [options.flatten=game.mergeGroup] - if true, flatten all objects into the given container
     * @returns {object} the current level
     */
    function reload(options?: {
        container?: any;
        onLoaded?: Function | undefined;
        flatten?: boolean | undefined;
    } | undefined): object;
    /**
     * load the next level
     * @name next
     * @memberof level
     * @public
     * @param {object} [options] - additional optional parameters
     * @param {Container} [options.container=game.world] - container in which to load the specified level
     * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
     * @param {boolean} [options.flatten=game.mergeGroup] - if true, flatten all objects into the given container
     * @returns {boolean} true if the next level was successfully loaded
     */
    function next(options?: {
        container?: any;
        onLoaded?: Function | undefined;
        flatten?: boolean | undefined;
    } | undefined): boolean;
    /**
     * load the previous level<br>
     * @name previous
     * @memberof level
     * @public
     * @param {object} [options] - additional optional parameters
     * @param {Container} [options.container=game.world] - container in which to load the specified level
     * @param {Function} [options.onLoaded=game.onLevelLoaded] - callback for when the level is fully loaded
     * @param {boolean} [options.flatten=game.mergeGroup] - if true, flatten all objects into the given container
     * @returns {boolean} true if the previous level was successfully loaded
     */
    function previous(options?: {
        container?: any;
        onLoaded?: Function | undefined;
        flatten?: boolean | undefined;
    } | undefined): boolean;
    /**
     * return the amount of level preloaded
     * @name levelCount
     * @memberof level
     * @public
     * @returns {number} the amount of level preloaded
     */
    function levelCount(): number;
}
import TMXTileMap from "./tiled/TMXTileMap.js";
