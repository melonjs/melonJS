/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * a Timer object to manage time function (FPS, Game Tick, Time...)<p>
	 * There is no constructor function for me.timer
	 * @namespace me.timer
	 * @memberOf me
	 */
	me.timer = (function() {
		// hold public stuff in our api
		var api = {};

		/*---------------------------------------------
			
			PRIVATE STUFF
				
			---------------------------------------------*/

		//hold element to display fps
		var htmlCounter = null;
		var debug = false;
		var framecount = 0;
		var framedelta = 0;

		/* fps count stuff */
		var last = 0;
		var now = 0;
		var delta = 0;
		var step = Math.ceil(1000 / me.sys.fps); // ROUND IT ?
		// define some step with some margin
		var minstep = (1000 / me.sys.fps) * 1.25; // IS IT NECESSARY?

		/**
		 * draw the fps counter
		 * @ignore
		 */
		function draw(fps) {
			htmlCounter.replaceChild(document.createTextNode("(" + fps + "/"
					+ me.sys.fps + " fps)"), htmlCounter.firstChild);
		};
		

		/*---------------------------------------------
			
			PUBLIC STUFF
				
			---------------------------------------------*/

		/**
		 * last game tick value
		 * @public
		 * @type Int
		 * @name tick
		 * @memberOf me.timer
		 */
		api.tick = 1.0;

		/**
		 * last measured fps rate
		 * @public
		 * @type Int
		 * @name fps
		 * @memberOf me.timer
		 */
		api.fps = 0;
		
		/**
		 * init the timer
		 * @ignore
		 */
		api.init = function() {
			// check if we have a fps counter display in the HTML
			htmlCounter = document.getElementById("framecounter");
			if (htmlCounter !== null) {
				me.debug.displayFPS = true;
			}

			// reset variables to initial state
			api.reset();
		};

		/**
		 * reset time (e.g. usefull in case of pause)
		 * @name reset
		 * @memberOf me.timer
		 * @ignore
		 * @function
		 */
		api.reset = function() {
			// set to "now"
			now = last = Date.now();
			// reset delta counting variables
			framedelta = 0;
			framecount = 0;

		};

		/**
		 * return the current time
		 * @name getTime
		 * @memberOf me.timer
		 * @return {Date}
		 * @function
		 */
		api.getTime = function() {
			return now;
		};

		/**
		 * update game tick
		 * should be called once a frame
		 * @ignore
		 */
		api.update = function() {
			last = now;
			now = Date.now();

			delta = (now - last);

			// only draw the FPS on in the HTML page 
			if (me.debug.displayFPS) {
				framecount++;
				framedelta += delta;
				if (framecount % 10 == 0) {
					this.fps = (~~((1000 * framecount) / framedelta)).clamp(0, me.sys.fps);
					framedelta = 0;
					framecount = 0;
				}
				// set the element in the HTML
				if (htmlCounter !== null) {
					draw(this.fps);
				}
			}
			// get the game tick
			api.tick = (delta > minstep && me.sys.interpolation) ? delta / step	: 1;
		};

		// return our apiect
		return api;

	})();
	/************************************************************************************/

	/**
	 * video functions
	 * There is no constructor function for me.video
	 * @namespace me.video
	 * @memberOf me
	 */
	me.video = (function() {
		// hold public stuff in our apig
		var api = {};

		// internal variables
		var canvas = null;
		var context2D = null;
		var backBufferCanvas = null;
		var backBufferContext2D = null;
		var wrapper = null;

		
		var deferResizeId = -1;

		var double_buffering = false;
		var game_width_zoom = 0;
		var game_height_zoom = 0;
		var auto_scale = false;
		var maintainAspectRatio = true;
		var devicePixelRatio = null;
		
		// max display size
		var maxWidth = Infinity;
		var maxHeight = Infinity;
		
		/**
		 * return a vendor specific canvas type
		 * @ignore
		 */
		function getCanvasType() {
			// cocoonJS specific canvas extension
			if (navigator.isCocoonJS) {
				if (!me.sys.dirtyRegion) {
					return 'screencanvas';
				}
			}
			return 'canvas';
		};
		

		/*---------------------------------------------
			
			PUBLIC STUFF
				
			---------------------------------------------*/

		/**
		 * init the "video" part<p>
		 * return false if initialization failed (canvas not supported)
		 * @name init
		 * @memberOf me.video
		 * @function
		 * @param {String} wrapper the "div" element id to hold the canvas in the HTML file  (if null document.body will be used)
		 * @param {Int} width game width
		 * @param {Int} height game height
		 * @param {Boolean} [double_buffering] enable/disable double buffering
		 * @param {Number} [scale] enable scaling of the canvas ('auto' for automatic scaling)
		 * @param {Boolean} [maintainAspectRatio] maintainAspectRatio when scaling the display
		 * @return {Boolean}
		 * @example
		 * // init the video with a 480x320 canvas
		 * if (!me.video.init('jsapp', 480, 320)) {
		 *    alert("Sorry but your browser does not support html 5 canvas !");
		 *    return;
		 * }
		 */
		api.init = function(wrapperid, game_width, game_height,	doublebuffering, scale, aspectRatio) {
			// ensure melonjs has been properly initialized
			if (!me.initialized) {
				throw "melonJS: me.video.init() called before engine initialization.";
			}
			// check given parameters
			double_buffering = doublebuffering || false;
			auto_scale  = (scale==='auto') || false;
			maintainAspectRatio = (aspectRatio !== undefined) ? aspectRatio : true;
			
			// normalize scale
			scale = (scale!=='auto') ? parseFloat(scale || 1.0) : 1.0
			me.sys.scale = new me.Vector2d(scale, scale);
			
			// force double buffering if scaling is required
			if (auto_scale || (scale !== 1.0)) {
				double_buffering = true;
			}
			
			// default scaled size value
			game_width_zoom = game_width * me.sys.scale.x;
			game_height_zoom = game_height * me.sys.scale.y;
			
			//add a channel for the onresize/onorientationchange event
			window.addEventListener('resize', function (event) {me.event.publish(me.event.WINDOW_ONRESIZE, [event])}, false);
			window.addEventListener('orientationchange', function (event) {me.event.publish(me.event.WINDOW_ONRESIZE, [event])}, false);
			
			// register to the channel
			me.event.subscribe(me.event.WINDOW_ONRESIZE, me.video.onresize.bind(me.video));
			
			// create the main canvas
			canvas = api.createCanvas(game_width_zoom, game_height_zoom, true);

			// add our canvas
			if (wrapperid) {
				wrapper = document.getElementById(wrapperid);
			}
			// if wrapperid is not defined (null)
			if (!wrapper) {
				// add the canvas to document.body
				wrapper = document.body;
			}
			wrapper.appendChild(canvas);

			// stop here if not supported
			if (!canvas.getContext)
				return false;
				
			// get the 2D context
			context2D = api.getContext2d(canvas);

			// create the back buffer if we use double buffering
			if (double_buffering) {
				backBufferCanvas = api.createCanvas(game_width, game_height, false);
				backBufferContext2D = api.getContext2d(backBufferCanvas);
			} else {
				backBufferCanvas = canvas;
				backBufferContext2D = context2D;
			}
			
			// set max the canvas max size if CSS values are defined 
			if (window.getComputedStyle) {
				var style = window.getComputedStyle(canvas, null);
				me.video.setMaxSize(parseInt(style.maxWidth), parseInt(style.maxHeight));
			}
			
			// trigger an initial resize();
			me.video.onresize(null);
			
			return true;
		};

		/**
		 * return a reference to the wrapper
		 * @name getWrapper
		 * @memberOf me.video
		 * @function
		 * @return {Document}
		 */
		api.getWrapper = function() {
			return wrapper;
		};

		/**
		 * return the width of the display canvas (before scaling)
		 * @name getWidth
		 * @memberOf me.video
		 * @function
		 * @return {Int}
		 */
		api.getWidth = function() {
			return backBufferCanvas.width;

		};
		
		/**
		 * return the relative (to the page) position of the specified Canvas
		 * @name getPos
		 * @memberOf me.video
		 * @function
		 * @param {Canvas} [canvas] system one if none specified
		 * @return {me.Vector2d}
		 */
		api.getPos = function(c) {
			var c = c || canvas;
			return c.getBoundingClientRect?c.getBoundingClientRect():{left:0,top:0};
		};

		/**
		 * return the height of the display canvas (before scaling)
		 * @name getHeight
		 * @memberOf me.video
		 * @function
		 * @return {Int}
		 */
		api.getHeight = function() {
			return backBufferCanvas.height;
		};
		
		/**
		 * set the max canvas display size (when scaling)
		 * @name setMaxSize
		 * @memberOf me.video
		 * @function
		 * @param {Int} width width
		 * @param {Int} height height
		 */
		api.setMaxSize = function(w, h) {
			// max display size
			maxWidth = w || Infinity;
			maxHeight = h || Infinity;
		};


		/**
		 * Create and return a new Canvas
		 * @name createCanvas
		 * @memberOf me.video
		 * @function
		 * @param {Int} width width
		 * @param {Int} height height
		 * @return {Canvas}
		 */
		api.createCanvas = function(width, height, vendorExt) {
			if (width === 0 || height === 0)  {
				throw new Error("melonJS: width or height was zero, Canvas could not be initialized !");
			}
			
			var canvasType = (vendorExt === true) ? getCanvasType() : 'canvas';
			var _canvas = document.createElement(canvasType);
			
			_canvas.width = width || backBufferCanvas.width;
			_canvas.height = height || backBufferCanvas.height;

			return _canvas;
		};

		/**
		 * Returns the 2D Context object of the given Canvas
		 * `getContext2d` will also enable/disable antialiasing features based on global settings.
		 * @name getContext2D
		 * @memberOf me.video
		 * @function
		 * @param {Canvas}
		 * @return {Context2D}
		 */
		api.getContext2d = function(canvas) {
			if (navigator.isCocoonJS) {
				// cocoonJS specific extension
				var _context = canvas.getContext('2d', { "antialias" : me.sys.scalingInterpolation });
			} else {
				var _context = canvas.getContext('2d');				
			}
			if (!_context.canvas) {
				_context.canvas = canvas;
			}
			me.video.setImageSmoothing(_context, me.sys.scalingInterpolation);
			return _context;
		};

		/**
		 * return a reference to the screen canvas <br>
		 * (will return buffered canvas if double buffering is enabled, or a reference to Screen Canvas) <br>
		 * use this when checking for display size, event <br>
		 * or if you need to apply any special "effect" to <br>
		 * the corresponding context (ie. imageSmoothingEnabled)
		 * @name getScreenCanvas
		 * @memberOf me.video
		 * @function
		 * @return {Canvas}
		 */
		api.getScreenCanvas = function() {
			return canvas;
		};
		
		/**
		 * return a reference to the screen canvas corresponding 2d Context<br>
		 * (will return buffered context if double buffering is enabled, or a reference to the Screen Context)
		 * @name getScreenContext
		 * @memberOf me.video
		 * @function
		 * @return {Context2D}
		 */
		api.getScreenContext = function() {
			return context2D;
		};
		
		/**
		 * return a reference to the system canvas
		 * @name getSystemCanvas
		 * @memberOf me.video
		 * @function
		 * @return {Canvas}
		 */
		api.getSystemCanvas = function() {
			return backBufferCanvas;
		};
		
		/**
		 * return a reference to the system 2d Context
		 * @name getSystemContext
		 * @memberOf me.video
		 * @function
		 * @return {Context2D}
		 */
		api.getSystemContext = function() {
			return backBufferContext2D;
		};
		
		/**
		 * return the device pixel ratio
		 * @name getDevicePixelRatio
		 * @memberOf me.video
		 * @function
		 */
		api.getDevicePixelRatio = function() {
			
			if (devicePixelRatio===null) {
				var _context = me.video.getScreenContext();
				var _devicePixelRatio = window.devicePixelRatio || 1,
					_backingStoreRatio = _context.webkitBackingStorePixelRatio ||
										_context.mozBackingStorePixelRatio ||
										_context.msBackingStorePixelRatio ||
										_context.oBackingStorePixelRatio ||
										_context.backingStorePixelRatio || 1;
				devicePixelRatio = _devicePixelRatio / _backingStoreRatio;
			}
			return devicePixelRatio;
		};
		
		/**
		 * callback for window resize event
		 * @ignore
		 */
		api.onresize = function(event){
			// default (no scaling)
			var scaleX = 1, scaleY = 1;
			
			if (auto_scale) {
				// get the parent container max size
				var parent = me.video.getScreenCanvas().parentNode;
				var _max_width = Math.min(maxWidth, parent.width || window.innerWidth);
				var _max_height = Math.min(maxHeight, parent.height || window.innerHeight);

				if (maintainAspectRatio) {
					// make sure we maintain the original aspect ratio
					var designRatio = me.video.getWidth() / me.video.getHeight();
					var screenRatio = _max_width / _max_height;
					if (screenRatio < designRatio)
						scaleX = scaleY = _max_width / me.video.getWidth();
					else
						scaleX = scaleY = _max_height / me.video.getHeight();
				} else {
					// scale the display canvas to fit with the parent container
					scaleX = _max_width / me.video.getWidth();
					scaleY = _max_height / me.video.getHeight();
				}
			}
			// adjust scaling ratio based on the device pixel ratio
			scaleX *= me.video.getDevicePixelRatio();
			scaleY *= me.video.getDevicePixelRatio();
			// scale if required
			if (scaleX!==1 || scaleY !==1) {
				if (deferResizeId) {
					// cancel any previous pending resize
					clearTimeout(deferResizeId);
				}
				deferResizeId = me.video.updateDisplaySize.defer(scaleX , scaleY);
				return;
			}
			// make sure we have the correct relative canvas position cached
			me.input.offset = me.video.getPos();
		};
		
		/**
		 * Modify the "displayed" canvas size
		 * @name updateDisplaySize
		 * @memberOf me.video
		 * @function
		 * @param {Number} scaleX X scaling multiplier
		 * @param {Number} scaleY Y scaling multiplier
		 */
		api.updateDisplaySize = function(scaleX, scaleY) {
			// update the global scale variable
			me.sys.scale.set(scaleX,scaleY);
			
			// apply the new value
			canvas.width = game_width_zoom = backBufferCanvas.width * scaleX;
			canvas.height = game_height_zoom = backBufferCanvas.height * scaleY;
			// adjust CSS style for High-DPI devices
			if (me.video.getDevicePixelRatio()>1) {
				canvas.style.width = (canvas.width / me.video.getDevicePixelRatio()) + 'px';
				canvas.style.height = (canvas.height / me.video.getDevicePixelRatio()) + 'px';
			}
			 
			// make sure we have the correct relative canvas position cached
			me.input.offset = me.video.getPos();

			// force a canvas repaint
			api.blitSurface();
			
			// clear the timeout id
			deferResizeId = -1;
		};
		
		/**
		 * Clear the specified context with the given color
		 * @name clearSurface
		 * @memberOf me.video
		 * @function
		 * @param {Context2D} context Canvas context
		 * @param {String} color a CSS color string
		 */
		api.clearSurface = function(context, col) {
			var w = context.canvas.width;
			var h = context.canvas.height;

			context.save();
			context.setTransform(1, 0, 0, 1, 0, 0);
			if (col.substr(0, 4) === "rgba") {
				context.clearRect(0, 0, w, h);
			}
			context.fillStyle = col;
			context.fillRect(0, 0, w, h);
			context.restore();
		};
		
		/**
		 * enable/disable image smoothing (scaling interpolation) for the specified 2d Context<br>
		 * (!) this might not be supported by all browsers <br>
		 * @name setImageSmoothing
		 * @memberOf me.video
		 * @function
		 * @param {Context2D} context
		 * @param {Boolean} [enable=false]
		 */
		api.setImageSmoothing = function(context, enable) {
			// a quick polyfill for the `imageSmoothingEnabled` property
			var vendors = ['ms', 'moz', 'webkit', 'o'];
			for(var x = 0; x < vendors.length; ++x) {
				if (context[vendors[x]+'ImageSmoothingEnabled'] !== undefined) {
					context[vendors[x]+'ImageSmoothingEnabled'] = (enable===true);
				}
			};
			// generic one (if implemented)
			context.imageSmoothingEnabled = (enable===true);
		};
		
		/**
		 * enable/disable Alpha for the specified context
		 * @name setAlpha
		 * @memberOf me.video
		 * @function
		 * @param {Context2D} context
		 * @param {Boolean} enable
		 */
		api.setAlpha = function(context, enable) {
			context.globalCompositeOperation = enable ? "source-over" : "copy";
		};

		/**
		 * render the main framebuffer on screen
		 * @name blitSurface
		 * @memberOf me.video
		 * @function
		 */
		api.blitSurface = function() {
			if (double_buffering) {
				/** @ignore */
				api.blitSurface = function() {
					//FPS.update();
					context2D.drawImage(backBufferCanvas, 0, 0,
							backBufferCanvas.width, backBufferCanvas.height, 0,
							0, game_width_zoom, game_height_zoom);
					
				};
			} else {
				// "empty" function, as we directly render stuff on "context2D"
				/** @ignore */
				api.blitSurface = function() {
				};
			}
			api.blitSurface();
		};

		/**
		 * apply the specified filter to the main canvas
		 * and return a new canvas object with the modified output<br>
		 * (!) Due to the internal usage of getImageData to manipulate pixels,
		 * this function will throw a Security Exception with FF if used locally
		 * @name applyRGBFilter
		 * @memberOf me.video
		 * @function
		 * @param {Object} object Canvas or Image Object on which to apply the filter
		 * @param {String} effect "b&w", "brightness", "transparent"
		 * @param {String} option For "brightness" effect : level [0...1] <br> For "transparent" effect : color to be replaced in "#RRGGBB" format
		 * @return {Context2D} context object
		 */
		api.applyRGBFilter = function(object, effect, option) {
			//create a output canvas using the given canvas or image size
			var _context = api.getContext2d(api.createCanvas(object.width, object.height, false));
			// get the pixels array of the give parameter
			var imgpix = me.utils.getPixels(object);
			// pointer to the pixels data
			var pix = imgpix.data;

			// apply selected effect
			switch (effect) {
			case "b&w": {
				for ( var i = 0, n = pix.length; i < n; i += 4) {
					var grayscale = (3 * pix[i] + 4 * pix[i + 1] + pix[i + 2]) >>> 3;
					pix[i] = grayscale; // red
					pix[i + 1] = grayscale; // green
					pix[i + 2] = grayscale; // blue
				}
				break;
			}

			case "brightness": {
				// make sure it's between 0.0 and 1.0
				var brightness = Math.abs(option).clamp(0.0, 1.0);
				for ( var i = 0, n = pix.length; i < n; i += 4) {

					pix[i] *= brightness; // red
					pix[i + 1] *= brightness; // green
					pix[i + 2] *= brightness; // blue
				}
				break;
			}

			case "transparent": {
				for ( var i = 0, n = pix.length; i < n; i += 4) {
					if (me.utils.RGBToHex(pix[i], pix[i + 1], pix[i + 2]) === option) {
						pix[i + 3] = 0;
					}
				}
				break;
			}

			default:
				return null;
			}

			// put our modified image back in the new filtered canvas
			_context.putImageData(imgpix, 0, 0);

			// return it
			return _context;
		};

		// return our api
		return api;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
