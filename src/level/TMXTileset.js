/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://www.melonjs.org
 *
 * TMX Loader
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/	
 *
 */

(function($, undefined) {
		
	/**************************************************/
	/*                                                */
	/*      Tileset Management                        */
	/*                                                */
	/**************************************************/
	
	/**
	 * manage a group of Tileset
	 * @memberOf me
	 * @private
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
	   
		// return the tileset corresponding to  the specified gid
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
	
	
	/**
	 * a tileset object
	 * @memberOf me
	 * @private
	 * @constructor
	 */	
	 me.TMXTileset = me.Tileset.extend({
		
		// constructor
		init: function (xmltileset) {

			// first gid
			this.firstgid = me.XMLParser.getIntAttribute(xmltileset, me.TMX_TAG_FIRSTGID);
			
			this.parent(me.XMLParser.getStringAttribute(xmltileset, me.TMX_TAG_NAME),
						me.XMLParser.getIntAttribute(xmltileset, me.TMX_TAG_TILEWIDTH),
						me.XMLParser.getIntAttribute(xmltileset, me.TMX_TAG_TILEHEIGHT),
						me.XMLParser.getIntAttribute(xmltileset, me.TMX_TAG_SPACING, 0), 
						me.XMLParser.getIntAttribute(xmltileset, me.TMX_TAG_MARGIN, 0), 
						xmltileset.getElementsByTagName(me.TMX_TAG_IMAGE)[0].getAttribute(me.TMX_TAG_SOURCE));
			
			// compute the last gid value in the tileset
			this.lastgid = this.firstgid + ( ((this.hTileCount * this.vTileCount) - 1) || 0);
		  
			// check if transparency is defined for a specific color
			this.trans = xmltileset.getElementsByTagName(me.TMX_TAG_IMAGE)[0].getAttribute(me.TMX_TAG_TRANS);

			// set Color Key for transparency if needed
			if (this.trans !== null && this.image) {
				// applyRGB Filter (return a context object)
				this.image = me.video.applyRGBFilter(this.image, "transparent", this.trans.toUpperCase()).canvas;
			}

			// set tile properties, if any
			var tileInfo = xmltileset.getElementsByTagName(me.TMX_TAG_TILE);
			for ( var i = 0; i < tileInfo.length; i++) {
				var tileID = me.XMLParser.getIntAttribute(tileInfo[i], me.TMX_TAG_ID) + this.firstgid;

				this.TileProperties[tileID] = {};

				var tileProp = this.TileProperties[tileID];

				// apply tiled defined properties
				me.TMXUtils.setTMXProperties(tileProp, tileInfo[i]);

				// check what we found and adjust property
				tileProp.isSolid = tileProp.type ? tileProp.type.toLowerCase() === this.type.SOLID : false;
				tileProp.isPlatform = tileProp.type ? tileProp.type.toLowerCase() === this.type.PLATFORM : false;
				tileProp.isLeftSlope = tileProp.type ? tileProp.type.toLowerCase() === this.type.L_SLOPE : false;
				tileProp.isRightSlope = tileProp.type ? tileProp.type.toLowerCase() === this.type.R_SLOPE	: false;
				tileProp.isBreakable = tileProp.type ? tileProp.type.toLowerCase() === this.type.BREAKABLE : false;
				tileProp.isLadder = tileProp.type ? tileProp.type.toLowerCase() === this.type.LADDER : false;
				tileProp.isSlope = tileProp.isLeftSlope || tileProp.isRightSlope;

				// ensure the collidable flag is correct
				tileProp.isCollidable = tileProp.isSolid || tileProp.isPlatform
										|| tileProp.isSlope || tileProp.isLadder
										|| tileProp.isBreakable;

			}
		},
		
		// check if the gid belongs to the tileset
		contains : function(gid) {
			return (gid >= this.firstgid && gid <= this.lastgid)
		}

	});
	
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
