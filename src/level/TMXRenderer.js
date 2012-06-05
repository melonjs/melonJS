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
	 * a Generic Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	TMXRenderer = Object.extend({
		// constructor
		init: function(predraw, width, height, tilewidth, tileheight) {
			this.predraw = predraw; // not implemented (always true)
			this.width = width;
			this.height = height;
			this.tilewidth = tilewidth;
			this.tileheight = tileheight;
		},
		
		/**
		 * draw the a Tile on the map
		 * @private
		 */
		drawTile : function(context, x, y, tile, tileset) {
			// do nothing
		}
		
	});
	
	/**
	 * an Orthogonal Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXOrthogonalRenderer = TMXRenderer.extend({
		/**
		 * draw the tile map
		 * @private
		 */
		drawTile : function(context, x, y, tile, tileset) {
			// draw the tile
			tileset.drawTile(context, 
							 tileset.tileoffset.x + x * this.tilewidth,
							 tileset.tileoffset.y + (y + 1) * this.tileheight - tileset.tileheight,
							 tile.tileId - tileset.firstgid, 
							 tile.flipX, tile.flipY, tile.flipAD);
		}
	});
	
	
	/**
	 * an Orthogonal Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXIsometricRenderer = TMXRenderer.extend({
		/**
		 * draw the tile map
		 * @private
		 */
		drawTile : function(context, x, y, tile, tileset) {
			// draw the tile
			tileset.drawTile(context, 
							 ((this.width-1) * tileset.tilewidth + (x-y) * tileset.tilewidth>>1), 
							 (-tileset.tilewidth + (x+y) * tileset.tileheight>>2),
							 tile.tileId  - tileset.firstgid, 
							 tile.flipX, tile.flipY, tile.flipAD);
		}
	});

})(window);
