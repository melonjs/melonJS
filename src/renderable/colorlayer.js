/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017 Olivier Biot
 * http://www.melonjs.org
 *
 */
(function () {

    /**
     * a generic Color Layer Object
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
         * Constructor
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
             * @name me.ColorLayer#color
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
        }
    });

})();
