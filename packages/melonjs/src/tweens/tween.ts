import {
	GAME_AFTER_UPDATE,
	GAME_RESET,
	off,
	on,
	STATE_PAUSE,
	STATE_RESUME,
	TICK,
} from "../system/event.js";
import { createPool } from "../system/pool.ts";
import timer from "../system/timer.js";
import { Easing, EasingFunction } from "./easing.js";
import { Interpolation, InterpolationFunction } from "./interpolation.js";

/*
 * Tween.js - Licensed under the MIT license
 * https://github.com/tweenjs/tween.js
 */

/** @ignore */
type OnStartCallback<T> = (this: T) => void;
/** @ignore */
type OnUpdateCallback<T> = (this: T, value: number) => void;
/** @ignore */
type OnCompleteCallback<T> = (this: T) => void;

/**
 * A tweening engine for smoothly interpolating object properties over time.
 * Based on <a href="https://github.com/sole/Tween.js">tween.js</a> with
 * optimised Robert Penner's equations.
 *
 * Tweens use an event-based lifecycle — on `start()` the tween subscribes to
 * the game loop events (`TICK`, `STATE_PAUSE`, `STATE_RESUME`, `GAME_RESET`)
 * and automatically unsubscribes on completion or `stop()`.
 * They do not need to be added to a container.
 * @example
 * // basic usage
 * new me.Tween(myObject.pos)
 *     .to({ x: 200, y: 200 }, { duration: 3000, easing: me.Tween.Easing.Bounce.Out })
 *     .onComplete(() => console.log("done!"))
 *     .start();
 * @example
 * // auto-start with options
 * new me.Tween(myObject.pos).to({ x: 200 }, {
 *     duration: 1000,
 *     easing: me.Tween.Easing.Quadratic.InOut,
 *     yoyo: true,
 *     repeat: Infinity,
 *     autoStart: true,
 * });
 * @category Tweens
 */
export default class Tween {
	_object: object;
	_valuesStart: Record<string, unknown>;
	_valuesEnd: Record<string, unknown>;
	_valuesStartRepeat: Record<string, unknown>;
	_duration: number;
	_repeat: number;
	_yoyo: boolean;
	_reversed: boolean;
	_delayTime: number;
	_startTime: number | null;
	_easingFunction: EasingFunction;
	_interpolationFunction: InterpolationFunction;
	_chainedTweens: Array<Tween>;
	_onStartCallback: OnStartCallback<object> | null;
	_onStartCallbackFired: boolean;
	_onUpdateCallback: OnUpdateCallback<object> | null;
	_onCompleteCallback: OnCompleteCallback<object> | null;
	_tweenTimeTracker: number;
	_lastUpdate: number;
	_isRunning: boolean;
	_isPaused: boolean;
	_lastTick: number;

	/**
	 * whether the tween should persist across state changes (not auto-stopped on game reset)
	 * @default false
	 */
	isPersistent: boolean;

	/**
	 * whether the tween should keep running when the game is paused
	 * @default false
	 */
	updateWhenPaused: boolean;

	/**
	 * @param object - the object whose properties will be tweened
	 */
	constructor(object: object) {
		this.setProperties(object);
	}

	/**
	 * @ignore
	 */
	onResetEvent(object: object) {
		this.setProperties(object);
	}

	/**
	 * @ignore
	 */
	setProperties(object: object) {
		// ensure any running tween is stopped before resetting (e.g., pool reuse)
		this._unsubscribe();

		this._object = object;
		this._valuesStart = {};
		this._valuesEnd = {};
		this._valuesStartRepeat = {};
		this._duration = 1000;
		this._repeat = 0;
		this._yoyo = false;
		this._reversed = false;
		this._delayTime = 0;
		this._startTime = null;
		this._easingFunction = Easing.Linear.None;
		this._interpolationFunction = Interpolation.Linear;
		this._chainedTweens = [];
		this._onStartCallback = null;
		this._onStartCallbackFired = false;
		this._onUpdateCallback = null;
		this._onCompleteCallback = null;
		// track the last update timestamp from the game loop
		this._lastUpdate = globalThis.performance.now();
		this._tweenTimeTracker = this._lastUpdate;
		this._isRunning = false;
		this._isPaused = false;
		this._lastTick = globalThis.performance.now();
		this.isPersistent = false;
		this.updateWhenPaused = false;
	}

	/**
	 * @ignore
	 */
	_resumeCallback(elapsed: number) {
		this._isPaused = false;
		if (this._startTime && !this.updateWhenPaused) {
			this._startTime += elapsed;
		}
	}

	/** @ignore */
	_onAfterUpdate(lastUpdate: number) {
		this._lastUpdate = lastUpdate;
	}

	/** @ignore */
	_onTick(timestamp: number) {
		if (!this._isPaused || this.updateWhenPaused) {
			// compute delta from the raw RAF timestamp
			const dt = timestamp - this._lastTick;
			this._lastTick = timestamp;
			if (dt > 0 && dt < 1000) {
				this.update(dt);
			}
		}
	}

	/** @ignore */
	_onPause() {
		this._isPaused = true;
	}

	/** @ignore */
	_onReset() {
		if (!this.isPersistent) {
			this.stop();
		}
	}

	/**
	 * Subscribe to the game loop events
	 * @ignore
	 */
	_subscribe() {
		if (!this._isRunning) {
			this._isRunning = true;
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(TICK, this._onTick, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(STATE_PAUSE, this._onPause, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(STATE_RESUME, this._resumeCallback, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(GAME_AFTER_UPDATE, this._onAfterUpdate, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			on(GAME_RESET, this._onReset, this);
		}
	}

	/**
	 * Unsubscribe from the game loop events
	 * @ignore
	 */
	_unsubscribe() {
		if (this._isRunning) {
			this._isRunning = false;
			this._isPaused = false;
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(TICK, this._onTick, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(STATE_PAUSE, this._onPause, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(STATE_RESUME, this._resumeCallback, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(GAME_AFTER_UPDATE, this._onAfterUpdate, this);
			// eslint-disable-next-line @typescript-eslint/unbound-method
			off(GAME_RESET, this._onReset, this);
		}
	}

	/**
	 * Define the target property values and tween options.
	 * @param properties - target property values to tween to (e.g. `{ x: 200, y: 100 }`)
	 * @param [options] - tween configuration
	 * @param [options.duration] - tween duration in milliseconds
	 * @param [options.easing] - easing function (e.g. `Tween.Easing.Quadratic.InOut`)
	 * @param [options.delay] - delay before starting, in milliseconds
	 * @param [options.yoyo] - bounce back to original values when finished (use with `repeat`)
	 * @param [options.repeat] - number of times to repeat (use `Infinity` for endless loops)
	 * @param [options.interpolation] - interpolation function for array values
	 * @param [options.autoStart] - start the tween immediately without calling `start()`
	 * @returns this instance for object chaining
	 */
	to(
		properties: Record<string, unknown>,
		options?: {
			duration?: number | undefined;
			easing?: EasingFunction | undefined;
			yoyo?: boolean | undefined;
			repeat?: number | undefined;
			delay?: number | undefined;
			interpolation?: InterpolationFunction | undefined;
			autoStart?: boolean | undefined;
		},
	) {
		this._valuesEnd = properties;

		if (typeof options !== "undefined") {
			if (options.duration) {
				this._duration = options.duration;
			}
			if (options.yoyo) {
				this.yoyo(options.yoyo);
			}
			if (options.easing) {
				this.easing(options.easing);
			}
			if (options.repeat) {
				this.repeat(options.repeat);
			}
			if (options.delay) {
				this.delay(options.delay);
			}
			if (options.interpolation) {
				this.interpolation(options.interpolation);
			}
			if (options.autoStart) {
				this.start();
			}
		}

		return this;
	}

	/**
	 * Start the tween. Subscribes to game loop events and begins interpolation.
	 * @param [time] - the start time (defaults to current game time)
	 * @returns this instance for object chaining
	 */
	start(time = timer.getTime()) {
		this._onStartCallbackFired = false;

		// subscribe to game loop events
		this._lastTick = globalThis.performance.now();
		this._subscribe();

		this._startTime = time + this._delayTime;

		for (const property in this._valuesEnd) {
			const endValue = this._valuesEnd[property];
			// check if an Array was provided as property value
			if (Array.isArray(endValue)) {
				if (endValue.length === 0) {
					continue;
				}

				// create a local copy of the Array with the start value at the front
				this._valuesEnd[property] = [
					(this._object as Record<string, unknown>)[property],
				].concat(endValue);
			}

			this._valuesStart[property] = (this._object as Record<string, unknown>)[
				property
			];

			if (!Array.isArray(this._valuesStart[property])) {
				(this._valuesStart[property] as number) *= 1.0; // Ensures we're using numbers, not strings
			}

			this._valuesStartRepeat[property] = this._valuesStart[property] || 0;
		}

		return this;
	}
	/**
	 * Stop the tween. Unsubscribes from all game loop events.
	 * @returns this instance for object chaining
	 */
	stop() {
		this._unsubscribe();
		return this;
	}

	/**
	 * delay the tween
	 * @param amount - delay amount expressed in milliseconds
	 * @returns this instance for object chaining
	 */
	delay(amount: number) {
		this._delayTime = amount;
		return this;
	}

	/**
	 * Repeat the tween
	 * @param times - amount of times the tween should be repeated
	 * @returns this instance for object chaining
	 */
	repeat(times: number) {
		this._repeat = times;
		return this;
	}

	/**
	 * Allows the tween to bounce back to their original value when finished.
	 * To be used together with repeat to create endless loops.
	 * @param yoyo flag
	 * @returns this instance for object chaining
	 */
	yoyo(yoyo: boolean) {
		this._yoyo = yoyo;
		return this;
	}

	/**
	 * set the easing function
	 * @param easing - easing function
	 * @returns this instance for object chaining
	 */
	easing(easing: EasingFunction) {
		this._easingFunction = easing;
		return this;
	}

	/**
	 * set the interpolation function
	 * @param interpolation - interpolation function
	 * @returns this instance for object chaining
	 */
	interpolation(interpolation: InterpolationFunction) {
		this._interpolationFunction = interpolation;
		return this;
	}

	/**
	 * chain the tween
	 * @param tweens - Tween(s) to be chained
	 * @returns this instance for object chaining
	 */
	chain(...tweens: Tween[]) {
		this._chainedTweens = tweens;
		return this;
	}

	/**
	 * onStart callback
	 * @param onStartCallback - callback
	 * @returns this instance for object chaining
	 */
	onStart(onStartCallback: OnStartCallback<object>) {
		this._onStartCallback = onStartCallback;
		return this;
	}

	/**
	 * onUpdate callback
	 * @param onUpdateCallback - callback
	 * @returns this instance for object chaining
	 */
	onUpdate(onUpdateCallback: OnUpdateCallback<object>) {
		this._onUpdateCallback = onUpdateCallback;
		return this;
	}

	/**
	 * onComplete callback
	 * @param onCompleteCallback - callback
	 * @returns this instance for object chaining
	 */
	onComplete(onCompleteCallback: OnCompleteCallback<object>) {
		this._onCompleteCallback = onCompleteCallback;
		return this;
	}

	/** @ignore */
	update(dt: number) {
		// the original Tween implementation expect
		// a timestamp and not a time delta
		this._tweenTimeTracker =
			this._lastUpdate > this._tweenTimeTracker
				? this._lastUpdate
				: this._tweenTimeTracker + dt;
		const time = this._tweenTimeTracker;

		if (this._startTime === null || time < this._startTime) {
			return true;
		}

		if (!this._onStartCallbackFired) {
			if (this._onStartCallback !== null) {
				this._onStartCallback.call(this._object);
			}

			this._onStartCallbackFired = true;
		}

		let elapsed = (time - this._startTime) / this._duration;
		elapsed = elapsed > 1 ? 1 : elapsed;

		const value = this._easingFunction(elapsed);

		for (const property in this._valuesEnd) {
			const start = this._valuesStart[property] || 0;
			let end = this._valuesEnd[property];

			if (Array.isArray(end)) {
				// @ts-expect-error todo
				this._object[property] = this._interpolationFunction(end, value);
			} else {
				// Parses relative end values with start as base (e.g.: +10, -3)
				if (typeof end === "string") {
					// @ts-expect-error todo
					// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
					end = start + parseFloat(end);
				}

				// protect against non numeric properties.
				if (typeof end === "number") {
					// @ts-expect-error todo
					// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
					this._object[property] = start + (end - start) * value;
				}
			}
		}

		if (this._onUpdateCallback !== null) {
			this._onUpdateCallback.call(this._object, value);
		}

		if (elapsed === 1) {
			if (this._repeat > 0) {
				if (isFinite(this._repeat)) {
					this._repeat--;
				}

				// reassign starting values, restart by making startTime = now
				for (const property in this._valuesStartRepeat) {
					if (typeof this._valuesEnd[property] === "string") {
						this._valuesStartRepeat[property] =
							// @ts-expect-error todo
							// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
							this._valuesStartRepeat[property] +
							// @ts-ignore
							parseFloat(this._valuesEnd[property]);
					}

					if (this._yoyo) {
						const tmp = this._valuesStartRepeat[property];
						this._valuesStartRepeat[property] = this._valuesEnd[property];
						this._valuesEnd[property] = tmp;
					}
					this._valuesStart[property] = this._valuesStartRepeat[property];
				}

				if (this._yoyo) {
					this._reversed = !this._reversed;
				}

				this._startTime = time + this._delayTime;

				return true;
			} else {
				// unsubscribe from events on completion
				this._unsubscribe();

				if (this._onCompleteCallback !== null) {
					this._onCompleteCallback.call(this._object);
				}

				for (
					let i = 0, numChainedTweens = this._chainedTweens.length;
					i < numChainedTweens;
					i++
				) {
					this._chainedTweens[i].start(time);
				}

				return false;
			}
		}
		return true;
	}

	/**
	 * Available easing functions, accessed via `Tween.Easing`.
	 * Each family provides `In`, `Out`, and `InOut` variants.
	 * @see {@link Easing} for the full list
	 * @example
	 * me.Tween.Easing.Quadratic.InOut
	 * me.Tween.Easing.Bounce.Out
	 * me.Tween.Easing.Elastic.In
	 */
	static get Easing() {
		return Easing;
	}

	/**
	 * Available interpolation functions for tweening array values.
	 * @see {@link Interpolation}
	 * @example
	 * me.Tween.Interpolation.Linear
	 * me.Tween.Interpolation.Bezier
	 * me.Tween.Interpolation.CatmullRom
	 */
	static get Interpolation() {
		return Interpolation;
	}
}

export const tweenPool = createPool((obj: object) => {
	const tween = new Tween(obj);

	return {
		instance: tween,
		reset(obj: object) {
			tween.setProperties(obj);
		},
	};
});
