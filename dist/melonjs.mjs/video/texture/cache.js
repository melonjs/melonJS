/*!
 * melonJS Game Engine - v15.2.1
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2023 Olivier Biot (AltByte Pte Ltd)
 */
import { renderer } from '../video.js';
import { getBasename } from '../../utils/file.js';
import { createAtlas, TextureAtlas } from './atlas.js';
import { isPowerOfTwo } from '../../math/math.js';
import { ArrayMultimap } from '../../node_modules/@teppeis/multimaps/dist/esm/arraymultimap.js';

/**
 * a basic texture cache object
 * @ignore
 */
class TextureCache {

    /**
     * @ignore
     */
    constructor(max_size) {
        // cache uses an array to allow for duplicated key
        this.cache = new ArrayMultimap();
        this.tinted = new Map();
        this.units = new Map();
        this.max_size = max_size || Infinity;
        this.clear();
    }

    /**
     * @ignore
     */
    clear() {
        this.cache.clear();
        this.tinted.clear();
        this.units.clear();
        this.length = 0;
    }

    /**
     * @ignore
     */
    validate() {
        if (this.length >= this.max_size) {
            // TODO: Merge textures instead of throwing an exception
            throw new Error(
                "Texture cache overflow: " + this.max_size +
                " texture units available for this GPU."
            );
        }
    }

    /**
     * @ignore
     */
    get(image, atlas) {
        let entry;

        if (typeof atlas === "undefined") {
            entry = this.cache.get(image)[0];
        } else {
            // manage cases where a specific atlas is specified
            this.cache.forEach((value, key) => {
                let _atlas = value.getAtlas()[0];
                if (key === image && _atlas.width === atlas.framewidth && _atlas.height === atlas.frameheight) {
                    entry = value;
                }
            });
        }

        if (typeof entry === "undefined") {
            if (!atlas) {
                atlas = createAtlas(image.width, image.height, image.src ? getBasename(image.src) : undefined);
            }
            entry = new TextureAtlas(atlas, image, false);
            this.set(image, entry);
        }

        return entry;
    }

    /**
     * @ignore
     */
    delete(image) {
        if (!this.cache.has(image)) {
            this.cache.delete(image);
        }
    }

    /**
     * @ignore
     */
    tint(src, color) {
        // make sure the src is in the cache
        let image_cache = this.tinted.get(src);

        if (image_cache === undefined) {
            image_cache = this.tinted.set(src, new Map());
        }

        if (!image_cache.has(color)) {
            image_cache.set(color, renderer.tint(src, color, "multiply"));
        }

        return image_cache.get(color);
    }

    /**
     * @ignore
     */
    set(image, texture) {
        let width = image.width;
        let height = image.height;

        // warn if a non POT texture is added to the cache when using WebGL1
        if (renderer.WebGLVersion === 1 && (!isPowerOfTwo(width) || !isPowerOfTwo(height))) {
            let src = typeof image.src !== "undefined" ? image.src : image;
            console.warn(
                "[Texture] " + src + " is not a POT texture " +
                "(" + width + "x" + height + ")"
            );
        }
        return this.cache.put(image, texture);
    }

    /**
     * @ignore
     */
    getUnit(texture) {
        if (!this.units.has(texture)) {
            this.validate();
            this.units.set(texture, this.length++);
        }
        return this.units.get(texture);
    }
}
var TextureCache$1 = TextureCache;

export { TextureCache$1 as default };
