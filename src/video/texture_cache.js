/*
* MelonJS Game Engine
* Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
* http://www.melonjs.org
*
*/
(function () {

    /**
     * a basic texture cache object
     * @ignore
     */
    me.Renderer.TextureCache = me.Object.extend({
        /**
         * @ignore
         */
        init : function (max_size) {
            this.max_size = max_size || Infinity;
            this.reset();
        },

        /**
         * @ignore
         */
        reset : function () {
            this.cache = new Map();
            this.units = new Map();
            this.length = 0;
        },

        /**
         * @ignore
         */
        validate : function () {
            if (this.length >= this.max_size) {
                // TODO: Merge textures instead of throwing an exception
                throw new me.video.Error(
                    "Texture cache overflow: " + this.max_size +
                    " texture units available."
                );
            }
        },

        /**
         * @ignore
         */
        get : function (image, atlas) {
            if (!this.cache.has(image)) {
                if (!atlas) {
                    atlas = me.video.renderer.Texture.prototype.createAtlas.apply(
                        me.video.renderer.Texture.prototype,
                        [image.width, image.height, image.src ? me.utils.getBasename(image.src) : undefined]
                    );
                }
                this.put(image, new me.video.renderer.Texture(atlas, image, false));
            }
            return this.cache.get(image);
        },

        /**
         * @ignore
         */
        put : function (image, texture) {
            this.validate();
            this.cache.set(image, texture);
            this.units.set(texture, this.length++);
        },

        /**
         * @ignore
         */
        getUnit : function (texture) {
            return this.units.get(texture);
        }
    });

})();
