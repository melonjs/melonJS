/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Font / Bitmap font
 *
 * -> first char " " 32d (0x20);
 */
(function () {
    /**
     * stores a cache of glyph output based on text data and bitmap font data
     * @class
     * @extends me.Object
     * @memberOf me
     * @constructor
     */
    me.BitmapFontCache = me.Renderable.extend({
        init: function (bitmapFont, useRoundedPositioning) {
            this.bitmapFont = bitmapFont;
            this.useRoundedPositioning = useRoundedPositioning;
            this.vertexDataCount = 0;
            this.vertices = [];
            this.layouts = [];
        },

        _requireGlyphs: function (layout) {
            var newGlyphCount = 0;
            for (var i = 0; i < layout.runs.length; i++) {
                newGlyphCount += layout.runs[i].glyphs.length;
            }

            var vertexCount = this.vertexDataCount + newGlyphCount * 20;
            if (this.vertices.length < vertexCount) {
                var newVertices = new Array(vertexCount);
                for (var i = 0; i < this.vertexDataCount; i++) {
                    newVertices[i] = this.vertices[i];
                }
                this.vertices = newVertices;
            }
        },

        addToCache: function (layout, x, y) {
            this.layouts.push(layout);
            this._requireGlyphs(layout);
            for (var i = 0; i < layout.runs.length; i++) {
                var run = layout.runs[i];
                var glyphs = run.glyphs;
                var xAdvances = run.xAdvances;
                var gx = x + run.x, gy = y + run.y;
                for (var ii = 0; ii < glyphs.length; ii++) {
                    var glyph = glyphs[ii];
                    gx += xAdvances[ii];
                    this.addGlyph(glyph, gx, gy);
                }
            }
        },

        addGlyph: function (glyph, x, y) {
            var scaleX = this.font.data.scale.x;
            var scaleY = this.font.data.scale.y;
            x += glyph.xoffset * scaleX;
            y += glyph.yoffset * scaleY;
            var width = glyph.width * scaleX, height = glyph.height * scaleY;
            var u = glyph.u, u2 = glyph.u2, v = glyph.v, v2 = glyph.v2;

            if (integer) {
                x = Math.round(x);
                y = Math.round(y);
                width = Math.round(width);
                height = Math.round(height);
            }
            var x2 = x + width, y2 = y + height;

            var page = glyph.page;
            this.vertexDataCount += 20;

            var vertices = this.vertices;
            var idx = this.vertexDataCount;
            vertices[idx++] = x;
            vertices[idx++] = y;
            vertices[idx++] = u;
            vertices[idx++] = v;

            vertices[idx++] = x;
            vertices[idx++] = y2;
            vertices[idx++] = u;
            vertices[idx++] = v2;

            vertices[idx++] = x2;
            vertices[idx++] = y2;
            vertices[idx++] = u2;
            vertices[idx++] = v2;

            vertices[idx++] = x2;
            vertices[idx++] = y;
            vertices[idx++] = u2;
            vertices[idx] = v;
        }
    });
})();