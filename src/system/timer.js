    /*
     * MelonJS Game Engine
     * Copyright (C) 2011 - 2013 melonJS
     * http://www.melonjs.org
     *
     */

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
        var minstep = (1000 / me.sys.fps) * 1.25; // IS IT NECESSARY?\

        // list of defined timer function
        var timers = [];
        var timerId = 0;

        /** 
         * @ignore
         */
        var clearTimer = function (timerId) {
            for (var i = 0, len = timers.length; i < len; i++) {
                if (timers[i].timerId === timerId) {
                    timers.splice( i, 1 );
                    break;
                }
            }   
        };

        /**
         * update timers
         * @ignore
         */
        var updateTimers = function( dt ) {
            for (var i = 0, len = timers.length; i < len; i++) {
                var _timer = timers[i];
                if (!(_timer.pauseable && me.state.isPaused())) {
                    _timer.elapsed += dt;
                }
                if (_timer.elapsed >= _timer.delay) {
                    _timer.func.apply(this);
                    if (_timer.repeat === true) {
                        _timer.elapsed -= _timer.delay;
                    } else {
                        me.timer.clearTimeout(_timer.timerId);
                    }
                }
            }
        };

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
            last = now = window.performance.now();
            delta = 0;
            // reset delta counting variables
            framedelta = 0;
            framecount = 0;
        };

        /**
         * Calls a function once after a specified delay.
         * @name setTimeout
         * @memberOf me.timer
         * @param {Function} func the function you want to execute after delay milliseconds.
         * @param {Function} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
         * @param {Boolean} [pauseable = true] respects the pause state of the engine.
         * @return {Number}  timeoutID the numerical ID of the timeout, which can be used later with me.timer.clearTimeout().
         * @function
         */
        api.setTimeout = function(func, delay, pauseable) {
            timers.push({
                func: func,
                delay : delay,
                elapsed : 0,
                repeat : false,
                timerId : ++timerId,
                pauseable : pauseable === true || true
            });
            return timerId;
        };

        /**
         * Calls a function at specified interval.
         * @name setInterval
         * @memberOf me.timer
         * @param {Function} func the function to execute
         * @param {Function} delay the number of milliseconds (thousandths of a second) on how often to execute the function
         * @param {Boolean} [pauseable = true] respects the pause state of the engine.
         * @return {Number} intervalID the numerical ID of the timeout, which can be used later with me.timer.clearInterval().
         * @function
         */
        api.setInterval = function(func, delay, pauseable) {
            timers.push({
                func: func,
                delay : delay,
                elapsed : 0,
                repeat : true,
                timerId : ++timerId,
                pauseable : pauseable === true || true
            });
            return timerId;
        };

        /**
         * Clears the delay set by me.timer.setTimeout().
         * @name clearTimeout
         * @memberOf me.timer
         * @function
         * @param {Number}  timeoutID ID of the timeout to be cleared
         */
        api.clearTimeout = function(timeoutID) {
            clearTimer.defer(this, timeoutID);
        };

        /**
         * Clears the Interval set by me.timer.setInterval().
         * @name clearInterval
         * @memberOf me.timer
         * @function
         * @param {Number} intervalID ID of the interval to be cleared
         */
        api.clearInterval = function(intervalID) {
            clearTimer.defer(this, intervalID);
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
            return now;
        };

        /**
         * Return elapsed time in milliseconds since the last update<br>
         * @name getDelta
         * @memberOf me.timer
         * @return {Number}
         * @function
         */
        api.getDelta = function() {
         
            return delta;            
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
         * @param {Number} time current timestamp as provided by the RAF callback
         * @return {Number} time elapsed since the last update
         * @ignore
         */
        api.update = function(time) {

            last = now;
            
            now = time;
                       
            delta = (now - last);

            // get the game tick
            api.tick = (delta > minstep && me.sys.interpolation) ? delta / step : 1;

            // update defined timers
            updateTimers(delta);

            return delta;
        };

        // return our apiect
        return api;
    })();
