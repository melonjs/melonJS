/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
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
        init: function () {
            this.src = new me.Vector2d();
            this.offset = new me.Vector2d();
            this.onResetEvent();
        },

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
            this.kerning = [];
            this.fixedWidth = false;
        },

        setKerning: function (ch, value) {
            var page = this.kerning[ch >>> LOG2_PAGE_SIZE];
            if (page === null) {
                this.kerning[ch >>> LOG2_PAGE_SIZE] = page = [];
            }
            page[ch & PAGE_SIZE - 1] = value;
        }
    });
})();