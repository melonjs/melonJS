/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

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

        // flag to redraw the sprites
        var initialized = false;

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

        // reference to the renderer object
        var renderer = null;

        /*
         * PUBLIC STUFF
         */

        /**
         * a reference to the game viewport.
         * @public
         * @type {me.Viewport}
         * @name viewport
         * @memberOf me.game
         */
        api.viewport = null;

        /**
         * a reference to the game world <br>
         * a world is a virtual environment containing all the game objects
         * @public
         * @type {me.Container}
         * @name world
         * @memberOf me.game
         */
        api.world = null;

        /**
         * when true, all objects will be added under the root world container<br>
         * when false, a `me.Container` object will be created for each
         * corresponding `TMXObjectGroup`
         * default value : true
         * @public
         * @type {boolean}
         * @name mergeGroup
         * @memberOf me.game
         */
        api.mergeGroup = true;

        /**
         * The property of should be used when sorting entities <br>
         * value : "x", "y", "z" (default: "z")
         * @public
         * @type {string}
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
         * Provide an object hash with all tag parameters specified in the url.
         * @property {Boolean} [hitbox=false] draw the hitbox in the debug panel (if enabled)
         * @property {Boolean} [velocity=false] draw the entities velocity in the debug panel (if enabled)
         * @property {Boolean} [quadtree=false] draw the quadtree in the debug panel (if enabled)
         * @property {Boolean} [webgl=false] force the renderer to WebGL
         * @public
         * @type {Object}
         * @name HASH
         * @memberOf me.game
         * @example
         * // http://www.example.com/index.html#debug&hitbox=true&mytag=value
         * console.log(me.game.HASH["mytag"]); //> "value"
         */
        api.HASH = null;

        /**
         * Initialize the game manager
         * @name init
         * @memberOf me.game
         * @private
         * @ignore
         * @function
         * @param {Number} [width] width of the canvas
         * @param {Number} [height] width of the canvas
         * init function.
         */
        api.init = function (width, height) {
            if (!initialized) {
                // if no parameter specified use the system size
                width  = width  || me.video.renderer.getWidth();
                height = height || me.video.renderer.getHeight();

                // create a defaut viewport of the same size
                api.viewport = new me.Viewport(0, 0, width, height);

                // the root object of our world is an entity container
                api.world = new me.Container(0, 0, width, height);
                api.world.name = "rootContainer";
                api.world._root = true;

                // initialize the collision system (the quadTree mostly)
                me.collision.init();

                renderer = me.video.renderer;

                // publish init notification
                me.event.publish(me.event.GAME_INIT);

                // translate global pointer events
                me.input._translatePointerEvents();

                // make display dirty by default
                isDirty = true;

                // set as initialized
                initialized = true;
            }
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

            // clear the quadtree
            me.collision.quadTree.clear();

            // remove all objects
            api.world.destroy();

            // reset the viewport to zero ?
            if (api.viewport) {
                api.viewport.reset();
            }

            // reset the renderer
            renderer.reset();

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
         * @see me.sys.fps
         * @see me.sys.updatesPerSecond
         */
        api.updateFrameRate = function () {
            // reset the frame counter
            frameCounter = 0;
            frameRate = ~~(0.5 + 60 / me.sys.fps);

            // set step size based on the updatesPerSecond
            stepSize = (1000 / me.sys.updatesPerSecond);
            accumulator = 0.0;
            accumulatorMax = stepSize * 10;

            // display should always re-draw when update speed doesn't match fps
            // this means the user intends to write position prediction drawing logic
            isAlwaysDirty = (me.sys.fps > me.sys.updatesPerSecond);
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
         * @private
         * @ignore
         * @function
         * @param {Number} time current timestamp as provided by the RAF callback
         */
        api.update = function (time) {
            // handle frame skipping if required
            if ((++frameCounter % frameRate) === 0) {
                // reset the frame counter
                frameCounter = 0;

                // update the timer
                me.timer.update(time);

                // update the gamepads
                me.input._updateGamepads();

                accumulator += me.timer.getDelta();
                accumulator = Math.min(accumulator, accumulatorMax);

                updateDelta = (me.sys.interpolation) ? me.timer.getDelta() : stepSize;
                accumulatorUpdateDelta = (me.sys.interpolation) ? updateDelta : Math.max(updateDelta, updateAverageDelta);

                while (accumulator >= accumulatorUpdateDelta || me.sys.interpolation) {
                    lastUpdateStart = window.performance.now();

                    // clear the quadtree
                    me.collision.quadTree.clear();

                    // insert the world container (children) into the quadtree
                    me.collision.quadTree.insertContainer(api.world);

                    // update all objects (and pass the elapsed time since last frame)
                    isDirty = api.world.update(updateDelta) || isDirty;

                    // update the camera/viewport
                    isDirty = api.viewport.update(updateDelta) || isDirty;

                    me.timer.lastUpdate = window.performance.now();
                    updateAverageDelta = me.timer.lastUpdate - lastUpdateStart;

                    accumulator -= accumulatorUpdateDelta;
                    if (me.sys.interpolation) {
                        accumulator = 0;
                        break;
                    }
                }
            }
        };

        /**
         * draw all existing objects
         * @name draw
         * @memberOf me.game
         * @private
         * @ignore
         * @function
         * @param {me.Viewport} viewport viewport object
         */
        api.draw = function (viewport) {
            if (isDirty || isAlwaysDirty) {
                viewport = viewport || api.viewport;
                // cache the viewport rendering position, so that other object
                // can access it later (e,g. entityContainer when drawing floating objects)
                var translateX = viewport.pos.x + viewport.offset.x;
                var translateY = viewport.pos.y + viewport.offset.y;

                // translate the world coordinates by default to screen coordinates
                api.world.currentTransform.translate(-translateX, -translateY);

                // prepare renderer to draw a new frame
                renderer.clear();

                // save the current state
                me.video.renderer.save();

                // apply viewport transform if needed
                if (!viewport.currentTransform.isIdentity()) {
                    renderer.transform(viewport.currentTransform);
                }

                // update all objects,
                // specifying the viewport as the rectangle area to redraw
                api.world.draw(renderer, viewport);

                // restore
                renderer.restore();

                // translate the world coordinates by default to screen coordinates
                api.world.currentTransform.translate(translateX, translateY);

                // draw the viewpor/camera effects
                viewport.draw(renderer);

            }

            isDirty = false;

            // flush/render our frame
            renderer.flush();
        };

        // return our object
        return api;
    })();
})();
