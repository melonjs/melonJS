---
name: melonjs-plugins
description: "Use this skill when adding a melonJS plugin or adapter — the debug panel, Spine skeletal animation, compressed Tiled map support, Capacitor packaging — or when writing your own plugin. Covers plugin.register and its version gate, plugin.cache, plugin.patch, and why physics adapters are not plugins. Triggers on: plugin, plugin.register, plugin.cache, plugin.get, plugin.patch, BasePlugin, debug-plugin, DebugPanelPlugin, SpinePlugin, TiledInflatePlugin, CapacitorPlugin, adapter, custom plugin, plugin version mismatch, already registered."
license: MIT
---

# Plugins and adapters

## Two different mechanisms

This trips people up, so it is worth stating first:

| | how it is installed |
|---|---|
| **Plugins** | `plugin.register(Class, name?, ...args)` — after `await app.init()` |
| **Physics adapters** | an `Application` **setting** (`physic:`), before `init()` |

```js
// the adapter is chosen at construction …
const app = new Application(800, 600, {
    parent: "screen",
    physic: new PlanckAdapter({ gravity, pixelsPerMeter }),
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

### `@melonjs/capacitor-plugin`

Bridges Capacitor's native lifecycle and hardware-back events into the engine:

```js
import { CapacitorPlugin } from "@melonjs/capacitor-plugin";
plugin.register(CapacitorPlugin, "capacitor", options);
// plugin.cache.capacitor.teardown()  — detach every listener
```

It also exports helpers usable on their own: `onBackButton`, `bindStageBack`,
`lockOrientation` / `unlockOrientation`, `hideSplash`. See `melonjs-deployment`
for the wider packaging picture.

## Physics adapters

`@melonjs/planck-adapter` and `@melonjs/matter-adapter` swap the physics world
wholesale. Pick **one** per game. The portable surface — the declarative
`renderable.bodyDef`, `world.adapter.queryAABB(rect)` and
`world.adapter.raycast(from, to)` — works unchanged across the built-in world and
both adapters, so entity code does not have to branch.

Two queries are **not** portable: `querySphere` and `raycast3d` exist only on the
built-in adapter (planck and matter are 2D-only and deliberately omit them).
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
| `world.adapter.querySphere is not a function` | built-in adapter only; planck and matter are 2D-only |
| a Tiled map opens in Tiled but not melonJS | compressed layers, tiled-inflate plugin missing |
| plugin setup never runs | setup written in an `init()` method — there is no such hook |
| `plugin.register` for an adapter does nothing | adapters are a construction setting, not a plugin |
| physics behaves differently after adding an adapter | expected — units and force scales differ; re-tune |

## Related skills

- `melonjs-physics` — the adapters and their behavioural differences
- `melonjs-tilemaps` — where the inflate plugin becomes mandatory
- `melonjs-performance` — using the debug panel to measure
- `melonjs-deployment` — Capacitor and native packaging
- `melonjs-3d-assets` — why skeletal characters go through Spine
