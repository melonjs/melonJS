export default timer;
declare const timer: Timer;
/**
 * @classdesc
 * a Timer class to manage timing related function (FPS, Game Tick, Time...)
 * @see {@link timer} the default global timer instance
 */
declare class Timer {
    /**
     * Last game tick value. <br>
     * Use this value to scale velocities during frame drops due to slow hardware or when setting an FPS limit.
     * This feature is disabled by default (Enable interpolation to use it).
     * @public
     * @see interpolation
     * @See maxfps
     * @type {number}
     * @name tick
     */
    public tick: number;
    /**
     * Last measured fps rate.<br>
     * This feature is disabled by default, unless the debugPanel is enabled/visible.
     * @public
     * @type {number}
     * @name fps
     */
    public fps: number;
    /**
     * Set the maximum target display frame per second
     * @public
     * @see tick
     * @type {number}
     * @default 60
     */
    public maxfps: number;
    /**
     * Enable/disable frame interpolation
     * @see tick
     * @type {boolean}
     * @default false
     */
    interpolation: boolean;
    framecount: number;
    framedelta: number;
    last: number;
    now: number;
    delta: number;
    step: number;
    minstep: number;
    timers: any[];
    timerId: number;
    /**
     * reset time (e.g. usefull in case of pause)
     * @ignore
     */
    reset(): void;
    /**
     * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
     * @param {Function} fn - the function you want to execute after delay milliseconds.
     * @param {number} delay - the number of milliseconds (thousandths of a second) that the function call should be delayed by.
     * @param {boolean} [pauseable=true] - respects the pause state of the engine.
     * @param {...*} args - optional parameters which are passed through to the function specified by fn once the timer expires.
     * @returns {number} a positive integer value which identifies the timer created by the call to setTimeout(), which can be used later with me.timer.clearTimeout().
     * @example
     * // set a timer to call "myFunction" after 1000ms
     * me.timer.setTimeout(myFunction, 1000);
     * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
     */
    setTimeout(fn: Function, delay: number, pauseable?: boolean | undefined, ...args: any[]): number;
    /**
     * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
     * @param {Function} fn - the function to execute
     * @param {number} delay - the number of milliseconds (thousandths of a second) on how often to execute the function
     * @param {boolean} [pauseable=true] - respects the pause state of the engine.
     * @param {...*} args - optional parameters which are passed through to the function specified by fn once the timer expires.
     * @returns {number} a numeric, non-zero value which identifies the timer created by the call to setInterval(), which can be used later with me.timer.clearInterval().
     * @example
     * // set a timer to call "myFunction" every 1000ms
     * me.timer.setInterval(myFunction, 1000);
     * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
     * me.timer.setInterval(myFunction, 1000, true, param1, param2);
     */
    setInterval(fn: Function, delay: number, pauseable?: boolean | undefined, ...args: any[]): number;
    /**
     * Cancels a timeout previously established by calling setTimeout().
     * @param {number} timeoutID - ID of the timeout to be cancelled
     */
    clearTimeout(timeoutID: number): void;
    /**
     * cancels the timed, repeating action which was previously established by a call to setInterval().
     * @param {number} intervalID - ID of the interval to be cleared
     */
    clearInterval(intervalID: number): void;
    /**
     * Return the current timestamp in milliseconds <br>
     * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
     * @returns {number}
     */
    getTime(): number;
    /**
     * Return elapsed time in milliseconds since the last update
     * @returns {number}
     */
    getDelta(): number;
    /**
     * compute the actual frame time and fps rate
     * @ignore
     */
    countFPS(): void;
    /**
     * update
     * @ignore
     */
    update(time: any): void;
    /**
     * clear Timers
     * @ignore
     */
    clearTimer(timerId: any): void;
    /**
     * update timers
     * @ignore
     */
    updateTimers(): void;
}
