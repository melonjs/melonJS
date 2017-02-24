/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT +0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {

    // constant to identify the collision object layer
    var COLLISION_GROUP = "collision";

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
    function setLayerData(layer, data) {
        var idx = 0;
        // set everything
        for (var y = 0; y < layer.rows; y++) {
            for (var x = 0; x < layer.cols; x++) {
                // get the value of the gid
                var gid = data[idx++];
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
        if (!map.getRenderer().canRender(layer)) {
            layer.setRenderer(getNewDefaultRenderer(layer));
        }
        else {
            // use the default one
            layer.setRenderer(map.getRenderer());
        }
        // parse the layer data
        setLayerData(layer,
            me.TMXUtils.decode(
                data.data,
                data.encoding,
                data.compression
            )
        );
        return layer;
    }

    /**
     * read the Image Layer Data
     * @ignore
     */
    function readImageLayer(map, data, z) {
        // Normalize properties
        me.TMXUtils.applyTMXProperties(data.properties, data);

        // create the layer
        var imageLayer = new me.ImageLayer(
            +data.x || 0,
            +data.y || 0,
            Object.assign({
                name: data.name,
                image: data.image,
                z: z
            }, data.properties)
        );

        // set some additional flags
        var visible = typeof(data.visible) !== "undefined" ? data.visible : true;
        imageLayer.setOpacity(visible ? +data.opacity : 0);

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
        return (new me.TMXObjectGroup(map, data, z));
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
            this.cols = +data.width;
            /**
             * height of the tilemap in tiles
             * @public
             * @type Int
             * @name me.TMXTileMap#rows
             */
            this.rows = +data.height;

            /**
             * Tile width
             * @public
             * @type Int
             * @name me.TMXTileMap#tilewidth
             */
            this.tilewidth = +data.tilewidth;

            /**
             * Tile height
             * @public
             * @type Int
             * @name me.TMXTileMap#tileheight
             */
            this.tileheight = +data.tileheight;

            // tilesets for this map
            this.tilesets = null;
            // layers
            this.layers = [];
            // group objects
            this.objectGroups = [];

            // tilemap version
            this.version = data.version;

            // map type (orthogonal or isometric)
            this.orientation = data.orientation;
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
            this.nextobjectid = +data.nextobjectid || undefined;


            // hex/iso properties
            this.hexsidelength = +data.hexsidelength || undefined;
            this.staggeraxis = data.staggeraxis;
            this.staggerindex = data.staggerindex;

            // background color
            this.backgroundcolor = data.backgroundcolor;

            // set additional map properties (if any)
            me.TMXUtils.applyTMXProperties(this, data);

            // internal flag
            this.initialized = false;

        },

        /**
         * Return the map default renderer
         * @name getRenderer
         * @memberOf me.TMXTileMap
         * @public
         * @function
         * @return {me.TMXRenderer} renderer
         */
        getRenderer : function (renderer) {
            if ((typeof(this.renderer) === "undefined") || (!this.renderer.canRender(this))) {
                this.renderer = getNewDefaultRenderer(this);
            }
            return this.renderer;
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
            if (typeof (data.tilesets) !== "undefined") {
                var tilesets = data.tilesets;
                tilesets.forEach(function (tileset) {
                    // add the new tileset
                    self.tilesets.add(readTileset(tileset));
                });
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
                        name : "background_image",
                        image : this.background_image,
                        z : zOrder++
                    }
                ));
            }

            data.layers.forEach(function (layer) {
                switch (layer.type) {
                    case "imagelayer":
                        self.layers.push(readImageLayer(self, layer, zOrder++));
                        break;

                    case "tilelayer":
                        self.layers.push(readLayer(self, layer, zOrder++));
                        break;

                    // get the object groups information
                    case "objectgroup":
                        self.objectGroups.push(readObjectGroup(self, layer, zOrder++));
                        break;

                    default:
                        break;
                }
            });
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
            var _sort = container.autoSort;
            var _depth = container.autoDepth;

            // disable auto-sort and auto-depth
            container.autoSort = false;
            container.autoDepth = false;

            // add all layers instances
            this.getLayers().forEach(function (layer) {
                container.addChild(layer);
            });

            // add all Object instances
            this.getObjects(flatten).forEach(function (object) {
                container.addChild(object);
            });

            //  set back auto-sort and auto-depth
            container.autoSort = _sort;
            container.autoDepth = _depth;

            // force a sort
            container.sort(true);
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
                isCollisionGroup = group.name.toLowerCase().includes(COLLISION_GROUP);

                if (flatten === false) {
                    // create a new container
                    targetContainer = new me.Container(0, 0, this.width, this.height);

                    // set additional properties
                    targetContainer.name = group.name;
                    targetContainer.pos.z = group.z;
                    targetContainer.setOpacity(group.opacity);

                    // disable auto-sort and auto-depth
                    targetContainer.autoSort = false;
                    targetContainer.autoDepth = false;
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
                    // skip if the pull function does not return a corresponding object
                    if (typeof obj !== "object") {
                        continue;
                    }

                    // check if a me.Tile object is embedded
                    if (typeof (settings.tile) === "object" && !obj.renderable) {
                        obj.renderable = settings.tile.getRenderable(settings);
                        // adjust position if necessary
                        switch (settings.rotation) {
                            case Math.PI:
                                obj.translate(-obj.renderable.width, obj.renderable.height);
                                break;
                            case Math.PI / 2 :
                                obj.translate(0, obj.renderable.height);
                                break;
                            case -(Math.PI / 2) :
                                obj.translate(-obj.renderable.width, 0);
                                break;
                            default :
                                // this should not happen
                                break;
                        }
                    }

                    if (isCollisionGroup && !settings.name) {
                        // configure the body accordingly
                        obj.body.collisionType = me.collision.types.WORLD_SHAPE;
                    }

                    // set the obj z order correspondingly to its parent container/group
                    obj.pos.z = group.z;

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

                    // re-enable auto-sort and auto-depth
                    targetContainer.autoSort = true;
                    targetContainer.autoDepth = true;

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
})();
