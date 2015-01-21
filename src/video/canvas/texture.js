/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
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
     * A Texture atlas object<br>
     * Currently support : <br>
     * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export <br>
     * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
     * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
     * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx} object
     * @class
     * @extends Object
     * @memberOf me.video.renderer
     * @name Texture
     * @constructor
     * @param {Object} atlas atlas information. See {@link me.loader#getJSON}
     * @param {Image} [texture=atlas.meta.image] texture name
     * @param {Boolean} [cached=false] Use true to skip caching this Texture
     * @example
     * // create a texture atlas from a JSON Object
     * texture = new me.video.renderer.Texture(
     *    me.loader.getJSON("texture"),
     *    me.loader.getImage("texture")
     * );
     *
     * // create a texture atlas for a spritesheet
     * texture = new me.video.renderer.Texture(
     *    {framewidth:32, frameheight:32},
     *    me.loader.getImage("spritesheet")
     * );
     */
    me.CanvasRenderer.prototype.Texture = Object.extend(
    /** @scope me.video.renderer.Texture.prototype */
    {
        /**
         * @ignore
         */
        init : function (atlas, texture, cached) {
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
                    if (atlas.meta.app.contains("texturepacker")) {
                        this.format = "texturepacker";
                        // set the texture
                        if (typeof(texture) === "undefined") {
                            var name = me.utils.getBasename(atlas.meta.image);
                            this.texture = me.loader.getImage(name);
                            if (this.texture === null) {
                                throw new me.video.renderer.Texture.Error("Atlas texture '" + name + "' not found");
                            }
                        } else {
                            this.texture = texture;
                        }
                    }
                    // ShoeBox
                    else if (atlas.meta.app.contains("ShoeBox")) {
                        if (!atlas.meta.exporter || !atlas.meta.exporter.contains("melonJS")) {
                            throw new me.video.renderer.Texture.Error(
                                "ShoeBox requires the JSON exporter : " +
                                "https://github.com/melonjs/melonJS/tree/master/media/shoebox_JSON_export.sbx"
                            );
                        }
                        this.format = "ShoeBox";
                        // set the texture
                        this.texture = texture;
                    }
                    // Internal texture atlas
                    else if (atlas.meta.app.contains("melonJS")) {
                        this.format = "melonJS";
                        this.texture = texture;
                    }
                    // initialize the atlas
                    this.atlas = this.build(atlas);

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
                        this.atlas = this.buildFromSpriteSheet(atlas);
                    }
                }
            }
            // if format not recognized
            if (!this.atlas) {
                throw new me.video.renderer.Texture.Error("texture atlas format not supported");
            }

            // Add self to TextureCache
            if (!cached) {
                me.video.renderer.cache.put(this.texture, this);
            }
        },

        /**
         * @ignore
         */
        build : function (data) {
            var atlas = {};
            data.frames.forEach(function (frame) {
                // fix wrongly formatted JSON (e.g. last dummy object in ShoeBox)
                if (frame.hasOwnProperty("filename")) {
                    // Source coordinates
                    var s = frame.frame;

                    atlas[frame.filename] = {
                        name    : name, // frame name
                        offset  : new me.Vector2d(s.x, s.y),
                        width   : s.w,
                        height  : s.h,
                        angle   : (frame.rotated === true) ? nhPI : 0
                    };
                }
            });
            return atlas;
        },

        /**
         * build an atlas from the given spritesheet
         * @ignore
         */
        buildFromSpriteSheet : function (data) {
            var atlas = {};
            var image = data.image;
            var spacing = data.spacing || 0;
            var margin = data.margin || 0;
            
            var width = image.width;
            var height = image.height;

            // calculate the sprite count (line, col)            
            var spritecount = new me.Vector2d(
                ~~((width - margin) / (data.framewidth + spacing)),
                ~~((height - margin) / (data.frameheight + spacing))
            );
            
            // verifying the texture size
            if (((width - margin) % (data.framewidth + spacing) !== 0 ||
                (height - margin) % (data.frameheight + spacing) !== 0)) {
                // "truncate size"
                width = margin + spritecount.x * (data.framewidth + spacing);
                height = margin + spritecount.y * (data.frameheight + spacing);
                // warning message
                console.warn(
                    "Spritesheet Texture for image: " + image.src +
                    " is not divisible by " + (data.framewidth + spacing) +
                    "x" + (data.frameheight + spacing) +
                    ", truncating effective size to " + width + "x" + height
                );
            }
            
            // build the local atlas
            for (var frame = 0, count = spritecount.x * spritecount.y; frame < count ; frame++) {
                atlas["" + frame] = {
                    name: "" + frame,
                    offset: new me.Vector2d(
                        margin + (spacing + data.framewidth) * (frame % spritecount.x),
                        margin + (spacing + data.frameheight) * ~~(frame / spritecount.x)
                    ),
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
         * @memberOf me.video.renderer.Texture
         * @function
         * @return {Object}
         */
        getAtlas : function () {
            return this.atlas;
        },

        /**
         * return the Atlas texture
         * @name getTexture
         * @memberOf me.video.renderer.Texture
         * @function
         * @return {Image}
         */
        getTexture : function () {
            return this.texture;
        },

        /**
         * return a normalized region/frame information for the specified sprite name
         * @name getRegion
         * @memberOf me.video.renderer.Texture
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
         * @memberOf me.video.renderer.Texture
         * @function
         * @param {String} name name of the sprite
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
        createSpriteFromName : function (name) {
            var region = this.getRegion(name);
            if (region) {
                // instantiate a new sprite object
                var sprite = new me.Sprite(
                    0, 0,
                    this.getTexture(),
                    region.width, region.height
                );
                // set the sprite offset within the texture
                sprite.offset.setV(region.offset);
                // set angle if defined
                sprite._sourceAngle = region.angle;

                // return our object
                return sprite;
            }
            // throw an error
            throw new me.video.renderer.Texture.Error("Texture - region for " + name + " not found");
        },

        /**
         * Create an animation object using the first region found using all specified names
         * @name createAnimationFromName
         * @memberOf me.video.renderer.Texture
         * @function
         * @param {String[]|Number[]} names list of names for each sprite
         * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
         * @return {me.AnimationSheet}
         * @example
         * // create a new texture atlas object under the `game` namespace
         * game.texture = new me.video.renderer.Texture(
         *    me.loader.getJSON("texture"),
         *    me.loader.getImage("texture")
         * );
         * ...
         * ...
         * // create a new animationSheet as renderable for the entity
         * this.renderable = game.texture.createAnimationFromName([
         *   "walk0001.png", "walk0002.png", "walk0003.png",
         *   "walk0004.png", "walk0005.png", "walk0006.png",
         *   "walk0007.png", "walk0008.png", "walk0009.png",
         *   "walk0010.png", "walk0011.png"
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
        createAnimationFromName : function (names) {
            var tpAtlas = [], indices = {};
            // iterate through the given names
            // and create a "normalized" atlas
            for (var i = 0; i < names.length;++i) {
                tpAtlas[i] = this.getRegion(names[i]);
                indices[names[i]] = i;
                if (tpAtlas[i] == null) {
                    // throw an error
                    throw new me.video.renderer.Texture.Error("Texture - region for " + names[i] + " not found");
                }
            }
            // instantiate a new animation sheet object
            return new me.AnimationSheet(0, 0, {
                image: this.texture,
                framewidth: 0,
                frameheight: 0,
                margin: 0,
                spacing: 0,
                atlas: tpAtlas,
                atlasIndices: indices
            });
        }
    });

    /**
     * Base class for Texture exception handling.
     * @name Error
     * @class
     * @memberOf me.video.renderer.Texture
     * @constructor
     * @param {String} msg Error message.
     */
    me.CanvasRenderer.prototype.Texture.Error = me.Error.extend({
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.CanvasRenderer.Texture.Error";
        }
    });
})();
