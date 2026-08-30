import { unload, unloadAll } from "../../audio/audio.ts";
import { load } from "../../audio/playback.ts";

/**
 * parse/preload an Audio file
 *
 * Unlike the other parsers this one delegates rather than doing the work
 * itself: audio assets are owned by the audio module, which decodes them
 * through its own backend and tracks them for playback. Keeping that
 * delegation here means every asset type is registered the same way — from a
 * parser of the same shape in this directory — and the loader never reaches
 * into the audio module directly, so replacing the audio backend cannot ripple
 * into the loader.
 * @param {loader.Asset} data - asset data
 * @param {Function} [onload] - function to be called when the resource is loaded
 * @param {Function} [onerror] - function to be called in case of error
 * @param {Object} [settings] - Additional settings to be passed when loading the asset
 * @returns {number} the amount of corresponding resource parsed/preloaded
 * @ignore
 */
export function preloadAudio(data, onload, onerror, settings) {
	return load(data, onload, onerror, settings);
}

/**
 * unload the given audio asset
 * @param {string} name - asset name
 * @returns {boolean} true if unloaded
 * @ignore
 */
export function unloadAudio(name) {
	return unload(name);
}

/**
 * unload all audio assets
 * @ignore
 */
export function unloadAllAudio() {
	unloadAll();
}
