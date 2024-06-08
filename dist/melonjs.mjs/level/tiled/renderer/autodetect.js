/*!
 * melonJS Game Engine - v17.4.0
 * http://www.melonjs.org
 * melonjs is licensed under the MIT License.
 * http://www.opensource.org/licenses/mit-license
 * @copyright (C) 2011 - 2024 Olivier Biot (AltByte Pte Ltd)
 */
import TMXOrthogonalRenderer from './TMXOrthogonalRenderer.js';
import TMXIsometricRenderer from './TMXIsometricRenderer.js';
import TMXHexagonalRenderer from './TMXHexagonalRenderer.js';
import TMXStaggeredRenderer from './TMXStaggeredRenderer.js';

/**
 * return a compatible renderer object for the given map
 * @param {TMXTileMap} map
 * @ignore
 */
function getNewTMXRenderer(map) {
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

export { getNewTMXRenderer };
