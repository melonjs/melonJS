/**
 * The classes of a tile map that belong to no map editor, under the names
 * they had when a Tiled map was the only kind of tile map. They are the same
 * classes as the ones in `level/tilemap/`: a value and a type under each old
 * name, so that `instanceof` and type annotations written with them go on
 * working.
 */
import HexagonalRenderer from "../tilemap/renderer/HexagonalRenderer.js";
import IsometricRenderer from "../tilemap/renderer/IsometricRenderer.js";
import OrthogonalRenderer from "../tilemap/renderer/OrthogonalRenderer.js";
import StaggeredRenderer from "../tilemap/renderer/StaggeredRenderer.js";
import TileMapRenderer from "../tilemap/renderer/TileMapRenderer.js";
import TilesetGroup from "../tilemap/TilesetGroup.js";

/**
 * The older name of {@link TileMapRenderer}.
 * @deprecated since 20.18.0, use {@link TileMapRenderer}
 * @category Tilemap
 */
export const TMXRenderer = TileMapRenderer;
/**
 * The older name of {@link TileMapRenderer}.
 * @deprecated since 20.18.0, use {@link TileMapRenderer}
 */
export type TMXRenderer = TileMapRenderer;

/**
 * The older name of {@link OrthogonalRenderer}.
 * @deprecated since 20.18.0, use {@link OrthogonalRenderer}
 * @category Tilemap
 */
export const TMXOrthogonalRenderer = OrthogonalRenderer;
/**
 * The older name of {@link OrthogonalRenderer}.
 * @deprecated since 20.18.0, use {@link OrthogonalRenderer}
 */
export type TMXOrthogonalRenderer = OrthogonalRenderer;

/**
 * The older name of {@link IsometricRenderer}.
 * @deprecated since 20.18.0, use {@link IsometricRenderer}
 * @category Tilemap
 */
export const TMXIsometricRenderer = IsometricRenderer;
/**
 * The older name of {@link IsometricRenderer}.
 * @deprecated since 20.18.0, use {@link IsometricRenderer}
 */
export type TMXIsometricRenderer = IsometricRenderer;

/**
 * The older name of {@link HexagonalRenderer}.
 * @deprecated since 20.18.0, use {@link HexagonalRenderer}
 * @category Tilemap
 */
export const TMXHexagonalRenderer = HexagonalRenderer;
/**
 * The older name of {@link HexagonalRenderer}.
 * @deprecated since 20.18.0, use {@link HexagonalRenderer}
 */
export type TMXHexagonalRenderer = HexagonalRenderer;

/**
 * The older name of {@link StaggeredRenderer}.
 * @deprecated since 20.18.0, use {@link StaggeredRenderer}
 * @category Tilemap
 */
export const TMXStaggeredRenderer = StaggeredRenderer;
/**
 * The older name of {@link StaggeredRenderer}.
 * @deprecated since 20.18.0, use {@link StaggeredRenderer}
 */
export type TMXStaggeredRenderer = StaggeredRenderer;

/**
 * The older name of {@link TilesetGroup}.
 * @deprecated since 20.18.0, use {@link TilesetGroup}
 * @category Tilemap
 */
export const TMXTilesetGroup = TilesetGroup;
/**
 * The older name of {@link TilesetGroup}.
 * @deprecated since 20.18.0, use {@link TilesetGroup}
 */
export type TMXTilesetGroup = TilesetGroup;
