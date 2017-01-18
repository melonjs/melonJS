/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * a generic Color Layer Object
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {String} name Layer name
     * @param {me.Color|String} color CSS color
     * @param {Number} z z-index position
     */
    me.ColorLayer = me.Renderable.extend({
        /**
         * Constructor
         * @ignore
         */
        init: function (name, color, z) {
            // parent constructor
            this._super(me.Renderable, "init", [0, 0, Infinity, Infinity]);

            // apply given parameters
            this.name = name;
            this.pos.z = z;
            this.floating = true;

            // parse the given color
            if (color instanceof me.Color) {
                this.color = color.toRGBA();
            } else {
                // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
                var _col = me.pool.pull("me.Color");
                this.color = _col.parseCSS(color).toRGBA();
                me.pool.push(_col);
            }


        },

        /**
         * draw the color layer
         * @ignore
         */
        draw : function (renderer, rect) {
            // set layer opacity
            var _alpha = renderer.globalAlpha();
            renderer.setGlobalAlpha(_alpha * this.getOpacity());

            var vpos = me.game.viewport.pos;
            renderer.setColor(this.color);
            renderer.fillRect(
                rect.left - vpos.x, rect.top - vpos.y,
                rect.width, rect.height
            );
            // restore context alpha value
            renderer.setGlobalAlpha(_alpha);
            renderer.setColor("#fff");
        }
    });

    /**
     * a generic Image Layer Object
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {Number} x x coordinate
     * @param {Number} y y coordinate
     * @param {Object} settings ImageLayer properties
     * @param {Image|String} settings.image Image reference. See {@link me.loader.getImage}
     * @param {String} [settings.name="me.ImageLayer"] Layer name
     * @param {Number} [settings.z=0] z-index position
     * @param {Number|me.Vector2d} [settings.ratio=1.0] Scrolling ratio to be applied
     * @param {Number|me.Vector2d} [settings.anchorPoint=0.0] Image origin. See {@link me.ImageLayer#anchorPoint}
     */
    me.ImageLayer = me.Renderable.extend({
        /**
         * constructor
         * @ignore
         */
        init: function (x, y, settings) {
            // layer name
            this.name = settings.name || "me.ImageLayer";

            // get the corresponding image
            this.image = me.utils.getImage(settings.image);

            // XXX: Keep this check?
            if (!this.image) {
                throw new me.Error((
                    (typeof(settings.image) === "string") ?
                    "'" + settings.image + "'" :
                    "Image"
                ) + " file for Image Layer '" + this.name + "' not found!");
            }

            this.imagewidth = this.image.width;
            this.imageheight = this.image.height;

            // call the constructor
            this._super(me.Renderable, "init", [x, y, Infinity, Infinity]);

            // render in screen coordinates
            this.floating = true;

            // displaying order
            this.pos.z = settings.z || 0;

            this.offset = new me.Vector2d(x, y);

            /**
             * Define the image scrolling ratio<br>
             * Scrolling speed is defined by multiplying the viewport delta position (e.g. followed entity) by the specified ratio.
             * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
             * To specify a value through Tiled, use one of the following format : <br>
             * - a number, to change the value for both axis <br>
             * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
             * @public
             * @type me.Vector2d
             * @default <1.0,1.0>
             * @name me.ImageLayer#ratio
             */
            this.ratio = new me.Vector2d(1.0, 1.0);

            if (typeof(settings.ratio) !== "undefined") {
                // little hack for backward compatiblity
                if (typeof(settings.ratio) === "number") {
                    this.ratio.set(settings.ratio, settings.ratio);
                } else /* vector */ {
                    this.ratio.setV(settings.ratio);
                }
            }

            if (typeof(settings.anchorPoint) === "undefined") {
                /**
                 * Define how the image is anchored to the viewport bounds<br>
                 * By default, its upper-left corner is anchored to the viewport bounds upper left corner.<br>
                 * The anchorPoint is a unit vector where each component falls in range [0.0,1.0].<br>
                 * Some common examples:<br>
                 * * &lt;0.0,0.0&gt; : (Default) Anchor image to the upper-left corner of viewport bounds
                 * * &lt;0.5,0.5&gt; : Center the image within viewport bounds
                 * * &lt;1.0,1.0&gt; : Anchor image to the lower-right corner of viewport bounds
                 * To specify a value through Tiled, use one of the following format : <br>
                 * - a number, to change the value for both axis <br>
                 * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
                 * @public
                 * @type me.Vector2d
                 * @default <0.0,0.0>
                 * @name me.ImageLayer#anchorPoint
                 */
                this.anchorPoint.set(0, 0);
            }
            else {
                if (typeof(settings.anchorPoint) === "number") {
                    this.anchorPoint.set(settings.anchorPoint, settings.anchorPoint);
                }
                else /* vector */ {
                    this.anchorPoint.setV(settings.anchorPoint);
                }
            }

            /**
             * Define if and how an Image Layer should be repeated.<br>
             * By default, an Image Layer is repeated both vertically and horizontally.<br>
             * Acceptable values : <br>
             * * 'repeat' - The background image will be repeated both vertically and horizontally. (default) <br>
             * * 'repeat-x' - The background image will be repeated only horizontally.<br>
             * * 'repeat-y' - The background image will be repeated only vertically.<br>
             * * 'no-repeat' - The background-image will not be repeated.<br>
             * @public
             * @type String
             * @name me.ImageLayer#repeat
             */
            Object.defineProperty(this, "repeat", {
                /**
                 * @ignore
                 */
                get : function get() {
                    return this._repeat;
                },
                /**
                 * @ignore
                 */
                set : function set(val) {
                    this._repeat = val;
                    switch (this._repeat) {
                        case "no-repeat" :
                            this.repeatX = false;
                            this.repeatY = false;
                            break;
                        case "repeat-x" :
                            this.repeatX = true;
                            this.repeatY = false;
                            break;
                        case "repeat-y" :
                            this.repeatX = false;
                            this.repeatY = true;
                            break;
                        default : // "repeat"
                            this.repeatX = true;
                            this.repeatY = true;
                            break;
                    }
                    this.resize(me.game.viewport.width, me.game.viewport.height);
                    this.createPattern();
                }
            });

            this.repeat = settings.repeat || "repeat";
        },

        // called when the layer is added to the game world or a container
        onActivateEvent : function () {
            var _updateLayerFn = this.updateLayer.bind(this);
            // register to the viewport change notification
            this.vpChangeHdlr = me.event.subscribe(me.event.VIEWPORT_ONCHANGE, _updateLayerFn);
            this.vpResizeHdlr = me.event.subscribe(me.event.VIEWPORT_ONRESIZE, this.resize.bind(this));
            this.vpLoadedHdlr = me.event.subscribe(me.event.LEVEL_LOADED, function() {
                // force a first refresh when the level is loaded
                _updateLayerFn(me.game.viewport.pos);
            });
            // in case the level is not added to the root container,
            // the onActivateEvent call happens after the LEVEL_LOADED event
            // so we need to force a first update
            if (this.ancestor._root !== true) {
                this.updateLayer(me.game.viewport.pos);
            }
        },

        /**
         * resize the Image Layer to match the given size
         * @name resize
         * @memberOf me.ImageLayer
         * @function
         * @param {Number} w new width
         * @param {Number} h new height
        */
        resize : function (w, h) {
            this._super(me.Renderable, "resize", [
                this.repeatX ? Infinity : w,
                this.repeatY ? Infinity : h
            ]);
        },

        /**
         * createPattern function
         * @ignore
         * @function
         */
        createPattern : function () {
            this._pattern = me.video.renderer.createPattern(this.image, this._repeat);
        },

        /**
         * updateLayer function
         * @ignore
         * @function
         */
        updateLayer : function (vpos) {
            var rx = this.ratio.x,
                ry = this.ratio.y;

            if (rx === ry === 0) {
                // static image
                return;
            }

            var viewport = me.game.viewport,
                width = this.imagewidth,
                height = this.imageheight,
                bw = viewport.bounds.width,
                bh = viewport.bounds.height,
                ax = this.anchorPoint.x,
                ay = this.anchorPoint.y,

                /*
                 * Automatic positioning
                 *
                 * See https://github.com/melonjs/melonJS/issues/741#issuecomment-138431532
                 * for a thorough description of how this works.
                 */
                x = ax * (rx - 1) * (bw - viewport.width) + this.offset.x - rx * vpos.x,
                y = ay * (ry - 1) * (bh - viewport.height) + this.offset.y - ry * vpos.y;


            // Repeat horizontally; start drawing from left boundary
            if (this.repeatX) {
                this.pos.x = x % width;
            }
            else {
                this.pos.x = x;
            }

            // Repeat vertically; start drawing from top boundary
            if (this.repeatY) {
                this.pos.y = y % height;
            }
            else {
                this.pos.y = y;
            }
        },

        /**
         * draw the image layer
         * @ignore
         */
        draw : function (renderer) {
            var viewport = me.game.viewport,
                width = this.imagewidth,
                height = this.imageheight,
                bw = viewport.bounds.width,
                bh = viewport.bounds.height,
                ax = this.anchorPoint.x,
                ay = this.anchorPoint.y,
                x = this.pos.x,
                y = this.pos.y,
                alpha = renderer.globalAlpha();

            if (this.ratio.x === this.ratio.y === 0) {
                x = x + ax * (bw - width);
                y = y + ay * (bh - height);
            }

            renderer.setGlobalAlpha(alpha * this.getOpacity());
            renderer.translate(x, y);
            renderer.drawPattern(
                this._pattern,
                0,
                0,
                viewport.width * 2,
                viewport.height * 2
            );
            renderer.translate(-x, -y);
            renderer.setGlobalAlpha(alpha);
        },

        // called when the layer is removed from the game world or a container
        onDeactivateEvent : function () {
            // cancel all event subscriptions
            me.event.unsubscribe(this.vpChangeHdlr);
            me.event.unsubscribe(this.vpResizeHdlr);
            me.event.unsubscribe(this.vpLoadedHdlr);
        }

    });

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
        initFromJSON: function (layer) {
            // additional TMX flags
            this.name = layer.name;
            this.cols = +layer.width;
            this.rows = +layer.height;

            // hexagonal maps only
            this.hexsidelength = +layer.hexsidelength || undefined;
            this.staggeraxis = layer.staggeraxis;
            this.staggerindex = layer.staggerindex;

            // layer opacity
            var visible = typeof(layer.visible) !== "undefined" ? +layer.visible : 1;
            this.setOpacity(visible ? +layer.opacity : 0);

            // layer "real" size
            if (this.orientation === "isometric") {
                this.width = (this.cols + this.rows) * (this.tilewidth / 2);
                this.height = (this.cols + this.rows) * (this.tileheight / 2);
            } else {
                this.width = this.cols * this.tilewidth;
                this.height = this.rows * this.tileheight;
            }
            // check if we have any user-defined properties
            me.TMXUtils.applyTMXProperties(this, layer);

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
            // set the layer alpha value
            var alpha = renderer.globalAlpha();
            renderer.setGlobalAlpha(alpha * this.getOpacity());

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

            // restore context to initial state
            renderer.setGlobalAlpha(alpha);
        }
    });
})();
