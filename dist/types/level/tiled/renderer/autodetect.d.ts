/**
 * return a compatible renderer object for the given map
 * @param {TMXTileMap} map
 * @ignore
 */
export function getNewTMXRenderer(map: TMXTileMap): TMXOrthogonalRenderer | TMXIsometricRenderer | TMXHexagonalRenderer;
import TMXOrthogonalRenderer from "./TMXOrthogonalRenderer.js";
import TMXIsometricRenderer from "./TMXIsometricRenderer.js";
import TMXHexagonalRenderer from "./TMXHexagonalRenderer.js";
