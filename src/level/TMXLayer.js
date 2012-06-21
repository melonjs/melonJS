/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($, undefined) {
	
	/**
	 * a generic Color Layer Object
	 * @class
	 * @memberOf me
	 * @constructor
	 * @param {name}    name    layer name
	 * @param {String}  color   in hexadecimal "RRGGBB" format
	 * @param {int}     z       z position
	 */
	 me.ColorLayer = Object.extend({
		// constructor
		init: function(name, color, z) {
			this.name = name;
			this.color = me.utils.HexToRGB(color);
			// for displaying order
			this.z = z;
			
			this.visible = true;
			this.opacity = 1.0;
		},

		/**
		 * reset function
		 * @private
		 * @function
		 */
		reset : function() {
			;// nothing to do here
		},

		/**
		 * update function
		 * @private
		 * @function
		 */
		update : function() {
			return false;
		},

		/**
		 * draw the color layer
		 * @private
		 */
		draw : function(context, rect) {
			context.fillStyle = this.color;
			// clear the specified rect
			context.fillRect(rect.left, rect.top, rect.width, rect.height);
		}
	});	

	
	/**
	 * a generic Image Layer Object
	 * @class
	 * @memberOf me
	 * @constructor
	 * @param {name}   name        layer name
	 * @param {int}    width       layer width (not used)
	 * @param {int}    height      layer height (not used)
	 * @param {String} image       image name (as defined in the asset list)
	 * @param {int}    z           z position
	 * @param {float}  [ratio=0]   scrolling ratio to be applied (apply by multiplying the viewport delta position by the defined ratio)
	 */
	 me.ImageLayer = Object.extend({
		// constructor
		init: function(name, width, height, imagesrc, z, ratio) {
			// layer name
			this.name = name;
						
			// get the corresponding image (throw an exception if not found)
			this.image = (imagesrc) ? me.loader.getImage(me.utils.getFilename(imagesrc)) : null;
			if (!this.image) {
				console.log("melonJS: '" + imagesrc + "' file for Image Layer '" + this.name + "' not found!");
			}
			
			this.imagewidth = this.image.width;
			this.imageheight = this.image.height;
			
			// displaying order
			this.z = z;
			
			// if ratio !=0 scrolling image
			this.ratio = ratio || 0;
			// reference to the viewport
			this.viewport = me.game.viewport;
			// last position of the viewport
			this.lastpos = this.viewport.pos.clone();
			// current base offset when drawing the image
			this.offset = new me.Vector2d(0,0);
			
			// set layer width & height to the viewport size
			// (are the ones passed as parameter usefull?)
			this.width = me.game.viewport.width;
			this.height = me.game.viewport.height;
			
			// make it visible
			this.visible = true;
			
			// default opacity
			this.opacity = 1.0;
			
		},
		
		/**
		 * reset function
		 * @private
		 * @function
		 */
		reset : function() {
			// clear all allocated objects
			this.image = null;
			this.lastpos = null;
			this.viewport = null;
			this.offset = null;
		},
		
		/**
		 * update function
		 * @private
		 * @function
		 */
		update : function() {
			if (this.ratio===0) {
				// static image
				return false;
			}
			else {
				// parallax / scrolling image
				if (!this.lastpos.equals(this.viewport.pos)) {
					// viewport changed
					this.offset.x = (this.imagewidth + this.offset.x + ((this.viewport.pos.x - this.lastpos.x) * this.ratio)) % this.imagewidth;
					this.offset.y = (this.imageheight + this.offset.y + ((this.viewport.pos.y - this.lastpos.y) * this.ratio)) % this.imageheight;
					this.lastpos.setV(this.viewport.pos);
					return true;
				}
				return false
			}
		},
		

		/**
		 * draw the image layer
		 * @private
		 */
		draw : function(context, rect) {
			
			// check if transparency
			if (this.opacity < 1.0) {
				context.globalAlpha = this.opacity;
			}
			
			// if not scrolling ratio define, static image
			if (this.ratio===0) {
				// static image
				sw = Math.min(rect.width, this.imagewidth);
				sh = Math.min(rect.height, this.imageheight);
				
				context.drawImage(this.image, 
								  rect.left, rect.top,		//sx, sy
								  sw,		 sh,			//sw, sh
								  rect.left, rect.top,		//dx, dy
								  sw,		 sh);			//dw, dh
			}
			// parallax / scrolling image
			else {
				var sx = ~~this.offset.x;
				var sy = ~~this.offset.y;
				
				var dx = 0;
				var dy = 0;				
				
				var sw = Math.min(this.imagewidth - ~~this.offset.x, this.width);
				var sh = Math.min(this.imageheight - ~~this.offset.y, this.height);
				  
				do {
					do {
						context.drawImage(this.image, 
										  sx, sy, 		// sx, sy
										  sw, sh,
										  dx, dy,		// dx, dy
										  sw, sh);
						
						sy = 0;
						dy += sh;
						sh = Math.min(this.imageheight, this.height - dy);
					} while( dy < this.height);
					dx += sw;
					if (dx >= this.width ) {
						// done ("end" of the viewport)
						break;
					}
					// else update required var for next iteration
					sx = 0;
					sw = Math.min(this.imagewidth, this.width - dx);
					sy = ~~this.offset.y;
					dy = 0;
					sh = Math.min(this.imageheight - ~~this.offset.y, this.height);
				} while( true );
			}
			
			// restore default alpha value
			context.globalAlpha = 1.0;
			
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
		 * reset function
		 * @private
		 * @function
		 */
		reset : function() {
			; // nothing to do here
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
		 * reset function
		 * @private
		 * @function
		 */
		reset : function() {
			// clear all allocated objects
			this.layerData = null;
			this.xLUT = this.yLUT = null
			this.tileset = null;
			this.tilesets = null;
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
	 * a TMX Tile Map Object
	 * Tile QT 0.7.x format
	 * @class
	 * @extends me.TiledLayer
	 * @memberOf me
	 * @constructor
	 */
	me.TMXLayer = me.TiledLayer.extend({
		// constructor
		init: function(layer, tilewidth, tileheight, orientation, tilesets, zOrder) {
			// call the parent
			this.parent(me.XMLParser.getIntAttribute(layer, me.TMX_TAG_WIDTH), 
						me.XMLParser.getIntAttribute(layer, me.TMX_TAG_HEIGHT),
						tilewidth, 
						tileheight,
						// tilesets should exist here !
						tilesets, 
						zOrder);
						
			// additional TMX flags
			this.orientation = orientation;
			this.name = me.XMLParser.getStringAttribute(layer, me.TMX_TAG_NAME);
			this.visible = (me.XMLParser.getIntAttribute(layer, me.TMX_TAG_VISIBLE, 1) == 1);
			this.opacity = me.XMLParser.getFloatAttribute(layer, me.TMX_TAG_OPACITY, 1.0).clamp(0.0, 1.0);
				
			// check if we have any user-defined properties 
			me.TMXUtils.setTMXProperties(this, layer);
			
			// check for the correct rendering method
			if (this.preRender === undefined)
				this.preRender = me.sys.preRender

			// detect if the layer is a collision map
			this.isCollisionMap = (this.name.toLowerCase().contains(me.LevelConstants.COLLISION_MAP));
			if (this.isCollisionMap) {
				// force the layer as invisible
				this.visible = false;
			}

			// store the data information
			var xmldata = layer.getElementsByTagName(me.TMX_TAG_DATA)[0];
			var encoding = me.XMLParser.getStringAttribute(xmldata, me.TMX_TAG_ENCODING, null);
			var compression = me.XMLParser.getStringAttribute(xmldata, me.TMX_TAG_COMPRESSION, null);

			// make sure this is not happening
			if (encoding == '')
				encoding = null;
			if (compression == '')
				compression = null;

			// create a canvas where to draw our layer
			if (this.visible) {
				// set the right renderer
				switch (this.orientation)
				{
					case "orthogonal": {
					  this.renderer = new me.TMXOrthogonalRenderer(this.width, this.height, this.tilewidth, this.tileheight);
					  break;
					}
					case "isometric": {
					  this.renderer = new me.TMXIsometricRenderer(this.width, this.height , this.tilewidth, this.tileheight);
					  break;
					}
			
					// if none found, throw an exception
					default : {
						throw "melonJS: " + this.orientation + " type TMX Tile Map not supported!";
					}
				}
				
				// if pre-rendering method is use, create the offline canvas
				if (this.preRender) {
					this.layerSurface = me.video.createCanvasSurface(this.width	* this.tilewidth, this.height * this.tileheight);
					this.layerCanvas = this.layerSurface.canvas;
					
					// set alpha value for this layer
					this.layerSurface.globalAlpha = this.opacity;
				}
				
			}

			if (this.visible || this.isCollisionMap) {
				// initialize the layer lookup table (only in case of collision map)
				this.initArray(this.isCollisionMap);

				// populate our level with some data
				this.fillArray(xmldata, encoding, compression);
			}
		},
		
		/**
		 * reset function
		 * @private
		 * @function
		 */
		reset : function() {
			// clear all allocated objects
			if (this.preRender) {
				this.layerCanvas = null;
				this.layerSurface = null;
			}
			this.renderer = null;
			// call the parent reset function
			this.parent();
		},
		
		/**
		 * Build the tiled layer
		 * @private
		 */
		fillArray : function(xmldata, encoding, compression) {
			// check if data is compressed
			switch (compression) {
			 
			 // no compression
			 case null: {
				// decode data based on encoding type
				switch (encoding) {
				// XML encoding
				   case null: {
					  var data = xmldata.getElementsByTagName(me.TMX_TAG_TILE);
					  break;
				   }
				   // CSV encoding
				   case me.TMX_TAG_CSV:
					  // Base 64 encoding
				   case me.TMX_TAG_ATTR_BASE64: {
					  // Merge all childNodes[].nodeValue into a single one
					  var nodeValue = '';
					  for ( var i = 0, len = xmldata.childNodes.length; i < len; i++) {
						 nodeValue += xmldata.childNodes[i].nodeValue;
					  }
					  // and then decode them
					  if (encoding == me.TMX_TAG_ATTR_BASE64)
						 var data = me.utils.decodeBase64AsArray(nodeValue, 4);
					  else
						 var data = me.utils.decodeCSV(nodeValue, this.width);

					  // ensure nodeValue is deallocated
					  nodeValue = null;
					  break;
				   }
					  
				   default:
					  throw "melonJS: TMX Tile Map " + encoding + " encoding not supported!";
					  break;
				}
				
			 break;
			 }
				
			 default:
				throw "melonJS: " + compression+ " compressed TMX Tile Map not supported!";
				break;
			}

			var idx = 0;
			// set everything
			for ( var y = 0 ; y <this.height; y++) {
				for ( var x = 0; x <this.width; x++) {
					// get the value of the gid
					var gid = (encoding == null) ? me.XMLParser.getIntAttribute(data[idx++], me.TMX_TAG_GID) : data[idx++];
					// fill the array										
					if (gid > 0) {
						// create a new tile object
						var tmxTile = new me.Tile(x, y, this.tilewidth, this.tileheight, gid);
						// set the tile in the data array
						this.layerData[x][y] = tmxTile;
						// switch to the right tileset
						if (!this.tileset.contains(tmxTile.tileId)) {
							this.tileset = this.tilesets.getTilesetByGid(tmxTile.tileId);
						}
					   	// draw the corresponding tile
						if (this.visible && this.preRender) {
							this.renderer.drawTile(this.layerSurface, x, y, tmxTile, this.tileset);
						}
					}
				}
			}

			// make sure data is deallocated :)
			data = null;
		},

		/**
		 * clear the tile at the specified position
		 * @name me.TMXLayer#clearTile
		 * @public
		 * @function
		 * @param {Integer} x x position 
		 * @param {Integer} y y position 
		 */
		clearTile : function(x, y) {
			// call the parent function
			this.parent(x, y);
			// erase the corresponding area in the canvas
			if (this.visible && this.preRender) {
				this.layerSurface.clearRect(x * this.tilewidth,	y * this.tileheight, this.tilewidth, this.tileheight);
			}
		},

		/**
		 * draw a tileset layer
		 * @private
		 */
		draw : function(context, rect) {
			
			// get a reference to the viewport
			var vpos = me.game.viewport.pos;
			
			// use the offscreen canvas
			if (this.preRender) {
			
				// draw using the cached canvas
				context.drawImage(this.layerCanvas, 
								  vpos.x + rect.pos.x, //sx
								  vpos.y + rect.pos.y, //sy
								  rect.width, rect.height,    //sw, sh
								  rect.pos.x, rect.pos.y,     //dx, dy
								  rect.width, rect.height);   //dw, dh
			}
			// dynamically render the layer
			else {
			
				// check if transparency
				if (this.opacity < 1.0) {
					context.globalAlpha = this.opacity;
				}
				
				// translate the display as we want to have per pixel scrolling				
				context.translate( -viewport.x, -viewport.y);
				
				// draw the layer
				this.renderer.drawTileLayer(context, this, vpos, rect);
				
				// restore context to initial state
				context.setTransform(1, 0, 0, 1, 0, 0);
			
				// restore default alpha value
				context.globalAlpha = 1.0;
				
			}
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
