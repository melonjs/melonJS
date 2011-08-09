/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 * TMX Loader
 * Tile QT 0.7.0 format
 *	http://www.mapeditor.org/	
 *
 */

(function($, undefined) 
{
		
	// some TMX constants
	var TMX_TAG_MAP				= "map",
		 TMX_TAG_NAME				= "name",
		 TMX_TAG_VALUE				= "value",	
	 	 TMX_TAG_VERSION			= "version",
		 TMX_TAG_ORIENTATION		= "orientation",
		 TMX_TAG_WIDTH				= "width",
		 TMX_TAG_HEIGHT			= "height",
		 TMX_TAG_OPACITY			= "opacity",
       TMX_TAG_TRANS          = "trans",
		 TMX_TAG_TILEWIDTH		= "tilewidth",
		 TMX_TAG_TILEHEIGHT		= "tileheight",
		 TMX_TAG_FIRSTGID			= "firstgid",
		 TMX_TAG_GID				= "gid",
		 TMX_TAG_TILE				= "tile",
		 TMX_TAG_ID					= "id",
		 TMX_TAG_DATA				= "data",
	 	 TMX_TAG_COMPRESSION		= "compression",
		 TMX_TAG_ENCODING			= "encoding",
		 TMX_TAG_ATTR_BASE64		= "base64",
       TMX_TAG_CSV            = "csv",
		 TMX_TAG_SPACING			= "spacing",
		 TMX_TAG_MARGIN			= "margin",
		 TMX_TAG_PROPERTIES		= "properties",
		 TMX_TAG_PROPERTY			= "property",
		 TMX_TAG_IMAGE				= "image",
		 TMX_TAG_SOURCE			= "source",
		 TMX_TAG_VISIBLE			= "visible",
		 TMX_TAG_TILESET			= "tileset",
		 TMX_TAG_LAYER				= "layer",
		 TMX_TAG_OBJECTGROUP		= "objectgroup",
		 TMX_TAG_OBJECT			= "object",
		 TMX_TAG_X					= "x",
		 TMX_TAG_Y					= "y",
		 TMX_TAG_WIDTH				= "width",
		 TMX_TAG_HEIGHT			= "height",
       
       // some other global value 
   
       // bitmaks to check for flipped tiles
       FlipH_Flag             = 0x80000000,
       FlipV_Flag             = 0x40000000;

	
	/* -----

		check if properties are defined for the given objet
			
		------									*/

	function setTMXProperties (obj, xmldata)
	{
		var layer_properties = xmldata.getElementsByTagName(TMX_TAG_PROPERTIES)[0];
		
		if (layer_properties)
		{
			var oProp	= layer_properties.getElementsByTagName(TMX_TAG_PROPERTY);
		
			for ( var i = 0; i < oProp.length; i++ )
			{
				applyTMXProperty(obj, oProp[i]);
			}
		}

	};

	
	/* -----

		apply the specified TMX properties (name, value) to the object
			
		------									*/

	function applyTMXProperty (object, prop)
	{
		var propname	= me.XMLParser.getStringAttribute(prop, TMX_TAG_NAME);
		var value		= me.XMLParser.getStringAttribute(prop, TMX_TAG_VALUE);
		
	
		
		// if value not defined or boolean
		if (!value || value.isBoolean())
		{
			value = value? (value == "true") : true;
		} 
		// check if numeric
		else if (value.isNumeric())
		{
			value = parseInt(value);
		}
		// add the new prop to the object prop list
		object[ propname ]  = value;
		//console.log("new prop: "+ propname + "(" + object[ propname ]+ ")");

	};

	
   /***************************************************************/
   /*                                                             */
   /*    Manage a tile map                                        */
   /*    Tile QT 0.7.0 format                                     */
   /*    http://www.mapeditor.org/                                */
   /*                                                             */
   /***************************************************************/
	function TMXTileMap(xmlfile, x, y)
	{	
		// call the constructor
		me.TileMap.call(this, x, y);
		
		this.xmlMap = me.loader.getXML(xmlfile);
		
		if (!this.xmlMap)
		{
			 throw "melonJS:" + xmlfile + " TMX map not found";
		}
		
		// tilemap version
		this.version = "";
		
		// map type (only orthogonal format supported)
		this.orientation = "";
		
		// a canvas where to draw our map(s)
		this.tileMapCanvas = null;

	};
	TMXTileMap.prototype = new me.TileMap();

	
	/* -----

		Load & initialize the Tile Map
			
		------									*/
	TMXTileMap.prototype.load = function ()
	{
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
		for(var i=0; i < xmlElements.length; i++)
      {
			// check each Tag
			var tagName = xmlElements.item(i).nodeName;
			
			switch (tagName)
			{
				// get the map information
				case TMX_TAG_MAP :
				{
					var map				= xmlElements.item(i);
					this.version		= me.XMLParser.getStringAttribute(map, TMX_TAG_VERSION);
					this.orientation	= me.XMLParser.getStringAttribute(map, TMX_TAG_ORIENTATION);
					this.width			= me.XMLParser.getIntAttribute(map, TMX_TAG_WIDTH);
					this.height			= me.XMLParser.getIntAttribute(map, TMX_TAG_HEIGHT);
					this.tilewidth		= me.XMLParser.getIntAttribute(map, TMX_TAG_TILEWIDTH);
					this.tileheight	= me.XMLParser.getIntAttribute(map, TMX_TAG_TILEHEIGHT);
					this.realwidth		= this.width  * this.tilewidth;
					this.realheight	= this.height * this.tileheight;
					this.z				= zOrder++;
					
					// check some returned values
					if (this.orientation != "orthogonal")
					{
						throw "melonJS: " + this.orientation + " type TMX Tile Map not supported!";
					}
					
					// set the map properties (if any)
					setTMXProperties(this, map);
					
					// check if something is defined that force display of the object
					if (this.background_color)
					{
						this.visible = true;
						// convert to a rgb string (needed for Opera);//////bb
						this.background_color = me.utils.HexToRGB(this.background_color);
					}
					else
						this.visible = false;
					
				}
				break;
				
				// get the tileset information
				case TMX_TAG_TILESET :
				{
					// shoud be :
					// tileset 0 : scene (background/foreground) tileset
					// tileset 1 : collision tileset
					this.tileset.push(new TMXTileSet(xmlElements.item(i)));
				}
				break;
				
				// get the layer(s) information
				case TMX_TAG_LAYER:
				{
					// try to identify the layer type based on the naming convention
					var layer_name	= me.XMLParser.getStringAttribute(xmlElements.item(i), TMX_TAG_NAME);
										
					// collision layer
					if (layer_name.contains(me.LevelConstants.COLLISION_MAP))
					{
						this.mapLayers.push(new TMXLayer(xmlElements.item(i), this.tileset, zOrder++));
					}
					// parallax layer
					else if (layer_name.contains(me.LevelConstants.PARALLAX_MAP))
					{
						var visible		= (me.XMLParser.getIntAttribute(xmlElements.item(i), TMX_TAG_VISIBLE, 1) == 1);
						
						// only add if visible
						if (visible)
						{
							// check the object properties 
							var tprop = {};
							setTMXProperties(tprop, xmlElements.item(i));
							
							// check if we already have a parallax layer
							parallax_layer = this.getLayerByName(me.LevelConstants.PARALLAX_MAP);
							
							if (!parallax_layer)
							{
								parallax_layer = new me.ParallaxBackgroundEntity(zOrder);
								this.mapLayers.push(parallax_layer);
							}
							// add the new parallax layer
							parallax_layer.addLayer(tprop.imagesrc, pLayer++, zOrder++);
						}
					}
					// regular layer
					else
					{
						this.mapLayers.push(new TMXLayer(xmlElements.item(i), this.tileset, zOrder++));
						zOrder++;
					}
					
				}
				break;
				
				// get the object groups information
				case TMX_TAG_OBJECTGROUP :
				{
					var name = me.XMLParser.getStringAttribute(xmlElements.item(i),TMX_TAG_NAME);
					this.objectGroups.push(new TMXOBjectGroup(name, xmlElements.item(i), this.tileset[0], zOrder++));
				}
				break;
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
	TMXTileMap.prototype.draw = function (context)
	{
		// clear the background if a color is defined
		me.video.clearSurface(context, this.background_color);
	};
	
	/************************************************************************************/
	/*																												*/
	/*		Tile map Stuff																						*/
	/*		Manage a tile set																					*/
	/*																												*/
	/************************************************************************************/
	function TMXTileSet(xmltileset)
	{	
		
		// first gid
		this.firstgid		= me.XMLParser.getIntAttribute(xmltileset,	TMX_TAG_FIRSTGID);
				
		// call our super parent
		me.TileSet.call(this,	me.XMLParser.getStringAttribute(xmltileset, TMX_TAG_NAME),
										me.XMLParser.getIntAttribute(xmltileset,		TMX_TAG_TILEWIDTH),
										me.XMLParser.getIntAttribute(xmltileset,		TMX_TAG_TILEHEIGHT),
										me.XMLParser.getIntAttribute(xmltileset,		TMX_TAG_SPACING,0),
										me.XMLParser.getIntAttribute(xmltileset,		TMX_TAG_MARGIN,0),
										xmltileset.getElementsByTagName(TMX_TAG_IMAGE)[0].getAttribute(TMX_TAG_SOURCE));
		
      // check if transparency is defined for a specific color
      this.trans = xmltileset.getElementsByTagName(TMX_TAG_IMAGE)[0].getAttribute(TMX_TAG_TRANS);
      
      // set Color Key for transparency if needed
      if (this.trans !== null && this.image)
      {
         // applyRGB Filter (return a context object)
         this.image = me.video.applyRGBFilter(this.image, "transparent", this.trans.toUpperCase()).canvas;
      }

		// set tile properties, if any
		var tileInfo = xmltileset.getElementsByTagName(TMX_TAG_TILE);
		for ( var i = 0; i < tileInfo.length; i++ )
		{
			var tileID	 = me.XMLParser.getIntAttribute(tileInfo[i], TMX_TAG_ID)  + this.firstgid;
         
			this.TileProperties[tileID] = {};	
			
			tileProp = this.TileProperties[tileID];
			
			// apply tiled defined properties
			setTMXProperties(tileProp, tileInfo[i]);
			
			// check what we found and adjust property
			tileProp.isSolid			= tileProp.type?tileProp.type.toLowerCase() === this.type.SOLID	  : false;
			tileProp.isPlatform		= tileProp.type?tileProp.type.toLowerCase() === this.type.PLATFORM  : false;
			tileProp.isLeftSlope		= tileProp.type?tileProp.type.toLowerCase() === this.type.L_SLOPE	  : false;
			tileProp.isRightSlope	= tileProp.type?tileProp.type.toLowerCase() === this.type.R_SLOPE	  : false;
			tileProp.isBreakable		= tileProp.type?tileProp.type.toLowerCase() === this.type.BREAKABLE : false;
			tileProp.isLadder			= tileProp.type?tileProp.type.toLowerCase() === this.type.LADDER	  : false;
			tileProp.isSlope			= tileProp.isLeftSlope || tileProp.isRightSlope;
			
			// ensure the collidable flag is correct
			tileProp.isCollidable	= tileProp.isSolid || tileProp.isPlatform	|| tileProp.isSlope || tileProp.isLadder || tileProp.isBreakable;
			
			//console.log(tileID);
			// check if the array is correct udptaded
			//console.log(this.TileProperties[tileID]);
		}
		
		//console.log("new tileset %s", this.name);
	};
	TMXTileSet.prototype = new me.TileSet();

	/************************************************************************************/
	/*																												*/
	/*		Tile map Stuff																						*/
	/*		Manage a tile Layer																				*/
	/*																												*/
	/************************************************************************************/
	function TMXLayer(layer, tileset, zOrder)
	{
		// call the parent
		me.TiledLayer.call(this, me.XMLParser.getIntAttribute(layer, TMX_TAG_WIDTH), 
										 me.XMLParser.getIntAttribute(layer, TMX_TAG_HEIGHT),
										 // tileset 0 should exist here !
										 tileset[0], zOrder);
		
		// get invalidated when the viewport is changed
		this.layerInvalidated = true;
		this.name				= me.XMLParser.getStringAttribute(layer, TMX_TAG_NAME);
		this.visible			= (me.XMLParser.getIntAttribute(layer, TMX_TAG_VISIBLE, 1) == 1);
		this.opacity			= me.XMLParser.getFloatAttribute(layer, TMX_TAG_OPACITY, 1.0);
		
		
		//console.log("layer %s, visible %s", this.name, this.visible);
				
		// check if we have any properties 
		setTMXProperties(this, layer);
		
		// detect if the layer is a collision map
		this.isCollisionMap = (this.name.contains(me.LevelConstants.COLLISION_MAP));
		if (this.isCollisionMap)
		{
			//console.log("Collision Map detected");
			// force the layer as invisible
			this.visible = false;
			
			// if the control tileset exist, link it to it
			if (tileset[1])
				this.tileset = tileset[1];
		}
		
		// link to the gameviewport;
		this.vp = me.game.viewport;

		// store the data information
		var xmldata				= layer.getElementsByTagName(TMX_TAG_DATA)[0];
		var encoding			= me.XMLParser.getStringAttribute(xmldata, TMX_TAG_ENCODING, null);
		var compression		= me.XMLParser.getStringAttribute(xmldata, TMX_TAG_COMPRESSION, null);
      
      // make sure this is not happening
      if (encoding    == '') encoding    = null;
      if (compression == '') compression = null;
      
		
		// create a canvas where to draw our layer
		if (this.visible)
		{
			this.layerSurface = me.video.createCanvasSurface(this.width * this.tilewidth, this.height * this.tileheight);
			this.layerCanvas  = this.layerSurface.canvas;
				
			// set alpha value for this layer
			if (this.opacity > 0.0 && this.opacity < 1.0)
			{
				this.layerSurface.globalAlpha = this.opacity;
			}
      }
      
      if (this.visible || this.isCollisionMap)
		{
         // initiliaze the layer lookup table (only in case of collision map)
         // else the getTile function are never called
         this.initArray(this.isCollisionMap);
								
         // and populate our level with some data
         this.fillArray(xmldata, encoding, compression);
      }
	};
	TMXLayer.prototype = new me.TiledLayer();
	
	/* -----

		Build the tiled layer
			
		------								*/
	TMXLayer.prototype.fillArray = function (xmldata, encoding, compression)
	{
		// check if data is compressed
      switch(compression)
      {
         // no compression
         case null:
            {
               // decode data based on encoding type
               switch (encoding)
               {
                  // XML encoding
                  case null:
                     {
                        var data = xmldata.getElementsByTagName(TMX_TAG_TILE);
                     }
                     break;
                  
                  // CSV encoding
                  case TMX_TAG_CSV:
                  // Base 64 encoding
                  case TMX_TAG_ATTR_BASE64:
                     {
                        // Merge all childNodes[].nodeValue into a single one
                        var nodeValue = '';
                        for (var i = 0, len = xmldata.childNodes.length; i < len; i++) {
                            nodeValue += xmldata.childNodes[i].nodeValue;
                        }
                        // and then decode them
                        if (encoding == TMX_TAG_ATTR_BASE64)
                           var data = me.utils.decodeBase64AsArray(nodeValue, 4);
                        else
                           var data = me.utils.decodeCSV(nodeValue, this.width);
                        
                        // ensure nodeValue is deallocated
                        nodeValue = null;

                     }
                     break
                  default :
                   throw "melonJS: TMX Tile Map " + encoding + " encoding not supported!";
                   // that's over !;
               }
            }
            break;
         default :
            throw "melonJS: " + compression + " compressed TMX Tile Map not supported!";
            // that's over !;
      }
   	
		// I love reversed loop !
      var idx = data.length - 1;
		
      var flipx, flipy;
      
    	// set everything
		for(var y=this.height-1;y>=0; y--)
      {
		   for(var x=this.width-1;x>=0; x--)
         {	
				// get the value of the gid
            gid = (encoding == null)?me.XMLParser.getIntAttribute(data[idx--],TMX_TAG_GID):data[idx--];
            
            // check if tile is horizontally flipped
            // (this should be save somewhere!)
            flipx = (gid & FlipH_Flag);
            
            // check if tile is vertically flipped
            // (this should be save somewhere!)
            flipy = (gid & FlipV_Flag);
            
            // clear out the flags
            gid &= ~(FlipH_Flag | FlipV_Flag);
            
				// fill the array										
				if (gid > 0)
				{	
					this.setTile(x, y, gid);
					
					if (this.visible)
						this.tileset.drawTile(this.layerSurface, x * this.tilewidth, y * this.tileheight, this.layerData[x][y].tileId  - this.tileset.firstgid, flipx, flipy);

				}
			}
		};
      
      // make sure data is deallocated :)
      data = null;
		
	};
	

   
	/* -----

		clear a tile
			
		------								*/
	TMXLayer.prototype.clearTile = function (x, y)
	{
		// call the parent function
		me.TiledLayer.prototype.clearTile.call(this, x, y);
		// erase the corresponding area in the canvas
      if (this.visible)
		{
         this.layerSurface.clearRect(x * this.tilewidth, y * this.tileheight, this.tilewidth, this.tileheight);
      }
   };

	
	/* -----

		draw a tileset layer
			
		------								*/
	TMXLayer.prototype.draw = function (context)
	{
		/*
		if (this.layerInvalidated)
		{
			// rebuild the layer data
			//console.log("drawing layer %s",this.name);
			for(var x= this.width; x--;)
			{
				for(var y= this.height; y--;)
				{		
					//this.layerData[x][y] = data[idx++].getAttribute("gid");
					this.tileset.drawTile(this.layerCanvas, x * 32, y * 32, this.layerData[x][y]);
			
				}
			}
			this.layerInvalidated = false;

		}
		*/
		
		context.drawImage(this.layerCanvas,
								this.vp.pos.x,	this.vp.pos.y,
								this.vp.width,	this.vp.height,
								0,					0,
								this.vp.width,	this.vp.height);
	};
	
	/************************************************************************************/
	/*																												*/
	/*		Tile map Stuff																						*/
	/*		Manage a Object Group																			*/
	/*																												*/
	/************************************************************************************/
	function TMXOBjectGroup(name, tmxObjGroup, tileset, z)
	{
		this.objects = [];
		

		this.name	= name;
		this.width	= me.XMLParser.getIntAttribute(tmxObjGroup, TMX_TAG_WIDTH);
		this.height	= me.XMLParser.getIntAttribute(tmxObjGroup, TMX_TAG_HEIGHT);
		this.z		= z;	
		
		//console.log("ObjectGroup : %s, w:%d, h:%d", this.name, this.width, this.height);
		
		var data = tmxObjGroup.getElementsByTagName(TMX_TAG_OBJECT);
		
		for ( var i = 0; i < data.length; i++ )
		{
			this.objects.push (new TMXOBject(data[i], tileset, z));
		}

	};
	
	TMXOBjectGroup.prototype.getObjectCount = function ()
	{
		return this.objects.length;
	};
		
	TMXOBjectGroup.prototype.getObjectByIndex = function (idx)
	{
		return this.objects[idx];
	};

		
	/************************************************************************************/
	/*																												*/
	/*		Tile map Stuff																						*/
	/*		Manage a Object																					*/
	/*																												*/
	/************************************************************************************/
	function TMXOBject(tmxObj, tileset, z)
	{
		this.name = me.XMLParser.getStringAttribute(tmxObj,TMX_TAG_NAME);
		this.x	 = me.XMLParser.getIntAttribute(tmxObj, TMX_TAG_X);
		this.y	 = me.XMLParser.getIntAttribute(tmxObj, TMX_TAG_Y);
		this.z	 = z;
		
		this.gid = me.XMLParser.getIntAttribute(tmxObj, TMX_TAG_GID, null);
		// check if the object has an associated gid	
		if (this.gid)
		{
			// set width and heigh equal to tile size
			this.width  = tileset.tilewidth;
			this.height = tileset.tileheight;
			
			// force spritewidth size
			this.spritewidth = this.width;
			// adjust y coordinates (bug in tile 0.6.2?)
			this.y -= this.height;
			
			// get the corresponding tile into our object
			this.image = tileset.getTileImage(this.gid - tileset.firstgid);
		}
		else
		{
			this.width  = me.XMLParser.getIntAttribute(tmxObj, TMX_TAG_WIDTH,  0);
			this.height	= me.XMLParser.getIntAttribute(tmxObj, TMX_TAG_HEIGHT, 0);
		}
		// set the object properties
		setTMXProperties(this, tmxObj);

	};
	
	/* -----

		return the specified object group
			
		------									*/
	TMXOBject.prototype.getObjectPropertyByName = function (name)
	{
		return this[name];
	};

	
		
	/*------------------------------------------------------*/
	// expose our stuff to the me scope
	/*------------------------------------------------------*/
	$.me.TMXTileMap				= TMXTileMap;
/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);	


