import game from "./game.js";
import utils from "./utils/utils.js";
import timer from "./system/timer.js";
import save from "./system/save.js";
import * as input from "./input/input.js";

(function () {

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
        save.init();

        // init the FPS counter if needed
        timer.init();

        // enable/disable the cache
        me.loader.setNocache( utils.getUriFragment().nocache || false );

        // init the App Manager
        me.state.init();

        // automatically enable keyboard events
        input.initKeyboardEvent();

        // init the level Director
        me.levelDirector.init();

        // game instance init
        game.init();

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
