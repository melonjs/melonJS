/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://www.melonjs.org
 *
 *
 * TMX Loader
 * Tile QT 0.7.x format
 *	http://www.mapeditor.org/	
 *
 */

(function($, undefined) {
		

	// bitmaks to check for flipped tiles
	var FlipH_Flag                  = 0x80000000,
	    FlipV_Flag                  = 0x40000000;

	
	/***************************************************************/
	/*                                                             */
	/*    Manage a tile map                                        */
	/*    Tile QT 0.7.0 format                                     */
	/*    http://www.mapeditor.org/                                */
	/*                                                             */
	/***************************************************************/
	function TMXTileMap(xmlfile, x, y) {
		// call the constructor
		me.TileMap.call(this, x, y);

		this.xmlMap = me.loader.getXML(xmlfile);

		if (!this.xmlMap) {
			throw "melonJS:" + xmlfile + " TMX map not found";
		}

		// tilemap version
		this.version = "";

		// map type (only orthogonal format supported)
		this.orientation = "";

		// a canvas where to draw our map(s)
		this.tileMapCanvas = null;
      
      // tileset(s)
      this.tilesets = null;

	};
	TMXTileMap.prototype = new me.TileMap();

	/* -----

		Load & initialize the Tile Map
			
		------									*/
	TMXTileMap.prototype.load = function() {
		// if already loaded, do nothing
		if (this.initialized)
			return;

		// to automatically increment z index
		var zOrder = 0,
		// and parallax layer speed
		pLayer = 1;

		// init the parser
		me.XMLParser.parseFromString(this.xmlMap);

		// retreive all the elements of the XML file
		var xmlElements = me.XMLParser.getAllTagElements();

		// parse all tags
		for ( var i = 0; i < xmlElements.length; i++) {
			// check each Tag
			var tagName = xmlElements.item(i).nodeName;

			switch (tagName) {
            // get the map information
            case me.TMX_TAG_MAP: {
               var map = xmlElements.item(i);
               this.version = me.XMLParser.getStringAttribute(map, me.TMX_TAG_VERSION);
               this.orientation = me.XMLParser.getStringAttribute(map, me.TMX_TAG_ORIENTATION);
               this.width = me.XMLParser.getIntAttribute(map, me.TMX_TAG_WIDTH);
               this.height = me.XMLParser.getIntAttribute(map, me.TMX_TAG_HEIGHT);
               this.tilewidth = me.XMLParser.getIntAttribute(map,	me.TMX_TAG_TILEWIDTH);
               this.tileheight = me.XMLParser.getIntAttribute(map, me.TMX_TAG_TILEHEIGHT);
               this.realwidth = this.width * this.tilewidth;
               this.realheight = this.height * this.tileheight;
               this.z = zOrder++;

               // check some returned values
			   if (this.orientation != "orthogonal") {
                  throw "melonJS: " + this.orientation + " type TMX Tile Map not supported!";
               }

			   // set the map properties (if any)
               me.TMXUtils.setTMXProperties(this, map);

               // ensure the visible flag is set to false, by default
               this.visible = false;

               // check if a backgroud color is defined  
               if (this.background_color) {
                  this.visible = true;
                  // convert to a rgb string (needed for Opera)
                  this.background_color = me.utils
                        .HexToRGB(this.background_color);
               }

               // check if a backgroud image is defined
               if (this.background_image) {
                  this.visible = true;
                  // retrieve the corresponding image ressource
                  this.background_image = me.loader.getImage(this.background_image);
               }
               break;
            }
               

            // get the tileset information
            case me.TMX_TAG_TILESET: {
            
               // Initialize our object if not yet done
               if (!this.tilesets)
               {
                  // make sure tilesets if of the right type
                  this.tilesets = new me.TMXTilesetGroup();
               }

               // add the new tileset
               this.tilesets.add(new me.TMXTileset(xmlElements.item(i)));
               break;
            }
               

            // get the layer(s) information
            case me.TMX_TAG_LAYER: {
               // try to identify specific layer type based on the naming convention
               var layer_name = me.XMLParser.getStringAttribute(xmlElements
                     .item(i), me.TMX_TAG_NAME);

               // parallax layer
               if (layer_name.contains(me.LevelConstants.PARALLAX_MAP)) {
                  var visible = (me.XMLParser.getIntAttribute(xmlElements
                        .item(i), me.TMX_TAG_VISIBLE, 1) == 1);

                  // only add if visible
                  if (visible) {
                     // check the object properties 
                     var tprop = {};
                     me.TMXUtils.setTMXProperties(tprop, xmlElements.item(i));

                     // check if we already have a parallax layer
                     var parallax_layer = this.getLayerByName(me.LevelConstants.PARALLAX_MAP);

                     if (!parallax_layer) {
                        parallax_layer = new me.ParallaxBackgroundEntity(zOrder);
                        this.mapLayers.push(parallax_layer);
                     }
                     // add the new parallax layer
                     parallax_layer.addLayer(tprop.imagesrc, pLayer++, zOrder++);
                  }
               }
               else {
                  // regular layer or collision layer
                  this.mapLayers.push(new TMXLayer(xmlElements.item(i), this.orientation, this.tilesets, zOrder++));
                  zOrder++;
               }
               break;
            }
               

            // get the object groups information
            case me.TMX_TAG_OBJECTGROUP: {
               var name = me.XMLParser.getStringAttribute(xmlElements.item(i), me.TMX_TAG_NAME);
               this.objectGroups.push(new me.TMXOBjectGroup(name, xmlElements.item(i), this.tilesets, zOrder++));
               break;
            }
				
			} // end switch 
		} // end for

		// free the XMLParser ressource
		me.XMLParser.free();

		// flag as loaded
		this.initialized = true;

	};

	/* -----

		draw the tile map
		this is only called if the background_color property is defined
			
		------								*/
	TMXTileMap.prototype.draw = function(context, rect) {
		if (this.background_color) {
			// set the background color
			context.fillStyle = this.background_color;
			// clear the specified rect
			context.fillRect(rect.left, rect.top, rect.width, rect.height);
		}
		if (this.background_image) {
			context.drawImage(this.background_image, rect.left, rect.top,
					rect.width, rect.height, rect.left, rect.top, rect.width,
					rect.height);

		}
	};

	
	/************************************************************************************/
	/*                                                                                  */
	/*      Tile map Stuff                                                              */
	/*      Manage a tile Layer                                                         */
	/*                                                                                  */
	/************************************************************************************/
	function TMXLayer(layer, orientation, tilesets, zOrder) {
		// call the parent
		me.TiledLayer.call(this, 
                         me.XMLParser.getIntAttribute(layer, me.TMX_TAG_WIDTH), 
                         me.XMLParser.getIntAttribute(layer, me.TMX_TAG_HEIGHT),
                         // tilesets should exist here !
                         tilesets, zOrder);
      
 		// get invalidated when the viewport is changed
		this.orientation = orientation;
		this.layerInvalidated = true;
		this.name = me.XMLParser.getStringAttribute(layer, me.TMX_TAG_NAME);
		this.visible = (me.XMLParser.getIntAttribute(layer, me.TMX_TAG_VISIBLE, 1) == 1);
		this.opacity = me.XMLParser.getFloatAttribute(layer, me.TMX_TAG_OPACITY, 1.0);
            
		// check if we have any properties 
		me.TMXUtils.setTMXProperties(this, layer);

		// detect if the layer is a collision map
		this.isCollisionMap = (this.name.contains(me.LevelConstants.COLLISION_MAP));
		if (this.isCollisionMap) {
			// force the layer as invisible
			this.visible = false;
		}

		// link to the gameviewport;
		this.vp = me.game.viewport;

		// store the data information
		var xmldata = layer.getElementsByTagName(me.TMX_TAG_DATA)[0];
		var encoding = me.XMLParser.getStringAttribute(xmldata, me.TMX_TAG_ENCODING, null);
		var compression = me.XMLParser.getStringAttribute(xmldata, me.TMX_TAG_COMPRESSION, null);

		// make sure this is not happening
		if (encoding == '')
			encoding = null;
		if (compression == '')
			compression = null;

		// create a canvas where to draw our layer
		if (this.visible) {
			this.layerSurface = me.video.createCanvasSurface(this.width
					* this.tilewidth, this.height * this.tileheight);
			this.layerCanvas = this.layerSurface.canvas;

			// set alpha value for this layer
			if (this.opacity > 0.0 && this.opacity < 1.0) {
				this.layerSurface.globalAlpha = this.opacity;
			}
		}

		if (this.visible || this.isCollisionMap) {
			// initialize the layer lookup table (only in case of collision map)
			this.initArray(this.isCollisionMap);

			// populate our level with some data
			this.fillArray(xmldata, encoding, compression);
		}
	};
	TMXLayer.prototype = new me.TiledLayer();

	/* -----

		Build the tiled layer
			
		------								*/
	TMXLayer.prototype.fillArray = function(xmldata, encoding, compression) {
		// check if data is compressed
		switch (compression) {
         
         // no compression
         case null: {
            // decode data based on encoding type
            switch (encoding) {
            // XML encoding
               case null: {
                  var data = xmldata.getElementsByTagName(me.TMX_TAG_TILE);
                  break;
               }
               
               // CSV encoding
               case me.TMX_TAG_CSV:
                  // Base 64 encoding
               case me.TMX_TAG_ATTR_BASE64: {
                  // Merge all childNodes[].nodeValue into a single one
                  var nodeValue = '';
                  for ( var i = 0, len = xmldata.childNodes.length; i < len; i++) {
                     nodeValue += xmldata.childNodes[i].nodeValue;
                  }
                  // and then decode them
                  if (encoding == me.TMX_TAG_ATTR_BASE64)
                     var data = me.utils.decodeBase64AsArray(nodeValue, 4);
                  else
                     var data = me.utils.decodeCSV(nodeValue, this.width);

                  // ensure nodeValue is deallocated
                  nodeValue = null;
                  break;
               }
                  
               default:
                  throw "melonJS: TMX Tile Map " + encoding + " encoding not supported!";
                  break;
            }
            
         break;
         }
            
         default:
            throw "melonJS: " + compression+ " compressed TMX Tile Map not supported!";
            break;
		}

		// I love reversed loop !
		var idx = data.length - 1;

		var flipx, flipy;
		
		var gid;

		// set everything
		for ( var y = this.height - 1; y >= 0; y--) {
			for ( var x = this.width - 1; x >= 0; x--) {
				// get the value of the gid
				gid = (encoding == null) ? me.XMLParser.getIntAttribute(data[idx--], me.TMX_TAG_GID) : data[idx--];

				// check if tile is horizontally flipped
				// (this should be save somewhere!)
				flipx = (gid & FlipH_Flag);

				// check if tile is vertically flipped
				// (this should be save somewhere!)
				flipy = (gid & FlipV_Flag);

				// clear out the flags
				gid &= ~(FlipH_Flag | FlipV_Flag);

				// fill the array										
				if (gid > 0) {
					this.setTile(x, y, gid);
					// check if we are using the right tileset
					if (!this.tileset.contains(gid)) {
						// switch to the right tileset
						this.tileset = this.tilesets.getTilesetByGid(gid);
					}
				   
					if (this.visible) {
						//draw our tile
						if (this.orientation == "orthogonal") { 
							this.tileset.drawTile(this.layerSurface, 
													x * this.tilewidth, 
													y * this.tileheight,
													gid - this.tileset.firstgid, 
													flipx, flipy);
						}
						else { // isometric
							this.tileset.drawTile(this.layerSurface, 
													(x - y) * this.tilewidth>>1, 
													(y + x) * this.tileheight>>2,
													gid - this.tileset.firstgid, 
													flipx, flipy);
						}
					}
				}
			}
		}

		// make sure data is deallocated :)
		data = null;

	};

	/* -----

		clear a tile
			
		------								*/
	TMXLayer.prototype.clearTile = function(x, y) {
		// call the parent function
		me.TiledLayer.prototype.clearTile.call(this, x, y);
		// erase the corresponding area in the canvas
		if (this.visible) {
			this.layerSurface.clearRect(x * this.tilewidth,
					y * this.tileheight, this.tilewidth, this.tileheight);
		}
	};

	/* -----

		draw a tileset layer
			
		------								*/
	TMXLayer.prototype.draw = function(context, rect) {
		context.drawImage(this.layerCanvas, 
                        this.vp.pos.x + rect.pos.x, //sx
                        this.vp.pos.y + rect.pos.y, //sy
                        rect.width, rect.height,    //sw, sh
                        rect.pos.x, rect.pos.y,     //dx, dy
                        rect.width, rect.height);   //dw, dh
	};

	/*------------------------------------------------------*/
	// expose our stuff to the me scope
	/*------------------------------------------------------*/
	me.TMXTileMap = TMXTileMap;
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
