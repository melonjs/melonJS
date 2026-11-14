# Changelog

## [1.0.0] - _unreleased_

### Added
- `Grid`: A* pathfinding on a grid of open and blocked cells, each with a cost, in 4 or 8 directions without cutting corners, with a search limit, a path to the nearest point when the goal cannot be reached, points to avoid for one search, path smoothing and line of sight
- `Grid.fromTileLayer` builds a grid from a Tiled tile layer (a tile's `cost` property sets its cost), and `Grid.fromBodies` from a level's collision shapes; `setWalkable`, `setCost`, `refresh` and `refreshCell` change it at run time
- `PathfindingPlugin` keeps a grid for the current level, built each time a level loads
- `PathfindingDebug`, an overlay of blocked and costly cells, the cells a search looked at and the paths
