/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 */

(function($, undefined)
{
		
	/************************************************************************************/
	/*			a default loading screen																	*/
	/************************************************************************************/
	var DefaultLoadingScreen = me.ScreenObject.extend(
	{
		/*---
		
			constructor
			
			---*/
		init: function()
		{
			this.parent(true);
         // melonJS logo
         this.logo1 = new me.Font('century gothic', 32, 'white');
			this.logo2 = new me.Font('century gothic', 32, '#89b002');
         this.logo2.bold();
         
         // flag to know if we need to refresh the display
         this.invalidate = false;
         
         // load progress in percent
         this.loadPercent = 0;
         
         // setup a callback
         me.loader.onProgress = this.onProgressUpdate.bind(this);

      },
      
      // destroy object at end of loading
		onDestroyEvent : function ()
		{
         // "nullify" all fonts
         this.logo1 = this.logo2 = null;
      },
      
       // make sure the screen is refreshed every frame 
      onProgressUpdate: function(progress)
		{
         this.loadPercent = progress;
         this.invalidate = true;
      },

      
      // make sure the screen is refreshed every frame 
      update: function()
		{
			if (this.invalidate===true)
         {
            // clear the flag
            this.invalidate = false;
            // and return true
            return true;
         }
         // else return false
         return false;
		},
      
      /*---
		
			draw function
		  ---*/
		
		draw : function(context)
		{
			var y = context.canvas.height / 2;
			
			me.video.clearSurface (context, "black");
			
         // measure the logo size
         logo1_width = this.logo1.measureText(context,"melon").width;
         logo_width = logo1_width + this.logo2.measureText(context,"JS").width
			
         // draw the melonJS logo
         this.logo1.draw(context, 'melon', ((context.canvas.width - logo_width) / 2), 
                                           (context.canvas.height + 60) / 2);
         this.logo2.draw(context, 'JS', ((context.canvas.width - logo_width) / 2)  + logo1_width, 
                                        (context.canvas.height + 60) / 2);
         // add the height of the logo
         y += 40;
         
			// display a progressive loading bar
			var width = Math.floor(this.loadPercent * context.canvas.width);
         
   		// draw the progress bar
         context.strokeStyle = "silver";
			context.strokeRect(0, y, context.canvas.width, 6);
			context.fillStyle = "#89b002";
			context.fillRect(2, y+2, width-4, 2);
		},

	});
	
	/************************************************************************************/
	/*			PRELOADER SINGLETON																			*/
	/************************************************************************************/

	/**
    * a small class to manage loading of stuff and manage resources
	 * There is no constructor function for me.input.
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */

	loader = (function()
	{	
		// hold public stuff in our singletong
		var obj		= {};
		
		// contains all the images loaded
		var imgList = [];
		// contains all the xml loaded
		var xmlList = {};
		// flag to check loading status
		var resourceCount    =	0;
		var loadCount			=	0;
		var timerId				=	0;
      // keep track of how much TMX file we are loading
      var tmxCount         =  0;
		
		/* ---
		
			check the loading status
			
			---										*/
		function checkLoadStatus() 
		{
         // remove tmxCount from the total resource to be loaded
         // as we will after load each TMX into the level director
         if (loadCount == (resourceCount - tmxCount))
			{
           
				// add all TMX level into the level Director
				for( var xmlObj in xmlList )
				{	
					if (xmlList[xmlObj].isTMX)
				   {
						//console.log("un TMX!", xmlObj);
						me.levelDirector.addTMXLevel(xmlObj);
                  
                  //progress notification
                  obj.onResourceLoaded();
					}
				}
				
				// wait 1/2s and execute callback (cheap workaround to ensure everything is loaded)
				if (obj.onload)
				{
					timerId = setTimeout(obj.onload, 300);
				}
				else
				   alert ("no load callback defined");
			}
			else
			{
				timerId = setTimeout(checkLoadStatus, 100);
			}
		};
		
				
		/* ---
		
			some callback for image loading	
			 error	
			---										*/
		function onImageError(e)
		{
			// retry mechanism with image loading ???
			throw "melonJS: Failed loading image resource";
		};

			
		/* ---
		
			load Images
			
			call example : 
			
			preloadImages(
						 [{name: 'image1', src: 'images/image1.png'},
						  {name: 'image1', src: 'images/image1.png'},
						  {name: 'image1', src: 'images/image1.png'},
						  {name: 'image1', src: 'images/image1.png'}]);
			
			---										*/
			
		function preloadImage(img)
		{
			// create new Image object and add to array
			imgList.push(img.name);

			imgList[img.name]					= new Image();
			imgList[img.name].onload		= obj.onResourceLoaded.bind(obj);
			imgList[img.name].onerror		= onImageError.bind(this);
			imgList[img.name].src			= img.src + me.nocache;
		};
	
		/* ---
		
			preload XML files
			---									*/

		function preloadXML(xmlData, isTMX)
		{
			if ($.XMLHttpRequest)
			{
				// code for IE7+, Firefox, Chrome, Opera, Safari
				xmlhttp = new XMLHttpRequest();
				// to ensure our document is treated as a XML file
				if (xmlhttp.overrideMimeType)
					xmlhttp.overrideMimeType('text/xml');
			}
			else
			{
				// code for IE6, IE5
				xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
            // I actually don't give a **** about IE5/IE6...
			}
			// load our XML
			xmlhttp.open("GET",xmlData.src + me.nocache,false);
			xmlhttp.onload = obj.onResourceLoaded.bind(obj);
			xmlhttp.send();

			// set the xmldoc in the array
			xmlList[xmlData.name]		 = {};
			xmlList[xmlData.name].xml	 = xmlhttp.responseText;
			xmlList[xmlData.name].isTMX = isTMX || false;
         // in case we have a TMX file :
         if (xmlList[xmlData.name].isTMX)
         {
            // increase the resourceCount by 1
            // allowing to add the loading of level in the 
            // levelDirector as part of the loading progress
            resourceCount +=1;
            tmxCount +=1;
         }
		};
		
		/* ---
			
			PUBLIC STUFF
				
			---										*/
		
		
		/* ---
		
			onload callback : to be initialized
			
			---*/
		/**
       * onload callback
       * @public
       * @type Function
       * @name me.loader#onload
       * @example
       *
       * // set a callback when everything is loaded
       * me.loader.onload = this.loaded.bind(this);
       */		
		obj.onload = undefined;
      
      
      /**
       * onProgress callback<br>
       * each time a resource is loaded, the loader will fire the specified function,
       * giving the actual progress [0 ... 1], as argument.
       * @public
       * @type Function
       * @name me.loader#onProgress
       * @example
       *
       * // set a callback for progress notification
       * me.loader.onProgress = this.updateProgress.bind(this);
       */		
		obj.onProgress = undefined;

		
		
		/**
		 *	just increment the number of already loaded resources
		 * @private
       */
      
		obj.onResourceLoaded= function(e)
		{
			
         // increment the loading counter
			loadCount++;
         
         // callback ?
         if (obj.onProgress)
         {
            // pass the load progress in percent, as parameter
            obj.onProgress(obj.getLoadProgress());
         }
      };
		
		/**
		 * set all the specified game resources to be preloaded.<br>
       * each resource item must contain the following fields :<br>
       * - name    : internal name of the resource<br>
       * - type    : "image", "tmx", "audio"<br>
       * - src     : path and file name of the resource<br>
       * (!) for audio :<br>
       * - src     : path (only) where resources are located<br>
       * - channel : number of channels to be created<br>
       * <br>
		 * @name me.loader#preload
		 * @public
		 * @function
       * @param {Array.<string>} resources
       * @example
       * var g_resources = [ {name: "tileset-platformer",  type:"image",  src: "data/map/tileset-platformer.png"},
       *                     {name: "map1",                type: "tmx",   src: "data/map/map1_slopes.tmx"},
       *                     {name: "cling",               type: "audio", src: "data/audio/",	channel : 2}
		 *                    ]; 
       * ...
       *
       * // set all resources to be loaded
       * me.loader.preload(g_resources);
		 */

		obj.preload= function (res)
		{	
			// set the callback for audio stuff
			me.audio.setLoadCallback(obj.onResourceLoaded.bind(obj));
			
			// parse the resources
			for ( var i = 0; i < res.length; i++ )
			{
				switch (res[i].type)
				{
					case "image" :
						preloadImage(res[i]);
						resourceCount +=1;
						break;
				
					case "audio":
						// only load is sound is enable
						if (me.audio.isAudioEnable())
						{
							me.audio.load(res[i]);
							resourceCount +=1;
						}
						break;
				
					case "tmx":
						preloadXML(res[i], true);
						resourceCount +=1;
						break;
				
					default : 
                  throw "melonJS: loader : unknow resource type : %s" + res[i].type;
						break;
				}
			};
			
			// check load status
			checkLoadStatus();
		};
				
		/**
       * return the specified XML object
       * @name me.loader#getXML
       * @public
       * @function
       * @param {String} xmlfile name of the xml element ("map1");
       * @return {Xml} 
       */
      obj.getXML= function(elt)
		{	
			if (xmlList != null)
				return xmlList[elt].xml;
			else
			{
				//console.log ("warning %s resource not yet loaded!",name);
				return null;
			}

		};
		
		
      /**
       * return the specified Image Object
       * @name me.loader#getImage
       * @public
       * @function
       * @param {String} Image name of the Image element ("tileset-platformer");
       * @return {Image} 
       */

		obj.getImage= function(elt)
		{	
			if (imgList[elt] != null)
         {
            if (me.sys.cacheImage === true)
            {
               // build a new canvas
               var tempCanvas = me.video.createCanvasSurface(imgList[elt].width, imgList[elt].height);
               // draw the image into the canvas context
               tempCanvas.drawImage(imgList[elt], 0, 0);
               // return our canvas
               return tempCanvas.canvas;
				}
            else
            {  
               // return the corresponding Image object
               return imgList[elt];
            }
         }
         else
			{
				//console.log ("warning %s resource not yet loaded!",name);
				return null;
			}

		};
		
		/**
       * Return the loading progress in percent
       * @name me.loader#getLoadProgress
       * @public
       * @function
       * @deprecated use callback instead
       * @return {Number} 
       */

		obj.getLoadProgress = function()
		{	
			return loadCount / resourceCount;
		};
		
		// return our object
		return obj;

	})();

			
	/*---------------------------------------------------------*/
	// expose our stuff to the global scope
	/*---------------------------------------------------------*/
	$.me.loader							=	loader;
	$.me.DefaultLoadingScreen		=	DefaultLoadingScreen;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
