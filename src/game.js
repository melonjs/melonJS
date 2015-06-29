/**
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
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

        // frame counter for frameSkipping
        // reset the frame counter
        var frameCounter = 0;
        var frameRate = 1;

        // reference to the renderer object
        var renderer = null;

        // dummy current level
        var dummyLevel = {
            pos : {
                x : 0,
                y : 0
            },
            moveToCenter : function () {} // XXX
        };

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
         * a reference to the game current level
         * @public
         * @type {me.TMXTileMap}
         * @name currentLevel
         * @memberOf me.game
         */
        api.currentLevel = null;

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
         * default layer tmxRenderer
         * @private
         * @ignore
         * @type {me.TMXRenderer}
         * @name tmxRenderer
         * @memberOf me.game
         */
        api.tmxRenderer = null;

        /**
         * Fired when a level is fully loaded and <br>
         * and all entities instantiated. <br>
         * Additionnaly the level id will also be passed
         * to the called function.
         * @public
         * @callback
         * @name onLevelLoaded
         * @memberOf me.game
         * @example
         * // call myFunction () everytime a level is loaded
         * me.game.onLevelLoaded = this.myFunction.bind(this);
         */
        api.onLevelLoaded = null;

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

                //the root object of our world is an entity container
                api.world = new me.Container(0, 0, width, height);

                // give it a name
                api.world.name = "rootContainer";

                /*
                 * XXX: Default ancestor is self
                 * Removes the need for an if-statement when accessing ancestor
                 * properties in the update method
                 */
                api.world.ancestor = api.world;

                me.event.subscribe(me.event.VIEWPORT_ONRESIZE, function () {
                    var level = api.currentLevel,
                        transform = api.world.transform;

                    // Automatically adjust map and world position
                    level.moveToCenter();
                    transform.identity();
                    transform.translateV(level.pos); // XXX: Does not update container.pos
                });

                // initialize the collision system (the quadTree mostly)
                me.collision.init();

                renderer = me.video.renderer;

                // publish init notification
                me.event.publish(me.event.GAME_INIT);

                // translate global pointer events
                me.input._translatePointerEvents();

                // make display dirty by default
                isDirty = true;

                api.currentLevel = dummyLevel;

                // set as initialized
                initialized = true;
            }
        };

        /**
         * reset the game Object manager<p>
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

            api.currentLevel = dummyLevel;

            // reset the renderer
            renderer.reset();

            // reset the frame counter
            frameCounter = 0;
            frameRate = ~~(0.5 + 60 / me.sys.fps);
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

                // clear the quadtree
                me.collision.quadTree.clear();

                // insert the world container (children) into the quadtree
                me.collision.quadTree.insertContainer(api.world);

                // update all objects (and pass the elapsed time since last frame)
                isDirty = api.world.update(me.timer.getDelta()) || isDirty;

                // update the camera/viewport
                isDirty = api.viewport.update(me.timer.getDelta()) || isDirty;
            }
        };

        /**
         * draw all existing objects
         * @name draw
         * @memberOf me.game
         * @private
         * @ignore
         * @function
         */
        api.draw = function () {
            if (isDirty) {
                // cache the viewport rendering position, so that other object
                // can access it later (e,g. entityContainer when drawing floating objects)
                var translateX = api.viewport.pos.x + ~~api.viewport.offset.x;
                var translateY = api.viewport.pos.y + ~~api.viewport.offset.y;

                // translate the world coordinates by default to screen coordinates
                api.world.transform.translate(-translateX, -translateY);

                // substract the map offset to current the current pos
                api.viewport.screenX = translateX - api.currentLevel.pos.x;
                api.viewport.screenY = translateY - api.currentLevel.pos.y;

                // prepare renderer to draw a new frame
                me.video.renderer.prepareSurface();

                // update all objects,
                // specifying the viewport as the rectangle area to redraw
                api.world.draw(renderer, api.viewport);

                // translate back
                api.world.transform.translate(translateX, translateY);

                // draw our camera/viewport
                api.viewport.draw(renderer);
            }

            isDirty = false;

            // blit our frame
            me.video.renderer.blitSurface();
        };

        // return our object
        return api;
    })();
})();
