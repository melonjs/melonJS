---
name: melonjs-loading-assets
description: "Use this skill for loading and managing game assets in melonJS — the resource descriptor format, the full asset type list, preload versus load, retrieving loaded assets, base URLs and cross-origin settings, and the loading screen. Triggers on: loader, loader.preload, loader.load, resources, getImage, getJSON, getTMX, getGLTF, getVideo, getFont, setBaseURL, setOptions, crossOrigin, withCredentials, credentials, cookies, authenticated assets, CORS, asset, preload, LOADER_COMPLETE, loading screen, unload, setParser, custom asset type, generated texture, procedural texture."
license: MIT
---

# Loading assets

## The resource descriptor

Every asset is `{ name, type, src }` plus type-specific extras:

```js
import { loader } from "melonjs";

loader.setOptions({ crossOrigin: "anonymous" });   // needed for remote assets

await loader.preload([
    { name: "tiles",   type: "image",    src: "data/img/tiles.png" },
    { name: "map1",    type: "tmx",      src: "data/map/map1.tmx" },
    { name: "tileset", type: "tsx",      src: "data/map/tileset.tsx" },
    { name: "sfx",     type: "audio",    src: "data/sfx/" },
    { name: "font",    type: "fontface", src: "data/font/PressStart2P.ttf" },
    { name: "atlas",   type: "json",     src: "data/img/atlas.json" },
]);
```

`preload()` has been awaitable since 19.8. The callback form still works and
takes a third argument to suppress the built-in loading screen:

```js
loader.preload(resources, onLoaded, /* switchToLoadState */ false);
```

## The type list

The type strings are melonJS-specific — this is not a generic loader:

| type | for |
|---|---|
| `"image"` | textures, sprite sheets, normal maps |
| `"json"` | data, texture-atlas descriptors, collision shapes from a shape editor |
| `"tmx"` / `"tsx"` | Tiled maps and external tilesets |
| `"audio"` | sound — **`src` is a directory**, see below |
| `"video"` | video textures |
| `"binary"` | raw data, bitmap font `.fnt` descriptors |
| `"fontface"` | web fonts (`.ttf`, `.woff`) |
| `"aseprite"` | Aseprite JSON + image |
| `"shader"` | GLSL/WGSL shader sources — `src` **or** inline via `data` |
| `"obj"` / `"mtl"` | Wavefront models and materials |
| `"gltf"` / `"glb"` | glTF scenes |
| `"js"` | scripts |
| any type you register | your own formats, and things you generate rather than download — see [Custom asset types](#custom-asset-types) |

## What belongs in the manifest — and what cannot

Preloading is not only for things with a URL. Three tiers, and the middle one
is the one people miss.

**After preloading, switch to a stage of your own.** `preload()` puts you in
`state.LOADING`, and that stage is transitional: build your scene in the
callback and stay there, and nothing ever destroys it, so the built-in loading
screen's logo and progress bar remain on top of your game. See
`melonjs-scenes-and-state`.

**1. Assets with a source.** Everything in the type table above. Note `"shader"`
takes **inline source** as well as a `src`, via the `data` field:

```js
import { myRamp } from "./myRamp";   // a GLSL fragment body, in your own module

loader.preload([
    { name: "ramp", type: "shader", data: myRamp },
]);
const fx = loader.getShader("ramp");   // shared, already compiled
```

This matters more than it looks. A `ShaderEffect` compiles its program in its
**constructor**, and `compileProgram` calls `getProgramParameter(LINK_STATUS)`
immediately after `linkProgram` — a blocking call that forces the driver to
finish. So building one during a scene costs that link on the frame it appears,
and building three identical ones costs it three times. Preloaded as an asset it
is compiled at load time, behind the loading screen, and the loader hands out a
**shared** instance (`effect.shared === true`), which is what stops one
renderable's teardown freeing it out from under the others. `clone()` does NOT
help here — it constructs a new effect, and therefore links a new program.

**2. Derived assets — build once, before the first stage.** Canvases you bake,
`NoiseTexture2d`, `TextureAtlas`: none of the built-in types describes these,
and they must not be rebuilt per scene either. The renderer's texture cache is
keyed by the **image object**, so a freshly baked canvas is a brand new GPU
texture with a new mip chain — rebuild one per stage and a title → play →
game-over cycle uploads four copies of the same pixels. Build each once and
share it from a module the scenes read from, the way the platformer example
builds its `TextureAtlas`.

*Where* you build it depends on what it costs. A gradient or a palette strip is
well under a millisecond: build it after `preload` resolves. A bake that takes
real time — procedural noise is the usual one: Earth Defender's sky, two fractal
simplex fields over a 512² tile, takes about 200ms on a desktop — belongs
**inside** the preload as an asset type of your
own ([Custom asset types](#custom-asset-types)). It then runs behind the loading
screen and counts on the progress bar. Built on stage entry instead, it lands on
the frame the scene is assembled, and with a transition running that frame is a
black screen.

**3. The engine's own shader programs — warmed for you, since 20.6.** The mesh
batcher compiles a program per *feature combination* (instance colours, instance
data, fog — fog joins the key), lazily, on the first draw that needs it.
`prewarm` builds them during `preload()` instead, behind the loading
screen:

```js
const app = new Application(1280, 720, {
    // on by default since 20.6 — named here only to show where it lives
    prewarm: true,
});
```

**You do not call this yourself.** `preload()` calls `renderer.prewarm()` once
the assets are in and **before** `LOADER_COMPLETE` fires, so it happens while
the progress bar is still up. Every `preload()` warms, not just the first, so a
per-level preload warms whatever that level brought with it.

The one precondition for this part: **a game that never calls
`loader.preload()` does not get it**. If you load assets another way, call
`await app.renderer.prewarm()` yourself. On
WebGL that links the mesh batchers' variants, for the unlit tier and the lit
one that inherits from it; on WebGPU it compiles the
WGSL module of every shader the loader holds, and the mip-chain blitter when
textures are filtered.

**4. Everything that depends on the renderable — warmed as you build, since
20.10.** The rest cannot be done at preload, because it depends on what draws:
on WebGPU a *pipeline* is keyed by blend mode, culling, transparency and the
format of the target as well as by shader, and that compile is the expensive
part (tens of milliseconds, up to 140ms measured, per effect). So, behind the
same `prewarm` setting, the engine warms a renderable when it gains an effect
(`addPostEffect`, or assigning `shader`) and when it is added to the world:
its effect pipelines, its own draw, the render targets its chain composites
through, the advanced-blend shader if it uses one. Inline effects are covered
too; on WebGL that means linking a mesh-hosted effect's spliced program.

That work starts after your code has run and finishes off the frame, so it
needs **at least a frame between setting a renderable up and drawing it**. The
pattern that gets it for free is the one you want anyway: build pools (and
attach their effects) when the stage starts, then show and hide them during
play. Something created and drawn in the same frame still compiles on that
frame.

Cost to a game that uses none of it is about 60ms of preload on a desktop GPU.
Set it to `false` only for a target where linking is slow enough that the
preload itself would suffer.

**What it does not do.** It makes the shaders *ready* earlier. It does not
remove the hitch on a scene's first frame, because most of that frame is
first-**submit** work — texture residency, buffer uploads, the driver
specializing against real bindings — which compiling a program does not touch.
For that, the lever is still to **draw** the scene once while the loading screen
is up and then throw it away; the warmed GPU state stays behind.

```js
await loader.preload(resources);
buildScene(app);                       // same geometry the level uses
await twoFrames();                     // event.GAME_AFTER_DRAW
removeOnlyWhatYouAdded(app);           // keep the programs, drop the scene
state.change(state.PLAY);
```

**It borrows the LOADING stage's world, and that has three teeth**, all learned
the hard way:

- **Never tear down with `app.world.reset()`.** It clears *every* child of that
  world, the loading screen's own included, and the screen goes blank for the
  rest of the load. Snapshot `app.world.children` first and remove only what
  you added.
- **Restore anything the warm-up changes that the loading screen shows** — the
  renderer's `backgroundColor` above all, or the warm-up flashes its own empty
  first frame.
- **Under a `Camera3d` it will hide the built-in loading screen, and there is no
  clean way around it** — see below.

### `DefaultLoadingScreen` lives in the WORLD, not on the screen

The built-in loading screen is written for a `Camera2d`. Its progress bar and
logo are added with `app.world.addChild(bar, 1)` / `addChild(logo, 2)` and are
**`floating === false`** — ordinary world-space renderables. They read as an
overlay only because that stage's world is otherwise empty.

So with `cameraClass: Camera3d`, anything you add to that world is in the scene
*with* them, and a 3D scene simply swallows them: the depth buffer puts terrain
in front of a bar sitting at z = 1. What does NOT rescue it, all tried:

- **Raising their `z`** — for a mesh on the `Camera3d` path `pos.z` IS world
  depth, so the scene's own z values are geometry, not layering, and the bar
  still loses to the depth test.
- **`moveToTop()`** — it early-returns for a child already at index 0, which the
  loading screen's children always are, having been added before anything else.
  It silently does nothing.
- **Flipping them to `floating = true`** for the duration — the scene still
  covers them.

If you want a warm-up (or any 3D behind a loading screen), write your own
loading stage and draw its progress UI as **floating** renderables over the
scene. That is also the nicer result: the player watches the level assemble
instead of a logo. Budget it as real work, not a one-liner — and weigh it
against what the warm-up actually saves.

One more limit: a warm-up only covers the combinations it actually draws.
Renderables the real level has and the warm-up does not will still link on
entry.

## Two conventions that produce 404s

**Audio `src` is a directory.** The loader appends the asset name plus each
format from `audio.init()`, and picks the first that decodes:

```js
audio.init("mp3,ogg");                                  // before preloading audio
{ name: "cling", type: "audio", src: "data/sfx/" }      // → data/sfx/cling.mp3
```

A full filename here gives you a 404. And `audio.init()` must run **before** any
audio asset is preloaded.

**A Tiled map needs its dependencies listed too** — the `.tmx`, any external
`.tsx`, and the tileset images. Listing only the map produces a blank level.

## Retrieving loaded assets

```js
loader.getImage("tiles");
loader.getJSON("atlas");
loader.getTMX("map1");
loader.getGLTF("diorama");
loader.getVideo("intro");
loader.getFont("font");
loader.getBinary("font-fnt");
```

Most engine classes take the asset **name** directly, so you often do not need
these — `new Sprite(x, y, { image: "tiles" })` resolves it for you.

## Custom asset types

`loader.setParser(type, parserFn)` teaches the loader a type of its own. An entry
of that type then sits in the preload list like any other: it is one step of the
progress bar, and `preload()` waits for it before `LOADER_COMPLETE`. Use it for a
file format melonJS does not know, and for anything you **generate** that takes
long enough to matter.

```js
import { loader, Sprite } from "melonjs";

const skies = new Map();

// once, before preloading: registering a type twice logs a warning
loader.setParser("sky", (asset, onload, onerror) => {
    bakeSky(asset.name)                 // your generator, returning a Promise
        .then((canvas) => {
            skies.set(asset.name, canvas);
            onload();                   // takes no value, see below
        }, onerror);
    return 1;                           // one asset, settling later
});

await loader.preload([
    { name: "nebula", type: "sky" },    // no src: nothing to download
    // ...the rest of the manifest
]);

// in the stage, later: already baked
const backdrop = new Sprite(0, 0, { image: skies.get("nebula") });
```

The contract:

- **Call `onload()` or `onerror(error)`, exactly once,** now or later. Return `1`
  when you will, `0` when there is nothing to load (the loader then moves on
  without waiting).
- **The loader keeps nothing for a type it does not know.** `onload` takes no
  value, and `loader.getImage` and friends will not find your result. Keep it
  yourself, keyed by `asset.name`, and read it from there.
- **`name` and `type` are a complete entry.** `src` is only for a type that
  fetches something. `data` is typed for the built-in uses (a string, or a
  `{glsl, wgsl}` pair), so for a generator's settings, keep a table in your own
  module keyed by name and let the entry carry only the name. That also keeps
  the preload and the stages from disagreeing on a seed.
- **Base URLs:** a `src` is prefixed only by `setBaseURL(yourType, …)`. The `"*"`
  wildcard does not cover custom types.
- **Do not hold the main thread for the whole bake.** A parser runs alongside
  the downloads, and a 200ms synchronous loop freezes the loading screen and
  stalls every other asset's progress for that long. Bake in slices of a few
  milliseconds and yield between them, with `setTimeout`, not
  `requestAnimationFrame`, which stops in a background tab and would hold the
  whole preload with it. Skip the yield while the tab is hidden: a background
  tab runs timers about once a second, which turns a bake of 25 slices into 25
  seconds, and there is no loading screen on show to keep smooth:

```js
const bakeSky = async (name) => {
    const { size, seed } = SKIES[name];         // your recipe table
    const tile = startTile(size, seed);         // set up the canvas and the noise
    for (let y = 0; y < size; ) {
        const start = performance.now();
        while (y < size && performance.now() - start < 8) {
            tile.fillRow(y++);
        }
        if (!document.hidden) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    return tile.finish();
};
```

The Earth Defender example does exactly this for its two nebula skies
(`fx/nebula.ts`): a `"nebula"` type, two name-only entries in its manifest, and
stages that ask for a sky by name and find it baked.

## Base URLs

Set a prefix per asset type rather than repeating it:

```js
loader.setBaseURL("image", "data/img/");
loader.setBaseURL("audio", "data/sfx/");
loader.setBaseURL("*", "https://cdn.example.com/");   // every 2D type at once
```

The `"*"` wildcard deliberately **skips `obj`, `mtl`, `gltf` and `glb`**: those
resolve their own internal references (a `map_Kd` texture, a glTF `.bin`)
relative to their file, so a global prefix would double-prefix them. Set those
types individually.

## Progress and completion

Use the events. The old callback properties (`loader.onload`, `onProgress`,
`onError`) were deprecated in 18.2 and **removed in 20.3** — being `let`
bindings on an ES module namespace they could never be assigned from outside in
the first place, so `loader.onProgress = fn` always threw a `TypeError`:

```js
import { event } from "melonjs";

event.on(event.LOADER_PROGRESS, (progress) => { /* 0..1 */ });
event.on(event.LOADER_COMPLETE, () => { /* … */ });
event.on(event.LOADER_ERROR, (res) => { /* … */ });
```

## Unloading

```js
loader.unload({ name: "map1", type: "tmx" });
loader.unloadAll();
```

`unloadAll()` also releases audio and GPU resources such as shader programs, so
it is the right teardown for switching between large levels.

## Loading between scenes

The default loading screen appears automatically when `preload` switches state.
For a custom one, register a `Stage` against `state.LOADING`:

```js
state.set(state.LOADING, new MyLoadingScreen());
```

If you preload without a loading stage and then change state immediately, pass
`forceChange`:

```js
state.change(state.PLAY, true);
```

## Cross-origin and authenticated assets

Two settings, both global and both applying to **every** asset type — there is
no per-asset or per-type spelling to remember:

```js
loader.setOptions({
    crossOrigin: "anonymous",   // CORS mode for remote assets
    withCredentials: true,      // send cookies / auth with the request
});
```

`withCredentials` is what an asset behind a session cookie or an
`Authorization`-style login needs. Every fetched asset — image, json, binary,
tmx, tsx, shader, gltf/glb, obj, mtl, aseprite, video — carries it, and so does
buffered audio.

**Set them through `setOptions`.** `loader.crossOrigin` and
`loader.withCredentials` are read-only module bindings; assigning to them
throws, the same trap as the removed `loader.onload` / `onProgress`.

| | |
| --- | --- |
| one streamed clip (`stream: true` / `html5: true`) ignores `withCredentials` | it plays through an `<audio>` element, which needs a `crossorigin` attribute rather than fetch credentials. Preload it buffered if it is behind auth |
| credentials silently dropped for audio before 20.4 | the loader forwarded them under a pre-20.3 name the backend never read — a hung preload rather than an error |

## Symptom → cause

| symptom | cause |
|---|---|
| audio 404s | `src` given as a file instead of a directory |
| audio fails, `preload()` rejects with "Failed loading resource" | `audio.init()` not called before preloading — the real message is replaced by the loader's |
| blank level, missing tiles | `.tsx` or tileset image not listed in the resources |
| cross-origin textures fail | missing `loader.setOptions({ crossOrigin: "anonymous" })` |
| assets behind a login 401 / audio preload hangs | missing `loader.setOptions({ withCredentials: true })` — one switch, all asset types |
| `TypeError` assigning `loader.withCredentials` / `crossOrigin` | read-only module bindings; use `loader.setOptions({ … })` |
| preload never finishes, blank screen, no error | a failing sound with `audio.setStopOnAudioError(false)` before 20.4 — it disabled audio *and* failed the preload |
| text renders in a fallback font | web font not preloaded as `"fontface"` |
| `BitmapText` renders nothing | the `.fnt` (as `"binary"`) or its image is missing |
| `TypeError` assigning `loader.onProgress` / `onload` | removed in 20.3; they were never writable — use the `LOADER_*` events |
| `load : unknown or invalid resource type` | a custom type in the manifest before its `loader.setParser` call |
| black or frozen screen when a stage is first entered, the profile shows your own code (noise, a canvas bake) | a costly derived asset built on stage entry — bake it inside the preload as a [custom asset type](#custom-asset-types) |
| a custom asset preloads but the result is nowhere to be found | `onload` takes no value and the loader stores nothing for custom types — keep the result in your own module |

## Related skills

- `melonjs-getting-started` — where preloading sits in the bootstrap
- `melonjs-tilemaps` — the full Tiled asset set
- `melonjs-audio` — formats and the directory convention
