import timer from "./../system/timer.js";
import event from "./../system/event.js";
import game from "./../game.js";
import { Easing } from "./easing.js";
import { Interpolation } from "./interpolation.js";

/**
* Tween.js - Licensed under the MIT license
* https://github.com/tweenjs/tween.js
*/

/* eslint-disable quotes, keyword-spacing, comma-spacing, no-return-assign */

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
 * @class
 * @memberOf me
 * @constructor
 * @param {Object} object object on which to apply the tween
 * @example
 * // add a tween to change the object pos.y variable to 200 in 3 seconds
 * tween = new me.Tween(myObject.pos).to({y: 200}, 3000).onComplete(myFunc);
 * tween.easing(me.Tween.Easing.Bounce.Out);
 * tween.start();
 */
class Tween {

    // constructor
    constructor ( object ) {

        var _object = null;
        var _valuesStart = null;
        var _valuesEnd = null;
        var _valuesStartRepeat = null;
        var _duration = null;
        var _repeat = null;
        var _yoyo = null;
        var _reversed = null;
        var _delayTime = null;
        var _startTime = null;
        var _easingFunction = null;
        var _interpolationFunction = null;
        var _chainedTweens = null;
        var _onStartCallback = null;
        var _onStartCallbackFired = null;
        var _onUpdateCallback = null;
        var _onCompleteCallback = null;
        var _tweenTimeTracker = null;

        // comply with the container contract
        this.isRenderable = false;

        /**
         * @ignore
         */
        this._resumeCallback = function (elapsed) {
            if (_startTime) {
                _startTime += elapsed;
            }
        };

        /**
         * @ignore
         */
        this.setProperties = function (object) {
            _object = object;
            _valuesStart = {};
            _valuesEnd = {};
            _valuesStartRepeat = {};
            _duration = 1000;
            _repeat = 0;
            _yoyo = false;
            _reversed = false;
            _delayTime = 0;
            _startTime = null;
            _easingFunction = Easing.Linear.None;
            _interpolationFunction = Interpolation.Linear;
            _chainedTweens = [];
            _onStartCallback = null;
            _onStartCallbackFired = false;
            _onUpdateCallback = null;
            _onCompleteCallback = null;
            _tweenTimeTracker = timer.lastUpdate;

            // reset flags to default value
            this.isPersistent = false;
            // this is not really supported
            this.updateWhenPaused = false;

            // Set all starting values present on the target object
            for ( var field in object ) {
                if(typeof object !== 'object') {
                    _valuesStart[ field ] = parseFloat(object[field]);
                }
            }
        };

        this.setProperties(object);

        /**
         * reset the tween object to default value
         * @ignore
         */
        this.onResetEvent = function ( object ) {
            this.setProperties(object);
        };

        /**
         * subscribe to the resume event when added
         * @ignore
         */
        this.onActivateEvent = function () {
            event.subscribe(event.STATE_RESUME, this._resumeCallback);
        };

        /**
         * Unsubscribe when tween is removed
         * @ignore
         */
        this.onDeactivateEvent = function () {
            event.unsubscribe(event.STATE_RESUME, this._resumeCallback);
        };

        /**
         * object properties to be updated and duration
         * @name me.Tween#to
         * @public
         * @function
         * @param {Object} properties hash of properties
         * @param {Number} [duration=1000] tween duration
         */
        this.to = function ( properties, duration ) {

            if ( duration !== undefined ) {

                _duration = duration;

            }

            _valuesEnd = properties;

            return this;

        };

        /**
         * start the tween
         * @name me.Tween#start
         * @public
         * @function
         */
        this.start = function ( _time ) {

            _onStartCallbackFired = false;

            // add the tween to the object pool on start
            game.world.addChild(this);

            _startTime = (typeof(_time) === 'undefined' ? timer.getTime() : _time) + _delayTime;

            for ( var property in _valuesEnd ) {

                // check if an Array was provided as property value
                if ( _valuesEnd[ property ] instanceof Array ) {

                    if ( _valuesEnd[ property ].length === 0 ) {

                        continue;

                    }

                    // create a local copy of the Array with the start value at the front
                    _valuesEnd[ property ] = [ _object[ property ] ].concat( _valuesEnd[ property ] );

                }

                _valuesStart[ property ] = _object[ property ];

                if( ( _valuesStart[ property ] instanceof Array ) === false ) {
                    _valuesStart[ property ] *= 1.0; // Ensures we're using numbers, not strings
                }

                _valuesStartRepeat[ property ] = _valuesStart[ property ] || 0;

            }

            return this;

        };

        /**
         * stop the tween
         * @name me.Tween#stop
         * @public
         * @function
         */
        this.stop = function () {
            // remove the tween from the world container
            game.world.removeChildNow(this);
            return this;
        };

        /**
         * delay the tween
         * @name me.Tween#delay
         * @public
         * @function
         * @param {Number} amount delay amount expressed in milliseconds
         */
        this.delay = function ( amount ) {

            _delayTime = amount;
            return this;

        };

        /**
         * Repeat the tween
         * @name me.Tween#repeat
         * @public
         * @function
         * @param {Number} times amount of times the tween should be repeated
         */
        this.repeat = function ( times ) {

            _repeat = times;
            return this;

        };

        /**
         * Allows the tween to bounce back to their original value when finished.
         * To be used together with repeat to create endless loops.
         * @name me.Tween#yoyo
         * @public
         * @function
         * @see me.Tween#repeat
         * @param {Boolean} yoyo
         */
        this.yoyo = function( yoyo ) {

            _yoyo = yoyo;
            return this;

        };

        /**
         * set the easing function
         * @name me.Tween#easing
         * @public
         * @function
         * @param {me.Tween.Easing} fn easing function
         */
        this.easing = function ( easing ) {
            if (typeof easing !== 'function') {
                throw new Error("invalid easing function for me.Tween.easing()");
            }
            _easingFunction = easing;
            return this;

        };

        /**
         * set the interpolation function
         * @name me.Tween#interpolation
         * @public
         * @function
         * @param {me.Tween.Interpolation} fn interpolation function
         */
        this.interpolation = function ( interpolation ) {

            _interpolationFunction = interpolation;
            return this;

        };

        /**
         * chain the tween
         * @name me.Tween#chain
         * @public
         * @function
         * @param {me.Tween} chainedTween Tween to be chained
         */
        this.chain = function () {

            _chainedTweens = arguments;
            return this;

        };

        /**
         * onStart callback
         * @name me.Tween#onStart
         * @public
         * @function
         * @param {Function} onStartCallback callback
         */
        this.onStart = function ( callback ) {

            _onStartCallback = callback;
            return this;

        };

        /**
         * onUpdate callback
         * @name me.Tween#onUpdate
         * @public
         * @function
         * @param {Function} onUpdateCallback callback
         */
        this.onUpdate = function ( callback ) {

            _onUpdateCallback = callback;
            return this;

        };

        /**
         * onComplete callback
         * @name me.Tween#onComplete
         * @public
         * @function
         * @param {Function} onCompleteCallback callback
         */
        this.onComplete = function ( callback ) {

            _onCompleteCallback = callback;
            return this;

        };

        /** @ignore */
        this.update = function ( dt ) {

            // the original Tween implementation expect
            // a timestamp and not a time delta
            _tweenTimeTracker = (timer.lastUpdate > _tweenTimeTracker) ? timer.lastUpdate : _tweenTimeTracker + dt;
            var time = _tweenTimeTracker;

            var property;

            if ( time < _startTime ) {

                return true;

            }

            if ( _onStartCallbackFired === false ) {

                if ( _onStartCallback !== null ) {

                    _onStartCallback.call( _object );

                }

                _onStartCallbackFired = true;

            }

            var elapsed = ( time - _startTime ) / _duration;
            elapsed = elapsed > 1 ? 1 : elapsed;

            var value = _easingFunction( elapsed );

            for ( property in _valuesEnd ) {

                var start = _valuesStart[ property ] || 0;
                var end = _valuesEnd[ property ];

                if ( end instanceof Array ) {

                    _object[ property ] = _interpolationFunction( end, value );

                } else {

                    // Parses relative end values with start as base (e.g.: +10, -3)
                    if ( typeof(end) === "string" ) {
                        end = start + parseFloat(end);
                    }

                    // protect against non numeric properties.
                    if ( typeof(end) === "number" ) {
                        _object[ property ] = start + ( end - start ) * value;
                    }

                }

            }

            if ( _onUpdateCallback !== null ) {

                _onUpdateCallback.call( _object, value );

            }

            if ( elapsed === 1 ) {

                if ( _repeat > 0 ) {

                    if( isFinite( _repeat ) ) {
                        _repeat--;
                    }

                    // reassign starting values, restart by making startTime = now
                    for( property in _valuesStartRepeat ) {

                        if ( typeof( _valuesEnd[ property ] ) === "string" ) {
                            _valuesStartRepeat[ property ] = _valuesStartRepeat[ property ] + parseFloat(_valuesEnd[ property ]);
                        }

                        if (_yoyo) {
                            var tmp = _valuesStartRepeat[ property ];
                            _valuesStartRepeat[ property ] = _valuesEnd[ property ];
                            _valuesEnd[ property ] = tmp;
                        }
                        _valuesStart[ property ] = _valuesStartRepeat[ property ];

                    }

                    if (_yoyo) {
                        _reversed = !_reversed;
                    }

                    _startTime = time + _delayTime;

                    return true;

                } else {
                    // remove the tween from the world container
                    game.world.removeChildNow(this);

                    if ( _onCompleteCallback !== null ) {

                        _onCompleteCallback.call( _object );

                    }

                    for ( var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i ++ ) {

                        _chainedTweens[ i ].start( time );

                    }

                    return false;

                }

            }

            return true;

        };
    }

    // export easing function as static class property
    static get Easing() { return Easing; }
    static get Interpolation() { return Interpolation; }
};
/* eslint-enable quotes, keyword-spacing, comma-spacing, no-return-assign */
export default Tween;
