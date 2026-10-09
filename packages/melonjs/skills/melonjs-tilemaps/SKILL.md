---
name: melonjs-tilemaps
description: "Use this skill for Tiled maps in melonJS — loading TMX/TSX levels, spawning entities from Tiled objects, collision shapes authored in Tiled, isometric and hexagonal maps, and image layers. Covers registerTiledObjectClass and the pool.register name contract, camera bounds, compressed maps needing the inflate plugin, and the level director API. Triggers on: Tiled, TMX, TSX, tilemap, level.load, level.load async, await level.load, tileset, ImageLayer, isometric, hexagonal, staggered, pool.register, Collectable, Trigger, object layer, collision layer, parallax, registerTiledObjectClass, registerTiledObjectFactory."
license: MIT
---

# Tiled maps

> melonJS's flagship content pipeline. Maps are authored in
> [Tiled](https://www.mapeditor.org/) and loaded through the `level` director —
> you rarely touch the `TMX*` classes directly.

## Loading a level

Preload the map **and** everything it references — the `.tmx`, any external
`.tsx` tilesets, and the tileset images:

```js
await loader.preload([
    { name: "map1",    type: "tmx", src: "data/map/map1.tmx" },
    { name: "tileset", type: "tsx", src: "data/map/tileset.tsx" },
    { name: "tiles",   type: "image", src: "data/img/tiles.png" },
]);

level.load("map1");           // inside Stage.onResetEvent
```

Asset `type` is `"tmx"` for maps and `"tsx"` for external tilesets — those are
the only two type strings the loader knows. The *file* can be `.tmx` / `.tsx`
(XML), or `.json` / `.tmj` / `.tsj`; the parser branches on the extension, not
on the type. `type: "tmj"` throws `unknown or invalid resource type`. You can
also skip `src` and pass the map inline via `data` (with `format: "json"` or
`"xml"`).

`level.load(levelId, options)` accepts `container` (default `game.world`),
`onLoaded` (default `game.onLevelLoaded`), `flatten` (default `game.mergeGroup`),
`setViewportBounds` (default **`true`**) and `async` (default `false`). It throws
`level <id> not found` for an unknown id — synchronously, in both forms, because
that is a typo rather than a load failure.

**`level.load` is deferred while the game loop is running.** It calls
`state.stop()` and finishes the load on a timer, after the current frame, so by
default it returns `true` before anything is in the world. Two ways to sequence
work after it:

```js
// await it
await level.load("map1", { async: true });
// the world is populated here

// ...or use the callback / event, which fire in both forms
level.load("map1", { onLoaded: () => this.spawnPlayer() });
```

`async: true` is the only thing that changes the return value — everything else
behaves identically, `onLoaded` included. Without it the call returns a boolean,
so `await level.load("map1")` is not an error and does not await the load:
`await true` resolves immediately, while the load is still sitting on a timer.
Pass the flag when you mean to await.

`level.reload()`, `level.next()` and `level.previous()` take the same `async`
option and resolve the same value they return — so `if (level.next())` becomes
`if (await level.next({ async: true }))`. Running out of levels reports `false`
either way rather than throwing. `level.getCurrentLevelId()` and
`level.levelCount()` round out the namespace. `flatten: false` wraps each Tiled
object group in its own `Container` named after the group.

## Spawning entities from Tiled objects

Objects are matched against a factory registry, in this order: the object's
Tiled **class**, then its **name**, then the structural fallbacks `"text"`,
`"tile"` and `"shape"`.

```js
import { registerTiledObjectClass, registerTiledObjectFactory } from "melonjs";

registerTiledObjectClass("Enemy", Enemy);   // ← matches Tiled class OR name
registerTiledObjectFactory("Spine", (settings, map) => { /* → Renderable */ });
level.load("map1");
```

These are the entry points to use. The registry is Tiled's own, held by the
object factory, and has nothing to do with object pooling.

`pool.register(className, classObj)` **also** works and registers a Tiled
factory as a side effect, under the name and again under an `me.`-prefixed
alias, unless you set `pool.autoRegisterTiled = false`. That is the older
spelling, kept working for maps and games written against it, and it now
prints a one-off deprecation notice: `me.pool` is deprecated since 18.0.0.

Its third argument no longer buys anything here. It used to make Tiled
objects recyclable; they are constructed directly now, and the container
returns children to typed pools rather than to the name-keyed one. To pool a
class you spawn constantly, give it a `createPool` and register it for Tiled
separately:

```js
registerTiledObjectClass("mainPlayer", PlayerEntity);
```

Register **before** loading. With no match the object falls through to the
structural factory and becomes a plain `Renderable` with a static body — it does
not error, it just has none of your behaviour.

`registerTiledObjectClass` **throws** if you register a *different* constructor
under a name already taken (re-registering the same one is a no-op).
`registerTiledObjectFactory` overwrites and only `console.warn`s, so it is the
one to use for replacing something already registered.

**Overriding a built-in name always works.** The engine's own classes are
DEFAULTS: they fill a name nothing else has claimed, and yours takes it over
whenever you register, before or after a map has loaded.

```js
registerTiledObjectClass("Trigger", MyTrigger);   // whenever you like
```

The throw is for a clash between two of *your* classes under one name. For
that case `registerTiledObjectFactory` overwrites and only warns.

melonJS pre-registers `Renderable`, `Sprite`, `NineSliceSprite`, `Text`,
`BitmapText`, `ImageLayer`, `ColorLayer`, `Light2d`, `Collectable`, `Trigger`
and `Entity` as Tiled classes, so `Collectable` and `Trigger` work out of the
box. Each is registered under its `me.`-prefixed alias as well, so a map
authored against melonJS 1.x finds them where it looks.

A `Trigger` forwards a **fixed list** of settings to `level.load()` — not
whatever you pass it. Today that list is `container`, `onLoaded`, `flatten`,
`setViewportBounds` and the glTF scene options (`scale`, `rightHanded`,
`lights`, `lightIntensityScale`, `castGroundShadow`, `shadowGroundY`); see the
3D assets skill. Anything outside it is **dropped silently**, which is worth
knowing before you spend an afternoon on a map that loads at the wrong scale.
`async` is excluded deliberately — the trigger needs to sequence its own
transition.

## Camera bounds

`level.load` sets the viewport bounds to the map size for you —
`setViewportBounds` defaults to `true`, and the handler is re-run on every
viewport resize, centring the map when it is smaller than the screen. You only
need to do it by hand when you opted out:

```js
level.load("map1", { setViewportBounds: false });
app.viewport.setBounds(0, 0, mapWidth, mapHeight);   // now it's on you
```

The same is true if you drive `TMXTileMap.addTo(container, flatten, setViewportBounds)`
directly — note that method's `setViewportBounds` defaults to **`false`**, the
opposite of `level.load`'s.

## Collision shapes

Draw collision geometry in Tiled on an object layer and melonJS turns it into
world shapes automatically — rectangles, polygons, polylines, ellipses and
points all work.

The contract is the **layer name**: melonJS lowercases it and checks whether it
*contains* `"collision"` (so `collision`, `Collision`, `world collision` all
match). Inside such a layer, objects **with no name** get
`collisionType = collision.types.WORLD_SHAPE` and `type = "static"`. A *named*
object in a collision layer keeps whatever its factory gave it — that is how you
mix triggers into the collision layer.

An object that matches no factory and carries no text or tile data falls to the
`"shape"` factory: a plain `Renderable` with a static `bodyDef` built from its
geometry, which the world auto-registers with the active adapter on `addChild`.

For per-object physics, set the object's custom properties in Tiled; they arrive
on the settings object passed to your entity's constructor.

## Map orientations

Orthogonal, **isometric**, hexagonal, staggered and oblique are all supported;
anything else throws `<orientation> type TMX Tile Map not supported!` at load.
Isometric maps need y-sorting so objects overlap correctly:

```js
app.world.sortOn = "y";       // after level.load
```

`sortOn` only accepts `"x"`, `"y"`, `"z"` (the default) or `"depth"` and throws
on anything else. `Vector2d`, `Vector3d`, their observable variants and `Polygon`
all carry `.toIso()` / `.to2d()` for converting between screen and map space.

## Image layers

`ImageLayer` gives parallax backgrounds with a ratio per axis, set in Tiled or in
code. Repeat behaviour matches Tiled's.

## Compressed maps need a plugin

A map saved with **gzip, zlib or zstd** compressed layer data throws
`No inflate function set — GZIP/ZLIB decompression not supported!` at parse time
without:

```js
import { plugin } from "melonjs";
import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";

plugin.register(TiledInflatePlugin);   // before preloading any compressed map
```

Uncompressed base64 and CSV layer data need no plugin. If a map loads in Tiled
but not in melonJS, check the layer compression setting first.

## Rendering

Each tile layer resolves to one of three `renderMode`s — `"shader"`,
`"prerender"` or `"perTile"` — auto-selected in that order of preference, or
forced per layer. The `"shader"` path is a single quad per tileset with a
per-pixel GID lookup in the fragment shader. It requires **all** of:

- a renderer that reports GPU tile-layer support (WebGL 2 / WebGPU — not Canvas),
- `world.gpuTilemap !== false` (the `gpuTilemap` application setting, default `true`),
- an **orthogonal** layer — isometric, hexagonal, staggered and oblique always
  fall back,
- no collection-of-image tileset, no non-zero `tileoffset`, and tile overflow
  within the shader's 4-cell limit.

When a layer falls back, melonJS `console.warn`s once with the reason. Practical
consequences: fewer tilesets means fewer batches (one packed tileset beats
several small ones), and on the Canvas fallback large maps get noticeably
slower. `world.preRender` (or a `preRender` layer property in Tiled) opts an
unanimated layer into the offscreen-bake path instead.

## Symptom → cause

| symptom | cause |
|---|---|
| a Tiled object becomes a plain shape with no behaviour | its class/name does not match any registered factory, or it was registered after `level.load` |
| the world is still empty right after `level.load` | the load is deferred to a timer while the loop runs — `await level.load(id, { async: true })`, or use `onLoaded` / `LEVEL_LOADED` |
| `await level.load(id)` returned `true` rather than a promise | without `async: true` the call returns a boolean; `await true` resolves immediately and the load has not run yet — pass the flag when you mean to await |
| `level <id> not found` | the map was never preloaded, or the asset `name` differs from the id passed to `load` |
| `unknown or invalid resource type` | asset `type` set to `"tmj"` / `"tsj"` — use `"tmx"` / `"tsx"` with the `.tmj` / `.tsj` file |
| camera will not scroll | `setViewportBounds: false`, or the map was added with `addTo()` (which defaults to `false`) |
| `No inflate function set` at parse time | compressed layers without the tiled-inflate plugin |
| collision shapes are not solid | the object layer's name does not contain `"collision"`, or the objects are named |
| isometric objects overlap wrongly | `world.sortOn` not set to `"y"` |
| missing tiles or a blank map | the `.tsx` or tileset image was not preloaded |
| tilemap slow on some machines | layer fell back off the shader path — check the console warning for the reason |

## Related skills

- `melonjs-physics` — what the collision shapes become once loaded
- `melonjs-getting-started` — preloading and the asset type list
