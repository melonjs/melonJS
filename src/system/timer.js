/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013 melonJS
 * http://www.melonjs.org
 *
 */

(function(window) {

    /**
     * a Timer object to manage time function (FPS, Game Tick, Time...)<p>
     * There is no constructor function for me.timer
     * @namespace me.timer
     * @memberOf me
     */
    me.timer = (function() {
        // hold public stuff in our api
        var api = {};

        /*---------------------------------------------

            PRIVATE STUFF

            ---------------------------------------------*/

        //hold element to display fps
        var framecount = 0;
        var framedelta = 0;

        /* fps count stuff */
        var last = 0;
        var now = 0;
        var delta = 0;
        var step = Math.ceil(1000 / me.sys.fps); // ROUND IT ?
        // define some step with some margin
        var minstep = (1000 / me.sys.fps) * 1.25; // IS IT NECESSARY?


        /*---------------------------------------------

            PUBLIC STUFF

            ---------------------------------------------*/

        /**
         * last game tick value
         * @public
         * @type Int
         * @name tick
         * @memberOf me.timer
         */
        api.tick = 1.0;

        /**
         * last measured fps rate
         * @public
         * @type Int
         * @name fps
         * @memberOf me.timer
         */
        api.fps = 0;

        /**
         * init the timer
         * @ignore
         */
        api.init = function() {
            // reset variables to initial state
            api.reset();
            now = last = 0;
        };

        /**
         * reset time (e.g. usefull in case of pause)
         * @name reset
         * @memberOf me.timer
         * @ignore
         * @function
         */
        api.reset = function() {
            // set to "now"
            last = now;
            // reset delta counting variables
            framedelta = 0;
            framecount = 0;
        };

        /**
         * Return the current timestamp in milliseconds <br>
         * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
         * @name getTime
         * @memberOf me.timer
         * @return {Number}
         * @function
         */
        api.getTime = function() {
            /* ??????????
            if (me.device.HighResTimer) {
                // adjust time information to make it consistent
                // across brower (time elapsed since unix epoch)
                return (now + performance.timing.navigationStart);
            } else {
                return now;
            }
            */
            return now;
        };


        /**
         * compute the actual frame time and fps rate
         * @name computeFPS
         * @ignore
         * @memberOf me.timer
         * @function
         */
        api.countFPS = function() {
            framecount++;
            framedelta += delta;
            if (framecount % 10 === 0) {
                this.fps = (~~((1000 * framecount) / framedelta)).clamp(0, me.sys.fps);
                framedelta = 0;
                framecount = 0;
            }
        };

        /**
         * update game tick
         * should be called once a frame
         * @ignore
         */
        api.update = function(time) {

            last = now;

            now = time;

            delta = (now - last);

            // get the game tick
            api.tick = (delta > minstep && me.sys.interpolation) ? delta / step    : 1;
        };

        // return our apiect
        return api;

    })();

})(window);
