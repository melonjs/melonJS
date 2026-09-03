---
name: melonjs-loading-assets
description: "Use this skill for loading and managing game assets in melonJS — the resource descriptor format, the full asset type list, preload versus load, retrieving loaded assets, base URLs and cross-origin settings, and the loading screen. Triggers on: loader, loader.preload, loader.load, resources, getImage, getJSON, getTMX, getGLTF, getVideo, getFont, setBaseURL, setOptions, crossOrigin, withCredentials, credentials, cookies, authenticated assets, CORS, asset, preload, LOADER_COMPLETE, loading screen, unload."
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
| `"json"` | data, texture-atlas descriptors |
| `"tmx"` / `"tsx"` | Tiled maps and external tilesets |
| `"audio"` | sound — **`src` is a directory**, see below |
| `"video"` | video textures |
| `"binary"` | raw data, bitmap font `.fnt` descriptors |
| `"fontface"` | web fonts (`.ttf`, `.woff`) |
| `"aseprite"` | Aseprite JSON + image |
| `"shader"` | GLSL/WGSL shader sources |
| `"obj"` / `"mtl"` | Wavefront models and materials |
| `"gltf"` / `"glb"` | glTF scenes |
| `"js"` | scripts |

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

## Related skills

- `melonjs-getting-started` — where preloading sits in the bootstrap
- `melonjs-tilemaps` — the full Tiled asset set
- `melonjs-audio` — formats and the directory convention
