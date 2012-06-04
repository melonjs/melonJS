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
		
	/* -----

		check if properties are defined for the given objet
			
		------									*/

	function setTMXProperties(obj, xmldata) {
		var layer_properties = xmldata.getElementsByTagName(me.TMX_TAG_PROPERTIES)[0];

		if (layer_properties) {
			var oProp = layer_properties.getElementsByTagName(me.TMX_TAG_PROPERTY);

			for ( var i = 0; i < oProp.length; i++) {
				var propname = me.XMLParser.getStringAttribute(oProp[i], me.TMX_TAG_NAME);
				var value = me.XMLParser.getStringAttribute(oProp[i], me.TMX_TAG_VALUE);
				
				// if value not defined or boolean
				if (!value || value.isBoolean()) {
					value = value ? (value == "true") : true;
				}
				// check if numeric
				else if (value.isNumeric()) {
					value = parseInt(value);
				}
				// add the new prop to the object prop list
				obj[propname] = value;
						
			}
		}

	};

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

				// get the corresponding tile into our object
				this.image = tileset.getTileImage(this.gid - tileset.firstgid);
			} 
			else {
				this.width = me.XMLParser.getIntAttribute(tmxObj, me.TMX_TAG_WIDTH, 0);
				this.height = me.XMLParser.getIntAttribute(tmxObj, me.TMX_TAG_HEIGHT, 0);
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
