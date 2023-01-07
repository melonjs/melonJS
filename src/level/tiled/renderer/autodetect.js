import TMXOrthogonalRenderer from "./TMXOrthogonalRenderer.js";
import TMXIsometricRenderer from "./TMXIsometricRenderer.js";
import TMXHexagonalRenderer from "./TMXHexagonalRenderer.js";
import TMXStaggeredRenderer from "./TMXStaggeredRenderer.js";

/**
 * return a compatible renderer object for the given map
 * @param {TMXTileMap} map
 * @ignore
 */
export function getNewTMXRenderer(map) {
    switch (map.orientation) {
        case "orthogonal":
            return new TMXOrthogonalRenderer(map);

        case "isometric":
            return new TMXIsometricRenderer(map);

        case "hexagonal":
            return new TMXHexagonalRenderer(map);

        case "staggered":
            return new TMXStaggeredRenderer(map);

        // if none found, throw an exception
        default:
            throw new Error(map.orientation + " type TMX Tile Map not supported!");
    }
}
