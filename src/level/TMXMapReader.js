/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {
    /**
     * a TMX Map Reader
     * Tiled QT 0.7.x format
     * @class
     * @memberOf me
     * @constructor
     * @ignore
     */
    me.TMXMapReader = Object.extend({
        init: function () {},

        readMap: function (map) {
            // if already loaded, do nothing
            if (map.initialized) {
                return;
            }
            if  (this.JSONReader === null || typeof this.JSONReader === "undefined") {
                this.JSONReader = new JSONMapReader();
            }
            this.JSONReader.readJSONMap(map, me.loader.getTMX(map.levelId));


            // center the map if smaller than the current viewport
            if ((map.width < me.game.viewport.width) ||
                (map.height < me.game.viewport.height)) {
                var shiftX =  ~~((me.game.viewport.width - map.width) / 2);
                var shiftY =  ~~((me.game.viewport.height - map.height) / 2);
                // update the map default screen position
                map.pos.add({
                    x : (shiftX > 0 ? shiftX : 0),
                    y : (shiftY > 0 ? shiftY : 0)
                });
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
                case "orthogonal":
                    return new me.TMXOrthogonalRenderer(
                        obj.cols,
                        obj.rows,
                        obj.tilewidth,
                        obj.tileheight
                    );

                case "isometric":
                    return new me.TMXIsometricRenderer(
                        obj.cols,
                        obj.rows,
                        obj.tilewidth,
                        obj.tileheight
                    );

                // if none found, throw an exception
                default:
                    throw "melonJS: " + obj.orientation + " type TMX Tile Map not supported!";
            }
        },

        /**
         * Set tiled layer Data
         * @ignore
         */
        setLayerData : function (layer, rawdata, encoding, compression) {
            // initialize the layer data array
            layer.initArray(layer.cols, layer.rows);
            // data
            var data = Array.isArray(rawdata) === true ? rawdata : rawdata.value;

            // decode data based on encoding type
            switch (encoding) {
                case "json":
                    // do nothing as data can be directly reused
                    data = rawdata;
                    break;
                // CSV encoding
                case me.TMX_TAG_CSV:
                // Base 64 encoding
                case me.TMX_TAG_ATTR_BASE64:
                    // and then decode them
                    if (encoding === me.TMX_TAG_CSV) {
                        // CSV decode
                        data = me.utils.decodeCSV(data, layer.cols);
                    } else {
                        // Base 64 decode
                        data = me.utils.decodeBase64AsArray(data, 4);
                        // check if data is compressed
                        if (compression !== null) {
                            data = me.utils.decompress(data, compression);
                        }
                    }
                    break;


                default:
                    throw "melonJS: TMX Tile Map " + encoding + " encoding not supported!";
            }

            var idx = 0;
            // set everything
            for (var y = 0 ; y < layer.rows; y++) {
                for (var x = 0; x < layer.cols; x++) {
                    // get the value of the gid
                    var gid = (encoding == null) ? this.TMXParser.getIntAttribute(data[idx++], me.TMX_TAG_GID) : data[idx++];
                    // fill the array
                    if (gid !== 0) {
                        // add a new tile to the layer
                        var tile = layer.setTile(x, y, gid);
                        // draw the corresponding tile
                        if (layer.preRender) {
                            layer.renderer.drawTile(layer.layerSurface, x, y, tile, tile.tileset);
                        }
                    }
                }
            }
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
        init: function () {

        },
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
            map.cols = parseInt(data[me.TMX_TAG_WIDTH], 10);
            map.rows = parseInt(data[me.TMX_TAG_HEIGHT], 10);
            map.tilewidth = parseInt(data[me.TMX_TAG_TILEWIDTH], 10);
            map.tileheight = parseInt(data[me.TMX_TAG_TILEHEIGHT], 10);
            map.width = map.cols * map.tilewidth;
            map.height = map.rows * map.tileheight;
            map.backgroundcolor = data[me.TMX_BACKGROUND_COLOR];
            map.z = zOrder++;

            // set the map properties (if any)
            me.TMXUtils.applyTMXProperties(map, data);

            // check if a user-defined background color is defined
            if (map.backgroundcolor) {
                map.mapLayers.push(
                    new me.ColorLayer(
                        "background_color",
                        map.backgroundcolor,
                        zOrder++
                    )
                );
            }

            // check if a background image is defined
            if (map.background_image) {
                // add a new image layer
                map.mapLayers.push(new me.ImageLayer(
                    "background_image",
                    map.width, map.height,
                    map.background_image,
                    zOrder++
                ));
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
            var tilesets = data.tilesets || data.tileset;
            if (Array.isArray(tilesets) === true) {
                tilesets.forEach(function (tileset) {
                    // add the new tileset
                    map.tilesets.add(self.readTileset(tileset));
                });
            } else {
                map.tilesets.add(self.readTileset(tilesets));
            }

            // parse layer information

            // native JSON format
            if (typeof (data.layers) !== "undefined") {
                data.layers.forEach(function (layer) {
                    switch (layer.type) {
                        case me.TMX_TAG_IMAGE_LAYER :
                            map.mapLayers.push(self.readImageLayer(map, layer, zOrder++));
                            break;

                        case me.TMX_TAG_TILE_LAYER :
                            map.mapLayers.push(self.readLayer(map, layer, zOrder++));
                            break;

                        // get the object groups information
                        case me.TMX_TAG_OBJECTGROUP:
                            map.objectGroups.push(self.readObjectGroup(map, layer, zOrder++));
                            break;

                        default:
                            break;
                    }
                });
            }
            else if (typeof (data.layer) !== "undefined") {
                // converted XML format
                // in converted format, these are not under the generic layers structure
                // and each element can be either an array of object of just one object

                var layers = data.layer;
                if (Array.isArray(layers) === true) {
                    layers.forEach(function (layer) {
                        // get the object information
                        map.mapLayers.push(self.readLayer(map, layer, layer._draworder));
                    });
                }
                else {
                    // get the object information
                    map.mapLayers.push(self.readLayer(map, layers, layers._draworder));
                }

                // in converted format, these are not under the generic layers structure
                if (typeof(data[me.TMX_TAG_OBJECTGROUP]) !== "undefined") {
                    var groups = data[me.TMX_TAG_OBJECTGROUP];
                    if (Array.isArray(groups) === true) {
                        groups.forEach(function (group) {
                            map.objectGroups.push(self.readObjectGroup(map, group, group._draworder));
                        });
                    }
                    else {
                        // get the object information
                        map.objectGroups.push(self.readObjectGroup(map, groups, groups._draworder));
                    }
                }

                // in converted format, these are not under the generic layers structure
                if (typeof(data[me.TMX_TAG_IMAGE_LAYER]) !== "undefined") {
                    var imageLayers = data[me.TMX_TAG_IMAGE_LAYER];
                    if (Array.isArray(imageLayers) === true) {
                        imageLayers.forEach(function (imageLayer) {
                            map.mapLayers.push(self.readImageLayer(map, imageLayer, imageLayer._draworder));
                        });
                    }
                    else {
                        map.mapLayers.push(self.readImageLayer(map, imageLayers, imageLayers._draworder));
                    }
                }
            }
        },

        readLayer: function (map, data, z) {
            var layer = new me.TMXLayer(map.tilewidth, map.tileheight, map.orientation, map.tilesets, z);
            // init the layer properly
            layer.initFromJSON(data);
            // set a renderer
            if (!me.game.renderer.canRender(layer)) {
                layer.setRenderer(me.mapReader.getNewDefaultRenderer(layer));
            }
            else {
                // use the default one
                layer.setRenderer(me.game.renderer);
            }
            var encoding = Array.isArray(data[me.TMX_TAG_DATA]) ? data[me.TMX_TAG_ENCODING] : data[me.TMX_TAG_DATA][me.TMX_TAG_ENCODING];
            // parse the layer data
            this.setLayerData(layer, data[me.TMX_TAG_DATA], encoding || "json", null);
            return layer;
        },

        readImageLayer: function (map, data, z) {
            // extract layer information
            var iln = data[me.TMX_TAG_NAME];
            var ilw = parseInt(data[me.TMX_TAG_WIDTH], 10);
            var ilh = parseInt(data[me.TMX_TAG_HEIGHT], 10);
            var ilsrc = typeof (data[me.TMX_TAG_IMAGE]) !== "string" ? data[me.TMX_TAG_IMAGE].source : data[me.TMX_TAG_IMAGE];

            // create the layer
            var imageLayer = new me.ImageLayer(iln, ilw * map.tilewidth, ilh * map.tileheight, ilsrc, z);

            // set some additional flags
            var visible = typeof(data[me.TMX_TAG_VISIBLE]) !== "undefined" ? data[me.TMX_TAG_VISIBLE] : true;
            imageLayer.setOpacity((visible === true) ? parseFloat(data[me.TMX_TAG_OPACITY] || 1.0).clamp(0.0, 1.0) : 0);

            // check if we have any additional properties
            me.TMXUtils.applyTMXProperties(imageLayer, data);

            // make sure ratio is a vector (backward compatibility)
            if (typeof(imageLayer.ratio) === "number") {
                imageLayer.ratio = new me.Vector2d(parseFloat(imageLayer.ratio), parseFloat(imageLayer.ratio));
            }

            return imageLayer;
        },

        readTileset : function (data) {
            return (new me.TMXTileset(data));
        },

        readObjectGroup: function (map, data, z) {
            return (new me.TMXObjectGroup(data[me.TMX_TAG_NAME], data, map.tilesets, z));
        }
    });
})();
