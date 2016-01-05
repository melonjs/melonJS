/*
* MelonJS Game Engine
* Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
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
                this.validate();

                if (!atlas) {
                    var w = image.width;
                    var h = image.height;
                    atlas = {
                        // FIXME: Create a texture atlas helper function
                        "meta" : {
                            "app" : "melonJS",
                            "size" : { "w" : w, "h" : h }
                        },
                        "frames" : [{
                            "filename" : "default",
                            "frame" : { "x" : 0, "y" : 0, "w" : w, "h" : h }
                        }]
                    };
                }

                var texture = new me.video.renderer.Texture(atlas, image, true);
                this.cache.set(image, texture);
                this.units.set(texture, this.length++);
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
