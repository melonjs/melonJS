/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/	
 *
 */

(function(window) {

	/**
	 * a TMX Map Reader
	 * Tile QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 * @private
	 */
	me.TMXMapReader = Object.extend({
		
		XMLReader : null,
		JSONReader : null,
		
		// temporary, the time to
		// rewrite the rest properly
		TMXParser: null,
		
		readMap: function (map) {
			// if already loaded, do nothing
			if (map.initialized)
				return;
			
			if (me.loader.getTMXFormat(map.levelId) === 'xml') {
				// create an instance of the XML Reader
				if  (this.XMLReader === null) {
					this.XMLReader = new XMLMapReader(); 
				}
				this.TMXParser = this.XMLReader.TMXParser;
				// load the map
				this.XMLReader.readXMLMap(map, me.loader.getTMX(map.levelId));
			
			}
			else /*JSON*/ {
				// create an instance of the JSON Reader
				if  (this.JSONReader === null) {
					this.JSONReader = new JSONMapReader(); 
				}
				this.JSONReader.readJSONMap(map, me.loader.getTMX(map.levelId));
			
			};
			
			
			// center the map if smaller than the current viewport
			if ((map.realwidth < me.game.viewport.width) || 
				(map.realheight < me.game.viewport.height)) {
					var shiftX =  ~~( (me.game.viewport.width - map.realwidth) / 2);
					var shiftY =  ~~( (me.game.viewport.height - map.realheight) / 2);
					// update the map default screen position
					map.pos.add({x:shiftX > 0 ? shiftX : 0 , y:shiftY > 0 ? shiftY : 0} );
			}
			
			// flag as loaded
			map.initialized = true;

		},
		
		/** 
		 * set a compatible renderer object
		 * for the specified map
		 * TODO : put this somewhere else
		 * @private
		 */
		getNewDefaultRenderer: function (obj) {
			switch (obj.orientation) {
				case "orthogonal": {
				  return new me.TMXOrthogonalRenderer(obj.width, obj.height, obj.tilewidth, obj.tileheight);
				  break;
				}
				case "isometric": {
				  return new me.TMXIsometricRenderer(obj.width, obj.height , obj.tilewidth, obj.tileheight);
				  break;
				}
				// if none found, throw an exception
				default : {
					throw "melonJS: " + obj.orientation + " type TMX Tile Map not supported!";
				}
			}
		}

	});
	
	/**
	 * a basic TMX/TSX Parser
	 * @class
	 * @constructor
	 * @ignore
	 **/
	function _TinyTMXParser() {
		var parserObj = {
			tmxDoc : null,

			// parse a TMX XML file
			setData : function(data) {
				this.tmxDoc = data;
			},

			getFirstElementByTagName : function(name) {
				return this.tmxDoc ? this.tmxDoc.getElementsByTagName(name)[0] : null;
			},

			getAllTagElements : function() {
				return this.tmxDoc ? this.tmxDoc.getElementsByTagName('*') : null;
			},

			getStringAttribute : function(elt, str, val) {
				var ret = elt.getAttribute(str);
				return ret ? ret.trim() : val;
			},

			getIntAttribute : function(elt, str, val) {
				var ret = this.getStringAttribute(elt, str, val);
				return ret ? parseInt(ret) : val;
			},

			getFloatAttribute : function(elt, str, val) {
				var ret = this.getStringAttribute(elt, str, val);
				return ret ? parseFloat(ret) : val;
			},

			getBooleanAttribute : function(elt, str, val) {
				var ret = this.getStringAttribute(elt, str, val);
				return ret ? (ret == "true") : val;
			},

			// free the allocated parser
			free : function() {
				this.tmxDoc = null;
			}
		}
		return parserObj;
	};
	
	/**
	 * a XML Map Reader
	 * Tile QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 * @private
	 */
	var XMLMapReader = me.TMXMapReader.extend({
		
		TMXParser : null,
		
		init: function(){
			if (!this.TMXParser) {
				this.TMXParser = new _TinyTMXParser();
			}
		},
		
		/**
		 * initialize a map using XML data
		 * @private
		 */
		readXMLMap : function(map, data) {
			if (!data) {
				throw "melonJS:" + map.levelId + " TMX map not found";
			};
			
			// to automatically increment z index
			var zOrder = 0;

			// init the parser
			this.TMXParser.setData(data);

			// retreive all the elements of the XML file
			var xmlElements = this.TMXParser.getAllTagElements();

			// parse all tags
			for ( var i = 0; i < xmlElements.length; i++) {

				// check each Tag
				switch (xmlElements.item(i).nodeName) {
					// get the map information
					case me.TMX_TAG_MAP: {
						var elements = xmlElements.item(i);
						map.version = this.TMXParser.getStringAttribute(elements, me.TMX_TAG_VERSION);
						map.orientation = this.TMXParser.getStringAttribute(elements, me.TMX_TAG_ORIENTATION);
						map.width = this.TMXParser.getIntAttribute(elements, me.TMX_TAG_WIDTH);
						map.height = this.TMXParser.getIntAttribute(elements, me.TMX_TAG_HEIGHT);
						map.tilewidth = this.TMXParser.getIntAttribute(elements,	me.TMX_TAG_TILEWIDTH);
						map.tileheight = this.TMXParser.getIntAttribute(elements, me.TMX_TAG_TILEHEIGHT);
						map.realwidth = map.width * map.tilewidth;
						map.realheight = map.height * map.tileheight;
						map.backgroundcolor = this.TMXParser.getStringAttribute(elements, me.TMX_BACKGROUND_COLOR);
						map.z = zOrder++;
					   
						// set the map properties (if any)
						me.TMXUtils.setTMXProperties(map, elements);
						
						// check if a user-defined background color is defined  
						map.background_color = map.backgroundcolor ? map.backgroundcolor : map.background_color;
						if (map.background_color) {
							map.mapLayers.push(new me.ColorLayer("background_color", 
																  map.background_color, 
																  zOrder++));
						}

						// check if a background image is defined
						if (map.background_image) {
							// add a new image layer
							map.mapLayers.push(new me.ImageLayer("background_image", 
																  map.width, map.height, 
																  map.background_image, 
																  zOrder++));
						}
						
					 	// initialize a default renderer
						if ((me.game.renderer === null) || !me.game.renderer.canRender(map)) {
							me.game.renderer = this.getNewDefaultRenderer(map);
						}
						
						break;
					};

					// get the tileset information
					case me.TMX_TAG_TILESET: {
					   // Initialize our object if not yet done
					   if (!map.tilesets) {
						  map.tilesets = new me.TMXTilesetGroup();
					   }
					   // add the new tileset
					   map.tilesets.add(this.readTileset(xmlElements.item(i)));
					   break;
					};
					
					// get image layer information
					case me.TMX_TAG_IMAGE_LAYER: {
						map.mapLayers.push(this.readImageLayer(map, xmlElements.item(i), zOrder++));
						break;
					};
					
					// get the layer(s) information
					case me.TMX_TAG_LAYER: {
						// regular layer or collision layer
						map.mapLayers.push(this.readLayer(map, xmlElements.item(i), zOrder++));
						break;
					};
					
					// get the object groups information
					case me.TMX_TAG_OBJECTGROUP: {
					   map.objectGroups.push(this.readObjectGroup(map, xmlElements.item(i), zOrder++));
					   break;
					};
					
					default : {
						// ignore unrecognized tags
						break;
					};
					
				} // end switch 
			
			} // end for

			// free the TMXParser ressource
			this.TMXParser.free();
		},
		
		
		readLayer: function (map, data, z) {
			var layer = new me.TMXLayer(map.tilewidth, map.tileheight, map.orientation, map.tilesets, z);
			// init the layer properly
			layer.initFromXML(data);
			// associate a renderer to the layer (if not a collision layer)
			if (!layer.isCollisionMap) {
				if (!me.game.renderer.canRender(layer)) {
					layer.setRenderer(me.mapReader.getNewDefaultRenderer(layer));
				} else {
					// use the default one
					layer.setRenderer(me.game.renderer);
				}
			}
			return layer;
		},

		readImageLayer: function(map, data, z) {
			// extract layer information
			var iln = this.TMXParser.getStringAttribute(data, me.TMX_TAG_NAME);
			var ilw = this.TMXParser.getIntAttribute(data, me.TMX_TAG_WIDTH);
			var ilh = this.TMXParser.getIntAttribute(data, me.TMX_TAG_HEIGHT);
			var ilsrc = data.getElementsByTagName(me.TMX_TAG_IMAGE)[0].getAttribute(me.TMX_TAG_SOURCE);
			
			// create the layer
			var imageLayer = new me.ImageLayer(iln, ilw * map.tilewidth, ilh * map.tileheight, ilsrc, z);
			
			// set some additional flags
			imageLayer.visible = (this.TMXParser.getIntAttribute(data, me.TMX_TAG_VISIBLE, 1) == 1);
			imageLayer.opacity = this.TMXParser.getFloatAttribute(data, me.TMX_TAG_OPACITY, 1.0);
			
			// check if we have any properties 
			me.TMXUtils.setTMXProperties(imageLayer, data);

			// add the new layer
			return imageLayer;
						
		},

		
		readTileset : function (data) {
			var tileset = new me.TMXTileset();
			tileset.initFromXML(data);
			return tileset;
		},
		
   
		readObjectGroup: function(map, data, z) {
			  var name = this.TMXParser.getStringAttribute(data, me.TMX_TAG_NAME);
			  return new me.TMXOBjectGroup(name, data, map.tilesets, z);
		}

	});
	
	/**
	 * a JSON Map Reader
	 * Tile QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 * @private
	 */
	var JSONMapReader = me.TMXMapReader.extend({
		
		readJSONMap: function (map) {
			// TODO
		},
		
		readLayer: function (layer) {
			var layer = new me.TMXLayer(data, map.tilewidth, map.tileheight, map.orientation, map.tilesets, z);
			// init the layer properly
			layer.initFromJSON(data);
			// associate a renderer to the layer (if not a collision layer)
			if (!layer.isCollisionMap) {
				if (!me.game.renderer.canRender(layer)) {
					layer.setRenderer(me.mapReader.getNewDefaultRenderer(layer));
				} else {
					// use the default one
					layer.setRenderer(me.game.renderer);
				}
			}
			return layer;
		},
		
		readImageLayer: function() {
			// TODO
		},
		
		readTileset : function (data) {
			var tileset = new me.TMXTileset();
			tileset.initFromJSON(data);
			return tileset;
		},
		
		readObjectGroup: function() {
			// TODO
		}
	
	});
	


})(window);
