/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a level manager object <br>
     * once ressources loaded, the level director contains all references of defined levels<br>
     * There is no constructor function for me.levelDirector, this is a static object
     * @namespace me.levelDirector
     * @memberOf me
     */
    me.levelDirector = (function () {
        // hold public stuff in our singletong
        var api = {};

        /*
         * PRIVATE STUFF
         */

        // our levels
        var levels = {};
        // level index table
        var levelIdx = [];
        // current level index
        var currentLevelIdx = 0;

        /**
         * Load a TMX level
         * @name loadTMXLevel
         * @memberOf me.game
         * @private
         * @param {String} level level id
         * @param {me.Container} target container
         * @param {boolean} flatten if true, flatten all objects into the given container
         * @ignore
         * @function
         */
        var loadTMXLevel = function (levelId, container, flatten) {
            var level = levels[levelId];
            
            // disable auto-sort for the given container
            container.autoSort = false;
                        
            // change the viewport bounds
            me.game.viewport.setBounds(
                0, 0,
                Math.max(level.width, me.game.viewport.width),
                Math.max(level.height, me.game.viewport.height)
            );

            // reset the GUID generator
            // and pass the level id as parameter
            me.utils.resetGUID(levelId, level.nextobjectid);
            
            // add all level elements to the target container
            level.reset();
            level.addTo(container, flatten);

            // load our map
            me.game.currentLevel = level;

            // sort everything (recursively)
            container.sort(true);

            // re-enable auto-sort
            container.autoSort = true;

            // center map on the viewport
            level.moveToCenter();

            // translate the display if required
            container.transform.translateV(level.pos);

            // update the game world size to match the level size
            container.resize(level.width, level.height);
        };

        /*
         * PUBLIC STUFF
         */

        /**
         * reset the level director
         * @ignore
         */
        api.reset = function () {};

        /**
         * add a level
         * @ignore
         */
        api.addLevel = function () {
            throw new me.Error("no level loader defined");
        };

        /**
         * add a TMX level
         * @ignore
         */
        api.addTMXLevel = function (levelId, callback) {
            // just load the level with the XML stuff
            if (levels[levelId] == null) {
                //console.log("loading "+ levelId);
                levels[levelId] = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
                // level index
                levelIdx.push(levelId);
            }
            else  {
                //console.log("level %s already loaded", levelId);
                return false;
            }

            // call the callback if defined
            if (callback) {
                callback();
            }
            // true if level loaded
            return true;
        };

        /**
         * load a level into the game manager<br>
         * (will also create all level defined entities, etc..)
         * @name loadLevel
         * @memberOf me.levelDirector
         * @public
         * @function
         * @param {String} level level id
         * @param {Object} [options] additional optional parameters
         * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
         * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
         * @example
         * // the game defined ressources
         * // to be preloaded by the loader
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
         * // load a level
         * me.levelDirector.loadLevel("a4_level1");
         */
        api.loadLevel = function (levelId, options) {
            options = options || {};
            var container = options.container || me.game.world;
            var callback = options.callback || me.game.onLevelLoaded;
            var flatten = options.flatten || me.game.mergeGroup;
                        
            // throw an exception if not existing
            if (typeof(levels[levelId]) === "undefined") {
                throw new me.Error("level " + levelId + " not found");
            }

            if (levels[levelId] instanceof me.TMXTileMap) {

                // check the status of the state mngr
                var wasRunning = me.state.isRunning();

                if (wasRunning) {
                    // stop the game loop to avoid
                    // some silly side effects
                    me.state.stop();
                }

                // reset the gameObject Manager (just in case!)
                me.game.reset();

                // clean the current (previous) level
                if (levels[api.getCurrentLevelId()]) {
                    levels[api.getCurrentLevelId()].destroy();
                }

                // update current level index
                currentLevelIdx = levelIdx.indexOf(levelId);

                // add the specified level to the game world
                loadTMXLevel(levelId, container, flatten);
                
                //publish the corresponding message
                me.event.publish(me.event.LEVEL_LOADED, [levelId]);
                
                // fire the callback if defined
                if (typeof (callback) === "function") {
                    callback.call(callback, levelId);
                }

                if (wasRunning) {
                    // resume the game loop if it was
                    // previously running
                    me.state.restart.defer(this);
                }
            }
            else {
                throw new me.Error("no level loader defined");
            }
            return true;
        };

        /**
         * return the current level id<br>
         * @name getCurrentLevelId
         * @memberOf me.levelDirector
         * @public
         * @function
         * @return {String}
         */
        api.getCurrentLevelId = function () {
            return levelIdx[currentLevelIdx];
        };

        /**
         * reload the current level<br>
         * @name reloadLevel
         * @memberOf me.levelDirector
         * @public
         * @function
         */
        api.reloadLevel = function () {
            // reset the level to initial state
            //levels[currentLevel].reset();
            return api.loadLevel(api.getCurrentLevelId());
        };

        /**
         * load the next level<br>
         * @name nextLevel
         * @memberOf me.levelDirector
         * @public
         * @function
         */
        api.nextLevel = function () {
            //go to the next level
            if (currentLevelIdx + 1 < levelIdx.length) {
                return api.loadLevel(levelIdx[currentLevelIdx + 1]);
            }
            else {
                return false;
            }
        };

        /**
         * load the previous level<br>
         * @name previousLevel
         * @memberOf me.levelDirector
         * @public
         * @function
         */
        api.previousLevel = function () {
            // go to previous level
            if (currentLevelIdx - 1 >= 0) {
                return api.loadLevel(levelIdx[currentLevelIdx - 1]);
            }
            else {
                return false;
            }
        };

        /**
         * return the amount of level preloaded<br>
         * @name levelCount
         * @memberOf me.levelDirector
         * @public
         * @function
         */
        api.levelCount = function () {
            return levelIdx.length;
        };

        // return our object
        return api;
    })();
})();
