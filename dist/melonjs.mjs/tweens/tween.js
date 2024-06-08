/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import timer from '../system/timer.js';
import { on, STATE_RESUME, off } from '../system/event.js';
import { game } from '../index.js';
import { Easing } from './easing.js';
import { Interpolation } from './interpolation.js';

/*
 * Tween.js - Licensed under the MIT license
 * https://github.com/tweenjs/tween.js
 */

/**
 * @classdesc
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
class Tween {

    /**
     * @param {object} object - object on which to apply the tween
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
    constructor (object) {
        this.setProperties(object);
    }

    /**
     * reset the tween object to default value
     * @ignore
     */
    onResetEvent(object) {
        this.setProperties(object);
    }

    /**
     * @ignore
     */
    setProperties(object) {
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
        for (let field in object) {
            if (typeof object !== "object") {
                this._valuesStart[ field ] = parseFloat(object[field]);
            }
        }
    }

    /**
     * @ignore
     */
    _resumeCallback(elapsed) {
        if (this._startTime) {
            this._startTime += elapsed;
        }
    }



    /**
     * subscribe to the resume event when added
     * @ignore
     */
    onActivateEvent() {
        on(STATE_RESUME, this._resumeCallback, this);
    }

    /**
     * Unsubscribe when tween is removed
     * @ignore
     */
    onDeactivateEvent() {
        off(STATE_RESUME, this._resumeCallback);
    }

    /**
     * object properties to be updated and duration
     * @name to
     * @memberof Tween
     * @public
     * @param {object} properties - hash of properties
     * @param {object|number} [options] - object of tween properties, or a duration if a numeric value is passed
     * @param {number} [options.duration] - tween duration
     * @param {Tween.Easing} [options.easing] - easing function
     * @param {number} [options.delay] - delay amount expressed in milliseconds
     * @param {boolean} [options.yoyo] - allows the tween to bounce back to their original value when finished. To be used together with repeat to create endless loops.
     * @param {number} [options.repeat] - amount of times the tween should be repeated
     * @param {Tween.Interpolation} [options.interpolation] - interpolation function
     * @param {boolean} [options.autoStart] - allow this tween to start automatically. Otherwise call me.Tween.start().
     * @returns {Tween} this instance for object chaining
     */
    to(properties, options) {

        this._valuesEnd = properties;

        if (typeof options !== "undefined") {
            if (typeof options === "number") {
                // for backward compatiblity
                this._duration = options;
            } else if (typeof options === "object") {
                if (options.duration) { this._duration = options.duration; }
                if (options.yoyo) { this.yoyo(options.yoyo); }
                if (options.easing) { this.easing(options.easing); }
                if (options.repeat) { this.repeat(options.repeat); }
                if (options.delay) { this.delay(options.delay); }
                if (options.interpolation) { this.interpolation(options.interpolation); }

                if (options.autoStart) {
                    this.start();
                }
            }
        }

        return this;
    }

    /**
     * start the tween
     * @name start
     * @memberof Tween
     * @public
     * @param {number} [time] - the current time when the tween was started
     * @returns {Tween} this instance for object chaining
     */
    start(time = timer.getTime()) {

        this._onStartCallbackFired = false;

        // add the tween to the object pool on start
        game.world.addChild(this);

        this._startTime =  time + this._delayTime;

        for (let property in this._valuesEnd) {

            // check if an Array was provided as property value
            if (this._valuesEnd[ property ] instanceof Array) {

                if (this._valuesEnd[ property ].length === 0) {

                    continue;

                }

                // create a local copy of the Array with the start value at the front
                this._valuesEnd[ property ] = [ this._object[ property ] ].concat(this._valuesEnd[ property ]);

            }

            this._valuesStart[ property ] = this._object[ property ];

            if ((this._valuesStart[ property ] instanceof Array) === false) {
                this._valuesStart[ property ] *= 1.0; // Ensures we're using numbers, not strings
            }

            this._valuesStartRepeat[ property ] = this._valuesStart[ property ] || 0;

        }

        return this;
    }

    /**
     * stop the tween
     * @name stop
     * @memberof Tween
     * @public
     * @returns {Tween} this instance for object chaining
     */
    stop() {
        // remove the tween from the world container
        game.world.removeChildNow(this);
        return this;
    }

    /**
     * delay the tween
     * @name delay
     * @memberof Tween
     * @public
     * @param {number} amount - delay amount expressed in milliseconds
     * @returns {Tween} this instance for object chaining
     */
    delay(amount) {

        this._delayTime = amount;
        return this;

    }

    /**
     * Repeat the tween
     * @name repeat
     * @memberof Tween
     * @public
     * @param {number} times - amount of times the tween should be repeated
     * @returns {Tween} this instance for object chaining
     */
    repeat(times) {

        this._repeat = times;
        return this;

    }

    /**
     * Allows the tween to bounce back to their original value when finished.
     * To be used together with repeat to create endless loops.
     * @name yoyo
     * @memberof Tween
     * @public
     * @see Tween#repeat
     * @param {boolean} yoyo
     * @returns {Tween} this instance for object chaining
     */
    yoyo(yoyo) {

        this._yoyo = yoyo;
        return this;

    }

    /**
     * set the easing function
     * @name easing
     * @memberof Tween
     * @public
     * @param {Tween.Easing} easing - easing function
     * @returns {Tween} this instance for object chaining
     */
    easing(easing) {
        if (typeof easing !== "function") {
            throw new Error("invalid easing function for me.Tween.easing()");
        }
        this._easingFunction = easing;
        return this;
    }

    /**
     * set the interpolation function
     * @name interpolation
     * @memberof Tween
     * @public
     * @param {Tween.Interpolation} interpolation - interpolation function
     * @returns {Tween} this instance for object chaining
     */
    interpolation(interpolation) {
        this._interpolationFunction = interpolation;
        return this;
    }

    /**
     * chain the tween
     * @name chain
     * @memberof Tween
     * @public
     * @param {...Tween} chainedTween - Tween(s) to be chained
     * @returns {Tween} this instance for object chaining
     */
    chain() {
        this._chainedTweens = arguments;
        return this;
    }

    /**
     * onStart callback
     * @name onStart
     * @memberof Tween
     * @public
     * @param {Function} onStartCallback - callback
     * @returns {Tween} this instance for object chaining
     */
    onStart(onStartCallback) {
        this._onStartCallback = onStartCallback;
        return this;
    }

    /**
     * onUpdate callback
     * @name onUpdate
     * @memberof Tween
     * @public
     * @param {Function} onUpdateCallback - callback
     * @returns {Tween} this instance for object chaining
     */
    onUpdate(onUpdateCallback) {
        this._onUpdateCallback = onUpdateCallback;
        return this;
    }

    /**
     * onComplete callback
     * @name onComplete
     * @memberof Tween
     * @public
     * @param {Function} onCompleteCallback - callback
     * @returns {Tween} this instance for object chaining
     */
    onComplete(onCompleteCallback) {
        this._onCompleteCallback = onCompleteCallback;
        return this;
    }

    /** @ignore */
    update(dt) {

        // the original Tween implementation expect
        // a timestamp and not a time delta
        this._tweenTimeTracker = (game.lastUpdate > this._tweenTimeTracker) ? game.lastUpdate : this._tweenTimeTracker + dt;
        let time = this._tweenTimeTracker;

        let property;

        if (time < this._startTime) {

            return true;

        }

        if (this._onStartCallbackFired === false) {

            if (this._onStartCallback !== null) {

                this._onStartCallback.call(this._object);

            }

            this._onStartCallbackFired = true;

        }

        let elapsed = (time - this._startTime) / this._duration;
        elapsed = elapsed > 1 ? 1 : elapsed;

        let value = this._easingFunction(elapsed);

        for (property in this._valuesEnd) {

            let start = this._valuesStart[ property ] || 0;
            let end = this._valuesEnd[ property ];

            if (end instanceof Array) {

                this._object[ property ] = this._interpolationFunction(end, value);

            } else {

                // Parses relative end values with start as base (e.g.: +10, -3)
                if (typeof(end) === "string") {
                    end = start + parseFloat(end);
                }

                // protect against non numeric properties.
                if (typeof(end) === "number") {
                    this._object[ property ] = start + (end - start) * value;
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
                for (property in this._valuesStartRepeat) {

                    if (typeof(this._valuesEnd[ property ]) === "string") {
                        this._valuesStartRepeat[ property ] = this._valuesStartRepeat[ property ] + parseFloat(this._valuesEnd[ property ]);
                    }

                    if (this._yoyo) {
                        let tmp = this._valuesStartRepeat[ property ];
                        this._valuesStartRepeat[ property ] = this._valuesEnd[ property ];
                        this._valuesEnd[ property ] = tmp;
                    }
                    this._valuesStart[ property ] = this._valuesStartRepeat[ property ];

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

                for (let i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i ++) {

                    this._chainedTweens[ i ].start(time);

                }

                return false;

            }

        }
        return true;
    }

    // export easing function as static class property
    static get Easing() { return Easing; }
    static get Interpolation() { return Interpolation; }
}

export { Tween as default };
