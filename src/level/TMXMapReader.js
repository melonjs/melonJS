/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function (TMXConstants) {
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

        readMap: function (map, data) {
            // if already loaded, do nothing
            if (map.initialized === true) {
                return;
            }

            // to automatically increment z index
            var zOrder = 0;

            // keep a reference to our scope
            var self = this;

            // map information
            map.version = data[TMXConstants.TMX_TAG_VERSION];
            map.orientation = data[TMXConstants.TMX_TAG_ORIENTATION];
            map.cols = +data[TMXConstants.TMX_TAG_WIDTH];
            map.rows = +data[TMXConstants.TMX_TAG_HEIGHT];
            map.tilewidth = +data[TMXConstants.TMX_TAG_TILEWIDTH];
            map.tileheight = +data[TMXConstants.TMX_TAG_TILEHEIGHT];
            map.nextobjectid = +data[TMXConstants.TMX_TAG_NEXTOBJID] || undefined;
            if (map.orientation === "isometric") {
                map.width = (map.cols + map.rows) * (map.tilewidth / 2);
                map.height = (map.cols + map.rows) * (map.tileheight / 2);
            } else {
                map.width = map.cols * map.tilewidth;
                map.height = map.rows * map.tileheight;
            }
            map.backgroundcolor = data[TMXConstants.TMX_BACKGROUND_COLOR];
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

            // initialize a default TMX renderer
            if ((me.game.tmxRenderer === null) || !me.game.tmxRenderer.canRender(map)) {
                me.game.tmxRenderer = this.getNewDefaultRenderer(map);
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
                        case TMXConstants.TMX_TAG_IMAGE_LAYER :
                            map.mapLayers.push(self.readImageLayer(map, layer, zOrder++));
                            break;

                        case TMXConstants.TMX_TAG_TILE_LAYER :
                            map.mapLayers.push(self.readLayer(map, layer, zOrder++));
                            break;

                        // get the object groups information
                        case TMXConstants.TMX_TAG_OBJECTGROUP:
                            map.objectGroups.push(self.readObjectGroup(map, layer, zOrder++));
                            break;

                        default:
                            break;
                    }
                });
            } else if (typeof (data.layer) !== "undefined") {
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
                if (typeof(data[TMXConstants.TMX_TAG_OBJECTGROUP]) !== "undefined") {
                    var groups = data[TMXConstants.TMX_TAG_OBJECTGROUP];
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
                if (typeof(data[TMXConstants.TMX_TAG_IMAGE_LAYER]) !== "undefined") {
                    var imageLayers = data[TMXConstants.TMX_TAG_IMAGE_LAYER];
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
                
                case "hexagonal":
                    return new me.TMXHexagonalRenderer(
                        obj.cols,
                        obj.rows,
                        obj.tilewidth,
                        obj.tileheight,
                        obj.hexsidelength
                    );

                // if none found, throw an exception
                default:
                    throw new me.Error(obj.orientation + " type TMX Tile Map not supported!");
            }
        },

        /**
         * Set tiled layer Data
         * @ignore
         */
        setLayerData : function (layer, rawdata, encoding, compression) {
            // data
            var data = Array.isArray(rawdata) === true ? rawdata : rawdata.value;

            // decode data based on encoding type
            switch (encoding) {
                case "json":
                    // do nothing as data can be directly reused
                    data = rawdata;
                    break;
                // CSV encoding
                case TMXConstants.TMX_TAG_CSV:
                // Base 64 encoding
                case TMXConstants.TMX_TAG_ATTR_BASE64:
                    // and then decode them
                    if (encoding === TMXConstants.TMX_TAG_CSV) {
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
                    throw new me.Error("TMX Tile Map " + encoding + " encoding not supported!");
            }

            var idx = 0;
            // set everything
            for (var y = 0 ; y < layer.rows; y++) {
                for (var x = 0; x < layer.cols; x++) {
                    // get the value of the gid
                    var gid = (encoding == null) ? this.TMXParser.getIntAttribute(data[idx++], TMXConstants.TMX_TAG_GID) : data[idx++];
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
        },

        readLayer: function (map, data, z) {
            var layer = new me.TMXLayer(map.tilewidth, map.tileheight, map.orientation, map.tilesets, z);
            // init the layer properly
            layer.initFromJSON(data);
            // set a renderer
            if (!me.game.tmxRenderer.canRender(layer)) {
                layer.setRenderer(me.mapReader.getNewDefaultRenderer(layer));
            }
            else {
                // use the default one
                layer.setRenderer(me.game.tmxRenderer);
            }
            var encoding = Array.isArray(data[TMXConstants.TMX_TAG_DATA]) ? data[TMXConstants.TMX_TAG_ENCODING] : data[TMXConstants.TMX_TAG_DATA][TMXConstants.TMX_TAG_ENCODING];
            // parse the layer data
            this.setLayerData(layer, data[TMXConstants.TMX_TAG_DATA], encoding || "json", null);
            return layer;
        },

        readImageLayer: function (map, data, z) {
            // extract layer information
            var iln = data[TMXConstants.TMX_TAG_NAME];
            var ilw = +data[TMXConstants.TMX_TAG_WIDTH];
            var ilh = +data[TMXConstants.TMX_TAG_HEIGHT];
            var ilsrc = typeof (data[TMXConstants.TMX_TAG_IMAGE]) !== "string" ? data[TMXConstants.TMX_TAG_IMAGE].source : data[TMXConstants.TMX_TAG_IMAGE];

            // create the layer
            var imageLayer = new me.ImageLayer(iln, ilw * map.tilewidth, ilh * map.tileheight, ilsrc, z);

            // set some additional flags
            var visible = typeof(data[TMXConstants.TMX_TAG_VISIBLE]) !== "undefined" ? data[TMXConstants.TMX_TAG_VISIBLE] : true;
            imageLayer.setOpacity((visible === true) ? (+data[TMXConstants.TMX_TAG_OPACITY] || 1.0).clamp(0.0, 1.0) : 0);

            // check if we have any additional properties
            me.TMXUtils.applyTMXProperties(imageLayer, data);

            // make sure ratio is a vector (backward compatibility)
            if (typeof(imageLayer.ratio) === "number") {
                var ratio = imageLayer.ratio;
                imageLayer.ratio = new me.Vector2d(ratio, ratio);
            }

            return imageLayer;
        },

        readTileset : function (data) {
            return (new me.TMXTileset(data));
        },

        readObjectGroup: function (map, data, z) {
            return (new me.TMXObjectGroup(data[TMXConstants.TMX_TAG_NAME], data, map.orientation, map.tilesets, z));
        }
    });
})(me.TMXConstants);
