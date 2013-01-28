/**
 * @license MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
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
var me = me || {};

(function($) {
	// Use the correct document accordingly to window argument
	var document = $.document;

	/**
	 * me global references
	 * @namespace
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
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		ua : navigator.userAgent.toLowerCase(),
		/**
		 * Browser Audio capabilities (read-only) <br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		sound : false,
		/**
		 * Browser Local Storage capabilities (read-only) <br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		localStorage : (typeof($.localStorage) == 'object'),
		/**
		 * Browser Gyroscopic Motion Event capabilities (read-only) <br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		gyro : ($.DeviceMotionEvent !== undefined),

		/**
		 * Browser Base64 decoding capability (read-only) <br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		nativeBase64 : (typeof($.atob) == 'function'),

		/**
		 * Touch capabilities <br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		touch : false,


		// Global settings
		/**
		 * Game FPS (default 60)
		 * @type {Int}
		 * @memberOf me.sys
		 */
		fps : 60,

		/**
		 * enable/disable frame interpolation (default disable)<br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		interpolation : false,

		/**
		 * Global scaling factor(default 1.0)
		 * @type {me.Vector2d}
		 * @memberOf me.sys
		 */
		scale : null, //initialized by me.video.init
 	
		/**
		 * Global gravity settings <br>
		 * will override entities init value if defined<br>
		 * default value : undefined
		 * @type {Number}
		 * @memberOf me.sys
		 */
		gravity : undefined,

		/**
		 * Use native "requestAnimFrame" function if supported <br>
		 * fallback to clearInterval if not supported by the browser<br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		useNativeAnimFrame : false,

		/**
		 * cache Image using a Canvas element, instead of directly using the Image Object<br>
		 * using this, performances are lower on OSX desktop (others, including mobile untested)<br>
		 * default value : false
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		cacheImage : false,

		/**
		 * Enable dirtyRegion Feature <br>
		 * default value : false<br>
		 * (!) not fully implemented/supported (!)
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		dirtyRegion : false,

		/**
		 * Specify either to stop on audio loading error or not<br>
		 * if me.debug.stopOnAudioLoad is true, melonJS will throw an exception and stop loading<br>
		 * if me.debug.stopOnAudioLoad is false, melonJS will disable sounds and output a warning message in the console <br>
		 * default value : true<br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		stopOnAudioError : true,

		/**
		 * Specify either to pause the game when losing focus or not<br>
		 * default value : true<br>
		 * @type {Boolean}
		 * @memberOf me.sys
		 */
		pauseOnBlur : true,

		/**
		 * Specify the rendering method for layers <br>
		 * if false, visible part of the layers are rendered dynamically (default)<br>
		 * if true, the entire layers are first rendered into an offscreen canvas<br>
		 * the "best" rendering method depends of your game<br>
		 * (amount of layer, layer size, amount of tiles per layer, etc…)<br>
		 * note : rendering method is also configurable per layer by adding this property to your layer (in Tiled)<br>
		 * @type {Boolean}
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
			if (document.removeEventListener)
				document.removeEventListener("DOMContentLoaded", domReady, false);
			else
				$.removeEventListener("load", domReady, false);

			// Remember that the DOM is ready
			isReady = true;

			// execute the defined callback
			for ( var fn = 0; fn < readyList.length; fn++) {
				readyList[fn].call($, []);
			}
			readyList.length = 0;
		}
	}
	;

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
	;

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

	/*---

	 	some "Javascript API" patch & enhancement

						---*/

	var initializing = false,
		fnTest = /xyz/.test(function() {/**@nosideeffects*/xyz;}) ? /\bparent\b/ : /.*/;

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
			proto[name] = typeof prop[name] == "function"
					&& typeof parent[name] == "function"
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

	if (!Function.bind) {
		/**
		 * Binds this function to the given context by wrapping it in another function and returning the wrapper.<p>
		 * Whenever the resulting "bound" function is called, it will call the original ensuring that this is set to context. <p>
		 * Also optionally curries arguments for the function.
		 * @param {Object} context the object to bind to.
		 * @param {Array.<string>} [args] Optional additional arguments to curry for the function.
		 * @example
		 * // Ensure that our callback is triggered with the right object context (this):
		 * myObject.onComplete(this.callback.bind(this));
		 */
		Function.prototype.bind = function() {
			var fn = this, args = Array.prototype.slice.call(arguments), object = args.shift();
			return function() {
				return fn.apply(object, args.concat(Array.prototype.slice.call(arguments)));
			};
		};
	};
	
	
	if (typeof Date.now === "undefined") {
		/**
		 * provide a replacement for browser not
		 * supporting Date.now (JS 1.5)
		 * @private
		 */
		Date.now = function(){return new Date().getTime()};
	}

	if(typeof console === "undefined") {
		/**
		 * Dummy console.log to avoid crash
		 * in case the browser does not support it
		 * @private
		 */
		console = {
			log: function() {},
			info: function() {},
			error: function() {alert(Array.prototype.slice.call(arguments).join(", "));}
		};
	}

	/**
	 * Executes a function as soon as the interpreter is idle (stack empty).
	 * @returns id that can be used to clear the deferred function using clearTimeout
	 * @example
	 *
	 *   // execute myFunc() when the stack is empty, with 'myArgument' as parameter
	 *   myFunc.defer('myArgument');
	 *
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


	if(!String.prototype.trim) {  
		/**
		 * returns the string stripped of whitespace from both ends
		 * @extends String
		 * @return {String} trimmed string
		 */
		String.prototype.trim = function () {  
			return (this.replace(/^\s+/, '')).replace(/\s+$/, ''); 
		};  
	}; 
	
	/**
	 * add isNumeric fn to the string object
	 * @extends String
	 * @return {Boolean} true if string contains only digits
	 */
	String.prototype.isNumeric = function() {
		return (this != null && !isNaN(this) && this.trim() != "");
	};

	/**
	 * add a isBoolean fn to the string object
	 * @extends String
	 * @return {Boolean} true if the string is either true or false
	 */
	String.prototype.isBoolean = function() {
		return (this != null && ("true" == this.trim() || "false" == this
				.trim()));
	};

	/**
	 * add a contains fn to the string object
	 * @extends String
	 * @return {Boolean}
	 */
	String.prototype.contains = function(word) {
		return this.indexOf(word) > -1;
	};

	/**
	 * convert the string to hex value
	 * @extends String
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
	 * add a clamp fn to the Number object
	 * @extends Number
	 * @return {Number} clamped value
	 */
	Number.prototype.clamp = function(low, high) {
		return this < low ? low : this > high ? high : +this;
	};

	/**
	 * return a random between min, max
	 * @param {Number} min minimum value.
	 * @param {Number} max maximum value.
	 * @extends Number
	 * @return {Number} random value
	 */
	Number.prototype.random = function(min, max) {
		return (~~(Math.random() * (max - min + 1)) + min);
	};

	/**
	 * round a value to the specified number of digit
	 * @param {Number} [num="Object value"] value to be rounded.
	 * @param {Number} dec number of decimal digit to be rounded to.
	 * @extends Number
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
	 * @extends Number
	 * @return {String} converted hexadecimal value
	 */
	Number.prototype.toHex = function() {
		return "0123456789ABCDEF".charAt((this - this % 16) >> 4)
				+ "0123456789ABCDEF".charAt(this % 16);
	};

	/**
	 * Returns a value indicating the sign of a number<br>
	 * @extends Number
	 * @return {Number} sign of a the number
	 */
	Number.prototype.sign = function() {
		return this < 0 ? -1 : (this > 0 ? 1 : 0);
	};

	/**
	 * Converts an angle in degrees to an angle in radians
	 * @param {Number} [angle="angle"] angle in degrees
	 * @extends Number
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
	 * @param {Number} [angle="angle"] angle in radians
	 * @extends Number
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
	 * Remove the specified object from the Array<br>
	 * @param {Object} object to be removed
	 * @extends Array
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
		 * @private
		 */
		Array.prototype.forEach = function (callback, scope) {
			for (var i = 0, j = this.length; j--; i++) {
				callback.call(scope || this, this[i], i, this);
			}
		};
	}
	/************************************************************************************/

	/**
	 * a basic TMX/TSX Parser
	 * @class
	 * @constructor
	 * @ignore
	 **/
	function _TinyTMXParser() {
		var parserObj = {
			tmxDoc : null,
			isJSON : false,

			// parse a TMX/TSX from a string (xmlhttpObj.responseText)
			parseFromString : function(data, isJSON) {
				this.isJSON = isJSON || false;
				
				if (this.isJSON) {
					this.tmxDoc = JSON.parse(data);
					// this won't work !
				} else {
					// get a reference to the requested corresponding xml file
					if ($.DOMParser) {
						var parser = new DOMParser();
						this.tmxDoc = parser.parseFromString(data, "text/xml");
					} else // Internet Explorer (untested!)
					{
						this.tmxDoc = new ActiveXObject("Microsoft.XMLDOM");
						this.tmxDoc.async = "false";
						this.tmxDoc.loadXML(data);
					}
					if (this.tmxDoc == null) {
						console.log("tmx/tsx " + this.tmxDoc + " not found!");
					}
				}
			},

			getFirstElementByTagName : function(name) {
				return this.tmxDoc ? this.tmxDoc.getElementsByTagName(name)[0] : null;
			},

			getAllTagElements : function() {
				return this.tmxDoc ? this.tmxDoc.getElementsByTagName('*') : null;
			},

			getStringAttribute : function(elt, str, val) {
				var ret = elt.getAttribute(str);
				return ret ? ret.trim() : val;
			},

			getIntAttribute : function(elt, str, val) {
				var ret = this.getStringAttribute(elt, str, val);
				return ret ? parseInt(ret) : val;
			},

			getFloatAttribute : function(elt, str, val) {
				var ret = this.getStringAttribute(elt, str, val);
				return ret ? parseFloat(ret) : val;
			},

			getBooleanAttribute : function(elt, str, val) {
				var ret = this.getStringAttribute(elt, str, val);
				return ret ? (ret == "true") : val;
			},

			// free the allocated parser
			free : function() {
				this.tmxDoc = null;
			}
		}
		return parserObj;
	}
	;
	/************************************************************************************/

	/************************************************************************************/

	Object.defineProperty(me, "initialized", {
		get : function get() {
			return me_initialized;
		}
	});

	/*---
	 	ME init stuff
						---*/

	function _init_ME() {
		// don't do anything if already initialized (should not happen anyway)
		if (me_initialized)
			return;

		// enable/disable the cache
		me.utils.setNocache(document.location.href.match(/\?nocache/)||false);
	
		// detect audio capabilities
		me.audio.detectCapabilities();
		
		// detect touch capabilities
		me.sys.touch = ('createTouch' in document) || ('ontouchstart' in $) || (navigator.isCocoonJS);

		// init the FPS counter if needed
		me.timer.init();

		// create an instance of the TMX parser
		me.TMXParser = new _TinyTMXParser();

		// create a default loading screen
		me.loadingScreen = new me.DefaultLoadingScreen();

		// init the App Manager
		me.state.init();

		// init the Entity Pool
		me.entityPool.init();

		// init the level Director
		me.levelDirector.reset();

		me_initialized = true;

	};

	/******************************************/
	/*		OBJECT DRAWING MANAGEMENT           */
	/*		hold & manage app/game objects		*/
	/******************************************/

	/**
	 * a object drawing manager
	 * only used by the game manager
	 * @ignore
	 */
	var drawManager = (function() {
		// hold public stuff in our singletong
		var api = {};

		// list of region to redraw
		// valid for any updated object
		var dirtyRects = [];

		// cache the full screen area rect
		var fullscreen_rect;

		// list of object to redraw
		// only valid for visible and update object
		var dirtyObjects = [];
		
		var drawCount = 0;

		// a flag indicating if we need a redraw
		api.isDirty = false;

		/**
		 * init function
		 */
		api.reset = function() {
			// make sure it's empty
			dirtyRects.length = 0;
			dirtyObjects.length = 0;

			// set our cached rect to the actual screen size
			fullscreen_rect = me.game.viewport.getRect();

			// make everything dirty
			api.makeAllDirty();
		};

		/**
		 * add a dirty object
		 * I should find a cleaner way to manage old/new object rect
		 */
		api.makeDirty = function(obj, updated, oldRect) {
			// object updated ?
			if (updated) {
				// yeah some drawing job to do !
				api.isDirty = true;

				// add a dirty rect if feature enable
				if (me.sys.dirtyRegion) {
					// some stuff to optimiwze the amount
					// of dirty rect would be nice here
					// instead of adding everything :)
					// this is for later I guess !
					if (oldRect) {
						// merge both rect, and add it to the list
						// directly pass object, since anyway it inherits from rect
						dirtyRects.push(oldRect.union(obj));
					} else if (obj.getRect) {
						dirtyRects.push(obj.getRect());
					}
				}
			}

			// if obj is in the viewport add it to the list of obj to draw
			if (obj.inViewport) {
				// add obj at index 0, so that we can keep
				// our inverted loop later
				dirtyObjects.unshift(obj);
			}
		};

		/**
		 * make all object dirty
		 */
		api.makeAllDirty = function() {
			//empty the dirty rect list
			dirtyRects.length = 0;
			//and add a dirty region with the screen area size
			dirtyRects.push(fullscreen_rect);
			// make sure it's dirty
			api.isDirty = true;
			// they are maybe too much call to this function
			// to be checked later...
			//console.log("making everything dirty!");
		};

		/**
		 * remove an object
		 */
		api.remove = function(obj) {
			var idx = dirtyObjects.indexOf(obj);
			if (idx != -1) {
				// remove the object from the list of obj to draw
				dirtyObjects.splice(idx, 1);

				// mark the object as not within the viewport
				// so it won't be added (again) in the list object to be draw
				obj.inViewport = false;

				// and flag the area as dirty
				api.makeDirty(obj, true);
			}
 		};

		/**
		 * return the amount of draw object per frame
		 */
		api.getDrawCount = function() {
			return drawCount;
 		};

		/**
		 * draw all dirty objects/regions
		 */
		api.draw = function(context) {
			// cache viewport position vector
			var posx = me.game.viewport.pos.x;
			var posy = me.game.viewport.pos.y;
						
			// save the current context
			context.save();
			// translate by default to screen coordinates
			context.translate(-posx, -posy)
			
			// substract the map offset to current the current pos
			posx -= me.game.currentLevel.pos.x;
			posy -= me.game.currentLevel.pos.y;
			
			// if feature disable, we only have one dirty rect (the viewport area)
			for ( var r = dirtyRects.length, rect; r--, rect = dirtyRects[r];) {
				// parse all objects
				for ( var o = dirtyObjects.length, obj; o--, obj = dirtyObjects[o];) {
					// if dirty region enabled, make sure the object is in the area to be refreshed
					if (me.sys.dirtyRegion && obj.isSprite && !obj.overlaps(rect)) {
						continue;
					}

					if (obj.floating===true) {
						context.save();
						// cancel the previous translate
						context.translate(posx, posy);
					}

					// draw the object using the dirty area to be updated
					obj.draw(context, rect);

					if (obj.floating===true) {
						context.restore();
					}

					drawCount++;
				}
				// some debug stuff
				if (me.debug.renderDirty) {
					rect.draw(context, "white");
				}
			}
			
			// restore initial context
			context.restore();
		};

		/**
		 * flush all rect
		 */
		api.flush = function() {
			// only empty dirty area list if dirtyRec feature is enable
			// allows to keep the viewport area as a default dirty rect
			if (me.sys.dirtyRegion) {
				dirtyRects.length = 0;
			}
			// empty the dirty object list
			dirtyObjects.length = 0;

			// clear the flag
			api.isDirty = false;

			// reset draw count for debug panel
			drawCount = 0;
		};

		return api;

	})();

	/**
	 * me.game represents your current game, it contains all the objects, tilemap layers,<br>
	 * HUD information, current viewport, collision map, etc..<br>
	 * me.game is also responsible for updating (each frame) the object status and draw them<br>
	 * There is no constructor function for me.game.
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.game = (function() {
		// hold public stuff in our singletong
		var api = {};

		/*---------------------------------------------

			PRIVATE STUFF

			---------------------------------------------*/

		// ref to the "system" context
		var frameBuffer = null;

		// hold all the objects
		var gameObjects = [];

		// flag to redraw the sprites
		var initialized = false;

		// to keep track of deferred stuff
		var pendingRemove = null;
		var pendingSort = null;
		
		/**
		 * a default sort function
		 * @private
		 */
		var default_sort_func = function(a, b) {
			// sort order is inverted,
			// since we use a reverse loop for the display
			return (b.z - a.z);
		};

		/*---------------------------------------------

			PUBLIC STUFF

			---------------------------------------------*/
		/**
		 * a reference to the game viewport.
		 * @public
		 * @type me.Viewport
		 * @name me.game#viewport
		 */
		api.viewport = null;
		/**
		 * a reference to the game HUD (if defined).
		 * @public
		 * @type me.HUD_Object
		 * @name me.game#HUD
		 */
		api.HUD = null;
		/**
		 * a reference to the game collision Map
		 * @public
		 * @type me.TiledLayer
		 * @name me.game#collisionMap
		 */
		api.collisionMap = null;
		/**
		 * a reference to the game current level
		 * @public
		 * @type me.TMXTileMap
		 * @name me.game#currentLevel
		 */
		api.currentLevel = null;

		// FIX ME : put this somewhere else
		api.NO_OBJECT = 0;

		/**
		 * Default object type constant.<br>
		 * See type property of the returned collision vector.
		 * @constant
		 * @name me.game#ENEMY_OBJECT
		 */
		api.ENEMY_OBJECT = 1;

		/**
		 * Default object type constant.<br>
		 * See type property of the returned collision vector.
		 * @constant
		 * @name me.game#COLLECTABLE_OBJECT
		 */
		api.COLLECTABLE_OBJECT = 2;

		/**
		 * Default object type constant.<br>
		 * See type property of the returned collision vector.
		 * @constant
		 * @name me.game#ACTION_OBJECT
		 */
		api.ACTION_OBJECT = 3; // door, etc...

		/**
		 * Fired when a level is fully loaded and <br>
		 * and all entities instantiated. <br>
		 * Additionnaly the level id will also be passed
		 * to the called function.
		 * @public
		 * @type function
		 * @name me.game#onLevelLoaded
		 * @example
		 * call myFunction() everytime a level is loaded
		 * me.game.onLevelLoaded = this.myFunction.bind(this);
		 */
		 api.onLevelLoaded = null;

		/**
		 * Initialize the game manager
		 * @name me.game#init
		 * @private
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

				// get a ref to the screen buffer
				frameBuffer = me.video.getSystemContext();

				// publish init notification
				me.event.publish(me.event.GAME_INIT);

				initialized = true;
			}
		};

		/**
		 * reset the game Object manager<p>
		 * destroy all current object except the HUD
		 * @see me.game#disableHUD
		 * @name me.game#reset
		 * @public
		 * @function
		 */
		api.reset = function() {

			// initialized the object if not yet done
			if (!initialized)
				api.init();

			// remove all objects
			api.removeAll();

			// reset the viewport to zero ?
			if (api.viewport)
				api.viewport.reset();

			// also reset the draw manager
			drawManager.reset();

			// reset the transform matrix to the normal one
			frameBuffer.setTransform(1, 0, 0, 1, 0, 0);

			// dummy current level
			api.currentLevel = {pos:{x:0,y:0}};
		};
	
		/**
		 * Load a TMX level
		 * @name me.game#loadTMXLevel
		 * @private
		 * @function
		 */

		api.loadTMXLevel = function(level) {
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
			};

			// change the viewport limit
			api.viewport.setBounds(Math.max(api.currentLevel.realwidth, api.viewport.width),
								   Math.max(api.currentLevel.realheight, api.viewport.height));

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
			if (api.currentLevel.pos.x != api.currentLevel.pos.y) {
				// translate the display accordingly
				frameBuffer.translate( api.currentLevel.pos.x , api.currentLevel.pos.y );
			}

			// sort all our stuff !!
			api.sort();

			// fire the callback if defined
			if (api.onLevelLoaded) {
				api.onLevelLoaded.call(api.onLevelLoaded, level.name)
			}
			//publish the corresponding message
			me.event.publish(me.event.LEVEL_LOADED, [level.name]);

		};

		/**
		 * Manually add object to the game manager
		 * @name me.game#add
		 * @param {me.ObjectEntity} obj Object to be added
		 * @param {int} [z="obj.z"] z index
		 * @public
		 * @function
		 * @example
		 * // create a new object
		 * var obj = new MyObject(x, y)
		 * // add the object and give the z index of the current object
		 * me.game.add(obj, this.z);
		 * // sort the object list (to ensure the object is properly displayed)
		 * me.game.sort();
		 */
		api.add = function(object, zOrder) {
			object.z = (zOrder) ? zOrder : object.z;

			// add the object in the game obj list
			gameObjects.push(object);

		};

		/**
		 * add an entity to the game manager
		 * @name me.game#addEntity
		 * @private
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
		 * @name me.game#getEntityByName
		 * @public
		 * @function
		 * @param {String} entityName entity name
		 * @return {me.ObjectEntity[]} Array of object entities
		 */
		api.getEntityByName = function(entityName)
		{
			var objList = [];
			entityName = entityName.toLowerCase();
			for (var i = gameObjects.length, obj; i--, obj = gameObjects[i];) {
				if(obj.name && obj.name.toLowerCase() === entityName) {
					objList.push(obj);
				}
			}
			return objList;
		};

		/**
		 * returns the amount of existing objects<br>
		 * @name me.game#getObjectCount
		 * @protected
		 * @function
		 * @return {Number} the amount of object
		 */
		api.getObjectCount = function()
		{
			return gameObjects.length;
		};

		/**
		 * returns the amount of object being drawn per frame<br>
		 * @name me.game#getDrawCount
		 * @protected
		 * @function
		 * @return {Number} the amount of object draws
		 */
		api.getDrawCount = function()
		{
			return drawManager.getDrawCount();
		};

		
		/**
		 * return the entity corresponding to the specified GUID<br>
		 * note : avoid calling this function every frame since
		 * it parses the whole object list each time
		 * @name me.game#getEntityByGUID
		 * @public
		 * @function
		 * @param {String} GUID entity GUID
		 * @return {me.ObjectEntity} Object Entity (or null if not found)
		 */
		api.getEntityByGUID = function(guid)
		{
			for (var i = gameObjects.length, obj; i--, obj = gameObjects[i];) {
				if(obj.isEntity && obj.GUID == guid) {
					return obj;
				}
			}
			return null;
		};

		/**
		 * add a HUD obj to the game manager
		 * @name me.game#addHUD
		 * @public
		 * @function
		 * @param {int} x x position of the HUD
		 * @param {int} y y position of the HUD
		 * @param {int} w width of the HUD
		 * @param {int} h height of the HUD
		 * @param {String} [bg="none"] a CSS string specifying the background color (e.g. "#0000ff" or "rgb(0,0,255)")
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
		 * @name me.game#disableHUD
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
		 * update all objects of the game manager
		 * @name me.game#update
		 * @private
		 * @function
		 */
		api.update = function() {
			
			// previous rect (if any)
			var oldRect = null;
			// loop through our objects
			for ( var i = gameObjects.length, obj; i--, obj = gameObjects[i];) {
				// check for previous rect before position change
				oldRect = (me.sys.dirtyRegion && obj.isSprite) ? obj.getRect() : null;

				// update our object
				var updated = obj.update();

				// check if object is visible
				if (obj.visible) {
					obj.inViewport = (!obj.isSprite || obj.floating) ? true : api.viewport.isVisible(obj);
				}
				else {
					obj.inViewport = false;
				}

				// add it to the draw manager
				drawManager.makeDirty(obj, updated, updated ? oldRect : null);
			}
			// update the camera/viewport
			if (api.viewport.update(drawManager.isDirty)) {
				drawManager.makeAllDirty();
			}
			
		};
		
		
		/**
		 * remove an object
		 * @name me.game#remove
		 * @public
		 * @function
		 * @param {me.ObjectEntity} obj Object to be removed
		 * @param {Boolean} force force immediate deletion
		 */
		api.remove = function(obj, force) {
			
			// notify the object it will be destroyed
			if (obj.destroy) {
				obj.destroy();
			}
			
			// remove the object from the object to draw
			drawManager.remove(obj);
			
			// remove the object from the object list
			if (force===true) {
				// force immediate object deletion
				gameObjects.remove(obj);
				me.entityPool.freeInstance(obj);
			} else {
				// make it invisible (this is bad...)
				obj.visible = false
				// else wait the end of the current loop
				/** @private */
				pendingRemove = (function (obj) {
					gameObjects.remove(obj);
					me.entityPool.freeInstance(obj);
					pendingRemove = null;
				}).defer(obj);
			}
		};

		/**
		 * remove all objects
		 * @name me.game#removeAll
		 * @public
		 * @function
		 */
		api.removeAll = function() {
			//cancel any pending tasks
			if (pendingRemove) {
				clearTimeout(pendingRemove);
				pendingRemove = null;
			}
			if (pendingSort) {
				clearTimeout(pendingSort);
				pendingSort = null;
			}
			
			// inform all object they are about to be deleted
			for (var i = gameObjects.length ; i-- ;) {
				if (gameObjects[i].isPersistent) {
                   // don't remove persistent objects
				   continue;
				}
				// remove the entity
				api.remove(gameObjects[i], true);
			}
			// make sure it's empty there as well
			drawManager.flush();
		};

		/**
		 * <p>Sort all the game objects.</p>
		 * <p>Normally all objects loaded through the LevelDirector are automatically sorted.
		 * this function is however usefull if you create and add object during the game,
		 * or need a specific sorting algorithm.<p>
		 * @name me.game#sort
		 * @public
		 * @function
		 * @param {Function} [sort_func="sorted on z property value"] sort function
		 * @example
		 * // user defined sort funtion (Z sort based on Y value)
		 * function mySort(a, b) {
		 *    var result = (b.z - a.z);
		 *    return (result ? result : ((b.pos && b.pos.y) - (a.pos && a.pos.y)) || 0);
		 * } </p>
		 * // call me.game.sort with our sorting function
		 * me.game.sort(mySort);
		 */

		api.sort = function(sort_func) {
			// do nothing if there is already 
			// a previous pending sort
			if (pendingSort === null) {
				// use the default sort function if
				// the specified one is not valid
				if (typeof(sort_func) !== "function") {
					sort_func = default_sort_func;
				}
				pendingSort = (function (sort_func) {
					// sort everything
					gameObjects.sort(sort_func);
					// clear the defer id
					pendingSort = null;
					// make sure we redraw everything
					me.game.repaint();
				}).defer(sort_func);
			};
		};

		/**
		 * Checks if the specified entity collides with others entities.
		 * @name me.game#collide
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
			var res;
			// make sure we have a boolean
			multiple = multiple===true ? true : false;
			if (multiple===true) {
				var mres = [], r = 0;
			} 
			// this should be replace by a list of the 4 adjacent cell around the object requesting collision
			for ( var i = gameObjects.length, obj; i--, obj = gameObjects[i];)//for (var i = objlist.length; i-- ;)
			{
				if (obj.inViewport && obj.visible && obj.collidable && (obj!=objA))
				{
					res = obj.collisionBox.collideVsAABB.call(obj.collisionBox, objA.collisionBox);
					if (res.x != 0 || res.y != 0) {
						// notify the object
						obj.onCollision.call(obj, res, objA);
						// return the type (deprecated)
						res.type = obj.type;
						// return a reference of the colliding object
						res.obj  = obj;
						// stop here if we don't look for multiple collision detection
						if (!multiple) {
							return res;
						}
						mres[r++] = res;
					}
				}
			}
			return multiple?mres:null;
		};

		/**
		 * Checks if the specified entity collides with others entities of the specified type.
		 * @name me.game#collideType
		 * @public
		 * @function
		 * @param {me.ObjectEntity} obj Object to be tested for collision
		 * @param {String} type Entity type to be tested for collision
		 * @param {Boolean} [multiple=false] check for multiple collision
		 * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
		 */
		api.collideType = function(objA, type, multiple) {
			var res;
			// make sure we have a boolean
			multiple = multiple===true ? true : false;
			if (multiple===true) {
				var mres = [], r = 0;
			} 
			// this should be replace by a list of the 4 adjacent cell around the object requesting collision
			for ( var i = gameObjects.length, obj; i--, obj = gameObjects[i];)//for (var i = objlist.length; i-- ;)
			{
				if (obj.inViewport && obj.visible && obj.collidable && (obj.type === type) && (obj!=objA))
				{
					res = obj.collisionBox.collideVsAABB.call(obj.collisionBox, objA.collisionBox);
					if (res.x != 0 || res.y != 0) {
						// notify the object
						obj.onCollision.call(obj, res, objA);
						// return the type (deprecated)
						res.type = obj.type;
						// return a reference of the colliding object
						res.obj  = obj;
						// stop here if we don't look for multiple collision detection
						if (!multiple) {
							return res;
						}
						mres[r++] = res;
					}
				}
			}
			return multiple?mres:null;
		};

		/**
		 * force the redraw (not update) of all objects
		 * @name me.game#repaint
		 * @public
		 * @function
		 */

		api.repaint = function() {
			drawManager.makeAllDirty();
		};

		/**
		 * draw all existing objects
		 * @name me.game#draw
		 * @private
		 * @function
		 */

		api.draw = function() {
			if (drawManager.isDirty) {
				// draw our objects
				drawManager.draw(frameBuffer);

				// call the viewport draw function (for effects)
				api.viewport.draw(frameBuffer)
			}
			// clean everything for next frame
			drawManager.flush();
		};

		// return our object
		return api;

	})();

	/************************************************************************************/
	/*      Screen Object Type                                                          */
	/*      Used by the App Manager                                                     */
	/************************************************************************************/

	/* -----

		Screen object object

		------	*/
	/**
	 * A class skeleton for "Screen" Object <br>
	 * every "screen" object (title screen, credits, ingame, etc...) to be managed <br>
	 * through the state manager must inherit from this base class.
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @see me.state
	 * @example
	 * // create a custom loading screen
	 * var CustomLoadingScreen = me.ScreenObject.extend(
	 * {
	 *    // constructor
	 *    init: function()
	 *    {
	 *       // pass true to the parent constructor
	 *       // as we draw our progress bar in the draw function
	 *       this.parent(true);
	 *       // a font logo
	 *       this.logo = new me.Font('century gothic', 32, 'white');
	 *       // flag to know if we need to refresh the display
	 *       this.invalidate = false;
	 *       // load progress in percent
	 *       this.loadPercent = 0;
	 *       // setup a callback
	 *       me.loader.onProgress = this.onProgressUpdate.bind(this);
	 *
	 *    },
	 *
	 *    // will be fired by the loader each time a resource is loaded
	 *    onProgressUpdate: function(progress)
	 *    {
	 *       this.loadPercent = progress;
	 *       this.invalidate = true;
	 *    },
	 *
	 *
	 *    // make sure the screen is only refreshed on load progress
	 *    update: function()
	 *    {
	 *       if (this.invalidate===true)
	 *       {
	 *          // clear the flag
	 *          this.invalidate = false;
	 *          // and return true
	 *          return true;
	 *       }
	 *       // else return false
	 *       return false;
	 *    },
	 *
	 *    // on destroy event
	 *    onDestroyEvent : function ()
	 *    {
	 *       // "nullify" all fonts
	 *       this.logo = null;
	 *    },
	 *
	 *    //	draw function
	 *    draw : function(context)
	 *    {
	 *       // clear the screen
	 *       me.video.clearSurface (context, "black");
	 *
	 *       // measure the logo size
	 *       logo_width = this.logo.measureText(context,"awesome loading screen").width;
	 *
	 *       // draw our text somewhere in the middle
	 *       this.logo.draw(context,
	 *                      "awesome loading screen",
	 *                      ((me.video.getWidth() - logo_width) / 2),
	 *                      (me.video.getHeight() + 60) / 2);
	 *
	 *       // display a progressive loading bar
	 *       var width = Math.floor(this.loadPercent * me.video.getWidth());
	 *
	 *       // draw the progress bar
	 *       context.strokeStyle = "silver";
	 *       context.strokeRect(0, (me.video.getHeight() / 2) + 40, me.video.getWidth(), 6);
	 *       context.fillStyle = "#89b002";
	 *       context.fillRect(2, (me.video.getHeight() / 2) + 42, width-4, 2);
	 *    },
	 * });
	 *
	 */
	me.ScreenObject = Object.extend(
	/** @scope me.ScreenObject.prototype */
	{

		inViewport		: false,
		visible			: false,
		addAsObject		: false,
		isPersistent	: false,
		z				: 999,
		rect			: null,

		/**
		 *	initialization function
		 * @param {Boolean} [addAsObjet] add the object in the game manager object pool<br>
		 * @param {Boolean} [isPersistent] isPersistent make the screen persistent overt level changes<br>
		 * allowing to override the update & draw function to add specific treatment.
		 */

		init : function(addAsObject, isPersistent) {
			this.addAsObject = this.visible = (addAsObject === true) || false;
			this.isPersistent = (this.visible && (isPersistent === true)) || false;
			this.rect = new me.Rect(new me.Vector2d(0, 0), 0, 0);
		},

		/**
		 *	Object reset function
		 * @private
		 */
		reset : function() {

			// reset the game manager
			me.game.reset();

			// call the onReset Function
			this.onResetEvent.apply(this, arguments);

			// add our object to the GameObject Manager
			// allowing to benefit from the keyboard event stuff
			if (this.addAsObject) {
				// make sure we are visible upon reset
				this.visible = true;
				// update the rect size if added as an object
				this.rect = me.game.viewport.getRect();
				// add ourself !
				me.game.add(this, this.z);
			}
			
			// sort the object pool
			me.game.sort();

		},

		/**
		 * getRect function
		 * @private
		 */
		getRect : function() {
			return this.rect;
		},

		/**
		 * destroy function
		 * @private
		 */
		destroy : function() {
			// notify the object
			this.onDestroyEvent.apply(this, arguments);
		},

		/**
		 * update function<br>
		 * optional empty function<br>
		 * only used by the engine if the object has been initialized using addAsObject parameter set to true<br>
		 * @example
		 * // define a Title Screen
		 * var TitleScreen = me.ScreenObject.extend(
		 * {
		 *    // override the default constructor
		 *    init : function()
		 *    {
		 *       //call the parent constructor giving true
		 *       //as parameter, so that we use the update & draw functions
		 *       this.parent(true);
		 *       ...
		 *       ...
		 *     },
		 *     ...
		 * });
		 */
		update : function() {
			return false;
		},

		/**
		 *	frame update function function
		 * @private
		 */
		onUpdateFrame : function() {
			// update the frame counter
			me.timer.update();

			// update all games object
			me.game.update();

			// draw the game objects
			me.game.draw();

			// blit our frame
			me.video.blitSurface();
		},

		/**
		 *	draw function<br>
		 * optional empty function<br>
		 * only used by the engine if the object has been initialized using addAsObject parameter set to true<br>
		 * @example
		 * // define a Title Screen
		 * var TitleScreen = me.ScreenObject.extend(
		 * {
		 *    // override the default constructor
		 *    init : function()
		 *    {
		 *       //call the parent constructor giving true
		 *       //as parameter, so that we use the update & draw functions
		 *       this.parent(true);
		 *       ...
		 *       ...
		 *     },
		 *     ...
		 * });
		 */
		draw : function() {
			// to be extended
		},

		/**
		 *	onResetEvent function<br>
		 * called by the state manager when reseting the object<br>
		 * this is typically where you will load a level, etc...
		 * to be extended
		 *	@param {String[]} [arguments] optional arguments passed when switching state
		 */
		onResetEvent : function() {
			// to be extended
		},

		/**
		 *	onDestroyEvent function<br>
		 * called by the state manager before switching to another state<br>
		 */
		onDestroyEvent : function() {
			// to be extended
		}

	});


	/************************************************************************************/
	/*      Game State Manager                                                          */
	/*      Manage the basic logic of a game/app                                        */
	/************************************************************************************/
	
	/**
	 * a State Manager (state machine)<p>
	 * There is no constructor function for me.state.
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */

	me.state = (function() {
		
		// list of vendors prefix (note : last modernizr version has
		// a getPrefix function that makes this cleaner and more generic
		var vendors = ['ms', 'moz', 'webkit', 'o'];
		
		// polyfill for RequestAnimationFrame (based on Erik Möller polyfill)
		for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
			window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
			window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
		};
		
		if (!window.requestAnimationFrame) {
			window.requestAnimationFrame = function(callback, element) {
				// TODO : allow to run at a lower rate than 60fps with requestAnimationFrame by skipping frame
				// TODO : integrate setInterval directly here as a fallback
				// (for next version, I plan to review the whole main loop mechanism, so I don't do it now) 
				// in melonJS if this returns -1 clearInterval is used
				return -1;
			};
        };
		
		if (!window.cancelAnimationFrame) {
			window.cancelAnimationFrame = function() {
				return -1;
			};
		};
		
		// hold public stuff in our singleton
		var obj = {};

		/*---------------------------------------------

			PRIVATE STUFF

			---------------------------------------------*/

		// current state
		var _state = -1;
		// SetInterval Id
		var _intervalId = -1;
		// requestAnimeFrame Id
		var _animFrameId = -1;

		// list of screenObject
		var _screenObject = {};

		// fading transition parameters between screen
		var _fade = {
			color : "",
			duration : 0
		};

		// callback when state switch is done
		/** @private */
		var _onSwitchComplete = null;

		// just to keep track of possible extra arguments
		var _extraArgs = null;

		// cache reference to the active screen update frame
		var _activeUpdateFrame = null;

		/**
		 * @ignore
		 */
		function _startRunLoop() {
			// ensure nothing is running first
			if ((_intervalId == -1) && (_animFrameId == -1)) {

				// reset the timer
				me.timer.reset();

				// start the main loop
				if (me.sys.useNativeAnimFrame) {
					// attempt to setup the game loop using requestAnimationFrame
					_animFrameId = window.requestAnimationFrame(_renderFrame);

					if (_animFrameId != -1) {
						return;
					}
					// else feature not supported !

					// disable use of requestAnimationFrame (since unsupported)
					me.sys.useNativeAnimFrame = false;
					//console.log("using setInterval as fallback ("+_animFrameId+")");
				}

				// setup the game loop using setInterval
				_intervalId = setInterval(_activeUpdateFrame, ~~(1000 / me.sys.fps));
			}
		};

		/**
		 * this is only called when using requestAnimFrame stuff
		 * @ignore
		 */
		function _renderFrame() {
			_activeUpdateFrame();
			// we already checked it was supported earlier
			// so no need to do it again here
			_animFrameId = window.requestAnimationFrame(_renderFrame);
		};

		/**
		 * stop the SO main loop
		 * @ignore
		 */
		function _stopRunLoop() {
			// cancel any previous setInterval
			if (_intervalId != -1) {
				clearInterval(_intervalId);
				_intervalId = -1;
			}
			// cancel any previous animationRequestFrame
			if (_animFrameId != -1) {
				window.cancelAnimationFrame(_animFrameId);
				_animFrameId = -1;
			}

		};

		/**
		 * start the SO main loop
		 * @ignore
		 */
		function _switchState(state) {
			// clear previous interval if any
			_stopRunLoop();

			// call the screen object destroy method
			if (_screenObject[_state]) {
				if (_screenObject[_state].screen.visible) {
					// persistent or not, make sure we remove it
					// from the current object list
					me.game.remove.call(me.game, _screenObject[_state].screen, true);
				}
				// notify the object
				_screenObject[_state].screen.destroy();
			}

			if (_screenObject[state])
			{
				// set the global variable
				_state = state;

				// call the reset function with _extraArgs as arguments
				_screenObject[_state].screen.reset.apply(_screenObject[_state].screen, _extraArgs);

				// cache the new screen object update function
				_activeUpdateFrame = _screenObject[_state].screen.onUpdateFrame.bind(_screenObject[_state].screen);

				// and start the main loop of the
				// new requested state
				_startRunLoop();

				// execute callback if defined
				if (_onSwitchComplete) {
					_onSwitchComplete();
				}

				// force repaint
				me.game.repaint();
			 }
		};

		/*---------------------------------------------

			PUBLIC STUFF

			---------------------------------------------*/
		/**
		 * default state value for Loading Screen
		 * @constant
		 * @name me.state#LOADING
		 */
		obj.LOADING = 0;
		/**
		 * default state value for Menu Screen
		 * @constant
		 * @name me.state#MENU
		 */
		obj.MENU = 1;
		/**
		 * default state value for "Ready" Screen
		 * @constant
		 * @name me.state#READY
		 */
		obj.READY = 2;
		/**
		 * default state value for Play Screen
		 * @constant
		 * @name me.state#PLAY
		 */
		obj.PLAY = 3;
		/**
		 * default state value for Game Over Screen
		 * @constant
		 * @name me.state#GAMEOVER
		 */
		obj.GAMEOVER = 4;
		/**
		 * default state value for Game End Screen
		 * @constant
		 * @name me.state#GAME_END
		 */
		obj.GAME_END = 5;
		/**
		 * default state value for High Score Screen
		 * @constant
		 * @name me.state#SCORE
		 */
		obj.SCORE = 6;
		/**
		 * default state value for Credits Screen
		 * @constant
		 * @name me.state#CREDITS
		 */
		obj.CREDITS = 7;
		/**
		 * default state value for Settings Screen
		 * @constant
		 * @name me.state#SETTINGS
		 */
		obj.SETTINGS = 8;
		
		/**
		 * default state value for user defined constants<br>
		 * @constant
		 * @name me.state#USER
		 * @example
		 * var STATE_INFO = me.state.USER + 0;
		 * var STATE_WARN = me.state.USER + 1;
		 * var STATE_ERROR = me.state.USER + 2;
		 * var STATE_CUTSCENE = me.state.USER + 3;
		 */
		obj.USER = 100;

		/**
		 * onPause callback
		 * @type function
		 * @name me.state#onPause
		 */
		obj.onPause = null;

		/**
		 * onResume callback
		 * @type function
		 * @name me.state#onResume
		 */
		obj.onResume = null;

		/**
		 * @ignore
		 */
		obj.init = function() {
			// set the embedded loading screen
			obj.set(obj.LOADING, me.loadingScreen);

			// set pause action on losing focus
			$.addEventListener("blur", function() {
				// only in case we are not loading stuff
				if (me.sys.pauseOnBlur && (_state != obj.LOADING)) {
					obj.pause(true);
				}
				// callback?
				if (obj.onPause)
					obj.onPause();

				// publish the pause notification
				me.event.publish(me.event.STATE_PAUSE);

			}, false);
			// set play action on gaining focus
			$.addEventListener("focus", function() {
				// only in case we are not loading stuff
				if (me.sys.pauseOnBlur && (_state != obj.LOADING)) {
					obj.resume(true);

					// force repaint
					me.game.repaint();
				}
				// callback?
				if (obj.onResume)
					obj.onResume();

				// publish the resume notification
				me.event.publish(me.event.STATE_RESUME);

			}, false);

		};

		/**
		 * pause the current screen object
		 * @name me.state#pause
		 * @public
		 * @function
		 * @param {Boolean} pauseTrack pause current track on screen pause
		 */
		obj.pause = function(music) {
			// stop the main loop
			_stopRunLoop();
			// current music stop
			if (music)
				me.audio.pauseTrack();

		};

		/**
		 * resume the resume screen object
		 * @name me.state#resume
		 * @public
		 * @function
		 * @param {Boolean} resumeTrack resume current track on screen resume
		 */
		obj.resume = function(music) {
			// start the main loop
			_startRunLoop();
			// current music stop
			if (music)
				me.audio.resumeTrack();
		};

		/**
		 * return the running state of the state manager
		 * @name me.state#isRunning
		 * @public
		 * @function
		 * @param {Boolean} true if a "process is running"
		 */
		obj.isRunning = function() {
			return ((_intervalId != -1) || (_animFrameId != -1))
		};

		/**
		 * associate the specified state with a screen object
		 * @name me.state#set
		 * @public
		 * @function
		 * @param {Int} state @see me.state#Constant
		 * @param {me.ScreenObject} so
		 */
		obj.set = function(state, so) {
			_screenObject[state] = {};
			_screenObject[state].screen = so;
			_screenObject[state].transition = true;
		};

		/**
		 * return a reference to the current screen object<br>
		 * useful to call a object specific method
		 * @name me.state#current
		 * @public
		 * @function
		 * @return {me.ScreenObject} so
		 */
		obj.current = function() {
			return _screenObject[_state].screen;
		};

		/**
		 * specify a global transition effect
		 * @name me.state#transition
		 * @public
		 * @function
		 * @param {String} effect (only "fade" is supported for now)
		 * @param {String} color in RGB format (e.g. "#000000")
		 * @param {Int} [duration="1000"] in ms
		 */
		obj.transition = function(effect, color, duration) {
			if (effect == "fade") {
				_fade.color = color;
				_fade.duration = duration;
			}
		};

		/**
		 * enable/disable transition for a specific state (by default enabled for all)
		 * @name me.state#setTransition
		 * @public
		 * @function
		 */

		obj.setTransition = function(state, enable) {
			_screenObject[state].transition = enable;
		};

		/**
		 * change the game/app state
		 * @name me.state#change
		 * @public
		 * @function
		 * @param {Int} state @see me.state#Constant
		 * @param {Arguments} [args] extra arguments to be passed to the reset functions
		 */

		obj.change = function(state) {
			_extraArgs = null;
			if (arguments.length > 1) {
				// store extra arguments if any
				_extraArgs = Array.prototype.slice.call(arguments, 1);
			}
			// if fading effect
			if (_fade.duration && _screenObject[state].transition) {
				/** @private */
				_onSwitchComplete = function() {
					me.game.viewport.fadeOut(_fade.color, _fade.duration);
				};
				me.game.viewport.fadeIn(_fade.color, _fade.duration,
										function() {
											_switchState.defer(state);
										});

			}
			// else just switch without any effects
			else {
				// wait for the last frame to be
				// "finished" before switching
				_switchState.defer(state);

			}
		};

		/**
		 * return true if the specified state is the current one
		 * @name me.state#isCurrent
		 * @public
		 * @function
		 * @param {Int} state @see me.state#Constant
		 */
		obj.isCurrent = function(state) {
			return _state == state;
		};

		// return our object
		return obj;

	})();


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
