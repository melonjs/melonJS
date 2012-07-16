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
	 * TMX Group Object
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @private
	 */
	me.TMXOBjectGroup = Object.extend(
	{
		// constructor
		init : function(name, tmxObjGroup, tilesets, z) {
			this.objects = [];

			this.name   = name;
			this.width  = me.XMLParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_WIDTH);
			this.height = me.XMLParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_HEIGHT);
			this.z      = z;

			var data = tmxObjGroup.getElementsByTagName(me.TMX_TAG_OBJECT);

			for ( var i = 0; i < data.length; i++) {
				this.objects.push(new TMXOBject(data[i], tilesets, z));
			}
		},
		
		/**
		 * reset function
		 * @private
		 * @function
		 */
		reset : function() {
			// clear all allocated objects
			this.objects = null;
		},
		
		getObjectCount : function() {
			return this.objects.length;
		},

		getObjectByIndex : function(idx) {
			return this.objects[idx];
		}
	});

	/**
	 * a TMX Object
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @private
	 */

	TMXOBject = Object.extend(
	{
		init :  function(tmxObj, tilesets, z) {
			this.name = me.XMLParser.getStringAttribute(tmxObj, me.TMX_TAG_NAME);
			this.x = me.XMLParser.getIntAttribute(tmxObj, me.TMX_TAG_X);
			this.y = me.XMLParser.getIntAttribute(tmxObj, me.TMX_TAG_Y);
			this.z = z;

			this.width = me.XMLParser.getIntAttribute(tmxObj, me.TMX_TAG_WIDTH, 0);
			this.height = me.XMLParser.getIntAttribute(tmxObj, me.TMX_TAG_HEIGHT, 0);
			this.gid = me.XMLParser.getIntAttribute(tmxObj, me.TMX_TAG_GID, null);
			// check if the object has an associated gid	
			if (this.gid) {
				
				// get the corresponding tileset
				var tileset = tilesets.getTilesetByGid(this.gid);
			 
				// set width and height equal to tile size
				this.width = tileset.tilewidth;
				this.height = tileset.tileheight;

				// force spritewidth size
				this.spritewidth = this.width;
				// adjust y coordinates (bug in tile 0.6.2?)
				this.y -= this.height;

				// the object corresponding tile 
				var tmxTile = new me.Tile(this.x, this.y, tileset.tilewidth, tileset.tileheight, this.gid);

				// get the corresponding tile into our object
				this.image = tileset.getTileImage(tmxTile);
			} 
			else {
				var polygon = tmxObj.getElementsByTagName(me.TMX_TAG_POLYGON);
				this.isPolygon = true;
				if (!polygon.length) {
					polygon = tmxObj.getElementsByTagName(me.TMX_TAG_POLYLINE);
					this.isPolygon = false;
				}

				if (polygon.length) {
					this.points = [];
					var points = me.XMLParser.getStringAttribute(polygon[0], me.TMX_TAG_POINTS);
					var point = points.split(" ");
					for (var i = 0, v; i < point.length; i++) {
						v = point[i].split(",");
						this.points[i] = new me.Vector2d(+v[0], +v[1]);
					}
				}
			}
			// set the object properties
			me.TMXUtils.setTMXProperties(this, tmxObj);
		},
		
		getObjectPropertyByName : function(name) {
			return this[name];
		}

	});

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
