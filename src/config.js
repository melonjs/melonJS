/**
 * MelonJS Game Engine
 * (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 */

(function () {

    /**
     * me global references
     * @ignore
     */
    me.mod = "melonJS";
    me.version = "@VERSION";
    /**
     * global system settings and browser capabilities
     * @namespace
     */
    me.sys = {

        /*
         * Global settings
         */

        /**
         * Game FPS (default 60)
         * @type {number}
         * @memberOf me.sys
         */
        fps : 60,

        /**
         * enable/disable frame interpolation (default disable)<br>
         * @type {boolean}
         * @memberOf me.sys
         */
        interpolation : false,

        /**
         * Global scaling factor(default 1.0)
         * @type {me.Vector2d}
         * @memberOf me.sys
         */
        scale : null, //initialized by me.video.init

        /**
         * enable/disable video scaling interpolation (default disable)<br>
         * @type {boolean}
         * @memberOf me.sys
         */
        scalingInterpolation : false,

        /**
         * Global gravity settings <br>
         * will override entities init value if defined<br>
         * default value : undefined
         * @type {(number|undefined)}
         * @memberOf me.sys
         */
        gravity : undefined,

        /**
         * Specify either to stop on audio loading error or not<br>
         * if true, melonJS will throw an exception and stop loading<br>
         * if false, melonJS will disable sounds and output a warning message
         * in the console<br>
         * default value : true<br>
         * @type {boolean}
         * @memberOf me.sys
         */
        stopOnAudioError : true,

        /**
         * Specify whether to pause the game when losing focus.<br>
         * default value : true<br>
         * @type {boolean}
         * @memberOf me.sys
         */
        pauseOnBlur : true,

        /**
         * Specify whether to unpause the game when gaining focus.<br>
         * default value : true<br>
         * @type {boolean}
         * @memberOf me.sys
         */
        resumeOnFocus : true,

        /**
         * Specify whether to stop the game when losing focus or not<br>
         * The engine restarts on focus if this is enabled.
         * default value : false<br>
         * @type {boolean}
         * @memberOf me.sys
         */
        stopOnBlur : false,

        /**
         * Specify the rendering method for layers <br>
         * if false, visible part of the layers are rendered dynamically
         * (default)<br>
         * if true, the entire layers are first rendered into an offscreen
         * canvas<br>
         * the "best" rendering method depends of your game<br>
         * (amount of layer, layer size, amount of tiles per layer, etc…)<br>
         * note : rendering method is also configurable per layer by adding this
         * property to your layer (in Tiled)<br>
         * @type {boolean}
         * @memberOf me.sys
         */
        preRender : false,

        /*
         * System methods
         */

        /**
         * Compare two version strings
         * @public
         * @function
         * @param {string} first First version string to compare
         * @param {string} [second="@VERSION"] Second version string to compare
         * @return {number} comparison result <br>&lt; 0 : first &lt; second<br>
         * 0 : first == second<br>
         * &gt; 0 : first &gt; second
         * @example
         * if (me.sys.checkVersion("0.9.5") > 0) {
         *     console.error(
         *         "melonJS is too old. Expected: 0.9.5, Got: " + me.version
         *     );
         * }
         */
        checkVersion : function (first, second) {
            second = second || me.version;

            var a = first.split(".");
            var b = second.split(".");
            var len = Math.min(a.length, b.length);
            var result = 0;

            for (var i = 0; i < len; i++) {
                if ((result = +a[i] - +b[i])) {
                    break;
                }
            }

            return result ? result : a.length - b.length;
        }
    };
    
       // a flag to know if melonJS
    // is initialized
    var me_initialized = false;

    Object.defineProperty(me, "initialized", {
        get : function get() {
            return me_initialized;
        }
    });

    /*
     * initial boot function
     */

    me.boot = function () {
        // don't do anything if already initialized (should not happen anyway)
        if (me_initialized) {
            return;
        }

        // check the device capabilites
        me.device._check();

        // initialize me.save
        me.save._init();

        // enable/disable the cache
        me.loader.setNocache(
            document.location.href.match(/\?nocache/) || false
        );

        // init the FPS counter if needed
        me.timer.init();

        // create a new map reader instance
        me.mapReader = new me.TMXMapReader();

        // init the App Manager
        me.state.init();

        // init the Entity Pool
        me.pool.init();

        // automatically enable keyboard events if on desktop
        if (me.device.isMobile === false) {
            me.input._enableKeyboardEvent();
        }

        // init the level Director
        me.levelDirector.reset();

        me_initialized = true;
    };

})();
