# Changelog

## [1.0.0] - _unreleased_

### Added
- `Grid`: A* pathfinding on a grid of open and solid cells, each with a weight; `getIdPath` and `getPointPath` between cells, `findPath` between world positions with whether it reached the goal, its cost and how much it looked at
- four diagonal modes (`never`, `always`, `atLeastOneWalkable`, `onlyIfNoObstacles`), the manhattan, octile, chebyshev and euclidean heuristics or your own, a search cap (`maxNodes`), partial paths (`allowPartialPath`), points to avoid for one search, path smoothing and line of sight
- `Grid.fromTileLayer` builds a grid from a Tiled tile layer (a tile's `weight` property sets its weight), and `Grid.fromBodies` from a level's collision shapes; `setSolid`, `setWeight`, `fillSolidRegion`, `fillWeightRegion`, `refresh` and `refreshCell` change it at run time
- isometric maps: `cellShape: "isometric"` lays the cells out as diamonds; `Grid.fromTileLayer` and `PathfindingPlugin` pick it from the map
- `PathfindingPlugin` keeps a grid for the current level, built each time a level loads
- `PathfindingDebug`, an overlay of solid and heavy cells, the cells a search looked at and the paths
