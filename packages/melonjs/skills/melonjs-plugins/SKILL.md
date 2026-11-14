---
name: melonjs-plugins
description: "Use this skill when adding a melonJS plugin or adapter — the debug panel, Spine skeletal animation, compressed Tiled map support, on-screen touch controls, A* pathfinding, Capacitor packaging — or when writing your own plugin. Covers plugin.register and its version gate, plugin.cache, plugin.patch, and why physics adapters are not plugins. Triggers on: plugin, plugin.register, plugin.cache, plugin.get, plugin.patch, BasePlugin, debug-plugin, DebugPanelPlugin, SpinePlugin, TiledInflatePlugin, GamepadPlugin, gamepad-plugin, touch controls, virtual joystick, floating joystick, floating button, pathfinding, A*, astar, path finding, Grid, findPath, isometric pathfinding, enemy AI chase, CapacitorPlugin, adapter, custom plugin, plugin version mismatch, already registered."
license: MIT
---

# Plugins and adapters

## Two different mechanisms

This trips people up, so it is worth stating first:

| | how it is installed |
|---|---|
| **Plugins** | `plugin.register(Class, name?, ...args)` — after `await app.init()` |
| **Physics adapters** | an `Application` **setting** (`physic:`), before `init()`; or `app.world.setAdapter()` on a running game |

```js
// the adapter is chosen at construction …
const app = new Application(800, 600, {
    parent: "screen",
    physic: await PlanckAdapter.create({ gravity, pixelsPerMeter }),
});

// … the plugin is registered once the renderer exists
await app.init();
plugin.register(DebugPanelPlugin, "debugPanel");
```

## `register` in detail

```js
plugin.register(PluginClass, "name", ...constructorArgs);
plugin.cache.name;              // the instance
plugin.get(PluginClass);        // by class — or by registered name string
```

- **The name is optional** — it falls back to the class name.
- **The registry is global, not per-application.** It is a module-level object,
  so registering the same name twice throws `plugin <name> already registered`.
  A plugin *instance* does hold an `app` reference, but it defaults to `game` —
  **whichever Application most recently finished `init()`**, since that is where
  `game` is assigned. On a multi-application page, pass the app explicitly
  through the constructor args:
  `plugin.register(DebugPanelPlugin, "debugPanel", input.KEY.S, myApp)`.
- **`BasePlugin.version` is a floor, not an identity.** It declares the
  *minimum melonJS version the plugin needs*, and `register` throws
  `Plugin version mismatch, expected: <floor>, got: <engine>` when the running
  engine is older. That gate is the real enforcement — a peer-dependency range
  only warns at install time, and not at all for CDN or pre-bundled use. If you
  see that error, upgrade the engine or pin an older plugin. The check runs
  *after* the instance is constructed, so a plugin whose constructor has side
  effects will already have run them when it throws.

Register after `await app.init()`: a plugin binds to an Application and reads
renderer and frame state that does not exist before init.

## The official plugins

### `@melonjs/debug-plugin`

An in-game panel — frame time, draw and object counts — plus toggles for
hitbox/bounding-box overlays, velocity vectors and quadtree visualisation. The
first thing to reach for when something is slow or a collision is not landing
where you expect.

```js
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
plugin.register(DebugPanelPlugin, "debugPanel");   // default toggle key: S
```

### `@melonjs/tiled-inflate-plugin`

**Required**, not optional, for Tiled maps using gzip, zlib or zstd layer
compression. It installs the inflate hook `TMXUtils` calls; without it a
compressed `.tmx` fails to parse — a map that opens fine in Tiled and refuses to
load in melonJS is nearly always this.

```js
import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";
plugin.register(TiledInflatePlugin);
```

### `@melonjs/spine-plugin`

Spine 4.x skeletal animation as a melonJS renderable, on all three backends.
This is the answer for deforming animated characters — glTF import does not read
vertex skinning. It also registers a Tiled object class, so Spine skeletons can
be placed from a map.

```js
import Spine, { SpinePlugin } from "@melonjs/spine-plugin";

await app.init();
plugin.register(SpinePlugin);   // after init: it reads app.renderer
// preloaded as { name: "hero.atlas", type: "spine", src: … }, and the same for
// "hero.json" (a binary "hero.skel" also goes in jsonFile)
const hero = new Spine(100, 100, { atlasFile: "hero.atlas", jsonFile: "hero.json" });
```

Register it after `await app.init()` like any plugin: its constructor builds
an asset manager on the application's renderer, which does not exist before.

### `@melonjs/gamepad-plugin`

On-screen touch controls, reported as a gamepad: one or two sticks and any
number of buttons, drawn over the game and read by the engine as a pad in a
gamepad slot. The game's `bindGamepad` bindings drive it unchanged, so one set
of bindings covers a real pad and a touch screen.

```js
import { GamepadPlugin } from "@melonjs/gamepad-plugin";
plugin.register(GamepadPlugin, "gamepad", {
    buttons: [{ label: "A" }, { label: "B" }],
});
// plugin.cache.gamepad.visible — showing, to word prompts ("tap" or a key)
```

Shown on touch screens by default (`enabled`), hidden while a real pad is in
use. The left stick also presses the D-pad; a button can press a key instead
of a pad button. Since 1.1 a stick or button can be `floating` (shows up
under the finger anywhere in its `area`), `hideAtRest` (drawn only while
held), and a stick can take a `tap` (a quick touch that does not steer presses
a key or button) — so the mobile layouts, two thumbs or one thumb with
tap-to-act, need no code of their own. Since 1.2 a `skin` texture atlas draws
them from the game's own art (`base` / `thumb` regions on a stick, `region` /
`pressed` on a button). It needs melonJS 20.12 or later. See `melonjs-input`
for the bindings, the layouts and the overlap rules.

### `@melonjs/pathfinding-plugin`

A* on a grid of open and solid cells, each with a weight to cross. The grid
is the part to get right; the search is one call:

```js
import { Grid } from "@melonjs/pathfinding-plugin";

// a layer of walls: a tile makes its cell solid (a tile's `weight` property sets its weight)
const grid = Grid.fromTileLayer(app.world.getChildByName("walls")[0]);
// a floor layer: decide from the tile instead
Grid.fromTileLayer(floor, { solid: (tile) => tile === null || isWall(tile) });
// or the level's collision shapes (WORLD_SHAPE bodies, a Tiled collision layer)
Grid.fromBodies(app.world, { cols, rows, tileWidth, tileHeight });

grid.diagonalMode = "onlyIfNoObstacles";    // never cut a corner past a wall
grid.getIdPath(fromCell, toCell);           // cells (Vector2d, x the column)
grid.getPointPath(fromCell, toCell);        // world points (cell centre + grid.offset)
const { path, found } = grid.findPath(enemy.pos, player.pos, {
    smooth: true,                // straight lines across open ground
    maxNodes: 300,               // a cap, so an unreachable goal cannot stall a frame
    allowPartialPath: true,      // unreachable: the way to the nearest cell (found false)
    avoid: others.map((o) => o.pos), avoidWeight: 6,   // spread out, this search only
});
// path[0] is the start: head for path[1]
```

- **The grid is a snapshot.** A tile changed with `setTile` / `clearTile`, or
  a wall body added, is not seen until `grid.refreshCell(col, row)` or
  `grid.refresh()`; `setSolid` / `setWeight` (and `fillSolidRegion` /
  `fillWeightRegion`) change cells directly.
- **`fromTileLayer` makes every non-empty cell solid by default** (a walls
  layer). On a floor layer, where every cell has a tile, pass `solid`, or
  everything is solid.
- **Paths include the start**, and are empty when the goal cannot be reached
  unless `allowPartialPath` is set.
- **Build `fromBodies` after the level loads.** It scans the shapes, not a
  physics query, so it works before the world first steps; it reads `bodyDef`
  shapes too, so it is the same on every adapter.
- A weight is 1 or more and finite: block with `setSolid`, not `Infinity`.
- `PathfindingPlugin` (`plugin.register(PathfindingPlugin, "pathfinding",
  { layer: "walls" })`) only rebuilds the grid when a level loads; a `Grid`
  works on its own.
- `PathfindingDebug` draws solid and heavy cells, the cells a search looked
  at (`trace: true`) and the paths.
- **Isometric maps work**: `fromTileLayer` (and the plugin) sees an isometric
  layer and lays the cells out as diamonds; for `new Grid` or `fromBodies`,
  pass `cellShape: "isometric"`. Staggered and hexagonal maps are not
  supported (`fromTileLayer` throws).

### `@melonjs/capacitor-plugin`

Bridges Capacitor's native lifecycle and hardware-back events into the engine:

```js
import { CapacitorPlugin } from "@melonjs/capacitor-plugin";
plugin.register(CapacitorPlugin, "capacitor", options);
// plugin.cache.capacitor.teardown()  — detach every listener
```

It also exports helpers usable on their own: `onBackButton`, `bindStageBack`,
`lockOrientation` / `unlockOrientation`, `hideSplash`. See `melonjs-platforms`
for native apps and the other platforms.

With `pauseOnBackground` (the default), going to the background pauses the
game and coming back resumes it, but only if this pause was the plugin's: a
game the player had paused stays paused.

## Physics adapters

`@melonjs/planck-adapter`, `@melonjs/matter-adapter` and
`@melonjs/rapier2d-adapter` swap the physics world wholesale. Pick **one** per
game (`app.world.setAdapter()` can switch it later). The portable surface — the
declarative `renderable.bodyDef`, `world.adapter.queryAABB(rect)` and
`world.adapter.raycast(from, to)` — works unchanged across the built-in world and
every adapter, so entity code does not have to branch. The exceptions are in
`melonjs-physics`: `Box3d`, `Sphere` and `Point` shapes are built-in only,
`type: "kinematic"` is planck and Rapier only, and the adapters' `queryAABB`
returns only renderables with a body. The Rapier adapter's WebAssembly loads
asynchronously, so it must be made with `await RapierAdapter.create()`.
`create()` is on every adapter from planck-adapter 1.7, matter-adapter 1.6 and
rapier2d-adapter 1.0 (an older planck or matter adapter is made with
`new X(options)`), and `world.setAdapter()` from melonJS 20.14.

Two queries are **not** portable: `querySphere` and `raycast3d` exist only on the
built-in adapter (planck, matter and Rapier are 2D-only and deliberately omit
them).
`queryAABB` is the one region query every adapter must implement, so call the
others optionally — `app.world.adapter.querySphere?.(center, radius)`. For rays
there is a real flag: `app.world.adapter.capabilities.raycasts3d`.

Behaviour genuinely differs: velocity units, force magnitudes and where a body's
position is measured from all change. See `melonjs-physics`.

## Writing your own

There is **no `init()` lifecycle hook** — the constructor is where setup goes,
and `register` instantiates it for you.

```js
import { plugin, event } from "melonjs";

class MyPlugin extends plugin.BasePlugin {
    constructor(app = undefined) {
        super(app);              // stores it as this.app
        this.version = "20.0.0"; // MINIMUM engine version this needs
        event.on(event.GAME_UPDATE, () => { /* … */ });
    }
}

plugin.register(MyPlugin, "myPlugin");
```

`this.version` defaults to the running engine version, which means it always
passes — set it deliberately to the oldest version you actually support.

To wrap an existing engine method, `plugin.patch` keeps the original reachable
as `this._patched()`:

```js
plugin.patch(app, "update", function (time) {
    const result = this._patched(time);
    return result;
});
```

`patch` takes a class *or* an instance: given a constructor it patches the
prototype (that is how the debug plugin decorates `Renderable.postDraw`), given a
plain object it patches that object. `this._patched` is only bound for the
synchronous duration of your replacement — it is set before the call and nulled
straight after — so call it inline, never after an `await`.

```js
plugin.patch(Renderable, "postDraw", function (renderer) {
    this._patched(renderer);
    // draw an overlay on top of every renderable
});
```

A plugin is the right shape when you need to augment engine classes or hook the
engine lifecycle globally. For anything that is just game code, a `Renderable`
or a `Stage` is simpler and easier to test.

## Symptom → cause

| symptom | cause |
|---|---|
| `plugin <name> already registered` | the registry is global; registered twice, often across hot reloads |
| `Plugin version mismatch` | the plugin's `version` floor is above the running engine |
| `Plugin should extend the BasePlugin Class !` | the class does not extend `plugin.BasePlugin` |
| the panel reports another app's numbers | `app` defaulted to `game`, the last Application to finish `init()` |
| `world.adapter.querySphere is not a function` | built-in adapter only; planck, matter and Rapier are 2D-only |
| a Tiled map opens in Tiled but not melonJS | compressed layers, tiled-inflate plugin missing |
| a path goes through walls | the grid does not know them: a floor layer needs `solid`, a changed tile needs `refreshCell`, `fromBodies` walls must be `WORLD_SHAPE` bodies (or pass `solid`) |
| a path cuts across a wall corner | `diagonalMode` is `"always"` or `"atLeastOneWalkable"`: use `"onlyIfNoObstacles"` |
| no path found (empty path, `found` false) | the goal is walled off, solid, or past `maxNodes`; `allowPartialPath: true` returns the way to the nearest point |
| everything is solid on a `fromTileLayer` grid | a floor layer, where every cell has a tile: pass `solid` |
| an agent turns back at the start | `path[0]` is where it stands: head for `path[1]` |
| a path is offset from an isometric map | the grid is square: `new Grid` / `fromBodies` without `cellShape: "isometric"` |
| a path is offset from the map | the grid's `x` / `y` are not the layer's: built before the layer was in its container, or the container moved since |
| plugin setup never runs | setup written in an `init()` method — there is no such hook |
| `Plugin should extend the BasePlugin Class !` when registering an adapter | adapters are a construction setting (or `world.setAdapter()`), not a plugin |
| `PlanckAdapter.create is not a function` (or `MatterAdapter`) | planck-adapter < 1.7 or matter-adapter < 1.6; upgrade, or `new PlanckAdapter(options)` |
| `TypeError` reading `renderer` from `plugin.register(SpinePlugin)` | registered before `await app.init()`; the plugin's `app` is still unset |
| physics behaves differently after adding an adapter | expected — units and force scales differ; re-tune |
| a Spine object slides off screen when the camera moves, or ignores its container (WebGL / WebGPU) | spine-plugin < 4.0.1 drew without the camera's and the parents' transform; upgrade |
| a Spine object ignores `setOpacity()` / `alpha` | spine-plugin < 4.0.1; upgrade |
| a game paused from its menu is running again after the app comes back from the background | capacitor-plugin < 1.0.1 resumed on every return; upgrade |
| touch controls miss the finger after browser zoom or a move to another screen | gamepad-plugin < 1.2.1; upgrade |

## Related skills

- `melonjs-physics` — the adapters and their behavioural differences
- `melonjs-tilemaps` — where the inflate plugin becomes mandatory
- `melonjs-performance` — using the debug panel to measure
- `melonjs-platforms` — Capacitor and native packaging, and the other platforms
- `melonjs-3d-assets` — why skeletal characters go through Spine
