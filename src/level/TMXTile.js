/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2015, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function (TMXConstants) {

    /**
     * a basic tile object
     * @class
     * @extends me.Rect
     * @memberOf me
     * @constructor
     * @param {Number} x x index of the Tile in the map
     * @param {Number} y y index of the Tile in the map
     * @param {Number} gid tile gid
     * @param {me.TMXTileset} tileset the corresponding tileset object

     */
    me.Tile = me.Rect.extend({
        /** @ignore */
        init : function (x, y, gid, tileset) {
            /**
             * tileset
             * @public
             * @type me.TMXTileset
             * @name me.Tile#tileset
             */
            this.tileset = tileset;

            /**
             * the tile transformation matrix (if defined)
             * @ignore
             */
            this.transform = null;
            this._super(me.Rect, "init", [x * tileset.tilewidth, y * tileset.tileheight, tileset.tilewidth, tileset.tileheight]);

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
            this.flippedX  = (this.tileId & TMXConstants.TMX_FLIP_H) !== 0;
            /**
             * True if the tile is flipped vertically<br>
             * @public
             * @type Boolean
             * @name me.Tile#flippedY
             */
            this.flippedY  = (this.tileId & TMXConstants.TMX_FLIP_V) !== 0;
            /**
             * True if the tile is flipped anti-diagonally<br>
             * @public
             * @type Boolean
             * @name me.Tile#flippedAD
             */
            this.flippedAD = (this.tileId & TMXConstants.TMX_FLIP_AD) !== 0;

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
            this.tileId &= TMXConstants.TMX_CLEAR_BIT_MASK;
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
                this.transform.translate((this.flippedAD ? this.height : this.width), 0);
                a[0] *= -1;
                a[3] *= -1;

            }
            if (this.flippedY) {
                this.transform.translate(0, (this.flippedAD ? this.width : this.height));
                a[1] *= -1;
                a[4] *= -1;
            }
        },

        /**
         * return a renderable object for this Tile object
         * @name me.Tile#getRenderable
         * @public
         * @function
         * @param {Object} [settings] see {@link me.Sprite}
         * @return {me.Renderable} either a me.Sprite object or a me.AnimationSheet (for animated tiles)
         */
        getRenderable : function (settings) {
            var renderable;

            if (this.tileset.animations.has(this.tileId)) {
                var frames = [];
                (this.tileset.animations.get(this.tileId).frames).forEach(function (frame) {
                    frames.push(frame.tileid);
                });
                renderable = this.tileset.texture.createAnimationFromName(frames);
            } else {
                renderable = this.tileset.texture.createSpriteFromName(this.tileId - this.tileset.firstgid);
            }

            // AD flag is never set for Tile Object, use the given rotation instead
            if (typeof(settings) !== "undefined") {
                var angle = settings.rotation || 0;
                if (angle !== 0) {
                    renderable._sourceAngle += angle;
                    // translate accordingly
                    switch (angle) {
                        case Math.PI:
                            renderable.translate(0, this.height * 2);
                            break;
                        case Math.PI / 2 :
                            renderable.translate(this.width, this.height);
                            break;
                        case -(Math.PI / 2) :
                            renderable.translate(-this.width, this.height);
                            break;
                        default :
                            // this should not happen
                            break;
                    }
                }
            }

            // any H/V flipping to apply?
            if (this.flipped === true) {
                renderable.flipX(this.flippedX);
                renderable.flipY(this.flippedY);
            }

            return renderable;
        },
    });
})(me.TMXConstants);
