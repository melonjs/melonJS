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
		// hold public stuff in our api
		var api	= {};
	
		/*---------------------------------------------
			
			PRIVATE STUFF
				
			---------------------------------------------*/
		
		//hold element to display fps
		var htmlCounter      = null; 
		var debug				= false;
		var framecount			= 0;
		var framedelta			= 0;
		
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
		function draw(fps)
		{
			htmlCounter.replaceChild(document.createTextNode("(" + fps + "/" + me.sys.fps + " fps)"), htmlCounter.firstChild);
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
		api.tick		=	1.0;
	
		/* ---
		
			init our time stuff
			
			---							*/
		api.init = function()
		{
			// check if we have a framecounter display in the HTML
			htmlCounter	 = document.getElementById("framecounter");
			debug			 = (htmlCounter !== null);
			
			// reset variables to initial state
			api.reset();			
		};
		
	   /**
		 * reset time (e.g. usefull in case of pause)
       * @name me.timer#reset
		 * @private
		 * @function
   	 */
		api.reset = function()
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
      api.getTime = function()
		{ 
			return now;					
		};

		
		/* ---
		
			update game tick
			should be called once a frame
			
			---                           */
      api.update = function()
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
               lastfps = ~~((1000 * framecount) / framedelta);
               // clamp the result and "draw" it
               draw(lastfps.clamp(0, me.sys.fps));
               framedelta = 0;
               framecount = 0;
            }
         }
			// get the game tick
			api.tick  = (delta > minstep && me.sys.interpolation) ? delta / step : 1;
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
	video = (function()
	{
		// hold public stuff in our apig
		var api	= {};

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
 		 * if (!me.video.init('jsapp', 480, 320))
		 * {
       *    alert("Sorry but your browser does not support html 5 canvas !");
       *    return;
       * }
   	 */
		api.init = function (wrapperid, game_width, game_height, doublebuffering, scale) 
		{
			double_buffering = doublebuffering || false;
			
			// zoom only work with the double buffering since we 
			// actually zoom the backbuffer before rendering it
			me.sys.scale = double_buffering === true ? scale || 1.0 : 1.0;
		
			game_width_zoom		= game_width  * me.sys.scale;
			game_height_zoom		= game_height * me.sys.scale;
			
			wrapper  = document.getElementById(wrapperid);
         
         canvas	= document.createElement("canvas");
         
         canvas.setAttribute("width",  (game_width_zoom) + "px");
         canvas.setAttribute("height", (game_height_zoom) + "px");
         canvas.setAttribute("border", "0px solid black");
         
         // add our canvas
         wrapper.appendChild(canvas);
         
         // check if WebGL feature is supported & required
         if (me.sys.enableWebGL && window.WebGLRenderingContext)
         {
            // in case the library is not loaded
            try
            {
               // try to enable WebGL
               WebGL2D.enable(canvas);
               context2D = canvas.getContext('webgl-2d');
               // enable cacheImage feature, so that we use
               // canvas and not Image for assets.
               me.sys.cacheImage = true;
            }
            catch (e)
            {
               // just to be sure
               context2D = null;
            }
         }
         
         // if context2D not initialized, 
         if (context2D == null)
         {
            // make sure it's disabled
            me.sys.enableWebGL = false;
            
            if (!canvas.getContext) 
               return false;
            
            context2D = canvas.getContext('2d');
         }
      			
			// create the back buffer if we use double buffering
			if (double_buffering)
			{
				backBufferContext2D	= api.createCanvasSurface(game_width, game_height);
				backBufferCanvas		= backBufferContext2D.canvas;
			}
			else
			{
				backBufferContext2D	= context2D;
				backBufferCanvas		= context2D.canvas;
			}
			return true;
		};
		
		/**
		 * return a reference to the wrapper
       * @name me.video#getWrapper
       * @function
       * @return {Document}
   	 */
      api.getWrapper = function()
		{
			return wrapper;
		};

		/**
		 * return the width of the display canvas (before scaling)
       * @name me.video#getWidth
       * @function
       * @return {Int}
   	 */
		api.getWidth =  function()
		{
			return backBufferCanvas.width;
			
		};

		/**
		 * return the height of the display canvas (before scaling)
       * @name me.video#getHeight
       * @function
       * @return {Int}
   	 */
		api.getHeight = function()
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
		api.createCanvasSurface = function(width, height)
		{
			var privateCanvas = document.createElement("canvas");
    
    		privateCanvas.width = width   || backBufferCanvas.width;
			privateCanvas.height = height || backBufferCanvas.height;
         
         /* !! this should be working, no ?
         if (me.sys.enableWebGL)
         {   
            WebGL2D.enable(privateCanvas);
            return privateCanvas.getContext('webgl-2d');
         }
         else
         { 
         */
            return privateCanvas.getContext('2d');
         //}
      };

		
		/**
		 * return a reference of the display canvas
       * @name me.video#getScreenCanvas
       * @function
       * @return {Canvas}
   	 */
		api.getScreenCanvas = function()
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
      api.getScreenFrameBuffer = function()
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
		api.updateDisplaySize = function(scale)
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
		api.clearSurface = function(context, col)
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
		api.scale = function(context, scale)
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
      api.setAlpha = function(context, enable)
		{
			context.globalCompositeOperation = enable?"source-over":"copy";
		};
	

		/**
		 * render the main framebuffer on screen
       * @name me.video#blitSurface
       * @function
    	 */
		api.blitSurface = function()
		{
			if (double_buffering)
			{
				api.blitSurface = function () 
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
				api.blitSurface = function (){}; 
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
       * @param {Object} [canvas] Canvas or Image Object on which to apply the filter
       * @param {String} effect "b&w", "brightness", "transparent"
       * @param {String} option : level [0...1] (for brightness), color to be replaced (for transparent) 
       * @return {Context2D} context object
    	 */
		api.applyRGBFilter = function()
		{
                  
         // if first arguments is not an image or a canvas
         if (typeof arguments[0] == "string")
         {
            // get effect and option parameters value
            var effect = arguments[0];
            var option = arguments[1];
            
            //create a new canvas using the main canvas size
            var fcanvas = api.createCanvasSurface();

            
            // get the content of the main canvas
            var imgpix = backBufferContext2D.getImageData( 0, 0, backBufferCanvas.width, backBufferCanvas.height);
            
         }
         else
         {  
            //create a output canvas using the given canvas or image size
            var fcanvas = api.createCanvasSurface(arguments[0].width, arguments[0].height);
               
            // is it an image ?
            if (arguments[0] instanceof HTMLImageElement)
            {
               // build a temp canvas
               var tempCtx = me.video.createCanvasSurface(arguments[0].width, arguments[0].height);
               
               // draw the image into the canvas context
               tempCtx.drawImage(arguments[0], 0, 0);
               // get the image data               
               var imgpix = tempCtx.getImageData( 0, 0, arguments[0].width, arguments[0].height);
               
            }
            else // a canvas ?
            {
               // let's hope ! :)
               var imgpix = arguments[0].getContext('2d').getImageData( 0, 0, arguments[0].width, arguments[0].height);
            }
            // get effect and option parameters value
            var effect = arguments[1];
            var option = arguments[2];
            
         }
         
         // pointer to the image data
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

            case "transparent": 
				{
					for (var i = 0, n = pix.length; i < n; i += 4)
					{	
                  if (me.utils.RGBToHex(pix[i],pix[i+1],pix[i+2]) === option)
                  {
                     pix[i+3] = 0;
                  }
               }
					break;
				}

				default : return null;
			}
         
         // put our modified image back in the new filtered canvas
			fcanvas.putImageData(imgpix, 0 ,0);

         // return it
			return fcanvas;
		};
		
      // return our api
		return api;

	})();

	// expose our stuff to the global scope
	$.me.timer	= timer;
	$.me.video	= video;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);	


