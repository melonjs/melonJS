---
name: melonjs-tilemaps
description: "Use this skill for Tiled maps in melonJS — loading TMX/TSX levels, spawning entities from Tiled objects, collision shapes authored in Tiled, isometric and hexagonal maps, and image layers. Covers registerTiledObjectClass and the pool.register name contract, camera bounds, compressed maps needing the inflate plugin, and the level director API. Triggers on: Tiled, TMX, TSX, tilemap, level.load, level.load async, await level.load, tileset, ImageLayer, isometric, hexagonal, staggered, pool.register, Collectable, Trigger, object layer, collision layer, parallax, registerTiledObjectClass, registerTiledObjectFactory, TMXObject, resolvedProperty, resolvedProperties, tile class, tile properties."
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

Those `game.` defaults are the engine's own, and `game` is whichever
`Application` finished `init()` last. **Pass `container` explicitly** from a
`Stage`, which has the right one: `level.load("map", { container: this.app.world })`.

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
Tiled **class**, then its **name**, then, for a tile object with no class of
its own, its **tile's class**, then the structural fallbacks `"text"`,
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

### Classes and properties set on tiles

In Tiled, a tile can carry a class and custom properties (tileset editor), and
every object placed from that tile shows them as its own. melonJS follows:

- **The tile's class.** A tile object with no class is built by the class
  registered under its tile's class, so a designer sets "Chest" once on the
  chest tile and every chest dropped in the map is a `Chest`. The object's
  own class or registered name still comes first, and a tile classed like a
  built-in (`Sprite`, `Trigger`, `shape`...) stays a plain tile.
- **The tile's properties.** Read them with `settings.resolvedProperty(name)`
  or `settings.resolvedProperties()`, which merge the tile's properties under
  the object's own, as Tiled's scripting API of the same names does. They are
  **not** set on `settings` by name: only the object's own properties are,
  as before, so a tile property named like a sprite setting never reaches a
  plain tile sprite.

```ts
import { registerTiledObjectClass, Sprite, type TMXObject } from "melonjs";

// the custom properties set on the object itself, by name
interface DoorSettings extends TMXObject {
    locked?: boolean;
}

class Door extends Sprite {
    locked: boolean;
    facing: string;
    constructor(x: number, y: number, settings: DoorSettings) {
        super(x, y, { image: "door" });
        this.locked = settings.locked ?? false;
        // on the object, or else on the door tile in the tileset
        this.facing = settings.resolvedProperty("facing") ?? "N";
    }
}
registerTiledObjectClass("Door", Door);   // and give the door tile the class "Door"
```

`TMXObject` is the type of the `settings` a registered class (or factory)
receives: the object as read from the map, with `tile` (a `Tile`) on a tile
object. Extend it with the properties your class reads.

For a class that is not a `Sprite` itself (a `Container` holding the tile and
something else, say), `settings.tile.getRenderable()` returns the tile's sprite
as a plain tile object would get it: from a tileset image, an image collection
or an animated tile alike, with no region names to build by hand.

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
points all work. On an isometric map they are projected with the map's tile
ratio; a circle stays an `Ellipse`, but any other ellipse comes out tilted and
becomes a `Polygon`, so code that checks a shape's type should expect either.

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
on the settings object passed to your entity's constructor. Properties set on
the object's tile are read with `settings.resolvedProperty(name)`. One is also
applied to the object the map creates: an `int` property named
`visibilityLayer` sets which cameras draw it (see `melonjs-camera-and-drawing`).

## Map orientations

Orthogonal, **isometric**, hexagonal, staggered and oblique are all supported;
anything else throws `<orientation> type TMX Tile Map not supported!` at load.
Isometric maps need y-sorting so objects overlap correctly:

```js
app.world.sortOn = "y";       // after level.load
```

The world then keeps its objects in order as they move (`autoSort`, on by
default): a character walking around passes in front of and behind the scenery
with no `sort()` call.

`sortOn` only accepts `"x"`, `"y"`, `"z"` (the default) or `"depth"` and throws
on anything else. `Vector2d`, `Vector3d`, their observable variants and `Polygon`
all carry `.toIso()` / `.to2d()` for converting between screen and map space.

### What the y-sort can and cannot sort

`sortOn = "y"` sorts **objects**, never tiles. A tile layer is a single
renderable drawn in one piece, so a character ends up in front of all of it or
behind all of it. Anything a character walks both in front of and behind
(walls, trees, furniture) has to be on an **object layer, as tile objects**,
and in the **same** object layer as the characters: each Tiled layer gets its
own `z`, and the y-sort compares `z` before `y`. Keep the floor on a tile layer
below them. This holds for any y-sorted map, isometric or a top-down
orthogonal one.

```
floor      tile layer     the ground, drawn first
dungeon    object layer   walls, props, chests, doors, the hero
collision  object layer   the shapes (not drawn)
```

Tile objects with no class are built for you: each one is a `Sprite` with its
default body, static, over its whole image box and typed `ENEMY_OBJECT`. A
character keeping the default `collisionMask` (every type) collides with all of
them, so when the scenery's real collision is drawn in the collision layer,
mask the character to it:

```js
this.body.setCollisionMask(collision.types.WORLD_SHAPE);
```

Give the objects with behaviour a Tiled class and register it, as above.

The `y` it sorts on is `pos.y`, and Tiled objects default to a `(0, 0)` anchor,
so that is the **top** of each image. Sorting by the top only matches sorting by
the feet when every image is the same height and stands on the bottom of its
box, the usual layout of an isometric pack. A shorter image sorts in front of
things it stands behind. Either pad the art to one height, or line every object
up by the bottom of its image with `sortOffset`, which changes the order and
never the position:

```js
level.load("map1");
app.world.sortOn = "y";
for (const child of app.world.getChildren()) {
    child.sortOffset = child.height;   // sort by the bottom of each image
}
```

A character you create in code follows the same convention as the scenery: by
the top of a frame as tall as the scenery's (`anchorPoint` `(0, 0)`), or by its
feet when everything sorts by the bottom.

Two equal positions keep insertion order, and the one added **last** is drawn
**behind**: a decoration placed at its wall's exact position disappears. Give
it `sortOffset = 1`. A `Container` or a particle emitter is sorted by its top
left corner (an emitter's by the top of its spawn area); give it the offset to
the point it belongs with, such as `door.pos.y - dust.pos.y`.

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
| a character is always in front of (or behind) every wall | the walls are on a tile layer, or on another object layer than the character: each layer has its own `z`, compared before `y` |
| a small prop draws over a character standing in front of it | images of different heights: the y-sort uses `pos.y`, the top of a Tiled object's image. Pad the art, or set `sortOffset = height` on every object to sort by the bottom |
| a decoration placed at the same position as a wall disappears behind it | a tie keeps insertion order and draws the later one behind: `sortOffset = 1` |
| particles (or a container) at the foot of something draw over a character standing in front of it | they sort by the top of their spawn area (or the container's top left): set `sortOffset` to line them up with what they belong to |
| a character is stopped short of walls and props placed as tile objects | it collides with their default bodies (static, `ENEMY_OBJECT`, the whole image box); mask it to `collision.types.WORLD_SHAPE` when the collision layer holds the real shapes |
| a property set on a tile is undefined on the object's `settings` | tile properties are not copied onto `settings`: read them with `settings.resolvedProperty(name)` |
| objects placed from a classed tile come out as plain sprites | that class is not registered, it is a built-in name, or the object has a class or a registered name of its own, which come first |
| missing tiles or a blank map | the `.tsx` or tileset image was not preloaded |
| a tileset's transparent color (`trans`) still shows (the console says it could not be applied) | the image cannot be read back: one from another origin needs CORS headers on the server and `loader.setOptions({ crossOrigin: "anonymous" })` (without them WebGL and WebGPU cannot draw it at all), and a compressed texture cannot be changed: export it with an alpha channel instead |
| changing tiles at runtime is slow on a pre-rendered layer | outside an orthogonal map whose tiles fit their cells, a changed tile re-bakes the whole layer before it next draws: keep layers you edit often off `preRender` |
| thin lines between tiles on the Canvas renderer, with smoothing on | filtering blends in the next tile of the tileset or its spacing, which a canvas cannot prevent: set `antiAlias: false`, or `preRender` the layer. WebGL and WebGPU keep each tile to itself |
| tilemap slow on some machines | layer fell back off the shader path — check the console warning for the reason |

## Related skills

- `melonjs-physics` — what the collision shapes become once loaded
- `melonjs-getting-started` — preloading and the asset type list
