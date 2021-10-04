import timer from "./../system/timer.js";
import * as event from "./../system/event.js";
import { world, lastUpdate } from "./../game.js";
import { Easing } from "./easing.js";
import { Interpolation } from "./interpolation.js";

/**
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
 * @class Tween
 * @memberOf me
 * @constructor
 * @param {Object} object object on which to apply the tween
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
class Tween {

    // constructor
    constructor ( object ) {
        this.object = null;
        this.valuesStart = null;
        this.valuesEnd = null;
        this.valuesStartRepeat = null;
        this.duration = null;
        this.repeat = null;
        this.yoyo = null;
        this.reversed = null;
        this.delayTime = null;
        this.startTime = null;
        this.easingFunction = null;
        this.interpolationFunction = null;
        this.chainedTweens = null;
        this.onStartCallback = null;
        this.onStartCallbackFired = null;
        this.onUpdateCallback = null;
        this.onCompleteCallback = null;
        this.tweenTimeTracker = null;
        // comply with the container contract
        this.isRenderable = false;

        this.setProperties(object);
    }

    /**
     * reset the tween object to default value
     * @ignore
     */
    onResetEvent( object ) {
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
        this._tweenTimeTracker = lastUpdate;

        // reset flags to default value
        this.isPersistent = false;
        // this is not really supported
        this.updateWhenPaused = false;

        // Set all starting values present on the target object
        for ( var field in object ) {
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
        event.subscribe(event.STATE_RESUME, this._resumeCallback);
    }

    /**
     * Unsubscribe when tween is removed
     * @ignore
     */
    onDeactivateEvent() {
        event.unsubscribe(event.STATE_RESUME, this._resumeCallback);
    }

    /**
     * object properties to be updated and duration
     * @name to
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Object} properties hash of properties
     * @param {Object|Number} [options] object of tween properties, or a duration if a numeric value is passed
     * @param {Number} [options.duration] tween duration
     * @param {me.Tween.Easing} [options.easing] easing function
     * @param {Number} [options.delay] delay amount expressed in milliseconds
     * @param {Boolean} [options.yoyo] allows the tween to bounce back to their original value when finished. To be used together with repeat to create endless loops.
     * @param {Number} [options.repeat] amount of times the tween should be repeated
     * @param {me.Tween.Interpolation} [options.interpolation] interpolation function
     * @param {Boolean} [options.autoStart] allow this tween to start automatically. Otherwise call me.Tween.start().
     */
    to( properties, options ) {

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
     * @memberOf me.Tween
     * @public
     * @function
     */
    start( time = timer.getTime() ) {

        this._onStartCallbackFired = false;

        // add the tween to the object pool on start
        world.addChild(this);

        this._startTime =  time + this._delayTime;

        for ( var property in this._valuesEnd ) {

            // check if an Array was provided as property value
            if ( this._valuesEnd[ property ] instanceof Array ) {

                if ( this._valuesEnd[ property ].length === 0 ) {

                    continue;

                }

                // create a local copy of the Array with the start value at the front
                this._valuesEnd[ property ] = [ this._object[ property ] ].concat( this._valuesEnd[ property ] );

            }

            this._valuesStart[ property ] = this._object[ property ];

            if ( ( this._valuesStart[ property ] instanceof Array ) === false ) {
                this._valuesStart[ property ] *= 1.0; // Ensures we're using numbers, not strings
            }

            this._valuesStartRepeat[ property ] = this._valuesStart[ property ] || 0;

        }

        return this;

    }

    /**
     * stop the tween
     * @name stop
     * @memberOf me.Tween
     * @public
     * @function
     */
    stop() {
        // remove the tween from the world container
        world.removeChildNow(this);
        return this;
    }

    /**
     * delay the tween
     * @name delay
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Number} amount delay amount expressed in milliseconds
     */
    delay( amount ) {

        this._delayTime = amount;
        return this;

    }

    /**
     * Repeat the tween
     * @name repeat
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Number} times amount of times the tween should be repeated
     */
    repeat( times ) {

        this._repeat = times;
        return this;

    }

    /**
     * Allows the tween to bounce back to their original value when finished.
     * To be used together with repeat to create endless loops.
     * @name yoyo
     * @memberOf me.Tween
     * @public
     * @function
     * @see me.Tween#repeat
     * @param {Boolean} yoyo
     */
    yoyo( yoyo ) {

        this._yoyo = yoyo;
        return this;

    }

    /**
     * set the easing function
     * @name easing
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween.Easing} fn easing function
     */
    easing( easing ) {
        if (typeof easing !== "function") {
            throw new Error("invalid easing function for me.Tween.easing()");
        }
        this._easingFunction = easing;
        return this;

    }

    /**
     * set the interpolation function
     * @name interpolation
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween.Interpolation} fn interpolation function
     */
    interpolation( interpolation ) {
        this._interpolationFunction = interpolation;
        return this;
    }

    /**
     * chain the tween
     * @name chain
     * @memberOf me.Tween
     * @public
     * @function
     * @param {me.Tween} chainedTween Tween to be chained
     */
    chain() {
        this._chainedTweens = arguments;
        return this;
    }

    /**
     * onStart callback
     * @name onStart
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onStartCallback callback
     */
    onStart( callback ) {
        this._onStartCallback = callback;
        return this;
    }

    /**
     * onUpdate callback
     * @name onUpdate
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onUpdateCallback callback
     */
    onUpdate( callback ) {
        this._onUpdateCallback = callback;
        return this;
    }

    /**
     * onComplete callback
     * @name onComplete
     * @memberOf me.Tween
     * @public
     * @function
     * @param {Function} onCompleteCallback callback
     */
    onComplete( callback ) {
        this._onCompleteCallback = callback;
        return this;
    };

    /** @ignore */
    update( dt ) {

        // the original Tween implementation expect
        // a timestamp and not a time delta
        this._tweenTimeTracker = (lastUpdate > this._tweenTimeTracker) ? lastUpdate : this._tweenTimeTracker + dt;
        var time = this._tweenTimeTracker;

        var property;

        if ( time < this._startTime ) {

            return true;

        }

        if ( this._onStartCallbackFired === false ) {

            if ( this._onStartCallback !== null ) {

                this._onStartCallback.call( this._object );

            }

            this._onStartCallbackFired = true;

        }

        var elapsed = ( time - this._startTime ) / this._duration;
        elapsed = elapsed > 1 ? 1 : elapsed;

        var value = this._easingFunction( elapsed );

        for ( property in this._valuesEnd ) {

            var start = this._valuesStart[ property ] || 0;
            var end = this._valuesEnd[ property ];

            if ( end instanceof Array ) {

                this._object[ property ] = this._interpolationFunction( end, value );

            } else {

                // Parses relative end values with start as base (e.g.: +10, -3)
                if ( typeof(end) === "string" ) {
                    end = start + parseFloat(end);
                }

                // protect against non numeric properties.
                if ( typeof(end) === "number" ) {
                    this._object[ property ] = start + ( end - start ) * value;
                }

            }

        }

        if ( this._onUpdateCallback !== null ) {

            this._onUpdateCallback.call( this._object, value );

        }

        if ( elapsed === 1 ) {

            if ( this._repeat > 0 ) {

                if ( isFinite( this._repeat ) ) {
                    this._repeat--;
                }

                // reassign starting values, restart by making startTime = now
                for ( property in this._valuesStartRepeat ) {

                    if ( typeof( this._valuesEnd[ property ] ) === "string" ) {
                        this._valuesStartRepeat[ property ] = this._valuesStartRepeat[ property ] + parseFloat(this._valuesEnd[ property ]);
                    }

                    if (this._yoyo) {
                        var tmp = this._valuesStartRepeat[ property ];
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
                world.removeChildNow(this);

                if ( this._onCompleteCallback !== null ) {

                    this._onCompleteCallback.call( this._object );

                }

                for ( var i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i ++ ) {

                    this._chainedTweens[ i ].start( time );

                }

                return false;

            }

        }
        return true;
    }

    // export easing function as static class property
    static get Easing() { return Easing; }
    static get Interpolation() { return Interpolation; }
};

export default Tween;
