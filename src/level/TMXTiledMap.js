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
	 * a TMX Tile Map Object
	 * Tile QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 */
	me.TMXTileMap = Object.extend({
		// constructor
		init: function(levelId, x, y) {
			// map default position
			this.pos = new me.Vector2d(x, y);
			
			// map id
			this.levelId = levelId;
			
			// map default z order
			this.z = 0;
			
			/**
			 * name of the tilemap
			 * @public
			 * @type String
			 * @name me.TMXTileMap#name
			 */
			this.name = null;
			
			/**
			 * width of the tilemap in Tile
			 * @public
			 * @type Int
			 * @name me.TMXTileMap#width
			 */
			this.width = 0;
			
			/**
			 * height of the tilemap in Tile
			 * @public
			 * @type Int
			 * @name me.TMXTileMap#height
			 */
			this.height = 0;

			/**
			 * width of the tilemap in pixels
			 * @public
			 * @type Int
			 * @name me.TMXTileMap#realwidth
			 */
			this.realwidth = -1;
			
			/**
			 * height of the tilemap in pixels
			 * @public
			 * @type Int
			 * @name me.TMXTileMap#realheight
			 */
			this.realheight = -1;

			/**
			 * Tile width
			 * @public
			 * @type Int
			 * @name me.TMXTileMap#tilewidth
			 */
			this.tilewidth = 0;

			/**
			 * Tile height
			 * @public
			 * @type Int
			 * @name me.TMXTileMap#tileheight
			 */
			this.tileheight = 0;

			// corresponding tileset for this map
			this.tilesets = null;

			// map layers
			this.mapLayers = [];

			// map Object
			this.objectGroups = [];

			// loading flag
			this.initialized = false;

			// tilemap version
			this.version = "";

			// map type (only orthogonal format supported)
			this.orientation = "";

			// tileset(s)
			this.tilesets = null;
			
		},
		
		/**
		 * a dummy update function
		 * @private
		 */
		reset : function() {
			if (this.initialized === true) {
				// reset/clear all layers
				for ( var i = this.mapLayers.length; i--;) {
					this.mapLayers[i].reset();
					this.mapLayers[i] = null;
				};
				// reset object groups
				for ( var i = this.objectGroups.length; i--;) {
					this.objectGroups[i].reset();
					this.objectGroups[i] = null;
				};
				// call parent reset function
				this.tilesets = null;
				this.mapLayers.length = 0;
				this.objectGroups.length = 0;
				this.pos.set(0,0);
				// set back as not initialized
				this.initialized = false;
			}
		},
		
		/**
		 * return the specified object group
		 * @private	
		 */
		getObjectGroupByName : function(name) {
			var objectGroup = null;
           		// normalize name
           		name = name.trim().toLowerCase();
           		for ( var i = this.objectGroups.length; i--;) {
               		if (this.objectGroups[i].name.toLowerCase().contains(name)) {
                   			objectGroup = this.objectGroups[i];
                   			break;
               		}
           		};
			return objectGroup;
		},

		/**
		 * return all the object group
		 * @private		
		 */
		getObjectGroups : function() {
			return this.objectGroups;
		},
		
		/**
		 * return all the existing layers
		 * @name me.TMXTileMap#getLayers
		 * @public
		 * @function
		 * @return {me.TMXLayer[]} Array of Layers
		 */
		getLayers : function() {
			return this.mapLayers;
		},

		/**
		 * return the specified layer object
		 * @name me.TMXTileMap#getLayerByName
		 * @public
		 * @function
		 * @param {String} name Layer Name 
		 * @return {me.TMXLayer} Layer Object
		 */
		getLayerByName : function(name) {
			var layer = null;

			// normalize name
			name = name.trim().toLowerCase();
			for ( var i = this.mapLayers.length; i--;) {
				if (this.mapLayers[i].name.toLowerCase().contains(name)) {
					layer = this.mapLayers[i];
					break;
				}
			};

			// return a fake collision layer if not found
			if ((name.toLowerCase().contains(me.LevelConstants.COLLISION_MAP)) && (layer == null)) {
				layer = new CollisionTiledLayer(me.game.currentLevel.realwidth,	me.game.currentLevel.realheight);
			}

			return layer;
		},

		/**
		 * clear the tile at the specified position from all layers
		 * @name me.TMXTileMap#clearTile
		 * @public
		 * @function
		 * @param {Integer} x x position 
		 * @param {Integer} y y position 
		 */
		clearTile : function(x, y) {
			// add all layers
			for ( var i = this.mapLayers.length; i--;) {
				// that are visible
				if (this.mapLayers[i] instanceof me.TMXLayer) {
					this.mapLayers[i].clearTile(x, y);
				}
			};
		}


	});
		

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
