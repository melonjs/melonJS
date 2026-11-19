import { orthogonalRegion } from "../../../gpu/tmxlayer_region.js";
import orthogonalWGSL from "../../shaders/tmxlayer-orthogonal.wgsl";
import TMXLayerGPURenderer from "./tmxlayer.js";

/**
 * additional imports for TypeScript
 * @import { default as WebGPURenderer } from "../../webgpu_renderer.js";
 */

/**
 * GPU-accelerated renderer for orthogonal TMX tile layers on the WebGPU
 * backend: the shared {@link TMXLayerGPURenderer}, with an orthogonal grid's
 * geometry. The quad covers the cells in view, and the shader works in
 * cells.
 * @ignore
 * @internal
 */
export default class OrthogonalTMXLayerGPURenderer extends TMXLayerGPURenderer {
	/**
	 * @param {WebGPURenderer} renderer - the WebGPU renderer instance
	 */
	constructor(renderer) {
		super(renderer, orthogonalWGSL);
	}

	/**
	 * @ignore
	 * @internal
	 */
	region(layer, rect, tileset, out) {
		return orthogonalRegion(layer, rect, tileset, out);
	}
}
