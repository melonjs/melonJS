# melonJS Pathfinding Plugin
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/pathfinding-plugin)](https://www.npmjs.com/package/@melonjs/pathfinding-plugin)

A* pathfinding on a grid for [melonJS](https://melonjs.org/) games.

- a grid of open and blocked cells, each with a cost to cross (mud, water, roads)
- built from a Tiled tile layer, from a level's collision shapes, or from your own callbacks
- changed as the game goes on: open a door, knock down a wall, let a floor fall away
- moves in 4 directions, or 8 without ever cutting a corner past a wall
- a cap on how much one search may look at, so an unreachable goal cannot stall a frame
- when the goal cannot be reached, a path to the nearest point instead of no path at all
- points to avoid for one search only: other agents, a hazard
- path smoothing, so an agent heads straight across open ground instead of stepping tile by tile
- a debug overlay: blocked and costly cells, the cells a search looked at, the paths
- plain points out, in world units, with the cells too

Square-cell (orthogonal) maps only for now: isometric and hexagonal maps are not supported.

## Install

```sh
npm install melonjs @melonjs/pathfinding-plugin
```

It needs melonJS 20.12 or later.

## Quick start

```ts
import { Grid } from "@melonjs/pathfinding-plugin";

// one cell per tile of the "walls" layer: a tile is a wall, an empty cell is open
const walls = app.world.getChildByName("walls")[0];
const grid = Grid.fromTileLayer(walls);

// in an enemy's update
const { path, found } = grid.findPath(enemy.pos, player.pos, { diagonal: true });
if (path.length > 0) {
	// head for path[0], the centre of the next cell, in world units
}
```

`findPath` takes positions in world units (or cells, with `tiles: true`) and returns the points to go through, after the start: the centre of each cell, the last one the goal's. `found` is false when the goal could not be reached, and the path then leads to the cell nearest to it.

## Building a grid

### From a tile layer

```ts
// a layer of walls: a tile blocks its cell
const grid = Grid.fromTileLayer(walls);

// a floor layer: decide from the tile
const grid = Grid.fromTileLayer(floor, {
	walkable: (tile) => tile !== null && tile.tileset.getTileProperties(tile.tileId)?.kind !== "wall",
});
```

A tile's `cost` custom property, set in Tiled's tileset editor, is what crossing it costs (1 by default). Pass `cost: (tile, col, row) => ...` to decide it yourself. The grid sits where the layer is, its containers included.

The layer is read when the grid is built. After changing tiles with `setTile` / `clearTile`, call `grid.refreshCell(col, row)`, or `grid.refresh()` for the whole map.

### From collision shapes

```ts
await level.load("map", { container: app.world, async: true });
const map = level.getCurrentLevel();
const grid = Grid.fromBodies(app.world, {
	cols: map.cols,
	rows: map.rows,
	tileWidth: map.tilewidth,
	tileHeight: map.tileheight,
});
```

The walls are the bodies of type `WORLD_SHAPE`: the shapes of a Tiled map's collision layer, and any body declared that way (pass `solid: (renderable) => ...` to choose others). A cell is blocked when a wall covers any of nine points spread over it, so a sloped or rotated wall blocks the cells it really covers. Shapes are read from the built-in physics body or the `bodyDef`, and from a wall's bounding box otherwise.

The shapes are scanned when the grid is built, so it works right after a level loads, before the physics world has stepped. `grid.refresh()` scans them again.

### From your own callbacks

```ts
const grid = new Grid({
	cols: 40,
	rows: 30,
	tileWidth: 16,
	tileHeight: 16,
	walkable: (col, row) => map[row][col] !== "#",
	cost: (col, row) => (map[row][col] === "~" ? 3 : 1),
});
```

`walkable` and `cost` are read for every cell when the grid is built and on `refresh()`, not during a search, so a search stays fast.

### At run time

```ts
grid.setWalkable(col, row, false); // a door shuts
grid.setCost(col, row, 4);         // the floor floods
grid.refresh();                    // read every cell again from the source
```

A cell's cost is 1 or more and finite; block a cell with `setWalkable` rather than an infinite cost.

## Searching

```ts
const result = grid.findPath(from, to, {
	diagonal: true,
	smooth: true,
	maxNodes: 300,
	avoid: otherEnemies.map((e) => e.pos),
	avoidCost: 6,
});
```

| Option | Default | |
| --- | --- | --- |
| `diagonal` | `false` | move in 8 directions; a diagonal step costs √2 and never cuts a corner (both cells beside it must be open) |
| `heuristic` | `"manhattan"`, `"octile"` with `diagonal` | the estimate of the distance left: `"manhattan"`, `"octile"`, `"chebyshev"`, `"euclidean"`, or `(dx, dy) => number`. An estimate that never exceeds the real cost finds the cheapest path; a higher one searches less |
| `maxNodes` | `Infinity` | the most cells one search looks at; past it, the search stops |
| `closest` | `true` | when the goal cannot be reached, or `maxNodes` runs out, return the path to the nearest cell (`found` is false); with `false`, return no path |
| `smooth` | `false` | keep only the turning points: an agent goes straight between two points that see each other over open cells. The line never crosses a cell costlier than the ones it replaces, so it does not cut through mud the search went round |
| `avoid` | none | points (world units, or cells with `tiles`) to keep away from for this search only; the start and the goal are never avoided |
| `avoidCost` | `Infinity` | what an avoided cell costs on top of its own: `Infinity` blocks it, a number makes agents spread out without ever trapping each other |
| `tiles` | `false` | `from`, `to` and `avoid` are cells (`x` the column, `y` the row) |
| `trace` | `false` | keep the cells the search looked at, in order, in `result.trace` |

The result holds `found`, `path` (points in world units), `cells` (the same steps as cells), `cost` and `explored` (how many cells the search looked at). A search allocates nothing but its result.

`grid.lineOfSight(fromCell, toCell)` tells whether a straight line between two cell centres crosses only open cells, for a shot or a sight line.

## The plugin

`PathfindingPlugin` keeps a grid for the current level, built each time a level loads:

```ts
import { plugin } from "melonjs";
import { PathfindingPlugin } from "@melonjs/pathfinding-plugin";

plugin.register(PathfindingPlugin, "pathfinding", { layer: "walls" });

// once a level is loaded
const { grid } = plugin.cache.pathfinding;
```

With `layer`, the grid comes from that tile layer (and takes the same `walkable` and `cost` as `Grid.fromTileLayer`); without it, from the level's collision shapes. `build: (container) => grid` builds it yourself. `rebuild()` builds it again, and `destroy()` stops following level loads. A `Grid` works without the plugin: use the plugin only when the grid comes from the level.

## Debug overlay

```ts
import { PathfindingDebug } from "@melonjs/pathfinding-plugin";

const overlay = new PathfindingDebug(grid);
app.world.addChild(overlay, 100);

const result = grid.findPath(enemy.pos, player.pos, { trace: true });
overlay.paths = [{ result, from: enemy.pos, color: "#ff5fb8" }];
```

It draws blocked cells in red, costly ones in orange, the cells each search looked at in blue (with `trace`) and the paths. `showBlocked`, `showCost` and `showTrace` turn each part off.

## Physics adapters

The grid does not use the physics engine: `Grid.fromBodies` reads the bodies' shapes from their `bodyDef` (or from the built-in `body`), so a grid builds the same with the built-in physics, Matter, Planck or Rapier. With an adapter whose bodies keep no melonJS shapes, a wall's bounding box is used.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| The path goes through walls | The grid does not know them: a layer whose tiles are floor needs `walkable`; a tile changed with `setTile` needs `refreshCell`; with `fromBodies`, the walls are not `WORLD_SHAPE` bodies (pass `solid`), or are thinner than an eighth of a cell |
| The path cuts across a wall corner | Not with `diagonal`, which never cuts a corner; with `smooth`, check the grid has the walls (above) |
| No path found (`found` is false) | The goal is walled off, on a wall, or further than `maxNodes` lets the search look; the path then leads as near as it could. `closest: false` returns no path instead |
| Paths stop short on a big map | `maxNodes` is too low for that distance |
| Agents bunch up in a line | Pass the others' positions as `avoid`, with a finite `avoidCost` |
| The path is offset from the map | The grid's `x` / `y` are not the layer's position: the layer was not in its container yet when the grid was built, or the container moved since; set `grid.x` and `grid.y` |
| `a cell's cost must be a finite number of 1 or more` | A cost below 1, or `Infinity`; block a cell with `setWalkable` |

## Developing

`pnpm -F @melonjs/pathfinding-plugin visual` serves a visual test page: a grid to paint walls and mud on, agents chasing a target, a grid built from collision shapes, and a toggle for each option. See [`visual/README.md`](visual/README.md). `pnpm -F @melonjs/pathfinding-plugin test` runs the tests.

## Credits

Based on [melonjs-astar](https://github.com/melonjs/plugins/tree/master/pathfinding/melonjs-astar) by Sean Muron (MIT), which used [javascript-astar](https://github.com/bgrins/javascript-astar) by Brian Grinstead (MIT) and the binary heap from Marijn Haverbeke's [Eloquent JavaScript](https://eloquentjavascript.net/).

## License

MIT
