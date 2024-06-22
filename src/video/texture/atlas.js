import Vector2d from "./../../math/vector2.js";
import Sprite from "./../../renderable/sprite.js";
import { renderer } from "./../video.js";
import pool from "./../../system/pooling.js";
import { getImage } from "./../../loader/loader.js";
import { parseTexturePacker } from "./parser/texturepacker.js";
import { parseSpriteSheet } from "./parser/spritesheet.js";
import { parseAseprite } from "./parser/aseprite.js";

/**
 * additional import for TypeScript
 * @import NineSliceSprite from "./../../renderable/nineslicesprite.js";
 */

/**
 * create a simple 1 frame texture atlas based on the given parameters
 * @ignore
 */
export function createAtlas(width, height, name = "default", repeat = "no-repeat") {
    return {
        "meta" : {
            "app" : "melonJS",
            "size" : { "w" : width, "h" : height },
            "repeat" : repeat,
            "image" : "default"
        },
        "frames" : [{
            "filename" : name,
            "frame" : { "x" : 0, "y" : 0, "w" : width, "h" : height }
        }]
    };
}

/**
 * return a string that identifies the texture atlas type
 * @ignore
 */
export function identifyFormat(app) {
    if (app.includes("texturepacker") || app.includes("free-tex-packer")) {
        return "texturepacker";
    } else if (app.includes("shoebox")) {
        return "shoebox";
    } else if (app.includes("aseprite")) {
        return "aseprite";
    } else if (app.includes("melonJS")) {
        return "melonJS";
    } else {
        throw new Error("Unknown texture atlas format: " + app);
    }


}

/**
 * @classdesc
 * A Texture atlas class, currently supports : <br>
 * - [TexturePacker]{@link http://www.codeandweb.com/texturepacker/} : through JSON export (standard and multipack texture atlas) <br>
 * - [Free Texture Packer]{@link http://free-tex-packer.com/app/} : through JSON export (standard and multipack texture atlas) <br>
 * - [aseprite]{@link https://www.aseprite.org/} : through JSON export (standard and multipack texture atlas) <br>
 * - [ShoeBox]{@link http://renderhjs.net/shoebox/} : through JSON export using the
 * melonJS setting [file]{@link https://github.com/melonjs/melonJS/raw/master/media/shoebox_JSON_export.sbx} <br>
 * - Standard (fixed cell size) spritesheet : through a {framewidth:xx, frameheight:xx, anchorPoint:me.Vector2d} object
 * );
 */
export class TextureAtlas {
    /**
     * @param {object|object[]} atlases - atlas information. See {@link loader.getJSON}
     * @param {HTMLImageElement|HTMLCanvasElement|string|HTMLImageElement[]|HTMLCanvasElement[]|string[]} [src=atlas.meta.image] - Image source
     * @param {boolean} [cache=false] - Use true to skip caching this Texture
     * @example
     * // create a texture atlas from a JSON Object
     * game.texture = new me.TextureAtlas(
     *     me.loader.getJSON("texture")
     * );
     *
     * // create a texture atlas from a multipack JSON Object
     * game.texture = new me.TextureAtlas([
     *     me.loader.getJSON("texture-0"),
     *     me.loader.getJSON("texture-1"),
     *     me.loader.getJSON("texture-2")
     * ]);
     *
     * // create a texture atlas for a spritesheet with an anchorPoint in the center of each frame
     * game.texture = new me.TextureAtlas(
     *     {
     *         framewidth : 32,
     *         frameheight : 32,
     *         anchorPoint : new me.Vector2d(0.5, 0.5)
     *     },
     *     me.loader.getImage("spritesheet")
     */
    constructor (atlases, src, cache) {
        /**
         * to identify the atlas format (e.g. texture packer)
         * @ignore
         */
        this.format = null;

        /**
         * the texture source(s) itself
         * @type {Map}
         * @ignore
         */
        this.sources = new Map();

        /**
         * the atlas dictionnaries
         * @type {Map}
         * @ignore
         */
        this.atlases = new Map();

        /**
         * the default "active" atlas (used for multiAtlas)
         * @type {Map}
         * @ignore
         */
        this.activeAtlas = undefined;


        // parse given atlas(es) paremeters
        if (typeof (atlases) !== "undefined") {
            // normalize to array to keep the following code generic
            atlases = Array.isArray(atlases) ? atlases : [atlases];
            for (let i in atlases) {
                let atlas = atlases[i];

                if (typeof(atlas.meta) !== "undefined") {
                    this.format = identifyFormat(atlas.meta.app);
                    this.repeat = atlas.meta.repeat || "no-repeat";
                    switch (this.format) {
                        case "texturepacker":
                        case "aseprite":
                            // set the texture
                            if (typeof(src) === "undefined") {
                                // get the texture name from the atlas meta data
                                let image = getImage(atlas.meta.image);
                                if (!image) {
                                    throw new Error(
                                        "Atlas texture '" + image + "' not found"
                                    );
                                }
                                this.sources.set(atlas.meta.image, image);
                            } else {
                                this.sources.set(atlas.meta.image || "default", typeof src === "string" ? getImage(src) : src);
                            }
                            // initialize the atlas
                            if (this.format === "texturepacker") {
                                this.atlases.set(atlas.meta.image || "default", parseTexturePacker(atlas, this));
                            } else {
                                this.atlases.set(atlas.meta.image || "default", parseAseprite(atlas, this));
                            }
                            break;
                        case "shoebox":
                            if (!atlas.meta.exporter || !atlas.meta.exporter.includes("melonJS")) {
                                throw new Error(
                                    "ShoeBox requires the JSON exporter : " +
                                    "https://github.com/melonjs/melonJS/tree/master/media/shoebox_JSON_export.sbx"
                                );
                            }
                            this.sources.set("default", typeof src === "string" ? getImage(src) : src);
                            // initialize the atlas
                            this.atlases.set(atlas.meta.image || "default", parseTexturePacker(atlas, this));
                            break;
                        case "melonJS":
                            this.sources.set("default", typeof src === "string" ? getImage(src) : src);
                            // initialize the atlas
                            this.atlases.set(atlas.meta.image || "default", parseTexturePacker(atlas, this));
                            break;
                        default:
                            throw new Error("Unknown texture atlas format: " + atlas.meta.app);
                    }
                } else {
                    // a regular spritesheet
                    if (typeof(atlas.framewidth) !== "undefined" &&
                        typeof(atlas.frameheight) !== "undefined") {
                        this.format = "Spritesheet (fixed cell size)";
                        this.repeat = "no-repeat";

                        if (typeof(src) !== "undefined") {
                            // overwrite if specified
                            atlas.image = typeof src === "string" ? getImage(src) : src;
                        }
                        // initialize the atlas
                        this.atlases.set("default", parseSpriteSheet(atlas, this));
                        this.sources.set("default", atlas.image);
                    }
                }
            } // end forEach
            this.activeAtlas = this.atlases.keys().next().value;
        }

        // if format not recognized
        if (this.atlases.length === 0) {
            throw new Error("texture atlas format not supported");
        }

        // Add self to TextureCache if cache !== false
        if (cache !== false) {
            this.sources.forEach((source) => {
                renderer.cache.set(source, this);
            });
        }
    }

    /**
     * return the default or specified atlas dictionnary
     * @param {string} [name] - atlas name in case of multipack textures
     * @returns {object}
     */
    getAtlas(name) {
        if (typeof name === "string") {
            return this.atlases.get(name);
        } else {
            return this.atlases.get(this.activeAtlas);
        }
    }

    /**
     * return the format of the atlas dictionnary
     * @returns {string} will return "texturepacker", or "ShoeBox", or "melonJS", or "Spritesheet (fixed cell size)"
     */
    getFormat() {
        return this.format;
    }

    /**
     * return the source texture for the given region (or default one if none specified)
     * @param {object} [region] - region name in case of multipack textures
     * @returns {HTMLImageElement|HTMLCanvasElement}
     */
    getTexture(region) {
        if ((typeof region === "object") && (typeof region.texture === "string")) {
            return this.sources.get(region.texture);
        } else {
            return this.sources.get(this.activeAtlas);

        }
    }

    /**
     * add a region to the atlas
     * @param {string} name - region mame
     * @param {number} x - x origin of the region
     * @param {number} y - y origin of the region
     * @param {number} w - width of the region
     * @param {number} h - height of the region
     * @returns {object} the created region
     */
    addRegion(name, x, y, w, h) {
        // TODO: Require proper atlas regions instead of caching arbitrary region keys
        if (renderer.settings.verbose === true) {
            console.warn("Adding texture region", name, "for texture", this);
        }

        let source = this.getTexture();
        let atlas = this.getAtlas();
        let dw = source.width;
        let dh = source.height;

        atlas[name] = {
            name    : name,
            offset  : new Vector2d(x, y),
            width   : w,
            height  : h,
            angle   : 0
        };

        this.addUVs(atlas, name, dw, dh);

        return atlas[name];
    }

    /**
     * return a normalized region (or frame) information for the specified sprite name
     * @param {string} name - name of the sprite
     * @param {string} [atlas] - name of a specific atlas where to search for the region
     * @returns {object}
     */
    getRegion(name, atlas) {
        let region;
        if (typeof atlas === "string") {
            region = this.getAtlas(atlas)[name];
        } else {
            // look for the given region in each existing atlas
            for (let atlas of this.atlases.values()) {
                if (typeof atlas[name] !== "undefined") {
                    // there should be only one
                    region = atlas[name];
                    break;
                }
            }
        }
        return region;
    }

    /**
     * return the uvs mapping for the given region
     * @param {object} name - region (or frame) name
     * @returns {Float32Array} region Uvs
     */
    getUVs(name) {
        // Get the source texture region
        let region = this.getRegion(name);

        if (typeof(region) === "undefined") {
            // TODO: Require proper atlas regions instead of caching arbitrary region keys
            let keys = name.split(","),
                sx = +keys[0],
                sy = +keys[1],
                sw = +keys[2],
                sh = +keys[3];
            region = this.addRegion(name, sx, sy, sw, sh);
        }
        return region.uvs;
    }

    /**
     * add uvs mapping for the given region
     * @param {object} atlas - the atlas dictionnary where the region is define
     * @param {object} name - region (or frame) name
     * @param {number} w - the width of the region
     * @param {number} h - the height of the region
     * @returns {Float32Array} the created region UVs
     */
    addUVs(atlas, name, w, h) {
        // ignore if using the Canvas Renderer
        if (typeof renderer.gl !== "undefined") {
            // Source coordinates
            let s = atlas[name].offset;
            let sw = atlas[name].width;
            let sh = atlas[name].height;

            atlas[name].uvs = new Float32Array([
                s.x / w,        // u0 (left)
                s.y / h,        // v0 (top)
                (s.x + sw) / w, // u1 (right)
                (s.y + sh) / h  // v1 (bottom)
            ]);
            // Cache source coordinates
            // TODO: Remove this when the Batcher only accepts a region name
            let key = s.x + "," + s.y + "," + w + "," + h;
            atlas[key] = atlas[name];
        }
        return atlas[name].uvs;
    }

    /**
     * Create a sprite object using the first region found using the specified name
     * @param {string} name - name of the sprite
     * @param {object} [settings] - Additional settings passed to the {@link Sprite} contructor
     * @param {boolean} [nineSlice=false] - if true returns a 9-slice sprite
     * @returns {Sprite|NineSliceSprite}
     * @example
     * // create a new texture object under the `game` namespace
     * game.texture = new me.TextureAtlas(
     *    me.loader.getJSON("texture"),
     *    me.loader.getImage("texture")
     * );
     * ...
     * ...
     * // create a new "coin" sprite
     * let sprite = game.texture.createSpriteFromName("coin.png");
     * // set the renderable position to bottom center
     * sprite.anchorPoint.set(0.5, 1.0);
     * ...
     * ...
     * // create a 9-slice sprite
     * let dialogPanel = game.texture.createSpriteFromName(
     *    "rpg_dialo.png",
     *    // width & height are mandatory for 9-slice sprites
     *    { width: this.width, height: this.height },
     *    true
     * );
     */
    createSpriteFromName(name, settings, nineSlice = false) {
        // instantiate a new sprite object
        return pool.pull(
            nineSlice === true ? "me.NineSliceSprite" : "me.Sprite",
            0, 0,
            Object.assign({
                image: this,
                region : name
            }, settings || {})
        );
    }

    /**
     * Create an animation object using the first region found using all specified names
     * @param {string[]|number[]} [names] - list of names for each sprite (if not specified all defined names/entries in the atlas will be added)
     * (when manually creating a Texture out of a spritesheet, only numeric values are authorized)
     * @param {object} [settings] - Additional settings passed to the {@link Sprite} contructor
     * @returns {Sprite}
     * @example
     * // create a new texture object under the `game` namespace
     * game.texture = new me.TextureAtlas(
     *     me.loader.getJSON("texture"),
     *     me.loader.getImage("texture")
     * );
     *
     * // create a new Animated Sprite
     * let sprite = game.texture.createAnimationFromName([
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
    createAnimationFromName(names, settings) {
        let tpAtlas = [], indices = {};
        let width = 0, height = 0;
        const textureAtlas = this.getAtlas();
        // iterate through the given names
        // and create a "normalized" atlas

        if (typeof names === "undefined") {
            names = textureAtlas;
        }

        for (const i in names) {
            const name = Array.isArray(names) ? names[i] : i;
            const region = this.getRegion(name);
            if (region == null) {
                // throw an error
                throw new Error("Texture - region for " + name + " not found");
            }
            tpAtlas.push(region);
            // save the corresponding index
            indices[name] = tpAtlas.length - 1;
            // calculate the max size of a frame
            width = Math.max(region.width, width);
            height = Math.max(region.height, height);
        }

        // instantiate a new animation sheet object
        return new Sprite(0, 0, Object.assign({
            image: this,
            framewidth: width,
            frameheight: height,
            margin: 0,
            spacing: 0,
            atlas: tpAtlas,
            anims: textureAtlas.anims,
            atlasIndices: indices
        }, settings || {}));
    }
}
