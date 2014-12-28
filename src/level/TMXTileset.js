/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function (TMXConstants) {
    /*
     * Tileset Management
     */

    // bitmask constants to check for flipped & rotated tiles
    var FlippedHorizontallyFlag    = 0x80000000;
    var FlippedVerticallyFlag      = 0x40000000;
    var FlippedAntiDiagonallyFlag  = 0x20000000;

    /**
     * a basic tile object
     * @class
     * @extends me.Rect
     * @memberOf me
     * @constructor
     * @param {Number} x x index of the Tile in the map
     * @param {Number} y y index of the Tile in the map
     * @param {Number} w Tile width
     * @param {Number} h Tile height
     * @param {Number} tileId tileId
     */
    me.Tile = me.Rect.extend({
        /** @ignore */
        init : function (x, y, w, h, gid) {
            /**
             * tileset
             * @public
             * @type me.TMXTileset
             * @name me.Tile#tileset
             */
            this.tileset = null;

            /**
             * the tile transformation matrix (if defined)
             * @ignore
             */
            this.transform = null;
            this._super(me.Rect, "init", [x * w, y * h, w, h]);

            // Tile col / row pos
            this.col = x;
            this.row = y;

            /**
             * tileId
             * @public
             * @type int
             * @name me.Tile#tileId
             */
            this.tileId = gid;
            /**
             * True if the tile is flipped horizontally<br>
             * @public
             * @type Boolean
             * @name me.Tile#flipX
             */
            this.flippedX  = (this.tileId & FlippedHorizontallyFlag) !== 0;
            /**
             * True if the tile is flipped vertically<br>
             * @public
             * @type Boolean
             * @name me.Tile#flippedY
             */
            this.flippedY  = (this.tileId & FlippedVerticallyFlag) !== 0;
            /**
             * True if the tile is flipped anti-diagonally<br>
             * @public
             * @type Boolean
             * @name me.Tile#flippedAD
             */
            this.flippedAD = (this.tileId & FlippedAntiDiagonallyFlag) !== 0;

            /**
             * Global flag that indicates if the tile is flipped<br>
             * @public
             * @type Boolean
             * @name me.Tile#flipped
             */
            this.flipped = this.flippedX || this.flippedY || this.flippedAD;
            // create a transformation matrix if required
            if (this.flipped === true) {
                this.createTransform();
            }

            // clear out the flags and set the tileId
            this.tileId &= ~(FlippedHorizontallyFlag | FlippedVerticallyFlag | FlippedAntiDiagonallyFlag);
        },

        /**
         * create a transformation matrix for this tile
         * @ignore
         */
        createTransform : function () {
            if (this.transform === null) {
                this.transform = new me.Matrix2d();
            }
            // reset the matrix (in case it was already defined)
            this.transform.identity();
            var a = this.transform.val;
            if (this.flippedAD) {
                // Use shearing to swap the X/Y axis
                this.transform.set(
                    0, 1, 0,
                    1, 0, 0,
                    0, 0, 1
                );
                this.transform.translate(0, this.height - this.width);
            }
            if (this.flippedX) {
                a[0] *= -1;
                a[3] *= -1;
                this.transform.translate(-(this.flippedAD ? this.height : this.width), 0);

            }
            if (this.flippedY) {
                a[1] *= -1;
                a[4] *= -1;
                this.transform.translate(0, -(this.flippedAD ? this.width : this.height));
            }
        }
    });

    /**
     * a TMX Tile Set Object
     * @class
     * @memberOf me
     * @constructor
     */
    me.TMXTileset = Object.extend({
        // constructor
        init: function (tileset) {
            var i = 0;
            // first gid

            // tile properties (collidable, etc..)
            this.TileProperties = [];

            // a cache for offset value
            this.tileXOffset = [];
            this.tileYOffset = [];
            this.firstgid = this.lastgid = +tileset[TMXConstants.TMX_TAG_FIRSTGID];
            var src = tileset[TMXConstants.TMX_TAG_SOURCE];
            if (src && me.utils.getFileExtension(src).toLowerCase() === "tsx") {
                // load TSX
                src = me.utils.getBasename(src);
                // replace tileset with a local variable
                tileset = me.loader.getTMX(src).tileset;

                if (!tileset) {
                    throw new me.Error(src + " TSX tileset not found");
                }
                // normally tileset shoudld directly contains the required
                //information : UNTESTED as I did not find how to generate a JSON TSX file
            }

            this.name = tileset[TMXConstants.TMX_TAG_NAME];
            this.tilewidth = +tileset[TMXConstants.TMX_TAG_TILEWIDTH];
            this.tileheight = +tileset[TMXConstants.TMX_TAG_TILEHEIGHT];
            this.spacing = +tileset[TMXConstants.TMX_TAG_SPACING] || 0;
            this.margin = +tileset[TMXConstants.TMX_TAG_MARGIN] || 0;

            // set tile offset properties (if any)
            this.tileoffset = new me.Vector2d(0, 0);

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
             * @type Object
             * @name me.TMXTileset#animations
             */
            this.animations = {};

            var tiles = tileset.tiles;
            if (typeof(tiles) !== "undefined") {
                // native JSON format
                for (i in tiles) {
                    if (tiles.hasOwnProperty(i) && ("animation" in tiles[i])) {
                        this.isAnimated = true;
                        this.animations[+i + this.firstgid] = {
                            dt      : 0,
                            idx     : 0,
                            frames  : tiles[i].animation,
                            cur     : tiles[i].animation[0]
                        };
                    }
                }
            }

            var offset = tileset[TMXConstants.TMX_TAG_TILEOFFSET];
            if (offset) {
                this.tileoffset.x = +offset[TMXConstants.TMX_TAG_X];
                this.tileoffset.y = +offset[TMXConstants.TMX_TAG_Y];
            }

            // set tile properties, if any
            var tileInfo = tileset.tileproperties;

            if (tileInfo) {
                // native JSON format
                for (i in tileInfo) {
                    if (tileInfo.hasOwnProperty(i)) {
                        this.setTileProperty(i + this.firstgid, tileInfo[i]);
                    }
                }
            }
            else if (tileset[TMXConstants.TMX_TAG_TILE]) {
                // converted XML format
                tileInfo = tileset[TMXConstants.TMX_TAG_TILE];
                if (!Array.isArray(tileInfo)) {
                    tileInfo = [ tileInfo ];
                }

                // iterate it
                for (i = 0; i < tileInfo.length; i++) {
                    var tileID = +tileInfo[i][TMXConstants.TMX_TAG_ID] + this.firstgid;
                    var prop = {};
                    me.TMXUtils.applyTMXProperties(prop, tileInfo[i]);
                    //apply tiled defined properties
                    this.setTileProperty(tileID, prop);

                    // Get animations
                    if ("animation" in tileInfo[i]) {
                        this.isAnimated = true;
                        this.animations[tileID] = {
                            dt      : 0,
                            idx     : 0,
                            frames  : tileInfo[i].animation.frame,
                            cur     : tileInfo[i].animation.frame[0]
                        };
                    }
                }
            }

            // check for the texture corresponding image
            // manage inconstency between XML and JSON format
            var imagesrc = (
                typeof(tileset[TMXConstants.TMX_TAG_IMAGE]) === "string" ?
                tileset[TMXConstants.TMX_TAG_IMAGE] : tileset[TMXConstants.TMX_TAG_IMAGE].source
            );
            // extract base name
            imagesrc = me.utils.getBasename(imagesrc);
            this.image = imagesrc ? me.loader.getImage(imagesrc) : null;

            if (!this.image) {
                console.log("melonJS: '" + imagesrc + "' file for tileset '" + this.name + "' not found!");
            }
            else {
                // number of tiles per horizontal line
                this.hTileCount = ~~((this.image.width - this.margin) / (this.tilewidth + this.spacing));
                this.vTileCount = ~~((this.image.height - this.margin) / (this.tileheight + this.spacing));
                // compute the last gid value in the tileset
                this.lastgid = this.firstgid + (((this.hTileCount * this.vTileCount) - 1) || 0);

                // check if transparency is defined for a specific color
                var transparency = tileset[TMXConstants.TMX_TAG_TRANS] || tileset[TMXConstants.TMX_TAG_IMAGE][TMXConstants.TMX_TAG_TRANS];
                // set Color Key for transparency if needed
                if (typeof(transparency) !== "undefined") {
                    // applyRGB Filter (return a context object)
                    this.image = me.video.renderer.applyRGBFilter(this.image, "transparent", transparency.toUpperCase()).canvas;
                }
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

        //return an Image Object with the specified tile
        getTileImage : function (tmxTile) {
            // create a new image object
            var _context = me.video.renderer.getContext2d(
                    me.video.createCanvas(this.tilewidth, this.tileheight)
            );
            this.drawTile(_context, 0, 0, tmxTile);
            return _context.canvas;
        },

        // e.g. getTileProperty (gid)
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

        /**
         * return the x offset of the specified tile in the tileset image
         * @ignore
         */
        getTileOffsetX : function (tileId) {
            var offset = this.tileXOffset[tileId];
            if (typeof(offset) === "undefined") {
                offset = this.tileXOffset[tileId] = this.margin + (this.spacing + this.tilewidth)  * (tileId % this.hTileCount);
            }
            return offset;
        },

        /**
         * return the y offset of the specified tile in the tileset image
         * @ignore
         */
        getTileOffsetY : function (tileId) {
            var offset = this.tileYOffset[tileId];
            if (typeof(offset) === "undefined") {
                offset = this.tileYOffset[tileId] = this.margin + (this.spacing + this.tileheight)  * ~~(tileId / this.hTileCount);
            }
            return offset;
        },

        // update tile animations
        update : function (dt) {
            var anim = null,
                duration = 0,
                result = false;

            for (var i in this.animations) {
                if (this.animations.hasOwnProperty(i)) {
                    anim = this.animations[i];

                    anim.dt += dt;
                    duration = anim.cur.duration;
                    if (anim.dt >= duration) {
                        anim.dt -= duration;
                        anim.idx = (anim.idx + 1) % anim.frames.length;
                        anim.cur = anim.frames[anim.idx];
                        result = true;
                    }
                }
            }

            return result;
        },

        // draw the x,y tile
        drawTile : function (renderer, dx, dy, tmxTile) {
            var tileid = tmxTile.tileId;

            // check if any transformation is required
            if (tmxTile.flipped) {
                renderer.save();
                // apply the tile current transform
                renderer.translate(dx, dy);
                renderer.transform(tmxTile.transform);
                // reset both values as managed through transform();
                dx = dy = 0;
            }

            // apply animations
            if (tileid in this.animations) {
                tileid = this.animations[tileid].cur.tileid;
            }
            else {
                // get the local tileset id
                tileid -= this.firstgid;
            }

            // draw the tile
            renderer.drawImage(
                this.image,
                this.getTileOffsetX(tileid), this.getTileOffsetY(tileid),
                this.tilewidth, this.tileheight,
                dx, dy,
                this.tilewidth, this.tileheight
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
    me.TMXTilesetGroup = Object.extend({
        // constructor
        init: function () {
            this.tilesets = [];
        },

        //add a tileset to the tileset group
        add : function (tileset) {
            this.tilesets.push(tileset);
        },

        //return the tileset at the specified index
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
})(me.TMXConstants);
