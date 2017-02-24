/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
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
        // onresize handler
        var onresize_handler = null;

        function safeLoadLevel(levelId, options, restart) {
            // clean the destination container
            options.container.destroy();

            // reset the renderer
            me.video.renderer.reset();

            // clean the current (previous) level
            if (levels[api.getCurrentLevelId()]) {
                levels[api.getCurrentLevelId()].destroy();
            }

            // update current level index
            currentLevelIdx = levelIdx.indexOf(levelId);

            // add the specified level to the game world
            loadTMXLevel(levelId, options.container, options.flatten, options.setViewportBounds);

            // publish the corresponding message
            me.event.publish(me.event.LEVEL_LOADED, [ levelId ]);

            // fire the callback
            options.onLoaded(levelId);

            if (restart) {
                // resume the game loop if it was previously running
                me.state.restart();
            }
        }

        /**
         * Load a TMX level
         * @name loadTMXLevel
         * @memberOf me.game
         * @private
         * @param {String} level level id
         * @param {me.Container} target container
         * @param {boolean} flatten if true, flatten all objects into the given container
         * @param {boolean} setViewportBounds if true, set the viewport bounds to the map size
         * @ignore
         * @function
         */
        function loadTMXLevel(levelId, container, flatten, setViewportBounds) {
            var level = levels[levelId];

            // disable auto-sort for the given container
            var autoSort = container.autoSort;
            container.autoSort = false;

            if (setViewportBounds) {
                // update the viewport bounds
                me.game.viewport.setBounds(
                    0, 0,
                    Math.max(level.width, me.game.viewport.width),
                    Math.max(level.height, me.game.viewport.height)
                );
            }

            // reset the GUID generator
            // and pass the level id as parameter
            me.utils.resetGUID(levelId, level.nextobjectid);

            // add all level elements to the target container
            level.addTo(container, flatten);

            // sort everything (recursively)
            container.sort(true);
            container.autoSort = autoSort;

            container.resize(level.width, level.height);

            function resize_container() {
                // center the map if smaller than the current viewport
                container.pos.set(
                    Math.max(0, ~~((me.game.viewport.width - level.width) / 2)),
                    Math.max(0, ~~((me.game.viewport.height - level.height) / 2)),
                    0
                );
            }

            if (setViewportBounds) {
                resize_container();

                // Replace the resize handler
                if (onresize_handler) {
                    me.event.unsubscribe(onresize_handler);
                }
                onresize_handler = me.event.subscribe(me.event.VIEWPORT_ONRESIZE, resize_container);
            }
        }

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
         * me.levelDirector.loadLevel("a4_level1");
         * ...
         * ...
         * // load a level into a specific container
         * var levelContainer = new me.Container();
         * me.levelDirector.loadLevel("a4_level2", {container:levelContainer});
         * // add a simple transformation
         * levelContainer.currentTransform.translate(levelContainer.width / 2, levelContainer.height / 2 );
         * levelContainer.currentTransform.rotate(0.05);
         * levelContainer.currentTransform.translate(-levelContainer.width / 2, -levelContainer.height / 2 );
         * // add it to the game world
         * me.game.world.addChild(levelContainer);
         */
        api.loadLevel = function (levelId, options) {
            options = Object.assign({
                "container"         : me.game.world,
                "onLoaded"          : me.game.onLevelLoaded,
                "flatten"           : me.game.mergeGroup,
                "setViewportBounds" : true
            }, options || {});

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

                    safeLoadLevel.defer(this, levelId, options, true);
                }
                else {
                    safeLoadLevel(levelId, options);
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
         * return the current level definition.
         * for a reference to the live instantiated level,
         * rather use the container in which it was loaded (e.g. me.game.world)
         * @name getCurrentLevel
         * @memberOf me.levelDirector
         * @public
         * @function
         * @return {me.TMXTileMap}
         */
        api.getCurrentLevel = function () {
            return levels[api.getCurrentLevelId()];
        };

        /**
         * reload the current level<br>
         * @name reloadLevel
         * @memberOf me.levelDirector
         * @public
         * @function
         * @param {Object} [options] additional optional parameters
         * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
         * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
         */
        api.reloadLevel = function (options) {
            // reset the level to initial state
            //levels[currentLevel].reset();
            return api.loadLevel(api.getCurrentLevelId(), options);
        };

        /**
         * load the next level<br>
         * @name nextLevel
         * @memberOf me.levelDirector
         * @public
         * @function
         * @param {Object} [options] additional optional parameters
         * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
         * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
         */
        api.nextLevel = function (options) {
            //go to the next level
            if (currentLevelIdx + 1 < levelIdx.length) {
                return api.loadLevel(levelIdx[currentLevelIdx + 1], options);
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
         * @param {Object} [options] additional optional parameters
         * @param {me.Container} [options.container=me.game.world] container in which to load the specified level
         * @param {function} [options.onLoaded=me.game.onLevelLoaded] callback for when the level is fully loaded
         * @param {boolean} [options.flatten=me.game.mergeGroup] if true, flatten all objects into the given container
         */
        api.previousLevel = function (options) {
            // go to previous level
            if (currentLevelIdx - 1 >= 0) {
                return api.loadLevel(levelIdx[currentLevelIdx - 1], options);
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
