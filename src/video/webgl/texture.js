/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * A Texture atlas object for WebGL <br>
     * For portability, a global reference to this class is available through the default renderer: {@link me.video.renderer}.Texture <br>
     * <br>
     * Currently supports : <br>
     * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export <br>
     * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
     * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
     * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx} object
     * @class
     * @extends me.CanvasRenderer
     * @memberOf me.WebGLRenderer
     * @name Texture
     * @constructor
     * @param {Object} atlas atlas information. See {@link me.loader.getJSON}
     * @param {Image} [texture=atlas.meta.image] texture name
     * @param {Boolean} [cached=false] Use true to skip caching this Texture
     * @example
     * // create a texture atlas from a JSON Object
     * texture = new me.video.renderer.Texture(
     *     me.loader.getJSON("texture"),
     *     me.loader.getImage("texture")
     * );
     *
     * // create a texture atlas for a spritesheet
     * texture = new me.video.renderer.Texture(
     *     { framewidth : 32, frameheight : 32 },
     *     me.loader.getImage("spritesheet")
     * );
     */
    me.WebGLRenderer.prototype.Texture = me.CanvasRenderer.prototype.Texture.extend(
    /** @scope me.video.renderer.Texture.prototype */
    {
        /**
         * @ignore
         */
        parse : function (data) {
            var w = data.meta.size.w;
            var h = data.meta.size.h;
            var atlas = this._super(me.CanvasRenderer.prototype.Texture, "parse", [ data ]);

            return this._addStMap(atlas, w, h);
        },

        /**
         * @ignore
         */
        parseFromSpriteSheet : function (data) {
            var w = data.image.width;
            var h = data.image.height;
            var atlas = this._super(me.CanvasRenderer.prototype.Texture, "parseFromSpriteSheet", [ data ]);

            return this._addStMap(atlas, w, h);
        },

        /**
         * @ignore
         */
        _addStMap : function (atlas, w, h) {
            Object.keys(atlas).forEach(function (frame) {
                // Source coordinates
                var s = atlas[frame].offset;
                var sw = atlas[frame].width;
                var sh = atlas[frame].height;

                // ST texture coordinates
                atlas[frame].stMap = new Float32Array([
                    s.x / w,        // Left
                    s.y / h,        // Top
                    (s.x + sw) / w, // Right
                    (s.y + sh) / h  // Bottom
                ]);

                // Cache source coordinates
                // TODO: Remove this when the Batcher only accepts a region name
                var key = s.x + "," + s.y + "," + w + "," + h;
                atlas[key] = atlas[frame];
            });
            return atlas;
        },

        /**
         * @ignore
         */
        _insertRegion : function (name, x, y, w, h) {
            var dw = this.texture.width;
            var dh = this.texture.height;
            this.atlas[name] = {
                name    : name,
                offset  : new me.Vector2d(x, y),
                width   : w,
                height  : h,
                angle   : 0,
                stMap   : new Float32Array([
                    x / dw,         // Left
                    y / dh,         // Top
                    (x + w) / dw,   // Right
                    (y + h) / dh    // Bottom
                ])
            };

            return this.atlas[name];
        }
    });

    /**
    * Base class for Texture exception handling.
    * @ignore
    */
    me.WebGLRenderer.prototype.Texture.Error = me.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.WebGLRenderer.Texture.Error";
        }
    });
})();
