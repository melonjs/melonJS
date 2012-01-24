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
		
	/**
	 * a Generic Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXRenderer = Object.extend({
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
		 * this is only called if the background_color or background_image property is defined
		 * @private
		 */
		drawTile : function(context, x, y, gid, tileset, flipX, flipY) {
			// do nothing
		}
		
	});
	
	/**
	 * am Orthogonal Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXOrthogonalRenderer = me.TMXRenderer.extend({
		/**
		 * draw the tile map
		 * this is only called if the background_color or background_image property is defined
		 * @private
		 */
		drawTile : function(context, x, y, gid, tileset, flipX, flipY) {
			// draw the tile
			tileset.drawTile(context, 
							 tileset.tileoffset.x + x * this.tilewidth,
							 tileset.tileoffset.y + (y + 1) * this.tileheight - tileset.tileheight,
							 gid - tileset.firstgid, 
							 flipX, flipY);
		}
	});
	
	
	/**
	 * am Orthogonal Map Renderder
	 * Tile QT 0.7.x format
	 * @memberOf me
	 * @private
	 * @constructor
	 */
	me.TMXIsometricRenderer = me.TMXRenderer.extend({
		/**
		 * draw the tile map
		 * this is only called if the background_color or background_image property is defined
		 * @private
		 */
		drawTile : function(context, x, y, gid, tileset, flipX, flipY) {
			// draw the tile
			tileset.drawTile(context, 
							 ((this.width-1) * tileset.tilewidth + (x-y) * tileset.tilewidth>>1), 
							 (-tileset.tilewidth + (x+y) * tileset.tileheight>>2),
							 gid - tileset.firstgid, 
							 flipX, flipY);
		}
	});

})(window);
