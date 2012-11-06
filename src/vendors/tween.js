/**
 * @preserve Tween JS
 * https://github.com/sole/Tween.js
 */
/**
 * author sole / http://soledadpenades.com
 * author mr.doob / http://mrdoob.com
 * author Robert Eisele / http://www.xarg.org
 * author Philippe / http://philippe.elsass.me
 * author Robert Penner / http://www.robertpenner.com/easing_terms_of_use.html
 * author Paul Lewis / http://www.aerotwist.com/
 * author lechecacharro
 * author Josh Faul / http://jocafa.com/
 */

(function() {
	/**
	 * Javascript Tweening Engine<p>
	 * Super simple, fast and easy to use tweening engine which incorporates optimised Robert Penner's equation<p>
	 * <a href="https://github.com/sole/Tween.js">https://github.com/sole/Tween.js</a><p>
	 * @author <a href="http://soledadpenades.com">sole</a>
	 * @author <a href="http://mrdoob.com">mr.doob</a>
	 * @author <a href="http://www.xarg.org">Robert Eisele</a>
	 * @author <a href="http://philippe.elsass.me">Philippe</a>
	 * @author <a href="http://www.robertpenner.com/easing_terms_of_use.html">Robert Penner</a>
	 * @class
	 * @memberOf me
	 * @constructor
	 * @param {Object} object object on which to apply the tween
	 * @example
	 * // add a tween to change the object pos.y variable to 200 in 3 seconds
	 * tween = new me.Tween(myObject.pos).to({y: 200}, 3000).onComplete(myFunc);
	 * tween.easing(me.Tween.Easing.Bounce.EaseOut);
	 * tween.start();
	 */
	me.Tween = function(object) {

		var _object = object,
			_valuesStart = {},
			_valuesDelta = {},
			_valuesEnd = {},
			_duration = 1000,
			_delayTime = 0,
			_startTime = null,
			_pauseTime = 0,
			_easingFunction = me.Tween.Easing.Linear.EaseNone,
			_chainedTween = null,
			_onUpdateCallback = null,
			_onCompleteCallback = null;

		/**
		 * object properties to be updated and duration
		 * @name me.Tween#to
		 * @public
		 * @function
		 * @param {Properties} prop list of properties
		 * @param {int} duration tween duration
		 */
		this.to = function(properties, duration) {

			if (duration !== undefined) {

				_duration = duration;

			}

			for ( var property in properties) {

				// This prevents the engine from interpolating null values
				if (_object[property] === null) {

					continue;

				}

				// The current values are read when the Tween starts;
				// here we only store the final desired values
				_valuesEnd[property] = properties[property];

			}

			return this;

		};

		/**
		 * start the tween
		 * @name me.Tween#start
		 * @public
		 * @function
		 */
		this.start = function() {

			// add the tween to the object pool on start
			me.game.add(this, 999);

			_startTime = me.timer.getTime() + _delayTime;
			_pauseTime = 0;

			for ( var property in _valuesEnd) {

				// Again, prevent dealing with null values
				if (_object[property] === null) {

					continue;

				}

				_valuesStart[property] = _object[property];
				_valuesDelta[property] = _valuesEnd[property]
						- _object[property];

			}

			return this;
		};

		/**
		 * stop the tween
		 * @name me.Tween#stop
		 * @public
		 * @function
		 */
		this.stop = function() {

			me.game.remove(this);
			return this;

		};

		/**
		 * delay the tween
		 * @name me.Tween#delay
		 * @public
		 * @function
		 * @param {int} amount delay amount
		 */
		this.delay = function(amount) {

			_delayTime = amount;
			return this;

		};

		/**
		 * Calculate delta to pause the tween
		 * @private
		 */
		me.event.subscribe(me.event.STATE_PAUSE, function onPause() {
			if (_startTime) {
				_pauseTime = me.timer.getTime();
			}
		});

		/**
		 * Calculate delta to resume the tween
		 * @private
		 */
		me.event.subscribe(me.event.STATE_RESUME, function onResume() {
			if (_startTime && _pauseTime) {
				_startTime += me.timer.getTime() - _pauseTime;
			}
		});

		/**
		 * set the easing function
		 * @name me.Tween#easing
		 * @public
		 * @function
		 * @param {Function} easing easing function
		 */
		this.easing = function(easing) {

			_easingFunction = easing;
			return this;

		};

		/**
		 * chain the tween
		 * @name me.Tween#chain
		 * @public
		 * @function
		 * @param {me.Tween} chainedTween Tween to be chained
		 */
		this.chain = function(chainedTween) {

			_chainedTween = chainedTween;
			return this;

		};

		/**
		 * onUpdate callback
		 * @name me.Tween#onUpdate
		 * @public
		 * @function
		 * @param {function} onUpdateCallback callback
		 */
		this.onUpdate = function(onUpdateCallback) {

			_onUpdateCallback = onUpdateCallback;
			return this;

		};

		/**
		 * onComplete callback
		 * @name me.Tween#onComplete
		 * @public
		 * @function
		 * @param {function} onCompleteCallback callback
		 */
		this.onComplete = function(onCompleteCallback) {

			_onCompleteCallback = onCompleteCallback;
			return this;

		};

		/** @private*/
		this.update = function(/* time */) {

			var property, elapsed, value;

			var time = me.timer.getTime();

			if (time < _startTime) {

				return true;

			}

			if ( ( elapsed = ( time - _startTime ) / _duration ) >= 1) {
			
					elapsed = 1;
			}

			value = _easingFunction(elapsed);

			for (property in _valuesDelta) {

				_object[property] = _valuesStart[property]
						+ _valuesDelta[property] * value;

			}

			if (_onUpdateCallback !== null) {

				_onUpdateCallback.call(_object, value);

			}

			if (elapsed === 1) {

				// remove the tween from the object pool
				me.game.remove(this);

				if (_onCompleteCallback !== null) {

					_onCompleteCallback.call(_object);

				}

				if (_chainedTween !== null) {

					_chainedTween.start();

				}

				return false;

			}

			return true;

		};

		/** @private*/
		this.destroy = function() {

			// indicate we can safely be destroyed
			return true;

		};

	}

	/**
	 * Easing Function :<p>
	 * Easing.Linear.EaseNone<p>
	 * Easing.Quadratic.EaseIn<p>
	 * Easing.Quadratic.EaseOut<p>
	 * Easing.Quadratic.EaseInOut<p>
	 * Easing.Cubic.EaseIn<p>
	 * Easing.Cubic.EaseOut<p>
	 * Easing.Cubic.EaseInOut<p>
	 * Easing.Quartic.EaseIn<p>
	 * Easing.Quartic.EaseOut<p>
	 * Easing.Quartic.EaseInOut<p>
	 * Easing.Quintic.EaseIn<p>
	 * Easing.Quintic.EaseOut<p>
	 * Easing.Quintic.EaseInOut<p>
	 * Easing.Sinusoidal.EaseIn<p>
	 * Easing.Sinusoidal.EaseOut<p>
	 * Easing.Sinusoidal.EaseInOut<p>
	 * Easing.Exponential.EaseIn<p>
	 * Easing.Exponential.EaseOut<p>
	 * Easing.Exponential.EaseInOut<p>
	 * Easing.Circular.EaseIn<p>
	 * Easing.Circular.EaseOut<p>
	 * Easing.Circular.EaseInOut<p>
	 * Easing.Elastic.EaseIn<p>
	 * Easing.Elastic.EaseOut<p>
	 * Easing.Elastic.EaseInOut<p>
	 * Easing.Back.EaseIn<p>
	 * Easing.Back.EaseOut<p>
	 * Easing.Back.EaseInOut<p>
	 * Easing.Bounce.EaseIn<p>
	 * Easing.Bounce.EaseOut<p>
	 * Easing.Bounce.EaseInOut
	 * @public
	 * @type enum
	 * @name me.Tween#Easing
	 */
	me.Tween.Easing = {
		Linear : {},
		Quadratic : {},
		Cubic : {},
		Quartic : {},
		Quintic : {},
		Sinusoidal : {},
		Exponential : {},
		Circular : {},
		Elastic : {},
		Back : {},
		Bounce : {}
	};

	/** @ignore */
	me.Tween.Easing.Linear.EaseNone = function(k) {

		return k;

	};

	/** @ignore */
	me.Tween.Easing.Quadratic.EaseIn = function(k) {

		return k * k;

	};
	/** @ignore */
	me.Tween.Easing.Quadratic.EaseOut = function(k) {

		return k * ( 2 - k );

	};
	/** @ignore */
	me.Tween.Easing.Quadratic.EaseInOut = function(k) {

		if ((k *= 2) < 1)
			return 0.5 * k * k;
		return -0.5 * (--k * (k - 2) - 1);

	};
	/** @ignore */
	me.Tween.Easing.Cubic.EaseIn = function(k) {

		return k * k * k;

	};
	/** @ignore */
	me.Tween.Easing.Cubic.EaseOut = function(k) {

		return --k * k * k + 1;

	};
	/** @ignore */
	me.Tween.Easing.Cubic.EaseInOut = function(k) {

		if ((k *= 2) < 1)
			return 0.5 * k * k * k;
		return 0.5 * ((k -= 2) * k * k + 2);

	};
	/** @ignore */
	me.Tween.Easing.Quartic.EaseIn = function(k) {

		return k * k * k * k;

	};
	/** @ignore */
	me.Tween.Easing.Quartic.EaseOut = function(k) {

		return 1 - (--k * k * k * k);

	}
	/** @ignore */
	me.Tween.Easing.Quartic.EaseInOut = function(k) {

		if ((k *= 2) < 1)
			return 0.5 * k * k * k * k;
		return -0.5 * ((k -= 2) * k * k * k - 2);

	};
	/** @ignore */
	me.Tween.Easing.Quintic.EaseIn = function(k) {

		return k * k * k * k * k;

	};
	/** @ignore */
	me.Tween.Easing.Quintic.EaseOut = function(k) {

		return --k * k * k * k * k + 1;

	};
	/** @ignore */
	me.Tween.Easing.Quintic.EaseInOut = function(k) {

		if ((k *= 2) < 1)
			return 0.5 * k * k * k * k * k;
		return 0.5 * ((k -= 2) * k * k * k * k + 2);

	};
	/** @ignore */
	me.Tween.Easing.Sinusoidal.EaseIn = function(k) {

		return 1 - Math.cos( k * Math.PI / 2 );

	};
	/** @ignore */
	me.Tween.Easing.Sinusoidal.EaseOut = function(k) {

		return Math.sin(k * Math.PI / 2);

	};
	/** @ignore */
	me.Tween.Easing.Sinusoidal.EaseInOut = function(k) {

		return 0.5 * ( 1 - Math.cos( Math.PI * k ) );

	};
	/** @ignore */
	me.Tween.Easing.Exponential.EaseIn = function(k) {

		return k === 0 ? 0 : Math.pow( 1024, k - 1 );

	};
	/** @ignore */
	me.Tween.Easing.Exponential.EaseOut = function(k) {

		return k === 1 ? 1 : 1 - Math.pow( 2, - 10 * k );

	};
	/** @ignore */
	me.Tween.Easing.Exponential.EaseInOut = function(k) {

		if ( k === 0 ) return 0;
		if ( k === 1 ) return 1;
		if ( ( k *= 2 ) < 1 ) return 0.5 * Math.pow( 1024, k - 1 );
		return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);

	};
	/** @ignore */
	me.Tween.Easing.Circular.EaseIn = function(k) {

		return 1 - Math.sqrt( 1 - k * k );

	};
	/** @ignore */
	me.Tween.Easing.Circular.EaseOut = function(k) {

		return Math.sqrt(1 - (--k * k));

	};
	/** @ignore */
	me.Tween.Easing.Circular.EaseInOut = function(k) {

		if ( ( k *= 2 ) < 1) return - 0.5 * ( Math.sqrt( 1 - k * k) - 1);
		return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);

	};
	/** @ignore */
	me.Tween.Easing.Elastic.EaseIn = function(k) {

		var s, a = 0.1, p = 0.4;
		if ( k === 0 ) return 0;
		if ( k === 1 ) return 1;
		if ( !a || a < 1 ) { a = 1; s = p / 4; }
		else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
		return - ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );

	};
	/** @ignore */
	me.Tween.Easing.Elastic.EaseOut = function(k) {

		var s, a = 0.1, p = 0.4;
		if ( k === 0 ) return 0;
		if ( k === 1 ) return 1;
		if ( !a || a < 1 ) { a = 1; s = p / 4; }
		else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
		return ( a * Math.pow( 2, - 10 * k) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) + 1 );

	};
	/** @ignore */
	me.Tween.Easing.Elastic.EaseInOut = function(k) {

		var s, a = 0.1, p = 0.4;
		if ( k === 0 ) return 0;
		if ( k === 1 ) return 1;
		if ( !a || a < 1 ) { a = 1; s = p / 4; }
		else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
		if ( ( k *= 2 ) < 1 ) return - 0.5 * ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );
		return a * Math.pow( 2, -10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) * 0.5 + 1;

	};
	/** @ignore */
	me.Tween.Easing.Back.EaseIn = function(k) {

		var s = 1.70158;
		return k * k * ((s + 1) * k - s);

	};
	/** @ignore */
	me.Tween.Easing.Back.EaseOut = function(k) {

		var s = 1.70158;
		return --k * k * ( ( s + 1 ) * k + s ) + 1;

	};
	/** @ignore */
	me.Tween.Easing.Back.EaseInOut = function(k) {

		var s = 1.70158 * 1.525;
		if ((k *= 2) < 1)
			return 0.5 * (k * k * ((s + 1) * k - s));
		return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);

	};
	/** @ignore */
	me.Tween.Easing.Bounce.EaseIn = function(k) {

		return 1 - me.Tween.Easing.Bounce.EaseOut(1 - k);

	};
	/** @ignore */
	me.Tween.Easing.Bounce.EaseOut = function(k) {

		if ( k < ( 1 / 2.75 ) ) {

			return 7.5625 * k * k;

		} else if (k < (2 / 2.75)) {

			return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;

		} else if (k < (2.5 / 2.75)) {

			return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;

		} else {

			return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;

		}

	};
	/** @ignore */
	me.Tween.Easing.Bounce.EaseInOut = function(k) {

		if (k < 0.5)
			return me.Tween.Easing.Bounce.EaseIn(k * 2) * 0.5;
		return me.Tween.Easing.Bounce.EaseOut(k * 2 - 1) * 0.5 + 0.5;

	};


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})();
