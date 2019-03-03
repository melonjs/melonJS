(function () {

    /**
     * a generic Color Layer Object.  Fills the entire Canvas with the color not just the container the object belongs to.
     * @class
     * @extends me.Renderable
     * @memberOf me
     * @constructor
     * @param {String} name Layer name
     * @param {me.Color|String} color CSS color
     * @param {Number} z z-index position
     */
    me.ColorLayer = me.Renderable.extend({
        /**
         * @ignore
         */
        init: function (name, color, z) {
            // parent constructor
            this._super(me.Renderable, "init", [0, 0, Infinity, Infinity]);

            // apply given parameters
            this.name = name;
            this.pos.z = z;
            this.floating = true;

            /**
             * the layer color component
             * @public
             * @type me.Color
             * @name color
             * @memberOf me.ColorLayer#
             */
            // parse the given color
            if (color instanceof me.Color) {
                this.color = color;
            } else {
                // string (#RGB, #ARGB, #RRGGBB, #AARRGGBB)
                this.color = me.pool.pull("me.Color").parseCSS(color);
            }
            this.anchorPoint.set(0, 0);
        },

        /**
         * draw the color layer
         * @ignore
         */
        draw : function (renderer, rect) {
            var color = renderer.getColor();
            var vpos = me.game.viewport.pos;
            renderer.setColor(this.color);
            renderer.fillRect(
                rect.left - vpos.x, rect.top - vpos.y,
                rect.width, rect.height
            );
            renderer.setColor(color);
        },

        /**
         * Destroy function
         * @ignore
         */
        destroy : function () {
            me.pool.push(this.color);
            this.color = undefined;
            this._super(me.Renderable, "destroy");
        }
    });

})();
