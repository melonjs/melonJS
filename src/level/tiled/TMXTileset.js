import Vector2d from "./../../math/vector2.js";
import video from "./../../video/video.js";
import utils from "./../../utils/utils.js";
import timer from "./../../system/timer.js";
import loader from "./../../loader/loader.js";

/**
 * @classdesc
 * a TMX Tile Set Object
 * @class TMXTileset
 * @memberOf me
 * @constructor
 * @param {Object} tileset tileset data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#tileset})
 */
export default class TMXTileset {

    constructor(tileset) {
        var i = 0;
        // first gid

        // tile properties (collidable, etc..)
        this.TileProperties = [];

        // hold reference to each tile image
        this.imageCollection = [];

        this.firstgid = this.lastgid = +tileset.firstgid;

        // check if an external tileset is defined
        if (typeof(tileset.source) !== "undefined") {
            var src = tileset.source;
            var ext = utils.file.getExtension(src);
            if (ext === "tsx" || ext === "json") {
                // load the external tileset (TSX/JSON)
                tileset = loader.getTMX(utils.file.getBasename(src));
                if (!tileset) {
                    throw new Error(src + " external TSX/JSON tileset not found");
                }
            }
        }

        this.name = tileset.name;
        this.tilewidth = +tileset.tilewidth;
        this.tileheight = +tileset.tileheight;
        this.spacing = +tileset.spacing || 0;
        this.margin = +tileset.margin || 0;

        // set tile offset properties (if any)
        this.tileoffset = new Vector2d();

        /**
         * Tileset contains animated tiles
         * @public
         * @type Boolean
         * @name me.TMXTileset#isAnimated
         */
        this.isAnimated = false;

        /**
         * true if the tileset is a "Collection of Image" Tileset
         * @public
         * @type Boolean
         * @name me.TMXTileset#isCollection
         */
        this.isCollection = false;

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
                    this.animations.set(tiles[+i].animation[0].tileid, {
                        dt      : 0,
                        idx     : 0,
                        frames  : tiles[+i].animation,
                        cur     : tiles[+i].animation[0]
                    });
                }
                // set tile properties, if any (XML format)
                if ("properties" in tiles[i]) {
                    this.setTileProperty(+i + this.firstgid, tiles[i].properties);
                }
                if ("image" in tiles[i]) {
                    var image = loader.getImage(tiles[i].image);
                    if (!image) {
                        throw new Error("melonJS: '" + tiles[i].image + "' file for tile '" + (+i + this.firstgid) + "' not found!");
                    }
                    this.imageCollection[+i + this.firstgid] = image;
                }
            }
        }

        this.isCollection = this.imageCollection.length > 0;

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

        // if not a tile image collection
        if (this.isCollection === false) {

            // get the global tileset texture
            this.image = loader.getImage(tileset.image);

            if (!this.image) {
                throw new Error("melonJS: '" + tileset.image + "' file for tileset '" + this.name + "' not found!");
            }

            // create a texture atlas for the given tileset
            this.texture = video.renderer.cache.get(this.image, {
                framewidth : this.tilewidth,
                frameheight : this.tileheight,
                margin : this.margin,
                spacing : this.spacing
            });
            this.atlas = this.texture.getAtlas();

            // calculate the number of tiles per horizontal line
            var hTileCount = +tileset.columns || Math.round(this.image.width / (this.tilewidth + this.spacing));
            var vTileCount = Math.round(this.image.height / (this.tileheight + this.spacing));
            if (tileset.tilecount % hTileCount > 0) {
                ++vTileCount;
            }
            // compute the last gid value in the tileset
            this.lastgid = this.firstgid + (((hTileCount * vTileCount) - 1) || 0);
            if (tileset.tilecount && this.lastgid - this.firstgid + 1 !== +tileset.tilecount) {
                console.warn(
                    "Computed tilecount (" + (this.lastgid - this.firstgid + 1) +
                    ") does not match expected tilecount (" + tileset.tilecount + ")"
                );
            }
        }
    }

    /**
     * return the tile image from a "Collection of Image" tileset
     * @name me.TMXTileset#getTileImage
     * @public
     * @function
     * @param {Number} gid
     * @return {Image} corresponding image or undefined
     */
    getTileImage(gid) {
        return this.imageCollection[gid];
    }


    /**
     * set the tile properties
     * @ignore
     * @function
     */
    setTileProperty(gid, prop) {
        // set the given tile id
        this.TileProperties[gid] = prop;
    }

    /**
     * return true if the gid belongs to the tileset
     * @name me.TMXTileset#contains
     * @public
     * @function
     * @param {Number} gid
     * @return {Boolean}
     */
    contains(gid) {
        return gid >= this.firstgid && gid <= this.lastgid;
    }

    /**
     * Get the view (local) tile ID from a GID, with animations applied
     * @name me.TMXTileset#getViewTileId
     * @public
     * @function
     * @param {Number} gid Global tile ID
     * @return {Number} View tile ID
     */
    getViewTileId(gid) {
        var localId = gid - this.firstgid;

        if (this.animations.has(localId)) {
            // return the current corresponding tile id if animated
            return this.animations.get(localId).cur.tileid;
        }

        return localId;
    }

    /**
     * return the properties of the specified tile
     * @name me.TMXTileset#getTileProperties
     * @public
     * @function
     * @param {Number} tileId
     * @return {Object}
     */
    getTileProperties(tileId) {
        return this.TileProperties[tileId];
    }

    // update tile animations
    update(dt) {
        var duration = 0,
            now = timer.getTime(),
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
    }

    // draw the x,y tile
    drawTile(renderer, dx, dy, tmxTile) {

        // check if any transformation is required
        if (tmxTile.flipped) {
            renderer.save();
            // apply the tile current transform
            renderer.translate(dx, dy);
            renderer.transform(tmxTile.currentTransform);
            // reset both values as managed through transform();
            dx = dy = 0;
        }

        // check if the tile has an associated image
        if (this.isCollection === true) {
            // draw the tile
            renderer.drawImage(
                this.imageCollection[tmxTile.tileId],
                0, 0,
                tmxTile.width, tmxTile.height,
                dx, dy,
                tmxTile.width, tmxTile.height
            );
        } else {
            // use the tileset texture
            var offset = this.atlas[this.getViewTileId(tmxTile.tileId)].offset;
            // draw the tile
            renderer.drawImage(
                this.image,
                offset.x, offset.y,
                this.tilewidth, this.tileheight,
                dx, dy,
                this.tilewidth + renderer.uvOffset, this.tileheight + renderer.uvOffset
            );
        }

        if (tmxTile.flipped) {
            // restore the context to the previous state
            renderer.restore();
        }
    }
};
