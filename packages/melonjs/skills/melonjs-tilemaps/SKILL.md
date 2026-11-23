---
name: melonjs-tilemaps
description: "Use this skill for tile maps in melonJS: Tiled maps, LDtk levels, Sprite Fusion maps, and tile layers built in code. Loading TMX/TSX, .ldtk and Sprite Fusion exports, spawning entities from Tiled objects, collision shapes authored in Tiled, isometric and hexagonal maps, image layers, and reading or changing tiles while the game runs. Covers registerObjectClass and the pool.register name contract, camera bounds, compressed maps needing the inflate plugin, and the level director API. Triggers on: Tiled, TMX, TSX, LDtk, .ldtk, IntGrid, Sprite Fusion, spritefusion, tilemap, setTile, clearTile, cellAt, getTile, getTileById, change a tile, game board, grid, getTileProperties, setTileProperties, tile attributes, level.load, tileset, ImageLayer, infinite map, render order, isometric, hexagonal, staggered, pool.register, Trigger, object layer, collision layer, collider, parallax, registerTiledObjectClass, TileLayer, Tileset, PlacedTileLayer, setCell, mergeGridRects, level.registerFormat, TMXObject, tile class."
license: MIT
---

# Tiled maps

> melonJS's flagship content pipeline. Maps are authored in
> [Tiled](https://www.mapeditor.org/) and loaded through the `level` director —
> you rarely touch the `TMX*` classes directly.
>
> Levels made with [LDtk](https://ldtk.io) load the same way, from the
> `.ldtk` project file as the editor saves it: see "LDtk levels" below. What
> this skill says of tile layers, the level director and the object registry
> holds for them too.
>
> A map made with [Sprite Fusion](https://www.spritefusion.com) loads as it is
> exported, `map.json` or `map.tmx`, under the asset type `"spritefusion"`:
> see "Sprite Fusion maps" below.

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

**A game with several maps** keeps each map and the images only it uses in a
bundle of its own, beside a `common` bundle for the shared tileset, the player
and the sounds: an assets file exporting `{ common: [...], map1: [...],
map2: [...] }`, passed as it is to `loader.preload()`. A map's level can then be
freed with `loader.unload("map1")` and brought back with
`await loader.load("map1")` before `level.load("map1")`; a game whose maps
loop back simply keeps them all loaded. `melonjs-loading-assets` covers the
pattern.

Asset `type` is `"tmx"` for maps and `"tsx"` for external tilesets (`"tilemap"`
is another name for `"tmx"`, see "A map written by another tool" below). The
*file* can be `.tmx` / `.tsx`
(XML), or `.json` / `.tmj` / `.tsj`; the parser branches on the extension, not
on the type. `type: "tmj"` throws `unknown or invalid resource type`. You can
also skip `src` and pass the map inline via `data`, as the parsed JSON object
of a Tiled JSON export (not an XML string).

**Prefer JSON where there is no DOM.** XML maps and tilesets are parsed with
`DOMParser`, which only a page has: in a Web Worker, or on nx.js (the Nintendo
Switch, see `melonjs-platforms`), loading one fails, and `preload()` rejects
with "Failed loading resource …" whose `cause` (also logged to the console)
says to export it as JSON. Export the map *and* its external tilesets as
`.tmj` / `.tsj` (Tiled: File → Export As, or set JSON as the format in the
project).

`level.load(levelId, options)` accepts `container` (default `game.world`),
`onLoaded` (default `game.onLevelLoaded`), `flatten` (default `game.mergeGroup`),
`setViewportBounds` (default **`true`**), `objects` (default `true`, see
below) and `async` (default `false`). It throws
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
import { registerObjectClass, registerObjectFactory } from "melonjs";

registerObjectClass("Enemy", Enemy);   // ← matches Tiled class OR name
registerObjectFactory("Spine", (settings, map) => { /* → Renderable */ });
level.load("map1");
```

The registry is the same for every kind of level: a class registered here is
also built for an LDtk entity of that name. (`registerTiledObjectClass` and
`registerTiledObjectFactory` are the older names of these two functions,
deprecated since 20.18 and still working.)

These are the entry points to use. The registry is the level loader's, held by
the object factory, and has nothing to do with object pooling. Since 20.18 the
same two functions also go by `registerObjectClass` and
`registerObjectFactory`: one registry whatever the editor, so an LDtk entity
named "Enemy" is built by the class registered for a Tiled object of that
class.

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
registerObjectClass("mainPlayer", PlayerEntity);
```

Register **before** loading. With no match the object falls through to the
structural factory and becomes a plain `Renderable` with a static body — it does
not error, it just has none of your behaviour.

`registerObjectClass` **throws** if you register a *different* constructor
under a name already taken (re-registering the same one is a no-op).
`registerObjectFactory` overwrites and only `console.warn`s, so it is the
one to use for replacing something already registered.

**Overriding a built-in name always works.** The engine's own classes are
DEFAULTS: they fill a name nothing else has claimed, and yours takes it over
whenever you register, before or after a map has loaded.

```js
registerObjectClass("Trigger", MyTrigger);   // whenever you like
```

The throw is for a clash between two of *your* classes under one name. For
that case `registerObjectFactory` overwrites and only warns.

### Finding an object, and choosing which are built

An object in the world is found as any child is, by the name or the id its
level gives it, whatever class built it and whatever the editor:

```js
const [player] = app.world.getChildByName("Player");
const [door] = app.world.getChildByProp("id", 12);   // Tiled's object id; LDtk's iid, a string
```

The id is put on the object for you when its class does not take it (a class
that sets its own `id` keeps it). The name is the class's business: a `Sprite`
or an `Entity` takes the level's, a `Trigger` is always named "Trigger" (find
one by its id, or with `getChildByType(Trigger)`).

`objects` chooses which objects a load builds: `false` for none, or a function
given each object's settings, the same its class would be given, before
anything is built:

```js
// a level that comes back without what the player took
level.load("map1", { objects: (settings) => !taken.has(settings.id) });
```

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
import { registerObjectClass, Sprite, type TMXObject } from "melonjs";

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
registerObjectClass("Door", Door);   // and give the door tile the class "Door"
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
box. A rectangle object of class `ColorLayer` with a `color` property is
filled with that color (20.18). Each is registered under its `me.`-prefixed alias as well, so a map
authored against melonJS 1.x finds them where it looks.

A `Trigger` forwards a **fixed list** of settings to `level.load()` — not
whatever you pass it. Today that list is `container`, `onLoaded`, `flatten`,
`setViewportBounds`, `objects` and the glTF scene options: `scale`, `rightHanded`,
`lights`, `lightIntensityScale` and the ground-shadow settings
(`castGroundShadow`, `shadowGroundY`, `shadowOpacity`, `shadowScale`,
`shadowOffset`, `shadowStretch`, `shadowDirectionX`, `shadowDirectionZ`,
`shadowGroundNormal`, `shadowLight`, but not `shadowGroundPoint`); see the 3D
assets skill. Anything outside it is **dropped silently**, which is worth
knowing before you spend an afternoon on a map that loads at the wrong scale.
`async` is excluded deliberately — the trigger needs to sequence its own
transition.

That transition is the trigger's own, and every part of it can be a property
of the trigger object in Tiled, with no code: `color` and `duration` (both, or
there is none), `transition` (`"fade"` or `"mask"`), and for a mask `shape`,
`center` and `invert`. A `shape` property is text, so it names a preloaded
image (its silhouette) or is `"touching"`; `center: "touching"` closes the
mask on whoever walked in. So a door that closes the player's own silhouette
onto the player is the properties `transition = mask`, `shape = touching`,
`center = touching`, `color = #000`, `duration = 400`. See
`melonjs-scenes-and-state` for the shapes and what `invert` does.

## Reading and changing tiles at run time

A tile layer is a live grid, not just a picture: read it as the game board,
and change cells while the game runs — a door opening, a floor panel lighting
up, a wall blown away. A loaded tile layer is a `TMXLayer` in the world, under
the name it has in Tiled:

```js
await level.load("map1", { container: this.app.world, async: true });
const board = this.app.world.getChildByName("ground")[0];   // a TMXLayer
board.cols; board.rows;              // the grid, in cells
board.tilewidth; board.tileheight;   // a cell, in pixels
```

Two coordinate systems, and the methods do not share one:

| method | takes | returns |
|---|---|---|
| `cellAt(col, row)` | column and row | the `Tile` there, or `null` for an empty cell or outside the grid |
| `getTile(x, y)` | **world pixels** | the same `Tile` object `cellAt` gives, or `null` |
| `setTile(tile, col, row)` | column and row | puts `tile` there, and returns it |
| `clearTile(col, row)` | column and row | empties the cell: `cellAt` then returns `null` |
| `getTileById(gid, col, row)` | a global tile id, column and row | a new `Tile`, to pass to `setTile` |

Columns and rows are the map's tile coordinates, the ones Tiled shows. On an
**infinite** map a layer can hold tiles left of or above the map's origin:
there `board.startx` / `board.starty` are negative, its cells run from
`startx` to `startx + cols - 1` (and `starty` to `starty + rows - 1`), and
`cellAt(-3, -2)` is the tile Tiled shows at (-3, -2), drawn where Tiled draws
it. On a finite map both are 0:

```js
for (let row = board.starty; row < board.starty + board.rows; row++) {
    for (let col = board.startx; col < board.startx + board.cols; col++) {
        const tile = board.cellAt(col, row);   // every cell, infinite maps included
    }
}
```

An infinite map's `getBounds()` (and its `width` / `height`) covers the map's
own area and every painted tile, so a level loaded with `setViewportBounds`
lets the camera reach tiles painted past the map's size, or left of or above
its origin. Empty chunk cells past the last painted tile are not part of it.
Size a camera you set up yourself from `map.getBounds()`, not from
`cols * tilewidth`, which is only right for an orthogonal map:

```js
const b = level.getCurrentLevel().getBounds();
app.viewport.setBounds(b.left, b.top, b.width, b.height);
```

A `Tile` carries `tileId` (its **global** id), `col`, `row` and `tileset`.
Tiled shows a tile's *local* id in the tileset editor; the global id is
`tileset.firstgid + localId`, and only the global one works with `setTile`.
The properties of the tile in a cell come from the layer (20.18), whatever
the map was made with: a Tiled tile's custom properties, an LDtk tile's custom
data and tags, a Sprite Fusion tile's attributes.

```js
const props = board.getTileProperties(col, row);   // { kind: "floor" }, or undefined
```

It is a method of a `TileLayer`. An LDtk layer that stacks tiles or places
them off its grid is a `PlacedTileLayer`, which has no cells to ask: test
`layer instanceof TileLayer` on an LDtk level before calling it.

They are those of the tile in its tileset, with those the one cell has of its
own over them: `board.setTileProperties(col, row, { locked: true })` gives a
cell some, which last until the cell is written (`setTile`, `setCell`,
`clearTile`). Read the object, do not write to it: it may be the tileset's.

The tileset's alone, and the tile's class, come from the tileset by global id:

```js
const tile = board.cellAt(col, row);
const props = tile && tile.tileset.getTileProperties(tile.tileId);  // { kind: "floor" } or undefined
const cls = tile && tile.tileset.getTileClass(tile.tileId);
```

To swap a cell for another tile of the tileset, build the tile and set it. Look
global ids up by property once, rather than hard-coding them, so a designer
can rearrange the tileset:

```js
const tileset = board.tilesets.getTilesetByIndex(0);   // the layer's first tileset
const gidByKind = new Map();
for (let gid = tileset.firstgid; gid <= tileset.lastgid; gid++) {
    const kind = tileset.getTileProperties(gid)?.kind;
    if (kind !== undefined) gidByKind.set(kind, gid);
}

// light a floor panel up
board.setTile(board.getTileById(gidByKind.get("floor-lit"), col, row), col, row);
// knock a wall down
board.clearTile(col, row);
```

The layer redraws the changed cell by itself. What it does **not** change is
collision: solid ground comes from collision object layers (below), so a tile
set or cleared changes what is drawn and what `cellAt` returns, not what a body
runs into. Keep a layer you edit often off `preRender` (see the symptom table).

A tile layer moves with its `pos`. It starts where its offset in Tiled puts
it (Layer → Offset), and the game moves it from there; its tiles are drawn
where it is, and `getTile(x, y)` answers for where they are drawn. Move it
by a difference, not to a point: `pos` is not (0, 0) to begin with on every
map (an infinite one, an oblique one).

```js
board.pos.y -= 8;                    // the whole layer, 8 pixels up
board.getTile(pointer.x, pointer.y); // still the tile under the pointer
```

The other layers follow their offset in Tiled too: an image layer is placed by
it, an object layer's objects are created that far from where they were drawn
(collision shapes with them), and a group layer's offset moves the tile layers
inside it, on top of their own. A group can only hold tile layers: with an
object layer, an image layer or another group inside a group, the map fails
to load.

The map's own custom properties (Map → Map Properties in Tiled) are set on the
map object, which `level.getCurrentLevel()` returns once it is loaded: a
`theme` string property is `level.getCurrentLevel().theme`. They are set
**over** the map's own fields, so a property named like one replaces it: a
custom `name` property becomes the level's `name`. Give level settings names of
their own (`title`, not `name`).

## Camera bounds

`level.load` sets the viewport bounds to the map's bounds for you (on an
infinite map, every painted tile, see above) —
`setViewportBounds` defaults to `true`, and the handler is re-run on every
viewport resize, centring the map when it is smaller than the screen. You only
need to do it by hand when you opted out:

```js
level.load("map1", { setViewportBounds: false });
app.viewport.setBounds(0, 0, mapWidth, mapHeight);   // now it's on you
```

The same is true if you drive `TileMap.addTo(container, flatten, setViewportBounds)`
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

### Solid tile layers: the `collider` property

A tile layer is solid when it has a boolean custom property named `collider`
set to true (20.18): each run of its tiles becomes one static `WORLD_SHAPE`
body, as an unnamed shape of a collision layer does. No object layer to draw.

```js
// in Tiled: select the tile layer, add a custom property `collider` (bool), check it
level.load("map1");   // the layer's tiles hold the player up
```

- The walls are built when the level is loaded, from the tiles the layer has
  then: `setTile` / `clearTile` afterwards does not change them.
- Each wall carries the layer's name as `wall.layer`, to tell them apart in a
  collision handler. The layer itself is still the only thing found by
  `getChildByName`.
- They are part of the layer, not objects: `objects: false` leaves them in.
- Orthogonal maps only; on another orientation the property is ignored, with
  a warning.

### Sprite Fusion maps

A map made with [Sprite Fusion](https://www.spritefusion.com) loads as the
editor exports it, under the asset type `"spritefusion"` (20.18). Either
export does: `map.json` ("JSON") or `map.tmx` ("TMX"). Unzip the export, keep
`spritesheet.png` next to the map, and give the loader the map alone:

```js
await loader.preload([
    { name: "level1", type: "spritefusion", src: "maps/level1/map.json" },
    { name: "level2", type: "spritefusion", src: "maps/level2/map.json" },
]);
level.load("level1");
```

- **The spritesheet comes with the map**: it is loaded from the map's folder,
  kept for that map (two maps each have their own `spritesheet.png`), and
  freed with it. Nothing to preload.
- **Collider layers are solid**: a layer with the editor's "collider" box
  checked gets walls, as above.
- **Tile attributes** are read by the cell, each value of its type:
  `layer.getTileProperties(col, row)` gives
  `{ type: "lava", damage: 25, isSolid: false }`. That one call reads both
  exports. (The TMX export puts them on the tile in the tileset, the JSON on
  each placed tile: `tileset.getTileProperties` only finds the first.)
- **Per-tile instance attributes** (the project setting that gives one placed
  tile its own) are in the JSON export only: the editor refuses a TMX export
  while it is on. Use `map.json` for those.
- The layers are in the editor's order, the bottom one first, and a layer
  hidden in the editor is left out of the export.
- Under `"tilemap"` or `"tmx"` the same files load too, but nothing is loaded
  with them: preload the image yourself, under the name `spritesheet`.

### A map written by another tool, or by hand

`"tilemap"` is the type for a tile map that is nobody's in particular: the
same loader as `"tmx"`, for the many tools that write Tiled's format. The
reader also takes the shorter words Sprite Fusion uses, which are handy in a
map written by hand or by a generator:

- `attributes`, a plain object of values, wherever `properties` is read (the
  map, a layer, an object, a tile of a tileset). An attribute is kept as
  written: no text is converted. Where both name a value, the attribute wins.
- a tile layer's `tiles`, a list of `{ id, x, y, attributes }` (the tile's id
  in the map's first tileset, and its cell), in place of `data`, the gid of
  every cell.

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
`No inflate function set: register @melonjs/tiled-inflate-plugin ...` at parse
time without:

```js
import { plugin } from "melonjs";
import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";

plugin.register(TiledInflatePlugin);   // before preloading any compressed map
```

Uncompressed base64 and CSV layer data need no plugin. If a map loads in Tiled
but not in melonJS, check the layer compression setting first.

## LDtk levels

Levels made with [LDtk](https://ldtk.io) load from the project file as the
editor saves it (20.18): nothing to export, nothing to register. The `.ldtk`
file is one asset, and its levels are the level director's.

```js
import { level, loader, registerObjectClass } from "melonjs";

registerObjectClass("Player", Player);             // an entity's identifier → its class

await loader.preload([{ name: "world", type: "ldtk", src: "data/world.ldtk" }]);
level.load("world:Level_0");                       // "<asset name>:<level identifier>"
// level.load("world");                            // the whole world, levels where LDtk puts them
```

A complete game on an LDtk world, with everything below in use, is the
[LDtk Platformer](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/ldtkPlatformer)
example: its `world/` folder is the loading and the streaming.

### Building the world in LDtk

What is set up in the editor, and what the game gets from it. Nothing here
is required: a project with one level and one tile layer loads.

| in LDtk | in the game |
|---|---|
| a **Tiles**, **AutoLayer** or **IntGrid** layer with rules | drawn, in LDtk's layer order, with its opacity, its offset and its parallax factors; a layer hidden in LDtk is not drawn |
| an **IntGrid** layer named like "Collisions" (its identifier contains "collision") | walls: every cell with a value is solid. Name its values in LDtk ("walls", "water"...) to read them by name |
| an **Entities** layer | one object per entity, built by the class registered under the entity's **identifier** |
| an entity's **fields** | `settings.fields`, typed as in LDtk (see "Field values" below) |
| an entity's **tile**, from a tileset of the project | what the entity is drawn with when no class is registered for it. LDtk's built-in icons are not in the project's files: an entity shown with one is invisible in the game |
| an entity's size, when it is **resizable** | `settings.width` / `settings.height`: an area (a ladder, a zone, a door) |
| "**Add to table of content**" on an entity definition | the entity is listed in the project with its level and its place, before any level is loaded: the player's start |
| an **Entity ref** field | a link to another entity, in any level: a door's or a teleport's destination |
| a level's **identifier** and its **custom fields** | the level's id (`"world:<identifier>"`), and `fields` on the level's description |
| a level's background color or image | drawn behind its layers |
| the **world layout** (Free, GridVania, Linear) | where each level is when the whole world is loaded |
| the **world depth** of a level | levels on different depths can cover the same place: the game loads one depth at a time |

Keep the project's folder as LDtk has it: the tileset images, the level
backgrounds and the level files ("Save levels to separate files") are loaded
from where the project file says they are, relative to it. Load the `.ldtk`
file itself, not the files of LDtk's "Super simple export".

### What a level becomes

- **The images load with the project**: its tilesets (PNG or Aseprite), its
  levels' backgrounds, the level files it saves apart. Each image is kept
  under its file's name (`atlas/tiles.png` as `tiles`), and freed with the
  last project that uses it, unless a bundle lists it or the game loaded it
  too. An image the game loaded itself under that name is used instead of
  the file.
- **Layers**: each LDtk layer becomes one or more renderables named after it,
  in LDtk's order: a `TileLayer` where its tiles fit a grid (drawn by the GPU,
  like a Tiled layer), a `PlacedTileLayer` for tiles stacked in a cell, off the
  grid or faded. `level.getCurrentLevel().layers` lists them.
- **Walls** come from IntGrid layers whose identifier contains "collision",
  the convention of a Tiled collision layer: one static `WORLD_SHAPE` body per
  run of cells, built by the same "shape" factory, carrying `intGridValue` and
  `intGridName`. Other layers with `collisionLayers: ["Walls"]`, some values
  only with `solidValues: [1]`, as options of `level.load`.
- **IntGrid values** are read from the level, for what is not a wall (water,
  ice, a ladder): `level.getCurrentLevel().getIntGrid("Collisions")`, then
  `valueAtPixel(x, y)`, `valueAt(col, row)`, `nameAt(col, row)`, `names` (the
  name LDtk gives each value) and `rects(test)` for areas as rectangles.
- **Entities** (LDtk's word for what Tiled calls objects) are built by the class the game registered under their
  identifier: `new Player(x, y, settings)`, `x` and `y` being the top left
  corner of the entity's box whatever its pivot in LDtk (`settings.px` is the
  pivot). `settings.fields` holds its fields, also copied onto the settings
  where the name is free (`settings.life`; not `type` or `width`), and
  `settings.id` is its unique id in LDtk (`iid`). An entity
  LDtk draws with a tile carries it as `settings.image` (a texture atlas) and
  `settings.region`, so a class extending `Sprite` passes the settings straight
  to `super(x, y, settings)`. With no class, an entity is an `LDtkObject`: a
  box with no body, found with `world.getChildByName("PlayerStart")`, showing
  its tile (a `Sprite`, in LDtk's fill mode) if it has one. It is a
  `Container`, with that sprite as its child. Only classes the
  game registered count: an entity named "Trigger" or "Text" is not built by
  the engine's class of that name unless the game registers it
  (`registerObjectClass("Trigger", Trigger)`).
- **Field values** are LDtk's `__value`: a number, a string or a boolean, a
  color as `"#rrggbb"`, an enum as its value's name, a `Point` as
  `{ cx, cy }` in cells, an `EntityRef` as
  `{ entityIid, layerIid, levelIid, worldIid }`, a `Tile` as a rectangle of
  its tileset, arrays of those, and `null` where nothing was set.
- **Parallax**: a layer's parallax factors (and "parallax scaling") move and
  scale its tiles with the camera as the editor does, on every renderer. The
  layer's entities and walls are things of the level and stay in it. The
  layers built carry it as their `ratio` (see below), to read or change:
  LDtk's factor is the share of the camera's movement the layer follows, so
  a factor of 0.25 is a `ratio` of 0.75.
- Options of `level.load`, besides `collisionLayers` and `solidValues`:
  `showIntGrid: true` draws IntGrid layers that have no tiles, in LDtk's
  colors; `objects` chooses the entities that are built (`false` for none);
  `levels` is for a world, below.

### A world, loaded around the player

`level.load("world")` adds every level of the world, where LDtk puts it:
fine for a small one. A large world is loaded a few levels at a time: the
ones around the player come in and the others leave, with their layers,
their walls and their objects.

```js
import { level, loader } from "melonjs";

const project = loader.getLDtk("world");
// where the player starts, known before any level is loaded (the "Player"
// entity has "Add to table of content" checked in LDtk)
const [start] = project.getTableOfContent("Player");
let depth = start.level.depth;
let room;                                  // the level the player is in
const taken = new Set();                   // the ids of what the player took

level.load("world", {
    levels: [start.level.identifier],      // the levels to start with
    setViewportBounds: false,              // the camera is held to a level, below
    // a level that comes back builds its objects again: not the ones taken
    objects: (settings) => !taken.has(settings.id),
});

// each frame, from the player's update(): the level the player is in
function trackRoom(app, x, y) {
    const world = level.getCurrentLevel();
    const here = world.levelsAt(x, y, 0, 0, depth);
    // in no level, or still in the same one (two levels share an edge)
    if (here.length === 0 || here.includes(room)) {
        return;
    }
    room = here[0];
    app.viewport.setBounds(room.x, room.y, room.width, room.height);
    // keep this level and the ones within 1 px of it; unload the others
    world.streamAround(room.x, room.y, room.width, room.height, 1, depth);
}
```

- **The player** is an entity of the level it starts in, and would leave
  with it: make it persistent (`this.isPersistent = true`, as for a player
  that outlives a level change). It stays when its level is taken out, and
  is not built again when the level comes back.
- **`streamAround(x, y, w, h, margin, depth)`** loads the levels that touch
  the area grown by `margin` and unloads the others, and returns what it
  did (`{ loaded, unloaded }`, by identifier). `loadLevel(identifier)` and
  `unloadLevel(identifier)` do one; `loadedLevels()` and `isLoaded()` tell.
  Unloading takes a level's objects out at the end of the frame, as any
  `removeChild` does.
- **Depths**: levels stacked on LDtk's world depths cover the same place.
  Give `streamAround` and `levelsAt` the depth the player is on and the
  levels of the others are left out; without it, every depth is loaded on
  top of the others.
- **Coordinates** are LDtk's world coordinates, and can be negative. A level
  loaded alone (`"world:Level_0"`) starts at 0, 0 instead.
- **A door to another level** is the engine's `Trigger`, registered under the
  entity's name (`registerObjectClass("Door", Trigger)`): it reads the
  entity's fields as its settings, so `to` (`"world:Level_2"`), `duration`,
  `transition` (`"mask"`), `shape` and `center` (`"touching"`) are set on
  the entity in LDtk, and the transition's color is the entity's own in
  LDtk.
- **An `EntityRef` field** (a teleport's destination) is resolved with
  `project.findObject(ref)`: its `level`, and its `x` / `y` in the world,
  whether that level is loaded or not; once it is,
  `app.world.getChildByProp("id", ref.entityIid)[0]` is the object.
- **IntGrid values in a world** are read per level:
  `world.getIntGrid(room.identifier, "Collisions")`.
- Another world of a multi-world project is `"world@<world identifier>"`.

### The project

`loader.getLDtk("world")` is the project, with no level loaded:

- its `levels` (each with its `identifier`, its place and size in the world,
  its `depth`, its `fields` and its `neighbours`) and its `worlds`;
- **the table of content**, `project.getTableOfContent("PlayerStart")`: the
  entities whose definition has "Add to table of content" checked in LDtk,
  each with its `level`, its `x` / `y` in the world, its size and the fields
  listed with it;
- `getTileData` / `getTileTags` for a tile's custom data and enum tags, by
  LDtk's own tile ids. From a tile of a level they are its properties, as
  for a Tiled tile: `layer.getTileProperties(col, row)` gives
  `{ customData, tags }`;
- `project.json`, the file itself. It is read as LDtk's JSON schema for
  games defines it (1.x): the `LDtk*Json` types name every field of it, so
  `project.json` and an entity's `source` are typed down to the file. Find
  things by `iid` rather than `uid` where both exist: LDtk plans to drop
  the integer ids.

Not supported: the editor's built-in entity icons (they are not in the
project's files). A tile layer whose tiles are not the size of its cells
is drawn from each cell's top left corner, as the file gives it: the
layer's tile pivot is the editor's own. A nine-slice entity tile keeps
LDtk's left and top borders on both sides (a `NineSliceSprite` has one
border per axis).

## Tile layers without Tiled

The classes a Tiled map is made of do not need Tiled (20.18). A layer built in
code, for a generated dungeon or a board:

```js
import { TileLayer, Tileset, TilesetGroup } from "melonjs";

const tileset = new Tileset({ name: "ground", image: "ground", tilewidth: 16, tileheight: 16 });
const layer = new TileLayer({
    name: "floor", cols: 40, rows: 30, tilewidth: 16, tileheight: 16,
    tilesets: new TilesetGroup([tileset]),
});
layer.setCell(3, 2, tileset.firstgid + 5);       // the tileset's sixth tile
layer.setCell(4, 2, tileset.firstgid + 5, 1);    // mirrored across (2: down, 4: diagonal)
app.world.addChild(layer, 1);
```

It is the same class as a Tiled layer (`TMXLayer` extends it): drawn by the
GPU where it can, read and changed with `cellAt`, `getTile`, `setTile`,
`clearTile`. `image` is a loaded image's name or the image itself; a tileset's
tiles are numbered from `firstgid` (1 by default) row by row, and `setCell`
takes that global id, 0 to clear. `setTileProperty`, `setTileClass` and
`setTileAnimation` on the tileset give a tile what Tiled's tileset editor would.

A grid holds one tile a cell. For tiles stacked on one another, off the grid,
or each with its own opacity, use a `PlacedTileLayer`: a list of tiles at pixel
positions, drawn in order, only the ones in view:

```js
const decals = new PlacedTileLayer({
    name: "decals", tileset,
    tiles: [{ x: 40, y: 12, tileId: 7 }, { x: 44, y: 16, tileId: 9, flip: 1, alpha: 0.5 }],
});
decals.addTile(100, 60, 3);          // tileId is the tile's id IN the tileset, from 0
```

Either kind scrolls at a pace of its own with `ratio`, the same as an
`ImageLayer`'s: a backdrop that scrolls slower than the level, a foreground
that scrolls faster.

```js
hills.ratio.set(0.5, 0.5);                 // half the level's pace
new TileLayer({ /* ... */ ratio: 0.5 });   // or in its definition: a number, or { x, y }
```

`ratio` is a vector, (1, 1) by default: 1 scrolls with the world, 0 stays
where it is on the screen, above 1 scrolls faster than the world. Three more
settings go with it, each optional, on the layer and in its definition:

- `parallaxOrigin` (a vector, (0, 0)): where the camera is when the layer is
  where it was placed, in the layer's container's coordinates;
- `parallaxAnchor` (a vector, (0, 0)): the point of the view that is measured.
  (0, 0) is the camera's position, its top left corner, as for an image
  layer; (0.5, 0.5) is its centre;
- `parallaxScale` (a number, 1): the layer drawn smaller or larger from its
  origin, as one further away or nearer.

It is worked out for each camera as it draws, and changes nothing else:
`getTile`, `cellAt` and the layer's bounds are the layer's where it was
placed.

A Tiled tile layer's parallax factor (and its group's, multiplied) is its
`ratio` (20.18), so that it moves exactly as an image layer of the same
factor does and the two stay together. A custom property named `ratio` on the
tile layer sets it too, as on an image layer (a number, for both axes). An
object layer's factor is not applied: its objects are things of the map.

In a definition a part left out keeps its value (`ratio: { x: 0.5 }` leaves
`y` at 1), and a value that is not a number throws. On the vector itself, set
both parts: `ratio.set(0.5, 0.5)`.

`mergeGridRects(cols, rows, (col, row) => boolean)` covers the cells that pass
a test with few rectangles, in cells: one static body per wall instead of one
per tile. Its example in the API reference builds the bodies.

### A level format of your own

To have `level.load`, `level.next`, `level.reload` and `Trigger` work with
levels read from another format, register it: `level.registerFormat("rooms",
{ create: (levelId) => levelObject, loadOptions: [...] })`, then
`level.add("rooms", id)` for each level (from a parser registered with
`loader.setParser`). The level object needs `addTo(container, options)` and
`destroy()`. In `addTo`, `level.followViewport(container, bounds)` gives the
viewport handling of a Tiled map (keep the function it returns and call it in
`destroy`), and `createLevelObject(settings, map)` builds an object from the
registry (`hasObjectFactory(name)` says whether the game registered one).
The engine's own LDtk support is built exactly this way.

## Rendering

Each tile layer resolves to one of three `renderMode`s — `"shader"`,
`"prerender"` or `"perTile"` — auto-selected in that order of preference, or
forced per layer. The `"shader"` path is a single quad per tileset with a
per-pixel GID lookup in the fragment shader. It requires **all** of:

- a renderer that reports GPU tile-layer support (WebGL 2 / WebGPU — not Canvas),
- `world.gpuTilemap !== false` (the `gpuTilemap` application setting, default `true`),
- an **orthogonal**, **isometric**, **staggered** or **hexagonal** layer —
  oblique always falls back,
- no collection-of-image tileset, and a tileset tile render size of "Tile
  size" (`tilerendersize`, not "Map grid size"),
- on an orthogonal map: no non-zero `tileoffset`, and tiles that reach at most
  4 cells past their own; a layer of tiles **larger than a cell** takes them
  from one tileset, on a map in the default render order ("right-down"),
- on an isometric, staggered or hexagonal map: every tile of the layer from
  **one tileset** (tiles overlap, and their order is kept within a tileset,
  not across two: split floor and walls into a layer each, which a map
  usually does already), tiles at most 4 cells wide and 8 tall, a grid of
  even size (64 × 32, not 65 × 33; a hexagon side of even length), and the
  normal blend mode. A `tileoffset` is fine,
- no tile that is not square flipped diagonally (rotated, in Tiled), and no
  more columns or rows than the largest texture has pixels (4096 on the
  smallest devices).

A tile set at run time with `setTile` that breaks one of these moves the layer
back to `"perTile"`, with a warning. The two paths draw the same picture, with
one difference: a layer with `opacity` below 1 is faded as one flat picture on
the shader path (as `preRender` does), where tile by tile each tile is faded
over the ones behind it, which shows where tiles overlap.

The gain is main-thread time: tile by tile, every tile in view is found and
placed in JavaScript each frame (about 2 ms for 4000 tiles); the shader path
draws one quad whatever is in view.

When a layer falls back, melonJS `console.warn`s the reason each time the
layer is activated (once per page when the renderer has no GPU tile support at
all), and says nothing while `gpuTilemap` is off. Practical consequences:
fewer tilesets means fewer batches (one packed tileset beats several small
ones), and on the Canvas fallback large maps get noticeably slower.
`world.preRender` (or a `preRender` layer property in Tiled) opts an unanimated
layer into the offscreen-bake path instead.

## Symptom → cause

| symptom | cause |
|---|---|
| objects a screen added just before `level.load` draw in the order they were added (a background over everything) | before 20.13 the reset inside `level.load` dropped the sort still pending for the persistent children it kept; update, or call `sort()` on their container once the level is loaded |
| a Tiled object becomes a plain shape with no behaviour | its class/name does not match any registered factory, or it was registered after `level.load` |
| the world is still empty right after `level.load` | the load is deferred to a timer while the loop runs — `await level.load(id, { async: true })`, or use `onLoaded` / `LEVEL_LOADED` |
| `await level.load(id)` returned `true` rather than a promise | without `async: true` the call returns a boolean; `await true` resolves immediately and the load has not run yet — pass the flag when you mean to await |
| `level <id> not found` | the map was never preloaded, its bundle was unloaded (`await loader.load(bundleId)` first), or the asset `name` differs from the id passed to `load` |
| `unknown or invalid resource type` | asset `type` set to `"tmj"` / `"tsj"` — use `"tmx"` / `"tsx"` with the `.tmj` / `.tsj` file |
| camera will not scroll | `setViewportBounds: false`, or the map was added with `addTo()` (which defaults to `false`) |
| `No inflate function set` at parse time | compressed layers without the tiled-inflate plugin |
| `@melonjs/tiled-inflate-plugin: cannot read ... compressed layer data` | that layer's data is damaged (a checksum or its length does not match), cut short, or edited by hand: save the map again from Tiled |
| `Tiled layer "…" has N tiles of data for its W x H cells` | the layer's data does not fill it, as Tiled would refuse too: written by another tool or edited by hand. Save the map again from Tiled |
| the player falls through a tile layer drawn as the floor | tiles are not solid by themselves: give the layer a `collider` (bool) property set to true, or draw shapes on a collision object layer |
| a Sprite Fusion map loads and nothing is solid (before 20.18) | the `collider` property of its layers was not read: update |
| `'spritesheet' file for tileset 'spritefusion' not found` | a Sprite Fusion `map.json` loaded as `"tilemap"` / `"tmx"`, or given inline: use the type `"spritefusion"` with the file, or preload the image as `spritesheet` |
| `Sprite Fusion map "…": its spritesheet could not be loaded` | `spritesheet.png` is not in the folder of the map file: keep the two together, as exported |
| a Sprite Fusion tile's attributes are `undefined` | read with `tileset.getTileProperties`, which only has those of the TMX export: use `layer.getTileProperties(col, row)` |
| `layer "…" places tile N, which the map's tilesets do not have` | the spritesheet is smaller than the one the map was made with: export the map and its spritesheet again, together |
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
| a map fails to load with "needs DOMParser" (in the error's `cause` and the console) | an XML `.tmx` / `.tsx` loaded where there is no DOM (a Web Worker, nx.js): export the map and its tilesets as JSON (`.tmj` / `.tsj`) |
| a tileset's transparent color (`trans`) still shows (the console says it could not be applied) | the image cannot be read back: an image the game made itself from another origin without CORS (an `<img>` with no `crossOrigin`) cannot be, so load it with the loader, which only loads an image another origin's server allows (its CORS headers) and can always read back; and a compressed texture cannot be changed: export it with an alpha channel instead |
| `cellAt` returns `null` (or the wrong tile) for a cell that has one | it was given pixels: `cellAt`, `setTile` and `clearTile` take column and row, only `getTile` takes world pixels |
| `setTile` shows the wrong tile, or nothing | it was given Tiled's local tile id: use the global id, `tileset.firstgid + localId`, through `getTileById` |
| on an infinite map the camera stops before tiles painted past the map's size, or left of or above its origin | an older melonJS held the camera to the map's width and height from (0, 0): update; and size a camera you set up yourself from `map.getBounds()` |
| oversized tiles overlap in the wrong order (the map's render order is not "right-down") | an older melonJS drew every layer "right-down", whatever the map's render order: update |
| an infinite map's tiles sit in the wrong row, or tiles left of or above the origin are missing | an older melonJS ignored where the chunks start (update); and loop from `layer.startx` / `layer.starty`, not 0, to reach cells left of or above the origin |
| on a staggered map `getTile` gives the neighbouring tile on every row but the first, or a scrolled view draws nothing | a bug of older melonJS versions in the staggered renderer: update |
| on an isometric (or staggered, oblique) map `getTile` gives an edge tile for a point just outside the tiles | an older melonJS rounded a fractional column or row toward 0: update |
| on an isometric map a tile drawn by hand with the map renderer's `drawTile()` lands away from where the layer draws that cell | before 20.14 the isometric `drawTile()` placed it differently from the layer: update |
| a repeating `ImageLayer` slides off the screen once the camera has moved far enough | before 20.12 its repeat did not follow the camera: update |
| tiles of a second tileset draw from the first tileset's image (that first one has a `margin`) | an older melonJS let its gid range overrun into the next tileset (update): the range is the `tilecount` Tiled saved |
| a layer is `undefined` from `getChildByName(name)[0]` | the level is not in the world yet (await `level.load(id, { async: true })`), or the name differs from the layer's in Tiled |
| a tile set or cleared at run time does not block or free movement | tile layers carry no collision: collision comes from collision object layers |
| the level's `name` is not its id after loading | a map custom property named `name` replaced it: map properties are set over the map's own fields |
| changing tiles at runtime is slow on a pre-rendered layer | outside an orthogonal map whose tiles fit their cells, a changed tile re-bakes the whole layer before it next draws: keep layers you edit often off `preRender` |
| thin lines between tiles on the Canvas renderer, with smoothing on | filtering blends in the next tile of the tileset or its spacing, which a canvas cannot prevent: set `antiAlias: false`, or `preRender` the layer. WebGL and WebGPU keep each tile to itself |
| a tile layer given an offset in Tiled (a roof nudged up, a shadow shifted) is drawn where the others are, or the objects of an object layer with an offset are not where Tiled shows them | before 20.17 only image layers followed their offset; tile layers (and their `pos`), object layers and group layers ignored it: update |
| after updating to 20.17 a tile layer, or the objects of an object layer, sit away from where they did | the layer (or the group it is in) has an offset in Tiled that was ignored until then, and now moves it as in the editor: clear the layer's Offset in Tiled if it was not meant |
| the map fails to load with a group layer in it | the group holds an object layer, an image layer or another group: a group can only hold tile layers. Move those layers out of the group |
| a map smaller than the screen (centred by `level.load`) had the tops of its tall tiles cut on WebGL or WebGPU | before 20.17 a layer read the camera's view as if it stood at the world's origin, and so did a layer in a container the game had moved: update |
| the tops of tall tiles vanish when the map itself scrolls out of view | before 20.17 a layer was skipped once its grid left the view, though tiles larger than a cell (or moved by a `tileoffset`) still reached in: update |
| an orthogonal layer warns `tiles larger than the grid, of more than one tileset in a layer` | tiles larger than a cell overlap, and the shader path keeps their order within one tileset: put each tileset's large tiles on a layer of their own (trees apart from the ground they stand on) |
| tilemap slow on some machines | layer fell back off the shader path — check the console warning for the reason |
| a staggered or hexagonal map sits higher than before 20.17, by how much its tiles are taller than a cell (or by its tileset's `tileoffset`) | it is drawn as Tiled draws it: until then a tile hung from the top of its cell and the offset was ignored, away from the map's objects |
| an isometric (staggered, hexagonal) layer warns `tiles of more than one tileset in an isometric layer` and is slow | the shader path draws such a layer with one tileset: put the tiles of each tileset on a layer of their own, or pack them into one tileset |
| a half-transparent isometric (staggered, hexagonal) layer of tall tiles looks flatter than before 20.17 | on the shader path a layer fades as one picture, and a tile no longer shows through the one in front: set that layer's `renderMode` to `"perTile"` (a `renderMode` custom property in Tiled) for the old look |
| the soft edges of tiles larger than the grid showed a thin dark outline on the shader path | before 20.17 the edge of such a tile was not blended over the tile behind it: update |

| `new TileLayer({ orientation: "isometric" ... })` throws `needs the renderer of its map` | a layer built in code makes its own renderer for an orthogonal grid only: pass `renderer` (a `TMXIsometricRenderer` and the like) for the others |
| a tile set with `setCell` shows the wrong tile, one off | `setCell` takes a global id: the tileset's `firstgid` (1 by default) plus the tile's id in the tileset; a `PlacedTileLayer`'s `tileId` is the id in the tileset, from 0 |
| tiles stacked in one cell: only the last shows | a `TileLayer` holds one tile a cell: a second layer, or a `PlacedTileLayer` for the stacked ones |
| `level format "x" is already registered` | `level.registerFormat` called twice (a hot reload): register once, at start-up |

| `level Level_0 not found` for an LDtk level | a level's id is `"<asset name>:<level identifier>"` (`"world:Level_0"`) |
| `level.load("world")` shows every level of the LDtk project at once | the asset's name alone is the whole world; a single level is `"world:<level identifier>"` |
| an LDtk level loads with no tiles, and a warning that a tileset's image is not loaded | the image is not where the project file says, relative to it (the folder was reorganised) |
| LDtk entities are invisible in the game | no class is registered for them (`registerObjectClass(identifier, Class)`), and their icon is LDtk's own, which is not in the files: give them a tile from a tileset of the project, or a class |
| the player falls through an LDtk level | no IntGrid layer is named like "collision": pass `collisionLayers` to `level.load` |
| a tile layer set to scroll slower than the level in Tiled scrolls with it (before 20.18) | a Tiled tile layer's parallax factor was not read (an image layer's was): update |
| a Tiled parallax layer is not where Tiled shows it at the start of the level | Tiled measures a factor from the centre of its own view to the map's parallax origin; the engine measures from the camera's position, for tile and image layers alike: move the layer with its offset, or set `layer.parallaxOrigin` and `layer.parallaxAnchor` yourself |
| `getTile` finds nothing under a tile of a layer with a `ratio` | the ratio moves where the layer is drawn, not its cells: they are where the layer was placed |
| a tile layer with `ratio: 0.5` scrolls the wrong way round | 1 scrolls with the world and 0 stays on the screen, as for an `ImageLayer`; LDtk's own factor is the other way round, and is converted when a level is loaded |
| `a layer's ratio must be a number, or an {x, y} of numbers` | a tile layer's definition gave `ratio` (or `parallaxOrigin`, `parallaxAnchor`) a text, a list or `NaN`: give a number, or `{ x, y }` |
| `layer.getTileProperties is not a function` on an LDtk level | that layer stacks tiles or places them off its grid, so it is a `PlacedTileLayer`, which has no cells: test `layer instanceof TileLayer` first |
| the player disappears when walking out of its first LDtk level | it is an entity of that level, taken out with it: set `isPersistent = true` on it |
| the coins again after coming back to an LDtk level | a level loaded again builds its objects again: the `objects` option leaves out what was taken |
| two LDtk levels are drawn over each other, with walls from both | they are on different world depths, at the same place: pass the player's depth to `streamAround` and `levelsAt` |
| a `Sprite` class for an LDtk entity throws `'undefined' image/texture not found` | the entity's tile is one of LDtk's built-in icons (a tileset with `embedAtlas`): they are not in the project's files, and LDtk does not allow redistributing them, so `settings.image` is not set. Use art of your own, or a tile of one of the project's tilesets |
| an LDtk entity is placed half its size off | `x`, `y` are its box's top left corner; its pivot is `settings.px` |
| an LDtk field reads `undefined` on the settings | its name is one of the settings' own (`type`, `name`, `width`...): read `settings.fields.type` |
| `getChildByName("Door")` is empty for an object the level names "Door" | its class names itself (a `Trigger` is always "Trigger"): find it by its id, `getChildByProp("id", id)`, or with `getChildByType` |
| an LDtk entity named "Trigger" (or "Sprite", "Text"...) does nothing | an entity's name is not taken for the engine's class: register it, `registerObjectClass("Trigger", Trigger)`, and give the entity the fields the class reads |

## Related skills

- `melonjs-physics` — what the collision shapes become once loaded
- `melonjs-getting-started` — preloading and the asset type list
