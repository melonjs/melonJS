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
            this.cache = new Map();
            this.tinted = new Map();
            this.units = new Map();
            this.max_size = max_size || Infinity;
            this.clear();
        },

        /**
         * @ignore
         */
        clear : function () {
            this.cache.clear();
            this.tinted.clear();
            this.units.clear();
            this.length = 0;
        },

        /**
         * @ignore
         */
        validate : function () {
            if (this.length >= this.max_size) {
                // TODO: Merge textures instead of throwing an exception
                throw new Error(
                    "Texture cache overflow: " + this.max_size +
                    " texture units available for this GPU."
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
                        [image.width, image.height, image.src ? me.utils.file.getBasename(image.src) : undefined]
                    );
                }
                this.set(image, new me.video.renderer.Texture(atlas, image, false));
            }
            return this.cache.get(image);
        },

        /**
         * @ignore
         */
        tint : function (src, color) {
            // make sure the src is in the cache
            var image_cache = this.tinted.get(src);

            if (image_cache === undefined) {
                image_cache = this.tinted.set(src, new Map());
            }

            if (!image_cache.has(color)) {
                image_cache.set(color, me.video.renderer.tint(src, color, "multiply"));
            }

            return image_cache.get(color);
        },

        /**
         * @ignore
         */
        set : function (image, texture) {
            var width = image.width;
            var height = image.height;

            // warn if a non POT texture is added to the cache when using WebGL1
            if (me.video.renderer.WebGLVersion === 1 && (!me.Math.isPowerOfTwo(width) || !me.Math.isPowerOfTwo(height))) {
                var src = typeof image.src !== "undefined" ? image.src : image;
                console.warn(
                    "[Texture] " + src + " is not a POT texture " +
                    "(" + width + "x" + height + ")"
                );
            }
            this.cache.set(image, texture);
        },

        /**
         * @ignore
         */
        getUnit : function (texture) {
            if (!this.units.has(texture)) {
                this.validate();
                this.units.set(texture, this.length++);
            }
            return this.units.get(texture);
        }
    });

})();
