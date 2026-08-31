---
name: melonjs-getting-started
description: "Use this skill when starting or bootstrapping a melonJS game, creating the Application, choosing a renderer, or setting up the first scene. Covers the mandatory async init, the world container, adding renderables, and the WebGPU/WebGL 2/Canvas fallback. Triggers on: melonjs, new Application, app.init, app.world, video.AUTO, video.WEBGL, video.CANVAS, Stage, state.change, getting started, bootstrap."
license: MIT
---

# Getting started with melonJS

> Bootstrapping a melonJS 20.x game: the `Application` lifecycle, the mandatory
> `await app.init()`, the world container, and what the renderer fallback means
> for feature availability.

**Applies to:** melonJS 20.x. Older major versions differ — see the
`melonjs-20-migration` skill.

## The bootstrap

`Application` construction is synchronous but **initialisation is not**. `init()`
returns a promise and must be awaited before building any renderable, loading
assets, or entering a scene.

```js
import { Application, Text } from "melonjs";

const app = new Application(1218, 562, {
    parent: "screen",      // id of the DOM element to mount into
    scale: "auto",
    backgroundColor: "#202020",
});
await app.init();          // ← REQUIRED. Nothing below works without it.

app.world.addChild(
    new Text(609, 281, {
        font: "Arial",
        size: 160,
        fillStyle: "#FFFFFF",
        textAlign: "center",
        textBaseline: "middle",
        text: "Hello World !",
    }),
);
```

**This is the single most common thing to get wrong.** On 19.x the constructor
called `init(width, height, options)` for you; on 20.x `init()` takes no
arguments and calling — and awaiting — it is your job. Nothing that follows
names the missing call. The constructor does build `app.world`, so adding a
plain renderable succeeds and simply never draws — no canvas is appended and the
app never subscribes to the frame tick — while constructing a `Sprite` or a
`Text` throws `Cannot read properties of undefined (reading 'renderer')`,
because the global `game` those two fall back on is only set once the first
`init()` resolves. Either way `app.renderer` and `app.viewport` stay `undefined`
and the page stays blank.

`init()` is asynchronous because acquiring a WebGPU device is asynchronous. There
is no synchronous alternative.

## Top-level await

The bootstrap needs `await` at module scope. In an ES module that is fine. If the
surrounding tooling does not allow it, wrap it:

```js
async function main() {
    const app = new Application(800, 600, { parent: "screen" });
    await app.init();
    // …
}
void main();
```

## Choosing a renderer

`video.AUTO` (the default) tries **WebGPU → WebGL 2 → Canvas** and uses the first
that works.

```js
import { video } from "melonjs";

const app = new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,      // default; or video.WEBGPU / video.WEBGL / video.CANVAS
});
```

Two consequences worth knowing before writing rendering code:

- **Which backend you get is a runtime fact, not a build-time one.** The same
  code runs on a different renderer depending on the machine. Do not assume
  WebGL.
- **Not every feature exists on every backend.** Shader effects and post effects
  need a programmable pipeline and are inert on Canvas. Where a feature degrades,
  the engine warns once rather than throwing — so a missing effect is a console
  warning, not a crash.

Pin the renderer explicitly (`video.WEBGL`) only when you have a reason to. It
costs you the WebGPU path and the Canvas fallback.

## The scene graph

`app.world` is the root `Container`. Everything drawn is a descendant of it.

```js
app.world.addChild(sprite, 10);   // 10 is the z / draw order
```

**Pass the z-order as the second argument to `addChild`** — it is the only form
that works. `renderable.z` does not exist as a property, setting `depth` before
`addChild` is overwritten by `autoDepth`, and setting it afterwards does not
resort. See the `melonjs-renderables` skill for the full explanation.

## Scenes

For anything beyond a single screen, use `Stage` subclasses and the `state`
manager rather than mutating `app.world` directly:

```js
import { Stage, state } from "melonjs";

class PlayScreen extends Stage {
    onResetEvent() { /* build the scene */ }
    onDestroyEvent() { /* tear it down */ }
}

state.set(state.PLAY, new PlayScreen());
state.change(state.PLAY);
```

`onResetEvent` runs every time the state is entered, not once — build scene
content there, not in the constructor.

## Loading assets

Assets are declared and preloaded through `loader`; audio needs `audio.init()`
with the formats you ship before any audio asset is preloaded.

```js
import { audio, loader } from "melonjs";

loader.setOptions({ crossOrigin: "anonymous" });   // needed for remote assets
audio.init("mp3,ogg");                             // BEFORE preloading audio
await loader.preload([
    { name: "tileset", type: "image", src: "data/img/tileset.png" },
    { name: "jump",    type: "audio", src: "data/sfx/" },   // directory, not file
]);
```

Two ordering rules that produce confusing failures when missed:

- **`audio.init()` must run before any audio asset is preloaded**, and names the
  formats you actually ship. Preloading first throws *"target audio extension(s)
  should be set through me.audio.init() before calling the preloader"*.
- The audio `src` is a **directory**, not a file. The loader appends the asset
  `name` plus each configured extension, so a full filename gives you a 404.

## `anchorPoint` defaults to the centre

`Renderable.anchorPoint` is `(0.5, 0.5)`, so `pos` is an object's **centre**, not
its top-left. `Container` forces `(0, 0)` instead.

Writing top-left math against a centred anchor puts everything half a sprite off
with no error — it is the most common source of "close but subtly wrong"
placement.

## Common mistakes

| symptom | cause |
|---|---|
| blank page, nothing drawn, or a `TypeError` reading `renderer` from `new Sprite` / `new Text` | missing `await app.init()` |
| objects draw in the wrong order | `.z`/`depth` set instead of `addChild(child, z)` — `.z` is not even a real property |
| shader/post effect does nothing, warning in console | running on the Canvas renderer |
| audio 404s | audio asset `src` given as a file rather than a directory |
| scene content appears once and never resets | scene built in the constructor instead of `onResetEvent` |
| everything offset by half a sprite | top-left math against the centred `anchorPoint` default |
| a `Tween` or `ParticleEmitter` does nothing | `.start()` / `streamParticles()` never called |
| cross-origin textures fail to load | missing `loader.setOptions({ crossOrigin: "anonymous" })` |

## Related skills

- `melonjs-20-migration` — what changed in 20.x that older code and older
  training data get wrong
- `melonjs-renderables` — custom `Renderable` subclasses, pointer events, post
  effects and the traps in each
