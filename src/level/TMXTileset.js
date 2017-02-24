/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {

    // bitmask constants to check for flipped & rotated tiles
    var TMX_CLEAR_BIT_MASK = ~(0x80000000 | 0x40000000 | 0x20000000);

    /**
     * a TMX Tile Set Object
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     * @param {Object} tileset tileset JSON definition
     */
    me.TMXTileset = me.Object.extend({
        /**
         * constructor
         * @ignore
         */
        init: function (tileset) {
            var i = 0;
            // first gid

            // tile properties (collidable, etc..)
            this.TileProperties = [];

            this.firstgid = this.lastgid = +tileset.firstgid;

            // check if an external tileset is defined
            if (typeof(tileset.source) !== "undefined") {
                var src = tileset.source;
                var ext = me.utils.getFileExtension(src);
                if (ext === "tsx" || ext === "json") {
                    // load the external tileset (TSX/JSON)
                    tileset = me.loader.getTMX(me.utils.getBasename(src));
                    if (!tileset) {
                        throw new me.Error(src + " external TSX/JSON tileset not found");
                    }
                }
            }

            this.name = tileset.name;
            this.tilewidth = +tileset.tilewidth;
            this.tileheight = +tileset.tileheight;
            this.spacing = +tileset.spacing || 0;
            this.margin = +tileset.margin || 0;

            // set tile offset properties (if any)
            this.tileoffset = new me.Vector2d();

            /**
             * Tileset contains animated tiles
             * @public
             * @type Boolean
             * @name me.TMXTileset#isAnimated
             */
            this.isAnimated = false;

            /**
             * Tileset animations
             * @private
             * @type Map
             * @name me.TMXTileset#animations
             */
            this.animations = new Map();

            /**
             * Remember the last update timestamp to prevent too many animation updates
             * @private
             * @type Map
             * @name me.TMXTileset#_lastUpdate
             */
            this._lastUpdate = 0;

            var tiles = tileset.tiles;
            for (i in tiles) {
                if (tiles.hasOwnProperty(i)) {
                    if ("animation" in tiles[i]) {
                        this.isAnimated = true;
                        this.animations.set(+i + this.firstgid, {
                            dt      : 0,
                            idx     : 0,
                            frames  : tiles[i].animation,
                            cur     : tiles[i].animation[0]
                        });
                    }
                    // set tile properties, if any (XML format)
                    if ("properties" in tiles[i]) {
                        this.setTileProperty(+i + this.firstgid, tiles[i].properties);
                    }
                }
            }

            var offset = tileset.tileoffset;
            if (offset) {
                this.tileoffset.x = +offset.x;
                this.tileoffset.y = +offset.y;
            }

            // set tile properties, if any (JSON format)
            var tileInfo = tileset.tileproperties;
            if (tileInfo) {
                for (i in tileInfo) {
                    if (tileInfo.hasOwnProperty(i)) {
                        this.setTileProperty(+i + this.firstgid, tileInfo[i]);
                    }
                }
            }

            this.image = me.utils.getImage(tileset.image);
            if (!this.image) {
                throw new me.TMXTileset.Error("melonJS: '" + tileset.image + "' file for tileset '" + this.name + "' not found!");
            }

            // create a texture atlas for the given tileset
            this.texture = me.video.renderer.cache.get(this.image, {
                framewidth : this.tilewidth,
                frameheight : this.tileheight,
                margin : this.margin,
                spacing : this.spacing
            });
            this.atlas = this.texture.getAtlas();

            // calculate the number of tiles per horizontal line
            var hTileCount = +tileset.columns || ~~(this.image.width / (this.tilewidth + this.spacing));
            var vTileCount = ~~(this.image.height / (this.tileheight + this.spacing));
            // compute the last gid value in the tileset
            this.lastgid = this.firstgid + (((hTileCount * vTileCount) - 1) || 0);
            if (tileset.tilecount && this.lastgid - this.firstgid + 1 !== +tileset.tilecount) {
                console.warn(
                    "Computed tilecount (" + (this.lastgid - this.firstgid + 1) +
                    ") does not match expected tilecount (" + tileset.tilecount + ")"
                );
            }
        },

        /**
         * set the tile properties
         * @ignore
         * @function
         */
        setTileProperty : function (gid, prop) {
            // set the given tile id
            this.TileProperties[gid] = prop;
        },

        /**
         * return true if the gid belongs to the tileset
         * @name me.TMXTileset#contains
         * @public
         * @function
         * @param {Number} gid
         * @return {Boolean}
         */
        contains : function (gid) {
            return gid >= this.firstgid && gid <= this.lastgid;
        },

        /**
         * Get the view (local) tile ID from a GID, with animations applied
         * @name me.TMXTileset#getViewTileId
         * @public
         * @function
         * @param {Number} gid Global tile ID
         * @return {Number} View tile ID
         */
        getViewTileId : function (gid) {
            if (this.animations.has(gid)) {
                // apply animations
                gid = this.animations.get(gid).cur.tileid;
            }
            else {
                // get the local tileset id
                gid -= this.firstgid;
            }

            return gid;
        },

        /**
         * return the properties of the specified tile
         * @name me.TMXTileset#getTileProperties
         * @public
         * @function
         * @param {Number} tileId
         * @return {Object}
         */
        getTileProperties: function (tileId) {
            return this.TileProperties[tileId];
        },

        // update tile animations
        update : function (dt) {
            var duration = 0,
                now = me.timer.getTime(),
                result = false;

            if (this._lastUpdate !== now) {
                this._lastUpdate = now;

                this.animations.forEach(function (anim) {
                    anim.dt += dt;
                    duration = anim.cur.duration;
                    while (anim.dt >= duration) {
                        anim.dt -= duration;
                        anim.idx = (anim.idx + 1) % anim.frames.length;
                        anim.cur = anim.frames[anim.idx];
                        duration = anim.cur.duration;
                        result = true;
                    }
                });
            }

            return result;
        },

        // draw the x,y tile
        drawTile : function (renderer, dx, dy, tmxTile) {
            // check if any transformation is required
            if (tmxTile.flipped) {
                renderer.save();
                // apply the tile current transform
                renderer.translate(dx, dy);
                renderer.transform(tmxTile.currentTransform);
                // reset both values as managed through transform();
                dx = dy = 0;
            }

            var offset = this.atlas[this.getViewTileId(tmxTile.tileId)].offset;

            // draw the tile
            renderer.drawImage(
                this.image,
                offset.x, offset.y,
                this.tilewidth, this.tileheight,
                dx, dy,
                this.tilewidth + renderer.uvOffset, this.tileheight + renderer.uvOffset
            );

            if (tmxTile.flipped)  {
                // restore the context to the previous state
                renderer.restore();
            }
        }
    });

    /**
     * an object containing all tileset
     * @class
     * @memberOf me
     * @constructor
     */
    me.TMXTilesetGroup = me.Object.extend({
        /**
         * constructor
         * @ignore
         */
        init: function () {
            this.tilesets = [];
            this.length = 0;
        },

        /**
         * add a tileset to the tileset group
         * @name me.TMXTilesetGroup#add
         * @public
         * @function
         * @param  {me.TMXTileset} tileset
         */
        add : function (tileset) {
            this.tilesets.push(tileset);
            this.length++;
        },

        /**
         * return the tileset at the specified index
         * @name me.TMXTilesetGroup#getTilesetByIndex
         * @public
         * @function
         * @param {Number} i
         * @return {me.TMXTileset} corresponding tileset
         */
        getTilesetByIndex : function (i) {
            return this.tilesets[i];
        },

        /**
         * return the tileset corresponding to the specified id <br>
         * will throw an exception if no matching tileset is found
         * @name me.TMXTilesetGroup#getTilesetByGid
         * @public
         * @function
         * @param {Number} gid
         * @return {me.TMXTileset} corresponding tileset
         */
        getTilesetByGid : function (gid) {
            var invalidRange = -1;

            // clear the gid of all flip/rotation flags
            gid &= TMX_CLEAR_BIT_MASK;

            // cycle through all tilesets
            for (var i = 0, len = this.tilesets.length; i < len; i++) {
                // return the corresponding tileset if matching
                if (this.tilesets[i].contains(gid)) {
                    return this.tilesets[i];
                }
                // typically indicates a layer with no asset loaded (collision?)
                if (this.tilesets[i].firstgid === this.tilesets[i].lastgid &&
                    gid >= this.tilesets[i].firstgid) {
                    // store the id if the [firstgid .. lastgid] is invalid
                    invalidRange = i;
                }
            }
            // return the tileset with the invalid range
            if (invalidRange !== -1) {
                return this.tilesets[invalidRange];
            }
            else {
                throw new me.Error("no matching tileset found for gid " + gid);
            }
        }
    });

    /**
     * Base class for TMXTileset exception handling.
     * @name Error
     * @class
     * @memberOf me.TMXTileset
     * @constructor
     * @param {String} msg Error message.
     */
    me.TMXTileset.Error = me.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.TMXTileset.Error";
        }
    });

})();
