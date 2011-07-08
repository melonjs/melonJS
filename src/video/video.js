/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 * video Mngt 
 *
 *
 */

(function($, undefined)
{
	/**
    * a Timer object to manage time function (FPS, Game Tick, Time...)<p>
	 * There is no constructor function for me.timer
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	timer = (function()
	{
		// hold public stuff in our singletong
		var singleton	= {};
	
		/*---------------------------------------------
			
			PRIVATE STUFF
				
			---------------------------------------------*/
		
		//hold element to display fps
		var htmlCounter      = null; 
		var debug				= false;
		var framecount			= 0;
		var framedelta			= 0;
		var lastfps				= 0;
		
		/* fps count stuff */
		var last					= 0;
		var now					= 0;
		var delta				= 0;
		var step					= Math.ceil(1000/me.sys.fps); // ROUND IT ?
		// define some step with some margin
		var minstep				= (1000/me.sys.fps) * 1.25; // IS IT NECESSARY?

		
		/* ---
		
			update the fps counter
			
			---*/                           
		function draw()
		{
			htmlCounter.replaceChild(document.createTextNode("(" + lastfps + "/" + me.sys.fps + " fps)"), htmlCounter.firstChild);
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
		singleton.tick		=	1.0;
	
		/* ---
		
			init our time stuff
			
			---							*/
		singleton.init = function()
		{
			// check if we have a framecounter display in the HTML
			htmlCounter	 = document.getElementById("framecounter");
			debug			 = (htmlCounter !== null);
			
			// reset variables to initial state
			singleton.reset();			
		};
		
	   /**
		 * reset time (e.g. usefull in case of pause)
       * @name me.timer#reset
		 * @private
		 * @function
   	 */
		singleton.reset = function()
		{
			// set to "now"
			now = last = new Date().getTime();
			// reset delta counting variables
			framedelta	= 0;
			framecount	= 0;
			
		};
		
	   /**
		 * return the current time
       * @name me.timer#getTime
		 * @return {Date}
		 * @function
   	 */
      singleton.getTime = function()
		{ 
			return now;					
		};

		
		/* ---
		
			update game tick
			should be called once a frame
			
			---                           */
		singleton.update = function()
		{ 
			
			last  = now;
			now	= new Date().getTime();
			
			delta = (now - last);
			
			// only draw the FPS on in the HTML page 
			if (debug)
			{ 
				framecount++;
				framedelta += delta;
				if (framecount % 10 == 0) 
				{
					lastfps = Math.ceil((1000 * framecount) / framedelta);
					draw();
					framedelta = 0;
					framecount = 0;
				} 
			}
			
			// get the game tick
			singleton.tick  = (delta > minstep && me.sys.interpolation) ? delta / step : 1;
			
			//console.log(singleton.tick);
					
		};
		
		
		// return our singletonect
		return singleton;

	})();
	/************************************************************************************/

   /**
    * video functions
	 * There is no constructor function for me.video
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	video = (function()
	{
		// hold public stuff in our singletong
		var singleton	= {};

		// internal variables
		var canvas					=	null;
		var context2D				=	null;
		var backBufferCanvas		=	null;
		var backBufferContext2D	=	null;
		var wrapper					=	null;
		
		var double_buffering		=	false;
		var game_width_zoom		=	0;
		var game_height_zoom		=	0;
	
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
       *	@param {String} wrapper the "div" element id to hold the canvas in the HTML file
       * @param {Int} width game width
       * @param {Int} height game height
       * @param {Boolean} [double_buffering] enable/disable double buffering
       * @param {Number} [scale] enable scaling of the canvas (note : if scale is used, double_buffering must be enabled)
		 * @return {Boolean}
       * @example
       * // init the video with a 480x320 canvas
 		 * if (!me.video.init('jsapp', 480, 320, false, 1.0))
		 * {
       *    alert("Sorry but your browser does not support html 5 canvas. Please try with another one!");
       *    return;
       * }
   	 */
		singleton.init = function (wrapperid, game_width, game_height, doublebuffering, scale) 
		{
			double_buffering = doublebuffering || false;
			
			// zoom only work with the double buffering since we 
			// actually zoom the backbuffer before rendering it
			me.sys.scale = double_buffering === true ? scale || 1.0 : 1.0;
		
			game_width_zoom		= game_width  * me.sys.scale;
			game_height_zoom		= game_height * me.sys.scale;
			
			wrapper  = document.getElementById(wrapperid);
			canvas	= document.createElement("canvas");
			  
			canvas.setAttribute("width",	(game_width_zoom) + "px");
			canvas.setAttribute("height",	(game_height_zoom) + "px");
			canvas.setAttribute("border",	"0px solid black");
			//_canvas.setAttribute("style",		"background: #ffff");
			
			wrapper.appendChild(canvas);
			
						
			if (canvas.getContext) 
			{
				context2D = canvas.getContext('2d');
					
				// create the back buffer if we use double buffering
				if (double_buffering)
				{
					backBufferContext2D	= singleton.createCanvasSurface(game_width, game_height);
					backBufferCanvas		= backBufferContext2D.canvas;
				}
				else
				{
					backBufferContext2D	= context2D;
					backBufferCanvas		= context2D.canvas;
				}
			}
			else
			{
				// canvas not supported by the browser
				return false;
			}
						
			return true;
		};
		
		/**
		 * return a reference to the wrapper
       * @name me.video#getWrapper
       * @function
       * @return {Document}
   	 */
      singleton.getWrapper = function()
		{
			return wrapper;
		};

		/**
		 * return the width of the display canvas (before scaling)
       * @name me.video#getWidth
       * @function
       * @return {Int}
   	 */
		singleton.getWidth =  function()
		{
			return backBufferCanvas.width;
			
		};

		/**
		 * return the height of the display canvas (before scaling)
       * @name me.video#getHeight
       * @function
       * @return {Int}
   	 */
		singleton.getHeight = function()
		{
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
		singleton.createCanvasSurface = function(width, height)
		{
			var privateCanvas = document.createElement('canvas');
				
			privateCanvas.width = width   || backBufferCanvas.width;
			privateCanvas.height = height || backBufferCanvas.height;
				
			return privateCanvas.getContext('2d');
		};

		
		/**
		 * return a reference of the display canvas
       * @name me.video#getScreenCanvas
       * @function
       * @return {Canvas}
   	 */
		singleton.getScreenCanvas = function()
		{
			//console.log(VideoMngr._canvas);
			return canvas;
		};
		
		
		/**
		 * return a reference to the screen framebuffer
       * @name me.video#getScreenFrameBuffer
       * @function
       * @return {Context2D}
   	 */
      singleton.getScreenFrameBuffer = function()
		{
			return backBufferContext2D; 
		};
		
		

		
		/* ---
		
			Update the display size (zoom ratio change)
			if no parameter called from the outside (select box)
			---								*/
      
      /**
		 * change the display scaling factor
       * @name me.video#updateDisplaySize
       * @function
       * @param {Number} scale scaling value
    	 */
		singleton.updateDisplaySize = function(scale)
		{
			if (double_buffering)
			{
				if (scale)
					me.sys.scale = scale;
				else
					// to be changed by something else :)
					me.sys.scale = document.getElementById("screen size").value;
				
				game_width_zoom	= backBufferCanvas.width  * me.sys.scale;
				game_height_zoom	= backBufferCanvas.height * me.sys.scale;
				
				canvas.width  = game_width_zoom; // in pixels
				canvas.height = game_height_zoom; // in pixels
				
			}
		};
		
		/**
		 * Clear the specified context with the given color
       * @name me.video#clearSurface
       * @function
       * @param {Context2D} context
       * @param {Color} col
    	 */	
		singleton.clearSurface = function(context, col)
		{
			context.fillStyle = col;
			context.fillRect (0, 0, 
									context.canvas.width,
									context.canvas.height);
		};
		
		
	
		/**
		 * scale & keep canvas centered<p>
       * usefull for zooming effect
       * @name me.video#scale
       * @function
       * @param {Context2D} context
       * @param {scale} scale
    	 */	
		singleton.scale = function(context, scale)
		{
			context.translate(	- (((context.canvas.width * scale)  - context.canvas.width) >> 1) , 
                              - (((context.canvas.height * scale) - context.canvas.height) >> 1));

			context.scale(scale, scale);

		};
		
	
		/**
		 * enable/disable Alpha for the specified context
       * @name me.video#setAlpha
       * @function
       * @param {Context2D} context
       * @param {Boolean} enable
    	 */	
      singleton.setAlpha = function(context, enable)
		{
			context.globalCompositeOperation = enable?"source-over":"copy";
		};
	

		/**
		 * render the main framebuffer on screen
       * @name me.video#blitSurface
       * @function
    	 */
		singleton.blitSurface = function()
		{
			if (double_buffering)
			{
				singleton.blitSurface = function () 
				{
					//FPS.update();
					context2D.drawImage(	backBufferCanvas, 
												0,								0, 
												backBufferCanvas.width,	backBufferCanvas.height, 
												0,								0,
												game_width_zoom,			game_height_zoom);
				};
			}
			else
			{
				// "empty" function, as we directly render stuff on "context2D"
				singleton.blitSurface = function () {/*FPS.update()*/}; 
			}
			singleton.blitSurface();
		};
		
		
		/**
		 * apply the specified effect to the main canvas<p>
       * and return a new canvas object with the modified output
       * @name me.video#applyEffect
       * @param {String} effect "b&w", "brightness"
       * @param {String} option brightness level
       * @function
    	 */
		singleton.applyEffect = function(effect, option)
		{
			var fcanvas = singleton.createCanvasSurface();
			var imgpix = backBufferContext2D.getImageData( 0, 0, backBufferCanvas.width, backBufferCanvas.height);
			var pix = imgpix.data;
			
			// apply selected effect
			switch (effect)
			{
				case "b&w" : 
				{
					for (var i = 0, n = pix.length; i < n; i += 4)
					{	
						var grayscale = (3*pix[i  ]+4*pix[i+1]+pix[i+2])>>>3;
						pix[i  ] = grayscale;   // red
						pix[i+1] = grayscale;   // green
						pix[i+2] = grayscale;   // blue
					}
					break;
				}
				
				
				case "brightness": 
				{
					var brightness = Math.abs(option);
					// make sure it's not greater than 1.0
					brightness = (brightness>1.0)?1.0:brightness;
					for (var i = 0, n = pix.length; i < n; i += 4)
					{	
						pix[i  ] *= brightness;   // red
						pix[i+1] *= brightness;   // green
						pix[i+2] *= brightness;   // blue
					}
					break;
				}
				
				
				default : return null;
			}
			
			fcanvas.putImageData(imgpix, 0 ,0);
			return fcanvas;
			
		};

		
		// return our singletonect
		return singleton;

	})();

	// expose our stuff to the global scope
	$.me.timer	= timer;
	$.me.video	= video;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);	


