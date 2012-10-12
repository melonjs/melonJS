/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * a Timer object to manage time function (FPS, Game Tick, Time...)<p>
	 * There is no constructor function for me.timer
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
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
		 * @private
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
		 * @type {Int}
		 * @name me.timer#tick
		 */
		api.tick = 1.0;

		/**
		 * last measured fps rate
		 * @public
		 * @type {Int}
		 * @name me.timer#fps
		 */
		api.fps = 0;
		
		/* ---
		
			init our time stuff
			
			---							*/
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
		 * @name me.timer#reset
		 * @private
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
		 * @name me.timer#getTime
		 * @return {Date}
		 * @function
		 */
		api.getTime = function() {
			return now;
		};

		/* ---
		
			update game tick
			should be called once a frame
			
			---                           */
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
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
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

		var double_buffering = false;
		var game_width_zoom = 0;
		var game_height_zoom = 0;

		/*---------------------------------------------
			
			PUBLIC STUFF
				
			---------------------------------------------*/

		/* ---
		
			init the video part
			
			
			---							*/
		/**
		 * init the "video" part<p>
		 * return false if initialization failed (canvas not supported)
		 * @name me.video#init
		 * @function
		 * @param {String} wrapper the "div" element id to hold the canvas in the HTML file  (if null document.body will be used)
		 * @param {Int} width game width
		 * @param {Int} height game height
		 * @param {Boolean} [double_buffering] enable/disable double buffering
		 * @param {Number} [scale] enable scaling of the canvas ('auto' for autozoom)
		 * @param {Boolean} [autoresize] enable resizing of the canvas to fit with the window size (will not maintain aspect ratio)
		 * @return {Boolean}
		 * @example
		 * // init the video with a 480x320 canvas
		 * if (!me.video.init('jsapp', 480, 320))
		 * {
		 *    alert("Sorry but your browser does not support html 5 canvas !");
		 *    return;
		 * }
		 */
		api.init = function(wrapperid, game_width, game_height,	doublebuffering, scale, autoresize) {
			// check given parameters
			double_buffering = doublebuffering || false;
			me.sys.autozoom  = (scale==='auto') || false;
			me.sys.autoresize = autoresize || false;
			
			// normalize scale
			scale = (scale!=='auto') ? parseFloat(scale || 1.0) : 1.0
			me.sys.scale = new me.Vector2d(scale, scale);
			
			// force double buffering if scaling is required
			if (me.sys.autozoom || me.sys.autoresize || (scale !== 1.0)) {
				double_buffering = true;
			}

			
			// callback on window resize event
			/* TODO : don't we need some polyfill here ?*/
			window.onresize = function(event){
				if (me.sys.autoresize) {
					// update the global scaling factor
					me.sys.scale.set (
						window.innerWidth / me.video.getWidth(),
						window.innerHeight / me.video.getHeight()
					);
					// update the "front" canvas size
					me.video.updateDisplaySize(me.sys.scale.x, me.sys.scale.y);
				} else if (me.sys.autozoom) {
					var designRatio = game_width / game_height;
					var screenRatio = window.innerWidth / window.innerHeight;
 
					if (screenRatio < designRatio)
						var scale = window.innerWidth / game_width;
					else
						var scale = window.innerHeight / game_height;
					
					// update the global scaling value
					me.sys.scale.set(scale,scale);
					// update the "front" canvas size
					me.video.updateDisplaySize(me.sys.scale.x, me.sys.scale.y);
				}
			}
			
			// autozoom setup
			if(me.sys.autozoom){
				var designRatio = game_width / game_height;
				var screenRatio = window.innerWidth / window.innerHeight;
				if(screenRatio < designRatio)
					scale = window.innerWidth / game_width;
				else
					scale = window.innerHeight / game_height;
				// set scaling accordingly
				me.sys.scale.set(scale, scale);
			}
      
			// autoresize setup
			if(me.sys.autoresize){
				game_width_zoom = window.innerWidth;
				game_height_zoom = window.innerHeight;
				me.sys.scale.x = game_width_zoom / game_width;
				me.sys.scale.y = game_height_zoom / game_height;
			} else {
				game_width_zoom = game_width * me.sys.scale.x;
				game_height_zoom = game_height * me.sys.scale.y;
			}

			// create the main canvas
			canvas = document.createElement("canvas");
			canvas.setAttribute("width", (game_width_zoom) + "px");
			canvas.setAttribute("height", (game_height_zoom) + "px");
			canvas.setAttribute("border", "0px solid black");
			canvas.setAttribute("display", "block"); // ??

			// add our canvas
			if (wrapperid) {
				wrapper = document.getElementById(wrapperid);
			}
			else {
				// if wrapperid is not defined (null)
				// add the canvas to document.body
				wrapper = document.body;
			}
			wrapper.appendChild(canvas);

			// stop here if not supported
			if (!canvas.getContext)
				return false;
				
			// get the 2D context
			context2D = canvas.getContext('2d');

			// create the back buffer if we use double buffering
			if (double_buffering) {
				backBufferContext2D = api.createCanvasSurface(game_width, game_height);
				backBufferCanvas = backBufferContext2D.canvas;
			} else {
				backBufferContext2D = context2D;
				backBufferCanvas = context2D.canvas;
			}
			return true;
		};

		/**
		 * return a reference to the wrapper
		 * @name me.video#getWrapper
		 * @function
		 * @return {Document}
		 */
		api.getWrapper = function() {
			return wrapper;
		};

		/**
		 * return the width of the display canvas (before scaling)
		 * @name me.video#getWidth
		 * @function
		 * @return {Int}
		 */
		api.getWidth = function() {
			return backBufferCanvas.width;

		};
		
		/**
		 * return the relative (to the page) position of the specified Canvas
		 * @name me.video#getPos
		 * @function
		 * @param {Canvas} [canvas] system one if none specified
		 * @return {me.Vector2d}
		 */
		api.getPos = function(c) {
			var obj = c || canvas;
			var offset = new me.Vector2d(obj.offsetLeft, obj.offsetTop);
			while ( obj = obj.offsetParent ) {
				offset.x += obj.offsetLeft;
				offset.y += obj.offsetTop;
			} 
			return offset;
		};

		/**
		 * return the height of the display canvas (before scaling)
		 * @name me.video#getHeight
		 * @function
		 * @return {Int}
		 */
		api.getHeight = function() {
			return backBufferCanvas.height;
		};

		/**
		 * allocate and return a new Canvas 2D surface
		 * @name me.video#createCanvasSurface
		 * @function
		 * @param {Int} width canvas width
		 * @param {Int} height canvas height
		 * @return {Context2D}
		 */
		api.createCanvasSurface = function(width, height) {
			var privateCanvas = document.createElement("canvas");

			privateCanvas.width = width || backBufferCanvas.width;
			privateCanvas.height = height || backBufferCanvas.height;

			return privateCanvas.getContext('2d');
		};

		/**
		 * return a reference of the display canvas
		 * @name me.video#getScreenCanvas
		 * @function
		 * @return {Canvas}
		 */
		api.getScreenCanvas = function() {
			return canvas;
		};

		/**
		 * return a reference to the screen framebuffer
		 * @name me.video#getScreenFrameBuffer
		 * @function
		 * @return {Context2D}
		 */
		api.getScreenFrameBuffer = function() {
			return backBufferContext2D;
		};


		/**
		 * Mofidy the "front" canvas size
		 * @name me.video#updateDisplaySize
		 * @function
		 * @param {Number} scale X scaling value
		 * @param {Number} scale Y scaling value
		 */
		api.updateDisplaySize = function(scaleX, scaleY) {
			canvas.width = game_width_zoom = backBufferCanvas.width * scaleX;
			canvas.height = game_height_zoom = backBufferCanvas.height * scaleY;
		};
		
		/**
		 * Clear the specified context with the given color
		 * @name me.video#clearSurface
		 * @function
		 * @param {Context2D} context
		 * @param {Color} col
		 */
		api.clearSurface = function(context, col) {
			context.save();
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.fillStyle = col;
			context.fillRect(0, 0, context.canvas.width, context.canvas.height);
			context.restore();
		};

		/**
		 * scale & keep canvas centered<p>
		 * usefull for zooming effect
		 * @name me.video#scale
		 * @function
		 * @param {Context2D} context
		 * @param {scale} scale
		 */
		api.scale = function(context, scale) {
			context.translate(
							-(((context.canvas.width * scale) - context.canvas.width) >> 1),
							-(((context.canvas.height * scale) - context.canvas.height) >> 1));
			context.scale(scale, scale);

		};

		/**
		 * enable/disable Alpha for the specified context
		 * @name me.video#setAlpha
		 * @function
		 * @param {Context2D} context
		 * @param {Boolean} enable
		 */
		api.setAlpha = function(context, enable) {
			context.globalCompositeOperation = enable ? "source-over" : "copy";
		};

		/**
		 * render the main framebuffer on screen
		 * @name me.video#blitSurface
		 * @function
		 */
		api.blitSurface = function() {
			if (double_buffering) {
				api.blitSurface = function() {
					//FPS.update();
					context2D.drawImage(backBufferCanvas, 0, 0,
							backBufferCanvas.width, backBufferCanvas.height, 0,
							0, game_width_zoom, game_height_zoom);
					
				};
			} else {
				// "empty" function, as we directly render stuff on "context2D"
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
		 * @name me.video#applyRGBFilter
		 * @function
		 * @param {Object} object Canvas or Image Object on which to apply the filter
		 * @param {String} effect "b&w", "brightness", "transparent"
		 * @param {String} option : level [0...1] (for brightness), color to be replaced (for transparent) 
		 * @return {Context2D} context object
		 */
		api.applyRGBFilter = function(object, effect, option) {
			//create a output canvas using the given canvas or image size
			var fcanvas = api.createCanvasSurface(object.width, object.height);
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
			fcanvas.putImageData(imgpix, 0, 0);

			// return it
			return fcanvas;
		};

		// return our api
		return api;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
