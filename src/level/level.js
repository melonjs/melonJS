import { resetGUID } from "./../utils/utils.js";
import { defer } from "../utils/function.js";
import * as event from "./../system/event.js";
import state from "./../state/state.js";
import { getTMX } from "./../loader/loader.js";
import { game } from "../index.js";
import TMXTileMap from "./tiled/TMXTileMap.js";


// our levels
let levels = {};
// level index table
let levelIdx = [];
// current level index
let currentLevelIdx = 0;

/**
 * @ignore
 */
function safeLoadLevel(levelId, options, restart) {
    // clean the destination container
    options.container.reset();

    // reset the renderer
    game.reset();

    // clean the current (previous) level
    if (levels[level.getCurrentLevelId()]) {
        levels[level.getCurrentLevelId()].destroy();
    }

    // update current level index
    currentLevelIdx = levelIdx.indexOf(levelId);

    // add the specified level to the game world
    loadTMXLevel(levelId, options.container, options.flatten, options.setViewportBounds);

    // publish the corresponding message
    event.emit(event.LEVEL_LOADED, levelId);

    // fire the callback
    options.onLoaded(levelId);

    if (restart) {
        // resume the game loop if it was previously running
        state.restart();
    }
}

/**
 * Load a TMX level
 * @name loadTMXLevel
 * @memberof level
 * @private
 * @param {string} levelId - level id
 * @param {Container} container - target container
 * @param {boolean} [flatten=true] - if true, flatten all objects into the given container
 * @param {boolean} [setViewportBounds=false] - if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
 * @ignore
 */
function loadTMXLevel(levelId, container, flatten, setViewportBounds) {
    let level = levels[levelId];

    // reset the GUID generator
    // and pass the level id as parameter
    resetGUID(levelId, level.nextobjectid);

    // Tiled use 0,0 anchor coordinates
    container.anchorPoint.set(0, 0);

    // add all level elements to the target container
    level.addTo(container, flatten, setViewportBounds);
}


/**
 * a level manager. once ressources loaded, the level manager contains all references of defined levels.
 * @namespace level
 */

let level = {

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
    add(format, levelId, callback) {
        switch (format) {
            case "tmx" :
                // just load the level with the XML stuff
                if (levels[levelId] == null) {
                    //console.log("loading "+ levelId);
                    levels[levelId] = new TMXTileMap(levelId, getTMX(levelId));
                    // level index
                    levelIdx.push(levelId);
                }
                else {
                    //console.log("level %s already loaded", levelId);
                    return false;
                }

                // call the callback if defined
                if (callback) {
                    callback();
                }
                // true if level loaded
                return true;

            default :
                throw new Error("no level loader defined for format " + format);
        }
    },

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
    load(levelId, options) {
        options = Object.assign({
            "container"         : game.world,
            "onLoaded"          : game.onLevelLoaded,
            "flatten"           : game.mergeGroup,
            "setViewportBounds" : true
        }, options || {});

        // throw an exception if not existing
        if (typeof(levels[levelId]) === "undefined") {
            throw new Error("level " + levelId + " not found");
        }

        if (levels[levelId] instanceof TMXTileMap) {

            // check the status of the state mngr
            let wasRunning = state.isRunning();

            if (wasRunning) {
                // stop the game loop to avoid
                // some silly side effects
                state.stop();

                defer(safeLoadLevel, this, levelId, options, true);
            }
            else {
                safeLoadLevel(levelId, options);
            }
        }
        else {
            throw new Error("no level loader defined");
        }
        return true;
    },

    /**
     * return the current level id<br>
     * @name getCurrentLevelId
     * @memberof level
     * @public
     * @returns {string}
     */
    getCurrentLevelId() {
        return levelIdx[currentLevelIdx];
    },

    /**
     * return the current level definition.
     * for a reference to the live instantiated level,
     * rather use the container in which it was loaded (e.g. me.game.world)
     * @name getCurrentLevel
     * @memberof level
     * @public
     * @returns {TMXTileMap}
     */
    getCurrentLevel() {
        return levels[this.getCurrentLevelId()];
    },

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
    reload(options) {
        // reset the level to initial state
        //levels[currentLevel].reset();
        return this.load(this.getCurrentLevelId(), options);
    },

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
    next(options) {
        //go to the next level
        if (currentLevelIdx + 1 < levelIdx.length) {
            return this.load(levelIdx[currentLevelIdx + 1], options);
        }
        else {
            return false;
        }
    },

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
    previous(options) {
        // go to previous level
        if (currentLevelIdx - 1 >= 0) {
            return this.load(levelIdx[currentLevelIdx - 1], options);
        }
        else {
            return false;
        }
    },

    /**
     * return the amount of level preloaded
     * @name levelCount
     * @memberof level
     * @public
     * @returns {number} the amount of level preloaded
     */
    levelCount() {
        return levelIdx.length;
    }

};

export default level;
