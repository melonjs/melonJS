---
name: melonjs-20-migration
description: "Use this skill when writing melonJS code that may be based on pre-20.x knowledge, when migrating a game from melonJS 19.x or earlier, or when an API you expected does not exist. Covers the mandatory async Application.init(), the WebGL 2 baseline and WebGPU backend, renderable post effects replacing the shader property, and the deprecated exports still present. Triggers on: migration, upgrade, melonJS 19, me.game, me.video.init, renderable.shader, Compositor, CanvasTexture, me.Math, deprecated."
license: MIT
---

# Migrating to melonJS 20.x

> What changed in melonJS 20.x, and which older APIs are gone, deprecated, or
> renamed. Read this before writing melonJS code from memory — much of what is
> published about melonJS predates 20.0.

**Why this skill exists:** most melonJS material in circulation describes 19.x or
earlier. Code written from that knowledge looks correct and fails at runtime.
The items below are ordered by how likely they are to be reproduced from memory.

## 1. `Application.init()` is mandatory and asynchronous

Since 20.0, constructing an `Application` no longer initialises it.

```js
// ✗ pre-20.x — the constructor called init(width, height, options) for you
const app = new Application(800, 600, { parent: "screen" });
app.world.addChild(sprite);          // added, but nothing ever renders

// ✓ 20.x
const app = new Application(800, 600, { parent: "screen" });
await app.init();                    // REQUIRED
app.world.addChild(sprite);
```

`init()` is async because acquiring a WebGPU device is async. There is no
synchronous alternative, and no automatic fallback that papers over the missing
call. Nothing that then breaks names it: the constructor still builds
`app.world`, so children can be added and simply never draw — no canvas is
appended, the app never subscribes to the frame tick, and `app.renderer` /
`app.viewport` stay `undefined` — while constructing a `Sprite` or `Text` first
throws a `TypeError` on the unset global `game` instead.

The signature changed too: 19.x took `init(width, height, options)`, 20.x takes
none, and anything passed is ignored (settings come from the constructor).

**`video.init(...)` no longer exists.** The `video` module now exports only the
four renderer constants (`AUTO`, `CANVAS`, `WEBGL`, `WEBGPU`) — there is no
`init` on it to call. Any code shaped like `me.video.init(800, 600, {...})` is
from a removed API. Build an `Application` and await `init()`.

Note that `import * as me from "melonjs"` still works, so `me.Sprite` style is
fine. It is the *globals bootstrap* that is gone, not the namespace import.

## 2. Post effects replaced the `shader` property

`renderable.shader = …` is **deprecated since 19.2.0**. Use the post-effect API:

```js
// ✗ deprecated
mySprite.shader = new ShaderEffect(app.renderer, glslBody);

// ✓
mySprite.addPostEffect(new ShaderEffect(app.renderer, glslBody));
```

Related trap: **`removePostEffect()` destroys the effect** — and so does
assigning `renderable.shader`, which destroys whatever it replaces. Only an
effect carrying `shared = true` is spared. To turn one off temporarily, toggle
`effect.enabled` instead: remove-and-re-add hands you back an object whose GPU
resources have already been freed.

## 3. WebGL 2 is the baseline; WebGPU is the default attempt

`video.AUTO` now tries **WebGPU → WebGL 2 → Canvas**. WebGL 1 is gone.

Consequences:

- Which backend runs is a runtime fact. Do not write code that assumes WebGL.
- Custom shaders can carry both GLSL and WGSL in one asset, so one effect runs
  on either GPU backend.
- Features needing a programmable pipeline are inert on Canvas and warn once
  rather than throwing.

## 4. Deprecated exports still present

These resolve but should not be used in new code:

| deprecated | since | use instead |
|---|---|---|
| `CanvasTexture` | 17.1.0 | `CanvasRenderTarget` |
| `Compositor` | 18.1.0 | `WebGLBatcher` |
| `PrimitiveCompositor` | 18.1.0 | `PrimitiveBatcher` |
| `QuadCompositor` | 18.1.0 | `QuadBatcher` |
| `Math` (capitalised) | 18.0.0 | `math` (lowercase) |
| `device.requestFullscreen` / `exitFullscreen` | 19.7.0 | `app.requestFullscreen()` / `app.exitFullscreen()` |
| `renderable.shader = …` | 19.2.0 | `addPostEffect()` |
| `Entity` | 18.1.0 | `Sprite` / `Renderable` + a `Body` |
| `loader.onload` / `onProgress` / `onError` | 18.2.0, **removed 20.3** | the `LOADER_*` events, or `preload(assets, onloadcb)` |
| `response.overlap` / `overlapN` / `overlapV` | — | `response.depth` / `response.normal` |
| `setLineWidth()` | 17.3.0 | the `lineWidth` property |

Two of these deserve emphasis:

- **`Entity`** is still exported, so code using it compiles and runs while being
  the wrong shape for 20.x. Compose a `Sprite`/`Renderable` with a `Body`
  instead.
- **The capitalised `Math`** shadows the global `Math` if imported carelessly.
  `me.Math.random()` from older docs resolves to the deprecated re-export.

## 5. The global `game` is not the modern shape

`game` is still exported, but since 20.0 it names the most recently
**initialized** `Application` and is `undefined` until the first `init()`
resolves — so anything reading it at module scope gets `undefined`. Take the
`Application` instance as a parameter instead: `Stage#onResetEvent` and
`onDestroyEvent` are handed it, and any renderable can reach it through
`parentApp`.

## 6. Node and SSR

melonJS imports cleanly under Node — useful for isomorphic apps and for tooling.
It has **no runtime dependencies** as of 20.3. Do not add polyfills for
`globalThis`, `String.trimStart` or `String.trimEnd`: the published bundle
targets ES2022, so every environment that can parse it already has them.

## 7. Browser support

The published bundle targets **ES2022** and uses private class members. A browser
that predates that cannot parse the file at all — it fails at load, not when a
feature is used. Transpile if you need older browsers, and note that transpiling
handles *syntax* only: built-in methods need separate polyfills, which a
bundler's `target` setting will never add.

## The shipped examples are not all current

The examples in this repository are the best reference for how melonJS is
assembled, but a few contain stale comments or legacy calls. Do not learn these
from them:

- `webgpu/` has a comment claiming *"`video.AUTO` never selects the WebGPU
  backend"*. That is pre-20 leftover — AUTO tries WebGPU **first**. The code is
  right; the comment is wrong.
- Several examples assign `viewport.shader = …` / `sprite.shader = …`, which is
  deprecated. `addPostEffect()` is current.
- Five files set `this.z = Number.POSITIVE_INFINITY` on a HUD. That property
  does not exist; those HUDs draw on top only because they are added last.
- `platformer/entities/player.ts` reads `response.overlapV`, the deprecated
  field. Use `response.depth` / `response.normal`.
- Particle speeds tuned before 20.2 look wrong now: the particle transform fix
  changed how far a burst travels, and emitters were retuned upward to match.

## Checklist when code "should work" but doesn't

1. Is `await app.init()` there?
2. Is the code assuming WebGL when it might be running on Canvas or WebGPU?
3. Is it using `renderable.shader =` instead of `addPostEffect()`?
4. Is it importing a deprecated symbol from the table above?
5. Is it referencing a global `game`?

## Related skills

- `melonjs-getting-started` — the correct 20.x bootstrap in full
- `melonjs-renderables` — post effects, pointer events and custom draw code
