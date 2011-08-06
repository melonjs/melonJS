/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 */

(function($, undefined)
{	
	// some regexp
	removepath = /^.*(\\|\/|\:)/;
	removeext  =  /\.[^\.]*$/;
	
	
	// some custom level constants
	var LevelConstants =
	{
		//# name of the collision map
		COLLISION_MAP		: "collision",
		PARALLAX_MAP		: "parallax",
	};
	
	/************************************************************************************/
	/*																												*/
	/*		a  Tile object																						*/
	/*																												*/
	/************************************************************************************/
	
	var Tile = me.Rect.extend(
	{
		init: function (x, y, w, h, tileId)
		{	
			this.parent(new me.Vector2d(x * w, y * h), w, h);
			
			// tileID
			this.tileId  = tileId;
			
			this.row		 = x;
			this.col		 = y;
		}
	});
	
	/************************************************************************************/
	/*																												*/
	/*		a  Tileset object																					*/
	/*																												*/
	/************************************************************************************/
	
	function TileSet (name, tilewidth, tileheight,spacing, margin, imagesrc)
	{	
		this.name			= name;
		this.tilewidth		= tilewidth;
		this.tileheight	= tileheight;
		this.spacing		= spacing;
		this.margin			= margin;
		this.image			= (imagesrc) ? me.loader.getImage(imagesrc.replace(removepath, '').replace(removeext, '')) : null;
		
		// tile types
		this.type			= {	SOLID		 : "solid",
										PLATFORM	 : "platform",
										L_SLOPE	 : "lslope",
										R_SLOPE	 : "rslope",
										LADDER	 : "ladder",
										BREAKABLE : "breakable"
									};
		
		// tile properties
		// (collidable, etc..)
		this.TileProperties = [];
		
		// number of tiles per horizontal line 
		if (this.image)
		{
		  this.hTileCount = ~~((this.image.width  - this.margin ) / (this.tilewidth + this.spacing));
		  this.vTileCount = ~~((this.image.height - this.margin ) / (this.tileheight + this.spacing));
		  //console.log("%d tiles", this.hTileCount * this.vTileCount);
		}
		
		
	};
	
	/* -----

		return the list of property for a tile
			
		------								*/

	TileSet.prototype.getPropertyList = function ()
	{
		return {
					// collectable tiles
					//isCollectable	: false,
					// collidable tiles
					isCollidable   : false,
					isSolid			: false,
					isPlatform		: false,
					isSlope			: false,
					isLeftSlope		: false,
					isRightSlope	: false,
					isLadder			: false,
					isBreakable		: false
				 };
	};
	
	/* -----

		return the assiocated property of the specified tile
		
		e.g. getTileProperty (gid)		
		
		------								*/
	
	TileSet.prototype.getTileProperties = function (tileId)
	{
		return this.TileProperties[tileId];
	};

	/* -----

		return collidable status of the specifiled tile
		
		------								*/
	
	TileSet.prototype.isTileCollidable = function (tileId)
	{
		return this.TileProperties[tileId].isCollidable;
	};
	
	/* -----

		return collectable status of the specifiled tile
		
		------								*/
	/*
	TileSet.prototype.isTileCollectable = function (tileId)
	{
		return this.TileProperties[tileId].isCollectable;
	};
	*/


	/* -----

		return an Image Object with the specified tile
			
		------								*/

	TileSet.prototype.getTileImage = function (tileId)
	{
		// create a new image object
		var image = me.video.createCanvasSurface(this.tilewidth, this.tileheight);
		
		this.drawTile(image, 0, 0, tileId);
		
		return image.canvas;
	};

	
	/* -----

		draw the x,y tile
			
		------								*/
	TileSet.prototype.drawTile = function (context, x, y, tileId, flipx, flipy)
	{
      var texturePositionX = this.margin + (this.spacing + this.tilewidth)  * (tileId % this.hTileCount);
      var texturePositionY = this.margin + (this.spacing + this.tileheight) * ~~(tileId / this.hTileCount);
	   
      if (flipx||flipy)
      {
         // "normalize" the flag value
         flipx = (flipx==0)?1.0:-1.0; 
         flipy = (flipy==0)?1.0:-1.0;
         
         context.scale(flipx, flipy);
         
         x = (x * flipx)-(flipx<0?this.tilewidth:0);
			y = (y * flipy)-(flipy<0?this.tileheight:0);
      }
      
		context.drawImage(this.image,
								texturePositionX, texturePositionY,
								this.tilewidth,   this.tileheight,
								x,                y,
								this.tilewidth,   this.tileheight);

      if (flipx||flipy)
      {
         // restore the transform matrix to the normal one
         context.setTransform(1,0,0,1,0,0);
      }
		
   };
	
	/************************************************************************************/
	/*																												*/
	/*		a generic Collision Tile based Layer object												*/
	/*																												*/
	/************************************************************************************/
	function CollisionTiledLayer (realwidth, realheight)
	{	
		this.realwidth		= realwidth;
		this.realheight	= realheight;
		
		this.isCollisionMap = true;

	};
	
	
	/* -----

		test for the world limit
			
		------*/				
	
	CollisionTiledLayer.prototype.checkCollision = function (obj, pv)
	{
		//var x = (pv.x < 0) ? obj.pos.x + obj.colPos.x + pv.x: obj.pos.x + obj.colPos.x + obj.width  + pv.x- 1;
		//var y = (pv.y < 0) ? obj.pos.y + obj.colPos.y + pv.y: obj.pos.y + obj.colPos.y + obj.height + pv.y ;
		
     	var x = (pv.x < 0) ? obj.left + pv.x: obj.right  + pv.x -1;
		var y = (pv.y < 0) ? obj.top  + pv.y: obj.bottom + pv.y ;
      
		//to return tile collision detection
		var collide	= {	x:false,			// true if collision on x axis
								y:false,			// true if collision on y axis
								tile : undefined,
								xprop : {},
								yprop : {}
							};
		
		// test x limits
		if (x<=0||x>=this.realwidth)
		{
			collide.x = true;
		}
		
		// test y limits
		if (y<=0||y>=this.realheight)
		{
			collide.y = true;
		}
		
		return collide;
	};
	
	/************************************************************************************/
	/*																												*/
	/*		a generic Tile based Layer object															*/
	/*																												*/
	/************************************************************************************/
	function TiledLayer (w, h, tileset, z)
	{	
		this.width		= w;
		this.height		= h;
		
		// for displaying order
		this.z			= z;
		
		this.name		= null;
		this.visible	= false;
		
		// data array
		this.layerData = null;
		
		// some lookup table to avoid unecessary math operation
		this.xLUT		= {};
		this.yLUT		= {};
		
		// a reference to the tileset object
		this.tileset		= tileset;
		
		if (tileset)
		{
			this.tilewidth		= tileset.tilewidth;
			this.tileheight	= tileset.tileheight;
		}
		else
		{
			this.tilewidth		= 0;
			this.tileheight	= 0;
		}
		
		// layer "real" size
		this.realwidth		= this.width  * this.tilewidth;
		this.realheight	= this.height * this.tileheight;
	};
	
	/* -----

		Create all required arrays
			
		------								*/
	TiledLayer.prototype.initArray = function (createLookup)
	{
		// initialize the array
		this.layerData = [];//new Array (this.width);
		for(var x= 0; x < this.width+1; x++)
		{		
			this.layerData[x] =  [];//new Array (this.height);
			for(var y=0; y < this.height+1; y++)
			{
				this.layerData[x][y] = null;
			}
		}
		
		// create lookup table to speed up the table access
		// this is only valid for collision layer
		if (createLookup)
		{	
			// initialize the lookuptable
			for (var x=0; x< this.width * this.tilewidth ; x++)
				this.xLUT[x] = ~~(x / this.tilewidth);
				
			for (var y=0; y< this.height * this.tileheight ; y++)
				this.yLUT[y] = ~~(y / this.tileheight);
		
			//console.log(this.xLUT);
		}		
	
	
	};
	
		
	/* -----

		get the x,y tile
			
		------								*/
	TiledLayer.prototype.getTileId = function (x, y)
	{
		//return this.layerData[~~(x / this.tilewidth)][~~(y / this.tileheight)];
		var tile  = this.layerData[this.xLUT[~~x]][this.yLUT[~~y]];
		
		return tile ? tile.tileId : null;
	};
		
	/* -----

		get the x,y tile
			
		------								*/
	TiledLayer.prototype.getTile = function (x, y)
	{
		//return this.layerData[~~(x / this.tilewidth)][~~(y / this.tileheight)];
		return this.layerData[this.xLUT[~~x]][this.yLUT[~~y]];
	};

	
	/* -----

		set the x,y tile
			
		------								*/
	TiledLayer.prototype.setTile = function (x, y, tileId)
	{
		this.layerData[x][y] = new Tile(x, y, this.tilewidth, this.tileheight, tileId);
	};
	
	/* -----

		clear a tile
			
		------								*/
	TiledLayer.prototype.clearTile = function (x, y)
	{
		// clearing tile
		this.layerData[x][y] = null;
	};
	
	/* -----

		check for collision 
		obj - obj
		pv   - projection vector
		
		res : result collision object
			
		------*/								
		
	TiledLayer.prototype.checkCollision = function (obj, pv)
	{
		
		//var x = (pv.x > 0) ? obj.pos.x + obj.colPos.x + obj.width  + pv.x - 1 : obj.pos.x + obj.colPos.x + pv.x; // first pv.x - 1
		//var y = (pv.y > 0) ? obj.pos.y + obj.colPos.y + obj.height + pv.y	: obj.pos.y + obj.colPos.y + pv.y ;
      
		x = (pv.x < 0) ? obj.left + pv.x: obj.right  + pv.x;
		y = (pv.y < 0) ? obj.top  + pv.y: obj.bottom + pv.y;
		//to return tile collision detection
		collide	= {	x		: false,			// true if collision on x axis
                     xtile : undefined,
							xprop : {},
							y		: false,			// true if collision on y axis
							ytile : undefined,
							yprop : {}
						};
		
		//var tile;
		
		//console.log(obj.colPos.x);
		
		if (x<=0||x>=this.realwidth)
		{
			collide.x = true;
		}
		else
		{
         //console.log(obj.bottom);
			// x, bottom corner
			collide.xtile = this.getTile(x, obj.bottom-1);// obj.height - 1
			if (collide.xtile && this.tileset.isTileCollidable(collide.xtile.tileId))
			{
				collide.x		= true;
				collide.xprop	= this.tileset.getTileProperties(collide.xtile.tileId);
			}
			else
			{	
				// x, top corner
				collide.xtile = this.getTile(x, obj.top); 
				if (collide.xtile && this.tileset.isTileCollidable(collide.xtile.tileId))
				{
					collide.x		= true;
					collide.xprop	= this.tileset.getTileProperties(collide.xtile.tileId);
				}
			}
		}
		
		// check for y movement
		// left, y corner
		collide.ytile = this.getTile((pv.x < 0)?obj.left:obj.right, y);// obj.width + 1
		if (collide.ytile && this.tileset.isTileCollidable(collide.ytile.tileId))
		{
			collide.y		= true;
			collide.yprop	= this.tileset.getTileProperties(collide.ytile.tileId);
		}		
		else
		{	// right, y corner
			collide.ytile = this.getTile((pv.x < 0)?obj.right:obj.left, y); 
			if (collide.ytile && this.tileset.isTileCollidable(collide.ytile.tileId))
			{
				collide.y	  = true;
				collide.yprop = this.tileset.getTileProperties(collide.ytile.tileId);
			}
		}
		
		return collide;
	};


	/* -----

		a dummy update function
			
		------								*/
	TiledLayer.prototype.update = function ()
	{
		return false;
	};

	
	/************************************************************************************/
	/*		a basic level object skeleton																	*/
	/************************************************************************************/
	function TileMap(x, y)
	{	
		this.pos				= new me.Vector2d(x, y);
		this.z				= 0;
		
		// tilemap size
		this.width			= 0;
		this.height			= 0;
		
		// realwidth (in pixels) of the level
		this.realwidth		= -1;
		this.realheight	= -1;

		// tile size
		this.tilewidth		= 0;
		this.tileheight	= 0;
		
		// corresponding tileset for this map
		this.tileset		= [];
		
		// map layers
		this.mapLayers		= [];
		
		// map Object
		this.objectGroups = [];
		
		// loading flag
		this.initialized = false;

	};
	
	/* -----

		a dummy update function
			
		------								*/
	TileMap.prototype.reset = function ()
	{
		this.tileset		= [];
		this.mapLayers		= [];
		this.objectGroups = [];
		this.initialized  = false;
	};

	
	/* -----

		return the specified object group
			
		------*/

	TileMap.prototype.getObjectGroupByName = function (name)
	{
		return this.objectGroups[name];
	};
	
	
	/* -----

		return all the object group
			
		------*/

	TileMap.prototype.getObjectGroups = function ()
	{
		return this.objectGroups;
	};

	
	/* -----

		return the specified layer object
			
		------*/

	TileMap.prototype.getLayerByName = function (name)
	{
		var layer = null;
		
		// normalize name
		name = name.trim().toLowerCase();
		for (var i = this.mapLayers.length; i-- ;)
		{
			if (this.mapLayers[i].name.contains(name))
			{
				layer = this.mapLayers[i];
				break;
			}
		};
		
		// return a fake collision layer if not found
		if ((name.contains(LevelConstants.COLLISION_MAP)) && (layer == null))
		{
			layer = new CollisionTiledLayer(me.game.currentLevel.realwidth, me.game.currentLevel.realheight);
		}
		
		return layer;
	};
	
	/*  -----
		
		 clear a tile from all layers
		
		------				*/
	
	TileMap.prototype.clearTile = function (x, y)
	{
		// add all layers
		for (var i = this.mapLayers.length; i-- ;)
		{
			// that are visible
			if (this.mapLayers[i].visible || this.mapLayers[i].isCollisionMap)
			{
				this.mapLayers[i].clearTile(x,y);
			}
		};
	};

	
	/*  -----
		
		 add all visible layers to the game mngr
		
		------				*/
	
	TileMap.prototype.addTo = function (gameMngr)
	{
		// add ourself (for background color)
		if (this.visible)
		{
			gameMngr.add(this);
		}
		
		// add all layers
		for (var i = this.mapLayers.length; i-- ;)
		{
			// that are visible
			if (this.mapLayers[i].visible)
			{
				gameMngr.add(this.mapLayers[i]);
			}
		};
	};
	
	/* -----

		a dummy update function
			
		------								*/
	TileMap.prototype.update = function ()
	{
		return false;
	};


	// TMX extends sprite object to benefit from some
	// nice mechanism (sprite Object to be redone)
	//LevelEntity.prototype = new me.SpriteObject();
	
	
	/************************************************************************************/
	/*																												*/
	/*		a level Director																					*/
	/*																												*/
	/************************************************************************************/
	 /**
	 * a level manager object <br>
    * once ressources loaded, the level director contains all references of defined levels<br>
    * There is no constructor function for me.levelDirector, this is a static object
    * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	levelDirector  = (function()
	{
		// hold public stuff in our singletong
		var obj	= {};
	
		/*---------------------------------------------
			
			PRIVATE STUFF
				
			---------------------------------------------*/		
			
		// our levels
		var levels = {};
		// current level
		var currentLevel = null;
		
		/*---------------------------------------------
			
			PUBLIC STUFF
				
			---------------------------------------------*/
		
		/**
       * reset the level director 
	    * @private
       */
		obj.reset = function()
		{
		
		};
		
		/**
       * add a level  
	    * @private
       */
		obj.addLevel = function(level)
		{
			console.log("no level loader defined");
		};

		/**
       *
		 * add a TMX level  
	    * @private
       */
		obj.addTMXLevel = function(levelId, callback)
		{
			// just load the level with the XML stuff
			if (levels[levelId] == null)
			{
				//console.log("loading "+ levelId);
				levels[levelId] = new me.TMXTileMap(levelId, 0, 0);
			}
			//else console.log("level %s already loaded", levelId);
			
			// call the callback if defined
			if (callback) callback();
		};
		
		/**
		 * load a level into the game manager<br>
       * (will also create all level defined entities, etc..)
		 * @name me.levelDirector#loadLevel
		 * @public
		 * @function
       *	@param {String} level level id
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
		obj.loadLevel = function(level)
		{
			if (levels[level] === undefined)
			{
				console.log("level %s not found",level);
				return;
			}
			
			if (levels[level] instanceof me.TMXTileMap)
			{
				// pause the game loop to avoid some silly side effects
				me.state.pause();
				// reset the gameObject Manager (just in case!)
				me.game.reset();
				// load the level
				levels[level].reset();
				levels[level].load();
				// set the current level
				currentLevel = level;
				// add the specified level to the game manager
				me.game.loadTMXLevel(levels[currentLevel]);
				
				// and resume it
				me.state.resume();
			}
			else
				console.log("no level loader defined");
			
		};
		
		/**
		 * return the current level id<br>
		 * @name me.levelDirector#getCurrentLevelId
		 * @public
		 * @function
       *	@return {String}
       */	
		obj.getCurrentLevelId = function()
		{
			return currentLevel;
		},

		
		/**
		 * reload the current level<br>
		 * @name me.levelDirector#getCurrentLevelId
		 * @public
		 * @function
       */	
      obj.reloadLevel = function()
		{
			// reset the level to initial state
			//levels[currentLevel].reset();
			return obj.loadLevel(currentLevel);
		},

		/**
		 * load the next level<br>
		 * @name me.levelDirector#nextLevel
		 * @public
		 * @function
       */	
		obj.nextLevel = function()
		{  
			//go to the next level 
			if (currentLevel + 1 < levels.length)
			{
				return obj.loadLevel(currentLevel + 1);
			}
			else
			{
				return false;
			}
		};
		
		/**
		 * load the previous level<br>
		 * @name me.levelDirector#previousLevel
		 * @public
		 * @function
       */	
		obj.previousLevel = function()
		{
			 // go to previous level
			 if (currentLevel - 1 >= 0)
			 {
				return obj.loadLevel(currentLevel - 1);
			 }
			 else
			 {
				return false;
			 }
		};
		
		/* -----

			set the specified level  
	
			------ 
      
		obj.goToLevel = function(level)
		{
			obj.loadLevel(level);
		};
      */

			
		// return our object
		return obj;

	})();

	
		
	/*---------------------------------------------------------*/
	// expose our stuff to the global scope
	/*---------------------------------------------------------*/
	$.me.Tile				=	Tile;
	$.me.TileSet			=	TileSet;
	$.me.TiledLayer		=	TiledLayer;
	$.me.TileMap			=	TileMap
	$.me.LevelConstants  =  LevelConstants;
	$.me.levelDirector	=	levelDirector;


/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
