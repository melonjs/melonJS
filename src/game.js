(function () {

    /**
     * me.game represents your current game, it contains all the objects,
     * tilemap layers, current viewport, collision map, etc...<br>
     * me.game is also responsible for updating (each frame) the object status
     * and draw them<br>
     * @namespace me.game
     * @memberOf me
     */
    me.game = (function () {
        // hold public stuff in our singleton
        var api = {};

        /*
         * PRIVATE STUFF
         */

        // to know when we have to refresh the display
        var isDirty = true;

        // always refresh the display when updatesPerSecond are lower than fps
        var isAlwaysDirty = false;

        // frame counter for frameSkipping
        // reset the frame counter
        var frameCounter = 0;
        var frameRate = 1;

        // time accumulation for multiple update calls
        var accumulator = 0.0;
        var accumulatorMax = 0.0;
        var accumulatorUpdateDelta = 0;

        // min update step size
        var stepSize = 1000 / 60;
        var updateDelta = 0;
        var lastUpdateStart = null;
        var updateAverageDelta = 0;

        /*
         * PUBLIC STUFF
         */

        /**
         * a reference to the current active stage "default" camera
         * @public
         * @type {me.Camera2d}
         * @name viewport
         * @memberOf me.game
         */
        api.viewport = undefined;

        /**
         * a reference to the game world, <br>
         * a world is a virtual environment containing all the game objects
         * @public
         * @type {me.World}
         * @name world
         * @memberOf me.game
         */
        api.world = null;

        /**
         * when true, all objects will be added under the root world container.<br>
         * When false, a `me.Container` object will be created for each corresponding groups
         * @public
         * @type {boolean}
         * @default true
         * @name mergeGroup
         * @memberOf me.game
         */
        api.mergeGroup = true;

        /**
         * Specify the property to be used when sorting entities.
         * Accepted values : "x", "y", "z"
         * @public
         * @type {string}
         * @default "z"
         * @name sortOn
         * @memberOf me.game
         */
        api.sortOn = "z";

        /**
         * Fired when a level is fully loaded and <br>
         * and all entities instantiated. <br>
         * Additionnaly the level id will also be passed
         * to the called function.
         * @public
         * @function
         * @name onLevelLoaded
         * @memberOf me.game
         * @example
         * // call myFunction () everytime a level is loaded
         * me.game.onLevelLoaded = this.myFunction.bind(this);
         */
        api.onLevelLoaded = function () {};

        /**
         * Initialize the game manager
         * @name init
         * @memberOf me.game
         * @ignore
         * @function
         */
        api.init = function () {
            // the root object of our world is an entity container
            api.world = new me.World();

            // publish init notification
            me.event.publish(me.event.GAME_INIT);

            // make display dirty by default
            isDirty = true;
        };

        /**
         * reset the game Object manager<br>
         * destroy all current objects
         * @name reset
         * @memberOf me.game
         * @public
         * @function
         */
        api.reset = function () {
            // point to the current active stage "default" camera
            var current = me.state.current();
            if (typeof current !== "undefined") {
                api.viewport = me.state.current().cameras.get("default");
            }

            // publish reset notification
            me.event.publish(me.event.GAME_RESET);

            // Refresh internal variables for framerate  limiting
            api.updateFrameRate();
        };

        /**
         * Update the renderer framerate using the system config variables.
         * @name updateFrameRate
         * @memberOf me.game
         * @public
         * @function
         * @see me.timer.maxfps
         * @see me.game.world.fps
         */
        api.updateFrameRate = function () {
            // reset the frame counter
            frameCounter = 0;
            frameRate = ~~(0.5 + 60 / me.timer.maxfps);

            // set step size based on the updatesPerSecond
            stepSize = (1000 / api.world.fps);
            accumulator = 0.0;
            accumulatorMax = stepSize * 10;

            // display should always re-draw when update speed doesn't match fps
            // this means the user intends to write position prediction drawing logic
            isAlwaysDirty = (me.timer.maxfps > api.world.fps);
        };

        /**
         * Returns the parent container of the specified Child in the game world
         * @name getParentContainer
         * @memberOf me.game
         * @function
         * @param {me.Renderable} child
         * @return {me.Container}
         */
        api.getParentContainer = function (child) {
            return child.ancestor;
        };

        /**
         * force the redraw (not update) of all objects
         * @name repaint
         * @memberOf me.game
         * @public
         * @function
         */

        api.repaint = function () {
            isDirty = true;
        };


        /**
         * update all objects of the game manager
         * @name update
         * @memberOf me.game
         * @ignore
         * @function
         * @param {Number} time current timestamp as provided by the RAF callback
         * @param {me.Stage} stage the current stage
         */
        api.update = function (time, stage) {
            // handle frame skipping if required
            if ((++frameCounter % frameRate) === 0) {
                // reset the frame counter
                frameCounter = 0;

                // game update event
                me.event.publish(me.event.GAME_UPDATE, [ time ]);

                accumulator += me.timer.getDelta();
                accumulator = Math.min(accumulator, accumulatorMax);

                updateDelta = (me.timer.interpolation) ? me.timer.getDelta() : stepSize;
                accumulatorUpdateDelta = (me.timer.interpolation) ? updateDelta : Math.max(updateDelta, updateAverageDelta);

                while (accumulator >= accumulatorUpdateDelta || me.timer.interpolation) {
                    lastUpdateStart = window.performance.now();

                    // update all objects (and pass the elapsed time since last frame)
                    isDirty = stage.update(updateDelta) || isDirty;

                    me.timer.lastUpdate = window.performance.now();
                    updateAverageDelta = me.timer.lastUpdate - lastUpdateStart;

                    accumulator -= accumulatorUpdateDelta;
                    if (me.timer.interpolation) {
                        accumulator = 0;
                        break;
                    }
                }
            }
        };

        /**
         * draw the current scene/stage
         * @name draw
         * @memberOf me.game
         * @ignore
         * @function
         * @param {me.Stage} stage the current stage
         */
        api.draw = function (stage) {
            var renderer = me.video.renderer;

            if (renderer.isContextValid === true && (isDirty || isAlwaysDirty)) {
                // prepare renderer to draw a new frame
                renderer.clear();

                // render the stage
                stage.draw(renderer);

                // set back to flag
                isDirty = false;

                // flush/render our frame
                renderer.flush();
            }
        };

        // return our object
        return api;
    })();
})();
