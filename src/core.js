/**
 * @license MelonJS Game Engine
 * @copyright (C) 2011 - 2013 Olivier Biot, Jason Oster
 * http://www.melonjs.org
 *
 * melonJS is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license.php
 *
 */

/**
 * (<b>m</b>)elonJS (<b>e</b>)ngine : All melonJS functions are defined inside of this namespace.<p>
 * You generally should not add new properties to this namespace as it may be overwritten in future versions.
 * @namespace
 */
window.me = window.me || {};

(function($) {
	// Use the correct document accordingly to window argument
	var document = $.document;

	/**
	 * me global references
	 * @ignore
	 */
	me = {
		// settings & configuration
		// library name & version
		mod : "melonJS",
		version : "@VERSION",
		nocache : '',

		// Public Object (To be completed)
		audio : null,
		video : null,
		timer : null,
		input : null,
		state : null,
		game : null,
		entityPool : null,
		levelDirector : null,
		// System Object (instances)
		TMXParser : null,
		loadingScreen : null,
		// TMX Stuff
		TMXTileMap : null

	};

	/**
	 * global system settings and browser capabilities
	 * @namespace
	 */
	me.sys = {
		// Browser capabilities
		/**
		 * Browser User Agent (read-only)
		 * @type Boolean
		 * @memberOf me.sys
		 */
		ua : navigator.userAgent,
		/**
		 * Browser Audio capabilities (read-only) <br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		sound : false,
		/**
		 * Browser Local Storage capabilities (read-only) <br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		localStorage : (typeof($.localStorage) === 'object'),
		/**
		 * Browser accelerometer capabilities (read-only) <br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		hasAccelerometer : false,

		/**
		 * Browser Base64 decoding capability (read-only) <br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		nativeBase64 : (typeof($.atob) === 'function'),

		/**
		 * Touch capabilities <br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		touch : false,
		
		/**
		 * equals to true if a mobile device (read-only) <br>
		 * (Android | iPhone | iPad | iPod | BlackBerry | Windows Phone)
		 * @type Boolean
		 * @memberOf me.sys
		 */
		isMobile : false,


		// Global settings
		/**
		 * Game FPS (default 60)
		 * @type Int
		 * @memberOf me.sys
		 */
		fps : 60,

		/**
		 * enable/disable frame interpolation (default disable)<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		interpolation : false,

		/**
		 * Global scaling factor(default 1.0)
		 * @type me.Vector2d
		 * @memberOf me.sys
		 */
		scale : null, //initialized by me.video.init
		
		/**
		 * enable/disable video scaling interpolation (default disable)<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		scalingInterpolation : false,
	
		/**
		 * Global gravity settings <br>
		 * will override entities init value if defined<br>
		 * default value : undefined
		 * @type Number
		 * @memberOf me.sys
		 */
		gravity : undefined,

		/**
		 * cache Image using a Canvas element, instead of directly using the Image Object<br>
		 * using this, performances are lower on OSX desktop (others, including mobile untested)<br>
		 * default value : false
		 * @type Boolean
		 * @memberOf me.sys
		 */
		cacheImage : false,

		/**
		 * Specify either to stop on audio loading error or not<br>
		 * if me.debug.stopOnAudioLoad is true, melonJS will throw an exception and stop loading<br>
		 * if me.debug.stopOnAudioLoad is false, melonJS will disable sounds and output a warning message in the console <br>
		 * default value : true<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		stopOnAudioError : true,

		/**
		 * Specify whether to pause the game when losing focus.<br>
		 * default value : true<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		pauseOnBlur : true,

		/**
		 * Specify whether to unpause the game when gaining focus.<br>
		 * default value : true<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		resumeOnFocus : true,

		/**
		 * Specify whether to stop the game when losing focus or not<br>
		 * The engine restarts on focus if this is enabled.
		 * default value : true<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		stopOnBlur : true,

		/**
		 * Specify the rendering method for layers <br>
		 * if false, visible part of the layers are rendered dynamically (default)<br>
		 * if true, the entire layers are first rendered into an offscreen canvas<br>
		 * the "best" rendering method depends of your game<br>
		 * (amount of layer, layer size, amount of tiles per layer, etc…)<br>
		 * note : rendering method is also configurable per layer by adding this property to your layer (in Tiled)<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		preRender : false,
		

		// System methods
		/**
		 * Compare two version strings
		 * @public
		 * @function
		 * @param {String} first First version string to compare
		 * @param {String} [second="@VERSION"] Second version string to compare 
		 * @return {Integer} comparison result <br>&lt; 0 : first &lt; second <br>0 : first == second <br>&gt; 0 : first &gt; second
		 * @example
		 * if (me.sys.checkVersion("0.9.5") > 0) {
		 *     console.error("melonJS is too old. Expected: 0.9.5, Got: " + me.version);
		 * }
		 */
		checkVersion : function (first, second) {
			second = second || me.version;

			var a = first.split(".");
			var b = second.split(".");
			var len = Math.min(a.length, b.length);
			var result = 0;

			for (var i = 0; i < len; i++) {
				if (result = +a[i] - +b[i]) {
					break;
				}
			}

			return result ? result : a.length - b.length;
		}
	};

	// a flag to know if melonJS
	// is initialized
	var me_initialized = false;

	/*---

		DOM loading stuff

				---*/

	var readyBound = false, isReady = false, readyList = [];

	// Handle when the DOM is ready
	function domReady() {
		// Make sure that the DOM is not already loaded
		if (!isReady) {
			// be sure document.body is there
			if (!document.body) {
				return setTimeout(domReady, 13);
			}

			// clean up loading event
			if (document.removeEventListener) {
				document.removeEventListener("DOMContentLoaded", domReady, false);
			} else {
				$.removeEventListener("load", domReady, false);
			}
			
			// Remember that the DOM is ready
			isReady = true;

			// execute the defined callback
			for ( var fn = 0; fn < readyList.length; fn++) {
				readyList[fn].call($, []);
			}
			readyList.length = 0;
		}
	}

	// bind ready
	function bindReady() {
		if (readyBound) {
			return;
		}
		readyBound = true;

		// directly call domReady if document is already "ready"
		if (document.readyState === "complete") {
			return domReady();
		} else {
			if (document.addEventListener) {
				// Use the handy event callback
				document.addEventListener("DOMContentLoaded", domReady, false);
			}
			// A fallback to window.onload, that will always work
			$.addEventListener("load", domReady, false);
		}
	}

	/**
	 * Specify a function to execute when the DOM is fully loaded
	 * @param {Function} handler A function to execute after the DOM is ready.
	 * @example
	 * // small main skeleton
	 * var jsApp	=
	 * {
	 *    // Initialize the jsApp
	 *    // called by the window.onReady function
	 *    onload: function()
	 *    {
	 *       // init video
	 *       if (!me.video.init('jsapp', 640, 480))
	 *       {
	 *          alert("Sorry but your browser does not support html 5 canvas. ");
	 *          return;
	 *       }
	 *
	 *       // initialize the "audio"
	 *       me.audio.init("mp3,ogg");
	 *
	 *       // set callback for ressources loaded event
	 *       me.loader.onload = this.loaded.bind(this);
	 *
	 *       // set all ressources to be loaded
	 *       me.loader.preload(g_ressources);
	 *
	 *       // load everything & display a loading screen
	 *       me.state.change(me.state.LOADING);
	 *    },
	 *
	 *    // callback when everything is loaded
	 *    loaded: function ()
	 *    {
	 *       // define stuff
	 *       // ....
	 *
	 *       // change to the menu screen
	 *       me.state.change(me.state.MENU);
	 *    }
	 * }; // jsApp
	 *
	 * // "bootstrap"
	 * window.onReady(function()
	 * {
	 *    jsApp.onload();
	 * });
	 */
	$.onReady = function(fn) {
		// Attach the listeners
		bindReady();

		// If the DOM is already ready
		if (isReady) {
			// Execute the function immediately
			fn.call($, []);
		} else {
			// Add the function to the wait list
			readyList.push(function() {
				return fn.call($, []);
			});
		}
		return this;
	};

	// call the library init function when ready
	$.onReady(function() {
		_init_ME();
	});

	/************************************************************************************/

	/*
	 * some "Javascript API" patch & enhancement
	 */

	var initializing = false, fnTest = /var xyz/.test(function() {/**@nosideeffects*/var xyz;}) ? /\bparent\b/ : /[\D|\d]*/;

	/**
	 * JavaScript Inheritance Helper <br>
	 * Based on <a href="http://ejohn.org/">John Resig</a> Simple Inheritance<br>
	 * MIT Licensed.<br>
	 * Inspired by <a href="http://code.google.com/p/base2/">base2</a> and <a href="http://www.prototypejs.org/">Prototype</a><br>
	 * @param {Object} object Object (or Properties) to inherit from
	 * @example
	 * var Person = Object.extend(
	 * {
	 *    init: function(isDancing)
	 *    {
	 *       this.dancing = isDancing;
	 *    },
	 *    dance: function()
	 *    {
	 *       return this.dancing;
	 *    }
	 * });
	 *
	 * var Ninja = Person.extend(
	 * {
	 *    init: function()
	 *    {
	 *       this.parent( false );
	 *    },
	 *
	 *    dance: function()
	 *    {
	 *       // Call the inherited version of dance()
	 *       return this.parent();
	 *    },
	 *
	 *    swingSword: function()
	 *    {
	 *       return true;
	 *    }
	 * });
	 *
	 * var p = new Person(true);
	 * p.dance(); // => true
	 *
	 * var n = new Ninja();
	 * n.dance(); // => false
	 * n.swingSword(); // => true
	 *
	 * // Should all be true
	 * p instanceof Person && p instanceof Class &&
	 * n instanceof Ninja && n instanceof Person && n instanceof Class
	 */
	Object.extend = function(prop) {
		// _super rename to parent to ease code reading
		var parent = this.prototype;

		// Instantiate a base class (but only create the instance,
		// don't run the init constructor)
		initializing = true;
		var proto = new this();
		initializing = false;

		// Copy the properties over onto the new prototype
		for ( var name in prop) {
			// Check if we're overwriting an existing function
			proto[name] = typeof prop[name] === "function"
					&& typeof parent[name] === "function"
					&& fnTest.test(prop[name]) ? (function(name, fn) {
				return function() {
					var tmp = this.parent;

					// Add a new ._super() method that is the same method
					// but on the super-class
					this.parent = parent[name];

					// The method only need to be bound temporarily, so we
					// remove it when we're done executing
					var ret = fn.apply(this, arguments);
					this.parent = tmp;

					return ret;
				};
			})(name, prop[name]) : prop[name];
		}

		// The dummy class constructor
		function Class() {
			if (!initializing && this.init) {
				this.init.apply(this, arguments);
			}
			//return this;
		}
		// Populate our constructed prototype object
		Class.prototype = proto;
		// Enforce the constructor to be what we expect
		Class.constructor = Class;
		// And make this class extendable
		Class.extend = Object.extend;//arguments.callee;

		return Class;
	};

	if (typeof Object.create !== 'function') {
		/**
		 * Prototypal Inheritance Create Helper
		 * @param {Object} Object
		 * @example
		 * // declare oldObject
		 * oldObject = new Object();
		 * // make some crazy stuff with oldObject (adding functions, etc...)
		 * ...
		 * ...
		 *
		 * // make newObject inherits from oldObject
		 * newObject = Object.create(oldObject);
		 */
		Object.create = function(o) {
			function _fn() {};
			_fn.prototype = o;
			return new _fn();
		};
	};

	/**
	 * The built in Function Object
	 * @external Function
	 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function|Function}
	 */
	
	if (!Function.prototype.bind) {
		/** @ignore */
		function Empty() {};
		
		/**
		 * Binds this function to the given context by wrapping it in another function and returning the wrapper.<p>
		 * Whenever the resulting "bound" function is called, it will call the original ensuring that this is set to context. <p>
		 * Also optionally curries arguments for the function.
		 * @memberof! external:Function#
		 * @alias bind
		 * @param {Object} context the object to bind to.
		 * @param {} [arguments...] Optional additional arguments to curry for the function.
		 * @example
		 * // Ensure that our callback is triggered with the right object context (this):
		 * myObject.onComplete(this.callback.bind(this));
		 */
		Function.prototype.bind = function bind(that) {
			// ECMAScript 5 compliant implementation
			// http://es5.github.com/#x15.3.4.5
			// from https://github.com/kriskowal/es5-shim
			var target = this;
			if (typeof target !== "function") {
				throw new TypeError("Function.prototype.bind called on incompatible " + target);
			}
			var args = Array.prototype.slice.call(arguments, 1);
			var bound = function () {
				if (this instanceof bound) {
					var result = target.apply( this, args.concat(Array.prototype.slice.call(arguments)));
					if (Object(result) === result) {
						return result;
					}
					return this;
				} else {
					return target.apply(that, args.concat(Array.prototype.slice.call(arguments)));
				}
			};
			if(target.prototype) {
				Empty.prototype = target.prototype;
				bound.prototype = new Empty();
				Empty.prototype = null;
			}
			return bound;
		};
	}

	if (!window.throttle) {
		/**
		 * a simple throttle function 
		 * use same fct signature as the one in prototype
		 * in case it's already defined before
		 * @ignore
		 */
		window.throttle = function( delay, no_trailing, callback, debounce_mode ) {
			var last = Date.now(), deferTimer;
			// `no_trailing` defaults to false.
			if ( typeof no_trailing !== 'boolean' ) {
			  no_trailing = false;
			}
			return function () {
				var now = Date.now();
				var elasped = now - last;
				var args = arguments;
				if (elasped < delay) {
					if (no_trailing === false) {
						// hold on to it
						clearTimeout(deferTimer);
						deferTimer = setTimeout(function () {
							last = now;
							return callback.apply(null, args);
						}, elasped);
					}
				} else {
					last = now;
					return callback.apply(null, args);
				}
			}
		};
	};
	
	
	if (typeof Date.now === "undefined") {
		/**
		 * provide a replacement for browser not
		 * supporting Date.now (JS 1.5)
		 * @ignore
		 */
		Date.now = function(){return new Date().getTime();};
	}

	if(typeof console === "undefined") {
		/**
		 * Dummy console.log to avoid crash
		 * in case the browser does not support it
		 * @ignore
		 */
		console = {
			log: function() {},
			info: function() {},
			error: function() {alert(Array.prototype.slice.call(arguments).join(", "));}
		};
	}

	/**
	 * Executes a function as soon as the interpreter is idle (stack empty).
	 * @memberof! external:Function#
	 * @alias defer
	 * @param {} [arguments...] Optional additional arguments to curry for the function.
	 * @return {Int} id that can be used to clear the deferred function using clearTimeout
	 * @example
	 * // execute myFunc() when the stack is empty, with 'myArgument' as parameter
	 * myFunc.defer('myArgument');
	 */
	Function.prototype.defer = function() {
		var fn = this, args = Array.prototype.slice.call(arguments);
		return window.setTimeout(function() {
			return fn.apply(fn, args);
		}, 0.01);
	};

	if (!Object.defineProperty) {
		/**
		 * simple defineProperty function definition (if not supported by the browser)<br>
		 * if defineProperty is redefined, internally use __defineGetter__/__defineSetter__ as fallback
		 * @param {Object} obj The object on which to define the property.
		 * @param {String} prop The name of the property to be defined or modified.
		 * @param {Object} desc The descriptor for the property being defined or modified.
		 */
		Object.defineProperty = function(obj, prop, desc) {
			// check if Object support __defineGetter function
			if (obj.__defineGetter__) {
				if (desc.get) {
					obj.__defineGetter__(prop, desc.get);
				}
				if (desc.set) {
					obj.__defineSetter__(prop, desc.set);
				}
			} else {
				// we should never reach this point....
				throw "melonJS: Object.defineProperty not supported";
			}
		}
	};

	/**
	 * The built in String Object
	 * @external String
	 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String|String}
	 */
	
	if(!String.prototype.trim) {  
		/**
		 * returns the string stripped of whitespace from both ends
		 * @memberof! external:String#
		 * @alias trim
		 * @return {String} trimmed string
		 */
		String.prototype.trim = function () {  
			return (this.replace(/^\s+/, '')).replace(/\s+$/, ''); 
		};  
	}; 
	
	/**
	 * add isNumeric fn to the string object
	 * @memberof! external:String#
	 * @alias isNumeric
	 * @return {Boolean} true if string contains only digits
	 */
	String.prototype.isNumeric = function() {
		return (this !== null && !isNaN(this) && this.trim() !== "");
	};

	/**
	 * add a isBoolean fn to the string object
	 * @memberof! external:String#
	 * @alias isBoolean
	 * @return {Boolean} true if the string is either true or false
	 */
	String.prototype.isBoolean = function() {
		return (this !== null && ("true" === this.trim() || "false" === this.trim()));
	};

	/**
	 * add a contains fn to the string object
	 * @memberof! external:String#
	 * @alias contains
	 * @param {String} string to test for
	 * @return {Boolean} true if contains the specified string
	 */
	String.prototype.contains = function(word) {
		return this.indexOf(word) > -1;
	};

	/**
	 * convert the string to hex value
	 * @memberof! external:String#
	 * @alias toHex
	 * @return {String}
	 */
	String.prototype.toHex = function() {
		var res = "", c = 0;
		while(c<this.length){
			res += this.charCodeAt(c++).toString(16);
		}
		return res;
	};

	/**
	 * The built in Number Object
	 * @external Number
	 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Number|Number}
	 */
	 
	/**
	 * add a clamp fn to the Number object
	 * @memberof! external:Number#
	 * @alias clamp
	 * @param {Number} low lower limit
	 * @param {Number} high higher limit
	 * @return {Number} clamped value
	 */
	Number.prototype.clamp = function(low, high) {
		return this < low ? low : this > high ? high : +this;
	};

	/**
	 * return a random between min, max
	 * @memberof! external:Number#
	 * @alias random
	 * @param {Number} min minimum value.
	 * @param {Number} max maximum value.
	 * @return {Number} random value
	 */
	Number.prototype.random = function(min, max) {
		return (~~(Math.random() * (max - min + 1)) + min);
	};

	/**
	 * round a value to the specified number of digit
	 * @memberof! external:Number#
	 * @alias round
	 * @param {Number} [num="Object value"] value to be rounded.
	 * @param {Number} dec number of decimal digit to be rounded to.
	 * @return {Number} rounded value
	 * @example
	 * // round a specific value to 2 digits
	 * Number.prototype.round (10.33333, 2); // return 10.33
	 * // round a float value to 4 digits
	 * num = 10.3333333
	 * num.round(4); // return 10.3333
	 */
	Number.prototype.round = function() {
		// if only one argument use the object value
		var num = (arguments.length < 2) ? this : arguments[0];
		var powres = Math.pow(10, arguments[1] || arguments[0] || 0);
		return (Math.round(num * powres) / powres);
	};

	/**
	 * a quick toHex function<br>
	 * given number <b>must</b> be an int, with a value between 0 and 255
	 * @memberof! external:Number#
	 * @alias toHex
	 * @return {String} converted hexadecimal value
	 */
	Number.prototype.toHex = function() {
		return "0123456789ABCDEF".charAt((this - this % 16) >> 4) + "0123456789ABCDEF".charAt(this % 16);
	};

	/**
	 * Returns a value indicating the sign of a number<br>
	 * @memberof! external:Number#
	 * @alias sign
	 * @return {Number} sign of a the number
	 */
	Number.prototype.sign = function() {
		return this < 0 ? -1 : (this > 0 ? 1 : 0);
	};

	/**
	 * Converts an angle in degrees to an angle in radians
	 * @memberof! external:Number#
	 * @alias degToRad
	 * @param {Number} [angle="angle"] angle in degrees
	 * @return {Number} corresponding angle in radians
	 * @example
	 * // convert a specific angle
	 * Number.prototype.degToRad (60); // return 1.0471...
	 * // convert object value
	 * var num = 60
	 * num.degToRad(); // return 1.0471...
	 */
	Number.prototype.degToRad = function (angle) {
		return (angle||this) / 180.0 * Math.PI;
	};

	/**
	 * Converts an angle in radians to an angle in degrees.
	 * @memberof! external:Number#
	 * @alias radToDeg
	 * @param {Number} [angle="angle"] angle in radians
	 * @return {Number} corresponding angle in degrees
	 * @example
	 * // convert a specific angle
	 * Number.prototype.radToDeg (1.0471975511965976); // return 59.9999...
	 * // convert object value
	 * num = 1.0471975511965976
	 * Math.ceil(num.radToDeg()); // return 60
	 */
	Number.prototype.radToDeg = function (angle) {
		return (angle||this) * (180.0 / Math.PI);
	};
	
	
	/**
	 * The built in Array Object
	 * @external Array
	 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array|Array}
	 */
	
	/**
	 * Remove the specified object from the Array<br>
	 * @memberof! external:Array#
	 * @alias remove
	 * @param {Object} object to be removed
	 */
	Array.prototype.remove = function(obj) {
		var i = Array.prototype.indexOf.call(this, obj);
		if( i !== -1 ) {
			Array.prototype.splice.call(this, i, 1);
		}
		return this;
	};

	if (!Array.prototype.forEach) {
		/**
		 * provide a replacement for browsers that don't
		 * support Array.prototype.forEach (JS 1.6)
		 * @ignore
		 */
		Array.prototype.forEach = function (callback, scope) {
			for (var i = 0, j = this.length; j--; i++) {
				callback.call(scope || this, this[i], i, this);
			}
		};
	}

	Object.defineProperty(me, "initialized", {
		get : function get() {
			return me_initialized;
		}
	});

	/*
	 * me init stuff
     */

	function _init_ME() {
		// don't do anything if already initialized (should not happen anyway)
		if (me_initialized) {
			return;
		}

		// enable/disable the cache
		me.utils.setNocache(document.location.href.match(/\?nocache/)||false);
	
		// detect audio capabilities
		me.audio.detectCapabilities();
		
		// future proofing (MS) feature detection
		navigator.pointerEnabled = navigator.pointerEnabled || navigator.msPointerEnabled;
		navigator.maxTouchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0;
		window.gesture = window.gesture || window.MSGesture;
		
		// detect touch capabilities
		me.sys.touch = ('createTouch' in document) || ('ontouchstart' in $) || 
		               (navigator.isCocoonJS) || (navigator.maxTouchPoints > 0);
		
		// detect platform
		me.sys.isMobile = me.sys.ua.match(/Android|iPhone|iPad|iPod|BlackBerry|Windows Phone|Mobile/i);

		// accelerometer detection
		me.sys.hasAccelerometer = (
			(typeof (window.DeviceMotionEvent) !== 'undefined') || (
				(typeof (window.Windows) !== 'undefined') && 
				(typeof (Windows.Devices.Sensors.Accelerometer) === 'function')
			)
		);

		// init the FPS counter if needed
		me.timer.init();

		// create a new map reader instance
		me.mapReader = new me.TMXMapReader();

		// init the App Manager
		me.state.init();

		// init the Entity Pool
		me.entityPool.init();

		// init the level Director
		me.levelDirector.reset();

		me_initialized = true;

	}

	/**
	 * me.game represents your current game, it contains all the objects, tilemap layers,<br>
	 * HUD information, current viewport, collision map, etc..<br>
	 * me.game is also responsible for updating (each frame) the object status and draw them<br>
	 * @namespace me.game
	 * @memberOf me
	 */
	me.game = (function() {
		// hold public stuff in our singletong
		var api = {};

		/*---------------------------------------------

			PRIVATE STUFF

			---------------------------------------------*/

		// ref to the "system" context
		var frameBuffer = null;

		// flag to redraw the sprites
		var initialized = false;

		// to keep track of deferred stuff
		var pendingRemove = null;

		// to know when we have to refresh the display
		var isDirty = true;

		/*---------------------------------------------

			PUBLIC STUFF

			---------------------------------------------*/
		/**
		 * a reference to the game viewport.
		 * @public
		 * @type me.Viewport
		 * @name viewport
		 * @memberOf me.game
		 */
		api.viewport = null;
		/**
		 * a reference to the game HUD (if defined).
		 * @public
		 * @type me.HUD_Object
		 * @name HUD
		 * @memberOf me.game
		 */
		api.HUD = null;
		
		/**
		 * a reference to the game collision Map
		 * @public
		 * @type me.TMXLayer
		 * @name collisionMap
		 * @memberOf me.game
		 */
		api.collisionMap = null;
		
		/**
		 * a reference to the game current level
		 * @public
		 * @type me.TMXTileMap
		 * @name currentLevel
		 * @memberOf me.game
		 */
		api.currentLevel = null;

		/**
		 * a reference to the game world <br>
		 * a world is a virtual environment containing all the game objects
		 * @public
		 * @type me.EntityContainer
		 * @name world
		 * @memberOf me.game
		 */
		api.world = null;


		/**
		 * The property of should be used when sorting entities <br>
		 * value : "x", "y", "z" (default: "z")
		 * @public
		 * @type String
		 * @name sortOn
		 * @memberOf me.game
		 */
		api.sortOn = "z";
		
		/**
		 * default layer renderer
		 * @private
		 * @ignore
		 * @type me.TMXRenderer
		 * @name renderer
		 * @memberOf me.game
		 */		
		api.renderer = null;

		// FIX ME : put this somewhere else
		api.NO_OBJECT = 0;

		/**
		 * Default object type constant.<br>
		 * See type property of the returned collision vector.
		 * @constant
		 * @name ENEMY_OBJECT
		 * @memberOf me.game
		 */
		api.ENEMY_OBJECT = 1;

		/**
		 * Default object type constant.<br>
		 * See type property of the returned collision vector.
		 * @constant
		 * @name COLLECTABLE_OBJECT
		 * @memberOf me.game
		 */
		api.COLLECTABLE_OBJECT = 2;

		/**
		 * Default object type constant.<br>
		 * See type property of the returned collision vector.
		 * @constant
		 * @name ACTION_OBJECT
		 * @memberOf me.game
		 */
		api.ACTION_OBJECT = 3; // door, etc...

		/**
		 * Fired when a level is fully loaded and <br>
		 * and all entities instantiated. <br>
		 * Additionnaly the level id will also be passed
		 * to the called function.
		 * @public
		 * @callback
		 * @name onLevelLoaded
		 * @memberOf me.game
		 * @example
		 * // call myFunction() everytime a level is loaded
		 * me.game.onLevelLoaded = this.myFunction.bind(this);
		 */
		 api.onLevelLoaded = null;
		 
		/**
		 * Initialize the game manager
		 * @name init
		 * @memberOf me.game
		 * @private
		 * @ignore
		 * @function
		 * @param {int} [width="full size of the created canvas"] width of the canvas
		 * @param {int} [height="full size of the created canvas"] width of the canvas
		 * init function.
		 */
		api.init = function(width, height) {
			if (!initialized) {
				// if no parameter specified use the system size
				var width = width || me.video.getWidth();
				var height = height || me.video.getHeight();

				// create a defaut viewport of the same size
				api.viewport = new me.Viewport(0, 0, width, height);

				//the root object of our world is an entity container
				api.world = new me.EntityContainer(0,0, width, height);
				// give it a name
				api.world.name = 'rootContainer';

				// get a ref to the screen buffer
				frameBuffer = me.video.getSystemContext();

				// publish init notification
				me.event.publish(me.event.GAME_INIT);

				// make display dirty by default
				isDirty = true;

				// set as initialized
				initialized = true;
			}
		};

		/**
		 * reset the game Object manager<p>
		 * destroy all current object except the HUD
		 * @see me.game#disableHUD
		 * @name reset
		 * @memberOf me.game
		 * @public
		 * @function
		 */
		api.reset = function() {

			// initialized the object if not yet done
			if (!initialized) {
				api.init();
			}

			// remove all objects
			api.removeAll();

			// reset the viewport to zero ?
			if (api.viewport) {
				api.viewport.reset();
			}

			// reset the transform matrix to the normal one
			frameBuffer.setTransform(1, 0, 0, 1, 0, 0);

			// dummy current level
			api.currentLevel = {pos:{x:0,y:0}};
		};
	
		/**
		 * Load a TMX level
		 * @name loadTMXLevel
		 * @memberOf me.game
		 * @private
		 * @ignore
		 * @function
		 */

		api.loadTMXLevel = function(level) {
			
			// disable auto-sort
			api.world.autoSort = false;
			
			// load our map
			api.currentLevel = level;

			// get the collision map
			api.collisionMap = api.currentLevel.getLayerByName("collision");
			if (!api.collisionMap || !api.collisionMap.isCollisionMap) {
				console.error("WARNING : no collision map detected");
			}

			// add all defined layers
			var layers = api.currentLevel.getLayers();
			for ( var i = layers.length; i--;) {
				if (layers[i].visible) {
					// only if visible
					api.add(layers[i]);
				}
			}

			// change the viewport limit
			api.viewport.setBounds(Math.max(api.currentLevel.width, api.viewport.width),
								   Math.max(api.currentLevel.height, api.viewport.height));

			// load all game entities
			var objectGroups = api.currentLevel.getObjectGroups();
			for ( var group = 0; group < objectGroups.length; group++) {
				// only add corresponding objects it the group is visible
				if (objectGroups[group].visible) {
					for ( var entity = 0; entity < objectGroups[group].objects.length; entity++) {
						api.addEntity(objectGroups[group].objects[entity], objectGroups[group].z);
					}
				}
			}
			
			// check if the map has different default (0,0) screen coordinates
			if (api.currentLevel.pos.x !== api.currentLevel.pos.y) {
				// translate the display accordingly
				frameBuffer.translate( api.currentLevel.pos.x , api.currentLevel.pos.y );
			}

			// sort all our stuff !!
			api.world.sort();
			
			// re-enable auto-sort
			api.world.autoSort = true;

			// fire the callback if defined
			if (api.onLevelLoaded) {
				api.onLevelLoaded.call(api.onLevelLoaded, level.name);
			}
			//publish the corresponding message
			me.event.publish(me.event.LEVEL_LOADED, [level.name]);

		};

		/**
		 * Manually add object to the game manager
		 * @name add
		 * @memberOf me.game
		 * @param {me.ObjectEntity} obj Object to be added
		 * @param {int} [z="obj.z"] z index
		 * @public
		 * @function
		 * @example
		 * // create a new object
		 * var obj = new MyObject(x, y)
		 * // add the object and force the z index of the current object
		 * me.game.add(obj, this.z);
		 */
		api.add = function(object, zOrder) {
			if (typeof(zOrder) !== 'undefined') {
				object.z = zOrder;
			}
			// add the object in the game obj list
			api.world.addChild(object);

		};

		/**
		 * add an entity to the game manager
		 * @name addEntity
		 * @memberOf me.game
		 * @private
		 * @ignore
		 * @function
		 */
		api.addEntity = function(ent, zOrder) {
			var obj = me.entityPool.newInstanceOf(ent.name, ent.x, ent.y, ent);
			if (obj) {
				api.add(obj, zOrder);
			}
		};

		/**
		 * returns the list of entities with the specified name<br>
		 * as defined in Tiled (Name field of the Object Properties)<br>
		 * note : avoid calling this function every frame since
		 * it parses the whole object list each time
		 * @deprecated use me.game.world.getEntityByProp();
		 * @name getEntityByName
		 * @memberOf me.game
		 * @public
		 * @function
		 * @param {String} entityName entity name
		 * @return {me.ObjectEntity[]} Array of object entities
		 */
		api.getEntityByName = function(entityName) {
			return api.world.getEntityByProp("name", entityName);
		};
		
		/**
		 * return the entity corresponding to the specified GUID<br>
		 * note : avoid calling this function every frame since
		 * it parses the whole object list each time
		 * @deprecated use me.game.world.getEntityByProp();
		 * @name getEntityByGUID
		 * @memberOf me.game
		 * @public
		 * @function
		 * @param {String} GUID entity GUID
		 * @return {me.ObjectEntity} Object Entity (or null if not found)
		 */
		api.getEntityByGUID = function(guid) {
			var obj = api.world.getEntityByProp("GUID", guid);
			return (obj.length>0)?obj[0]:null;
		};
		
		/**
		 * return the entity corresponding to the property and value<br>
		 * note : avoid calling this function every frame since
		 * it parses the whole object list each time
		 * @deprecated use me.game.world.getEntityByProp();
		 * @name getEntityByProp
		 * @memberOf me.game
		 * @public
		 * @function
		 * @param {String} prop Property name
		 * @param {String} value Value of the property
		 * @return {me.ObjectEntity[]} Array of object entities
		 */
		api.getEntityByProp = function(prop, value) {
			return api.world.getEntityByProp(prop, value);
		};
		
		/**
		 * add a HUD obj to the game manager
		 * @name addHUD
		 * @memberOf me.game
		 * @public
		 * @function
		 * @param {int} x x position of the HUD
		 * @param {int} y y position of the HUD
		 * @param {int} w width of the HUD
		 * @param {int} h height of the HUD
		 * @param {String} [bg] a CSS string specifying the background color (e.g. "#0000ff" or "rgb(0,0,255)")
		 */
		api.addHUD = function(x, y, w, h, bg) {
			// if no HUD existing
			if (api.HUD == null) {
				// create a new default HUD object
				api.HUD = new me.HUD_Object(x, y, w, h, bg);
				api.add(api.HUD);
			}
		};

		/**
		 * disable the current HUD
		 * @name disableHUD
		 * @memberOf me.game
		 * @public
		 * @function
		 */
		api.disableHUD = function() {

			// if no HUD existing
			if (api.HUD != null) {
				// remove the HUD object
				api.remove(api.HUD);
				// nullify it
				api.HUD = null;

			}
		};

		
		/**
		 * remove an object
		 * @name remove
		 * @memberOf me.game
		 * @public
		 * @function
		 * @param {me.ObjectEntity} obj Object to be removed
		 * @param {Boolean} [force=false] Force immediate deletion.<br>
		 * <strong>WARNING</strong>: Not safe to force asynchronously (e.g. onCollision callbacks)
		 */
		api.remove = function(obj, force) {
			if (api.world.hasChild(obj)) {
				// remove the object from the object list
				if (force===true) {
					// force immediate object deletion
					api.world.removeChild(obj);
				} else {
					// make it invisible (this is bad...)
					obj.visible = obj.inViewport = false;
					// wait the end of the current loop
					/** @ignore */
					pendingRemove = (function (obj) {
						me.game.world.removeChild(obj);
						pendingRemove = null;
					}).defer(obj);
				}
			}
		};

		/**
		 * remove all objects<br>
		 * @name removeAll
		 * @memberOf me.game
		 * @param {Boolean} [force=false] Force immediate deletion.<br>
		 * <strong>WARNING</strong>: Not safe to force asynchronously (e.g. onCollision callbacks)
		 * @public
		 * @function
		 */
		api.removeAll = function() {
			//cancel any pending tasks
			if (pendingRemove) {
				clearTimeout(pendingRemove);
				pendingRemove = null;
			}
			// destroy all objects in the root container
			api.world.destroy();
		};

		/**
		 * Manually trigger the sort all the game objects.</p>
		 * Since version 0.9.9, all objects are automatically sorted, <br>
		 * except if a container autoSort property is set to false.
		 * @deprecated use me.game.world.sort();
		 * @name sort
		 * @memberOf me.game
		 * @public
		 * @function
		 * @example
		 * // change the default sort property
		 * me.game.sortOn = "y";
		 * // manuallly call me.game.sort with our sorting function
		 * me.game.sort();
		 */
		api.sort = function() {
			api.world.sort();
		};

		/**
		 * Checks if the specified entity collides with others entities.
		 * @deprecated use me.game.world.collide();
		 * @name collide
		 * @memberOf me.game
		 * @public
		 * @function
		 * @param {me.ObjectEntity} obj Object to be tested for collision
		 * @param {Boolean} [multiple=false] check for multiple collision
		 * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
		 * @example
		 * // update player movement
		 * this.updateMovement();
		 *
		 * // check for collision with other objects
		 * res = me.game.collide(this);
		 *
		 * // check if we collide with an enemy :
		 * if (res && (res.obj.type == me.game.ENEMY_OBJECT))
		 * {
		 *   if (res.x != 0)
		 *   {
		 *      // x axis
		 *      if (res.x<0)
		 *         console.log("x axis : left side !");
		 *      else
		 *         console.log("x axis : right side !");
		 *   }
		 *   else
		 *   {
		 *      // y axis
		 *      if (res.y<0)
		 *         console.log("y axis : top side !");
		 *      else
		 *         console.log("y axis : bottom side !");
		 *   }
		 * }
		 */
		api.collide = function(objA, multiple) {
			return api.world.collide (objA, multiple);
		};

		/**
		 * Checks if the specified entity collides with others entities of the specified type.
		 * @deprecated use me.game.world.collideType();
		 * @name collideType
		 * @memberOf me.game
		 * @public
		 * @function
		 * @param {me.ObjectEntity} obj Object to be tested for collision
		 * @param {String} type Entity type to be tested for collision (null to disable type check)
		 * @param {Boolean} [multiple=false] check for multiple collision
		 * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
		 */
		api.collideType = function(objA, type, multiple) {
			return api.world.collideType (objA, type, multiple);
		};

		/**
		 * force the redraw (not update) of all objects
		 * @name repaint
		 * @memberOf me.game
		 * @public
		 * @function
		 */

		api.repaint = function() {
			isDirty = true;
		};


		/**
		 * update all objects of the game manager
		 * @name update
		 * @memberOf me.game
		 * @private
		 * @ignore
		 * @function
		 */
		api.update = function() {
			
			// update all objects
			isDirty = api.world.update();
			
			// update the camera/viewport
			isDirty |= api.viewport.update(isDirty);

			return isDirty;
			
		};
		

		/**
		 * draw all existing objects
		 * @name draw
		 * @memberOf me.game
		 * @private
		 * @ignore
		 * @function
		 */

		api.draw = function() {
			if (isDirty) {
				// cache the viewport rendering position, so that other object
				// can access it later (e,g. entityContainer when drawing floating objects)
				api.viewport.screenX = api.viewport.pos.x + ~~api.viewport.offset.x;
				api.viewport.screenY = api.viewport.pos.y + ~~api.viewport.offset.y;
							
				// save the current context
				frameBuffer.save();
				// translate by default to screen coordinates
				frameBuffer.translate(-api.viewport.screenX, -api.viewport.screenY);
				
				// substract the map offset to current the current pos
				api.viewport.screenX -= api.currentLevel.pos.x;
				api.viewport.screenY -= api.currentLevel.pos.y;

				// update all objects, 
				// specifying the viewport as the rectangle area to redraw

				api.world.draw(frameBuffer, api.viewport);

				//restore context
				frameBuffer.restore();
				
				// call the viewport draw function (for effects)
				api.viewport.draw(frameBuffer);
			}
			isDirty = false;
		};

		// return our object
		return api;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
