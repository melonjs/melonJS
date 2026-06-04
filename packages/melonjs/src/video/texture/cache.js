import { emit, GPU_TEXTURE_CACHE_RESET } from "../../system/event.ts";
import { ArrayMultimap } from "../../utils/array-multimap.js";
import { getBasename } from "../../utils/file.ts";
import { createAtlas, TextureAtlas } from "./atlas.js";

/**
 * a basic texture cache object
 * @ignore
 */
class TextureCache {
	/**
	 * @ignore
	 */
	constructor(renderer, max_size = Infinity) {
		// reference to the renderer that owns this cache
		this.renderer = renderer;
		// cache uses an array to allow for duplicated key
		this.cache = new ArrayMultimap();
		this.tinted = new Map();
		// `units` keys each (source, repeat-mode) pair to a distinct GL
		// texture unit. Keying by source alone (pre-19.7.0) collided
		// when the same image was used as both a sprite/atlas AND a
		// pattern, or as multiple patterns with different repeat modes —
		// see https://github.com/melonjs/melonJS/issues/1448. The nested
		// Map keeps the outer key the source object (preserves the
		// implicit "GC the source → drop the units" hygiene) and adds
		// the wrap mode as the inner discriminator.
		this.units = new Map();
		this.usedUnits = new Set();
		this.max_size = max_size;
		this.clear();
	}

	/**
	 * @ignore
	 * Resolve the `(source, repeat)` pair for a TextureAtlas. Defaults
	 * the repeat to `"no-repeat"` to match `atlas.js`'s own default,
	 * so a TextureAtlas without an explicit `repeat` keys consistently
	 * regardless of how it was constructed.
	 */
	_unitKey(texture) {
		return {
			source: texture.sources.get(texture.activeAtlas),
			repeat: texture.repeat || "no-repeat",
		};
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

		// No units available — flush the current batch and reset assignments
		// see https://github.com/melonjs/melonJS/issues/1280
		if (this.renderer.currentBatcher) {
			this.renderer.currentBatcher.flush();
		}
		this.units.clear();
		this.usedUnits.clear();
		this.usedUnits.add(0);
		emit(GPU_TEXTURE_CACHE_RESET);
		return 0;
	}

	/**
	 * Reset all texture unit assignments without clearing the texture cache.
	 * Used by multi-texture batching when the shader's sampler range is exceeded.
	 * @ignore
	 */
	resetUnitAssignments() {
		this.units.clear();
		this.usedUnits.clear();
		emit(GPU_TEXTURE_CACHE_RESET);
	}

	/**
	 * @ignore
	 */
	freeTextureUnit(texture) {
		const { source, repeat } = this._unitKey(texture);
		const perRepeat = this.units.get(source);
		const unit = perRepeat?.get(repeat);
		// was a texture unit allocated ?
		if (typeof unit !== "undefined") {
			this.usedUnits.delete(unit);
			perRepeat.delete(repeat);
			if (perRepeat.size === 0) {
				this.units.delete(source);
			}
		}
	}

	/**
	 * @ignore
	 */
	getUnit(texture) {
		const { source, repeat } = this._unitKey(texture);
		let perRepeat = this.units.get(source);
		if (perRepeat === undefined) {
			perRepeat = new Map();
			this.units.set(source, perRepeat);
		}
		if (!perRepeat.has(repeat)) {
			perRepeat.set(repeat, this.allocateTextureUnit());
		}
		return perRepeat.get(repeat);
	}

	/**
	 * @ignore
	 * return the texture unit for the given texture, or -1 if not allocated
	 */
	peekUnit(texture) {
		const { source, repeat } = this._unitKey(texture);
		const perRepeat = this.units.get(source);
		return perRepeat?.has(repeat) ? perRepeat.get(repeat) : -1;
	}

	/**
	 * @ignore
	 * cache the textureAltas for the given image
	 */
	set(image, textureAtlas) {
		return this.cache.put(image, textureAtlas);
	}

	/**
	 * @ignore
	 */
	has(image) {
		return this.cache.has(image);
	}

	/**
	 * @ignore
	 * return the textureAltas for the given image
	 */
	get(image, atlas) {
		let entry = this.cache.get(image)[0];

		if (typeof entry !== "undefined" && typeof atlas !== "undefined") {
			this.cache.forEach((value, key) => {
				const _atlas = value.getAtlas();
				if (
					key === image &&
					_atlas.width === atlas.framewidth &&
					_atlas.height === atlas.frameheight
				) {
					entry = value;
				}
			});
		}

		if (typeof entry === "undefined") {
			if (!atlas) {
				atlas = createAtlas(
					image.width || image.videoWidth,
					image.height || image.videoHeight,
					image.src ? getBasename(image.src) : undefined,
				);
			}
			entry = new TextureAtlas(atlas, image, false);
			this.set(image, entry);
		}

		// "activate" the corresponding sources (in case of multi texture atlas)
		if (typeof entry.sources !== "undefined" && entry.sources.size > 1) {
			// manage cases where a specific atlas is specified
			for (const [key, value] of entry.sources.entries()) {
				// Check if the imageData matches the provided image
				if (value === image) {
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
			const texture = this.cache.get(image)[0];
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
			image_cache = new Map();
			this.tinted.set(src, image_cache);
		}

		if (!image_cache.has(color)) {
			image_cache.set(color, this.renderer.tint(src, color, "multiply"));
		}

		return image_cache.get(color);
	}
}
export default TextureCache;
