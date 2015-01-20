/*
 * MelonJS Game Engine
 * (C) 2011 - 2015 Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Tile QT 0.7.x format
 * http://www.mapeditor.org/
 *
 */
(function () {


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
                this.transform.translate((this.flippedAD ? this.height : this.width), 0);
                a[0] *= -1;
                a[3] *= -1;

            }
            if (this.flippedY) {
                this.transform.translate(0, (this.flippedAD ? this.width : this.height));
                a[1] *= -1;
                a[4] *= -1;
            }
        }
    });
})();
