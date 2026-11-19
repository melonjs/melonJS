# Changelog

## [1.1.1] - _unreleased_

### Fixed
- `Grid.fromTileLayer`: the grid stands where the layer's tiles are drawn when the layer has an offset in Tiled or was moved by its `pos`, which melonJS 20.17 follows when it draws the layer; the grid stayed at the map's origin

## [1.1.0] - _2026-11-15_

### Added
- `PathfindingPlugin`: `subdivide` cuts each tile into that many cells along each side on the grid built from the collision shapes, for walls that do not keep to the tiles: a doorway narrower than a tile is closed on a grid of whole tiles and open on one of quarter tiles (`subdivide: 4`)

### Fixed
- `Grid.fromBodies` (and the plugin's grid from the collision shapes): a `WORLD_SHAPE` body whose collision mask is `NO_OBJECT` collides with nothing and is no longer a wall, so a door opened with `body.setCollisionMask(collision.types.NO_OBJECT)` opens on the grid once it is refreshed. The type and the mask are read from the live body before its `bodyDef`, which keeps them as they were written: a body's `collisionType` changed at run time was not seen. A game that kept bodies of mask `NO_OBJECT` as walls on purpose now passes its own `solid`

## [1.0.1] - _2026-11-15_

### Fixed
- `PathfindingDebug.draw()` takes a `Renderer`, as `Renderable.draw()` does, instead of a `CanvasRenderer | WebGLRenderer`: a game can pass it `app.renderer` without a cast, and the WebGPU renderer is accepted

## [1.0.0] - _2026-11-15_

### Added
- `Grid`: A* pathfinding on a grid of open and solid cells, each with a weight; `getIdPath` and `getPointPath` between cells, `findPath` between world positions with whether it reached the goal, its cost and how much it looked at
- four diagonal modes (`never`, `always`, `atLeastOneWalkable`, `onlyIfNoObstacles`), the manhattan, octile, chebyshev and euclidean heuristics or your own, a search cap (`maxNodes`), partial paths (`allowPartialPath`), points to avoid for one search, path smoothing and line of sight
- `Grid.fromTileLayer` builds a grid from a Tiled tile layer (a tile's `weight` property sets its weight), and `Grid.fromBodies` from a level's collision shapes; `setSolid`, `setWeight`, `fillSolidRegion`, `fillWeightRegion`, `refresh` and `refreshCell` change it at run time
- isometric maps: `cellShape: "isometric"` lays the cells out as diamonds; `Grid.fromTileLayer` and `PathfindingPlugin` pick it from the map
- `PathfindingPlugin` keeps a grid for the current level, built each time a level loads
- `PathfindingDebug`, an overlay of solid and heavy cells, the cells a search looked at and the paths
