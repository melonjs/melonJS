(function () {

    /**
     * Create required arrays for the given layer object
     * @ignore
     */
    function initArray(layer) {
        // initialize the array
        layer.layerData = new Array(layer.cols);
        for (var x = 0; x < layer.cols; x++) {
            layer.layerData[x] = new Array(layer.rows);
            for (var y = 0; y < layer.rows; y++) {
                layer.layerData[x][y] = null;
            }
        }
    }

    /**
     * Set a tiled layer Data
     * @ignore
     */
    function setLayerData(layer, data) {
        var idx = 0;
        // initialize the array
        initArray(layer);
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
     * @param {Object} data layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
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
        init: function (data, tilewidth, tileheight, orientation, tilesets, z) {
            // super constructor
            this._super(me.Renderable, "init", [0, 0, 0, 0]);

            // tile width & height
            this.tilewidth = data.tilewidth || tilewidth;
            this.tileheight = data.tileheight || tileheight;

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

            /**
             * the order in which tiles on orthogonal tile layers are rendered.
             * (valid values are "left-down", "left-up", "right-down", "right-up")
             * @public
             * @type {String}
             * @default "right-down"
             * @name me.TMXLayer#renderorder
             */
            this.renderorder = data.renderorder || "right-down";

            // for displaying order
            this.pos.z = z;

            // tiled default coordinates are top-left
            this.anchorPoint.set(0, 0);

            // additional TMX flags
            this.name = data.name;
            this.cols = +data.width;
            this.rows = +data.height;

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

            // initialize and set the layer data
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
            var bounds = this.getRenderer().getBounds(this);
            this.getBounds().resize(bounds.width, bounds.height);

            // if pre-rendering method is use, create an offline canvas/renderer
            if ((this.preRender === true) && (!this.canvasRenderer)) {
                this.canvasRenderer = new me.CanvasRenderer(
                    me.video.createCanvas(this.width, this.height),
                    this.width, this.height,
                    { transparent : true }
                );
            }
        },

        // called when the layer is removed from the game world or a container
        onDeactivateEvent : function () {
            // clear all allocated objects
            //this.layerData = undefined;
            this.animatedTilesets = undefined;
        },

        /**
         * Set the TMX renderer for this layer object
         * @name setRenderer
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {me.TMXRenderer} renderer
         * @example
         * // use the parent map default renderer
         * var layer = new me.TMXLayer(...);
         * layer.setRenderer(map.getRenderer());
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
         * @return {me.Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
         * @example
         * // get the TMX Map Layer called "Front layer"
         * var layer = me.game.world.getChildByName("Front Layer")[0];
         * // get the tile object corresponding to the latest pointer position
         * var tile = layer.getTile(me.input.pointer.pos.x, me.input.pointer.pos.y);
         */
        getTile : function (x, y) {
            var tile = null;

            if (this.containsPoint(x, y)) {
                var coord = this.renderer.pixelToTileCoords(x, y, me.pool.pull("me.Vector2d"));
                tile = this.cellAt(coord.x, coord.y);
                me.pool.push(coord);
            }
            return tile;
        },

        /**
         * Return the Tile object at the specified tile coordinates
         * @name cellAt
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {Number} x x position of the tile (in Tile unit)
         * @param {Number} y x position of the tile (in Tile unit)
         * @param {Number} [boundsCheck=true] check first if within the layer bounds
         * @return {me.Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
         * @example
         * // return the first tile at offset 0, 0
         * var tile = layer.cellAt(0, 0);
         */
        cellAt : function (x, y, boundsCheck) {
            var _x = ~~x;
            var _y = ~~y;

            // boundsCheck only used internally by the tiled renderer, when the layer bound check was already done
            if (boundsCheck === false || (_x >= 0 && _x < this.renderer.cols && _y >= 0 && _y < this.renderer.rows)) {
                return this.layerData[_x][_y];
            } else {
                return null;
            }
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
