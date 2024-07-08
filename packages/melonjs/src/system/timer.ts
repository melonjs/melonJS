import {
	BOOT,
	eventEmitter,
	GAME_BEFORE_UPDATE,
	STATE_CHANGE,
	STATE_RESTART,
	STATE_RESUME,
} from "./event.js";
import state from "../state/state.js";
import { clamp } from "../math/math.js";
import { defer } from "./../utils/function.js";

/**
 * a Timer class to manage timing related function (FPS, Game Tick, Time...)
 * @see {@link timer} the default global timer instance
 */
class Timer {
	tick: number;
	fps: number;
	maxfps: number;
	interpolation: boolean;
	framecount: number;
	framedelta: number;
	last: number;
	now: number;
	delta: number;
	step: number;
	minstep: number;
	timers: {
		fn: (...args: any[]) => any;
		delay: number;
		elapsed: number;
		repeat: boolean;
		timerId: number;
		pauseable: boolean;
		args: any[];
	}[];
	timerId: number;

	constructor() {
		/**
		 * Last game tick value. <br>
		 * Use this value to scale velocities during frame drops due to slow hardware or when setting an FPS limit.
		 * This feature is disabled by default (Enable interpolation to use it).
		 * @see interpolation
		 */
		this.tick = 1.0;

		/**
		 * Last measured fps rate.<br>
		 * This feature is disabled by default, unless the debugPanel is enabled/visible.
		 */
		this.fps = 0;

		/**
		 * Set the maximum target display frame per second
		 * @see tick
		 * @default 60
		 */
		this.maxfps = 60;

		/**
		 * Enable/disable frame interpolation
		 * @see tick
		 * @default false
		 */
		this.interpolation = false;

		//hold element to display fps
		this.framecount = 0;
		this.framedelta = 0;

		/* fps count stuff */
		this.last = 0;
		this.now = 0;
		this.delta = 0;
		// for timeout/interval update
		this.step = 0;
		this.minstep = 0;

		// list of defined timer function
		this.timers = [];
		this.timerId = 0;

		// Initialize timer on Boot event
		eventEmitter.addListenerOnce(BOOT, () => {
			// reset variables to initial state
			this.reset();
			this.now = this.last = 0;
			// register to the game before update event
			eventEmitter.addListener(GAME_BEFORE_UPDATE, (time) => {
				this.update(time);
			});
		});

		// reset timer
		eventEmitter.addListener(STATE_RESUME, () => {
			this.reset();
		});
		eventEmitter.addListener(STATE_RESTART, () => {
			this.reset();
		});
		eventEmitter.addListener(STATE_CHANGE, () => {
			this.reset();
		});
	}

	/**
	 * reset time (e.g. usefull in case of pause)
	 * @ignore
	 */
	reset() {
		// set to "now"
		this.last = this.now = globalThis.performance.now();
		this.delta = 0;
		// reset delta counting variables
		this.framedelta = 0;
		this.framecount = 0;
		this.step = Math.ceil(1000 / this.maxfps); // ROUND IT ?
		// define some step with some margin
		this.minstep = (1000 / this.maxfps) * 1.25; // IS IT NECESSARY?\
	}

	/**
	 * Calls a function once after a specified delay. See me.timer.setInterval to repeativly call a function.
	 * @param fn - the function you want to execute after delay milliseconds.
	 * @param delay - the number of milliseconds (thousandths of a second) that the function call should be delayed by.
	 * @param [pauseable] - respects the pause state of the engine.
	 * @param args - optional parameters which are passed through to the function specified by fn once the timer expires.
	 * @returns a positive integer value which identifies the timer created by the call to setTimeout(), which can be used later with me.timer.clearTimeout().
	 * @example
	 * // set a timer to call "myFunction" after 1000ms
	 * me.timer.setTimeout(myFunction, 1000);
	 * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
	 * me.timer.setTimeout(myFunction, 1000, true, param1, param2);
	 */
	setTimeout(
		fn: (...args: any[]) => any,
		delay: number,
		pauseable?: boolean | undefined,
		...args: any[]
	) {
		this.timers.push({
			fn: fn,
			delay: delay,
			elapsed: 0,
			repeat: false,
			timerId: ++this.timerId,
			pauseable: pauseable ?? true,
			args: args,
		});
		return this.timerId;
	}

	/**
	 * Calls a function continously at the specified interval.  See setTimeout to call function a single time.
	 * @param fn - the function to execute
	 * @param delay - the number of milliseconds (thousandths of a second) on how often to execute the function
	 * @param [pauseable] - respects the pause state of the engine.
	 * @param args - optional parameters which are passed through to the function specified by fn once the timer expires.
	 * @returns a numeric, non-zero value which identifies the timer created by the call to setInterval(), which can be used later with me.timer.clearInterval().
	 * @example
	 * // set a timer to call "myFunction" every 1000ms
	 * me.timer.setInterval(myFunction, 1000);
	 * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
	 * me.timer.setInterval(myFunction, 1000, true, param1, param2);
	 */
	setInterval(
		fn: (...args: any[]) => any,
		delay: number,
		pauseable?: boolean | undefined,
		...args: any[]
	) {
		this.timers.push({
			fn: fn,
			delay: delay,
			elapsed: 0,
			repeat: true,
			timerId: ++this.timerId,
			pauseable: pauseable === true || true,
			args: args,
		});
		return this.timerId;
	}

	/**
	 * Cancels a timeout previously established by calling setTimeout().
	 * @param timeoutID - ID of the timeout to be cancelled
	 */
	clearTimeout(timeoutID: number) {
		if (timeoutID > 0) {
			defer(() => {
				this.clearTimer(timeoutID);
			}, this);
		}
	}

	/**
	 * cancels the timed, repeating action which was previously established by a call to setInterval().
	 * @param intervalID - ID of the interval to be cleared
	 */
	clearInterval(intervalID: number) {
		if (intervalID > 0) {
			defer(() => {
				this.clearTimer(intervalID);
			}, this);
		}
	}

	/**
	 * Return the current timestamp in milliseconds <br>
	 * since the game has started or since linux epoch (based on browser support for High Resolution Timer)
	 * @returns current time
	 */
	getTime() {
		return this.now;
	}

	/**
	 * Return elapsed time in milliseconds since the last update
	 * @returns elapsed time
	 */
	getDelta() {
		return this.delta;
	}

	/**
	 * compute the actual frame time and fps rate
	 * @ignore
	 */
	countFPS() {
		this.framecount++;
		this.framedelta += this.delta;
		if (this.framecount % 10 === 0) {
			this.fps = clamp(
				Math.round((1000 * this.framecount) / this.framedelta),
				0,
				this.maxfps,
			);
			this.framedelta = 0;
			this.framecount = 0;
		}
	}

	/**
	 * update
	 * @ignore
	 */
	update(time: number) {
		this.last = this.now;
		this.now = time;
		this.delta = this.now - this.last;

		// fix for negative timestamp returned by wechat or chrome on startup
		if (this.delta < 0) {
			this.delta = 0;
		}

		// get the game tick
		this.tick =
			this.delta > this.minstep && this.interpolation
				? this.delta / this.step
				: 1;

		this.updateTimers();
	}

	/**
	 * clear Timers
	 * @ignore
	 */
	clearTimer(timerId: number) {
		for (let i = 0; i < this.timers.length; i++) {
			if (this.timers[i].timerId === timerId) {
				this.timers.splice(i, 1);
				break;
			}
		}
	}

	/**
	 * update timers
	 * @ignore
	 */
	updateTimers() {
		for (const timer of this.timers) {
			if (!(timer.pauseable && state.isPaused())) {
				timer.elapsed += this.delta;
			}
			if (timer.elapsed >= timer.delay) {
				timer.fn(...timer.args);

				if (timer.repeat) {
					timer.elapsed -= timer.delay;
				} else {
					this.clearTimer(timer.timerId);
				}
			}
		}
	}
}

const timer = new Timer();

/**
 * the default global Timer instance
 * @see Timer
 * @example
 * // set a timer to call "myFunction" after 1000ms
 * timer.setTimeout(myFunction, 1000);
 * // set a timer to call "myFunction" after 1000ms (respecting the pause state) and passing param1 and param2
 * timer.setTimeout(myFunction, 1000, true, param1, param2);
 * // set a timer to call "myFunction" every 1000ms
 * timer.setInterval(myFunction, 1000);
 * // set a timer to call "myFunction" every 1000ms (respecting the pause state) and passing param1 and param2
 * timer.setInterval(myFunction, 1000, true, param1, param2);
 */
export default timer;
