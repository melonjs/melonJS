/**
 * @preserve Tween JS
 * https://github.com/sole/Tween.js
 */

/* eslint-disable quotes, keyword-spacing, comma-spacing, no-return-assign */

(function() {

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
    me.Tween = function ( object ) {

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
            _easingFunction = me.Tween.Easing.Linear.None;
            _interpolationFunction = me.Tween.Interpolation.Linear;
            _chainedTweens = [];
            _onStartCallback = null;
            _onStartCallbackFired = false;
            _onUpdateCallback = null;
            _onCompleteCallback = null;
            _tweenTimeTracker = me.timer.lastUpdate;

            // reset the persistent flag to default value
            this.isPersistent = false;

            // Set all starting values present on the target object
            for ( var field in object ) {
                if(typeof object !== 'object') {
                    _valuesStart[ field ] = parseFloat(object[field], 10);
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
            me.event.subscribe(me.event.STATE_RESUME, this._resumeCallback);
        };

        /**
         * Unsubscribe when tween is removed
         * @ignore
         */
        this.onDeactivateEvent = function () {
            me.event.unsubscribe(me.event.STATE_RESUME, this._resumeCallback);
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
            me.game.world.addChild(this);

            _startTime = (typeof(_time) === 'undefined' ? me.timer.getTime() : _time) + _delayTime;

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
            me.game.world.removeChildNow(this);
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
         * allows the tween to bounce back to their original value when finished
         * @name me.Tween#yoyo
         * @public
         * @function
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
                throw new me.Tween.Error("invalid easing function for me.Tween.easing()");
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
            _tweenTimeTracker = (me.timer.lastUpdate > _tweenTimeTracker) ? me.timer.lastUpdate : _tweenTimeTracker + dt;
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
                        end = start + parseFloat(end, 10);
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
                            _valuesStartRepeat[ property ] = _valuesStartRepeat[ property ] + parseFloat(_valuesEnd[ property ], 10);
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
                    me.game.world.removeChildNow(this);

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

    };

    /**
     * Easing Function :<br>
     * <p>
     * me.Tween.Easing.Linear.None<br>
     * me.Tween.Easing.Quadratic.In<br>
     * me.Tween.Easing.Quadratic.Out<br>
     * me.Tween.Easing.Quadratic.InOut<br>
     * me.Tween.Easing.Cubic.In<br>
     * me.Tween.Easing.Cubic.Out<br>
     * me.Tween.Easing.Cubic.InOut<br>
     * me.Tween.Easing.Quartic.In<br>
     * me.Tween.Easing.Quartic.Out<br>
     * me.Tween.Easing.Quartic.InOut<br>
     * me.Tween.Easing.Quintic.In<br>
     * me.Tween.Easing.Quintic.Out<br>
     * me.Tween.Easing.Quintic.InOut<br>
     * me.Tween.Easing.Sinusoidal.In<br>
     * me.Tween.Easing.Sinusoidal.Out<br>
     * me.Tween.Easing.Sinusoidal.InOut<br>
     * me.Tween.Easing.Exponential.In<br>
     * me.Tween.Easing.Exponential.Out<br>
     * me.Tween.Easing.Exponential.InOut<br>
     * me.Tween.Easing.Circular.In<br>
     * me.Tween.Easing.Circular.Out<br>
     * me.Tween.Easing.Circular.InOut<br>
     * me.Tween.Easing.Elastic.In<br>
     * me.Tween.Easing.Elastic.Out<br>
     * me.Tween.Easing.Elastic.InOut<br>
     * me.Tween.Easing.Back.In<br>
     * me.Tween.Easing.Back.Out<br>
     * me.Tween.Easing.Back.InOut<br>
     * me.Tween.Easing.Bounce.In<br>
     * me.Tween.Easing.Bounce.Out<br>
     * me.Tween.Easing.Bounce.InOut
     * </p>
     * @public
     * @constant
     * @type enum
     * @name Easing
     * @memberOf me.Tween
     */
    me.Tween.Easing = {

        Linear: {
            /** @ignore */
            None: function ( k ) {

                return k;

            }

        },

        Quadratic: {
            /** @ignore */
            In: function ( k ) {

                return k * k;

            },
            /** @ignore */
            Out: function ( k ) {

                return k * ( 2 - k );

            },
            /** @ignore */
            InOut: function ( k ) {

                if ( ( k *= 2 ) < 1 ) return 0.5 * k * k;
                return - 0.5 * ( --k * ( k - 2 ) - 1 );

            }

        },

        Cubic: {
            /** @ignore */
            In: function ( k ) {

                return k * k * k;

            },
            /** @ignore */
            Out: function ( k ) {

                return --k * k * k + 1;

            },
            /** @ignore */
            InOut: function ( k ) {

                if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
                return 0.5 * ( ( k -= 2 ) * k * k + 2 );

            }

        },

        Quartic: {
            /** @ignore */
            In: function ( k ) {

                return k * k * k * k;

            },
            /** @ignore */
            Out: function ( k ) {

                return 1 - ( --k * k * k * k );

            },
            /** @ignore */
            InOut: function ( k ) {

                if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
                return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );

            }

        },

        Quintic: {
            /** @ignore */
            In: function ( k ) {

                return k * k * k * k * k;

            },
            /** @ignore */
            Out: function ( k ) {

                return --k * k * k * k * k + 1;

            },
            /** @ignore */
            InOut: function ( k ) {

                if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
                return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );

            }

        },

        Sinusoidal: {
            /** @ignore */
            In: function ( k ) {

                return 1 - Math.cos( k * Math.PI / 2 );

            },
            /** @ignore */
            Out: function ( k ) {

                return Math.sin( k * Math.PI / 2 );

            },
            /** @ignore */
            InOut: function ( k ) {

                return 0.5 * ( 1 - Math.cos( Math.PI * k ) );

            }

        },

        Exponential: {
            /** @ignore */
            In: function ( k ) {

                return k === 0 ? 0 : Math.pow( 1024, k - 1 );

            },
            /** @ignore */
            Out: function ( k ) {

                return k === 1 ? 1 : 1 - Math.pow( 2, - 10 * k );

            },
            /** @ignore */
            InOut: function ( k ) {

                if ( k === 0 ) return 0;
                if ( k === 1 ) return 1;
                if ( ( k *= 2 ) < 1 ) return 0.5 * Math.pow( 1024, k - 1 );
                return 0.5 * ( - Math.pow( 2, - 10 * ( k - 1 ) ) + 2 );

            }

        },

        Circular: {
            /** @ignore */
            In: function ( k ) {

                return 1 - Math.sqrt( 1 - k * k );

            },
            /** @ignore */
            Out: function ( k ) {

                return Math.sqrt( 1 - ( --k * k ) );

            },
            /** @ignore */
            InOut: function ( k ) {

                if ( ( k *= 2 ) < 1) return - 0.5 * ( Math.sqrt( 1 - k * k) - 1);
                return 0.5 * ( Math.sqrt( 1 - ( k -= 2) * k) + 1);

            }

        },

        Elastic: {
            /** @ignore */
            In: function ( k ) {

                var s, a = 0.1, p = 0.4;
                if ( k === 0 ) return 0;
                if ( k === 1 ) return 1;
                if ( !a || a < 1 ) { a = 1; s = p / 4; }
                else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
                return - ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );

            },
            /** @ignore */
            Out: function ( k ) {

                var s, a = 0.1, p = 0.4;
                if ( k === 0 ) return 0;
                if ( k === 1 ) return 1;
                if ( !a || a < 1 ) { a = 1; s = p / 4; }
                else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
                return ( a * Math.pow( 2, - 10 * k) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) + 1 );

            },
            /** @ignore */
            InOut: function ( k ) {

                var s, a = 0.1, p = 0.4;
                if ( k === 0 ) return 0;
                if ( k === 1 ) return 1;
                if ( !a || a < 1 ) { a = 1; s = p / 4; }
                else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
                if ( ( k *= 2 ) < 1 ) return - 0.5 * ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );
                return a * Math.pow( 2, -10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) * 0.5 + 1;

            }

        },

        Back: {
            /** @ignore */
            In: function ( k ) {

                var s = 1.70158;
                return k * k * ( ( s + 1 ) * k - s );

            },
            /** @ignore */
            Out: function ( k ) {

                var s = 1.70158;
                return --k * k * ( ( s + 1 ) * k + s ) + 1;

            },
            /** @ignore */
            InOut: function ( k ) {

                var s = 1.70158 * 1.525;
                if ( ( k *= 2 ) < 1 ) return 0.5 * ( k * k * ( ( s + 1 ) * k - s ) );
                return 0.5 * ( ( k -= 2 ) * k * ( ( s + 1 ) * k + s ) + 2 );

            }

        },

        Bounce: {
            /** @ignore */
            In: function ( k ) {

                return 1 - me.Tween.Easing.Bounce.Out( 1 - k );

            },
            /** @ignore */
            Out: function ( k ) {

                if ( k < ( 1 / 2.75 ) ) {

                    return 7.5625 * k * k;

                } else if ( k < ( 2 / 2.75 ) ) {

                    return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;

                } else if ( k < ( 2.5 / 2.75 ) ) {

                    return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;

                } else {

                    return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;

                }

            },
            /** @ignore */
            InOut: function ( k ) {

                if ( k < 0.5 ) return me.Tween.Easing.Bounce.In( k * 2 ) * 0.5;
                return me.Tween.Easing.Bounce.Out( k * 2 - 1 ) * 0.5 + 0.5;

            }

        }

    };

    /**
     * Interpolation Function :<br>
     * <p>
     * me.Tween.Interpolation.Linear<br>
     * me.Tween.Interpolation.Bezier<br>
     * me.Tween.Interpolation.CatmullRom
     * </p>
     * @public
     * @constant
     * @type enum
     * @name Interpolation
     * @memberOf me.Tween
     */
    me.Tween.Interpolation = {
        /** @ignore */
        Linear: function ( v, k ) {

            var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = me.Tween.Interpolation.Utils.Linear;

            if ( k < 0 ) return fn( v[ 0 ], v[ 1 ], f );
            if ( k > 1 ) return fn( v[ m ], v[ m - 1 ], m - f );

            return fn( v[ i ], v[ i + 1 > m ? m : i + 1 ], f - i );

        },
        /** @ignore */
        Bezier: function ( v, k ) {

            var b = 0, n = v.length - 1, pw = Math.pow, bn = me.Tween.Interpolation.Utils.Bernstein, i;

            for ( i = 0; i <= n; i++ ) {
                b += pw( 1 - k, n - i ) * pw( k, i ) * v[ i ] * bn( n, i );
            }

            return b;

        },
        /** @ignore */
        CatmullRom: function ( v, k ) {

            var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = me.Tween.Interpolation.Utils.CatmullRom;

            if ( v[ 0 ] === v[ m ] ) {

                if ( k < 0 ) i = Math.floor( f = m * ( 1 + k ) );

                return fn( v[ ( i - 1 + m ) % m ], v[ i ], v[ ( i + 1 ) % m ], v[ ( i + 2 ) % m ], f - i );

            } else {

                if ( k < 0 ) return v[ 0 ] - ( fn( v[ 0 ], v[ 0 ], v[ 1 ], v[ 1 ], -f ) - v[ 0 ] );
                if ( k > 1 ) return v[ m ] - ( fn( v[ m ], v[ m ], v[ m - 1 ], v[ m - 1 ], f - m ) - v[ m ] );

                return fn( v[ i ? i - 1 : 0 ], v[ i ], v[ m < i + 1 ? m : i + 1 ], v[ m < i + 2 ? m : i + 2 ], f - i );

            }

        },

        Utils: {
            /** @ignore */
            Linear: function ( p0, p1, t ) {

                return ( p1 - p0 ) * t + p0;

            },
            /** @ignore */
            Bernstein: function ( n , i ) {

                var fc = me.Tween.Interpolation.Utils.Factorial;
                return fc( n ) / fc( i ) / fc( n - i );

            },
            /** @ignore */
            Factorial: ( function () {

                var a = [ 1 ];

                return function ( n ) {

                    var s = 1, i;
                    if ( a[ n ] ) return a[ n ];
                    for ( i = n; i > 1; i-- ) s *= i;
                    return a[ n ] = s;

                };

            } )(),
            /** @ignore */
            CatmullRom: function ( p0, p1, p2, p3, t ) {

                var v0 = ( p2 - p0 ) * 0.5, v1 = ( p3 - p1 ) * 0.5, t2 = t * t, t3 = t * t2;
                return ( 2 * p1 - 2 * p2 + v0 + v1 ) * t3 + ( - 3 * p1 + 3 * p2 - 2 * v0 - v1 ) * t2 + v0 * t + p1;

            }

        }

    };

    /**
     * Base class for Tween exception handling.
     * @name Error
     * @class
     * @memberOf me.Tween
     * @constructor
     * @param {String} msg Error message.
     */
    me.Tween.Error = me.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.Tween.Error";
        }
    });
})();
/* eslint-enable quotes, keyword-spacing, comma-spacing, no-return-assign */
