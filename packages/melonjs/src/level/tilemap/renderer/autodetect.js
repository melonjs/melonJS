import HexagonalRenderer from "./HexagonalRenderer.js";
import IsometricRenderer from "./IsometricRenderer.js";
import ObliqueRenderer from "./ObliqueRenderer.js";
import OrthogonalRenderer from "./OrthogonalRenderer.js";
import StaggeredRenderer from "./StaggeredRenderer.js";

/**
 * return a compatible renderer object for the given map
 * @param {TileMap} map
 * @ignore
 * @internal
 */
export function getNewTileMapRenderer(map) {
	switch (map.orientation) {
		case "orthogonal":
			return new OrthogonalRenderer(map);

		case "isometric":
			return new IsometricRenderer(map);

		case "hexagonal":
			return new HexagonalRenderer(map);

		case "staggered":
			return new StaggeredRenderer(map);

		case "oblique":
			return new ObliqueRenderer(map);

		// if none found, throw an exception
		default:
			throw new Error(`${map.orientation} type TMX Tile Map not supported!`);
	}
}
