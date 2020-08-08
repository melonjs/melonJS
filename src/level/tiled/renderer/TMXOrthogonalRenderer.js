(function () {

    /**
     * an Orthogonal Map Renderder
     * @memberOf me
     * @extends me.TMXRenderer
     * @memberOf me
     * @constructor
     * @param {me.TMXTileMap} map the TMX map
     */
    me.TMXOrthogonalRenderer = me.TMXRenderer.extend({
        // constructor
        init: function (map) {
            this._super(me.TMXRenderer, "init", [
                map.cols,
                map.rows,
                map.tilewidth,
                map.tileheight
            ]);
        },

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
                x / this.tilewidth,
                y / this.tileheight
            );
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
            var incX = 1, incY = 1;

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

            switch (layer.renderorder) {
                case "right-up" :
                    // swapping start.y and end.y
                    end.y = start.y + (start.y = end.y) - end.y;
                    incY = -1;
                    break;
                case "left-down" :
                    // swapping start.x and end.x
                    end.x = start.x + (start.x = end.x) - end.x;
                    incX = -1;
                    break;
                case "left-up" :
                    // swapping start.x and end.x
                    end.x = start.x + (start.x = end.x) - end.x;
                    // swapping start.y and end.y
                    end.y = start.y + (start.y = end.y) - end.y;
                    incX = -1;
                    incY = -1;
                    break;
                default: // right-down
                    break;
            }

            // main drawing loop
            for (var y = start.y; y !== end.y; y+= incY) {
                for (var x = start.x; x !== end.x; x+= incX) {
                    var tmxTile = layer.cellAt(x, y, false);
                    if (tmxTile) {
                        this.drawTile(renderer, x, y, tmxTile);
                    }
                }
            }

            me.pool.push(start);
            me.pool.push(end);
        }
    });

})();
