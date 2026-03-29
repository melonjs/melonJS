import * as spineCanvas from "@esotericsoftware/spine-canvas";
import * as spineWebGL from "@esotericsoftware/spine-webgl";
import { loader, utils } from "melonjs";

/**
 * @classdesc
 * An Asset Manager class that integrates Spine's asset loading with
 * melonJS's preloader via a custom "spine" parser.
 * Handles loading of atlas, JSON skeleton, and binary skeleton (.skel) files.
 */
export default class AssetManager {
	/**
	 * @param {CanvasRenderer|WebGLRenderer} renderer - a melonJS renderer instance
	 * @param {string} [pathPrefix=""] - a default path prefix for assets location
	 */
	constructor(renderer, pathPrefix = "") {
		/**
		 * the underlying Spine asset manager
		 * @ignore
		 */
		this.spineAssetManager =
			renderer.WebGLVersion >= 1
				? new spineWebGL.AssetManager(renderer.getContext(), pathPrefix)
				: new spineCanvas.AssetManager(pathPrefix);

		// register the spine custom parser with the melonJS loader
		loader.setParser("spine", (data, onload, onerror) => {
			const ext = utils.file.getExtension(data.src);
			const basename = utils.file.getBasename(data.src);
			const path = data.src.substring(0, data.src.lastIndexOf("/") + 1);
			const filename = `${basename}.${ext}`;

			this.setPrefix(path);

			switch (ext) {
				case "atlas":
					this.loadTextureAtlas(filename, onload, onerror);
					break;
				case "json":
					this.loadText(filename, onload, onerror);
					break;
				case "skel":
					this.loadBinary(filename, onload, onerror);
					break;
				default:
					if (onerror) {
						onerror(
							`Spine plugin: unknown extension "${ext}" when preloading spine assets`,
						);
					}
					return 0;
			}

			return 1;
		});
	}

	/**
	 * Set a default path prefix for assets location.
	 * @param {string} pathPrefix
	 */
	setPrefix(pathPrefix) {
		this.spineAssetManager.pathPrefix = pathPrefix;
	}

	/**
	 * Load a spine atlas and skeleton file pair.
	 * @param {string} atlas - atlas filename (e.g. "alien.atlas")
	 * @param {string} skel - skeleton filename (.json or .skel)
	 * @example
	 * // manually load spine assets
	 * plugin.assetManager.setPrefix("data/spine/");
	 * plugin.assetManager.loadAsset("alien.atlas", "alien-ess.json");
	 * await plugin.assetManager.loadAll();
	 */
	loadAsset(atlas, skel) {
		if (atlas) {
			this.loadTextureAtlas(atlas);
		}
		if (skel.endsWith(".skel")) {
			this.loadBinary(skel);
		} else {
			this.loadText(skel);
		}
	}

	/**
	 * Load a texture atlas file.
	 * @param {string} atlas - atlas filename
	 * @param {Function} [onload] - callback on successful load
	 * @param {Function} [onerror] - callback on error
	 */
	loadTextureAtlas(atlas, onload, onerror) {
		return this.spineAssetManager.loadTextureAtlas(atlas, onload, onerror);
	}

	/**
	 * Load a binary skeleton (.skel) file.
	 * @param {string} skel - skeleton binary filename
	 * @param {Function} [onload] - callback on successful load
	 * @param {Function} [onerror] - callback on error
	 */
	loadBinary(skel, onload, onerror) {
		return this.spineAssetManager.loadBinary(skel, onload, onerror);
	}

	/**
	 * Load a JSON skeleton file.
	 * @param {string} skel - skeleton JSON filename
	 * @param {Function} [onload] - callback on successful load
	 * @param {Function} [onerror] - callback on error
	 */
	loadText(skel, onload, onerror) {
		return this.spineAssetManager.loadText(skel, onload, onerror);
	}

	/**
	 * Load all queued spine assets.
	 * @returns {Promise} resolves when all assets are loaded
	 * @see loadAsset
	 */
	loadAll() {
		return this.spineAssetManager.loadAll();
	}

	/**
	 * Get a loaded asset by path.
	 * @param {string} path - the asset path/name
	 * @returns {*} the loaded asset (TextureAtlas, skeleton data, etc.)
	 */
	require(path) {
		return this.spineAssetManager.require(path);
	}

	/**
	 * Dispose all loaded assets and release GPU resources.
	 */
	dispose() {
		this.spineAssetManager.dispose();
	}
}
