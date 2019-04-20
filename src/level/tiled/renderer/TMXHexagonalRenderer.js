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
     * an Hexagonal Map Renderder
     * @memberOf me
     * @extends me.TMXRenderer
     * @memberOf me
     * @constructor
     * @param {me.TMXTileMap} map the TMX map
     */
    me.TMXHexagonalRenderer = me.TMXRenderer.extend({
        // constructor
        init: function (map) {
            this._super(me.TMXRenderer, "init", [
                map.cols,
                map.rows,
                map.tilewidth,
                map.tileheight
            ]);

            this.hexsidelength = map.hexsidelength || 0;
            this.staggerX = map.staggeraxis === "x";
            this.staggerEven = map.staggerindex === "even";

            this.sidelengthx = 0;
            this.sidelengthy = 0;

            if (map.orientation === "hexagonal") {
                if (this.staggerX) {
                    this.sidelengthx = this.hexsidelength;
                }
                else {
                    this.sidelengthy = this.hexsidelength;
                }
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
         * @ignore
         */
        doStaggerX  : function (x) {
            return this.staggerX && (x & 1) ^ this.staggerEven;
        },

        /**
         * @ignore
         */
        doStaggerY : function (y) {
            return !this.staggerX && (y & 1) ^ this.staggerEven;
        },

        /**
         * return the tile position corresponding to the specified pixel
         * @ignore
         */
        pixelToTileCoords : function (x, y, v) {
            var q, r;
            var ret = v || new me.Vector2d();

            if (this.staggerX) { //flat top
                x = x - ((!this.staggerEven) ? this.sideoffsetx : this.tilewidth);
            }
            else { //pointy top
                y = y - ((!this.staggerEven) ? this.sideoffsety : this.tileheight);
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
            if (this.staggerX) {
                referencePoint.x = referencePoint.x * 2;
                if (this.staggerEven) {
                    ++referencePoint.x;
                }
            }
            else {
                referencePoint.y = referencePoint.y * 2;
                if (this.staggerEven) {
                    ++referencePoint.y;
                }
            }

            // Determine the nearest hexagon tile by the distance to the center
            var left, top, centerX, centerY;
            if (this.staggerX) {
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

            var offsets = (this.staggerX) ? offsetsStaggerX : offsetsStaggerY;

            q = referencePoint.x + offsets[nearest].x;
            r = referencePoint.y + offsets[nearest].y;

            me.pool.push(referencePoint);
            me.pool.push(rel);

            return ret.set(q, r);
        },

        /**
         * return the pixel position corresponding of the specified tile
         * @ignore
         */
        tileToPixelCoords : function (q, r, v) {
            var x, y;
            var ret = v || new me.Vector2d();
            if (this.staggerX) {
                //flat top
                x = q * this.columnwidth;
                if (!this.staggerEven) {
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
                if (!this.staggerEven) {
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
            var x, y, tile;

            // get top-left and bottom-right tile position
            var start = this.pixelToTileCoords(
                rect.pos.x,
                rect.pos.y,
                me.pool.pull("me.Vector2d")
           ).floorSelf();

            var end = this.pixelToTileCoords(
                rect.pos.x + rect.width + this.tilewidth,
                rect.pos.y + rect.height + this.tileheight,
                me.pool.pull("me.Vector2d")
            ).ceilSelf();

            //ensure we are in the valid tile range
            start.x = start.x < 0 ? 0 : start.x;
            start.y = start.y < 0 ? 0 : start.y;
            end.x = end.x > this.cols ? this.cols : end.x;
            end.y = end.y > this.rows ? this.rows : end.y;

            if (this.staggerX) {
                //TOFO : https://github.com/melonjs/melonJS/issues/966
                // main drawing loop
                for (y = start.y; y < end.y; y++) {
                    for (x = start.x; x < end.x; x++) {
                        tile = layer.layerData[x][y];
                        if (tile) {
                            this.drawTile(renderer, x, y, tile);
                        }
                    }
                }
            } else {
                // main drawing loop
                for (y = start.y; y < end.y; y++) {
                    for (x = start.x; x < end.x; x++) {
                        tile = layer.layerData[x][y];
                        if (tile) {
                            this.drawTile(renderer, x, y, tile);
                        }
                    }
                }
            }
            me.pool.push(start);
            me.pool.push(end);
        }
    });

})();
