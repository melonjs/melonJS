import { emit, GPU_TEXTURE_CACHE_RESET } from "../../system/event.ts";
import { ArrayMultimap } from "../../utils/array-multimap.js";
import { getBasename } from "../../utils/file.ts";
import { createAtlas, TextureAtlas } from "./atlas.js";

// Canonical repeat values accepted by `CanvasRenderingContext2D.createPattern`
// (per WHATWG Canvas2D spec). Anything outside this set is silently clamped
// to `"no-repeat"` at the GL wrap-mode mapping; the cache normalizes here so
// a typo'd repeat string (e.g. `"repat-x"`) doesn't allocate its own unit
// indefinitely and leak texture-unit slots.
const VALID_REPEATS = new Set(["repeat", "repeat-x", "repeat-y", "no-repeat"]);
function normalizeRepeat(repeat) {
	return VALID_REPEATS.has(repeat) ? repeat : "no-repeat";
}

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
		// `Map<source, Map<repeat, unit>>` discriminates by wrap mode
		// while keeping the outer key the source object so it lines up
		// with the rest of the cache's source-keyed API (`set` / `has` /
		// `get` / `delete` all take an image). Explicit eviction happens
		// via `delete(image)` (free all repeats) and `clear()` (wipe the
		// whole map); `Map` keys are strong references, so the entries
		// don't drop when the source goes out of scope user-side.
		this.units = new Map();
		this.usedUnits = new Set();
		// units held out of `allocateTextureUnit` for shader extra-samplers
		// (`ShaderEffect.setTexture`). Reference-counted (unit → count) so a
		// unit shared by several effects stays reserved until the last one
		// releases it. Not touched by `clear()` — reservations are owned by the
		// effects, and released on their destroy / context-loss.
		this.reservedUnits = new Map();
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
		// find the first unit available among the max_size (skip units held
		// for shader extra-samplers via `reserveUnit`)
		for (let unit = 0; unit < this.max_size; unit++) {
			// Check if unit is available
			if (!this.usedUnits.has(unit) && !this.reservedUnits.has(unit)) {
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
		// return the first non-reserved unit (reservations survive the reset)
		let unit = 0;
		while (this.reservedUnits.has(unit)) {
			unit++;
		}
		this.usedUnits.add(unit);
		emit(GPU_TEXTURE_CACHE_RESET);
		return unit;
	}

	/**
	 * Reserve a texture unit so {@link allocateTextureUnit} never hands it to a
	 * color texture — used by `ShaderEffect.setTexture` to hold high units for
	 * its extra samplers. Reference-counted, so a unit shared by several effects
	 * stays reserved until the last one releases it.
	 * @param {number} unit - the texture unit to reserve
	 * @ignore
	 */
	reserveUnit(unit) {
		this.reservedUnits.set(unit, (this.reservedUnits.get(unit) || 0) + 1);
	}

	/**
	 * Release a unit previously held by {@link reserveUnit}. The unit becomes
	 * allocatable again once its last holder releases it.
	 * @param {number} unit - the texture unit to release
	 * @ignore
	 */
	releaseUnit(unit) {
		const count = this.reservedUnits.get(unit);
		if (count > 1) {
			this.reservedUnits.set(unit, count - 1);
		} else {
			this.reservedUnits.delete(unit);
		}
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
	 *
	 * Hot-path note: `getUnit` / `peekUnit` / `freeTextureUnit` are
	 * called per-texture per-draw, so the `(source, repeat)` lookup is
	 * inlined here rather than going through a helper that allocates a
	 * `{source, repeat}` object on every call.
	 */
	freeTextureUnit(texture) {
		const source = texture.sources.get(texture.activeAtlas);
		const repeat = normalizeRepeat(texture.repeat);
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
		const source = texture.sources.get(texture.activeAtlas);
		const repeat = normalizeRepeat(texture.repeat);
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
		const source = texture.sources.get(texture.activeAtlas);
		const repeat = normalizeRepeat(texture.repeat);
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
			// Free every atlas registered under this image, not just the
			// first one. Post-#1448 (units keyed by (source, repeat))
			// multiple atlases can coexist for one image — freeing only
			// `cache.get(image)[0]` would leak the remaining repeats'
			// texture units after `this.cache.delete(image)` wipes the
			// entire multimap bucket.
			for (const texture of this.cache.get(image)) {
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
