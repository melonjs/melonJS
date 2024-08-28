import timer from "../system/timer.js";
import { game } from "../index.js";
import { createPool } from "../system/pool.ts";
import { Easing, EasingFunction } from "./easing.js";
import { Interpolation, InterpolationFunction } from "./interpolation.js";
import { eventEmitter, STATE_RESUME } from "../system/event.js";

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
 * Javascript Tweening Engine<p>
 * Super simple, fast and easy to use tweening engine which incorporates optimised Robert Penner's equation<p>
 * <a href="https://github.com/sole/Tween.js">https://github.com/sole/Tween.js</a><p>
 * author sole / http://soledadpenades.com<br>
 * author mr.doob / http://mrdoob.com<br>
 * author Robert Eisele / http://www.xarg.org<br>
 * author Philippe / http://philippe.elsass.me<br>
 * author Robert Penner / http://www.robertpenner.com/easing_terms_of_use.html<br>
 * author Paul Lewis / http://www.aerotwist.com/<br>
 * author lechecacharro<br>
 * author Josh Faul / http://jocafa.com/
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
	isPersistent: boolean;
	updateWhenPaused: boolean;
	isRenderable: boolean;

	#boundResumeCallback: (elapsed: number) => void;

	/**
	 * @param object - object on which to apply the tween
	 * @example
	 * // add a tween to change the object pos.x and pos.y variable to 200 in 3 seconds
	 * tween = new me.Tween(myObject.pos).to({
	 *       x: 200,
	 *       y: 200,
	 *    }, {
	 *       duration: 3000,
	 *       easing: me.Tween.Easing.Bounce.Out,
	 *       autoStart : true
	 * }).onComplete(myFunc);
	 */
	constructor(object: object) {
		this.setProperties(object);

		this.#boundResumeCallback = this._resumeCallback.bind(this);
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
		// tweens are synchronized with the game update loop
		this._tweenTimeTracker = game.lastUpdate;

		// reset flags to default value
		this.isPersistent = false;
		// this is not really supported
		this.updateWhenPaused = false;
		// comply with the container contract
		this.isRenderable = false;

		// Set all starting values present on the target object
		for (const field in object) {
			if (typeof object !== "object") {
				this._valuesStart[field] = parseFloat(object[field]);
			}
		}
	}

	/**
	 * @ignore
	 */
	_resumeCallback(elapsed: number) {
		if (this._startTime) {
			this._startTime += elapsed;
		}
	}

	/**
	 * subscribe to the resume event when added
	 * @ignore
	 */
	onActivateEvent() {
		eventEmitter.addListener(STATE_RESUME, this.#boundResumeCallback);
	}

	/**
	 * Unsubscribe when tween is removed
	 * @ignore
	 */
	onDeactivateEvent() {
		eventEmitter.removeListener(STATE_RESUME, this.#boundResumeCallback);
	}

	/**
	 * object properties to be updated and duration
	 * @param properties - hash of properties
	 * @param [options] - object of tween properties, or a duration if a numeric value is passed
	 * @param [options.duration] - tween duration
	 * @param [options.easing] - easing function
	 * @param [options.delay] - delay amount expressed in milliseconds
	 * @param [options.yoyo] - allows the tween to bounce back to their original value when finished. To be used together with repeat to create endless loops.
	 * @param [options.repeat] - amount of times the tween should be repeated
	 * @param [options.interpolation] - interpolation function
	 * @param [options.autoStart] - allow this tween to start automatically. Otherwise call me.Tween.start().
	 * @returns this instance for object chaining
	 */
	to(
		properties: Record<string, unknown>,
		options?:
			| {
					duration?: number | undefined;
					easing?: EasingFunction | undefined;
					yoyo?: boolean | undefined;
					repeat?: number | undefined;
					delay?: number | undefined;
					interpolation?: InterpolationFunction | undefined;
					autoStart?: boolean | undefined;
			  }
			| undefined,
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
	 * start the tween
	 * @param [time] - the current time when the tween was started
	 * @returns this instance for object chaining
	 */
	start(time = timer.getTime()) {
		this._onStartCallbackFired = false;

		// add the tween to the object pool on start
		game.world.addChild(this);

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
	 * stop the tween
	 * @returns this instance for object chaining
	 */
	stop() {
		// remove the tween from the world container
		game.world.removeChildNow(this);
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
			game.lastUpdate > this._tweenTimeTracker
				? game.lastUpdate
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
				// remove the tween from the world container
				game.world.removeChildNow(this);

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

	// export easing function as static class property
	static get Easing() {
		return Easing;
	}
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
