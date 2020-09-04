import utils from "./../utils/utils.js";
import event from "./../system/event.js";
import state from "./../state/state.js";
import loader from "./../loader/loader.js";
import game from "./../game.js";
import TMXTileMap from "./tiled/TMXTileMap.js";


// our levels
var levels = {};
// level index table
var levelIdx = [];
// current level index
var currentLevelIdx = 0;

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
    event.publish(event.LEVEL_LOADED, [ levelId ]);

    // fire the callback
    options.onLoaded(levelId);

    if (restart) {
        // resume the game loop if it was previously running
        state.restart();
    }
};

/**
 * Load a TMX level
 * @name loadTMXLevel
 * @memberOf me.level
 * @private
 * @param {String} level level id
 * @param {me.Container} target container
 * @param {boolean} [flatten=true] if true, flatten all objects into the given container
 * @param {boolean} [setViewportBounds=false] if true, set the viewport bounds to the map size, this should be set to true especially if adding a level to the game world container.
 * @ignore
 * @function
 */
function loadTMXLevel(levelId, container, flatten, setViewportBounds) {
    var level = levels[levelId];

    // reset the GUID generator
    // and pass the level id as parameter
    utils.resetGUID(levelId, level.nextobjectid);

    // Tiled use 0,0 anchor coordinates
    container.anchorPoint.set(0, 0);

    // add all level elements to the target container
    level.addTo(container, flatten, setViewportBounds);
};


/**
 * a level manager. once ressources loaded, the level manager contains all references of defined levels.
 * @namespace level
 * @memberOf me
 */

var level = {

    /**
     * add a level into the game manager (usually called by the preloader)
     * @name add
     * @memberOf me.level
     * @public
     * @function
     * @param {String} format level format (only "tmx" supported)
     * @param {String} levelId the level id (or name)
     * @param {Function} [callback] a function to be called once the level is loaded
     * @return {Boolean} true if the level was loaded
     */
    add(format, levelId, callback) {
        switch (format) {
            case "tmx" :
                // just load the level with the XML stuff
                if (levels[levelId] == null) {
                    //console.log("loading "+ levelId);
                    levels[levelId] = new TMXTileMap(levelId, loader.getTMX(levelId));
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
     * @memberOf me.level
     * @public
     * @function
     * @param {String} level level id
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     * @param {boolean} [options.setViewportBounds=true] if true, set the viewport bounds to the map size
     * @example
     * // the game assets to be be preloaded
     * // TMX maps
     * var resources = [
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
     * var levelContainer = new me.Container();
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
            var wasRunning = state.isRunning();

            if (wasRunning) {
                // stop the game loop to avoid
                // some silly side effects
                state.stop();

                utils.function.defer(safeLoadLevel, this, levelId, options, true);
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
     * @memberOf me.level
     * @public
     * @function
     * @return {String}
     */
    getCurrentLevelId() {
        return levelIdx[currentLevelIdx];
    },

    /**
     * return the current level definition.
     * for a reference to the live instantiated level,
     * rather use the container in which it was loaded (e.g. me.game.world)
     * @name getCurrentLevel
     * @memberOf me.level
     * @public
     * @function
     * @return {me.TMXTileMap}
     */
    getCurrentLevel() {
        return levels[this.getCurrentLevelId()];
    },

    /**
     * reload the current level
     * @name reload
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
     */
    reload(options) {
        // reset the level to initial state
        //levels[currentLevel].reset();
        return this.load(this.getCurrentLevelId(), options);
    },

    /**
     * load the next level
     * @name next
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
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
     * @memberOf me.level
     * @public
     * @function
     * @param {Object} [options] additional optional parameters
     * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
     * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
     * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
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
     * @memberOf me.level
     * @public
     * @function
     */
    levelCount() {
        return levelIdx.length;
    }

};

export default level;
