/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
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
    constructor(max_size = Infinity) {
        // cache uses an array to allow for duplicated key
        this.cache = new ArrayMultimap();
        this.tinted = new Map();
        this.units = new Map();
        this.usedUnits = new Set();
        this.max_size = max_size;
        this.clear();
    }

    /**
     * @ignore
     */
    clear() {
        this.cache.clear();
        this.tinted.clear();
        this.units.clear();
        this.usedUnits.clear();
    }

    /**
     * @ignore
     */
    allocateTextureUnit() {
        // find the first unit available among the max_size
        for (let unit = 0; unit < this.max_size; unit++) {
            // Check if unit is available
            if (!this.usedUnits.has(unit)) {
                // Add to used set
                this.usedUnits.add(unit);
                // return the new unit
                return unit;
            }
        }

        // No units available
        // TODO: Merge textures instead of throwing an exception
        throw new Error(
            "Texture cache overflow: " + this.max_size +
            " texture units available for this GPU."
        );
    }

    /**
     * @ignore
     */
    freeTextureUnit(texture) {
        let source = texture.sources.get(texture.activeAtlas);
        let unit = this.units.get(source);
        // was a texture unit allocated ?
        if (typeof unit !== "undefined") {
            this.usedUnits.delete(source);
            this.units.delete(source);
        }
    }

    /**
     * @ignore
     */
    getUnit(texture) {
        let source = texture.sources.get(texture.activeAtlas);
        if (!this.units.has(source)) {
            this.units.set(source, this.allocateTextureUnit());
        }
        return this.units.get(source);
    }

    /**
     * @ignore
     * cache the textureAltas for the given image
     */
    set(image, textureAtlas) {
        let width = image.width || image.videoWidth;
        let height = image.height || image.videoHeight;

        // warn if a non POT texture is added to the cache when using WebGL1
        if (renderer.WebGLVersion === 1 && (!isPowerOfTwo(width) || !isPowerOfTwo(height))) {
            let src = typeof image.src !== "undefined" ? image.src : image;
            console.warn(
                "[Texture] " + src + " is not a POT texture " +
                "(" + width + "x" + height + ")"
            );
        }
        return this.cache.put(image, textureAtlas);
    }

    /**
     * @ignore
     * return the textureAltas for the given image
     */
    get(image, atlas) {
        let entry = this.cache.get(image)[0];

        if (typeof entry !== "undefined" && typeof atlas !== "undefined") {
            this.cache.forEach((value, key) => {
                let _atlas = value.getAtlas();
                if (key === image && _atlas.width === atlas.framewidth && _atlas.height === atlas.frameheight) {
                    entry = value;
                }
            });
        }

        if (typeof entry === "undefined") {
            console.log("cache miss");
            if (!atlas) {
                atlas = createAtlas(image.width || image.videoWidth, image.height || image.videoHeight, image.src ? getBasename(image.src) : undefined);
            }
            entry = new TextureAtlas(atlas, image, false);
            this.set(image, entry);
        }

        // "activate" the corresponding sources (in case of multi texture atlas)
        if (typeof entry.sources !== "undefined" && entry.sources.size > 1) {
            console.log(entry);
            // manage cases where a specific atlas is specified
            for (const [key, value] of entry.sources.entries()) {
                // Check if the imageData matches the provided image
                if (value === image) {
                    console.log("cache hit");
                    // If a match is found, return the corresponding entry from cache.atlases
                    console.log(key);
                    //return entry.atlases.get(key);
                    entry.activeAtlas = key;
                }
            }
        }

        return entry;
    }

    /**
     * @ignore
     */
    delete(image) {
        if (this.cache.has(image)) {
            let texture = this.cache.get(image)[0];
            if (typeof texture !== "undefined") {
                this.freeTextureUnit(texture);
            }
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

}

export { TextureCache as default };
