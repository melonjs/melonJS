/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Glyph
 */
(function() {
    var LOG2_PAGE_SIZE = 9;
    var PAGE_SIZE = 1 << LOG2_PAGE_SIZE;
    /**
     * a glyph representing a single character in a font
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     */
    me.Glyph = me.Object.extend({
        /**
         * @ignore
         */
        init: function () {
            this.src = new me.Vector2d();
            this.offset = new me.Vector2d();
            this.onResetEvent();
        },

        /**
         * @ignore
         */
        onResetEvent: function () {
            this.id = 0;
            this.src.set(0, 0);
            this.width = 0;
            this.height = 0;
            this.u = 0;
            this.v = 0;
            this.u2 = 0;
            this.v2 = 0;
            this.offset.set(0, 0);
            this.xadvance = 0;
            this.fixedWidth = false;
        },

        /**
         * @ignore
         */
        getKerning: function (ch) {
            if (this.kerning) {
                var page = this.kerning[ch >>> LOG2_PAGE_SIZE];
                if (page) {
                    return page[ch & PAGE_SIZE - 1] || 0;
                }
            }
            return 0;
        },

        /**
         * @ignore
         */
        setKerning: function (ch, value) {
            if (!this.kerning) {
                this.kerning = {};
            }
            var page = this.kerning[ch >>> LOG2_PAGE_SIZE];
            if (typeof page === "undefined") {
                this.kerning[ch >>> LOG2_PAGE_SIZE] = {};
                page = this.kerning[ch >>> LOG2_PAGE_SIZE];
            }
            page[ch & PAGE_SIZE - 1] = value;
        }
    });
})();
