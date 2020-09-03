import utils from "./../utils/utils.js";
import event from "./../system/event.js";
import state from "./../state/state.js";
import { clamp } from "./../math/math.js";

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
function clearTimer(timerId) {
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
function updateTimers(time) {
    last = now;
    now = time;
    delta = (now - last);

    // fix for negative timestamp returned by wechat or chrome on startup
    if (delta < 0) {
        delta = 0;
    }

    // get the game tick
    timer.tick = (delta > minstep && timer.interpolation) ? delta / step : 1;

    for (var i = 0, len = timers.length; i < len; i++) {
        var _timer = timers[i];
        if (!(_timer.pauseable && state.isPaused())) {
            _timer.elapsed += delta;
        }
        if (_timer.elapsed >= _timer.delay) {
            _timer.fn.apply(null, _timer.args);
            if (_timer.repeat === true) {
                _timer.elapsed -= _timer.delay;
            } else {
                timer.clearTimeout(_timer.timerId);
            }
        }
    }
};


/**
 * a Timer class to manage timing related function (FPS, Game Tick, Time...)
 * @namespace me.timer
 * @memberOf me
 */
var timer = {

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
        tick : 1.0,

        /**
         * Last measured fps rate.<br/>
         * This feature is disabled by default, unless the debugPanel is enabled/visible
         * @public
         * @type {Number}
         * @name fps
         * @memberOf me.timer
         */
        fps : 0,

        /**
         * Set the maximum target display frame per second
         * @public
         * @see me.timer.tick
         * @type {Number}
         * @name maxfps
         * @default 60
         * @memberOf me.timer
         */
        maxfps : 60,

        /**
         * Enable/disable frame interpolation
         * @see me.timer.tick
         * @type {Boolean}
         * @default false
         * @name interpolation
         * @memberOf me.timer
         */
        interpolation : false,

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
        lastUpdate : window.performance.now(),

        /**
         * init the timer
         * @ignore
         */
        init() {
            // reset variables to initial state
            this.reset();
            now = last = 0;
            // register to the game update event
            event.subscribe(event.GAME_UPDATE, updateTimers);
        },

        /**
         * reset time (e.g. usefull in case of pause)
         * @name reset
         * @memberOf me.timer
         * @ignore
         * @function
         */
        reset() {
            // set to "now"
            last = now = window.performance.now();
            delta = 0;
            // reset delta counting variables
            framedelta = 0;
            framecount = 0;
            step = Math.ceil(1000 / this.maxfps); // ROUND IT ?
            // define some step with some margin
            minstep = (1000 / this.maxfps) * 1.25; // IS IT NECESSARY?\
        },

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
        setTimeout(fn, delay, pauseable) {
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
        },

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
        setInterval(fn, delay, pauseable) {
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
        },

        /**
         * Clears the delay set by me.timer.setTimeout().
         * @name clearTimeout
         * @memberOf me.timer
         * @function
         * @param {Number} timeoutID ID of the timeout to be cleared
         */
        clearTimeout(timeoutID) {
            utils.function.defer(clearTimer, this, timeoutID);
        },

        /**
         * Clears the Interval set by me.timer.setInterval().
         * @name clearInterval
         * @memberOf me.timer
         * @function
         * @param {Number} intervalID ID of the interval to be cleared
         */
        clearInterval(intervalID) {
            utils.function.defer(clearTimer, this, intervalID);
        },

        /**
         * Return the current timestamp in milliseconds <br>
         * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
         * @name getTime
         * @memberOf me.timer
         * @return {Number}
         * @function
         */
        getTime() {
            return now;
        },

        /**
         * Return elapsed time in milliseconds since the last update
         * @name getDelta
         * @memberOf me.timer
         * @return {Number}
         * @function
         */
        getDelta() {
            return delta;
        },

        /**
         * compute the actual frame time and fps rate
         * @name computeFPS
         * @ignore
         * @memberOf me.timer
         * @function
         */
        countFPS() {
            framecount++;
            framedelta += delta;
            if (framecount % 10 === 0) {
                this.fps = clamp(Math.round((1000 * framecount) / framedelta), 0, this.maxfps);
                framedelta = 0;
                framecount = 0;
            }
        }
};

export default timer;
