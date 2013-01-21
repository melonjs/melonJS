/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

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
			this.logo1 = new me.Font('century gothic', 32, 'white', 'middle');
			this.logo2 = new me.Font('century gothic', 32, '#89b002', 'middle');
			this.logo2.bold();

			// flag to know if we need to refresh the display
			this.invalidate = false;

			// handle for the susbcribe function
			this.handle = null;
			
			// load progress in percent
			this.loadPercent = 0;
			
		},

		// call when the loader is resetted
		onResetEvent : function() {
			// setup a callback
			this.handle = me.event.subscribe(me.event.LOADER_PROGRESS, this.onProgressUpdate.bind(this));
		},
		
		// destroy object at end of loading
		onDestroyEvent : function() {
			// "nullify" all fonts
			this.logo1 = this.logo2 = null;
			// cancel the callback
			if (this.handle)  {
				me.event.unsubscribe(this.handle);
				this.handle = null;
			}
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
			var logo1_width = this.logo1.measureText(context, "melon").width;
			var xpos = (me.video.getWidth() - logo1_width - this.logo2.measureText(context, "JS").width) / 2;
			var ypos = me.video.getHeight() / 2;
				
			// clear surface
			me.video.clearSurface(context, "black");
			
			// draw the melonJS logo
			this.logo1.draw(context, 'melon', xpos , ypos);
			xpos += logo1_width;
			this.logo2.draw(context, 'JS', xpos, ypos);
			
			ypos += this.logo1.measureText(context, "melon").height / 2;

			// display a progressive loading bar
			var progress = Math.floor(this.loadPercent * me.video.getWidth());

			// draw the progress bar
			context.strokeStyle = "silver";
			context.strokeRect(0, ypos, me.video.getWidth(), 6);
			context.fillStyle = "#89b002";
			context.fillRect(2, ypos + 2, progress - 4, 2);
		}

	});

	/************************************************************************************/
	/*			PRELOADER SINGLETON														*/
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
		var imgList = {};
		// contains all the TMX loaded
		var tmxList = {};
		// contains all the binary files loaded
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
				for ( var tmxObj in tmxList) {
					if (tmxList[tmxObj].isTMX) {
						// load the level into the levelDirector
						if (me.levelDirector.addTMXLevel(tmxObj)) {
							//progress notification
							obj.onResourceLoaded();
						}
					}
				}

				// wait 1/2s and execute callback (cheap workaround to ensure everything is loaded)
				if (obj.onload) {
					// make sure we clear the timer
					clearTimeout(timerId);
					// trigger the onload callback
					setTimeout(function () {
						obj.onload();
						me.event.publish(me.event.LOADER_COMPLETE);
					}, 300);
					// reset tmxcount for next time
					tmxCount = 0;
				} else
					console.error("no load callback defined");
			} else {
				timerId = setTimeout(checkLoadStatus, 100);
			}
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
			// create new Image object and add to list
			imgList[img.name] = new Image();
			imgList[img.name].onload = onload;
			imgList[img.name].onerror = onerror;
			imgList[img.name].src = img.src + me.nocache;
		};

		/**
		 * preload TMX files
		 * @private
		 */
		function preloadTMX(tmxData, onload, onerror) {
			var xmlhttp = new XMLHttpRequest();
			
			if (me.utils.getFileExtension(tmxData.src).toLowerCase() !== 'json') {
				// to ensure our document is treated as a XML file
				if (xmlhttp.overrideMimeType)
					xmlhttp.overrideMimeType('text/xml');
			}
			
			xmlhttp.open("GET", tmxData.src + me.nocache, true);
						
			// set the callbacks
			xmlhttp.ontimeout = onerror;
			xmlhttp.onreadystatechange = function() {
				if (xmlhttp.readyState==4) {
					// status = 0 when file protocol is used, or cross-domain origin,
					// (With Chrome use "--allow-file-access-from-files --disable-web-security")
					if ((xmlhttp.status==200) || ((xmlhttp.status==0) && xmlhttp.responseText)){
						// get the TMX content
						tmxList[tmxData.name] = {
							data: xmlhttp.responseText,
							isTMX: (tmxData.type === "tmx"),
							// Sore the data format ('tmx', 'json')
							type : me.utils.getFileExtension(tmxData.src).toLowerCase()
						};
						// fire the callback
						onload();
					} else {
						onerror();
					}
				}
			};
			
			// send the request
			xmlhttp.send(null);
			
			
		};
			
		/**
		 * preload Binary files
		 * @private
		 */
		function preloadBinary(data, onload, onerror) {
			var httpReq = new XMLHttpRequest();

			// load our file
			httpReq.open("GET", data.src + me.nocache, false);
			httpReq.responseType = "arraybuffer";
			httpReq.onerror = onerror;
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
					onload();
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
			var progress = obj.getLoadProgress();
			if (obj.onProgress) {
				// pass the load progress in percent, as parameter
				obj.onProgress(progress);
			}
			me.event.publish(me.event.LOADER_PROGRESS, [progress]);
		};
		
		/**
		 * on error callback for image loading 	
		 * @private
		 */
		obj.onLoadingError = function(res) {
			throw "melonJS: Failed loading resource " + res.src;
		};


		/**
		 * set all the specified game resources to be preloaded.<br>
		 * each resource item must contain the following fields :<br>
		 * - name    : internal name of the resource<br>
		 * - type    : "binary", "image", "tmx", "tsx", "audio"<br>
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
		 * var g_resources = [ {name: "tileset-platformer",  type: "image",  src: "data/map/tileset-platformer.png"},
		 *                     {name: "meta_tiles",          type: "tsx",    src: "data/map/meta_tiles.tsx"},
		 *                     {name: "map1",                type: "tmx",    src: "data/map/map1.tmx"},
		 *                     {name: "cling",               type: "audio",  src: "data/audio/",        channel: 2},
		 *                     {name: "ymTrack",             type: "binary", src: "data/audio/main.ym"}
		 *                    ];
		 * ...
		 *
		 * // set all resources to be loaded
		 * me.loader.preload(g_resources);
		 */
		obj.preload = function(res) {
			// parse the resources
			for ( var i = 0; i < res.length; i++) {
				resourceCount += obj.load(res[i], obj.onResourceLoaded.bind(obj), obj.onLoadingError.bind(obj, res[i]));
			};
			// check load status
			checkLoadStatus();
		};

		/**
		 * Load a single resource (to be used if you need to load additional resource during the game)<br>
		 * Given parmeter must contain the following fields :<br>
		 * - name    : internal name of the resource<br>
		 * - type    : "binary", "image", "tmx", "tsx", "audio"
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
			// fore lowercase for the resource name
			res.name = res.name.toLowerCase();
			// check ressource type
			switch (res.type) {
				case "binary":
					// reuse the preloadImage fn
					preloadBinary.call(this, res, onload, onerror);
					return 1;

				case "image":
					// reuse the preloadImage fn
					preloadImage.call(this, res, onload, onerror);
					return 1;

				case "tmx":
					preloadTMX.call(this, res, onload, onerror);
					// increase the resourceCount by 1
					// allowing to add the loading of level in the 
					// levelDirector as part of the loading progress
					tmxCount += 1;
					return 2;

				case "tsx":
					preloadTMX.call(this, res, onload, onerror);
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
					throw "melonJS: me.loader.load : unknown or invalid resource type : " + res.type;
					break;
			};
			return 0;
		};

		/**
		 * unload specified resource to free memory
		 * @name me.loader#unload
		 * @public
		 * @function
		 * @param {Object} resource
		 * @return {boolean} true if unloaded
		 * @example me.loader.unload({name: "avatar",  type:"image",  src: "data/avatar.png"});
		 */
		obj.unload = function(res) {
			res.name = res.name.toLowerCase();
			switch (res.type) {
				case "binary":
					if (!(res.name in binList))
						return false;

					delete binList[res.name];
					return true;

				case "image":
					if (!(res.name in imgList))
						return false;

					delete imgList[res.name];
					return true;

				case "tmx":
				case "tsx":
					if (!(res.name in tmxList))
						return false;

					delete tmxList[res.name];
					return true;

				case "audio":
					return me.audio.unload(res.name);

				default:
					throw "melonJS: me.loader.unload : unknown or invalid resource type : " + res.type;
			}
		};

		/**
		 * unload all resources to free memory
		 * @name me.loader#unloadAll
		 * @public
		 * @function
		 * @example me.loader.unloadAll();
		 */
		obj.unloadAll = function() {
			var name;

			// unload all binary resources
			for (name in binList)
				obj.unload(name);

			// unload all image resources
			for (name in imgList)
				obj.unload(name);

			// unload all tmx resources
			for (name in tmxList)
				obj.unload(name);

			// unload all audio resources
			me.audio.unloadAll();
		};

		/**
		 * return the specified TMX object storing type
		 * @name me.loader#getTMXFormat
		 * @public
		 * @function
		 * @param {String} tmx name of the tmx/tsx element ("map1");
		 * @return {String} 'tmx' or 'json'
		 */
		obj.getTMXFormat = function(elt) {
			// avoid case issue
			elt = elt.toLowerCase();
			if (elt in tmxList)
				return tmxList[elt].type;
			else {
				//console.log ("warning %s resource not yet loaded!",name);
				return null;
			}

		};
		/**
		 * return the specified TMX/TSX object
		 * @name me.loader#getTMX
		 * @public
		 * @function
		 * @param {String} tmx name of the tmx/tsx element ("map1");
		 * @return {TMx} 
		 */
		obj.getTMX = function(elt) {
			// avoid case issue
			elt = elt.toLowerCase();
			if (elt in tmxList)
				return tmxList[elt].data;
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
			// avoid case issue
			elt = elt.toLowerCase();
			if (elt in binList)
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
			// avoid case issue
			elt = elt.toLowerCase();
			if (elt in imgList) {
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
