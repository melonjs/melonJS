/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://www.melonjs.org
 *
 *
 */

(function($, undefined) {

	/**
	 * a default loading screen
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.DefaultLoadingScreen = me.ScreenObject.extend({
		/*---
		
			constructor
			
			---*/
		init : function() {
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
		onDestroyEvent : function() {
			// "nullify" all fonts
			this.logo1 = this.logo2 = null;
		},

		// make sure the screen is refreshed every frame 
		onProgressUpdate : function(progress) {
			this.loadPercent = progress;
			this.invalidate = true;
		},

		// make sure the screen is refreshed every frame 
		update : function() {
			if (this.invalidate === true) {
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

		draw : function(context) {
			
			// measure the logo size
			var y = context.canvas.height / 2;
			var logo1_width = this.logo1.measureText(context, "melon").width;
			var logo_width = logo1_width + this.logo2.measureText(context, "JS").width;
			
			// clear surface
			me.video.clearSurface(context, "black");
			
			// draw the melonJS logo
			this.logo1.draw(context, 'melon',
					((context.canvas.width - logo_width) / 2),
					(context.canvas.height + 60) / 2);
			this.logo2.draw(context, 'JS',
					((context.canvas.width - logo_width) / 2) + logo1_width,
					(context.canvas.height + 60) / 2);
			// add the height of the logo
			y += 40;

			// display a progressive loading bar
			var width = Math.floor(this.loadPercent * context.canvas.width);

			// draw the progress bar
			context.strokeStyle = "silver";
			context.strokeRect(0, y, context.canvas.width, 6);
			context.fillStyle = "#89b002";
			context.fillRect(2, y + 2, width - 4, 2);
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

	me.loader = (function() {
		// hold public stuff in our singletong
		var obj = {};

		// contains all the images loaded
		var imgList = [];
		// contains all the xml loaded
		var xmlList = {};
		// contains all the xml loaded
		var binList = {};
		// flag to check loading status
		var resourceCount = 0;
		var loadCount = 0;
		var timerId = 0;
		// keep track of how much TMX file we are loading
		var tmxCount = 0;


		/**
		 * check the loading status
		 * @private
		 */
		function checkLoadStatus() {
			// remove tmxCount from the total resource to be loaded
			// as we will after load each TMX into the level director
			if (loadCount == (resourceCount - tmxCount)) {

				// add all TMX level into the level Director
				for ( var xmlObj in xmlList) {
					if (xmlList[xmlObj].isTMX) {
						// load the level into the levelDirector
						me.levelDirector.addTMXLevel(xmlObj);
						//progress notification
						obj.onResourceLoaded();
					}
				}

				// wait 1/2s and execute callback (cheap workaround to ensure everything is loaded)
				if (obj.onload) {
					timerId = setTimeout(obj.onload, 300);
				} else
					alert("no load callback defined");
			} else {
				timerId = setTimeout(checkLoadStatus, 100);
			}
		};

		/**
		 * on error callback for image loading 	
		 * @private
		 */
		function onImageError(e) {
			// retry mechanism with image loading ???
			throw "melonJS: Failed loading image resource";
		};

		/**
		 * load Images
		 *	
		 *	call example : 
		 *	
		 *	preloadImages(
		 *				 [{name: 'image1', src: 'images/image1.png'},
		 * 				  {name: 'image2', src: 'images/image2.png'},
		 *				  {name: 'image3', src: 'images/image3.png'},
		 *				  {name: 'image4', src: 'images/image4.png'}]);
		 * @private
		 */
		
		function preloadImage(img, onload, onerror) {
			// create new Image object and add to array
			imgList.push(img.name);

			imgList[img.name] = new Image();
			imgList[img.name].onload = onload;
			imgList[img.name].onerror = onerror;
			imgList[img.name].src = img.src + me.nocache;
		};

		/**
		 * preload XML files
		 * @private
		 */
		function preloadXML(xmlData, isTMX, onload, onerror) {
			var onloadCB = onload;
			if ($.XMLHttpRequest) {
				// code for IE7+, Firefox, Chrome, Opera, Safari
				var xmlhttp = new XMLHttpRequest();
				// to ensure our document is treated as a XML file
				if (xmlhttp.overrideMimeType)
					xmlhttp.overrideMimeType('text/xml');
			} else {
				// code for IE6, IE5
				var xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
				// I actually don't give a **** about IE5/IE6...
			}
			// load our XML
			xmlhttp.open("GET", xmlData.src + me.nocache, false);
			xmlhttp.onload = function(event) {
				// set the xmldoc in the array
				xmlList[xmlData.name] = {};
				xmlList[xmlData.name].xml = xmlhttp.responseText;
				xmlList[xmlData.name].isTMX = isTMX;
				// callback
				onloadCB();
			};
			// increase the resourceCount by 1
			// allowing to add the loading of level in the 
			// levelDirector as part of the loading progress
			if (isTMX) {
				// some context issue ? (why this?)
				this.resourceCount += 1;
				this.tmxCount += 1;
			}
			// send the request
			xmlhttp.send();

		};
			
		/**
		 * preload Binary files
		 * @private
		 */
		function preloadBinary(data, onload, onerror) {
			var onloadCB = onload;
			var httpReq = new XMLHttpRequest();

			// load our file
			httpReq.open("GET", data.src + me.nocache, false);
			httpReq.responseType = "arraybuffer";

			httpReq.onload = function(event){
				var arrayBuffer = httpReq.response;
				if (arrayBuffer) {
					var byteArray = new Uint8Array(arrayBuffer);
					var buffer = [];
					binList[data.name] = new dataType();
					for (var i = 0; i < byteArray.byteLength; i++) { 
						buffer[i] = String.fromCharCode(byteArray[i]);
					}
					binList[data.name].data = buffer.join("");
					// callback
					onloadCB();
				}
			};
			httpReq.send();
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

		obj.onResourceLoaded = function(e) {

			// increment the loading counter
			loadCount++;

			// callback ?
			if (obj.onProgress) {
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
		 * var g_resources = [ {name: "tileset-platformer",  type:"image",   src: "data/map/tileset-platformer.png"},
		 *                     {name: "map1",                type: "tmx",    src: "data/map/map1_slopes.tmx"},
		 *                     {name: "cling",               type: "audio",  src: "data/audio/",	channel : 2},
		 *                     {name: "ymTrack",             type: "binary", src: "data/audio/main.ym"}
		 *					
		 *                    ]; 
		 * ...
		 *
		 * // set all resources to be loaded
		 * me.loader.preload(g_resources);
		 */
		obj.preload = function(res) {
			// parse the resources
			for ( var i = 0; i < res.length; i++) {
				resourceCount += obj.load(res[i], obj.onResourceLoaded.bind(obj), null);
			};
			// check load status
			checkLoadStatus();
		};

		/**
		 * Load a single resource (to be used if you need to load additional resource during the game)<br>
		 * Given parmeter must contain the following fields :<br>
		 * - name    : internal name of the resource<br>
		 * - type    : "binary", "image", "tmx", "audio"
		 * - src     : path and file name of the resource<br>
		 * @name me.loader#load
		 * @public
		 * @function
		 * @param {Object} resource
		 * @param {Function} onload function to be called when the resource is loaded
		 * @param {Function} onerror function to be called in case of error
		 * @example
		 * // load a image asset
		 * me.loader.load({name: "avatar",  type:"image",  src: "data/avatar.png"}, this.onload.bind(this), this.onerror.bind(this));
		 */

		obj.load = function(res, onload, onerror) {
			// check ressource type
			switch (res.type) {
				case "binary":
					// reuse the preloadImage fn
					preloadBinary(res, onload, (onerror || onImageError.bind(this)));
					return 1;

				case "image":
					// reuse the preloadImage fn
					preloadImage(res, onload, onerror);
					return 1;

				case "tmx":
					preloadXML(res, true, onload, onerror);
					return 1;
				
				case "audio":
					me.audio.setLoadCallback(onload);
					// only load is sound is enable
					if (me.audio.isAudioEnable()) {
						me.audio.load(res);
						return 1;
					}
					break;

				default:
					throw "melonJS: me.loader.load : unknow or invalide resource type : %s"	+ res.type;
					break;
			};
			return 0;
		};


		/**
		 * return the specified XML object
		 * @name me.loader#getXML
		 * @public
		 * @function
		 * @param {String} xmlfile name of the xml element ("map1");
		 * @return {Xml} 
		 */
		obj.getXML = function(elt) {
			if (xmlList != null)
				return xmlList[elt].xml;
			else {
				//console.log ("warning %s resource not yet loaded!",name);
				return null;
			}

		};
		
		/**
		 * return the specified Binary object
		 * @name me.loader#getBinary
		 * @public
		 * @function
		 * @param {String} name of the binary object ("ymTrack");
		 * @return {Object} 
		 */
		obj.getBinary = function(elt) {
			if (binList != null)
				return binList[elt];
			else {
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

		obj.getImage = function(elt) {
			if (imgList[elt] != null) {
				if (me.sys.cacheImage === true) {
					// build a new canvas
					var tempCanvas = me.video.createCanvasSurface(
							imgList[elt].width, imgList[elt].height);
					// draw the image into the canvas context
					tempCanvas.drawImage(imgList[elt], 0, 0);
					// return our canvas
					return tempCanvas.canvas;
				} else {
					// return the corresponding Image object
					return imgList[elt];
				}
			} else {
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

		obj.getLoadProgress = function() {
			return loadCount / resourceCount;
		};

		// return our object
		return obj;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
