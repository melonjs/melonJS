import { renderer } from "./video.js";
import * as fileUtil from "./../utils/file.js";
import { Texture, createAtlas } from "./texture.js";
import { isPowerOfTwo} from "./../math/math.js";


/**
 * a basic texture cache object
 * @ignore
 */
class TextureCache {

    /**
     * @ignore
     */
    constructor(max_size) {
        this.cache = new Map();
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
        if (!this.cache.has(image)) {
            if (!atlas) {
                atlas = createAtlas(image.width, image.height, image.src ? fileUtil.getBasename(image.src) : undefined);
            }
            this.set(image, new Texture(atlas, image, false));
        }
        return this.cache.get(image);
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
        var image_cache = this.tinted.get(src);

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
        var width = image.width;
        var height = image.height;

        // warn if a non POT texture is added to the cache when using WebGL1
        if (renderer.WebGLVersion === 1 && (!isPowerOfTwo(width) || !isPowerOfTwo(height))) {
            var src = typeof image.src !== "undefined" ? image.src : image;
            console.warn(
                "[Texture] " + src + " is not a POT texture " +
                "(" + width + "x" + height + ")"
            );
        }
        this.cache.set(image, texture);
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
};

export default TextureCache;
