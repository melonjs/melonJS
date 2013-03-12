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
	 * TMX Group Object
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @private
	 */
	me.TMXOBjectGroup = Object.extend(
	{

		
		// constructor from XML content
		initFromXML : function(name, tmxObjGroup, tilesets, z) {
			
			this.name    = name;
			this.width   = me.mapReader.TMXParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_WIDTH);
			this.height  = me.mapReader.TMXParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_HEIGHT);
			this.visible = (me.mapReader.TMXParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_VISIBLE, 1) == 1);
			this.z       = z;
			this.objects = [];
		
			// check if we have any user-defined properties
			if (tmxObjGroup.firstChild && (tmxObjGroup.firstChild.nextSibling.nodeName === me.TMX_TAG_PROPERTIES))  {
				me.TMXUtils.applyTMXPropertiesFromXML(this, tmxObjGroup);
			}
			
			var data = tmxObjGroup.getElementsByTagName(me.TMX_TAG_OBJECT);
			for ( var i = 0; i < data.length; i++) {
				var object = new me.TMXOBject();
				object.initFromXML(data[i], tilesets, z);
				this.objects.push(object);
			}
		},
		
		// constructor from XML content
		initFromJSON : function(name, tmxObjGroup, tilesets, z) {
			var self = this;
			
			this.name    = name;
			this.width   = tmxObjGroup[me.TMX_TAG_WIDTH];
			this.height  = tmxObjGroup[me.TMX_TAG_HEIGHT];
			this.visible = tmxObjGroup[me.TMX_TAG_VISIBLE];
			this.z       = z;
			this.objects  = [];
			
			// check if we have any user-defined properties 
			me.TMXUtils.applyTMXPropertiesFromJSON(this, tmxObjGroup);
			
			// parse all TMX objects
			tmxObjGroup["objects"].forEach(function(tmxObj) {
				var object = new me.TMXOBject();
				object.initFromJSON(tmxObj, tilesets, z);
				self.objects.push(object);
			});
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

	me.TMXOBject = Object.extend(
	{
		initFromXML :  function(tmxObj, tilesets, z) {
			this.name = me.mapReader.TMXParser.getStringAttribute(tmxObj, me.TMX_TAG_NAME);
			this.x = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_X);
			this.y = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_Y);
			this.z = z;

			this.width = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_WIDTH, 0);
			this.height = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_HEIGHT, 0);
			this.gid = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_GID, null);
			
			// check if the object has an associated gid	
			if (this.gid) {
				this.setImage(this.gid, tilesets);
			} else {
				var polygon = tmxObj.getElementsByTagName(me.TMX_TAG_POLYGON);
				this.isPolygon = true;
				if (!polygon.length) {
					polygon = tmxObj.getElementsByTagName(me.TMX_TAG_POLYLINE);
					this.isPolygon = false;
				}

				if (polygon.length) {
					this.points = [];
					var points = me.mapReader.TMXParser.getStringAttribute(polygon[0], me.TMX_TAG_POINTS);
					var point = points.split(" ");
					for (var i = 0, v; i < point.length; i++) {
						v = point[i].split(",");
						this.points[i] = new me.Vector2d(+v[0], +v[1]);
					}
				}
			}
			// set the object properties
			me.TMXUtils.applyTMXPropertiesFromXML(this, tmxObj);
		},
		
		initFromJSON :  function(tmxObj, tilesets, z) {
			
			
			this.name = tmxObj[me.TMX_TAG_NAME];
			this.x = parseInt(tmxObj[me.TMX_TAG_X]);
			this.y = parseInt(tmxObj[me.TMX_TAG_Y]);
			this.z = parseInt(z);

			this.width = parseInt(tmxObj[me.TMX_TAG_WIDTH] || 0);
			this.height = parseInt(tmxObj[me.TMX_TAG_HEIGHT] || 0);
			this.gid = parseInt(tmxObj[me.TMX_TAG_GID]) || null;
			
			
			// check if the object has an associated gid	
			if (this.gid) {
				this.setImage(this.gid, tilesets);
			}
			else {
				var polygon = tmxObj[me.TMX_TAG_POLYGON];
				this.isPolygon = polygon!==undefined;
				if (!polygon) {
					polygon = tmxObj[me.TMX_TAG_POLYLINE];
					this.isPolygon = false;
				}
				if (polygon) {
					this.points = [];
					var self = this;
					var i = 0;
					polygon.forEach(function(point) {
						self.points[i++] = new me.Vector2d(parseInt(point.x), parseInt(point.y));
					});
				}
			}
			// set the object properties
			me.TMXUtils.applyTMXPropertiesFromJSON(this, tmxObj);
		},
		
		setImage : function(gid, tilesets) {
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
		},
		
		getObjectPropertyByName : function(name) {
			return this[name];
		}

	});

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
