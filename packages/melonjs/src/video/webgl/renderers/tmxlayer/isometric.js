import { isometricRegion } from "../../../gpu/tmxlayer_region.js";
import isometricTMXLayerFragment from "../../shaders/isometric-tmxlayer.frag";
import TMXLayerGPURenderer from "./tmxlayer.js";

/**
 * additional imports for TypeScript
 * @import { default as TMXLayer } from "../../../../level/tiled/TMXLayer.js";
 * @import { default as WebGLRenderer } from "../../webgl_renderer.js";
 */

/**
 * GPU-accelerated renderer for isometric TMX tile layers (WebGL2): the
 * shared {@link TMXLayerGPURenderer}, with an isometric grid's geometry.
 * The quad covers the view, and the shader works in pixels.
 *
 * Isometric tiles overlap, and the shader keeps the one drawn last among
 * those of ONE tileset: a layer takes this path only when all its tiles
 * come from the same one (`layer._shaderTileset`, set by the layer when it
 * is found eligible).
 * @ignore
 * @internal
 */
export default class IsometricTMXLayerGPURenderer extends TMXLayerGPURenderer {
	/**
	 * @param {WebGLRenderer} renderer - the WebGL renderer instance
	 */
	constructor(renderer) {
		super(renderer, isometricTMXLayerFragment);
		this._tilesets = [];
	}

	/**
	 * @ignore
	 * @internal
	 */
	_region(layer, rect, tileset, out) {
		return isometricRegion(layer, rect, tileset, out);
	}

	/**
	 * The one tileset an isometric layer on this path draws with.
	 * @param {TMXLayer} layer - the layer
	 * @returns {object[]} that tileset, or none for an empty layer
	 * @ignore
	 * @internal
	 */
	_tilesetsOf(layer) {
		this._tilesets.length = 0;
		if (layer._shaderTileset) {
			this._tilesets.push(layer._shaderTileset);
		}
		return this._tilesets;
	}
}
