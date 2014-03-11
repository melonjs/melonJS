    /*
     * MelonJS Game Engine
     * Copyright (C) 2011 - 2013, Olivier BIOT
     * http://www.melonjs.org
     *
     */

	/**
	 * a generic Color Layer Object
	 * @class
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {String}  name    layer name
	 * @param {String}  color   a CSS color value
	 * @param {Number}  z       z position
	 */
	 me.ColorLayer = me.Renderable.extend({
		// constructor
		init: function(name, color, z) {
			// parent constructor
			this.parent(new me.Vector2d(0, 0), Infinity, Infinity);

			// apply given parameters
			this.name = name;
			this.color = color;
			this.z = z;
		},

		/**
		 * draw the color layer
		 * @ignore
		 */
		draw : function(context, rect) {
			// set layer opacity
			var _alpha = context.globalAlpha;
			context.globalAlpha *= this.getOpacity();

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
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {String} name        layer name
	 * @param {Number} width       layer width in pixels
	 * @param {Number} height      layer height in pixels
	 * @param {String} image       image name (as defined in the asset list)
	 * @param {Number} z           z position
	 * @param {me.Vector2d}  [ratio=1.0]   scrolling ratio to be applied
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
		 * Default value : (1.0, 1.0) <br>
		 * To specify a value through Tiled, use one of the following format : <br>
		 * - a number, to change the value for both axis <br>
		 * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
		 * @public
		 * @type me.Vector2d
		 * @name me.ImageLayer#ratio
		 */
		//ratio: new me.Vector2d(1.0, 1.0),

		/**
		 * constructor
		 * @ignore
		 * @function
		 */
		init: function(name, width, height, imagesrc, z, ratio) {
			// layer name
			this.name = name;

			// get the corresponding image (throw an exception if not found)
			this.image = (imagesrc) ? me.loader.getImage(me.utils.getBasename(imagesrc)) : null;
			if (!this.image) {
				throw "melonJS: '" + imagesrc + "' file for Image Layer '" + this.name + "' not found!";
			}

			this.imagewidth = this.image.width;
			this.imageheight = this.image.height;

			// a cached reference to the viewport
			var viewport = me.game.viewport;

            // set layer width & height
			width  = width ? Math.min(viewport.width, width)   : viewport.width;
			height = height? Math.min(viewport.height, height) : viewport.height;
			this.parent(new me.Vector2d(0, 0), width, height);

			// displaying order
			this.z = z;

			// default ratio for parallax
			this.ratio = new me.Vector2d(1.0, 1.0);

			if (ratio) {
				// little hack for backward compatiblity
				if (typeof(ratio) === "number") {
					this.ratio.set(ratio, ratio);
				} else /* vector */ {
					this.ratio.setV(ratio);
				}
			}

			// last position of the viewport
			this.lastpos = viewport.pos.clone();

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

			// default origin position
			this.anchorPoint.set(0, 0);

			// register to the viewport change notification
			this.handle = me.event.subscribe(me.event.VIEWPORT_ONCHANGE, this.updateLayer.bind(this));

		},


		/**
		 * updateLayer function
		 * @ignore
		 * @function
		 */
		updateLayer : function(vpos) {
			if (0 === this.ratio.x && 0 === this.ratio.y) {
				// static image
				return;
			} else if(this.repeatX || this.repeatY) {
				// parallax / scrolling image
				this.pos.x += ((vpos.x - this.lastpos.x) * this.ratio.x) % this.imagewidth;
				this.pos.x = (this.imagewidth + this.pos.x) % this.imagewidth;

				this.pos.y += ((vpos.y - this.lastpos.y) * this.ratio.y) % this.imageheight;
				this.pos.y = (this.imageheight + this.pos.y) % this.imageheight;
			}
			else {
				this.pos.x += (vpos.x - this.lastpos.x) * this.ratio.x;
				this.pos.y += (vpos.y - this.lastpos.y) * this.ratio.y;
			}
			this.lastpos.setV(vpos);
		},

		/**
		 * draw the image layer
		 * @ignore
		 */
		draw : function(context, rect) {
			// translate default position using the anchorPoint value
			var viewport = me.game.viewport;
			var shouldTranslate = this.anchorPoint.y !==0 || this.anchorPoint.x !==0;
			var translateX = ~~(this.anchorPoint.x * (viewport.width - this.imagewidth));
			var translateY = ~~(this.anchorPoint.y * (viewport.height - this.imageheight));

			if (shouldTranslate) {
				context.translate(translateX, translateY);
			}

			// set the layer alpha value
			context.globalAlpha *= this.getOpacity();

			var sw, sh;

			// if not scrolling ratio define, static image
			if (0 === this.ratio.x && 0 === this.ratio.y){
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

				sw = Math.min(this.imagewidth  - sx, this.width);
				sh = Math.min(this.imageheight - sy, this.height);

				do {
					do {
						context.drawImage(
							this.image,
							sx, sy, // sx, sy
							sw, sh,
							dx, dy, // dx, dy
							sw, sh
						);

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

			if (shouldTranslate) {
				context.translate(-translateX, -translateY);
			}
		},

		// called when the layer is destroyed
		destroy : function() {
			// cancel the event subscription
			if (this.handle)  {
				me.event.unsubscribe(this.handle);
				this.handle = null;
			}
			// clear all allocated objects
			this.image = null;
			this.lastpos = null;
		}
	});


	/**
	 * a generic collision tile based layer object
	 * @memberOf me
	 * @ignore
	 * @constructor
	 */
	me.CollisionTiledLayer = me.Renderable.extend({
		// constructor
		init: function(width, height) {
			this.parent(new me.Vector2d(0, 0), width, height);

			this.isCollisionMap = true;

		},

		/**
		 * only test for the world limit
		 * @ignore
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
	 * Tiled QT 0.7.x format
	 * @class
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {Number} tilewidth width of each tile in pixels
	 * @param {Number} tileheight height of each tile in pixels
	 * @param {String} orientation "isometric" or "orthogonal"
	 * @param {me.TMXTilesetGroup} tilesets tileset as defined in Tiled
	 * @param {Number} zOrder layer z-order
	 */
	me.TMXLayer = me.Renderable.extend({

		// the layer data array
		layerData : null,

		/** @ignore */
		init: function(tilewidth, tileheight, orientation, tilesets, zOrder) {
			// parent constructor
			this.parent(new me.Vector2d(0, 0), 0, 0);

			// tile width & height
			this.tilewidth  = tilewidth;
			this.tileheight = tileheight;

			// layer orientation
			this.orientation = orientation;

			/**
			 * The Layer corresponding Tilesets
			 * @public
			 * @type me.TMXTilesetGroup
			 * @name me.TMXLayer#tilesets
			 */

			this.tilesets = tilesets;
			// the default tileset
			this.tileset = this.tilesets?this.tilesets.getTilesetByIndex(0):null;

			// for displaying order
			this.z = zOrder;
		},

		/** @ignore */
		initFromJSON: function(layer) {
			// additional TMX flags
			this.name = layer[me.TMX_TAG_NAME];
			this.cols = parseInt(layer[me.TMX_TAG_WIDTH], 10);
			this.rows = parseInt(layer[me.TMX_TAG_HEIGHT], 10);

			// layer opacity
			var visible = typeof(layer[me.TMX_TAG_VISIBLE]) !== 'undefined' ? layer[me.TMX_TAG_VISIBLE] : true;
			this.setOpacity(visible?parseFloat(layer[me.TMX_TAG_OPACITY]):0);

			// layer "real" size
			this.width = this.cols * this.tilewidth;
			this.height = this.rows * this.tileheight;


			// check if we have any user-defined properties
			me.TMXUtils.applyTMXPropertiesFromJSON(this, layer);

			// check for the correct rendering method
			if (typeof (this.preRender) === 'undefined') {
				this.preRender = me.sys.preRender;
			}

			// detect if the layer is a collision map
			this.isCollisionMap = (this.name.toLowerCase().contains(me.COLLISION_LAYER));
			if (this.isCollisionMap && !me.debug.renderCollisionMap) {
				// force the layer as invisible
				this.setOpacity(0);
			}

			// if pre-rendering method is use, create the offline canvas
			if (this.preRender === true) {
				this.layerCanvas = me.video.createCanvas(this.cols * this.tilewidth, this.rows * this.tileheight);
				this.layerSurface = me.video.getContext2d(this.layerCanvas);
			}
		},

		/**
		 * destroy function
		 * @ignore
		 * @function
		 */
		destroy : function() {
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
		 * @ignore
		 */
		setRenderer : function(renderer) {
			this.renderer = renderer;
		},

		/**
		 * Create all required arrays
		 * @ignore
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
		 * @name getTileId
		 * @memberOf me.TMXLayer
		 * @public
		 * @function
		 * @param {Number} x x coordinate in pixel
		 * @param {Number} y y coordinate in pixel
		 * @return {Number} TileId
		 */
		getTileId : function(x, y) {
			var tile = this.getTile(x,y);
			return tile ? tile.tileId : null;
		},

		/**
		 * Return the Tile object at the specified position
		 * @name getTile
		 * @memberOf me.TMXLayer
		 * @public
		 * @function
		 * @param {Number} x x coordinate in pixel
		 * @param {Number} y y coordinate in pixel
		 * @return {me.Tile} Tile Object
		 */
		getTile : function(x, y) {
			return this.layerData[~~(x / this.tilewidth)][~~(y / this.tileheight)];
		},

		/**
		 * Create a new Tile at the specified position
		 * @name setTile
		 * @memberOf me.TMXLayer
		 * @public
		 * @function
		 * @param {Number} x x coordinate in tile
		 * @param {Number} y y coordinate in tile
		 * @param {Number} tileId tileId
		 * @return {me.Tile} the corresponding newly created tile object
		 */
		setTile : function(x, y, tileId) {
			var tile = new me.Tile(x, y, this.tilewidth, this.tileheight, tileId);
			if (!this.tileset.contains(tile.tileId)) {
				tile.tileset = this.tileset = this.tilesets.getTilesetByGid(tile.tileId);
			} else {
				tile.tileset = this.tileset;
			}
			this.layerData[x][y] = tile;
			return tile;
		},

		/**
		 * clear the tile at the specified position
		 * @name clearTile
		 * @memberOf me.TMXLayer
		 * @public
		 * @function
		 * @param {Number} x x position
		 * @param {Number} y y position
		 */
		clearTile : function(x, y) {
			// clearing tile
			this.layerData[x][y] = null;
			// erase the corresponding area in the canvas
			if (this.preRender) {
				this.layerSurface.clearRect(x * this.tilewidth,	y * this.tileheight, this.tilewidth, this.tileheight);
			}
		},


		/**
		 * check for collision
		 * obj - obj
		 * pv   - projection vector
		 * res : result collision object
		 * @ignore
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
			} else if (pv.x !== 0 ) {
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
			// return the collide object
			return res;
		},

		/**
		 * draw a tileset layer
		 * @ignore
		 */
		draw : function(context, rect) {

			// use the offscreen canvas
			if (this.preRender) {

				var width = Math.min(rect.width, this.width);
				var height = Math.min(rect.height, this.height);

				this.layerSurface.globalAlpha = context.globalAlpha * this.getOpacity();

				// draw using the cached canvas
				context.drawImage(this.layerCanvas,
								  rect.pos.x, //sx
								  rect.pos.y, //sy
								  width, height,    //sw, sh
								  rect.pos.x, //dx
								  rect.pos.y, //dy
								  width, height);   //dw, dh
			}
			// dynamically render the layer
			else {
				// set the layer alpha value
				var _alpha = context.globalAlpha;
				context.globalAlpha *= this.getOpacity();

				// draw the layer
				this.renderer.drawTileLayer(context, this, rect);

				// restore context to initial state
				context.globalAlpha = _alpha;
			}
		}
	});
