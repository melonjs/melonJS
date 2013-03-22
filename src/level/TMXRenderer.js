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
	
	/**
	 * an Orthogonal Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXOrthogonalRenderer = Object.extend({
		// constructor
		init: function(cols, rows, tilewidth, tileheight) {
			this.cols = cols;
			this.rows = rows;
			this.tilewidth = tilewidth;
			this.tileheight = tileheight;
		},
		
		/** 
		 * return true if the renderer can render the specified layer
		 * @private
		 */
		canRender : function(layer) {
			return ((layer.orientation === 'orthogonal') &&
					(this.cols === layer.cols) && 
					(this.rows === layer.rows) &&
					(this.tilewidth === layer.tilewidth) &&
					(this.tileheight === layer.tileheight));
		},
		
		/**
		 * return the tile position corresponding to the specified pixel
		 * @private
		 */
		pixelToTileCoords : function(x, y) {
			return new me.Vector2d(x / this.tilewidth,
								   y / this.tileheight);
		},
		
		/**
		 * return the pixel position corresponding of the specified tile
		 * @private
		 */
		tileToPixelCoords : function(x, y) {
			return new me.Vector2d(x * this.tilewidth,
								   y * this.tileheight);		
		},
		
		/**
		 * draw the tile map
		 * @private
		 */
		drawTile : function(context, x, y, tmxTile, tileset) {
			// draw the tile
			tileset.drawTile(context, 
							 tileset.tileoffset.x + x * this.tilewidth,
							 tileset.tileoffset.y + (y + 1) * this.tileheight - tileset.tileheight,
							 tmxTile);
		},
		
		/**
		 * draw the tile map
		 * @private
		 */
		drawTileLayer : function(context, layer, viewport, rect) {
			// get top-left and bottom-right tile position
			var start = this.pixelToTileCoords(viewport.x + rect.pos.x, 
											   viewport.y + rect.pos.y).floorSelf();
				
			var end = this.pixelToTileCoords(viewport.x + rect.pos.x + rect.width + this.tilewidth, 
											 viewport.y + rect.pos.y + rect.height + this.tileheight).ceilSelf();
			
			//ensure we are in the valid tile range
			end.x = end.x > this.cols ? this.cols : end.x;
			end.y = end.y > this.rows ? this.rows : end.y;
			
			// main drawing loop			
			for ( var y = start.y ; y < end.y; y++) {
				for ( var x = start.x; x < end.x; x++) {
					var tmxTile = layer.layerData[x][y];
					if (tmxTile) {
						if (!layer.tileset.contains(tmxTile.tileId)) {
							layer.tileset = layer.tilesets.getTilesetByGid(tmxTile.tileId);
						}
						this.drawTile(context, x, y, tmxTile, layer.tileset);
					}
				}
			}
			
			
		}
		
		
	});
	
	
	/**
	 * an Isometric Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXIsometricRenderer = Object.extend({
		// constructor
		init: function(cols, rows, tilewidth, tileheight) {
			this.cols = cols;
			this.rows = rows;
			this.tilewidth = tilewidth;
			this.tileheight = tileheight;
			this.hTilewidth = tilewidth / 2;
			this.hTileheight = tileheight / 2;
			this.ratio = this.tilewidth / this.tileheight;
			this.originX = this.rows * this.hTilewidth;
		},
		
		
		/** 
		 * return true if the renderer can render the specified layer
		 * @private
		 */
		canRender : function(layer) {
			return ((layer.orientation === 'isometric') &&
					(this.cols === layer.cols) && 
					(this.rows === layer.rows) &&
					(this.tilewidth === layer.tilewidth) &&
					(this.tileheight === layer.tileheight));
		},
		
		/**
		 * return the tile position corresponding to the specified pixel
		 * @private
		 */
		pixelToTileCoords : function(x, y) {
			x -=  this.originX;
			return new me.Vector2d((y + (x / this.ratio)) / this.tileheight,
								   (y - (x / this.ratio)) / this.tileheight);
		},
		
		/**
		 * return the pixel position corresponding of the specified tile
		 * @private
		 */
		tileToPixelCoords : function(x, y) {
			return new me.Vector2d((x - y) * this.hTilewidth + this.originX,
								   (x + y) * this.hTileheight);
		},

		
		/**
		 * draw the tile map
		 * @private
		 */
		drawTile : function(context, x, y, tmxTile, tileset) {
			// draw the tile
			tileset.drawTile(context, 
							 ((this.cols-1) * tileset.tilewidth + (x-y) * tileset.tilewidth>>1), 
							 (-tileset.tilewidth + (x+y) * tileset.tileheight>>2),
							 tmxTile);
		},
		
		/**
		 * draw the tile map
		 * @private
		 */
		drawTileLayer : function(context, layer, viewport, rect) {
		
			// cache a couple of useful references
			var tileset = layer.tileset;
			var offset  = tileset.tileoffset;

			// get top-left and bottom-right tile position
			var rowItr = this.pixelToTileCoords(viewport.x + rect.pos.x - tileset.tilewidth, 
											    viewport.y + rect.pos.y - tileset.tileheight).floorSelf();
			var TileEnd = this.pixelToTileCoords(viewport.x + rect.pos.x + rect.width + tileset.tilewidth, 
												 viewport.y + rect.pos.y + rect.height + tileset.tileheight).ceilSelf();
			
			var rectEnd = this.tileToPixelCoords(TileEnd.x, TileEnd.y);
			
			// Determine the tile and pixel coordinates to start at
			var startPos = this.tileToPixelCoords(rowItr.x, rowItr.y);
			startPos.x -= this.hTilewidth;
			startPos.y += this.tileheight;
		
			/* Determine in which half of the tile the top-left corner of the area we
			 * need to draw is. If we're in the upper half, we need to start one row
			 * up due to those tiles being visible as well. How we go up one row
			 * depends on whether we're in the left or right half of the tile.
			 */
			var inUpperHalf = startPos.y - rect.pos.y + viewport.y > this.hTileheight;
			var inLeftHalf  = rect.pos.x + viewport.x - startPos.x < this.hTilewidth;

			if (inUpperHalf) {
				if (inLeftHalf) {
					rowItr.x--;
					startPos.x -= this.hTilewidth;
				} else {
					rowItr.y--;
					startPos.x += this.hTilewidth;
				}
				startPos.y -= this.hTileheight;
			}
			
			
			 // Determine whether the current row is shifted half a tile to the right
			var shifted = inUpperHalf ^ inLeftHalf;
			
			// initialize the columItr vector
			var columnItr = rowItr.clone();
			
			// main drawing loop			
			for (var y = startPos.y; y - this.tileheight < rectEnd.y; y += this.hTileheight) {
				columnItr.setV(rowItr);
				for (var x = startPos.x; x < rectEnd.x; x += this.tilewidth) {
					//check if it's valid tile, if so render
					if ((columnItr.x >= 0) && (columnItr.y >= 0) && (columnItr.x < this.cols) && (columnItr.y < this.rows))
					{
						var tmxTile = layer.layerData[columnItr.x][columnItr.y];
						if (tmxTile) {
							if (!tileset.contains(tmxTile.tileId)) {
								tileset = layer.tileset = layer.tilesets.getTilesetByGid(tmxTile.tileId);
								// offset could be different per tileset
								offset  = tileset.tileoffset;
							}
							// draw our tile
							tileset.drawTile(context, offset.x + x, offset.y + y - tileset.tileheight, tmxTile);
						}
					}
					// Advance to the next column
					columnItr.x++;
					columnItr.y--;
				}
				
				// Advance to the next row
				if (!shifted) {
					rowItr.x++;
					startPos.x += this.hTilewidth;
					shifted = true;
				} else {
					rowItr.y++;
					startPos.x -= this.hTilewidth;
					shifted = false;
				}
			}	
		}

	});

})(window);
