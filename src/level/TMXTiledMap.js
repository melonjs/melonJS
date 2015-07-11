/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT +0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function (TMXConstants) {

    /**
     * set a compatible renderer object
     * for the specified map
     * @ignore
     */
    function getNewDefaultRenderer(obj) {
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
                    obj.hexsidelength,
                    obj.staggeraxis,
                    obj.staggerindex
                );

            // if none found, throw an exception
            default:
                throw new me.Error(obj.orientation + " type TMX Tile Map not supported!");
        }
    }

    /**
     * Set tiled layer Data
     * @ignore
     */
    function setLayerData(layer, rawdata, encoding, compression) {
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
                    // check if data is compressed
                    if (typeof compression === "string") {
                        data = me.utils.decompress(data, compression);
                    }
                    // Base 64 decode
                    data = me.utils.decodeBase64AsArray(data, 4);
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
                    layer.setTile(x, y, gid);
                }
            }
        }
    }

    /**
     * read the layer Data
     * @ignore
     */
    function readLayer(map, data, z) {
        var layer = new me.TMXLayer(map.tilewidth, map.tileheight, map.orientation, map.tilesets, z);
        // init the layer properly
        layer.initFromJSON(data);
        // set a renderer
        if (!me.game.tmxRenderer.canRender(layer)) {
            layer.setRenderer(getNewDefaultRenderer(layer));
        }
        else {
            // use the default one
            layer.setRenderer(me.game.tmxRenderer);
        }
        
        // detect encoding and compression
        var encoding = Array.isArray(data[TMXConstants.TMX_TAG_DATA]) ? data[TMXConstants.TMX_TAG_ENCODING] : data[TMXConstants.TMX_TAG_DATA][TMXConstants.TMX_TAG_ENCODING];
        var compression = Array.isArray(data[TMXConstants.TMX_TAG_DATA]) ? data[TMXConstants.TMX_TAG_COMPRESSION] : data[TMXConstants.TMX_TAG_DATA][TMXConstants.TMX_TAG_COMPRESSION];
        
        // parse the layer data
        setLayerData(layer, data[TMXConstants.TMX_TAG_DATA], encoding || "json", compression);
        return layer;
    }

    /**
     * read the Image Layer Data
     * @ignore
     */
    function readImageLayer(map, data, z) {
        // extract layer information
        var ilx = +data[TMXConstants.TMX_TAG_X] || 0;
        var ily = +data[TMXConstants.TMX_TAG_Y] || 0;
        var iln = data[TMXConstants.TMX_TAG_NAME];
        var ilw = +data[TMXConstants.TMX_TAG_WIDTH];
        var ilh = +data[TMXConstants.TMX_TAG_HEIGHT];
        var ilsrc = typeof (data[TMXConstants.TMX_TAG_IMAGE]) !== "string" ? data[TMXConstants.TMX_TAG_IMAGE].source : data[TMXConstants.TMX_TAG_IMAGE];

        // create the layer
        var imageLayer = new me.ImageLayer(
            ilx, ily, {
                width : ilw * map.tilewidth,
                height: ilh * map.tileheight,
                name: iln,
                image: ilsrc,
                z : z
            }
        );

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
    }

    /**
     * read the tileset Data
     * @ignore
     */
    function readTileset(data) {
        return (new me.TMXTileset(data));
    }

    /**
     * read the object group Data
     * @ignore
     */
    function readObjectGroup(map, data, z) {
        return (new me.TMXObjectGroup(data[TMXConstants.TMX_TAG_NAME], data, map.orientation, map.tilesets, z));
    }


    /**
     * a TMX Tile Map Object
     * Tiled QT +0.7.x format
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {String} levelId name of TMX map
     * @param {Object} data TMX map in JSON format
     * @example
     * // create a new level object based on the TMX JSON object
     * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
     * // add the level to the game world container
     * level.addTo(me.game.world, true);
     */
    me.TMXTileMap = me.Object.extend({
        // constructor
        init: function (levelId, data) {

            /**
             * default level position in the game world
             * @ignore
             * @type {me.Vector2d}
             * @name pos
             * @memberOf me.TMXTileMap
             */
            this.pos = new me.Vector2d(0 ,0);

            /**
             * name of the tilemap
             * @public
             * @type String
             * @name me.TMXTileMap#name
             */
            this.name = levelId;

            /** 
             * the level data (JSON)
             * @ignore
             */
            this.data = data;

            /**
             * width of the tilemap in tiles
             * @public
             * @type Int
             * @name me.TMXTileMap#cols
             */
            this.cols = +data[TMXConstants.TMX_TAG_WIDTH];
            /**
             * height of the tilemap in tiles
             * @public
             * @type Int
             * @name me.TMXTileMap#rows
             */
            this.rows = +data[TMXConstants.TMX_TAG_HEIGHT];

            /**
             * Tile width
             * @public
             * @type Int
             * @name me.TMXTileMap#tilewidth
             */
            this.tilewidth = +data[TMXConstants.TMX_TAG_TILEWIDTH];

            /**
             * Tile height
             * @public
             * @type Int
             * @name me.TMXTileMap#tileheight
             */
            this.tileheight = +data[TMXConstants.TMX_TAG_TILEHEIGHT];

            // tilesets for this map
            this.tilesets = null;
            // layers
            this.layers = [];
            // group objects
            this.objectGroups = [];
            
            // tilemap version
            this.version = data[TMXConstants.TMX_TAG_VERSION];
            
            // map type (orthogonal or isometric)
            this.orientation = data[TMXConstants.TMX_TAG_ORIENTATION];
            if (this.orientation === "isometric") {
                this.width = (this.cols + this.rows) * (this.tilewidth / 2);
                this.height = (this.cols + this.rows) * (this.tileheight / 2);
            } else {
                this.width = this.cols * this.tilewidth;
                this.height = this.rows * this.tileheight;
            }
            

            // objects minimum z order
            this.z = 0;

            // object id
            this.nextobjectid = +data[TMXConstants.TMX_TAG_NEXTOBJID] || undefined;
            

            // hex/iso properties
            this.hexsidelength = +data[TMXConstants.TMX_HEXSIDELENGTH];
            this.staggeraxis = data[TMXConstants.TMX_STAGGERAXIS];
            this.staggerindex = data[TMXConstants.TMX_STAGGERINDEX];
            
            // background color
            this.backgroundcolor = data[TMXConstants.TMX_BACKGROUND_COLOR];
            
            // set additional map properties (if any)
            me.TMXUtils.applyTMXProperties(this, data);

            // initialize a default TMX renderer
            if ((me.game.tmxRenderer === null) || !me.game.tmxRenderer.canRender(this)) {
                me.game.tmxRenderer = getNewDefaultRenderer(this);
            }

            // internal flag
            this.initialized = false;

        },

        /**
         * parse the map
         * @ignore
         */
        readMapObjects: function (data) {

            if (this.initialized === true) {
                return;
            }

            // to automatically increment z index
            var zOrder = this.z;
            var self = this;

            // Tileset information
            if (!this.tilesets) {
                // make sure we have a TilesetGroup Object
                this.tilesets = new me.TMXTilesetGroup();
            }

            // parse all tileset objects
            var tilesets = data.tilesets || data.tileset;
            if (Array.isArray(tilesets) === true) {
                tilesets.forEach(function (tileset) {
                    // add the new tileset
                    self.tilesets.add(readTileset(tileset));
                });
            } else {
                self.tilesets.add(readTileset(tilesets));
            }

            // check if a user-defined background color is defined
            if (this.backgroundcolor) {
                this.layers.push(
                    new me.ColorLayer(
                        "background_color",
                        this.backgroundcolor,
                        zOrder++
                    )
                );
            }

            // check if a background image is defined
            if (this.background_image) {
                // add a new image layer
                this.layers.push(new me.ImageLayer(
                    0, 0, {
                        width : this.width,
                        height : this.height,
                        name : "background_image",
                        image : this.background_image,
                        z : zOrder++
                    }
                ));
            }

            // native JSON format
            if (typeof (data.layers) !== "undefined") {
                data.layers.forEach(function (layer) {
                    switch (layer.type) {
                        case TMXConstants.TMX_TAG_IMAGE_LAYER :
                            self.layers.push(readImageLayer(self, layer, zOrder++));
                            break;

                        case TMXConstants.TMX_TAG_TILE_LAYER :
                            self.layers.push(readLayer(self, layer, zOrder++));
                            break;

                        // get the object groups information
                        case TMXConstants.TMX_TAG_OBJECTGROUP:
                            self.objectGroups.push(readObjectGroup(self, layer, zOrder++));
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
                        self.layers.push(readLayer(self, layer, layer._draworder));
                    });
                }
                else {
                    // get the object information
                    self.layers.push(readLayer(self, layers, layers._draworder));
                }

                // in converted format, these are not under the generic layers structure
                if (typeof(data[TMXConstants.TMX_TAG_OBJECTGROUP]) !== "undefined") {
                    var groups = data[TMXConstants.TMX_TAG_OBJECTGROUP];
                    if (Array.isArray(groups) === true) {
                        groups.forEach(function (group) {
                            self.objectGroups.push(readObjectGroup(self, group, group._draworder));
                        });
                    }
                    else {
                        // get the object information
                        self.objectGroups.push(readObjectGroup(self, groups, groups._draworder));
                    }
                }

                // in converted format, these are not under the generic layers structure
                if (typeof(data[TMXConstants.TMX_TAG_IMAGE_LAYER]) !== "undefined") {
                    var imageLayers = data[TMXConstants.TMX_TAG_IMAGE_LAYER];
                    if (Array.isArray(imageLayers) === true) {
                        imageLayers.forEach(function (imageLayer) {
                            self.layers.push(readImageLayer(self, imageLayer, imageLayer._draworder));
                        });
                    }
                    else {
                        self.layers.push(readImageLayer(self, imageLayers, imageLayers._draworder));
                    }
                }
            }
            this.initialized = true;
        },

        
        /**
         * add all the map layers and objects to the given container
         * @name me.TMXTileMap#addTo
         * @public
         * @function
         * @param {me.Container} target container
         * @param {boolean} flatten if true, flatten all objects into the given container
         * @example
         * // create a new level object based on the TMX JSON object
         * var level = new me.TMXTileMap(levelId, me.loader.getTMX(levelId));
         * // add the level to the game world container
         * level.addTo(me.game.world, true);
         */
        addTo : function (container, flatten) {
            // add all layers instances
            this.getLayers().forEach(function (layer) {
                container.addChild(layer);
            });
            
            // add all Object instances
            this.getObjects(flatten).forEach(function (object) {
                container.addChild(object);
            });
        },

        /**
         * return an Array of instantiated objects, based on the map object definition
         * @name me.TMXTileMap#getObjects
         * @public
         * @function
         * @param {boolean} flatten if true, flatten all objects into the returned array, <br>
         * ignoring all defined groups (no sub containers will be created)
         * @return {me.Renderable[]} Array of Objects
         */
        getObjects : function (flatten) {
            var objects = [];
            var isCollisionGroup = false;
            var targetContainer;
            
            // parse the map for objects
            this.readMapObjects(this.data);

            for (var g = 0; g < this.objectGroups.length; g++) {
                var group = this.objectGroups[g];

                // check if this is the collision shape group
                isCollisionGroup = group.name.toLowerCase().includes(TMXConstants.COLLISION_GROUP);
               
                if (flatten === false) {
                    // create a new container with Infinite size (?)
                    // note: initial position and size seems to be meaningless in Tiled
                    // https://github.com/bjorn/tiled/wiki/TMX-Map-Format :
                    // x: Defaults to 0 and can no longer be changed in Tiled Qt.
                    // y: Defaults to 0 and can no longer be changed in Tiled Qt.
                    // width: The width of the object group in tiles. Meaningless.
                    // height: The height of the object group in tiles. Meaningless.
                    targetContainer = new me.Container();

                    // set additional properties
                    targetContainer.name = group.name;
                    targetContainer.z = group.z;
                    targetContainer.setOpacity(group.opacity);

                    // disable auto-sort
                    targetContainer.autoSort = false;
                }
                
                // iterate through the group and add all object into their
                // corresponding target Container
                for (var o = 0; o < group.objects.length; o++) {
                    // TMX object settings
                    var settings = group.objects[o];

                    var obj = me.pool.pull(
                        settings.name || "me.Entity",
                        settings.x, settings.y,
                        settings
                    );

                    // check if a me.Tile object is embedded
                    if (typeof (settings.tile) === "object" && !obj.renderable) {
                        obj.renderable = settings.tile.getRenderable(settings);
                    }

                    if (isCollisionGroup && !settings.name) {
                        // configure the body accordingly
                        obj.body.collisionType = me.collision.types.WORLD_SHAPE;
                    }

                    // skip if the pull function does not return a corresponding object
                    if (typeof obj !== "object") {
                        continue;
                    }
                    
                    // set the obj z order correspondingly to its parent container/group
                    obj.z = group.z;

                    //apply group opacity value to the child objects if group are merged
                    if (flatten === true) {
                        if (obj.isRenderable === true) {
                            obj.setOpacity(obj.getOpacity() * group.opacity);
                            // and to child renderables if any
                            if (obj.renderable instanceof me.Renderable) {
                                obj.renderable.setOpacity(obj.renderable.getOpacity() * group.opacity);
                            }
                        }
                        // directly add the obj into the objects array
                        objects.push(obj);
                    } else /* false*/ {
                        // add it to the new container
                        targetContainer.addChild(obj);
                    }

                }
                
                // if we created a new container
                if ((flatten === false) && (targetContainer.children.length > 0)) {

                    // re-enable auto-sort
                    targetContainer.autoSort = true;
                    
                    // add our container to the world
                    objects.push(targetContainer);
                }
            }
            return objects;
        },
        
        /**
         * return all the existing layers
         * @name me.TMXTileMap#getLayers
         * @public
         * @function
         * @return {me.TMXLayer[]} Array of Layers
         */
        getLayers : function () {
            // parse the map for objects
            this.readMapObjects(this.data);
            return this.layers;
        },

        /**
         * Center the map on the viewport
         * @name me.TMXTileMap#moveToCenter
         * @public
         * @function
         */
        moveToCenter: function () {
            // center the map if smaller than the current viewport
            var width = me.game.viewport.width,
                height = me.game.viewport.height;
            if ((this.width < width) || (this.height < height)) {
                var shiftX =  ~~((width - this.width) / 2);
                var shiftY =  ~~((height - this.height) / 2);
                // update the map default position
                this.pos.set(
                    shiftX > 0 ? shiftX : 0,
                    shiftY > 0 ? shiftY : 0
                );
            }
        },

        /**
         * reset function
         * @name me.TMXTileMap#reset
         * @public
         * @function
         */
        reset : function () {
            this.pos.set(0, 0);
        },

        /**
         * destroy function, clean all allocated objects
         * @name me.TMXTileMap#destroy
         * @public
         * @function
         */
        destroy : function () {
            this.tilesets = undefined;
            this.layers = [];
            this.objectGroups = [];
            this.initialized = false;
        }
    });
})(me.TMXConstants);
