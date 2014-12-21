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
            var size = data.meta.size;
            var w = size.w;
            var h = size.h;

            // Vertex buffer
            this.vb = new Float32Array([
                0, 0,
                w, 0,
                0, h,
                w, h
            ]);

            var atlas = this._super(me.CanvasRenderer.prototype.Texture, "build", [ data ]);

            Object.keys(atlas).forEach(function (frame) {
                // Source coordinates
                var s = atlas[frame].offset;
                var sw = atlas[frame].width;
                var sh = atlas[frame].height;

                // UV texture coordinates
                var u1 = s.x / w;
                var v1 = s.y / h;
                var u2 = (s.x + sw) / w;
                var v2 = (s.y + sh) / h;

                atlas[frame].uvMap = new Float32Array([
                    u1, v1,
                    u2, v1,
                    u1, v2,
                    u2, v2
                ]);

                // Index buffer
                atlas[frame].ib = new Uint16Array([
                    // Upper-left triangle
                    0, 1, 2,

                    // Lower-right triangle
                    2, 1, 3
                ]);
            });

            return atlas;
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
