/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function (TMXConstants) {

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
        // constructor
        init: function (name, color, z) {
            // parent constructor
            this._super(me.Renderable, "init", [0, 0, Infinity, Infinity]);

            // apply given parameters
            this.name = name;
            this.color = color;
            this.z = z;
            this.floating = true;
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
     * @param {Image|String} settings.image Image reference. See {@link me.loader#getImage}
     * @param {Number} [settings.width=image.width] Layer width in pixels
     * @param {Number} [settings.height=image.height] Layer height in pixels
     * @param {String} [settings.name="me.ImageLayer"] Layer name
     * @param {Number} [settings.z=0] z-index position
     * @param {Number|me.Vector2d} [settings.ratio=1.0] Scrolling ratio to be applied
     */
    me.ImageLayer = me.Renderable.extend({
        /**
         * constructor
         * @ignore
         * @function
         */
        init: function (x, y, settings) {
            // layer name
            this.name = settings.name || "me.ImageLayer";

            // maximum layer size
            this.maxWidth = settings.width || Infinity;
            this.maxHeight = settings.height || Infinity;

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
            this._super(me.Renderable, "init", [x, y, this.maxWidth, this.maxHeight]);
            // resize/compute the correct image layer size
            this.resize(me.game.viewport.width, me.game.viewport.height);

            // specify the start offset when drawing the image (for parallax/repeat features)
            this.offset = new me.Vector2d(0, 0);

            // displaying order
            this.z = settings.z || 0;

            /**
             * Define the image scrolling ratio<br>
             * Scrolling speed is defined by multiplying the viewport delta position (e.g. followed entity) by the specified ratio<br>
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

            // last position of the viewport
            this.lastpos = me.game.viewport.pos.clone();

            // Image Layer is considered as a floating object
            this.floating = true;

            // default value for repeat
            this._repeat = "repeat";

            this.repeatX = true;
            this.repeatY = true;

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
                get : function get() {
                    return this._repeat;
                },
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
                }
            });

            // default origin position
            this.anchorPoint.set(0, 0);

        },
        
        // called when the layer is added to the game world or a container
        onActivateEvent : function () {
            // register to the viewport change notification
            this.vpChangeHdlr = me.event.subscribe(me.event.VIEWPORT_ONCHANGE, this.updateLayer.bind(this));
            this.vpResizeHdlr = me.event.subscribe(me.event.VIEWPORT_ONRESIZE, this.resize.bind(this));
            
            // last position of the viewport
            this.lastpos.copy(me.game.viewport.pos);
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
                Math.min(w, this.maxWidth),
                Math.min(h, this.maxHeight)
            ]);
        },

        /**
         * updateLayer function
         * @ignore
         * @function
         */
        updateLayer : function (vpos) {
            if (0 === this.ratio.x && 0 === this.ratio.y) {
                // static image
                return;
            }
            else if (this.repeatX || this.repeatY) {
                // parallax / scrolling image
                this.offset.x += ((vpos.x - this.lastpos.x) * this.ratio.x) % this.imagewidth;
                this.offset.x = (this.imagewidth + this.offset.x) % this.imagewidth;

                this.offset.y += ((vpos.y - this.lastpos.y) * this.ratio.y) % this.imageheight;
                this.offset.y = (this.imageheight + this.offset.y) % this.imageheight;
            }
            else {
                this.offset.x += (vpos.x - this.lastpos.x) * this.ratio.x;
                this.offset.y += (vpos.y - this.lastpos.y) * this.ratio.y;
            }
            this.lastpos.setV(vpos);
        },

        /**
         * draw the image layer
         * @ignore
         */
        draw : function (renderer, rect) {
            // translate default position using the anchorPoint value
            var viewport = me.game.viewport;
            var shouldTranslate = this.anchorPoint.y !== 0 || this.anchorPoint.x !== 0 || this.pos.y !== 0 || this.pos.x !== 0;
            var translateX = ~~(this.pos.x + (this.anchorPoint.x * (viewport.width - this.imagewidth)));
            var translateY = ~~(this.pos.y + (this.anchorPoint.y * (viewport.height - this.imageheight)));

            if (shouldTranslate) {
                renderer.translate(translateX, translateY);
            }

            // set the layer alpha value
            renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());

            var sw, sh;

            // if not scrolling ratio define, static image
            if (0 === this.ratio.x && 0 === this.ratio.y) {
                // static image
                sw = Math.min(rect.width, this.imagewidth);
                sh = Math.min(rect.height, this.imageheight);

                renderer.drawImage(
                    this.image,
                    rect.left, rect.top,    // sx, sy
                    sw, sh,                 // sw, sh
                    rect.left, rect.top,    // dx, dy
                    sw, sh                  // dw, dh
                );
            }
            // parallax / scrolling image
            else {
                var sx = ~~this.offset.x;
                var sy = ~~this.offset.y;

                var dx = 0;
                var dy = 0;

                sw = Math.min(this.imagewidth  - sx, this.width);
                sh = Math.min(this.imageheight - sy, this.height);

                do {
                    do {
                        renderer.drawImage(
                            this.image,
                            sx, sy, // sx, sy
                            sw, sh,
                            dx, dy, // dx, dy
                            sw, sh
                        );

                        sy = 0;
                        dy += sh;
                        sh = Math.min(this.imageheight, this.height - dy);

                    } while (this.repeatY && (dy < this.height));
                    dx += sw;
                    if (!this.repeatX || (dx >= this.width)) {
                        // done ("end" of the viewport)
                        break;
                    }
                    // else update required var for next iteration
                    sx = 0;
                    sw = Math.min(this.imagewidth, this.width - dx);
                    sy = ~~this.offset.y;
                    dy = 0;
                    sh = Math.min(this.imageheight - ~~this.offset.y, this.height);
                } while (true);
            }

            if (shouldTranslate) {
                renderer.translate(-translateX, -translateY);
            }
        },

        // called when the layer is removed from the game world or a container
        onDeactivateEvent : function () {
            // cancel the event subscription
            if (this.vpChangeHdlr)  {
                me.event.unsubscribe(this.vpChangeHdlr);
                this.vpChangeHdlr = null;
            }
            if (this.vpResizeHdlr)  {
                me.event.unsubscribe(this.vpResizeHdlr);
                this.vpResizeHdlr = null;
            }
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

        /** @ignore */
        init: function (tilewidth, tileheight, orientation, tilesets, z, hexsidelength, staggeraxis, staggerindex) {
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
            this.tileset = (this.tilesets ? this.tilesets.getTilesetByIndex(0) : null);

            /**
             * All animated tilesets in this layer
             * @private
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
            this.z = z;
			
            // hexagonal maps only
			this.hexsidelength = hexsidelength;
			this.staggeraxis = staggeraxis;
			this.staggerindex = staggerindex;
        },

        /** @ignore */
        initFromJSON: function (layer) {
            // additional TMX flags
            this.name = layer[TMXConstants.TMX_TAG_NAME];
            this.cols = +layer[TMXConstants.TMX_TAG_WIDTH];
            this.rows = +layer[TMXConstants.TMX_TAG_HEIGHT];

            // hexagonal maps only
            this.hexsidelength = +layer[TMXConstants.TMX_HEXSIDELENGTH] || undefined;
            this.staggeraxis = layer[TMXConstants.TMX_STAGGERAXIS] || undefined;
            this.staggerindex = layer[TMXConstants.TMX_STAGGERINDEX] || undefined;

            // layer opacity
            var visible = typeof(layer[TMXConstants.TMX_TAG_VISIBLE]) !== "undefined" ? layer[TMXConstants.TMX_TAG_VISIBLE] : true;
            this.setOpacity(visible ? +layer[TMXConstants.TMX_TAG_OPACITY] : 0);

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
                    {/* use default values*/}
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
                        tileset[i].isAnimated = false;
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
            this.resizeBounds(this.width, this.height);
        },
        
        // called when the layer is removed from the game world or a container
        onDeactivateEvent : function () {
            // clear all allocated objects
            //this.layerData = undefined;
            this.animatedTilesets = undefined;
        },


        /**
         * set the layer renderer
         * @ignore
         */
        setRenderer : function (renderer) {
            this.renderer = renderer;
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
         * @param {Number} x X coordinate
         * @param {Number} y Y coordinate
         * @return {Number} TileId
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
         * @param {Number} x X coordinate
         * @param {Number} y Y coordinate
         * @return {me.Tile} Tile Object
         */
        getTile : function (x, y) {
            return this.layerData[~~this.renderer.pixelToTileX(x, y)][~~this.renderer.pixelToTileY(y, x)];
        },

        /**
         * Create a new Tile at the specified position
         * @name setTile
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {Number} x X coordinate
         * @param {Number} y Y coordinate
         * @param {Number} tileId tileId
         * @return {me.Tile} the corresponding newly created tile object
         */
        setTile : function (x, y, tileId) {
            if (!this.tileset.contains(tileId)) {
                // look for the corresponding tileset
                this.tileset = this.tilesets.getTilesetByGid(tileId & TMXConstants.TMX_CLEAR_BIT_MASK);
            }
            var tile = this.layerData[x][y] = new me.Tile(x, y, tileId, this.tileset);
            // draw the corresponding tile
            if (this.preRender) {
                this.renderer.drawTile(this.canvasRenderer, x, y, tile, tile.tileset);
            }
            return tile;
        },

        /**
         * clear the tile at the specified position
         * @name clearTile
         * @memberOf me.TMXLayer
         * @public
         * @function
         * @param {Number} x X coordinate
         * @param {Number} y Y coordinate
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

                this.canvasRenderer.setGlobalAlpha(this.canvasRenderer.globalAlpha() * this.getOpacity());

                if (this.canvasRenderer.globalAlpha() > 0) {
                    // draw using the cached canvas
                    renderer.drawImage(
                        this.canvasRenderer.getCanvas(),
                        rect.pos.x, rect.pos.y, // sx,sy
                        width, height,          // sw,sh
                        rect.pos.x, rect.pos.y, // dx,dy
                        width, height           // dw,dh
                    );
                }
            }
            // dynamically render the layer
            else {
                // set the layer alpha value
                var _alpha = renderer.globalAlpha();
                renderer.setGlobalAlpha(renderer.globalAlpha() * this.getOpacity());
                if (renderer.globalAlpha() > 0) {
                    // draw the layer
                    this.renderer.drawTileLayer(renderer, this, rect);
                }

                // restore context to initial state
                renderer.setGlobalAlpha(_alpha);
            }
        }
    });
})(me.TMXConstants);
