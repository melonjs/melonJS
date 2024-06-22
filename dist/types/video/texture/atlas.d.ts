/**
 * additional import for TypeScript
 * @import NineSliceSprite from "./../../renderable/nineslicesprite.js";
 */
/**
 * create a simple 1 frame texture atlas based on the given parameters
 * @ignore
 */
export function createAtlas(width: any, height: any, name?: string, repeat?: string): {
    meta: {
        app: string;
        size: {
            w: any;
            h: any;
        };
        repeat: string;
        image: string;
    };
    frames: {
        filename: string;
        frame: {
            x: number;
            y: number;
            w: any;
            h: any;
        };
    }[];
};
/**
 * return a string that identifies the texture atlas type
 * @ignore
 */
export function identifyFormat(app: any): "texturepacker" | "shoebox" | "aseprite" | "melonJS";
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
    constructor(atlases: object | object[], src?: string | string[] | HTMLCanvasElement | HTMLImageElement | HTMLImageElement[] | HTMLCanvasElement[] | undefined, cache?: boolean | undefined);
    /**
     * to identify the atlas format (e.g. texture packer)
     * @ignore
     */
    format: string | null;
    /**
     * the texture source(s) itself
     * @type {Map}
     * @ignore
     */
    sources: Map<any, any>;
    /**
     * the atlas dictionnaries
     * @type {Map}
     * @ignore
     */
    atlases: Map<any, any>;
    /**
     * the default "active" atlas (used for multiAtlas)
     * @type {Map}
     * @ignore
     */
    activeAtlas: Map<any, any>;
    repeat: any;
    /**
     * return the default or specified atlas dictionnary
     * @param {string} [name] - atlas name in case of multipack textures
     * @returns {object}
     */
    getAtlas(name?: string | undefined): object;
    /**
     * return the format of the atlas dictionnary
     * @returns {string} will return "texturepacker", or "ShoeBox", or "melonJS", or "Spritesheet (fixed cell size)"
     */
    getFormat(): string;
    /**
     * return the source texture for the given region (or default one if none specified)
     * @param {object} [region] - region name in case of multipack textures
     * @returns {HTMLImageElement|HTMLCanvasElement}
     */
    getTexture(region?: object | undefined): HTMLImageElement | HTMLCanvasElement;
    /**
     * add a region to the atlas
     * @param {string} name - region mame
     * @param {number} x - x origin of the region
     * @param {number} y - y origin of the region
     * @param {number} w - width of the region
     * @param {number} h - height of the region
     * @returns {object} the created region
     */
    addRegion(name: string, x: number, y: number, w: number, h: number): object;
    /**
     * return a normalized region (or frame) information for the specified sprite name
     * @param {string} name - name of the sprite
     * @param {string} [atlas] - name of a specific atlas where to search for the region
     * @returns {object}
     */
    getRegion(name: string, atlas?: string | undefined): object;
    /**
     * return the uvs mapping for the given region
     * @param {object} name - region (or frame) name
     * @returns {Float32Array} region Uvs
     */
    getUVs(name: object): Float32Array;
    /**
     * add uvs mapping for the given region
     * @param {object} atlas - the atlas dictionnary where the region is define
     * @param {object} name - region (or frame) name
     * @param {number} w - the width of the region
     * @param {number} h - the height of the region
     * @returns {Float32Array} the created region UVs
     */
    addUVs(atlas: object, name: object, w: number, h: number): Float32Array;
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
    createSpriteFromName(name: string, settings?: object | undefined, nineSlice?: boolean | undefined): Sprite | NineSliceSprite;
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
    createAnimationFromName(names?: string[] | number[] | undefined, settings?: object | undefined): Sprite;
}
import Sprite from "./../../renderable/sprite.js";
import type NineSliceSprite from "./../../renderable/nineslicesprite.js";
