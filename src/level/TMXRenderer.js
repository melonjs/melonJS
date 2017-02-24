/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tiled (0.7+) format
 * http://www.mapeditor.org/
 *
 */
(function () {

    // scope global var & constants
    var offsetsStaggerX = [
        {x:   0, y:   0},
        {x: + 1, y: - 1},
        {x: + 1, y:   0},
        {x: + 2, y:   0}
    ];
    var offsetsStaggerY = [
        {x:   0, y:   0},
        {x: - 1, y: + 1},
        {x:   0, y: + 1},
        {x:   0, y: + 2}
    ];

    /**
     * The map renderer base class
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {Number} cols width of the tilemap in tiles
     * @param {Number} rows height of the tilemap in tiles
     * @param {Number} tilewidth width of each tile in pixels
     * @param {Number} tileheight height of each tile in pixels
     */
    me.TMXRenderer = me.Object.extend({
        // constructor
        init: function (cols, rows, tilewidth, tileheight) {
            this.cols = cols;
            this.rows = rows;
            this.tilewidth = tilewidth;
            this.tileheight = tileheight;
        },

        /**
         * return true if the renderer can render the specified layer
         * @name me.TMXRenderer#canRender
         * @public
         * @function
         * @param {me.TMXTileMap|me.TMXLayer} component TMX Map or Layer
         * @return {boolean}
         */
        canRender : function (component) {
            return (
                (this.cols === component.cols) &&
                (this.rows === component.rows) &&
                (this.tilewidth === component.tilewidth) &&
                (this.tileheight === component.tileheight)
            );
        },

        /**
         * return the tile position corresponding to the specified pixel
         * @name me.TMXRenderer#pixelToTileCoords
         * @public
         * @function
         * @param {Number} x X coordinate
         * @param {Number} y Y coordinate
         * @param {me.Vector2d} [vector] an optional vector object where to put the return values
         * @return {me.Vector2d}
         */
        pixelToTileCoords : function (x, y, v) {
            return v;
        },

        /**
         * return the pixel position corresponding of the specified tile
         * @name me.TMXRenderer#tileToPixelCoords
         * @public
         * @function
         * @param {Number} col tile horizontal position
         * @param {Number} row tile vertical position
         * @param {me.Vector2d} [vector] an optional vector object where to put the return values
         * @return {me.Vector2d}
         */
        tileToPixelCoords : function (x, y, v) {
            return v;
        },

        /**
         * return the tile position corresponding for the given X coordinate
         * @name me.TMXRenderer#pixelToTileX
         * @public
         * @function
         * @param {Number} x X coordinate
         * @return {Number} tile vertical position
         */
        pixelToTileX : function (x) {
        },

        /**
         * return the tile position corresponding for the given Y coordinates
         * @name me.TMXRenderer#pixelToTileY
         * @public
         * @function
         * @param {Number} y Y coordinate
         * @return {Number} tile horizontal position
         */
        pixelToTileY : function (y) {
        },

        /**
         * draw the given tile at the specified layer
         * @name me.TMXRenderer#drawTile
         * @public
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
         * @param {Number} x X coordinate where to draw the tile
         * @param {Number} y Y coordinate where to draw the tile
         * @param {me.Tile} tile the tile object to draw
         */
        drawTile : function (renderer, x, y, tile) {
        },

        /**
         * draw the given TMX Layer for the given area
         * @name me.TMXRenderer#drawTileLayer
         * @public
         * @function
         * @param {me.CanvasRenderer|me.WebGLRenderer} renderer a renderer object
         * @param {me.TMXLayer} layer a TMX Layer object
         * @param {me.Rect} rect the area of the layer to draw
         */
        drawTileLayer : function (renderer, layer, rect) {
        }

    });

    /**
     * an Orthogonal Map Renderder
     * @memberOf me
     * @extends me.TMXRenderer
     * @memberOf me
     * @constructor
     * @param {Number} cols width of the tilemap in tiles
     * @param {Number} rows height of the tilemap in tiles
     * @param {Number} tilewidth width of each tile in pixels
     * @param {Number} tileheight height of each tile in pixels
     */
    me.TMXOrthogonalRenderer = me.TMXRenderer.extend({
        /**
         * return true if the renderer can render the specified layer
         * @ignore
         */
        canRender : function (layer) {
            return (
                (layer.orientation === "orthogonal") &&
                this._super(me.TMXRenderer, "canRender", [ layer ])
            );
        },

        /**
         * return the tile position corresponding to the specified pixel
         * @ignore
         */
        pixelToTileCoords : function (x, y, v) {
            var ret = v || new me.Vector2d();
            return ret.set(
                this.pixelToTileX(x),
                this.pixelToTileY(y)
            );
        },

        /**
         * return the tile position corresponding for the given X coordinate
         * @ignore
         */
        pixelToTileX : function (x) {
            return x / this.tilewidth;
        },

        /**
         * return the tile position corresponding for the given Y coordinates
         * @ignore
         */
        pixelToTileY : function (y) {
            return y / this.tileheight;
        },

        /**
         * return the pixel position corresponding of the specified tile
         * @ignore
         */
        tileToPixelCoords : function (x, y, v) {
            var ret = v || new me.Vector2d();
            return ret.set(
                x * this.tilewidth,
                y * this.tileheight
            );
        },

        /**
         * fix the position of Objects to match
         * the way Tiled places them
         * @ignore
         */
        adjustPosition: function (obj) {
            // only adjust position if obj.gid is defined
            if (typeof(obj.gid) === "number") {
                // Tiled objects origin point is "bottom-left" in Tiled,
                // "top-left" in melonJS)
                obj.y -= obj.height;
            }
        },

        /**
         * draw the tile map
         * @ignore
         */
        drawTile : function (renderer, x, y, tmxTile) {
            var tileset = tmxTile.tileset;
            // draw the tile
            tileset.drawTile(
                renderer,
                tileset.tileoffset.x + x * this.tilewidth,
                tileset.tileoffset.y + (y + 1) * this.tileheight - tileset.tileheight,
                tmxTile
            );
        },

        /**
         * draw the tile map
         * @ignore
         */
        drawTileLayer : function (renderer, layer, rect) {
            // get top-left and bottom-right tile position
            var start = this.pixelToTileCoords(
                Math.max(rect.pos.x - (layer.maxTileSize.width - layer.tilewidth), 0),
                Math.max(rect.pos.y - (layer.maxTileSize.height - layer.tileheight), 0),
                me.pool.pull("me.Vector2d")
            ).floorSelf();

            var end = this.pixelToTileCoords(
                rect.pos.x + rect.width + this.tilewidth,
                rect.pos.y + rect.height + this.tileheight,
                me.pool.pull("me.Vector2d")
            ).ceilSelf();

            //ensure we are in the valid tile range
            end.x = end.x > this.cols ? this.cols : end.x;
            end.y = end.y > this.rows ? this.rows : end.y;

            // main drawing loop
            for (var y = start.y; y < end.y; y++) {
                for (var x = start.x; x < end.x; x++) {
                    var tmxTile = layer.layerData[x][y];
                    if (tmxTile) {
                        this.drawTile(renderer, x, y, tmxTile);
                    }
                }
            }

            me.pool.push(start);
            me.pool.push(end);
        }
    });


    /**
     * an Isometric Map Renderder
     * @memberOf me
     * @extends me.TMXRenderer
     * @memberOf me
     * @constructor
     * @param {Number} cols width of the tilemap in tiles
     * @param {Number} rows height of the tilemap in tiles
     * @param {Number} tilewidth width of each tile in pixels
     * @param {Number} tileheight height of each tile in pixels
     */
    me.TMXIsometricRenderer = me.TMXRenderer.extend({
        // constructor
        init: function (cols, rows, tilewidth, tileheight) {
            this._super(me.TMXRenderer, "init", [
                cols,
                rows,
                tilewidth,
                tileheight
            ]);

            this.hTilewidth = tilewidth / 2;
            this.hTileheight = tileheight / 2;
            this.originX = this.rows * this.hTilewidth;
        },

        /**
         * return true if the renderer can render the specified layer
         * @ignore
         */
        canRender : function (layer) {
            return (
                (layer.orientation === "isometric") &&
                this._super(me.TMXRenderer, "canRender", [ layer ])
            );
        },

        /**
         * return the tile position corresponding to the specified pixel
         * @ignore
         */
        pixelToTileCoords : function (x, y, v) {
            var ret = v || new me.Vector2d();
            return ret.set(
                this.pixelToTileX(x, y),
                this.pixelToTileY(y, x)
            );
        },

        /**
         * return the tile position corresponding for the given X coordinate
         * @ignore
         */
        pixelToTileX : function (x, y) {
            return (y / this.tileheight) + ((x - this.originX) / this.tilewidth);
        },

        /**
         * return the tile position corresponding for the given Y coordinates
         * @ignore
         */
        pixelToTileY : function (y, x) {
            return (y / this.tileheight) - ((x - this.originX) / this.tilewidth);
        },

        /**
         * return the pixel position corresponding of the specified tile
         * @ignore
         */
        tileToPixelCoords : function (x, y, v) {
            var ret = v || new me.Vector2d();
            return ret.set(
                (x - y) * this.hTilewidth + this.originX,
                (x + y) * this.hTileheight
            );
        },

        /**
         * fix the position of Objects to match
         * the way Tiled places them
         * @ignore
         */
        adjustPosition: function (obj) {
            var tileX = obj.x / this.hTilewidth;
            var tileY = obj.y / this.tileheight;
            var isoPos = me.pool.pull("me.Vector2d");

            this.tileToPixelCoords(tileX, tileY, isoPos);

            obj.x = isoPos.x;
            obj.y = isoPos.y;

            me.pool.push(isoPos);
        },

        /**
         * draw the tile map
         * @ignore
         */
        drawTile : function (renderer, x, y, tmxTile) {
            var tileset = tmxTile.tileset;
            // draw the tile
            tileset.drawTile(
                renderer,
                ((this.cols - 1) * tileset.tilewidth + (x - y) * tileset.tilewidth >> 1),
                (-tileset.tilewidth + (x + y) * tileset.tileheight >> 2),
                tmxTile
            );
        },

        /**
         * draw the tile map
         * @ignore
         */
        drawTileLayer : function (renderer, layer, rect) {
            // cache a couple of useful references
            var tileset = layer.tileset;
            var offset  = tileset.tileoffset;

            // get top-left and bottom-right tile position
            var rowItr = this.pixelToTileCoords(
                rect.pos.x - tileset.tilewidth,
                rect.pos.y - tileset.tileheight,
                me.pool.pull("me.Vector2d")
            ).floorSelf();
            var TileEnd = this.pixelToTileCoords(
                rect.pos.x + rect.width + tileset.tilewidth,
                rect.pos.y + rect.height + tileset.tileheight,
                me.pool.pull("me.Vector2d")
            ).ceilSelf();

            var rectEnd = this.tileToPixelCoords(TileEnd.x, TileEnd.y, me.pool.pull("me.Vector2d"));

            // Determine the tile and pixel coordinates to start at
            var startPos = this.tileToPixelCoords(rowItr.x, rowItr.y, me.pool.pull("me.Vector2d"));
            startPos.x -= this.hTilewidth;
            startPos.y += this.tileheight;

            /* Determine in which half of the tile the top-left corner of the area we
             * need to draw is. If we're in the upper half, we need to start one row
             * up due to those tiles being visible as well. How we go up one row
             * depends on whether we're in the left or right half of the tile.
             */
            var inUpperHalf = startPos.y - rect.pos.y > this.hTileheight;
            var inLeftHalf  = rect.pos.x - startPos.x < this.hTilewidth;

            if (inUpperHalf) {
                if (inLeftHalf) {
                    rowItr.x--;
                    startPos.x -= this.hTilewidth;
                }
                else {
                    rowItr.y--;
                    startPos.x += this.hTilewidth;
                }
                startPos.y -= this.hTileheight;
            }

            // Determine whether the current row is shifted half a tile to the right
            var shifted = inUpperHalf ^ inLeftHalf;

            // initialize the columItr vector
            var columnItr = rowItr.clone();

            // main drawing loop
            for (var y = startPos.y * 2; y - this.tileheight * 2 < rectEnd.y * 2; y += this.tileheight) {
                columnItr.setV(rowItr);
                for (var x = startPos.x; x < rectEnd.x; x += this.tilewidth) {
                    //check if it's valid tile, if so render
                    if (
                        (columnItr.x >= 0) &&
                        (columnItr.y >= 0) &&
                        (columnItr.x < this.cols) &&
                        (columnItr.y < this.rows)
                    ) {
                        var tmxTile = layer.layerData[columnItr.x][columnItr.y];
                        if (tmxTile) {
                            tileset = tmxTile.tileset;
                            // offset could be different per tileset
                            offset  = tileset.tileoffset;
                            // draw our tile
                            tileset.drawTile(
                                renderer,
                                offset.x + x,
                                offset.y + y / 2 - tileset.tileheight,
                                tmxTile
                            );
                        }
                    }
                    // Advance to the next column
                    columnItr.x++;
                    columnItr.y--;
                }

                // Advance to the next row
                if (!shifted) {
                    rowItr.x++;
                    startPos.x += this.hTilewidth;
                    shifted = true;
                }
                else {
                    rowItr.y++;
                    startPos.x -= this.hTilewidth;
                    shifted = false;
                }
            }

            me.pool.push(rowItr);
            me.pool.push(TileEnd);
            me.pool.push(rectEnd);
            me.pool.push(startPos);
        }
    });


    /**
     * an Hexagonal Map Renderder
     * @memberOf me
     * @extends me.TMXRenderer
     * @memberOf me
     * @constructor
     * @param {Number} cols width of the tilemap in tiles
     * @param {Number} rows height of the tilemap in tiles
     * @param {Number} tilewidth width of each tile in pixels
     * @param {Number} tileheight height of each tile in pixels
     */
    me.TMXHexagonalRenderer = me.TMXRenderer.extend({
        // constructor
        init: function (cols, rows, tilewidth, tileheight, hexsidelength, staggeraxis, staggerindex) {
            this._super(me.TMXRenderer, "init", [
                cols,
                rows,
                tilewidth,
                tileheight
            ]);

            this.hexsidelength = hexsidelength;
            this.staggeraxis = staggeraxis;
            this.staggerindex = staggerindex;

            this.sidelengthx = 0;
            this.sidelengthy = 0;

            if (staggeraxis === "x") {
                this.sidelengthx = hexsidelength;
            }
            else {
                this.sidelengthy = hexsidelength;
            }

            this.sideoffsetx = (this.tilewidth - this.sidelengthx) / 2;
            this.sideoffsety = (this.tileheight - this.sidelengthy) / 2;

            this.columnwidth = this.sideoffsetx + this.sidelengthx;
            this.rowheight = this.sideoffsety + this.sidelengthy;

            this.centers = [
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d(),
                new me.Vector2d()
            ];
        },

        /**
         * return true if the renderer can render the specified layer
         * @ignore
         */
        canRender : function (layer) {
            return (
                (layer.orientation === "hexagonal") &&
                this._super(me.TMXRenderer, "canRender", [ layer ])
            );
        },

        /**
         * return the tile position corresponding to the specified pixel
         * @ignore
         */
        pixelToTileCoords : function (x, y, v) {
            var q, r;
            var ret = v || new me.Vector2d();

            if (this.staggeraxis === "x") { //flat top
                x = x - ((this.staggerindex === "odd") ? this.sideoffsetx : this.tilewidth);
            }
            else { //pointy top
                y = y - ((this.staggerindex === "odd") ? this.sideoffsety : this.tileheight);
            }

            // Start with the coordinates of a grid-aligned tile
            var referencePoint = me.pool.pull("me.Vector2d",
                Math.floor(x / (this.columnwidth * 2)),
                Math.floor((y / (this.rowheight * 2)))
            );

            // Relative x and y position on the base square of the grid-aligned tile
            var rel = me.pool.pull("me.Vector2d",
                x - referencePoint.x * (this.columnwidth * 2),
                y - referencePoint.y * (this.rowheight * 2)
            );

            // Adjust the reference point to the correct tile coordinates
            if (this.staggeraxis === "x") {
                referencePoint.x = referencePoint.x * 2;
                if (this.staggerindex === "even") {
                    ++referencePoint.x;
                }
            }
            else {
                referencePoint.y = referencePoint.y * 2;
                if (this.staggerindex === "even") {
                    ++referencePoint.y;
                }
            }

            // Determine the nearest hexagon tile by the distance to the center
            var left, top, centerX, centerY;
            if (this.staggeraxis === "x") {
                left = this.sidelengthx / 2;
                centerX = left + this.columnwidth;
                centerY = this.tileheight / 2;

                this.centers[0].set(left, centerY);
                this.centers[1].set(centerX, centerY - this.rowheight);
                this.centers[2].set(centerX, centerY + this.rowheight);
                this.centers[3].set(centerX + this.columnwidth, centerY);
            }
            else {
                top = this.sidelengthy / 2;
                centerX = this.tilewidth / 2;
                centerY = top + this.rowheight;

                this.centers[0].set(centerX, top);
                this.centers[1].set(centerX - this.columnwidth, centerY);
                this.centers[2].set(centerX + this.columnwidth, centerY);
                this.centers[3].set(centerX, centerY + this.rowheight);
            }

            var nearest = 0;
            var minDist = Number.MAX_VALUE;
            var dc;
            for (var i = 0; i < 4; ++i) {
                dc = Math.pow(this.centers[i].x - rel.x, 2) + Math.pow(this.centers[i].y - rel.y, 2);
                if (dc < minDist) {
                    minDist = dc;
                    nearest = i;
                }
            }

            var offsets = (this.staggeraxis === "x") ? offsetsStaggerX : offsetsStaggerY;

            q = referencePoint.x + offsets[nearest].x;
            r = referencePoint.y + offsets[nearest].y;

            me.pool.push(referencePoint);
            me.pool.push(rel);

            return ret.set(q, r);
        },

        /**
         * return the tile position corresponding for the given X coordinate
         * @ignore
         */
        pixelToTileX : function (x, y) {
            var ret = me.pool.pull("me.Vector2d");
            this.pixelToTileCoords(x, y, ret);
            me.pool.push(ret);
            return ret.x;
        },

        /**
         * return the tile position corresponding for the given Y coordinates
         * @ignore
         */
        pixelToTileY : function (y, x) {
            var ret = me.pool.pull("me.Vector2d");
            this.pixelToTileCoords(x, y, ret);
            me.pool.push(ret);
            return ret.y;
        },

        /**
         * return the pixel position corresponding of the specified tile
         * @ignore
         */
        tileToPixelCoords : function (q, r, v) {
            var x, y;
            var ret = v || new me.Vector2d();
            if (this.staggeraxis === "x") {
                //flat top
                x = q * this.columnwidth;
                if (this.staggerindex === "odd") {
                    y = r * (this.tileheight + this.sidelengthy);
                    y = y + (this.rowheight * (q & 1));
                }
                else {
                    y = r * (this.tileheight + this.sidelengthy);
                    y = y + (this.rowheight * (1 - (q & 1)));
                }
            }
            else {
                //pointy top
                y = r * this.rowheight;
                if (this.staggerindex === "odd") {
                    x = q * (this.tilewidth + this.sidelengthx);
                    x = x + (this.columnwidth * (r & 1));
                }
                else {
                    x = q * (this.tilewidth + this.sidelengthx);
                    x = x + (this.columnwidth * (1 - (r & 1)));
                }
            }
            return ret.set(x, y);
        },

        /**
         * fix the position of Objects to match
         * the way Tiled places them
         * @ignore
         */
        adjustPosition: function (obj) {
            // only adjust position if obj.gid is defined
            if (typeof(obj.gid) === "number") {
                // Tiled objects origin point is "bottom-left" in Tiled,
                // "top-left" in melonJS)
                obj.y -= obj.height;
            }
        },

        /**
         * draw the tile map
         * @ignore
         */
        drawTile : function (renderer, x, y, tmxTile) {
            var tileset = tmxTile.tileset;
            var point = this.tileToPixelCoords(x, y, me.pool.pull("me.Vector2d"));

            // draw the tile
            tileset.drawTile(
                renderer,
                tileset.tileoffset.x + point.x,
                tileset.tileoffset.y + point.y + (this.tileheight - tileset.tileheight),
                tmxTile
            );

            me.pool.push(point);
        },

        /**
         * draw the tile map
         * @ignore
         */
        drawTileLayer : function (renderer, layer, rect) {
            // get top-left and bottom-right tile position
            var start = this.pixelToTileCoords(
                rect.pos.x,
                rect.pos.y
           ).floorSelf();

            var end = this.pixelToTileCoords(
                rect.pos.x + rect.width + this.tilewidth,
                rect.pos.y + rect.height + this.tileheight
            ).ceilSelf();

            //ensure we are in the valid tile range
            start.x = start.x < 0 ? 0 : start.x;
            start.y = start.y < 0 ? 0 : start.y;
            end.x = end.x > this.cols ? this.cols : end.x;
            end.y = end.y > this.rows ? this.rows : end.y;

            // main drawing loop
            for (var y = start.y; y < end.y; y++) {
                for (var x = start.x; x < end.x; x++) {
                    var tmxTile = layer.layerData[x][y];
                    if (tmxTile) {
                        this.drawTile(renderer, x, y, tmxTile);
                    }
                }
            }
        }
    });

})();
