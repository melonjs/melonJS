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
	 * TMX Object Group <br>
	 * contains the object group definition as defined in Tiled. <br>
	 * note : object group definition is translated into the virtual `me.game.world` using `me.ObjectContainer`.
	 * @see me.ObjectContainer
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 */
	me.TMXObjectGroup = Object.extend({
		
		/**
		 * group name
		 * @public
		 * @type String
		 * @name name
		 * @memberOf me.TMXObjectGroup
		 */
		name : null,
		
		/**
		 * group width
		 * @public
		 * @type Number
		 * @name name
		 * @memberOf me.TMXObjectGroup
		 */
		width : 0,
		
		/**
		 * group height
		 * @public
		 * @type Number
		 * @name name
		 * @memberOf me.TMXObjectGroup
		 */
		height : 0,
		
		/**
		 * group visibility state
		 * @public
		 * @type Boolean
		 * @name name
		 * @memberOf me.TMXObjectGroup
		 */
		visible : false,
		
		/**
		 * group z order
		 * @public
		 * @type Number
		 * @name name
		 * @memberOf me.TMXObjectGroup
		 */
		z : 0,
		
		/**
		 * group objects list definition
		 * @see me.TMXObject
		 * @public
		 * @type Array
		 * @name name
		 * @memberOf me.TMXObjectGroup
		 */
		objects : [],

		/**
		 * constructor from XML content
		 * @ignore
		 * @function
		 */
		initFromXML : function(name, tmxObjGroup, tilesets, z) {
			
			this.name    = name;
			this.width   = me.mapReader.TMXParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_WIDTH);
			this.height  = me.mapReader.TMXParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_HEIGHT);
			this.visible = (me.mapReader.TMXParser.getIntAttribute(tmxObjGroup, me.TMX_TAG_VISIBLE, 1) === 1);
			this.opacity = me.mapReader.TMXParser.getFloatAttribute(tmxObjGroup, me.TMX_TAG_OPACITY, 1.0).clamp(0.0, 1.0);
			this.z       = z;
			this.objects = [];
		
			// check if we have any user-defined properties
			if (tmxObjGroup.firstChild && (tmxObjGroup.firstChild.nextSibling.nodeName === me.TMX_TAG_PROPERTIES))  {
				me.TMXUtils.applyTMXPropertiesFromXML(this, tmxObjGroup);
			}
			
			var data = tmxObjGroup.getElementsByTagName(me.TMX_TAG_OBJECT);
			for ( var i = 0; i < data.length; i++) {
				var object = new me.TMXObject();
				object.initFromXML(data[i], tilesets, z);
				this.objects.push(object);
			}
		},
		
		/**
		 * constructor from JSON content
		 * @ignore
		 * @function
		 */
		initFromJSON : function(name, tmxObjGroup, tilesets, z) {
			var self = this;
			
			this.name    = name;
			this.width   = tmxObjGroup[me.TMX_TAG_WIDTH];
			this.height  = tmxObjGroup[me.TMX_TAG_HEIGHT];
			this.visible = tmxObjGroup[me.TMX_TAG_VISIBLE];
			this.opacity = parseFloat(tmxObjGroup[me.TMX_TAG_OPACITY] || 1.0).clamp(0.0, 1.0);
			this.z       = z;
			this.objects  = [];
			
			// check if we have any user-defined properties 
			me.TMXUtils.applyTMXPropertiesFromJSON(this, tmxObjGroup);
			
			// parse all TMX objects
			tmxObjGroup["objects"].forEach(function(tmxObj) {
				var object = new me.TMXObject();
				object.initFromJSON(tmxObj, tilesets, z);
				self.objects.push(object);
			});
		},
		
		/**
		 * reset function
		 * @ignore
		 * @function
		 */
		reset : function() {
			// clear all allocated objects
			this.objects = null;
		},
		
		/**
		 * return the object count
		 * @ignore
		 * @function
		 */
		getObjectCount : function() {
			return this.objects.length;
		},

		/**
		 * returns the object at the specified index
		 * @ignore
		 * @function
		 */
		getObjectByIndex : function(idx) {
			return this.objects[idx];
		}
	});

	/**
	 * a TMX Object defintion, as defined in Tiled. <br>
	 * note : object definition are translated into the virtual `me.game.world` using `me.ObjectEntity`.
	 * @see me.ObjectEntity
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 */

	me.TMXObject = Object.extend({

		/**
		 * object name
		 * @public
		 * @type String
		 * @name name
		 * @memberOf me.TMXObject
		 */
		name : null, 
		
		/**
		 * object x position
		 * @public
		 * @type Number
		 * @name x
		 * @memberOf me.TMXObject
		 */
		x : 0,

		/**
		 * object y position
		 * @public
		 * @type Number
		 * @name y
		 * @memberOf me.TMXObject
		 */
		y : 0,

		/**
		 * object width
		 * @public
		 * @type Number
		 * @name width
		 * @memberOf me.TMXObject
		 */
		width : 0,

		/**
		 * object height
		 * @public
		 * @type Number
		 * @name height
		 * @memberOf me.TMXObject
		 */
		height : 0,
		
		/**
		 * object z order
		 * @public
		 * @type Number
		 * @name z
		 * @memberOf me.TMXObject
		 */
		z : 0,

		/**
		 * object gid value
		 * when defined the object is a tiled object
		 * @public
		 * @type Number
		 * @name gid
		 * @memberOf me.TMXObject
		 */
		gid : undefined,

		/**
		 * if true, the object is a polygone
		 * @public
		 * @type Boolean
		 * @name isPolygon
		 * @memberOf me.TMXObject
		 */
		isPolygon : false,
		
		/**
		 * f true, the object is a polygone
		 * @public
		 * @type Boolean
		 * @name isPolyline
		 * @memberOf me.TMXObject
		 */
		isPolyline : false,
		
		/**
		 * object point list (for polygone and polyline)
		 * @public
		 * @type Vector2d[]
		 * @name points
		 * @memberOf me.TMXObject
		 */
		points : undefined,

		/**
		 * constructor from XML content
		 * @ignore
		 * @function
		 */
		initFromXML :  function(tmxObj, tilesets, z) {
			this.name = me.mapReader.TMXParser.getStringAttribute(tmxObj, me.TMX_TAG_NAME);
			this.x = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_X);
			this.y = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_Y);
			this.z = z;

			this.width = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_WIDTH, 0);
			this.height = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_HEIGHT, 0);
			this.gid = me.mapReader.TMXParser.getIntAttribute(tmxObj, me.TMX_TAG_GID, null);
            
            this.isEllipse = false;
            this.isPolygon = false;
            this.isPolyline = false;
            

			// check if the object has an associated gid	
			if (this.gid) {
				this.setImage(this.gid, tilesets);
			} else {
                
                // check if this is an ellipse 
                if (tmxObj.getElementsByTagName(me.TMX_TAG_ELLIPSE).length) {
                    this.isEllipse = true;
                } else {
					// polygone || polyline
					var points = tmxObj.getElementsByTagName(me.TMX_TAG_POLYGON);
					if (points.length) {
						this.isPolygon = true;
					} else {
						points = tmxObj.getElementsByTagName(me.TMX_TAG_POLYLINE);
						if (points.length) {
							this.isPolyline = true;
						}
					}
                    if (points.length) {
                        this.points = [];
                        // get a point array
                        var point = me.mapReader.TMXParser.getStringAttribute(
							points[0], 
							me.TMX_TAG_POINTS
                        ).split(" ");
                        // and normalize them into an array of vectors
                        for (var i = 0, v; i < point.length; i++) {
                            v = point[i].split(",");
                            this.points.push(new me.Vector2d(+v[0], +v[1]));
                        }
                    }	
                }
			}
			
			// Adjust the Position to match Tiled
			me.game.renderer.adjustPosition(this);
			
			// set the object properties
			me.TMXUtils.applyTMXPropertiesFromXML(this, tmxObj);
		},
		

		/**
		 * constructor from JSON content
		 * @ignore
		 * @function
		 */
		initFromJSON :  function(tmxObj, tilesets, z) {
			
			this.name = tmxObj[me.TMX_TAG_NAME];
			this.x = parseInt(tmxObj[me.TMX_TAG_X], 10);
			this.y = parseInt(tmxObj[me.TMX_TAG_Y], 10);
			this.z = parseInt(z, 10);

			this.width = parseInt(tmxObj[me.TMX_TAG_WIDTH] || 0, 10);
			this.height = parseInt(tmxObj[me.TMX_TAG_HEIGHT] || 0, 10);
			this.gid = parseInt(tmxObj[me.TMX_TAG_GID], 10) || null;
			
			this.isEllipse = false;
            this.isPolygon = false;
            this.isPolyline = false;
            
			// check if the object has an associated gid	
			if (this.gid) {
				this.setImage(this.gid, tilesets);
			}
			else {
                if (tmxObj[me.TMX_TAG_ELLIPSE]!==undefined) {
                    this.isEllipse = true;
                } 
                else {
                    var points = tmxObj[me.TMX_TAG_POLYGON];
                    if (points !== undefined) {
						this.isPolygon = true;
                    } else {
						points = tmxObj[me.TMX_TAG_POLYLINE];
						if (points !== undefined) {
							this.isPolyline = true;
						}
                    }
                    if (points !== undefined) {
                        this.points = [];
                        var self = this;
                        points.forEach(function(point) {
                            self.points.push(new me.Vector2d(parseInt(point.x, 10), parseInt(point.y, 10)));
                        });
                    }
                   }
			}
			
			// Adjust the Position to match Tiled
			me.game.renderer.adjustPosition(this);
			
			// set the object properties
			me.TMXUtils.applyTMXPropertiesFromJSON(this, tmxObj);
		},
		
		/**
		 * set the object image (for Tiled Object)
		 * @ignore
		 * @function
		 */
		setImage : function(gid, tilesets) {
			// get the corresponding tileset
			var tileset = tilesets.getTilesetByGid(this.gid);
		 
			// set width and height equal to tile size
			this.width = tileset.tilewidth;
			this.height = tileset.tileheight;
			
			// force spritewidth size
			this.spritewidth = this.width;

			// the object corresponding tile 
			var tmxTile = new me.Tile(this.x, this.y, tileset.tilewidth, tileset.tileheight, this.gid);

			// get the corresponding tile into our object
			this.image = tileset.getTileImage(tmxTile);
		},
		
		/**
		 * getObjectPropertyByName
		 * @ignore
		 * @function
		 */
		getObjectPropertyByName : function(name) {
			return this[name];
		}

	});

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
