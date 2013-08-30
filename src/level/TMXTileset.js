/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/	
 *
 */

(function($) {
	
	
	/**************************************************/
	/*                                                */
	/*      Tileset Management                        */
	/*                                                */
	/**************************************************/
	
	// bitmask constants to check for flipped & rotated tiles
	var FlippedHorizontallyFlag    = 0x80000000;
	var FlippedVerticallyFlag      = 0x40000000;
	var FlippedAntiDiagonallyFlag  = 0x20000000;

	
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
	 * @param {int} tileId tileId
	 */
	me.Tile = me.Rect.extend({
		/**
		 * tileId
		 * @public
		 * @type int
		 * @name me.Tile#tileId
		 */
		tileId : null,
		
		/** @ignore */
		init : function(x, y, w, h, gid) {
			this.parent(new me.Vector2d(x * w, y * h), w, h);
			
			// Tile col / row pos
			this.col = x;
			this.row = y;
			
			this.tileId = gid;
			
			/**
			 * True if the tile is flipped horizontally<br>
			 * @public
			 * @type Boolean
			 * @name me.Tile#flipX
			 */
			this.flipX  = (this.tileId & FlippedHorizontallyFlag) !== 0;
			
			/**
			 * True if the tile is flipped vertically<br>
			 * @public
			 * @type Boolean
			 * @name me.Tile#flipY
			 */
			this.flipY  = (this.tileId & FlippedVerticallyFlag) !== 0;
			
			/**
			 * True if the tile is flipped anti-diagonally<br>
			 * @public
			 * @type Boolean
			 * @name me.Tile#flipAD
			 */
			this.flipAD = (this.tileId & FlippedAntiDiagonallyFlag) !== 0;
			
			/**
			 * Global flag that indicates if the tile is flipped<br>
			 * @public
			 * @type Boolean
			 * @name me.Tile#flipped
			 */
			this.flipped = this.flipX || this.flipY || this.flipAD;
			
			// clear out the flags and set the tileId
			this.tileId &= ~(FlippedHorizontallyFlag | FlippedVerticallyFlag | FlippedAntiDiagonallyFlag);

		}
	});
	
    /**
	 * a TMX Tile Set Object
	 * @class
	 * @memberOf me
	 * @constructor
	 */
	me.TMXTileset = Object.extend({
		
		
		// tile types
		type : {
			SOLID : "solid",
			PLATFORM : "platform",
			L_SLOPE : "lslope",
			R_SLOPE : "rslope",
			LADDER : "ladder",
			TOPLADDER : "topladder",
			BREAKABLE : "breakable"
		},

		init: function() {
			// tile properties (collidable, etc..)
			this.TileProperties = [];

			// a cache for offset value
			this.tileXOffset = [];
			this.tileYOffset = [];
		},

		// constructor
		initFromXML: function (xmltileset) {

			// first gid
			this.firstgid = me.mapReader.TMXParser.getIntAttribute(xmltileset, me.TMX_TAG_FIRSTGID);
			

			var src = me.mapReader.TMXParser.getStringAttribute(xmltileset, me.TMX_TAG_SOURCE);
			if (src) {
				// load TSX
				src = me.utils.getBasename(src);
				xmltileset = me.loader.getTMX(src);

				if (!xmltileset) {
					throw "melonJS:" + src + " TSX tileset not found";
				}

				// FIXME: This is ok for now, but it wipes out the
				// XML currently loaded into the global `me.mapReader.TMXParser`
				me.mapReader.TMXParser.parseFromString(xmltileset);
				xmltileset = me.mapReader.TMXParser.getFirstElementByTagName("tileset");
			}
			
			this.name = me.mapReader.TMXParser.getStringAttribute(xmltileset, me.TMX_TAG_NAME);
			this.tilewidth = me.mapReader.TMXParser.getIntAttribute(xmltileset, me.TMX_TAG_TILEWIDTH);
			this.tileheight = me.mapReader.TMXParser.getIntAttribute(xmltileset, me.TMX_TAG_TILEHEIGHT);
			this.spacing = me.mapReader.TMXParser.getIntAttribute(xmltileset, me.TMX_TAG_SPACING, 0);
			this.margin = me.mapReader.TMXParser.getIntAttribute(xmltileset, me.TMX_TAG_MARGIN, 0);
		

			// set tile offset properties (if any)
			this.tileoffset = new me.Vector2d(0,0);
			var offset = xmltileset.getElementsByTagName(me.TMX_TAG_TILEOFFSET);
			if (offset.length>0) {
				this.tileoffset.x = me.mapReader.TMXParser.getIntAttribute(offset[0], me.TMX_TAG_X);
				this.tileoffset.y = me.mapReader.TMXParser.getIntAttribute(offset[0], me.TMX_TAG_Y);
			}
			
			// set tile properties, if any
			var tileInfo = xmltileset.getElementsByTagName(me.TMX_TAG_TILE);
			for ( var i = 0; i < tileInfo.length; i++) {
				var tileID = me.mapReader.TMXParser.getIntAttribute(tileInfo[i], me.TMX_TAG_ID) + this.firstgid;
				// apply tiled defined properties
				var prop = {};
				me.TMXUtils.applyTMXPropertiesFromXML(prop, tileInfo[i]);
				this.setTileProperty(tileID, prop);
			}
			
			// check for the texture corresponding image
			var imagesrc = xmltileset.getElementsByTagName(me.TMX_TAG_IMAGE)[0].getAttribute(me.TMX_TAG_SOURCE);
			var image = (imagesrc) ? me.loader.getImage(me.utils.getBasename(imagesrc)):null;
			if (!image) {
				console.log("melonJS: '" + imagesrc + "' file for tileset '" + this.name + "' not found!");
			}
			// check if transparency is defined for a specific color
			var trans = xmltileset.getElementsByTagName(me.TMX_TAG_IMAGE)[0].getAttribute(me.TMX_TAG_TRANS);
			
			this.initFromImage(image, trans);
			
		},
		
		// constructor
		initFromJSON: function (tileset) {
			// first gid
			this.firstgid = tileset[me.TMX_TAG_FIRSTGID];

			var src = tileset[me.TMX_TAG_SOURCE];
			if (src) {
				// load TSX
				src = me.utils.getBasename(src);
				// replace tiletset with a local variable
				var tileset = me.loader.getTMX(src);

				if (!tileset) {
					throw "melonJS:" + src + " TSX tileset not found";
				}
				// normally tileset shoudld directly contains the required 
				//information : UNTESTED as I did not find how to generate a JSON TSX file
			}
			
			this.name = tileset[me.TMX_TAG_NAME];
			this.tilewidth = parseInt(tileset[me.TMX_TAG_TILEWIDTH]);
			this.tileheight = parseInt(tileset[me.TMX_TAG_TILEHEIGHT]);
			this.spacing = parseInt(tileset[me.TMX_TAG_SPACING] || 0);
			this.margin = parseInt(tileset[me.TMX_TAG_MARGIN] ||0);
		
			// set tile offset properties (if any)
			this.tileoffset = new me.Vector2d(0,0);
			var offset = tileset[me.TMX_TAG_TILEOFFSET];
			if (offset) {
				this.tileoffset.x = parseInt(offset[me.TMX_TAG_X]);
				this.tileoffset.y = parseInt(offset[me.TMX_TAG_Y]);
			}
			
			var tileInfo = tileset["tileproperties"];
			// set tile properties, if any
			for(var i in tileInfo) {
				var prop = {};
				me.TMXUtils.mergeProperties(prop, tileInfo[i]);
				this.setTileProperty(parseInt(i) + this.firstgid, prop);
			}
			
			// check for the texture corresponding image
			var imagesrc = me.utils.getBasename(tileset[me.TMX_TAG_IMAGE]);
			var image = imagesrc ? me.loader.getImage(imagesrc) : null;
			if (!image) {
				console.log("melonJS: '" + imagesrc + "' file for tileset '" + this.name + "' not found!");
			}
			// check if transparency is defined for a specific color
			var trans = tileset[me.TMX_TAG_TRANS] || null;

			this.initFromImage(image, trans);
		},
		
		
		// constructor
		initFromImage: function (image, transparency) {
			if (image) {
				this.image = image;
				// number of tiles per horizontal line 
				this.hTileCount = ~~((this.image.width - this.margin) / (this.tilewidth + this.spacing));
				this.vTileCount = ~~((this.image.height - this.margin) / (this.tileheight + this.spacing));
			}
			
			// compute the last gid value in the tileset
			this.lastgid = this.firstgid + ( ((this.hTileCount * this.vTileCount) - 1) || 0);
		  
			// set Color Key for transparency if needed
			if (transparency !== null && this.image) {
				// applyRGB Filter (return a context object)
				this.image = me.video.applyRGBFilter(this.image, "transparent", transparency.toUpperCase()).canvas;
			}
			
		},
		
		/**
		 * set the tile properties
		 * @ignore
		 * @function
		 */
		setTileProperty : function(gid, prop) {
			// check what we found and adjust property
			prop.isSolid = prop.type ? prop.type.toLowerCase() === this.type.SOLID : false;
			prop.isPlatform = prop.type ? prop.type.toLowerCase() === this.type.PLATFORM : false;
			prop.isLeftSlope = prop.type ? prop.type.toLowerCase() === this.type.L_SLOPE : false;
			prop.isRightSlope = prop.type ? prop.type.toLowerCase() === this.type.R_SLOPE : false;
			prop.isBreakable = prop.type ? prop.type.toLowerCase() === this.type.BREAKABLE : false;
			prop.isLadder = prop.type ? prop.type.toLowerCase() === this.type.LADDER : false;
			prop.isTopLadder = prop.type ? prop.type.toLowerCase() === this.type.TOPLADDER : false;
			prop.isSlope = prop.isLeftSlope || prop.isRightSlope;
			
			// ensure the collidable flag is correct
			prop.isCollidable = !! (prop.type);
			
			// set the given tile id 
			this.TileProperties[gid] = prop;
		},
		
		/**
		 * return true if the gid belongs to the tileset
		 * @name me.TMXTileset#contains
		 * @public
		 * @function
		 * @param {Integer} gid 
		 * @return {boolean}
		 */
		contains : function(gid) {
			return (gid >= this.firstgid && gid <= this.lastgid)
		},
		
		//return an Image Object with the specified tile
		getTileImage : function(tmxTile) {
			// create a new image object
			var _context = me.video.getContext2d(
					me.video.createCanvas(this.tilewidth, this.tileheight)
			);
			this.drawTile(_context, 0, 0, tmxTile);
			return _context.canvas;
		},
		
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
		 * @name me.TMXTileset#getTileProperties
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
		
		/**
		 * return the x offset of the specified tile in the tileset image
		 * @ignore
		 */
		getTileOffsetX : function(tileId) {
			var offset = this.tileXOffset[tileId];
			if (typeof(offset) === 'undefined') {
				offset = this.tileXOffset[tileId] = this.margin + (this.spacing + this.tilewidth)  * (tileId % this.hTileCount);
			}
			return offset;
		},
		
		/**
		 * return the y offset of the specified tile in the tileset image
		 * @ignore
		 */
		getTileOffsetY : function(tileId) {
			var offset = this.tileYOffset[tileId];
			if (typeof(offset) === 'undefined') {
				offset = this.tileYOffset[tileId] = this.margin + (this.spacing + this.tileheight)	* ~~(tileId / this.hTileCount);
			}
			return offset;
		},


		// draw the x,y tile
		drawTile : function(context, dx, dy, tmxTile) {
			// check if any transformation is required
			if (tmxTile.flipped) {
				var m11 = 1; // Horizontal scaling factor
				var m12 = 0; // Vertical shearing factor
				var m21 = 0; // Horizontal shearing factor
				var m22 = 1; // Vertical scaling factor
				var mx	= dx; 
				var my	= dy;
				// set initial value to zero since we use a transform matrix
				dx = dy = 0;
				
				context.save();
								
				if (tmxTile.flipAD){
					// Use shearing to swap the X/Y axis
					m11=0;
					m12=1;
					m21=1;
					m22=0;
					// Compensate for the swap of image dimensions
					my += this.tileheight - this.tilewidth;
				}
				if (tmxTile.flipX){
					m11 = -m11;
					m21 = -m21;
					mx += tmxTile.flipAD ? this.tileheight : this.tilewidth;
					
				}
				if (tmxTile.flipY){
					m12 = -m12;
					m22 = -m22;
					my += tmxTile.flipAD ? this.tilewidth : this.tileheight;
				}
				// set the transform matrix
				context.transform(m11, m12, m21, m22, mx, my);
			}
			
			// get the local tileset id
			var tileid = tmxTile.tileId - this.firstgid;
			
			// draw the tile
			context.drawImage(this.image, 
							  this.getTileOffsetX(tileid), this.getTileOffsetY(tileid),
							  this.tilewidth, this.tileheight, 
							  dx, dy, 
							  this.tilewidth, this.tileheight);

			if  (tmxTile.flipped)  {
				// restore the context to the previous state
				context.restore();
			}
		}


	});
	
	/**
	 * an object containing all tileset
	 * @class
	 * @memberOf me
	 * @constructor
	 */
	me.TMXTilesetGroup = Object.extend({
		// constructor
		init: function () {
			this.tilesets = [];
		},
		
		//add a tileset to the tileset group
		add : function(tileset) {
			this.tilesets.push(tileset);
		},

		//return the tileset at the specified index
		getTilesetByIndex : function(i) {
			return this.tilesets[i];
		},
	   
		/**
		 * return the tileset corresponding to the specified id <br>
		 * will throw an exception if no matching tileset is found
		 * @name me.TMXTilesetGroup#getTilesetByGid
		 * @public
		 * @function
		 * @param {Integer} gid 
		 * @return {me.TMXTileset} corresponding tileset
		 */
		getTilesetByGid : function(gid) {
			var invalidRange = -1;
			// cycle through all tilesets
			for ( var i = 0, len = this.tilesets.length; i < len; i++) {
				// return the corresponding tileset if matching
				if (this.tilesets[i].contains(gid))
					return this.tilesets[i];
				// typically indicates a layer with no asset loaded (collision?)
				if (this.tilesets[i].firstgid == this.tilesets[i].lastgid) {
					if (gid >= this.tilesets[i].firstgid)
					// store the id if the [firstgid .. lastgid] is invalid
					invalidRange = i;
				}
			}
			// return the tileset with the invalid range
			if (invalidRange!=-1)
				return this.tilesets[invalidRange];
			else
			throw "no matching tileset found for gid " + gid;
		}
		
	});
	
	
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
