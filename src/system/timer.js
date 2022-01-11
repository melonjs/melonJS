import utils from "./../utils/utils.js";
import * as event from "./../system/event.js";
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
 * update
 * @ignore
 */
function update(time) {
    last = now;
    now = time;
    delta = (now - last);

    // fix for negative timestamp returned by wechat or chrome on startup
    if (delta < 0) {
        delta = 0;
    }

    // get the game tick
    timer.tick = (delta > minstep && timer.interpolation) ? delta / step : 1;


    updateTimers();
};

/**
 * clear Timers
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
function updateTimers() {
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

// Initialize me.timer on Boot event
event.on(event.BOOT, () => {
    // reset variables to initial state
    timer.reset();
    now = last = 0;
    // register to the game before update event
    event.on(event.GAME_BEFORE_UPDATE, update);
});


/**
 * a Timer class to manage timing related function (FPS, Game Tick, Time...)
 * @namespace me.timer
 * @memberof me
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
         * @type {number}
         * @name tick
         * @memberof me.timer
         */
        tick : 1.0,

        /**
         * Last measured fps rate.<br/>
         * This feature is disabled by default, unless the debugPanel is enabled/visible
         * @public
         * @type {number}
         * @name fps
         * @memberof me.timer
         */
        fps : 0,

        /**
         * Set the maximum target display frame per second
         * @public
         * @see me.timer.tick
         * @type {number}
         * @name maxfps
         * @default 60
         * @memberof me.timer
         */
        maxfps : 60,

        /**
         * Enable/disable frame interpolation
         * @see me.timer.tick
         * @type {boolean}
         * @default false
         * @name interpolation
         * @memberof me.timer
         */
        interpolation : false,

        /**
         * reset time (e.g. usefull in case of pause)
         * @name reset
         * @memberof me.timer
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
         * @memberof me.timer
         * @param {Function} fn the function you want to execute after delay milliseconds.
         * @param {number} delay the number of milliseconds (thousandths of a second) that the function call should be delayed by.
         * @param {boolean} [pauseable=true] respects the pause state of the engine.
         * @param {object} [args] optional parameters which are passed through to the function specified by fn once the timer expires.
         * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearTimeout().
         * @function
         * @example
         * // set a timer to call "myFunction" after 1000ms
         * me.timer.setTimeout(myFunction, 1000);
         * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
         * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
         */
        setTimeout(fn, delay, pauseable, ...args) {
            timers.push({
                fn : fn,
                delay : delay,
                elapsed : 0,
                repeat : false,
                timerId : ++timerId,
                pauseable : pauseable === true || true,
                args : args
            });
            return timerId;
        },

        /**
         * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
         * @name setInterval
         * @memberof me.timer
         * @param {Function} fn the function to execute
         * @param {number} delay the number of milliseconds (thousandths of a second) on how often to execute the function
         * @param {boolean} [pauseable=true] respects the pause state of the engine.
         * @param {object} [args] optional parameters which are passed through to the function specified by fn once the timer expires.
         * @returns {number} The numerical ID of the timer, which can be used later with me.timer.clearInterval().
         * @function
         * @example
         * // set a timer to call "myFunction" every 1000ms
         * me.timer.setInterval(myFunction, 1000);
         * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
         * me.timer.setInterval(myFunction, 1000, true, param1, param2);
         */
        setInterval(fn, delay, pauseable, ...args) {
            timers.push({
                fn : fn,
                delay : delay,
                elapsed : 0,
                repeat : true,
                timerId : ++timerId,
                pauseable : pauseable === true || true,
                args : args
            });
            return timerId;
        },

        /**
         * Clears the delay set by me.timer.setTimeout().
         * @name clearTimeout
         * @memberof me.timer
         * @function
         * @param {number} timeoutID ID of the timeout to be cleared
         */
        clearTimeout(timeoutID) {
            utils.function.defer(clearTimer, this, timeoutID);
        },

        /**
         * Clears the Interval set by me.timer.setInterval().
         * @name clearInterval
         * @memberof me.timer
         * @function
         * @param {number} intervalID ID of the interval to be cleared
         */
        clearInterval(intervalID) {
            utils.function.defer(clearTimer, this, intervalID);
        },

        /**
         * Return the current timestamp in milliseconds <br>
         * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
         * @name getTime
         * @memberof me.timer
         * @returns {number}
         * @function
         */
        getTime() {
            return now;
        },

        /**
         * Return elapsed time in milliseconds since the last update
         * @name getDelta
         * @memberof me.timer
         * @returns {number}
         * @function
         */
        getDelta() {
            return delta;
        },

        /**
         * compute the actual frame time and fps rate
         * @name computeFPS
         * @ignore
         * @memberof me.timer
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
