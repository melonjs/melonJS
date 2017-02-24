/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * a local constant for the -(Math.PI / 2) value
     * @ignore
     */
    var nhPI = -(Math.PI / 2);

    /**
     * A Texture atlas object <br>
     * For portability, a global reference to this class is available through the default renderer: {@link me.video.renderer}.Texture <br>
     * <br>
     * Currently supports : <br>
     * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export <br>
     * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
     * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
     * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx, anchorPoint:me.Vector2d} object
     * @class
     * @extends me.Object
     * @memberOf me.CanvasRenderer
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
     * // create a texture atlas for a spritesheet, with (optional) an anchorPoint in the center of each frame
     * texture = new me.video.renderer.Texture(
     *     { framewidth : 32, frameheight : 32, anchorPoint : new me.Vector2d(0.5, 0.5) },
     *     me.loader.getImage("spritesheet")
     * );
     */
    me.CanvasRenderer.prototype.Texture = me.Object.extend(
    /** @scope me.video.renderer.Texture.prototype */
    {
        /**
         * @ignore
         */
        init : function (atlas, texture, cache) {
            /**
             * to identify the atlas format (e.g. texture packer)
             * @ignore
             */
            this.format = null;

            /**
             * the image texture itself (FIXME: This should be named `image`)
             * @ignore
             */
            this.texture = texture || null;

            /**
             * the atlas dictionnary
             * @ignore
             */
            this.atlas = null;

            if (typeof (atlas) !== "undefined") {

                if (typeof(atlas.meta) !== "undefined") {
                    // Texture Packer
                    if (atlas.meta.app.includes("texturepacker")) {
                        this.format = "texturepacker";
                        // set the texture
                        if (typeof(texture) === "undefined") {
                            var image = atlas.meta.image;
                            this.texture = me.utils.getImage(image);
                            if (!this.texture) {
                                throw new me.video.renderer.Texture.Error(
                                    "Atlas texture '" + image + "' not found"
                                );
                            }
                        }
                        this.repeat = "no-repeat";
                    }
                    // ShoeBox
                    else if (atlas.meta.app.includes("ShoeBox")) {
                        if (!atlas.meta.exporter || !atlas.meta.exporter.includes("melonJS")) {
                            throw new me.video.renderer.Texture.Error(
                                "ShoeBox requires the JSON exporter : " +
                                "https://github.com/melonjs/melonJS/tree/master/media/shoebox_JSON_export.sbx"
                            );
                        }
                        this.format = "ShoeBox";
                        this.repeat = "no-repeat";
                    }
                    // Internal texture atlas
                    else if (atlas.meta.app.includes("melonJS")) {
                        this.format = "melonJS";
                        this.repeat = atlas.meta.repeat || "no-repeat";
                    }
                    // initialize the atlas
                    this.atlas = this.parse(atlas);

                } else {
                    // a regular spritesheet ?
                    if (typeof(atlas.framewidth) !== "undefined" &&
                        typeof(atlas.frameheight) !== "undefined") {
                        this.format = "Spritesheet (fixed cell size)";
                        if (typeof(texture) !== undefined) {
                            // overwrite if specified
                            atlas.image = texture;
                        }
                        // initialize the atlas
                        this.atlas = this.parseFromSpriteSheet(atlas);
                        this.repeat = "no-repeat";
                    }
                }
            }
            // if format not recognized
            if (!this.atlas) {
                throw new me.video.renderer.Texture.Error("texture atlas format not supported");
            }

            // Add self to TextureCache if cache !== false
            if (cache !== false) {
                if (cache instanceof me.Renderer.TextureCache) {
                    cache.put(this.texture, this);
                } else {
                    me.video.renderer.cache.put(this.texture, this);
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
                    "repeat" : repeat || "no-repeat"
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
                        offset       : new me.Vector2d(s.x, s.y),
                        anchorPoint  : (hasTextureAnchorPoint) ? new me.Vector2d(originX / s.w, originY / s.h) : null,
                        width        : s.w,
                        height       : s.h,
                        angle        : (frame.rotated === true) ? nhPI : 0
                    };
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
            var spritecount = new me.Vector2d(
                ~~((width - margin + spacing) / (data.framewidth + spacing)),
                ~~((height - margin + spacing) / (data.frameheight + spacing))
            );

            // verifying the texture size
            if ((width % (data.framewidth + spacing)) !== 0 ||
                (height % (data.frameheight + spacing)) !== 0) {
                // "truncate size"
                width = spritecount.x * (data.framewidth + spacing);
                height = spritecount.y * (data.frameheight + spacing);
                // warning message
                console.warn(
                    "Spritesheet Texture for image: " + image.src +
                    " is not divisible by " + (data.framewidth + spacing) +
                    "x" + (data.frameheight + spacing) +
                    ", truncating effective size to " + width + "x" + height
                );
            }

            // build the local atlas
            for (var frame = 0, count = spritecount.x * spritecount.y; frame < count; frame++) {
                atlas["" + frame] = {
                    name: "" + frame,
                    offset: new me.Vector2d(
                        margin + (spacing + data.framewidth) * (frame % spritecount.x),
                        margin + (spacing + data.frameheight) * ~~(frame / spritecount.x)
                    ),
                    anchorPoint: (data.anchorPoint || null),
                    width: data.framewidth,
                    height: data.frameheight,
                    angle: 0
                };
            }

            return atlas;
        },

        /**
         * return the Atlas dictionnary
         * @name getAtlas
         * @memberOf me.CanvasRenderer.Texture
         * @function
         * @return {Object}
         */
        getAtlas : function () {
            return this.atlas;
        },

        /**
         * return the Atlas texture
         * @name getTexture
         * @memberOf me.CanvasRenderer.Texture
         * @function
         * @return {Image}
         */
        getTexture : function () {
            return this.texture;
        },

        /**
         * return a normalized region/frame information for the specified sprite name
         * @name getRegion
         * @memberOf me.CanvasRenderer.Texture
         * @function
         * @param {String} name name of the sprite
         * @return {Object}
         */
        getRegion : function (name) {
            return this.atlas[name];
        },

        /**
         * Create a sprite object using the first region found using the specified name
         * @name createSpriteFromName
         * @memberOf me.CanvasRenderer.Texture
         * @function
         * @param {String} name name of the sprite
         * @param {Object} [settings] Additional settings passed to the {@link me.Sprite} contructor
         * @return {me.Sprite}
         * @example
         * // create a new texture atlas object under the `game` namespace
         * game.texture = new me.video.renderer.Texture(
         *    me.loader.getJSON("texture"),
         *    me.loader.getImage("texture")
         * );
         * ...
         * ...
         * // add the coin sprite as renderable for the entity
         * this.renderable = game.texture.createSpriteFromName("coin.png");
         * // set the renderable position to bottom center
         * this.anchorPoint.set(0.5, 1.0);
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
         * @memberOf me.CanvasRenderer.Texture
         * @function
         * @param {String[]|Number[]} names list of names for each sprite
         * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
         * @param {Object} [settings] Additional settings passed to the {@link me.Sprite} contructor
         * @return {me.Sprite}
         * @example
         * // create a new texture atlas object under the `game` namespace
         * game.texture = new me.video.renderer.Texture(
         *     me.loader.getJSON("texture"),
         *     me.loader.getImage("texture")
         * );
         *
         * // create a new Sprite as renderable for the entity
         * this.renderable = game.texture.createAnimationFromName([
         *     "walk0001.png", "walk0002.png", "walk0003.png",
         *     "walk0004.png", "walk0005.png", "walk0006.png",
         *     "walk0007.png", "walk0008.png", "walk0009.png",
         *     "walk0010.png", "walk0011.png"
         * ]);
         *
         * // define an additional basic walking animation
         * this.renderable.addAnimation ("simple_walk", [0,2,1]);
         * // you can also use frame name to define your animation
         * this.renderable.addAnimation ("speed_walk", ["walk0007.png", "walk0008.png", "walk0009.png", "walk0010.png"]);
         * // set the default animation
         * this.renderable.setCurrentAnimation("simple_walk");
         * // set the renderable position to bottom center
         * this.anchorPoint.set(0.5, 1.0);
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
                    throw new me.video.renderer.Texture.Error("Texture - region for " + names[i] + " not found");
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

    /**
     * Base class for Texture exception handling.
     * @name Error
     * @class
     * @memberOf me.CanvasRenderer.Texture
     * @constructor
     * @param {String} msg Error message.
     */
    me.CanvasRenderer.prototype.Texture.Error = me.Error.extend({
        /**
         * @ignore
         */
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.CanvasRenderer.Texture.Error";
        }
    });
})();
