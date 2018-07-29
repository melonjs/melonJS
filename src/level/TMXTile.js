/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2018 Olivier Biot
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {

    // bitmask constants to check for flipped & rotated tiles
    var TMX_FLIP_H          = 0x80000000,
        TMX_FLIP_V          = 0x40000000,
        TMX_FLIP_AD         = 0x20000000,
        TMX_CLEAR_BIT_MASK  = ~(0x80000000 | 0x40000000 | 0x20000000);

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
            var width, height;

            // determine the tile size
            if (tileset.isCollection) {
                var image = tileset.getTileImage(gid & TMX_CLEAR_BIT_MASK);
                width = image.width;
                height = image.height;
            } else {
                width = tileset.tilewidth;
                height = tileset.tileheight;
            }

            // call the parent constructor
            this._super(me.Rect, "init", [x * width, y * height, width, height]);

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
            this.currentTransform = null;

            // Tile col / row pos
            this.col = x;
            this.row = y;

            /**
             * tileId
             * @public
             * @type Number
             * @name me.Tile#tileId
             */
            this.tileId = gid;
            /**
             * True if the tile is flipped horizontally<br>
             * @public
             * @type Boolean
             * @name me.Tile#flipX
             */
            this.flippedX  = (this.tileId & TMX_FLIP_H) !== 0;
            /**
             * True if the tile is flipped vertically<br>
             * @public
             * @type Boolean
             * @name me.Tile#flippedY
             */
            this.flippedY  = (this.tileId & TMX_FLIP_V) !== 0;
            /**
             * True if the tile is flipped anti-diagonally<br>
             * @public
             * @type Boolean
             * @name me.Tile#flippedAD
             */
            this.flippedAD = (this.tileId & TMX_FLIP_AD) !== 0;

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
            this.tileId &= TMX_CLEAR_BIT_MASK;
        },

        /**
         * create a transformation matrix for this tile
         * @ignore
         */
        createTransform : function () {
            if (this.currentTransform === null) {
                this.currentTransform = new me.Matrix2d();
            } else {
                // reset the matrix
                this.currentTransform.identity();
            }

            if (this.flippedAD) {
                // Use shearing to swap the X/Y axis
                this.currentTransform.setTransform(
                    0, 1, 0,
                    1, 0, 0,
                    0, 0, 1
                );
                this.currentTransform.translate(0, this.height - this.width);
            }
            if (this.flippedX) {
                this.currentTransform.translate(
                    (this.flippedAD ? 0 : this.width),
                    (this.flippedAD ? this.height : 0)
                );
                this.currentTransform.scaleX(-1);
            }
            if (this.flippedY) {
                this.currentTransform.translate(
                    (this.flippedAD ? this.width : 0),
                    (this.flippedAD ? 0 : this.height)
                );
                this.currentTransform.scaleY(-1);
            }
        },

        /**
         * return a renderable object for this Tile object
         * @name me.Tile#getRenderable
         * @public
         * @function
         * @param {Object} [settings] see {@link me.Sprite}
         * @return {me.Renderable} a me.Sprite object
         */
        getRenderable : function (settings) {
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
                    renderable = new me.Sprite(0, 0,
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
                }
            }

            // any H/V flipping to apply?
            if (this.flippedX) {
                renderable.currentTransform.scaleX(-1);
            }
            if (this.flippedY) {
                renderable.currentTransform.scaleY(-1);
            }

            return renderable;
        }
    });
})();
