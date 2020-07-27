(function () {

    /**
     * A Texture atlas object, currently supports : <br>
     * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export (standard and multipack texture atlas) <br>
     * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
     * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
     * - [Free Texture Packer]{@link http://free-tex-packer.com/app/} : through JSON export (standard and multipack texture atlas) <br>
     * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx, anchorPoint:me.Vector2d} object
     * @class
     * @extends me.Object
     * @memberOf me.Renderer
     * @name Texture
     * @constructor
     * @param {Object|Object[]} atlas atlas information. See {@link me.loader.getJSON}
     * @param {HTMLImageElement|HTMLCanvasElement|String|HTMLImageElement[]|HTMLCanvasElement[]|String[]} [source=atlas.meta.image] Image source
     * @param {Boolean} [cached=false] Use true to skip caching this Texture
     * @example
     * // create a texture atlas from a JSON Object
     * game.texture = new me.video.renderer.Texture(
     *     me.loader.getJSON("texture")
     * );
     *
     * // create a texture atlas from a multipack JSON Object
     * game.texture = new me.video.renderer.Texture([
     *     me.loader.getJSON("texture-0"),
     *     me.loader.getJSON("texture-1"),
     *     me.loader.getJSON("texture-2")
     * ]);
     *
     * // create a texture atlas for a spritesheet with an anchorPoint in the center of each frame
     * game.texture = new me.video.renderer.Texture(
     *     {
     *         framewidth : 32,
     *         frameheight : 32,
     *         anchorPoint : new me.Vector2d(0.5, 0.5)
     *     },
     *     me.loader.getImage("spritesheet")
     * );
     */
    me.Renderer.prototype.Texture = me.Object.extend({
        /**
         * @ignore
         */
        init : function (atlases, src, cache) {
            /**
             * to identify the atlas format (e.g. texture packer)
             * @ignore
             */
            this.format = null;

            /**
             * the texture source(s) itself
             * @type Map
             * @ignore
             */
            this.sources = new Map();

            /**
             * the atlas dictionnaries
             * @type Map
             * @ignore
             */
            this.atlases = new Map();

            // parse given atlas(es) paremeters
            if (typeof (atlases) !== "undefined") {
                // normalize to array to keep the following code generic
                atlases = Array.isArray(atlases) ? atlases : [atlases];
                for (var i in atlases) {
                    var atlas = atlases[i];

                    if (typeof(atlas.meta) !== "undefined") {
                        // Texture Packer or Free Texture Packer
                        if (atlas.meta.app.includes("texturepacker") || atlas.meta.app.includes("free-tex-packer")) {
                            this.format = "texturepacker";
                            // set the texture
                            if (typeof(src) === "undefined") {
                                // get the texture name from the atlas meta data
                                var image = me.loader.getImage(atlas.meta.image);
                                if (!image) {
                                    throw new Error(
                                        "Atlas texture '" + image + "' not found"
                                    );
                                }
                                this.sources.set(atlas.meta.image, image);
                            } else {
                                this.sources.set(atlas.meta.image || "default", typeof src === "string" ? me.loader.getImage(src) : src);
                            }
                            this.repeat = "no-repeat";
                        }
                        // ShoeBox
                        else if (atlas.meta.app.includes("ShoeBox")) {
                            if (!atlas.meta.exporter || !atlas.meta.exporter.includes("melonJS")) {
                                throw new Error(
                                    "ShoeBox requires the JSON exporter : " +
                                    "https://github.com/melonjs/melonJS/tree/master/media/shoebox_JSON_export.sbx"
                                );
                            }
                            this.format = "ShoeBox";
                            this.repeat = "no-repeat";
                            this.sources.set("default", typeof src === "string" ? me.loader.getImage(src) : src);
                        }
                        // Internal texture atlas
                        else if (atlas.meta.app.includes("melonJS")) {
                            this.format = "melonJS";
                            this.repeat = atlas.meta.repeat || "no-repeat";
                            this.sources.set("default", typeof src === "string" ? me.loader.getImage(src) : src);
                        }
                        // initialize the atlas
                        this.atlases.set(atlas.meta.image || "default", this.parse(atlas));

                    } else {
                        // a regular spritesheet
                        if (typeof(atlas.framewidth) !== "undefined" &&
                            typeof(atlas.frameheight) !== "undefined") {
                            this.format = "Spritesheet (fixed cell size)";
                            this.repeat = "no-repeat";

                            if (typeof(src) !== "undefined") {
                                // overwrite if specified
                                atlas.image = typeof src === "string" ? me.loader.getImage(src) : src;
                            }
                            // initialize the atlas
                            this.atlases.set("default", this.parseFromSpriteSheet(atlas));
                            this.sources.set("default", atlas.image);

                        }
                    }
                } // end forEach
            }

            // if format not recognized
            if (this.atlases.length === 0) {
                throw new Error("texture atlas format not supported");
            }

            // Add self to TextureCache if cache !== false
            if (cache !== false) {
                for (var source of this.sources) {
                    if (cache instanceof me.Renderer.TextureCache) {
                        cache.set(source, this);
                    } else {
                        me.video.renderer.cache.set(source, this);
                    }
                }
            }
        },

        /**
         * create a simple 1 frame texture atlas based on the given parameters
         * @ignore
         */
        createAtlas : function (width, height, name, repeat) {
            return {
                "meta" : {
                    "app" : "melonJS",
                    "size" : { "w" : width, "h" : height },
                    "repeat" : repeat || "no-repeat",
                    "image" : "default"
                },
                "frames" : [{
                    "filename" : name || "default",
                    "frame" : { "x" : 0, "y" : 0, "w" : width, "h" : height }
                }]
            };
        },

        /**
         * build an atlas from the given data
         * @ignore
         */
        parse : function (data) {
            var atlas = {};
            var self = this;
            data.frames.forEach(function (frame) {
                // fix wrongly formatted JSON (e.g. last dummy object in ShoeBox)
                if (frame.hasOwnProperty("filename")) {
                    // Source coordinates
                    var s = frame.frame;

                    var originX, originY;
                    // Pixel-based offset origin from the top-left of the source frame
                    var hasTextureAnchorPoint = (frame.spriteSourceSize && frame.sourceSize && frame.pivot);
                    if (hasTextureAnchorPoint) {
                        originX = (frame.sourceSize.w * frame.pivot.x) - ((frame.trimmed) ? frame.spriteSourceSize.x : 0);
                        originY = (frame.sourceSize.h * frame.pivot.y) - ((frame.trimmed) ? frame.spriteSourceSize.y : 0);
                    }

                    atlas[frame.filename] = {
                        name         : frame.filename, // frame name
                        texture      : data.meta.image || "default", // the source texture
                        offset       : new me.Vector2d(s.x, s.y),
                        anchorPoint  : (hasTextureAnchorPoint) ? new me.Vector2d(originX / s.w, originY / s.h) : null,
                        trimmed      : !!frame.trimmed,
                        width        : s.w,
                        height       : s.h,
                        angle        : (frame.rotated === true) ? -me.Math.ETA : 0
                    };
                    self.addUvsMap(atlas, frame.filename, data.meta.size.w, data.meta.size.h);
                }
            });
            return atlas;
        },

        /**
         * build an atlas from the given spritesheet
         * @ignore
         */
        parseFromSpriteSheet : function (data) {
            var atlas = {};
            var image = data.image;
            var spacing = data.spacing || 0;
            var margin = data.margin || 0;

            var width = image.width;
            var height = image.height;

            // calculate the sprite count (line, col)
            var spritecount = me.pool.pull("me.Vector2d",
                ~~((width - margin + spacing) / (data.framewidth + spacing)),
                ~~((height - margin + spacing) / (data.frameheight + spacing))
            );

            // verifying the texture size
            if ((width % (data.framewidth + spacing)) !== 0 ||
                (height % (data.frameheight + spacing)) !== 0) {
                var computed_width = spritecount.x * (data.framewidth + spacing);
                var computed_height = spritecount.y * (data.frameheight + spacing);
                if (computed_width - width !== spacing && computed_height - height !== spacing) {
                    // "truncate size" if delta is different from the spacing size
                    width = computed_width;
                    height = computed_height;
                    // warning message
                    console.warn(
                        "Spritesheet Texture for image: " + image.src +
                        " is not divisible by " + (data.framewidth + spacing) +
                        "x" + (data.frameheight + spacing) +
                        ", truncating effective size to " + width + "x" + height
                    );
                }
            }

            // build the local atlas
            for (var frame = 0, count = spritecount.x * spritecount.y; frame < count; frame++) {
                var name = "" + frame;
                atlas[name] = {
                    name        : name,
                    texture     : "default", // the source texture
                    offset      : new me.Vector2d(
                        margin + (spacing + data.framewidth) * (frame % spritecount.x),
                        margin + (spacing + data.frameheight) * ~~(frame / spritecount.x)
                    ),
                    anchorPoint : (data.anchorPoint || null),
                    trimmed     : false,
                    width       : data.framewidth,
                    height      : data.frameheight,
                    angle       : 0
                };
                this.addUvsMap(atlas, name, width, height);
            }

            me.pool.push(spritecount);

            return atlas;
        },

        /**
         * @ignore
         */
        addUvsMap : function (atlas, frame, w, h) {
            // ignore if using the Canvas Renderer
            if (me.video.renderer instanceof me.WebGLRenderer) {
                // Source coordinates
                var s = atlas[frame].offset;
                var sw = atlas[frame].width;
                var sh = atlas[frame].height;

                atlas[frame].uvs = new Float32Array([
                    s.x / w,        // Left
                    s.y / h,        // Top
                    (s.x + sw) / w, // Right
                    (s.y + sh) / h  // Bottom
                ]);
                // Cache source coordinates
                // TODO: Remove this when the Batcher only accepts a region name
                var key = s.x + "," + s.y + "," + w + "," + h;
                atlas[key] = atlas[frame];
            }
            return atlas[frame];
        },

        /**
         * @ignore
         */
        addQuadRegion : function (name, x, y, w, h) {
            // TODO: Require proper atlas regions instead of caching arbitrary region keys
            if (me.video.renderer.settings.verbose === true) {
                console.warn("Adding texture region", name, "for texture", this);
            }

            var source = this.getTexture();
            var atlas = this.getAtlas();
            var dw = source.width;
            var dh = source.height;

            atlas[name] = {
                name    : name,
                offset  : new me.Vector2d(x, y),
                width   : w,
                height  : h,
                angle   : 0
            };

            this.addUvsMap(atlas, name, dw, dh);

            return atlas[name];
        },

        /**
         * return the default or specified atlas dictionnary
         * @name getAtlas
         * @memberOf me.Renderer.Texture
         * @function
         * @param {String} [name] atlas name in case of multipack textures
         * @return {Object}
         */
        getAtlas : function (key) {
            if (typeof key === "string") {
                return this.atlases.get(key);
            } else {
                return this.atlases.values().next().value;
            }
        },

        /**
         * return the source texture for the given region (or default one if none specified)
         * @name getTexture
         * @memberOf me.Renderer.Texture
         * @function
         * @param {Object} [region] region name in case of multipack textures
         * @return {HTMLImageElement|HTMLCanvasElement}
         */
        getTexture : function (region) {
            if ((typeof region === "object") && (typeof region.texture === "string")) {
                return this.sources.get(region.texture);
            } else {
                return this.sources.values().next().value;
            }
        },

        /**
         * return a normalized region (or frame) information for the specified sprite name
         * @name getRegion
         * @memberOf me.Renderer.Texture
         * @function
         * @param {String} name name of the sprite
         * @param {String} [atlas] name of a specific atlas where to search for the region
         * @return {Object}
         */
        getRegion : function (name, atlas) {
            var region;
            if (typeof atlas === "string") {
                region = this.getAtlas(atlas)[name];
            } else {
                // look for the given region in each existing atlas
                this.atlases.forEach(function (atlas) {
                    if (typeof atlas[name] !== "undefined") {
                        // there should be only one
                        region = atlas[name];
                    }
                });
            }
            return region;
        },

        /**
         * return the uvs mapping for the given region
         * @name getUVs
         * @memberOf me.Renderer.Texture
         * @function
         * @param {Object} region region (or frame) name
         * @return {Float32Array} region Uvs
         */
        getUVs : function (name) {
            // Get the source texture region
            var region = this.getRegion(name);

            if (typeof(region) === "undefined") {
                // TODO: Require proper atlas regions instead of caching arbitrary region keys
                var keys = name.split(","),
                    sx = +keys[0],
                    sy = +keys[1],
                    sw = +keys[2],
                    sh = +keys[3];
                region = this.addQuadRegion(name, sx, sy, sw, sh);
            }
            return region.uvs;
        },

        /**
         * Create a sprite object using the first region found using the specified name
         * @name createSpriteFromName
         * @memberOf me.Renderer.Texture
         * @function
         * @param {String} name name of the sprite
         * @param {Object} [settings] Additional settings passed to the {@link me.Sprite} contructor
         * @return {me.Sprite}
         * @example
         * // create a new texture object under the `game` namespace
         * game.texture = new me.video.renderer.Texture(
         *    me.loader.getJSON("texture"),
         *    me.loader.getImage("texture")
         * );
         * ...
         * ...
         * // add the coin sprite as renderable for the entity
         * var sprite = game.texture.createSpriteFromName("coin.png");
         * // set the renderable position to bottom center
         * sprite.anchorPoint.set(0.5, 1.0);
         */
        createSpriteFromName : function (name, settings) {
            // instantiate a new sprite object
            return me.pool.pull(
                "me.Sprite",
                0, 0,
                Object.assign({
                    image: this,
                    region : name
                }, settings || {})
            );
        },

        /**
         * Create an animation object using the first region found using all specified names
         * @name createAnimationFromName
         * @memberOf me.Renderer.Texture
         * @function
         * @param {String[]|Number[]} names list of names for each sprite
         * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
         * @param {Object} [settings] Additional settings passed to the {@link me.Sprite} contructor
         * @return {me.Sprite}
         * @example
         * // create a new texture object under the `game` namespace
         * game.texture = new me.video.renderer.Texture(
         *     me.loader.getJSON("texture"),
         *     me.loader.getImage("texture")
         * );
         *
         * // create a new Sprite as renderable for the entity
         * var sprite = game.texture.createAnimationFromName([
         *     "walk0001.png", "walk0002.png", "walk0003.png",
         *     "walk0004.png", "walk0005.png", "walk0006.png",
         *     "walk0007.png", "walk0008.png", "walk0009.png",
         *     "walk0010.png", "walk0011.png"
         * ]);
         *
         * // define an additional basic walking animation
         * sprite.addAnimation ("simple_walk", [0,2,1]);
         * // you can also use frame name to define your animation
         * sprite.addAnimation ("speed_walk", ["walk0007.png", "walk0008.png", "walk0009.png", "walk0010.png"]);
         * // set the default animation
         * sprite.setCurrentAnimation("simple_walk");
         * // set the renderable position to bottom center
         * sprite.anchorPoint.set(0.5, 1.0);
         */
        createAnimationFromName : function (names, settings) {
            var tpAtlas = [], indices = {};
            var width = 0, height = 0;
            var region;
            // iterate through the given names
            // and create a "normalized" atlas
            for (var i = 0; i < names.length; ++i) {
                region = this.getRegion(names[i]);
                if (region == null) {
                    // throw an error
                    throw new Error("Texture - region for " + names[i] + " not found");
                }
                tpAtlas[i] = region;
                // save the corresponding index
                indices[names[i]] = i;
                // calculate the max size of a frame
                width = Math.max(region.width, width);
                height = Math.max(region.height, height);
            }
            // instantiate a new animation sheet object
            return new me.Sprite(0, 0, Object.assign({
                image: this,
                framewidth: width,
                frameheight: height,
                margin: 0,
                spacing: 0,
                atlas: tpAtlas,
                atlasIndices: indices
            }, settings || {}));
        }
    });
})();
