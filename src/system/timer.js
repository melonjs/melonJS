(function () {
    /**
     * a Timer object to manage timing related function (FPS, Game Tick, Time...)<p>
     * There is no constructor function for me.timer
     * @namespace me.timer
     * @memberOf me
     */
    me.timer = (function () {
        // hold public stuff in our api
        var api = {};

        /*
         * PRIVATE STUFF
         */

        //hold element to display fps
        var framecount = 0;
        var framedelta = 0;

        /* fps count stuff */
        var last = 0;
        var now = 0;
        var delta = 0;
        // for timeout/interval update
        var step =0;
        var minstep = 0;

        // list of defined timer function
        var timers = [];
        var timerId = 0;

        /**
         * @ignore
         */
        var clearTimer = function (timerId) {
            for (var i = 0, len = timers.length; i < len; i++) {
                if (timers[i].timerId === timerId) {
                    timers.splice(i, 1);
                    break;
                }
            }
        };

        /**
         * update timers
         * @ignore
         */
        var updateTimers = function (time) {
            last = now;
            now = time;
            delta = (now - last);

            // fix for negative timestamp returned by wechat or chrome on startup
            if (delta < 0) {
                delta = 0;
            }

            // get the game tick
            api.tick = (delta > minstep && me.timer.interpolation) ? delta / step : 1;

            for (var i = 0, len = timers.length; i < len; i++) {
                var _timer = timers[i];
                if (!(_timer.pauseable && me.state.isPaused())) {
                    _timer.elapsed += delta;
                }
                if (_timer.elapsed >= _timer.delay) {
                    _timer.fn.apply(null, _timer.args);
                    if (_timer.repeat === true) {
                        _timer.elapsed -= _timer.delay;
                    } else {
                        me.timer.clearTimeout(_timer.timerId);
                    }
                }
            }
        };

        /*
         * PUBLIC STUFF
         */

        /**
         * Last game tick value.<br/>
         * Use this value to scale velocities during frame drops due to slow
         * hardware or when setting an FPS limit. (See {@link me.timer.maxfps})
         * This feature is disabled by default. Enable me.timer.interpolation to
         * use it.
         * @public
         * @see me.timer.interpolation
         * @type {Number}
         * @name tick
         * @memberOf me.timer
         */
        api.tick = 1.0;

        /**
         * Last measured fps rate.<br/>
         * This feature is disabled by default, unless the debugPanel is enabled/visible
         * @public
         * @type {Number}
         * @name fps
         * @memberOf me.timer
         */
        api.fps = 0;

        /**
         * Set the maximum target display frame per second
         * @public
         * @see me.timer.tick
         * @type {Number}
         * @name maxfps
         * @default 60
         * @memberOf me.timer
         */
        api.maxfps = 60;

        /**
         * Enable/disable frame interpolation
         * @see me.timer.tick
         * @type {Boolean}
         * @default false
         * @name interpolation
         * @memberOf me.timer
         */
        api.interpolation = false;

        /**
         * Last update time.<br/>
         * Use this value to implement frame prediction in drawing events,
         * for creating smooth motion while running game update logic at
         * a lower fps.
         * @public
         * @type Date
         * @name lastUpdate
         * @memberOf me.timer
         */
        api.lastUpdate = window.performance.now();

        /**
         * init the timer
         * @ignore
         */
        api.init = function () {
            // reset variables to initial state
            api.reset();
            now = last = 0;
            // register to the game update event
            me.event.subscribe(me.event.GAME_UPDATE, updateTimers);
        };

        /**
         * reset time (e.g. usefull in case of pause)
         * @name reset
         * @memberOf me.timer
         * @ignore
         * @function
         */
        api.reset = function () {
            // set to "now"
            last = now = window.performance.now();
            delta = 0;
            // reset delta counting variables
            framedelta = 0;
            framecount = 0;
            step = Math.ceil(1000 / api.maxfps); // ROUND IT ?
            // define some step with some margin
            minstep = (1000 / api.maxfps) * 1.25; // IS IT NECESSARY?\
        };

        /**
         * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
         * @name setTimeout
         * @memberOf me.timer
         * @param {Function} fn the function you want to execute after delay milliseconds.
         * @param {Number} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
         * @param {Boolean} [pauseable=true] respects the pause state of the engine.
         * @param {...*} [param] optional parameters which are passed through to the function specified by fn once the timer expires.
         * @return {Number} The numerical ID of the timer, which can be used later with me.timer.clearTimeout().
         * @function
         * @example
         * // set a timer to call "myFunction" after 1000ms
         * me.timer.setTimeout(myFunction, 1000);
         * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
         * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
         */
        api.setTimeout = function (fn, delay, pauseable) {
            timers.push({
                fn : fn,
                delay : delay,
                elapsed : 0,
                repeat : false,
                timerId : ++timerId,
                pauseable : pauseable === true || true,
                args : arguments.length > 3 ? Array.prototype.slice.call(arguments, 3) : undefined
            });
            return timerId;
        };

        /**
         * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
         * @name setInterval
         * @memberOf me.timer
         * @param {Function} fn the function to execute
         * @param {Number} delay the number of milliseconds (thousandths of a second) on how often to execute the function
         * @param {Boolean} [pauseable=true] respects the pause state of the engine.
         * @param {...*} [param] optional parameters which are passed through to the function specified by fn once the timer expires.
         * @return {Number} The numerical ID of the timer, which can be used later with me.timer.clearInterval().
         * @function
         * @example
         * // set a timer to call "myFunction" every 1000ms
         * me.timer.setInterval(myFunction, 1000);
         * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
         * me.timer.setInterval(myFunction, 1000, true, param1, param2);
         */
        api.setInterval = function (fn, delay, pauseable) {
            timers.push({
                fn : fn,
                delay : delay,
                elapsed : 0,
                repeat : true,
                timerId : ++timerId,
                pauseable : pauseable === true || true,
                args : arguments.length > 3 ? Array.prototype.slice.call(arguments, 3) : undefined
            });
            return timerId;
        };

        /**
         * Clears the delay set by me.timer.setTimeout().
         * @name clearTimeout
         * @memberOf me.timer
         * @function
         * @param {Number} timeoutID ID of the timeout to be cleared
         */
        api.clearTimeout = function (timeoutID) {
            me.utils.function.defer(clearTimer, this, timeoutID);
        };

        /**
         * Clears the Interval set by me.timer.setInterval().
         * @name clearInterval
         * @memberOf me.timer
         * @function
         * @param {Number} intervalID ID of the interval to be cleared
         */
        api.clearInterval = function (intervalID) {
            me.utils.function.defer(clearTimer, this, intervalID);
        };

        /**
         * Return the current timestamp in milliseconds <br>
         * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
         * @name getTime
         * @memberOf me.timer
         * @return {Number}
         * @function
         */
        api.getTime = function () {
            return now;
        };

        /**
         * Return elapsed time in milliseconds since the last update
         * @name getDelta
         * @memberOf me.timer
         * @return {Number}
         * @function
         */
        api.getDelta = function () {
            return delta;
        };

        /**
         * compute the actual frame time and fps rate
         * @name computeFPS
         * @ignore
         * @memberOf me.timer
         * @function
         */
        api.countFPS = function () {
            framecount++;
            framedelta += delta;
            if (framecount % 10 === 0) {
                api.fps = me.Math.clamp(Math.round((1000 * framecount) / framedelta), 0, api.maxfps);
                framedelta = 0;
                framecount = 0;
            }
        };

        // return our api
        return api;
    })();
})();
