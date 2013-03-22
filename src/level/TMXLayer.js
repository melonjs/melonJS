/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($, game) {
	
	/**
	 * a generic Color Layer Object
	 * @class
	 * @memberOf me
	 * @constructor
	 * @param {name}    name    layer name
	 * @param {String}  color   in hexadecimal "#RRGGBB" format
	 * @param {int}     z       z position
	 */
	 me.ColorLayer = me.Renderable.extend({
		// constructor
		init: function(name, color, z) {
			this.name = name;
			this.color = me.utils.HexToRGB(color);
			// for displaying order
			this.z = z;
			
			this.opacity = 1.0;
			
			this.floating = true;
			
			this.parent(new me.Vector2d(0, 0), game.viewport.width, game.viewport.height);
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
		 * get the layer alpha channel value<br>
		 * @return current opacity value between 0 and 1
		 */
		getOpacity : function() {
			return this.opacity;
		},

		/**
		 * set the layer alpha channel value<br>
		 * @param {alpha} alpha opacity value between 0 and 1
		 */
		setOpacity : function(alpha) {
			if (alpha) {
				this.opacity = alpha.clamp(0.0, 1.0);
			}
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
			// set layer opacity
			var _alpha = context.globalAlpha
			context.globalAlpha = this.opacity;
			
			// set layer color
			context.fillStyle = this.color;

			// clear the specified rect
			context.fillRect(rect.left, rect.top, rect.width, rect.height);

			// restore context alpha value
			context.globalAlpha = _alpha;
		}
	});	

	
	/**
	 * a generic Image Layer Object
	 * @class
	 * @memberOf me
	 * @constructor
	 * @param {name}   name        layer name
	 * @param {int}    width       layer width in pixels 
	 * @param {int}    height      layer height in pixels
	 * @param {String} image       image name (as defined in the asset list)
	 * @param {int}    z           z position
	 * @param {float}  [ratio=1.0]   scrolling ratio to be applied
	 */
	 me.ImageLayer = me.Renderable.extend({
		
		/**
		 * Define if and how an Image Layer should be repeated.<br>
		 * By default, an Image Layer is repeated both vertically and horizontally.<br>
		 * Property values : <br>
		 * * 'repeat' - The background image will be repeated both vertically and horizontally. (default) <br>
		 * * 'repeat-x' - The background image will be repeated only horizontally.<br>
		 * * 'repeat-y' - The background image will be repeated only vertically.<br>
		 * * 'no-repeat' - The background-image will not be repeated.<br>
		 * @public
		 * @type String
		 * @name me.ImageLayer#repeat
		 */
		//repeat: 'repeat', (define through getter/setter
		
		/**
		 * Define the image scrolling ratio<br>
		 * Scrolling speed is defined by multiplying the viewport delta position (e.g. followed entity) by the specified ratio<br>
		 * Default value : 1.0 <br>
		 * @public
		 * @type float
		 * @name me.ImageLayer#ratio
		 */
		ratio: 1.0,
	 
		/**
		 * constructor
		 * @private
		 * @function
		 */
		init: function(name, width, height, imagesrc, z, ratio) {
			// layer name
			this.name = name;
						
			// get the corresponding image (throw an exception if not found)
			this.image = (imagesrc) ? me.loader.getImage(me.utils.getBasename(imagesrc)) : null;
			if (!this.image) {
				console.log("melonJS: '" + imagesrc + "' file for Image Layer '" + this.name + "' not found!");
			}
			
			this.imagewidth = this.image.width;
			this.imageheight = this.image.height;
			
			// displaying order
			this.z = z;
			
			// if ratio !=0 scrolling image
			this.ratio = ratio || 1.0;
			
			// last position of the viewport
			this.lastpos = game.viewport.pos.clone();
			
			// set layer width & height 
			width  = width ? Math.min(game.viewport.width, width)   : game.viewport.width;
			height = height? Math.min(game.viewport.height, height) : game.viewport.height;
			this.parent(new me.Vector2d(0, 0), width, height);
			
			// default opacity
			this.opacity = 1.0;
			
			// Image Layer is considered as a floating object
			this.floating = true;
			
			// default value for repeat
			this._repeat = 'repeat';
			
			this.repeatX = true;
			this.repeatY = true;
			
			Object.defineProperty(this, "repeat", {
				get : function get() {
					return this._repeat;
				},
				set : function set(val) {
					this._repeat = val;
					switch (this._repeat) {
						case "no-repeat" :
							this.repeatX = false;
							this.repeatY = false;
							break;
						case "repeat-x" :
							this.repeatX = true;
							this.repeatY = false;
							break;
						case "repeat-y" :
							this.repeatX = false;
							this.repeatY = true;
							break;
						default : // "repeat"
							this.repeatX = true;
							this.repeatY = true;
							break;
					}
				}
			});

			
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
		},

		/**
		 * get the layer alpha channel value<br>
		 * @return current opacity value between 0 and 1
		 */
		getOpacity : function() {
			return this.opacity;
		},

		/**
		 * set the layer alpha channel value<br>
		 * @param {alpha} alpha opacity value between 0 and 1
		 */
		setOpacity : function(alpha) {
			if (alpha) {
				this.opacity = alpha.clamp(0.0, 1.0);
			}
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
				// reference to the viewport
				var vpos = game.viewport.pos;
				// parallax / scrolling image
				if (!this.lastpos.equals(vpos)) {
					// viewport changed
					this.pos.x = (this.imagewidth + this.pos.x + ((vpos.x - this.lastpos.x) * this.ratio)) % this.imagewidth;
					this.pos.y = (this.imageheight + this.pos.y + ((vpos.y - this.lastpos.y) * this.ratio)) % this.imageheight;
					this.lastpos.setV(vpos);
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
				// set the layer alpha value
				var _alpha = context.globalAlpha
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
			// todo ; broken with dirtyRect enabled
			else {
				var sx = ~~this.pos.x;
				var sy = ~~this.pos.y;
				
				var dx = 0;
				var dy = 0;				
				
				var sw = Math.min(this.imagewidth - sx, this.width);
				var sh = Math.min(this.imageheight - sy, this.height);
				  
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
					} while( this.repeatY && (dy < this.height));
					dx += sw;
					if (!this.repeatX || (dx >= this.width) ) {
						// done ("end" of the viewport)
						break;
					}
					// else update required var for next iteration
					sx = 0;
					sw = Math.min(this.imagewidth, this.width - dx);
					sy = ~~this.pos.y;
					dy = 0;
					sh = Math.min(this.imageheight - ~~this.pos.y, this.height);
				} while( true );
			}
			
			// restore context state
			if (this.opacity < 1.0) {
				context.globalAlpha = _alpha;
			}
		}
	});	
	
	
	/**
	 * a generic collision tile based layer object
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.CollisionTiledLayer = me.Renderable.extend({
		// constructor
		init: function(width, height) {
			this.parent(new me.Vector2d(0, 0), width, height);

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
			if (x <= 0 || x >= this.width) {
				res.x = pv.x;
			}

			// test y limits
			if (y <= 0 || y >= this.height) {
				res.y = pv.y;
			}

			// return the collide object if collision
			return res;
		}
	});

	/**
	 * a TMX Tile Layer Object
	 * Tile QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 */
	me.TMXLayer = me.Renderable.extend({
		
		// the layer data array
		layerData : null,
		
		// constructor
		init: function(tilewidth, tileheight, orientation, tilesets, zOrder) {

			// tile width & height
			this.tilewidth  = tilewidth;
			this.tileheight = tileheight;
			
			// layer orientation
			this.orientation = orientation;
			
			// for displaying order
			this.z = zOrder;

			/**
			 * The Layer corresponding Tilesets
			 * @public
			 * @type me.TMXTilesetGroup
			 * @name me.TMXLayer#tilesets
			 */
			
			this.tilesets = tilesets;
			// the default tileset
			this.tileset = this.tilesets?this.tilesets.getTilesetByIndex(0):null;
			
			this.parent(new me.Vector2d(0, 0), 0, 0);
		},
		
		initFromXML: function(layer) {
			
			// additional TMX flags
			this.name = me.mapReader.TMXParser.getStringAttribute(layer, me.TMX_TAG_NAME);
			this.visible = (me.mapReader.TMXParser.getIntAttribute(layer, me.TMX_TAG_VISIBLE, 1) == 1);
			this.opacity = me.mapReader.TMXParser.getFloatAttribute(layer, me.TMX_TAG_OPACITY, 1.0).clamp(0.0, 1.0);
			this.cols = me.mapReader.TMXParser.getIntAttribute(layer, me.TMX_TAG_WIDTH);
			this.rows = me.mapReader.TMXParser.getIntAttribute(layer, me.TMX_TAG_HEIGHT);
			
			// layer "real" size
			this.width = this.cols * this.tilewidth;
			this.height = this.rows * this.tileheight;
			
			// check if we have any user-defined properties 
			me.TMXUtils.applyTMXPropertiesFromXML(this, layer);
			
			// check for the correct rendering method
			if (this.preRender === undefined) {
				this.preRender = me.sys.preRender;
			}
			
			// detect if the layer is a collision map
			this.isCollisionMap = (this.name.toLowerCase().contains(me.LevelConstants.COLLISION_MAP));
			if (this.isCollisionMap && !me.debug.renderCollisionMap) {
				// force the layer as invisible
				this.visible = false;
			}



			// if pre-rendering method is use, create the offline canvas
			if (this.preRender) {
				this.layerCanvas = me.video.createCanvas(this.cols * this.tilewidth, this.rows * this.tileheight);
				this.layerSurface = this.layerCanvas.getContext('2d');
					
				// set alpha value for this layer
				this.layerSurface.globalAlpha = this.opacity;
			}	

		},
		
		initFromJSON: function(layer) {
			// additional TMX flags
			this.name = layer[me.TMX_TAG_NAME];
			this.visible = layer[me.TMX_TAG_VISIBLE];
			this.opacity = parseFloat(layer[me.TMX_TAG_OPACITY]).clamp(0.0, 1.0);
			this.cols = parseInt(layer[me.TMX_TAG_WIDTH]);
			this.rows = parseInt(layer[me.TMX_TAG_HEIGHT]);
			
			// layer "real" size
			this.width = this.cols * this.tilewidth;
			this.height = this.rows * this.tileheight;
			
			
			// check if we have any user-defined properties 
			me.TMXUtils.applyTMXPropertiesFromJSON(this, layer);
			
			// check for the correct rendering method
			if (this.preRender === undefined) {
				this.preRender = me.sys.preRender;
			}
			
			// detect if the layer is a collision map
			this.isCollisionMap = (this.name.toLowerCase().contains(me.LevelConstants.COLLISION_MAP));
			if (this.isCollisionMap && !me.debug.renderCollisionMap) {
				// force the layer as invisible
				this.visible = false;
			}

			// if pre-rendering method is use, create the offline canvas
			if (this.preRender) {
				this.layerCanvas = me.video.createCanvas(this.cols * this.tilewidth, this.rows * this.tileheight);
				this.layerSurface = this.layerCanvas.getContext('2d');
					
				// set alpha value for this layer
				this.layerSurface.globalAlpha = this.opacity;
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
			// clear all allocated objects
			this.layerData = null;
			this.tileset = null;
			this.tilesets = null;

		},
		
		/**
		 * set the layer renderer
		 * @private
		 */
		setRenderer : function(renderer) {
			this.renderer = renderer;
		},
		
		/**
		 * Create all required arrays
		 * @private
		 */
		initArray : function(w, h) {
			// initialize the array
			this.layerData = [];
			for ( var x = 0; x < w; x++) {
				this.layerData[x] = [];
				for ( var y = 0; y < h; y++) {
					this.layerData[x][y] = null;
				}
			}
		},
		
		

		/**
		 * Return the TileId of the Tile at the specified position
		 * @name me.TMXLayer#getTileId
		 * @public
		 * @function
		 * @param {Integer} x x coordinate in pixel 
		 * @param {Integer} y y coordinate in pixel
		 * @return {Int} TileId
		 */
		getTileId : function(x, y) {
			var tile = this.getTile(x,y);
			return tile ? tile.tileId : null;
		},
		
		/**
		 * Return the Tile object at the specified position
		 * @name me.TMXLayer#getTile
		 * @public
		 * @function
		 * @param {Integer} x x coordinate in pixel 
		 * @param {Integer} y y coordinate in pixel
		 * @return {me.Tile} Tile Object
		 */
		getTile : function(x, y) {
			return this.layerData[~~(x / this.tilewidth)][~~(y / this.tileheight)];
		},

		/**
		 * Create a new Tile at the specified position
		 * @name me.TMXLayer#setTile
		 * @public
		 * @function
		 * @param {Integer} x x coordinate in tile 
		 * @param {Integer} y y coordinate in tile
		 * @param {Integer} tileId tileId
		 */
		setTile : function(x, y, tileId) {
			this.layerData[x][y] = new me.Tile(x, y, this.tilewidth, this.tileheight, tileId);
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
			// clearing tile
			this.layerData[x][y] = null;
			// erase the corresponding area in the canvas
			if (this.visible && this.preRender) {
				this.layerSurface.clearRect(x * this.tilewidth,	y * this.tileheight, this.tilewidth, this.tileheight);
			}
		},
		
		/**
		 * get the layer alpha channel value
		 * @name me.TMXLayer#getOpacity
		 * @return current opacity value between 0 and 1
		 */
		getOpacity : function() {
			return this.opacity;
		},

		/**
		 * set the layer alpha channel value
		 * @name me.TMXLayer#setOpacity
		 * @param {alpha} alpha opacity value between 0 and 1
		 */
		setOpacity : function(alpha) {
			if (alpha) {
				this.opacity = alpha.clamp(0.0, 1.0);
				// if pre-rendering is used, update opacity on the hidden canvas context
				if (this.preRender) {
					this.layerSurface.globalAlpha = this.opacity;
				}
			}
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
			if (x <= 0 || x >= this.width) {
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
		},
		
		/**
		 * draw a tileset layer
		 * @private
		 */
		draw : function(context, rect) {
			
			// get a reference to the viewport
			var vpos = game.viewport.pos;
			
			// use the offscreen canvas
			if (this.preRender) {
			
				var width = Math.min(rect.width, this.width);
				var height = Math.min(rect.height, this.height);
			
				// draw using the cached canvas
				context.drawImage(this.layerCanvas, 
								  vpos.x + rect.pos.x, //sx
								  vpos.y + rect.pos.y, //sy
								  width, height,    //sw, sh
								  vpos.x + rect.pos.x, //dx
								  vpos.y + rect.pos.y, //dy
								  width, height);   //dw, dh
			}
			// dynamically render the layer
			else {
				// set the layer alpha value
				var _alpha = context.globalAlpha
				context.globalAlpha = this.opacity;

				// draw the layer
				this.renderer.drawTileLayer(context, this, vpos, rect);
				
				// restore context to initial state
				context.globalAlpha = _alpha;
			}
		}
	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window, me.game);
