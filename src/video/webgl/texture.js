/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * A Texture atlas object for WebGL
     * @ignore
     */
    me.WebGLRenderer.prototype.Texture = me.CanvasRenderer.prototype.Texture.extend(
    /** @scope me.video.renderer.Texture.prototype */
    {
        /**
         * @ignore
         */
        build : function (data) {
            var w = data.meta.size.w;
            var h = data.meta.size.h;
            var atlas = this._super(me.CanvasRenderer.prototype.Texture, "build", [ data ]);

            return this._addStMap(atlas, w, h);
        },

        /**
         * @ignore
         */
        buildFromSpriteSheet : function (data) {
            var w = data.image.width;
            var h = data.image.height;
            var atlas = this._super(me.CanvasRenderer.prototype.Texture, "buildFromSpriteSheet", [ data ]);

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
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.WebGLRenderer.Texture.Error";
        }
    });
})();
