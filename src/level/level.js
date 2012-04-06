/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($, undefined) {
	// some regexp
	var removepath = /^.*(\\|\/|\:)/;
	var removeext = /\.[^\.]*$/;

	// some custom level constants
	me.LevelConstants = {
		//# name of the collision map
		COLLISION_MAP : "collision",
		PARALLAX_MAP : "parallax"
	};

	/**
	 * a basic tile object
	 * @class
	 * @extends me.Rect
	 * @memberOf me
	 * @constructor
	 * @param {int} x x index of the Tile in the map
	 * @param {int} y y index of the Tile in the map
	 * @param {int} w Tile width
	 * @param {int} h Tile height
	 * @param {int} tileId tileId>
	 */
	me.Tile = me.Rect.extend({
		 /**
		  * tileId
		  * @public
		  * @type int
		  * @name me.Tile#tileId
		  */
		tileId : null,
		
		/** @private */
		init : function(x, y, w, h, tileId) {
			this.parent(new me.Vector2d(x * w, y * h), w, h);
			// tileID
			this.tileId = tileId;
			// Tile row / col pos
			this.row = x;
			this.col = y;
		}
	});

	/**
	 * a Tile Set Object
	 * @class
	 * @memberOf me
	 * @constructor
	 */
	me.Tileset = Object.extend({
		// constructor
		init: function (name, tilewidth, tileheight, spacing, margin, imagesrc) {
			this.name = name;
			this.tilewidth = tilewidth;
			this.tileheight = tileheight;
			this.spacing = spacing;
			this.margin = margin;
			this.image = (imagesrc) ? me.loader.getImage(imagesrc.replace(
					removepath, '').replace(removeext, '')) : null;
			
			if (!this.image) {
				console.log("melonJS: '" + imagesrc + "' file for tileset '" + this.name + "' not found!");
			}
			
			
			// tile types
			this.type = {
				SOLID : "solid",
				PLATFORM : "platform",
				L_SLOPE : "lslope",
				R_SLOPE : "rslope",
				LADDER : "ladder",
				BREAKABLE : "breakable"
			};

			// tile properties
			// (collidable, etc..)
			this.TileProperties = [];
			
			// a cache for offset value
			this.tileXOffset = [];
			this.tileYOffset = [];

			// number of tiles per horizontal line 
			if (this.image) {
				this.hTileCount = ~~((this.image.width - this.margin) / (this.tilewidth + this.spacing));
				this.vTileCount = ~~((this.image.height - this.margin) / (this.tileheight + this.spacing));
			}
		},
		
		// return the list of property for a tile
		getPropertyList: function() {
			return {
				// collectable tiles
				//isCollectable	: false,
				// collidable tiles
				isCollidable : false,
				isSolid : false,
				isPlatform : false,
				isSlope : false,
				isLeftSlope : false,
				isRightSlope : false,
				isLadder : false,
				isBreakable : false
			};
		},
		
		// 
		// e.g. getTileProperty (gid)	
		/**
		 * return the properties of the specified tile <br>
		 * the function will return an object with the following boolean value :<br>
		 * - isCollidable<br>
		 * - isSolid<br>
		 * - isPlatform<br>
		 * - isSlope <br>
		 * - isLeftSlope<br>
		 * - isRightSlope<br>
		 * - isLadder<br>
		 * - isBreakable<br>
		 * @name me.Tileset#getTileProperties
		 * @public
		 * @function
		 * @param {Integer} tileId 
		 * @return {Object}
		 */
		getTileProperties: function(tileId) {
			return this.TileProperties[tileId];
		},
		
		//return collidable status of the specifiled tile

		isTileCollidable : function(tileId) {
			return this.TileProperties[tileId].isCollidable;
		},

		/*
		//return collectable status of the specifiled tile
		isTileCollectable : function (tileId) {
			return this.TileProperties[tileId].isCollectable;
		},
		 */

		//return an Image Object with the specified tile
		getTileImage : function(tileId) {
			// create a new image object
			var image = me.video.createCanvasSurface(this.tilewidth, this.tileheight);
			this.drawTile(image, 0, 0, tileId);
			return image.canvas;
		},
		
		// return the x offset of the specified tile in the tileset image
		getTileOffsetX : function(tileId) {
			if (this.tileXOffset[tileId] == null) {
				this.tileXOffset[tileId] = this.margin + (this.spacing + this.tilewidth)  * (tileId % this.hTileCount);
			}
			return this.tileXOffset[tileId];
		},
		
		// return the y offset of the specified tile in the tileset image
		getTileOffsetY : function(tileId) {
			if (this.tileYOffset[tileId] == null) {
				this.tileYOffset[tileId] = this.margin + (this.spacing + this.tileheight)	* ~~(tileId / this.hTileCount);
			}
			return this.tileYOffset[tileId];
		},
		

		// draw the x,y tile
		drawTile : function(context, dx, dy, tileId, flipx, flipy, flipad) {
			// check if any transformation is required
			if (flipx || flipy || flipad) {
				var m11 = 1; // Horizontal scaling factor
				var m12 = 0; // Vertical shearing factor
				var m21 = 0; // Horizontal shearing factor
				var m22 = 1; // Vertical scaling factor
				var mx	= dx; 
				var my	= dy;
				// set initial value to zero since we use a transform matrix
				dx = dy = 0;
				
				if (flipad){
					// Use shearing to swap the X/Y axis
					m11=0;
					m12=1;
					m21=1;
					m22=0;
					// Compensate for the swap of image dimensions
					my += this.tileheight - this.tilewidth;
				}
				if (flipx){
					m11 = -m11;
					m21 = -m21;
					mx += flipad ? this.tileheight : this.tilewidth;
					
				}
				if (flipy){
					m12 = -m12;
					m22 = -m22;
					my += flipad ? this.tilewidth : this.tileheight;
				}
				// set the transform matrix
				context.setTransform(m11, m12, m21, m22, mx, my);
			}
			
			// draw the tile
			context.drawImage(this.image, 
							  this.getTileOffsetX(tileId), this.getTileOffsetY(tileId),
							  this.tilewidth, this.tileheight, 
							  dx, dy, 
							  this.tilewidth, this.tileheight);

			if  (flipx || flipy || flipad)  {
				// restore the transform matrix to the normal one
				context.setTransform(1, 0, 0, 1, 0, 0);
			}
		}
	});

	/**
	 * a generic collision tile based layer object
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	CollisionTiledLayer = Object.extend({
		// constructor
		init: function CollisionTiledLayer(realwidth, realheight) {
			this.realwidth = realwidth;
			this.realheight = realheight;

			this.isCollisionMap = true;

		},


		/**
		 * only test for the world limit
		 * @private
		 **/

		checkCollision : function(obj, pv) {
			var x = (pv.x < 0) ? obj.left + pv.x : obj.right + pv.x;
			var y = (pv.y < 0) ? obj.top + pv.y : obj.bottom + pv.y;

			//to return tile collision detection
			var res = {
				x : 0, // !=0 if collision on x axis
				y : 0, // !=0 if collision on y axis
				xprop : {},
				yprop : {}
			};

			// test x limits
			if (x <= 0 || x >= this.realwidth) {
				res.x = pv.x;
			}

			// test y limits
			if (y <= 0 || y >= this.realheight) {
				res.y = pv.y;
			}

			// return the collide object if collision
			return res;
		}
	});

	/**
	 * a generic tile based layer object
	 * @class
	 * @memberOf me
	 * @constructor
	 */
	me.TiledLayer = Object.extend({
		// constructor
		init: function(w, h, tw, th, tilesets, z) {
			this.width = w;
			this.height = h;
			// tile width & height
			this.tilewidth  = tw;
			this.tileheight = th;
			
			// layer "real" size
			this.realwidth = this.width * this.tilewidth;
			this.realheight = this.height * this.tileheight;

			// for displaying order
			this.z = z;

			this.name = null;
			this.visible = false;

			// data array
			this.layerData = null;

			// some lookup table to avoid unecessary math operation
			this.xLUT = {};
			this.yLUT = {};

			/**
			 * The Layer corresponding Tilesets
			 * @public
			 * @type me.TMXTilesetGroup
			 * @name me.TiledLayer#tilesets
			 */
			this.tilesets = tilesets;

			// the default tileset
			this.tileset = tilesets?this.tilesets.getTilesetByIndex(0):null;
		},

		/**
		 * Create all required arrays
		 * @private
		 */
		initArray : function(createLookup) {
			// initialize the array
			this.layerData = [];//new Array (this.width);
			for ( var x = 0; x < this.width + 1; x++) {
				this.layerData[x] = [];//new Array (this.height);
				for ( var y = 0; y < this.height + 1; y++) {
					this.layerData[x][y] = null;
				}
			}
			// create lookup table to speed up the table access
			// this is only valid for collision layer
			if (createLookup) {
				// initialize the lookuptable
				for ( var x = 0; x < this.width * this.tilewidth; x++)
					this.xLUT[x] = ~~(x / this.tilewidth);

				for ( var y = 0; y < this.height * this.tileheight; y++)
					this.yLUT[y] = ~~(y / this.tileheight);

				//console.log(this.xLUT);
			}
		},
		
		/**
		 * Return the TileId of the Tile at the specified position
		 * @name me.TiledLayer#getTileId
		 * @public
		 * @function
		 * @param {Integer} x x position 
		 * @param {Integer} y y position
		 * @return {Int} TileId
		 */
		getTileId : function(x, y) {
			//xLut = x / this.tilewidth, yLut = y / this.tileheight;
			var tile = this.layerData[this.xLUT[x]][this.yLUT[y]];
			return tile ? tile.tileId : null;
		},
		
		/**
		 * Return the Tile object at the specified position
		 * @name me.TiledLayer#getTile
		 * @public
		 * @function
		 * @param {Integer} x x position 
		 * @param {Integer} y y position
		 * @return {me.Tile} Tile Object
		 */
		getTile : function(x, y) {
			//xLut = x / this.tilewidth, yLut = y / this.tileheight;
			return this.layerData[this.xLUT[x]][this.yLUT[y]];
		},

		/**
		 * Create a new Tile at the specified position
		 * @name me.TiledLayer#setTile
		 * @public
		 * @function
		 * @param {Integer} x x position 
		 * @param {Integer} y y position
		 * @param {Integer} tileId tileId
		 */
		setTile : function(x, y, tileId) {
			this.layerData[x][y] = new me.Tile(x, y, this.tilewidth, this.tileheight, tileId);
		},

		/**
		 * clear the tile at the specified position
		 * @name me.TiledLayer#clearTile
		 * @public
		 * @function
		 * @param {Integer} x x position 
		 * @param {Integer} y y position 
		 */
		clearTile : function(x, y) {
			// clearing tile
			this.layerData[x][y] = null;
		},

		/**
		 * check for collision
		 * obj - obj
		 * pv   - projection vector
		 * res : result collision object
		 * @private
		 */
		checkCollision : function(obj, pv) {

			var x = (pv.x < 0) ? ~~(obj.left + pv.x) : Math.ceil(obj.right  - 1 + pv.x);
			var y = (pv.y < 0) ? ~~(obj.top  + pv.y) : Math.ceil(obj.bottom - 1 + pv.y);
			//to return tile collision detection
			var res = {
				x : 0, // !=0 if collision on x axis
				xtile : undefined,
				xprop : {},
				y : 0, // !=0 if collision on y axis
				ytile : undefined,
				yprop : {}
			};
			
			//var tile;
			if (x <= 0 || x >= this.realwidth) {
				res.x = pv.x;
			} else if (pv.x != 0 ) {
				// x, bottom corner
				res.xtile = this.getTile(x, Math.ceil(obj.bottom - 1));
				if (res.xtile && this.tileset.isTileCollidable(res.xtile.tileId)) {
					res.x = pv.x; // reuse pv.x to get a 
					res.xprop = this.tileset.getTileProperties(res.xtile.tileId);
				} else {
					// x, top corner
					res.xtile = this.getTile(x, ~~obj.top);
					if (res.xtile && this.tileset.isTileCollidable(res.xtile.tileId)) {
						res.x = pv.x;
						res.xprop = this.tileset.getTileProperties(res.xtile.tileId);
					}
				}
			}
			
			// check for y movement
			// left, y corner
			if ( pv.y != 0 ) {
				res.ytile = this.getTile((pv.x < 0) ? ~~obj.left : Math.ceil(obj.right - 1), y);
				if (res.ytile && this.tileset.isTileCollidable(res.ytile.tileId)) {
					res.y = pv.y || 1;
					res.yprop = this.tileset.getTileProperties(res.ytile.tileId);
				} else { // right, y corner
					res.ytile = this.getTile((pv.x < 0) ? Math.ceil(obj.right - 1) : ~~obj.left, y);
					if (res.ytile && this.tileset.isTileCollidable(res.ytile.tileId)) {
						res.y = pv.y || 1;
						res.yprop = this.tileset.getTileProperties(res.ytile.tileId);
					}
				}
			}
			// return the collide object
			return res;
		},

		/**
		 * a dummy update function
		 * @private
		 */
		update : function() {
			return false;
		}
	});
	
	/**
	 * a basic level object skeleton
	 * @class
	 * @memberOf me
	 * @constructor
	 */
	me.TileMap = Object.extend({
		// constructor
		init: function(x, y) {
			this.pos = new me.Vector2d(x, y);
			this.z = 0;
			
			/**
			 * name of the tilemap
			 * @public
			 * @type String
			 * @name me.TileMap#name
			 */
			this.name = null;
			
			/**
			 * width of the tilemap in Tile
			 * @public
			 * @type Int
			 * @name me.TileMap#width
			 */
			this.width = 0;
			
			/**
			 * height of the tilemap in Tile
			 * @public
			 * @type Int
			 * @name me.TileMap#height
			 */
			this.height = 0;

			/**
			 * width of the tilemap in pixels
			 * @public
			 * @type Int
			 * @name me.TileMap#realwidth
			 */
			this.realwidth = -1;
			
			/**
			 * height of the tilemap in pixels
			 * @public
			 * @type Int
			 * @name me.TileMap#realheight
			 */
			this.realheight = -1;

			/**
			 * Tile width
			 * @public
			 * @type Int
			 * @name me.TileMap#tilewidth
			 */
			this.tilewidth = 0;

			/**
			 * Tile height
			 * @public
			 * @type Int
			 * @name me.TileMap#tileheight
			 */
			this.tileheight = 0;

			// corresponding tileset for this map
			this.tilesets = null;

			// map layers
			this.mapLayers = [];

			// map Object
			this.objectGroups = [];

			// loading flag
			this.initialized = false;
		},

		/**
		 * a dummy update function
		 * @private
		 */
		reset : function() {
			this.tilesets = null;
			this.mapLayers.length = 0;
			this.objectGroups.length = 0;
			this.initialized = false;
		},

		/**
		 * return the specified object group
		 * @private	
		 */
		getObjectGroupByName : function(name) {
			return this.objectGroups[name];
		},

		/**
		 * return all the object group
		 * @private		
		 */
		getObjectGroups : function() {
			return this.objectGroups;
		},

		/**
		 * return the specified layer object
		 * @name me.TileMap#getLayerByName
		 * @public
		 * @function
		 * @param {String} name Layer Name 
		 * @return {me.TiledLayer} Layer Object
		 */
		getLayerByName : function(name) {
			var layer = null;

			// normalize name
			name = name.trim().toLowerCase();
			for ( var i = this.mapLayers.length; i--;) {
				if (this.mapLayers[i].name.toLowerCase().contains(name)) {
					layer = this.mapLayers[i];
					break;
				}
			};

			// return a fake collision layer if not found
			if ((name.toLowerCase().contains(me.LevelConstants.COLLISION_MAP)) && (layer == null)) {
				layer = new CollisionTiledLayer(me.game.currentLevel.realwidth,	me.game.currentLevel.realheight);
			}

			return layer;
		},

		/**
		 * clear the tile at the specified position from all layers
		 * @name me.TileMap#clearTile
		 * @public
		 * @function
		 * @param {Integer} x x position 
		 * @param {Integer} y y position 
		 */
		clearTile : function(x, y) {
			// add all layers
			for ( var i = this.mapLayers.length; i--;) {
				// that are visible
				if (this.mapLayers[i].visible || this.mapLayers[i].isCollisionMap) {
					this.mapLayers[i].clearTile(x, y);
				}
			};
		},

		/**
		 * add all visible layers to the game mngr
		 * @private
		 */
		addTo : function(gameMngr) {
			// add ourself (for background color)
			if (this.visible) {
				gameMngr.add(this);
			}
			// add all layers
			for ( var i = this.mapLayers.length; i--;) {
				// that are visible
				if (this.mapLayers[i].visible) {
					gameMngr.add(this.mapLayers[i]);
				}
			};
		},

		/**
		 * a dummy update function
		 * @private
		 */
		 update : function() {
			return false;
		}
	});
	/************************************************************************************/
	/*                                                                                  */
	/*      a level Director                                                            */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * a level manager object <br>
	 * once ressources loaded, the level director contains all references of defined levels<br>
	 * There is no constructor function for me.levelDirector, this is a static object
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.levelDirector = (function() {
		// hold public stuff in our singletong
		var obj = {};

		/*---------------------------------------------
			
			PRIVATE STUFF
				
			---------------------------------------------*/

		// our levels
		var levels = {};
		// level index table
		var levelIdx = [];
		// current level index
		var currentLevelIdx = 0;
		
		/*---------------------------------------------
			
			PUBLIC STUFF
				
  		  ---------------------------------------------*/
		/**
		 * reset the level director 
		 * @private
		 */
		obj.reset = function() {

		};

		/**
		 * add a level  
		 * @private
		 */
		obj.addLevel = function(level) {
			throw "melonJS: no level loader defined";
		};

		/**
		 *
		 * add a TMX level  
		 * @private
		 */
		obj.addTMXLevel = function(levelId, callback) {
			// just load the level with the XML stuff
			if (levels[levelId] == null) {
				//console.log("loading "+ levelId);
				levels[levelId] = new me.TMXTileMap(levelId, 0, 0);
				// set the name of the level
				levels[levelId].name = levelId;
				// level index
				levelIdx[levelIdx.length] = levelId;
			}
			//else console.log("level %s already loaded", levelId);

			// call the callback if defined
			if (callback)
				callback();
		};

		/**
		 * load a level into the game manager<br>
		 * (will also create all level defined entities, etc..)
		 * @name me.levelDirector#loadLevel
		 * @public
		 * @function
		 * @param {String} level level id
		 * @example
		 * // the game defined ressources
		 * // to be preloaded by the loader
		 * // TMX maps
		 * ...
		 * {name: "a4_level1",   type: "tmx",   src: "data/level/a4_level1.tmx"},
		 * {name: "a4_level2",   type: "tmx",   src: "data/level/a4_level2.tmx"},
		 * {name: "a4_level3",   type: "tmx",   src: "data/level/a4_level3.tmx"},
		 * ...
		 * ...
		 * // load a level
		 * me.levelDirector.loadLevel("a4_level1");
		 */
		obj.loadLevel = function(levelId) {
			// make sure it's a string
			levelId = levelId.toString().toLowerCase();
			// throw an exception if not existing
			if (levels[levelId] === undefined) {
				throw ("melonJS: level " + levelId + " not found");
			}

			if (levels[levelId] instanceof me.TMXTileMap) {

				// check the status of the state mngr
				var isRunning = me.state.isRunning();

				if (isRunning) {
					// pause the game loop to avoid 
					// some silly side effects
					me.state.pause();
				}

				// reset the gameObject Manager (just in case!)
				me.game.reset();
				
				// reset the GUID generator
				// and pass the level id as parameter
				me.utils.resetGUID(levelId);
				
				// load the level
				levels[levelId].reset();
				levels[levelId].load();
			
				// update current level index
				currentLevelIdx = levelIdx.indexOf(levelId);
				
				// add the specified level to the game manager
				me.game.loadTMXLevel(levels[levelId]);
				
				if (isRunning) {
					// resume the game loop if it was
					// previously running
					me.state.resume();
				}
			} else
				throw "melonJS: no level loader defined";
			
			return true;
		};

		/**
		 * return the current level id<br>
		 * @name me.levelDirector#getCurrentLevelId
		 * @public
		 * @function
		 * @return {String}
		 */
		obj.getCurrentLevelId = function() {
			return levelIdx[currentLevelIdx];
		},

		/**
		 * reload the current level<br>
		 * @name me.levelDirector#reloadLevel
		 * @public
		 * @function
		 */
		obj.reloadLevel = function() {
			// reset the level to initial state
			//levels[currentLevel].reset();
			return obj.loadLevel(obj.getCurrentLevelId());
		},

		/**
		 * load the next level<br>
		 * @name me.levelDirector#nextLevel
		 * @public
		 * @function
		 */
		obj.nextLevel = function() {
			//go to the next level 
			if (currentLevelIdx + 1 < levelIdx.length) {
				return obj.loadLevel(levelIdx[currentLevelIdx + 1]);
			} else {
				return false;
			}
		};

		/**
		 * load the previous level<br>
		 * @name me.levelDirector#previousLevel
		 * @public
		 * @function
		 */
		obj.previousLevel = function() {
			// go to previous level
			if (currentLevelIdx - 1 >= 0) {
				return obj.loadLevel(levelIdx[currentLevelIdx - 1]);
			} else {
				return false;
			}
		};

		// return our object
		return obj;

	})();
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
