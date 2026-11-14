# melonJS Pathfinding Plugin
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/pathfinding-plugin)](https://www.npmjs.com/package/@melonjs/pathfinding-plugin)

A* pathfinding on a grid for [melonJS](https://melonjs.org/) games.

- a grid of open and solid cells, each with a weight to cross (mud, water, roads)
- built from a Tiled tile layer, from a level's collision shapes, or from your own callbacks
- changed as the game goes on: open a door, knock down a wall, let a floor fall away
- four diagonal modes, from never to always, through never cutting a corner past a wall
- paths as cells or as points, between cells or between world positions
- a cap on how much one search may look at, so an unreachable goal cannot stall a frame
- partial paths: when the goal cannot be reached, the way to the nearest point
- points to avoid for one search only: other agents, a hazard
- path smoothing, so an agent heads straight across open ground instead of stepping tile by tile
- square cells (orthogonal maps) or diamonds (isometric maps)
- a debug overlay: solid and heavy cells, the cells a search looked at, the paths

Staggered and hexagonal maps are not supported.

## Install

```sh
npm install melonjs @melonjs/pathfinding-plugin
```

It needs melonJS 20.12 or later.

## Quick start

```ts
import { Vector2d } from "melonjs";
import { Grid } from "@melonjs/pathfinding-plugin";

// one cell per tile of the "walls" layer: a tile is solid, an empty cell is open
const walls = app.world.getChildByName("walls")[0];
const grid = Grid.fromTileLayer(walls);
grid.diagonalMode = "onlyIfNoObstacles";

// between two cells: the cells, or their positions in the world
const cells = grid.getIdPath(new Vector2d(1, 1), new Vector2d(12, 7));
const points = grid.getPointPath(new Vector2d(1, 1), new Vector2d(12, 7));

// between two world positions, with what the search found
const { path, found } = grid.findPath(enemy.pos, player.pos);
// path[0] is where the enemy stands: head for path[1]
```

Cells are `Vector2d`s, `x` the column and `y` the row. A path runs from the start to the goal, both included, and is empty when there is none (see `allowPartialPath`). Its points are each cell's position: its corner (the top left of a square, the top of a diamond) plus `grid.offset`, which is the centre by default.

## Building a grid

### From a tile layer

```ts
// a layer of walls: a tile makes its cell solid
const grid = Grid.fromTileLayer(walls);

// a floor layer: decide from the tile
const grid = Grid.fromTileLayer(floor, {
	solid: (tile) => tile === null || tile.tileset.getTileProperties(tile.tileId)?.kind === "wall",
});
```

A tile's `weight` custom property, set in Tiled's tileset editor, is what crossing it costs (1 by default). Pass `weight: (tile, col, row) => ...` to decide it yourself. The grid sits where the layer is, its containers included, on an infinite map too, whose layers can start left of or above the map's origin.

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

The walls are the bodies of type `WORLD_SHAPE`: the shapes of a Tiled map's collision layer, and any body declared that way (pass `solid: (renderable) => ...` to choose others). A cell is solid when a wall covers any of nine points spread over it, so a sloped or rotated wall makes solid the cells it really covers. Shapes are read from the built-in physics body or the `bodyDef`, placed from the renderable's anchor point as the engine places them, and from a wall's bounding box otherwise.

The shapes are scanned when the grid is built, so it works right after a level loads, before the physics world has stepped. `grid.refresh()` scans them again, where the grid now is if you moved it.

### Isometric maps

On an isometric map the cells are diamonds: columns run down to the right and rows down to the left. `Grid.fromTileLayer` sees it from the layer, so nothing changes in your code; the search is the same, only where a cell sits in the world differs. Elsewhere, pass `cellShape: "isometric"`:

```ts
const grid = Grid.fromBodies(app.world, {
	cols: map.cols,
	rows: map.rows,
	tileWidth: map.tilewidth,
	tileHeight: map.tileheight,
	cellShape: "isometric",
});

const grid = new Grid({ cols: 20, rows: 15, tileWidth: 64, tileHeight: 32, cellShape: "isometric" });
```

The grid's `x` and `y` are the top left corner of the box around every diamond, as for an isometric Tiled layer, and `tileWidth` and `tileHeight` are a diamond's width and height. `cellAt` finds the diamond under a world position, `getPointPosition` gives its centre, and the debug overlay draws diamonds. A diagonal step on an isometric grid goes straight across the screen, sideways or up and down. Staggered and hexagonal maps, whose neighbours change from row to row, are not supported: `fromTileLayer` throws on them.

### From your own callbacks

```ts
const grid = new Grid({
	cols: 40,
	rows: 30,
	tileWidth: 16,
	tileHeight: 16,
	solid: (col, row) => map[row][col] === "#",
	weight: (col, row) => (map[row][col] === "~" ? 3 : 1),
});
```

`solid` and `weight` are read for every cell when the grid is built and on `refresh()`, not during a search, so a search stays fast.

### At run time

```ts
grid.setSolid(col, row);                                 // a door shuts
grid.setSolid(col, row, false);                          // and opens again
grid.setWeight(col, row, 4);                             // the floor floods
grid.fillSolidRegion({ x: 4, y: 2, width: 3, height: 2 });   // a block of cells
grid.fillWeightRegion({ x: 0, y: 8, width: 10, height: 2 }, 3);
grid.refresh();                                          // read every cell again from the source
```

A weight is 1 or more and finite; make a cell impassable with `setSolid` rather than an infinite weight.

## Searching

| Method | From and to | Returns |
| --- | --- | --- |
| `getIdPath(from, to, allowPartialPath?)` | cells | the cells of the path |
| `getPointPath(from, to, allowPartialPath?)` | cells | the points of the path, in world units |
| `findPath(from, to, options?)` | world positions (a `pos`, a `Vector2d`, any `{ x, y }`) | `{ found, path, cells, cost, explored }` |

`getIdPath` and `getPointPath` also take the options object in place of `allowPartialPath`.

```ts
const result = grid.findPath(enemy.pos, player.pos, {
	diagonalMode: "onlyIfNoObstacles",
	smooth: true,
	maxNodes: 300,
	allowPartialPath: true,
	avoid: otherEnemies.map((e) => e.pos),
	avoidWeight: 6,
});
```

| Option | Default | |
| --- | --- | --- |
| `allowPartialPath` | `false` | when the goal cannot be reached (walled off, solid, or past `maxNodes`), return the path to the nearest cell instead of an empty one; `found` is then false |
| `diagonalMode` | the grid's, `"never"` | `"never"`; `"onlyIfNoObstacles"` (both cells beside a diagonal step open: never cuts a corner); `"atLeastOneWalkable"` (one of them open); `"always"` (even between two walls). A diagonal step costs √2 |
| `heuristic` | the grid's: `"manhattan"`, or `"octile"` with diagonals | the estimate of the distance left: `"manhattan"`, `"octile"`, `"chebyshev"`, `"euclidean"`, or `(dx, dy) => number`. An estimate that never exceeds the real cost finds the cheapest path; a higher one searches less |
| `maxNodes` | `Infinity` | the most cells one search looks at, 0 or more |
| `smooth` | `false` | keep only the turning points: an agent goes straight between two points that see each other over open cells. The line never crosses a cell heavier than the ones it replaces, so it does not cut through mud the search went round |
| `avoid` | none | points to keep away from for this search only (world positions for `findPath`, cells for the others); the start and the goal are never avoided, nor is a point off the grid |
| `avoidWeight` | `Infinity` | what an avoided cell costs on top of its weight, 0 or more: `Infinity` makes it solid, a number makes agents spread out without ever trapping each other |
| `trace` | `false` | `findPath` keeps the cells the search looked at, in order, in `result.trace` |

`grid.diagonalMode` and `grid.heuristic` set the defaults for every search. A search allocates nothing but its result.

The other methods: `isSolid`, `getWeight`, `isInBounds(col, row)`, `cellAt(x, y)` (the cell under a world position), `getPointPosition(col, row, out?)` (into `out` to allocate nothing), and `lineOfSight(fromCell, toCell, maxWeight?)`, whether a straight line between two cell centres crosses only open cells, both ends included, for a shot or a sight line. A cell given with a fraction is rounded down, as `cellAt` does; a start or goal off the grid is moved onto it.

## The plugin

`PathfindingPlugin` keeps a grid for the current level, built each time a level loads:

```ts
import { plugin } from "melonjs";
import { PathfindingPlugin } from "@melonjs/pathfinding-plugin";

plugin.register(PathfindingPlugin, "pathfinding", { layer: "walls" });

// once a level is loaded
const { grid } = plugin.cache.pathfinding;
```

With `layer`, the grid comes from that tile layer (and takes the same `solid` and `weight` as `Grid.fromTileLayer`); without it, from the level's collision shapes. `build: (container) => grid` builds it yourself. `rebuild()` builds it again, and `destroy()` stops following level loads. Registered once a level is loaded, it builds that level's grid at once. A level it cannot build a grid for (a staggered or hexagonal map) still loads: the plugin warns and its `grid` is `null` (`rebuild()` called directly throws). A `Grid` works without the plugin: use the plugin only when the grid comes from the level.

## Debug overlay

```ts
import { PathfindingDebug } from "@melonjs/pathfinding-plugin";

const overlay = new PathfindingDebug(grid);
app.world.addChild(overlay, 100);

const result = grid.findPath(enemy.pos, player.pos, { trace: true });
overlay.paths = [{ result, color: "#ff5fb8" }];
```

It draws solid cells in red, heavy ones in orange, the cells each search looked at in blue (with `trace`) and the paths. `showSolid`, `showWeight` and `showTrace` turn each part off.

## Physics adapters

The grid does not use the physics engine: `Grid.fromBodies` reads the bodies' shapes from their `bodyDef` (or from the built-in `body`), so a grid builds the same with the built-in physics, Matter, Planck or Rapier. With an adapter whose bodies keep no melonJS shapes, a wall's bounding box is used.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| The path goes through walls | The grid does not know them: a floor layer, where every cell has a tile, needs `solid`; a tile changed with `setTile` needs `refreshCell`; with `fromBodies`, the walls are not `WORLD_SHAPE` bodies (pass `solid`), or are thinner than an eighth of a cell |
| The path cuts across a wall corner | `diagonalMode` is `"always"` or `"atLeastOneWalkable"`; use `"onlyIfNoObstacles"` |
| Every cell is solid on a `fromTileLayer` grid | A floor layer: every cell has a tile, and a tile is solid by default. Pass `solid` |
| The path is empty | The goal is walled off, solid, or further than `maxNodes` lets the search look. `allowPartialPath: true` returns the way to the nearest point instead |
| The agent turns back at the start | `path[0]` is where it stands: head for `path[1]` |
| `PathfindingPlugin`'s grid is `null`, with a warning | The level is a staggered or hexagonal map, or `layer` names no layer of it |
| Agents bunch up in a line | Pass the others' positions as `avoid`, with a finite `avoidWeight` |
| The path is offset from an isometric map | The grid is square: built with `new Grid` or `Grid.fromBodies` without `cellShape: "isometric"` |
| The path is offset from the map | The grid's `x` / `y` are not the layer's: the layer was not in its container yet when the grid was built, or the container moved since; set `grid.x` and `grid.y`. Points at a cell's corner rather than its centre come from `grid.offset` |
| `a cell's weight must be a finite number of 1 or more` | A weight below 1, or `Infinity`; make a cell impassable with `setSolid` |

## Developing

`pnpm -F @melonjs/pathfinding-plugin visual` serves a visual test page: a grid to paint walls and mud on, agents chasing a target, a grid built from collision shapes, square or isometric cells, and a toggle for each option. See [`visual/README.md`](visual/README.md). `pnpm -F @melonjs/pathfinding-plugin test` runs the tests.

## Credits

Based on [melonjs-astar](https://github.com/melonjs/plugins/tree/master/pathfinding/melonjs-astar) by Sean Muron (MIT), which used [javascript-astar](https://github.com/bgrins/javascript-astar) by Brian Grinstead (MIT) and the binary heap from Marijn Haverbeke's [Eloquent JavaScript](https://eloquentjavascript.net/).

## License

MIT
