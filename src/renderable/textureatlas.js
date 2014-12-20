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
     * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx}
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {Object} atlas atlas information. See {@link me.loader#getJSON}
     * @param {Image} [texture=atlas.meta.image] texture name
     * @example
     * // create a texture atlas
     * texture = new me.TextureAtlas (
     *    me.loader.getJSON("texture"),
     *    me.loader.getImage("texture")
     * );
     *
     * // or if you wish to specify the atlas
     */
    me.TextureAtlas = Object.extend(
    /** @scope me.TextureAtlas.prototype */
    {
        /**
         * @ignore
         */
        init : function (atlas, texture) {
            /**
             * to identify the atlas format (e.g. texture packer)
             * @ignore
             */
            this.format = null;

            /**
             * the image texture itself
             * @ignore
             */
            this.texture = texture || null;

            /**
             * the atlas dictionnary
             * @ignore
             */
            this.atlas = null;

            if (atlas && atlas.meta) {
                // Texture Packer
                if (atlas.meta.app.contains("texturepacker")) {
                    this.format = "texturepacker";
                    // set the texture
                    if (typeof(texture) === "undefined") {
                        var name = me.utils.getBasename(atlas.meta.image);
                        this.texture = me.loader.getImage(name);
                        if (this.texture === null) {
                            throw new me.TextureAtlas.Error("Atlas texture '" + name + "' not found");
                        }
                    } else {
                        this.texture = texture;
                    }
                }
                // ShoeBox
                else if (atlas.meta.app.contains("ShoeBox")) {
                    if (!atlas.meta.exporter || !atlas.meta.exporter.contains("melonJS")) {
                        throw new me.TextureAtlas.Error(
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
            }

            // if format not recognized
            if (!this.atlas) {
                throw new me.TextureAtlas.Error("texture atlas format not supported");
            }
        },

        /**
         * @ignore
         */
        build : function (data) {
            var size = data.meta.size;
            var atlas = {};
            data.frames.forEach(function (frame) {
                // fix wrongly formatted JSON (e.g. last dummy object in ShoeBox)
                if (frame.hasOwnProperty("filename")) {
                    // Source coordinates
                    var s = frame.frame;

                    // UV coordinates
                    var u1 = size.w / s.x;
                    var v1 = size.h / s.y;
                    var u2 = size.w / (s.x + s.w);
                    var v2 = size.h / (s.y + s.h);

                    atlas[frame.filename] = {
                        name    : name, // frame name
                        offset  : new me.Vector2d(s.x, s.y),
                        width   : s.w,
                        height  : s.h,
                        angle   : (frame.rotated === true) ? nhPI : 0,
                        uvMap   : new Float32Array([
                            // Upper-left triangle
                            u1, v1,
                            u2, v1,
                            u1, v2,

                            // Lower right triangle
                            u1, v2,
                            u2, v1,
                            u2, v2
                        ])
                    };
                }
            });
            return atlas;
        },

        /**
         * return the Atlas texture
         * @name getTexture
         * @memberOf me.TextureAtlas
         * @function
         * @return {Image}
         */
        getTexture : function () {
            return this.texture;
        },

        /**
         * return a normalized region/frame information for the specified sprite name
         * @name getRegion
         * @memberOf me.TextureAtlas
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
         * @memberOf me.TextureAtlas
         * @function
         * @param {String} name name of the sprite
         * @return {me.Sprite}
         * @example
         * // create a new texture atlas object under the `game` namespace
         * game.texture = new me.TextureAtlas(
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

                /* -> when using anchor positioning, this is not required
                   -> and makes final position wrong...
                if (tex.trimmed===true) {
                    // adjust default position
                    sprite.pos.add(tex.source.pos);
                }
                */
                // return our object
                return sprite;
            }
            // throw an error
            throw new me.TextureAtlas.Error("TextureAtlas - region for " + name + " not found");
        },

        /**
         * Create an animation object using the first region found using all specified names
         * @name createAnimationFromName
         * @memberOf me.TextureAtlas
         * @function
         * @param {String[]} names list of names for each sprite
         * @return {me.AnimationSheet}
         * @example
         * // create a new texture atlas object under the `game` namespace
         * game.texture = new me.TextureAtlas(
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
         * // define an additional basic walking animatin
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
                    throw new me.TextureAtlas.Error("TextureAtlas - region for " + names[i] + " not found");
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
     * Base class for TextureAtlas exception handling.
     * @name Error
     * @class
     * @memberOf me.TextureAtlas
     * @constructor
     * @param {String} msg Error message.
     */
    me.TextureAtlas.Error = me.Error.extend({
        init : function (msg) {
            this._super(me.Error, "init", [ msg ]);
            this.name = "me.TextureAtlas.Error";
        }
    });
})();
