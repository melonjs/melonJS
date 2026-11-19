import { orthogonalRegion } from "../../../gpu/tmxlayer_region.js";
import orthogonalTMXLayerFragment from "../../shaders/orthogonal-tmxlayer.frag";
import TMXLayerGPURenderer from "./tmxlayer.js";

/**
 * additional imports for TypeScript
 * @import { default as TMXLayer } from "../../../../level/tiled/TMXLayer.js";
 * @import { default as WebGLRenderer } from "../../webgl_renderer.js";
 */

/**
 * GPU-accelerated renderer for orthogonal TMX tile layers (WebGL2): the
 * shared {@link TMXLayerGPURenderer}, with an orthogonal grid's geometry.
 * The quad covers the cells in view, and the shader works in cells.
 * @ignore
 * @internal
 */
export default class OrthogonalTMXLayerGPURenderer extends TMXLayerGPURenderer {
	/**
	 * @param {WebGLRenderer} renderer - the WebGL renderer instance
	 */
	constructor(renderer) {
		super(renderer, orthogonalTMXLayerFragment);
	}

	/**
	 * @ignore
	 * @internal
	 */
	_region(layer, rect, tileset, out) {
		return orthogonalRegion(layer, rect, tileset, out);
	}
}
