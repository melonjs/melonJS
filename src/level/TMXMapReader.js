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
	 * Tiled QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 * @ignore
	 */
	me.TMXMapReader = Object.extend({
		
		XMLReader : null,
		JSONReader : null,
		
		// temporary, the time to
		// rewrite the rest properly
		TMXParser: null,
		
		readMap: function (map) {
			// if already loaded, do nothing
			if (map.initialized) {
				return;
			}
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
			
			}
			
			
			// center the map if smaller than the current viewport
			if ((map.width < me.game.viewport.width) || 
				(map.height < me.game.viewport.height)) {
					var shiftX =  ~~( (me.game.viewport.width - map.width) / 2);
					var shiftY =  ~~( (me.game.viewport.height - map.height) / 2);
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
		 * @ignore
		 */
		getNewDefaultRenderer: function (obj) {
			switch (obj.orientation) {
				case "orthogonal": {
				  return new me.TMXOrthogonalRenderer(obj.cols, obj.rows, obj.tilewidth, obj.tileheight);
				}
				case "isometric": {
				  return new me.TMXIsometricRenderer(obj.cols, obj.rows , obj.tilewidth, obj.tileheight);
				}
				// if none found, throw an exception
				default : {
					throw "melonJS: " + obj.orientation + " type TMX Tile Map not supported!";
				}
			}
		},
		
		
		/**
		 * Set tiled layer Data
		 * @ignore
		 */
		setLayerData : function(layer, data, encoding, compression) {
			// initialize the layer data array
			layer.initArray(layer.cols, layer.rows);
			
			// decode data based on encoding type
			switch (encoding) {
				// XML encoding
				case null:
					var data = data.getElementsByTagName(me.TMX_TAG_TILE);
					break;
				// json encoding
				case 'json':
					// do nothing as data can be directly reused
					break;
				// CSV encoding
				case me.TMX_TAG_CSV:
				// Base 64 encoding
				case me.TMX_TAG_ATTR_BASE64: {
					// Merge all childNodes[].nodeValue into a single one
					var nodeValue = '';
					for ( var i = 0, len = data.childNodes.length; i < len; i++) {
						nodeValue += data.childNodes[i].nodeValue;
					}
					// and then decode them
					if (encoding == me.TMX_TAG_CSV) {
						// CSV decode
						var data = me.utils.decodeCSV(nodeValue, layer.cols);
					} else {
						// Base 64 decode
						var data = me.utils.decodeBase64AsArray(nodeValue, 4);
						// check if data is compressed
						if (compression !== null) {
							data = me.utils.decompress(data, compression);
						}
					}
					// ensure nodeValue is deallocated
					nodeValue = null;
					break;
				}
				  
				default:
					throw "melonJS: TMX Tile Map " + encoding + " encoding not supported!";
			}
					

			var idx = 0;
			// set everything
			for ( var y = 0 ; y <layer.rows; y++) {
				for ( var x = 0; x <layer.cols; x++) {
					// get the value of the gid
					var gid = (encoding == null) ? this.TMXParser.getIntAttribute(data[idx++], me.TMX_TAG_GID) : data[idx++];
					// fill the array										
					if (gid !== 0) {
						// create a new tile object
						var tmxTile = new me.Tile(x, y, layer.tilewidth, layer.tileheight, gid);
						// set the tile in the data array
						layer.layerData[x][y] = tmxTile;
						// switch to the right tileset
						if (!layer.tileset.contains(tmxTile.tileId)) {
							layer.tileset = layer.tilesets.getTilesetByGid(tmxTile.tileId);
						}
						// draw the corresponding tile
						if (layer.visible && layer.preRender) {
							layer.renderer.drawTile(layer.layerSurface, x, y, tmxTile, layer.tileset);
						}
					}
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
				return ret ? (ret === "true") : val;
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
	 * Tiled QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 * @ignore
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
		 * @ignore
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
						map.cols = this.TMXParser.getIntAttribute(elements, me.TMX_TAG_WIDTH);
						map.rows = this.TMXParser.getIntAttribute(elements, me.TMX_TAG_HEIGHT);
						map.tilewidth = this.TMXParser.getIntAttribute(elements, me.TMX_TAG_TILEWIDTH);
						map.tileheight = this.TMXParser.getIntAttribute(elements, me.TMX_TAG_TILEHEIGHT);
						map.width = map.cols * map.tilewidth;
						map.height = map.rows * map.tileheight;
						map.backgroundcolor = this.TMXParser.getStringAttribute(elements, me.TMX_BACKGROUND_COLOR);
						map.z = zOrder++;
					   
						// set the map properties (if any)
						me.TMXUtils.applyTMXPropertiesFromXML(map, elements);
						
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
			
			
			// check data encoding/compression type
			var layerData = data.getElementsByTagName(me.TMX_TAG_DATA)[0];
			var encoding = this.TMXParser.getStringAttribute(layerData, me.TMX_TAG_ENCODING, null);
			var compression = this.TMXParser.getStringAttribute(layerData, me.TMX_TAG_COMPRESSION, null);
			// make sure this is not happening
			if (encoding === '') {
				encoding = null;
			}
			if (compression === '') {
				compression = null;
			}
			
			// associate a renderer to the layer (if not a collision layer)
			if (!layer.isCollisionMap || me.debug.renderCollisionMap) {
				if (!me.game.renderer.canRender(layer)) {
					layer.setRenderer(me.mapReader.getNewDefaultRenderer(layer));
				} else {
					// use the default one
					layer.setRenderer(me.game.renderer);
				}
			}
			
			// parse the layer data
			this.setLayerData(layer, layerData, encoding, compression);
			// free layerData
			layerData = null;
			
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
			me.TMXUtils.applyTMXPropertiesFromXML(imageLayer, data);
			
			// make sure ratio is a vector (backward compatibility)
			if (typeof(imageLayer.ratio) === "number") {
				imageLayer.ratio = new me.Vector2d(parseFloat(imageLayer.ratio), parseFloat(imageLayer.ratio));
			}

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
			var group = new me.TMXObjectGroup();
			group.initFromXML(name, data, map.tilesets, z);
			return group;
		}

	});
	
	/**
	 * a JSON Map Reader
	 * Tiled QT 0.7.x format
	 * @class
	 * @memberOf me
	 * @constructor
	 * @ignore
	 */
	var JSONMapReader = me.TMXMapReader.extend({
		
		readJSONMap: function (map, data) {
			if (!data) {
				throw "melonJS:" + map.levelId + " TMX map not found";
			}
			
			// to automatically increment z index
			var zOrder = 0;
			
			// keep a reference to our scope
			var self = this;
			
			// map information
			map.version = data[me.TMX_TAG_VERSION];
			map.orientation = data[me.TMX_TAG_ORIENTATION];
			map.cols = parseInt(data[me.TMX_TAG_WIDTH]);
			map.rows = parseInt(data[me.TMX_TAG_HEIGHT]);
			map.tilewidth = parseInt(data[me.TMX_TAG_TILEWIDTH]);
			map.tileheight = parseInt(data[me.TMX_TAG_TILEHEIGHT]);
			map.width = map.cols * map.tilewidth;
			map.height = map.rows * map.tileheight;
			map.backgroundcolor = data[me.TMX_BACKGROUND_COLOR];
			map.z = zOrder++;
		   
			// set the map properties (if any)
			me.TMXUtils.applyTMXPropertiesFromJSON(map, data);
			
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
			
			// Tileset information
			if (!map.tilesets) {
				// make sure we have a TilesetGroup Object
				map.tilesets = new me.TMXTilesetGroup();
			}
			// parse all tileset objects
			data["tilesets"].forEach(function(tileset) {
				// add the new tileset
				map.tilesets.add(self.readTileset(tileset));
			});
			
			// get layers information
			data["layers"].forEach(function(layer) {
				switch (layer.type) {
					case me.TMX_TAG_IMAGE_LAYER : {
						map.mapLayers.push(self.readImageLayer(map, layer, zOrder++));
						break;
					}
					case me.TMX_TAG_TILE_LAYER : {
						map.mapLayers.push(self.readLayer(map, layer, zOrder++));
						break;
					}
					// get the object groups information
					case me.TMX_TAG_OBJECTGROUP: {
					   map.objectGroups.push(self.readObjectGroup(map, layer, zOrder++));
					   break;
					};
					default : break;
				}
			});
			
			// FINISH !
		},
		
		readLayer: function (map, data, z) {
			var layer = new me.TMXLayer(map.tilewidth, map.tileheight, map.orientation, map.tilesets, z);
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
			// parse the layer data
			this.setLayerData(layer, data[me.TMX_TAG_DATA], 'json', null);
			return layer;
		},
		
		readImageLayer: function(map, data, z) {
			// extract layer information
			var iln = data[me.TMX_TAG_NAME];
			var ilw = parseInt(data[me.TMX_TAG_WIDTH]);
			var ilh = parseInt(data[me.TMX_TAG_HEIGHT]);
			var ilsrc = data[me.TMX_TAG_IMAGE];
			
			// create the layer
			var imageLayer = new me.ImageLayer(iln, ilw * map.tilewidth, ilh * map.tileheight, ilsrc, z);
			
			// set some additional flags
			imageLayer.visible = data[me.TMX_TAG_VISIBLE];
			imageLayer.opacity = parseFloat(data[me.TMX_TAG_OPACITY]);
			
			// check if we have any additional properties 
			me.TMXUtils.applyTMXPropertiesFromJSON(imageLayer, data);
			
			// make sure ratio is a vector (backward compatibility)
			if (typeof(imageLayer.ratio) === "number") {
				imageLayer.ratio = new me.Vector2d(parseFloat(imageLayer.ratio), parseFloat(imageLayer.ratio));
			}
			
			return imageLayer;
		},
		
		readTileset : function (data) {
			var tileset = new me.TMXTileset();
			tileset.initFromJSON(data);
			return tileset;
		},
		
		readObjectGroup: function(map, data, z) {
			var group = new me.TMXObjectGroup();
			group.initFromJSON(data[me.TMX_TAG_NAME], data, map.tilesets, z);
			return group;
		}
	
	});
	


})(window);
