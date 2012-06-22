/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/	
 *
 */

(function($, undefined) {
	
	/**
	 * an Orthogonal Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXOrthogonalRenderer = Object.extend({
		// constructor
		init: function(width, height, tilewidth, tileheight) {
			this.width = width;
			this.height = height;
			this.tilewidth = tilewidth;
			this.tileheight = tileheight;
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
											   viewport.y + rect.pos.y).floor();
				
			var end = this.pixelToTileCoords(viewport.x + rect.pos.x + rect.width, 
											  viewport.y + rect.pos.y + rect.height).ceil();
				
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
		init: function(width, height, tilewidth, tileheight) {
			this.width = width;
			this.height = height;
			this.tilewidth = tilewidth;
			this.tileheight = tileheight;
		},
		/**
		 * return the tile position corresponding to the specified pixel
		 * @private
		 */
		pixelToTileCoords : function(x, y) {
		
			var ratio = this.tilewidth / this.tileheight;

			x -= this.height * this.tilewidth / 2;
			var mx = y + (x / ratio);
			var my = y - (x / ratio);
			
			return new me.Vector2d(mx / this.tileheight,
								   my / this.tileheight);
		},
		
		/**
		 * return the pixel position corresponding of the specified tile
		 * @private
		 */
		tileToPixelCoords : function(x, y) {
		
			var originX = this.height * this.tilewidth / 2;

			return new me.Vector2d((x - y) * this.tilewidth / 2 + originX,
								   (x + y) * this.tileheight / 2);
		},

		
		/**
		 * draw the tile map
		 * @private
		 */
		drawTile : function(context, x, y, tmxTile, tileset) {
			// draw the tile
			tileset.drawTile(context, 
							 ((this.width-1) * tileset.tilewidth + (x-y) * tileset.tilewidth>>1), 
							 (-tileset.tilewidth + (x+y) * tileset.tileheight>>2),
							 tmxTile);
		},
		
		/**
		 * draw the tile map
		 * @private
		 */
		drawTileLayer : function(context, layer, viewport, rect) {
			// get top-left and bottom-right tile position
			var rowItr = this.pixelToTileCoords(viewport.x + rect.pos.x, 
											    viewport.y + rect.pos.y).floor();
			var rectEnd = new me.Vector2d(viewport.x + rect.pos.x + rect.width, 
										  viewport.y + rect.pos.y + rect.height)
			
			// Determine the tile and pixel coordinates to start at
			var startPos = this.tileToPixelCoords(rowItr.x, rowItr.y);
			startPos.x -= this.tilewidth / 2;
			startPos.y += this.tileheight;
		
			
			
			/* Determine in which half of the tile the top-left corner of the area we
			 * need to draw is. If we're in the upper half, we need to start one row
			 * up due to those tiles being visible as well. How we go up one row
			 * depends on whether we're in the left or right half of the tile.
			 */
			var inUpperHalf = startPos.y - rect.pos.y + viewport.y > this.tileheight / 2;
			var inLeftHalf = viewport.x + rect.pos.x - startPos.x < this.tilewidth / 2;

			if (inUpperHalf) {
				if (inLeftHalf) {
					rowItr.x--;
					startPos.x -= this.tilewidth / 2;
				} else {
					rowItr.y--;
					startPos.x += this.tilewidth / 2;
				}
				startPos.y -= this.tileheight / 2;
			}
			
			
			 // Determine whether the current row is shifted half a tile to the right
			var shifted = inUpperHalf ^ inLeftHalf;
				
			// main drawing loop			
			for (var y = startPos.y; y - this.tileheight < rectEnd.y; y += this.tileheight / 2) {
					
				   var columnItr = rowItr.clone();
				   console.log(columnItr);
				   
				   for (var x = startPos.x; x < rectEnd.x; x += this.tilewidth) {
				   
						var tmxTile = layer.layerData[columnItr.x][columnItr.y];
						if (tmxTile) {
							if (!layer.tileset.contains(tmxTile.tileId)) {
								layer.tileset = layer.tilesets.getTilesetByGid(tmxTile.tileId);
							}
							//this.drawTile(context, columnItr.x, columnItr.y, tmxTile, layer.tileset);
							// draw the tile
							layer.tileset.drawTile(context, columnItr.x, columnItr.y,  tmxTile);
						}
					
						// Advance to the next column
						rowItr.x++;
						rowItr.y--;
				}
				
				 // Advance to the next row
				if (!shifted) {
					rowItr.x++;
					startPos.x += this.tilewidth / 2;
					shifted = true;
				} else {
					rowItr.y++;
					startPos.x -= this.tilewidth / 2;
					shifted = false;
				}
			}
		}

	});

})(window);
