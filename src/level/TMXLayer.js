/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * Set a tiled layer Data
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
     * a TMX Tile Layer Object
     * Tiled QT 0.7.x format
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {Number} tilewidth width of each tile in pixels
     * @param {Number} tileheight height of each tile in pixels
     * @param {String} orientation "isometric" or "orthogonal"
     * @param {me.TMXTilesetGroup} tilesets tileset as defined in Tiled
     * @param {Number} z z-index position
     */
    me.TMXLayer = me.Renderable.extend({
        /**
         * @ignore
         */
        init: function (tilewidth, tileheight, orientation, tilesets, z) {
            // super constructor
            this._super(me.Renderable, "init", [0, 0, 0, 0]);

            // tile width & height
            this.tilewidth  = tilewidth;
            this.tileheight = tileheight;

            // layer orientation
            this.orientation = orientation;

            /**
             * The Layer corresponding Tilesets
             * @public
             * @type me.TMXTilesetGroup
             * @name me.TMXLayer#tilesets
             */
            this.tilesets = tilesets;

            // the default tileset
            // XXX: Is this even used?
            this.tileset = (this.tilesets ? this.tilesets.getTilesetByIndex(0) : null);

            // Biggest tile size to draw
            this.maxTileSize = {
                "width" : 0,
                "height" : 0
            };
            for (var i = 0; i < this.tilesets.length; i++) {
                var tileset = this.tilesets.getTilesetByIndex(i);
                this.maxTileSize.width = Math.max(this.maxTileSize.width, tileset.tilewidth);
                this.maxTileSize.height = Math.max(this.maxTileSize.height, tileset.tileheight);
            }

            /**
             * All animated tilesets in this layer
             * @ignore
             * @type Array
             * @name me.TMXLayer#animatedTilesets
             */
            this.animatedTilesets = [];

            /**
             * Layer contains tileset animations
             * @public
             * @type Boolean
             * @name me.TMXLayer#isAnimated
             */
            this.isAnimated = false;

            // for displaying order
            this.pos.z = z;

            // tiled default coordinates are top-left
            this.anchorPoint.set(0, 0);
        },

        /** @ignore */
        initFromJSON: function (data) {
            // additional TMX flags
            this.name = data.name;
            this.cols = +data.width;
            this.rows = +data.height;

            // hexagonal maps only
            this.hexsidelength = +data.hexsidelength || undefined;
            this.staggeraxis = data.staggeraxis;
            this.staggerindex = data.staggerindex;

            // layer opacity
            var visible = typeof(data.visible) !== "undefined" ? +data.visible : 1;
            this.setOpacity(visible ? +data.opacity : 0);

            // layer "real" size
            if (this.orientation === "isometric") {
                this.width = (this.cols + this.rows) * (this.tilewidth / 2);
                this.height = (this.cols + this.rows) * (this.tileheight / 2);
            } else {
                this.width = this.cols * this.tilewidth;
                this.height = this.rows * this.tileheight;
            }
            // check if we have any user-defined properties
            me.TMXUtils.applyTMXProperties(this, data);

            // check for the correct rendering method
            if (typeof (this.preRender) === "undefined") {
                this.preRender = me.sys.preRender;
            }

            // if pre-rendering method is use, create an offline canvas/renderer
            if (this.preRender === true) {
                this.canvasRenderer = new me.CanvasRenderer(
                    me.video.createCanvas(this.width, this.height),
                    this.width, this.height,
                    { transparent : true }
                );
            }

            //initialize the layer data array
            this.initArray(this.cols, this.rows);

            // parse the layer data
            setLayerData(this,
                me.TMXUtils.decode(
                    data.data,
                    data.encoding,
                    data.compression
                )
            );
        },

        // called when the layer is added to the game world or a container
        onActivateEvent : function () {

            // (re)initialize the layer data array
            /*if (this.layerData === undefined) {
                this.initArray(this.cols, this.rows);
            }*/

            if (this.animatedTilesets === undefined) {
                this.animatedTilesets = [];
            }

            if (this.tilesets) {
                var tileset = this.tilesets.tilesets;
                for (var i = 0; i < tileset.length; i++) {
                    if (tileset[i].isAnimated) {
                        this.animatedTilesets.push(tileset[i]);
                    }
                }
            }

            this.isAnimated = this.animatedTilesets.length > 0;

            // Force pre-render off when tileset animation is used
            if (this.isAnimated) {
                this.preRender = false;
            }

            // Resize the bounding rect
            this.getBounds().resize(this.width, this.height);
        },

        // called when the layer is removed from the game world or a container
        onDeactivateEvent : function () {
            // clear all allocated objects
            //this.layerData = undefined;
            this.animatedTilesets = undefined;
        },

        /**
         * Se the TMX renderer for this layer object
         * @name setRenderer
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {me.TMXRenderer} renderer
         */
        setRenderer : function (renderer) {
            this.renderer = renderer;
        },

        /**
         * Return the layer current renderer object
         * @name getRenderer
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @return {me.TMXRenderer} renderer
         */
        getRenderer : function (renderer) {
            return this.renderer;
        },

        /**
         * Create all required arrays
         * @ignore
         */
        initArray : function (w, h) {
            // initialize the array
            this.layerData = [];
            for (var x = 0; x < w; x++) {
                this.layerData[x] = [];
                for (var y = 0; y < h; y++) {
                    this.layerData[x][y] = null;
                }
            }
        },

        /**
         * Return the TileId of the Tile at the specified position
         * @name getTileId
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {Number} x X coordinate (in world/pixels coordinates)
         * @param {Number} y Y coordinate (in world/pixels coordinates)
         * @return {Number} TileId or null if there is no Tile at the given position
         */
        getTileId : function (x, y) {
            var tile = this.getTile(x, y);
            return (tile ? tile.tileId : null);
        },

        /**
         * Return the Tile object at the specified position
         * @name getTile
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {Number} x X coordinate (in world/pixels coordinates)
         * @param {Number} y Y coordinate (in world/pixels coordinates)
         * @return {me.Tile} corresponding tile or null if outside of the map area
         * @example
         * // get the TMX Map Layer called "Front layer"
         * var layer = me.game.world.getChildByName("Front Layer")[0];
         * // get the tile object corresponding to the latest pointer position
         * var tile = layer.getTile(me.input.pointer.pos.x, me.input.pointer.pos.y);
         */
        getTile : function (x, y) {
            if (this.containsPoint(x, y)) {
                var renderer = this.renderer;
                var col = ~~renderer.pixelToTileX(x, y);
                var row = ~~renderer.pixelToTileY(y, x);
                if ((col >= 0 && col < renderer.cols) && (row >= 0 && row < renderer.rows)) {
                    return this.layerData[col][row];
                }
            }
            // return null if no corresponding tile
            return null;
        },

        /**
         * Create a new Tile at the specified position
         * @name setTile
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {Number} x X coordinate (in map coordinates: row/column)
         * @param {Number} y Y coordinate (in map coordinates: row/column)
         * @param {Number} tileId tileId
         * @return {me.Tile} the corresponding newly created tile object
         */
        setTile : function (x, y, tileId) {
            if (!this.tileset.contains(tileId)) {
                // look for the corresponding tileset
                this.tileset = this.tilesets.getTilesetByGid(tileId);
            }
            var tile = this.layerData[x][y] = new me.Tile(x, y, tileId, this.tileset);
            // draw the corresponding tile
            if (this.preRender) {
                this.renderer.drawTile(this.canvasRenderer, x, y, tile);
            }
            return tile;
        },

        /**
         * clear the tile at the specified position
         * @name clearTile
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {Number} x X coordinate (in map coordinates: row/column)
         * @param {Number} y Y coordinate (in map coordinates: row/column)
         * @example
         * me.game.world.getChildByType(me.TMXLayer).forEach(function(layer) {
         *     // clear all tiles at the given x,y coordinates
         *     layer.clearTile(x, y);
         * });
         */
        clearTile : function (x, y) {
            // clearing tile
            this.layerData[x][y] = null;
            // erase the corresponding area in the canvas
            if (this.preRender) {
                this.canvasRenderer.clearRect(x * this.tilewidth, y * this.tileheight, this.tilewidth, this.tileheight);
            }
        },

        /**
         * update animations in a tileset layer
         * @ignore
         */
        update : function (dt) {
            if (this.isAnimated) {
                var result = false;
                for (var i = 0; i < this.animatedTilesets.length; i++) {
                    result = this.animatedTilesets[i].update(dt) || result;
                }
                return result;
            }

            return false;
        },

        /**
         * draw a tileset layer
         * @ignore
         */
        draw : function (renderer, rect) {
            // use the offscreen canvas
            if (this.preRender) {
                var width = Math.min(rect.width, this.width);
                var height = Math.min(rect.height, this.height);

                // draw using the cached canvas
                renderer.drawImage(
                    this.canvasRenderer.getCanvas(),
                    rect.pos.x, rect.pos.y, // sx,sy
                    width, height,          // sw,sh
                    rect.pos.x, rect.pos.y, // dx,dy
                    width, height           // dw,dh
                );
            }
            // dynamically render the layer
            else {
                // draw the layer
                this.renderer.drawTileLayer(renderer, this, rect);
            }
        }
    });
})();
