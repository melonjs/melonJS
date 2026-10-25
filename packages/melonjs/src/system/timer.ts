import { clamp } from "../math/math.js";
import state from "../state/state.ts";
import { defer } from "./../utils/function.js";
import {
	BOOT,
	GAME_BEFORE_UPDATE,
	on,
	once,
	STATE_CHANGE,
	STATE_RESTART,
	STATE_RESUME,
} from "./event.js";

/**
 * The display frame times {@link Timer#syncToDisplay} counts exactly, as
 * multiples of `1000 / maxfps`: 15, 20, 30, 60, 120, 180 and 240 Hz at the
 * default `maxfps` of 60.
 * @ignore
 */
const STEP_RATIOS = [4, 3, 2, 1, 1 / 2, 1 / 3, 1 / 4];

/**
 * a Timer class to manage timing related function (FPS, Game Tick, Time...)
 * @see {@link timer} the default global timer instance
 */
class Timer {
	tick: number;
	fps: number;
	maxfps: number;
	interpolation: boolean;
	syncToDisplay: boolean;
	/**
	 * the display's frame time, learned by {@link Timer#syncToDisplay}
	 * @ignore
	 * @internal
	 */
	_displayFrame: number;
	/**
	 * the time {@link Timer#syncToDisplay} rounded off, carried to the next
	 * frames (less than a display frame either way)
	 * @ignore
	 * @internal
	 */
	_frameLeftover: number;
	/**
	 * how many frames running were far from the learned display frame, and
	 * close to one another: a display whose rate changed
	 * @ignore
	 * @internal
	 */
	_displayRun: number;
	/**
	 * the total time of those frames
	 * @ignore
	 * @internal
	 */
	_displayRunTotal: number;
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

		/**
		 * Count the time each frame took in whole display frames.<br>
		 * The browser reports frame times that jitter around the display's
		 * refresh, by up to a millisecond either way. When the display runs
		 * as fast as the game updates (60 Hz for 60 updates a second), that
		 * jitter can leave a frame with no update and give the next one two,
		 * and whatever moves on screen stutters. Counted in whole display
		 * frames, the updates fall in a steady pattern: one every frame at
		 * 60 Hz, one every other frame at 120 Hz. The time rounded off is
		 * carried to the next frame, so the game keeps its speed.<br>
		 * A display within 2% of `maxfps` (60 by default), or of 2, 3 or 4
		 * times it, or a half, a third or a quarter of it (120, 180, 240, 30,
		 * 20 or 15 Hz), is counted at exactly that rate, so a 59.94 Hz screen
		 * runs the game 0.1% slower than the wall clock. The display's rate
		 * is learned as the game runs, and learned again when it changes.
		 * Leave it off when the updates must keep to the wall clock exactly.<br>
		 * Set by the `syncToDisplay` application setting when the
		 * {@link Application} is initialized.
		 * @see ApplicationSettings.syncToDisplay
		 * @default false
		 * @example
		 * // turned on or off while the game runs, as the setting does at start
		 * timer.syncToDisplay = true;
		 */
		this.syncToDisplay = false;
		this._displayFrame = 0;
		this._frameLeftover = 0;
		this._displayRun = 0;
		this._displayRunTotal = 0;

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
		once(BOOT, () => {
			// reset variables to initial state
			this.reset();
			this.now = this.last = 0;
			// register to the game before update event
			on(GAME_BEFORE_UPDATE, (time) => {
				this.update(time);
			});
		});

		// reset timer
		on(STATE_RESUME, () => {
			this.reset();
		});
		on(STATE_RESTART, () => {
			this.reset();
		});
		on(STATE_CHANGE, () => {
			this.reset();
		});
	}

	/**
	 * reset time (e.g. usefull in case of pause)
	 * @ignore
	 * @internal
	 */
	reset() {
		// set to "now"
		this.last = this.now = globalThis.performance.now();
		this.delta = 0;
		// reset delta counting variables
		this.framedelta = 0;
		this.framecount = 0;
		this.step = 1000 / this.maxfps;
		this.minstep = (1000 / this.maxfps) * 1.25;
		// the display is the same; only the time it was owed is dropped
		this._frameLeftover = 0;
		this._displayRun = 0;
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
		pauseable?: boolean,
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
		pauseable?: boolean,
		...args: any[]
	) {
		this.timers.push({
			fn: fn,
			delay: delay,
			elapsed: 0,
			repeat: true,
			timerId: ++this.timerId,
			pauseable: pauseable ?? true,
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
	 * update
	 * @ignore
	 * @internal
	 */
	update(time: number) {
		this.last = this.now;
		this.now = time;
		this.delta = this.now - this.last;

		// fix for negative timestamp returned by wechat or chrome on startup
		if (this.delta < 0) {
			this.delta = 0;
		}

		if (this.syncToDisplay) {
			this.delta = this.countDisplayFrames(this.delta);
		}

		// get the game tick
		this.tick =
			this.delta > this.minstep && this.interpolation
				? this.delta / this.step
				: 1;

		// update the running FPS estimate (averaged over the last 10 frames)
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

		this.updateTimers();
	}

	/**
	 * The time a frame took, counted in whole display frames (see
	 * {@link Timer#syncToDisplay}).
	 * @param delta - the time the frame took, in milliseconds
	 * @returns that time as a whole number of display frames
	 * @ignore
	 * @internal
	 */
	countDisplayFrames(delta: number) {
		const step = this.step;
		if (!(this._displayFrame > 0)) {
			this._displayFrame = step;
		}
		// the display's frame time, learned from the frames of about its
		// length
		const learned = this._displayFrame;
		if (delta > learned / 1.5 && delta < learned * 1.5) {
			this._displayFrame += (delta - learned) * 0.05;
			this._displayRun = 0;
		} else if (delta > 0) {
			// a frame far from it: a dropped one (longer), the partial first
			// frame after a reset (shorter), or a display whose rate changed,
			// moved to another screen or slowed down on battery. Frames of the
			// same length several times running are the display's new rate; a
			// shorter frame is never a dropped one, so it is taken sooner
			const mean =
				this._displayRun > 0 ? this._displayRunTotal / this._displayRun : 0;
			if (this._displayRun > 0 && Math.abs(delta - mean) < mean * 0.2) {
				this._displayRun++;
				this._displayRunTotal += delta;
			} else {
				this._displayRun = 1;
				this._displayRunTotal = delta;
			}
			if (this._displayRun >= (delta < learned ? 2 : 6)) {
				this._displayFrame = this._displayRunTotal / this._displayRun;
				this._displayRun = 0;
			}
		}
		// a display in step with the updates counts exactly that multiple or
		// fraction of a step, so the updates fall in a fixed pattern
		let frame = this._displayFrame;
		for (const ratio of STEP_RATIOS) {
			const exact = step * ratio;
			if (Math.abs(frame - exact) < exact * 0.02) {
				frame = exact;
				break;
			}
		}
		// whole frames: each frame counted by its own length, so one a little
		// early or late is still one frame. What is rounded off is carried,
		// and counted once it adds up to a whole frame either way, which
		// brings the carry back near nothing: the game keeps its speed, and a
		// carry left near half a frame cannot flip the count on the jitter
		const learnedFrame = this._displayFrame;
		let frames = Math.max(0, Math.round(delta / learnedFrame));
		let leftover = this._frameLeftover + delta - frames * learnedFrame;
		if (leftover >= learnedFrame) {
			frames++;
			leftover -= learnedFrame;
		} else if (leftover <= -learnedFrame && frames > 0) {
			frames--;
			leftover += learnedFrame;
		}
		this._frameLeftover = leftover;
		return frames * frame;
	}

	/**
	 * clear Timers
	 * @ignore
	 * @internal
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
	 * @internal
	 */
	updateTimers() {
		// Iterate a SNAPSHOT. The non-repeating branch below calls
		// `clearTimer()`, which splices `this.timers` synchronously, and a
		// callback is free to add or remove timers too. Splicing during a
		// `for...of` over the live array shifts every later element down one,
		// so the entry after a fired one-shot was skipped for that tick: two
		// timers due on the same frame, only one fired, the other a frame late.
		// Silent, which is why it survived. The public `clearTimeout` already
		// defers removal for exactly this reason.
		//
		// A timer cleared by an earlier callback in the same tick must still
		// not fire, hence the membership check before dispatch.
		for (const timer of [...this.timers]) {
			if (!this.timers.includes(timer)) {
				continue;
			}
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
