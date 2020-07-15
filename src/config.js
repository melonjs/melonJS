(function () {

   /**
    * current melonJS version
    * @static
    * @constant
    * @memberof me
    * @name version
    * @type {string}
    */
    me.version = "__VERSION__";

    /**
     * global system settings and browser capabilities
     * @namespace
     */
    me.sys = {

        /**
         * Specify either to stop on audio loading error or not<br>
         * if true, melonJS will throw an exception and stop loading<br>
         * if false, melonJS will disable sounds and output a warning message
         * in the console<br>
         * @type {Boolean}
         * @default true
         * @memberOf me.sys
         */
        stopOnAudioError : true,

        /**
         * Specify whether to pause the game when losing focus.<br>
         * @type {Boolean}
         * @default true
         * @memberOf me.sys
         */
        pauseOnBlur : true,

        /**
         * Specify whether to unpause the game when gaining focus.<br>
         * @type {Boolean}
         * @default true
         * @memberOf me.sys
         */
        resumeOnFocus : true,

        /**
         * Specify whether to automatically bring the window to the front.<br>
         * @type {Boolean}
         * @default true
         * @memberOf me.sys
         */
        autoFocus : true,

        /**
         * Specify whether to stop the game when losing focus or not<br>
         * The engine restarts on focus if this is enabled.
         * @type {boolean}
         * @default false
         * @memberOf me.sys
         */
        stopOnBlur : false,

        /**
         * Specify the rendering method for layers <br>
         * if false, visible part of the layers are rendered dynamically<br>
         * if true, the entire layers are first rendered into an offscreen
         * canvas<br>
         * the "best" rendering method depends of your game<br>
         * (amount of layer, layer size, amount of tiles per layer, etc.)<br>
         * note : rendering method is also configurable per layer by adding this
         * property to your layer (in Tiled)<br>
         * @type {Boolean}
         * @default false
         * @memberOf me.sys
         */
        preRender : false
    };


   /**
    * a flag indicating that melonJS is fully initialized
    * @type {Boolean}
    * @default false
    * @readonly
    * @memberOf me
    */
    me.initialized = false;

    /**
     * disable melonJS auto-initialization
     * @type {Boolean}
     * @default false
     * @see me.boot
     * @memberOf me
     */
    me.skipAutoInit = false;

    /**
     * initialize the melonJS library.
     * this is automatically called unless me.skipAutoInit is set to true,
     * to allow asynchronous loaders to work.
     * @name boot
     * @memberOf me
     * @see me.skipAutoInit
     * @public
     * @function
     */
    me.boot = function () {
        // don't do anything if already initialized (should not happen anyway)
        if (me.initialized === true) {
            return;
        }

        // check the device capabilites
        me.device._check();

        // init the object Pool
        me.pool.init();

        // initialize me.save
        me.save.init();

        // init the FPS counter if needed
        me.timer.init();

        // enable/disable the cache
        me.loader.setNocache( me.utils.getUriFragment().nocache || false );

        // init the App Manager
        me.state.init();

        // automatically enable keyboard events
        me.input.initKeyboardEvent();

        // init the level Director
        me.levelDirector.init();

        // game instance init
        me.game.init();

        // mark melonJS as initialized
        me.initialized = true;

        /// if auto init is disable and this function was called manually
        if (me.skipAutoInit === true) {
            me.device._domReady();
        }
    };

    // call the library init function when ready
    me.device.onReady(function () {
        if (me.skipAutoInit === false) {
           me.boot();
        }
    });

})();
