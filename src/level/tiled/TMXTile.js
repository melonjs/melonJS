import Matrix2d from "./../../math/matrix2.js";
import Sprite from "./../../renderable/sprite.js";
import Bounds from "./../../physics/bounds.js";

// bitmask constants to check for flipped & rotated tiles
var TMX_FLIP_H          = 0x80000000,
    TMX_FLIP_V          = 0x40000000,
    TMX_FLIP_AD         = 0x20000000,
    TMX_CLEAR_BIT_MASK  = ~(0x80000000 | 0x40000000 | 0x20000000);

/**
 * a basic tile object
 * @class
 * @augments me.Bounds
 * @memberof me
 * @param {number} x x index of the Tile in the map
 * @param {number} y y index of the Tile in the map
 * @param {number} gid tile gid
 * @param {me.TMXTileset} tileset the corresponding tileset object
 */
class Tile extends Bounds {

    constructor(x, y, gid, tileset) {
        var width, height;

        // call the parent constructor
        super();

        // determine the tile size
        if (tileset.isCollection) {
            var image = tileset.getTileImage(gid & TMX_CLEAR_BIT_MASK);
            width = image.width;
            height = image.height;
        } else {
            width = tileset.tilewidth;
            height = tileset.tileheight;
        }

        this.setMinMax(0, 0, width, height);

        /**
         * tileset
         * @public
         * @type {me.TMXTileset}
         * @name me.Tile#tileset
         */
        this.tileset = tileset;

        /**
         * the tile transformation matrix (if defined)
         * @ignore
         */
        this.currentTransform = null;

        // Tile col / row pos
        this.col = x;
        this.row = y;

        /**
         * tileId
         * @public
         * @type {number}
         * @name me.Tile#tileId
         */
        this.tileId = gid;
        /**
         * True if the tile is flipped horizontally<br>
         * @public
         * @type {boolean}
         * @name me.Tile#flipX
         */
        this.flippedX  = (this.tileId & TMX_FLIP_H) !== 0;
        /**
         * True if the tile is flipped vertically<br>
         * @public
         * @type {boolean}
         * @name me.Tile#flippedY
         */
        this.flippedY  = (this.tileId & TMX_FLIP_V) !== 0;
        /**
         * True if the tile is flipped anti-diagonally<br>
         * @public
         * @type {boolean}
         * @name me.Tile#flippedAD
         */
        this.flippedAD = (this.tileId & TMX_FLIP_AD) !== 0;

        /**
         * Global flag that indicates if the tile is flipped<br>
         * @public
         * @type {boolean}
         * @name me.Tile#flipped
         */
        this.flipped = this.flippedX || this.flippedY || this.flippedAD;

        // create and apply transformation matrix if required
        if (this.flipped === true) {
            if (this.currentTransform === null) {
                this.currentTransform = new Matrix2d();
            }
            this.setTileTransform(this.currentTransform.identity());
        }

        // clear out the flags and set the tileId
        this.tileId &= TMX_CLEAR_BIT_MASK;
    }

    /**
     * set the transformation matrix for this tile
     * @ignore
     */
    setTileTransform(transform) {
        transform.translate(this.width / 2, this.height / 2);
        if (this.flippedAD) {
            transform.rotate(-90 * Math.PI / 180);
            transform.scale(-1, 1);
        }
        if (this.flippedX) {
            transform.scale(
                this.flippedAD ? 1 : -1, this.flippedAD ? -1 : 1
            );
        }
        if (this.flippedY) {
            transform.scale(
                 this.flippedAD ? -1 : 1, this.flippedAD ? 1 : -1
             );
        }
        transform.translate(-this.width / 2, -this.height / 2);
    }

    /**
     * return a renderable object for this Tile object
     * @name me.Tile#getRenderable
     * @public
     * @function
     * @param {object} [settings] see {@link me.Sprite}
     * @returns {me.Renderable} a me.Sprite object
     */
    getRenderable(settings) {
        var renderable;
        var tileset = this.tileset;

        if (tileset.animations.has(this.tileId)) {
            var frames = [];
            var frameId = [];
            (tileset.animations.get(this.tileId).frames).forEach(function (frame) {
                frameId.push(frame.tileid);
                frames.push({
                    name : "" + frame.tileid,
                    delay : frame.duration
                });
            });
            renderable = tileset.texture.createAnimationFromName(frameId, settings);
            renderable.addAnimation(this.tileId - tileset.firstgid, frames);
            renderable.setCurrentAnimation(this.tileId - tileset.firstgid);

        } else {
            if (tileset.isCollection === true) {
                var image = tileset.getTileImage(this.tileId);
                renderable = new Sprite(0, 0,
                    Object.assign({
                        image: image
                    })//, settings)
                );
                renderable.anchorPoint.set(0, 0);
                renderable.scale((settings.width / this.width), (settings.height / this.height));
                if (typeof settings.rotation !== "undefined") {
                    renderable.anchorPoint.set(0.5, 0.5);
                    renderable.currentTransform.rotate(settings.rotation);
                    renderable.currentTransform.translate(settings.width / 2, settings.height / 2);
                    // TODO : move the rotation related code from TMXTiledMap to here (under)
                    settings.rotation = undefined;
                }
            } else {
                renderable = tileset.texture.createSpriteFromName(this.tileId - tileset.firstgid, settings);
                renderable.anchorPoint.set(0, 0);
            }
        }

        // any H/V flipping to apply?
        this.setTileTransform(renderable.currentTransform);

        return renderable;
    }
};
export default Tile;
