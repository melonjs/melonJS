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
		// library name & version
		mod : "melonJS",
		version : "@VERSION"
	};

	/**
	 * global system settings and browser capabilities
	 * @namespace
	 */
	me.sys = {

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
		 * default value : false<br>
		 * @type Boolean
		 * @memberOf me.sys
		 */
		stopOnBlur : false,

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
		 * @return {Number} comparison result <br>&lt; 0 : first &lt; second <br>0 : first == second <br>&gt; 0 : first &gt; second
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
	 * The built in window Object
	 * @external window
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window.window}
	 */
    
	/**
	 * Specify a function to execute when the DOM is fully loaded
     * @memberOf external:window#
     * @alias onReady
	 * @param {Function} handler A function to execute after the DOM is ready.
	 * @example
	 * // small main skeleton
	 * var game	= {
	 *    // Initialize the game
	 *    // called by the window.onReady function
	 *    onload: function() {
	 *
	 *       // init video
	 *       if (!me.video.init('screen', 640, 480, true)) {
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
	 *       me.loader.preload(game.resources);
	 *
	 *       // load everything & display a loading screen
	 *       me.state.change(me.state.LOADING);
	 *    },
	 *
	 *    // callback when everything is loaded
	 *    loaded: function () {
	 *       // define stuff
	 *       // ....
	 *
	 *       // change to the menu screen
	 *       me.state.change(me.state.MENU);
	 *    }
	 * }; // game
	 *
	 * // "bootstrap"
	 * window.onReady(function() {
	 *    game.onload();
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
     * a deep copy function
     * @ignore
     */
    var deepcopy = function (obj) {
     
        if (null == obj || "object" !== typeof obj) {
            return obj;
        }
        
        // hold the copied object
        var copy;
        
        // Array copy
        if( obj instanceof Array ) {
            copy = [];
            Object.setPrototypeOf(copy, Object.getPrototypeOf(obj));
            for( var i = 0, l = obj.length; i < l; i++) {
                copy[i] = deepcopy(obj[i]);
            }
            return copy;
        }
        
        // Date copy
        if (obj instanceof Date) {
            copy = new Date();
            copy.setTime(obj.getTime());
            return copy;
        }
            
        // else instanceof Object
        copy = {};
        Object.setPrototypeOf(copy, Object.getPrototypeOf(obj));
        for( var prop in obj ) {
            if (obj.hasOwnProperty(prop)) copy[prop] = deepcopy(obj[prop]);
        }
        return copy;
    };
    
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

		function addSuper(name, fn) {
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
		}

		// Copy the properties over onto the new prototype
		for ( var name in prop) {
			// Check if we're overwriting an existing function
			proto[name] = typeof prop[name] === "function" &&
						  typeof parent[name] === "function" &&
						  fnTest.test(prop[name]) ? addSuper(name, prop[name]) : prop[name];
		}

		// The dummy class constructor
		function Class() {
			if (!initializing) {
				for( var prop in this ) {
					// deepcopy properties if required
					if( typeof(this[prop]) === 'object' ) {
						this[prop] = deepcopy(this[prop]);
					}
				}
				if (this.init) {
					this.init.apply(this, arguments);
				}
			}
			return this;
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
			var Fn = function() {};
			Fn.prototype = o;
			return new Fn();
		};
	}

	/**
	 * The built in Function Object
	 * @external Function
	 * @see {@link https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function|Function}
	 */
	
	if (!Function.prototype.bind) {
		/** @ignore */
		var Empty = function () {};
		
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
			var last = window.performance.now(), deferTimer;
			// `no_trailing` defaults to false.
			if ( typeof no_trailing !== 'boolean' ) {
			  no_trailing = false;
			}
			return function () {
				var now = window.performance.now();
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
			};
		};
	}
	
	
	if (typeof Date.now === "undefined") {
		/**
		 * provide a replacement for browser not
		 * supporting Date.now (JS 1.5)
		 * @ignore
		 */
        Date.now = function() { 
            return new Date().getTime();
        };
	}
    
    // define window.performance if undefined
    if (typeof window.performance === 'undefined') {
        window.performance = {};
    }
 
    if (!window.performance.now){
        var timeOffset = Date.now();
        
        if (window.performance.timing && window.performance.timing.navigationStart){
            timeOffset = window.performance.timing.navigationStart;
        }
        /**
         * provide a polyfill for window.performance now
         * to provide consistent time information across browser
         * (always return the elapsed time since the browser started)
         * @ignore
         */
        window.performance.now = function() { 
            return Date.now() - timeOffset;
        };
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
	 * @return {Number} id that can be used to clear the deferred function using clearTimeout
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
		};
	}

    /**
     * Get the prototype of an Object.
     * @memberOf external:Object#
     * @alias getPrototypeOf
     * @param {Object} obj Target object to inspect.
     * @return {Prototype} Prototype of the target object.
     */
    Object.getPrototypeOf = Object.getPrototypeOf || function (obj) {
        /* jshint ignore:start */
        return obj.__proto__;
        /* jshint ignore:end */
    };

    /**
     * Set the prototype of an Object.
     * @memberOf external:Object#
     * @alias setPrototypeOf
     * @param {Object} obj Target object to modify.
     * @param {Prototype} prototype New prototype for the target object.
     * @return {Object} Modified target object.
     */
    Object.setPrototypeOf = Object.setPrototypeOf || function (obj, prototype) {
        /* jshint ignore:start */
        obj.__proto__ = prototype;
        /* jshint ignore:end */
        return obj;
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
			return this.replace(/^\s+|\s+$/gm, '');

		};  
	}

	if(!String.prototype.trimLeft) {  
		/**
		 * returns the string stripped of whitespace from the left of the string.
		 * @memberof! external:String#
		 * @alias trimLeft
		 * @return {String} trimmed string
		 */
		String.prototype.trimLeft = function () {  
			return this.replace(/^\s+/, '');
		};  
	}

	if(!String.prototype.trimRight) {  
		/**
		 * returns the string stripped of whitespace from the right end of the string.
		 * @memberof! external:String#
		 * @alias trimRight
		 * @return {String} trimmed string
		 */
		String.prototype.trimRight = function () {  
			return this.replace(/\s+$/, '');
		};  
	}
	
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

	if (!String.prototype.contains) {
		/**
		 * determines whether or not a string contains another string.
		 * @memberof! external:String#
		 * @alias contains
		 * @param {String} str A string to be searched for within this string.
		 * @param {Number} [startIndex=0] The position in this string at which to begin searching for given string.
		 * @return {Boolean} true if contains the specified string
		 */
		String.prototype.contains = function(str, startIndex) {
	        return -1 !== String.prototype.indexOf.call(this, str, startIndex);
		};
	}

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

		// check the device capabilites
		me.device._check();

		// initialize me.save
		me.save._init();

		// enable/disable the cache
		me.loader.setNocache(document.location.href.match(/\?nocache/)||false);
	
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
	 * current viewport, collision map, etc...<br>
	 * me.game is also responsible for updating (each frame) the object status and draw them<br>
	 * @namespace me.game
	 * @memberOf me
	 */
	me.game = (function() {
		// hold public stuff in our singleton
		var api = {};

		/*---------------------------------------------

			PRIVATE STUFF

			---------------------------------------------*/

		// ref to the "system" context
		var frameBuffer = null;

		// flag to redraw the sprites
		var initialized = false;

		// to know when we have to refresh the display
		var isDirty = true;

		// frame counter for frameSkipping
		// reset the frame counter
		var frameCounter = 0;
		var frameRate = 1;

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
		 * @type me.ObjectContainer
		 * @name world
		 * @memberOf me.game
		 */
		api.world = null;


		/**
		 * when true, all objects will be added under the root world container <br>
		 * when false, a `me.ObjectContainer` object will be created for each corresponding `TMXObjectGroup`
		 * default value : true
		 * @public
		 * @type Boolean
		 * @name mergeGroup
		 * @memberOf me.game
		 */
		api.mergeGroup = true;

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
		 * @param {Number} [width="full size of the created canvas"] width of the canvas
		 * @param {Number} [height="full size of the created canvas"] width of the canvas
		 * init function.
		 */
		api.init = function(width, height) {
			if (!initialized) {
				// if no parameter specified use the system size
				width  = width  || me.video.getWidth();
				height = height || me.video.getHeight();

				// create a defaut viewport of the same size
				api.viewport = new me.Viewport(0, 0, width, height);

				//the root object of our world is an entity container
				api.world = new me.ObjectContainer(0,0, width, height);
				// give it a name
				api.world.name = 'rootContainer';

				// get a ref to the screen buffer
				frameBuffer = me.video.getSystemContext();

				// publish init notification
				me.event.publish(me.event.GAME_INIT);

                // translate global pointer events
                me.input.translatePointerEvents();

				// make display dirty by default
				isDirty = true;

				// set as initialized
				initialized = true;
			}
		};

		/**
		 * reset the game Object manager<p>
		 * destroy all current objects
		 * @name reset
		 * @memberOf me.game
		 * @public
		 * @function
		 */
		api.reset = function() {
			// remove all objects
			api.world.destroy();

			// reset the viewport to zero ?
			if (api.viewport) {
				api.viewport.reset();
			}

			// dummy current level
			api.currentLevel = {pos:{x:0,y:0}};

			// reset the frame counter
			frameCounter = 0;
			frameRate = Math.round(60/me.sys.fps);
		};
	
		/**
		 * Returns the parent container of the specified Child in the game world
		 * @name getParentContainer
		 * @memberOf me.game
		 * @function
		 * @param {me.Renderable} child
		 * @return {me.ObjectContainer}
		 */
		api.getParentContainer = function(child) {
			return child.ancestor;
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
         * @param {Number} time current timestamp as provided by the RAF callback
		 */
		api.update = function(time) {
			// handle frame skipping if required
			if ((++frameCounter%frameRate)===0) {
				// reset the frame counter
				frameCounter = 0;
				
				// update the timer
				me.timer.update(time);

				// update all objects (andd pass the elapsed time since last frame)
				isDirty = api.world.update(me.timer.getDelta()) || isDirty;
			
				// update the camera/viewport
				isDirty = api.viewport.update(isDirty) || isDirty;
			}
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
				var translateX = api.viewport.pos.x + ~~api.viewport.offset.x;
				var translateY = api.viewport.pos.y + ~~api.viewport.offset.y;
							
				// translate the world coordinates by default to screen coordinates
				api.world.transform.translate(-translateX, -translateY);
				
				// substract the map offset to current the current pos
				api.viewport.screenX = translateX - api.currentLevel.pos.x;
				api.viewport.screenY = translateY - api.currentLevel.pos.y;

				// update all objects, 
				// specifying the viewport as the rectangle area to redraw
				api.world.draw(frameBuffer, api.viewport);
                
                // translate back
				api.world.transform.translate(translateX, translateY);

                // draw our camera/viewport
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
