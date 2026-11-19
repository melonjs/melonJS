import { isometricRegion } from "../../../gpu/tmxlayer_region.js";
import isometricWGSL from "../../shaders/tmxlayer-isometric.wgsl";
import TMXLayerGPURenderer from "./tmxlayer.js";

/**
 * additional imports for TypeScript
 * @import { default as TMXLayer } from "../../../../level/tiled/TMXLayer.js";
 * @import { default as WebGPURenderer } from "../../webgpu_renderer.js";
 */

/**
 * GPU-accelerated renderer for isometric TMX tile layers on the WebGPU
 * backend: the shared {@link TMXLayerGPURenderer}, with an isometric grid's
 * geometry. The quad covers the view, and the shader works in pixels.
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
	 * @param {WebGPURenderer} renderer - the WebGPU renderer instance
	 */
	constructor(renderer) {
		super(renderer, isometricWGSL);
		this.tilesets = [];
	}

	/**
	 * @ignore
	 * @internal
	 */
	region(layer, rect, tileset, out) {
		return isometricRegion(layer, rect, tileset, out);
	}

	/**
	 * The one tileset an isometric layer on this path draws with.
	 * @param {TMXLayer} layer - the layer
	 * @returns {object[]} that tileset, or none for an empty layer
	 * @ignore
	 * @internal
	 */
	tilesetsOf(layer) {
		this.tilesets.length = 0;
		if (layer._shaderTileset) {
			this.tilesets.push(layer._shaderTileset);
		}
		return this.tilesets;
	}
}
