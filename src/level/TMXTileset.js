/*
 * MelonJS Game Engine
 * (C) 2011 - 2015 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function (TMXConstants) {

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
             * @type Map
             * @name me.TMXTileset#animations
             */
            this.animations = new Map();

            var tiles = tileset.tiles;
            if (typeof(tiles) !== "undefined") {
                // native JSON format
                for (i in tiles) {
                    if (tiles.hasOwnProperty(i) && ("animation" in tiles[i])) {
                        this.isAnimated = true;
                        this.animations.set(+i + this.firstgid, {
                            dt      : 0,
                            idx     : 0,
                            frames  : tiles[i].animation,
                            cur     : tiles[i].animation[0]
                        });
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
                        this.animations.set(tileID, {
                            dt      : 0,
                            idx     : 0,
                            frames  : tileInfo[i].animation.frame,
                            cur     : tileInfo[i].animation.frame[0]
                        });
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
                throw new me.TMXTileset.Error("melonJS: '" + imagesrc + "' file for tileset '" + this.name + "' not found!");
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
            var hTileCount = ~~((this.image.width - this.margin) / (this.tilewidth + this.spacing));
            var vTileCount = ~~((this.image.height - this.margin) / (this.tileheight + this.spacing));
            // compute the last gid value in the tileset
            this.lastgid = this.firstgid + (((hTileCount * vTileCount) - 1) || 0);

            // check if transparency is defined for a specific color
            var transparency = tileset[TMXConstants.TMX_TAG_TRANS] || tileset[TMXConstants.TMX_TAG_IMAGE][TMXConstants.TMX_TAG_TRANS];
            // set Color Key for transparency if needed
            if (typeof(transparency) !== "undefined") {
                // applyRGB Filter (return a context object)
                this.image = me.video.renderer.applyRGBFilter(this.image, "transparent", transparency.toUpperCase()).canvas;
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

        // update tile animations
        update : function (dt) {
            var duration = 0,
                result = false;

            this.animations.forEach(function (anim) {
                anim.dt += dt;
                duration = anim.cur.duration;
                if (anim.dt >= duration) {
                    anim.dt -= duration;
                    anim.idx = (anim.idx + 1) % anim.frames.length;
                    anim.cur = anim.frames[anim.idx];
                    result = true;
                }
            });

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
            if (this.animations.has(tileid)) {
                tileid = this.animations.get(tileid).cur.tileid;
            }
            else {
                // get the local tileset id
                tileid -= this.firstgid;
            }
            
            var offset = this.atlas[tileid].offset;
            
            // draw the tile
            renderer.drawImage(
                this.image,
                offset.x, offset.y,
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
    
    /**
     * Base class for TMXTileset exception handling.
     * @name Error
     * @class
     * @memberOf me.TMXTileset
     * @constructor
     * @param {String} msg Error message.
     */
    me.TMXTileset.Error = me.Error.extend({
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.TMXTileset.Error";
        }
    });
    
})(me.TMXConstants);
