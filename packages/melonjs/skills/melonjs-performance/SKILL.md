---
name: melonjs-performance
description: "Use this skill when a melonJS game drops frames, allocates heavily, or needs to scale to many objects. Covers object pooling, draw-call batching, atlases, baking with CanvasRenderTarget, instancing, culling and alwaysUpdate, the debug plugin, and where the real costs are. Triggers on: performance, slow, frame rate, fps, lag, pool, pool.register, pool.pull, batching, draw calls, InstancedMesh, culling, alwaysUpdate, inViewport, CanvasRenderTarget, optimise, profiling, debug plugin, memory."
license: MIT
---

# Performance

## Measure first

Register the debug plugin and read the numbers before changing anything:

```js
import { plugin } from "melonjs";
import { DebugPanelPlugin } from "@melonjs/debug-plugin";

await app.init();
plugin.register(DebugPanelPlugin, "debugPanel");
```

It reports frame time, draw calls, object counts, and can overlay collision
shapes and bounds. **Draw calls** is usually the number that matters.

## Batching: the biggest lever

Both GPU backends batch **across textures**, not just within one: the quad
batcher assigns each source image a texture unit and embeds the unit in the
vertex data, so several different images still flush as a single draw. The pool
is finite — the WebGL batcher gets `renderer.maxTextures` units (the
`maxTextures` application setting, `"auto"` = the device limit capped at 32), the
WebGPU batcher eight per segment. Overflow the pool and the batch flushes.

So the goal is not "one image" but "few state changes". What actually ends a
batch:

- **Overflowing the texture-unit pool** — pack sprites into a `TextureAtlas` and
  prefer one large tileset over several small ones, so a screenful of sprites
  fits inside the pool with room to spare.
- **Changing `blendMode`** — `setBlendMode` flushes before it touches GL state.
  Group by blend mode where you can.
- **Switching batcher** — interleaving primitives (`strokeRect`, `fillRect`,
  debug shapes) or meshes between sprites flushes the quad batcher and rebinds.
  Draw all the sprites, then all the primitives.
- **Binding a custom shader** — a `ShaderEffect` on the quad batcher also turns
  multi-texture batching *off* for the duration, dropping you back to one
  texture per draw.

The advanced blend modes are the expensive ones: `overlay`, `difference`,
`hard-light`, `soft-light`, `color-dodge`, `color-burn`, `darken` and `lighten`
cannot be expressed as fixed-function blending, so each such draw is bracketed
on its own — capture the destination, redraw offscreen, composite through a
shader. Right for accents, wrong for hundreds of objects. `normal`, `additive`,
`multiply`, `screen` and `exclusion` are plain fixed-function state and cost
nothing extra.

## Pooling

Anything spawned frequently — bullets, particles, pickups, damage numbers —
should be pooled rather than allocated:

```js
pool.register("bullet", Bullet, true);      // third arg = enable recycling
const b = pool.pull("bullet", x, y);        // recycled: onResetEvent(x, y)
                                            // fresh:    new Bullet(x, y)
world.removeChild(b);                        // returns to the pool automatically
```

`register` also publishes the class as a Tiled object factory under that name,
so an object with a matching class or name in a `.tmx` map instantiates it. Set
`pool.autoRegisterTiled = false` around the call for classes that should stay
programmatic.

Two rules that cause subtle bugs when missed:

- **`onResetEvent` must restore everything the object's lifetime mutates** —
  alpha, tint, scale, animation, velocity. Anything you forget carries into the
  next use, which looks like a random visual glitch.
- **Pooled objects do not fire `onDestroyEvent` on removal.** Removal always
  calls `onDeactivateEvent`, then tries `pool.push`; only when that *fails* does
  it fall through to `destroy()`, which is what calls `onDestroyEvent`. So a
  successfully recycled object never sees it. Pair event subscriptions with
  `onActivateEvent` / `onDeactivateEvent` instead, or you leak handlers.

Engine classes are poolable too: `pool.pull("me.Tween", target)`.

## `scale()` is multiplicative

A pooled sprite arrives carrying its previous life's transform, and calling
`scale()` each frame compounds. For absolute scaling:

```js
sprite.currentTransform.identity();
sprite.currentTransform.scale(s, s, 1);
```

## Culling and update cost

- `Container` recomputes `inViewport` for every child each frame against every
  active camera, and skips both its `draw()` **and** its `update(dt)` when it is
  off-screen. That gate is `inViewport || alwaysUpdate`, and it applies to every
  container in every game, whichever physics you use.
- On top of that, the **built-in physics adapter** gates body integration and
  narrow-phase collision on the same `inViewport || alwaysUpdate` — so an
  off-screen body stops simulating even if something else calls its `update`.
  The planck and matter adapters have no such gate: they step the whole world
  regardless of the camera.
- Set `alwaysUpdate = true` on anything that must keep moving off-screen, and
  accept the cost. On many objects it removes the saving entirely.
- `floating = true` does **not** disable culling — it moves the test into screen
  space: a floating renderable is checked against the camera's screen rectangle
  (`0, 0, camera.width, camera.height`) instead of the world view. That is why a
  HUD stays put as the camera moves. `Container.draw` then draws floating
  children unconditionally, but `update()` is still gated, so a floating object
  parked outside the screen rectangle stops updating.

## Bake once, draw many

When you would otherwise issue hundreds of identical draws every frame, render
once into a `CanvasRenderTarget` and draw the result as a single sprite. This is
the sanctioned idiom before reaching for a custom shader — hundreds of draws
collapse to one.

## Instancing in 3D

`InstancedMesh` draws one mesh many times in a single call — the difference
between a hundred trees and a hundred thousand. glTF scenes using
`EXT_mesh_gpu_instancing` load as an `InstancedMesh` automatically.

It trades per-object control for the draw call: the set gets ONE depth sort key
and ONE ground shadow, and `removeInstance` swaps the last instance into the
hole so held indices go stale. Scenery yes; anything the game removes or
queries one at a time, usually not. See `melonjs-3d` for the decision table.

## Update loops

- `update(dt)` should **return `true` only when something changed**. Returning
  `true` unconditionally forces redraw work every frame.
- Use `dt` for motion rather than assuming a fixed step — the engine already
  paces it, and a fixed assumption breaks on high-refresh displays.
- Use `timer.setTimeout` / `setInterval`, which are pause-aware. `window` timers
  keep firing behind a pause menu.

## Audio and assets

- `stream: true` on long music tracks plays through a streaming element instead
  of decoding the whole file into memory.
- `pool` on an audio clip sizes the reuse pool for finished instances — it is
  **not** a concurrency cap.
- `loader.unloadAll()` between large levels drops every loaded asset and
  `destroy()`s the shader programs the loader owns — that last part is a real
  GPU release. Images, by contrast, only lose their loader-side reference; the
  renderer's texture cache is not purged by unloading.

## The first frame of a scene is not like the others

A freeze the first time a level appears, and never again, is almost always
**shader linking**, not your scene build. Measure before assuming: procedural
geometry is usually trivial next to it.

Programs are created lazily. The mesh batcher keys a variant on the feature
combination it is asked for (lit, instanced, instance colours, instance data,
fog) and links it on the first draw that needs it — and `compileProgram` calls
`getProgramParameter(LINK_STATUS)` right after `linkProgram`, which blocks until
the driver finishes. That whole cost lands inside one frame.

How to tell them apart, all from the page:

```js
// 1. is it the build, or the draw?  time your own setup
const t0 = performance.now(); buildLevel(); console.log(performance.now() - t0);

// 2. how long is the bad frame?  rAF deltas, not averages
let last = performance.now();
const tick = () => { const n = performance.now();
  if (n - last > 40) console.log("long frame", (n - last).toFixed(0));
  last = n; requestAnimationFrame(tick); };

// 3. is it programs?  count them, and when
const gl = WebGL2RenderingContext.prototype, link = gl.linkProgram;
gl.linkProgram = function (p) { console.count("linkProgram"); return link.call(this, p); };
```

The tell is that the second entry into the same scene is cheap: one measured
case went 852ms of stall (worst frame 479ms) on first entry to 277ms (worst
102ms) on the second, because the programs were already cached.

Two things follow. Cut the number of programs — identical `ShaderEffect`s each
link their own, so preload one as a `"shader"` asset and share it. And pay what
remains behind the loading screen by drawing the scene once there and discarding
it (see `melonjs-loading-assets`).

Do not profile this on a software rasterizer — headless Chromium falls back to
SwiftShader, where the absolute numbers are wildly pessimistic and the JS
profile shows the time as `(program)`, outside JS entirely. Ratios transfer;
milliseconds do not.

## Where the costs actually are

In rough order for a typical 2D game:

1. Draw calls — fix with atlases and fewer tilesets
2. Overdraw from large blended sprites
3. Per-frame allocation — fix with pooling
4. `alwaysUpdate` on objects that do not need it
5. The engine itself, which is rarely the problem

## Symptom → cause

| symptom | cause |
|---|---|
| high draw-call count | the texture-unit pool overflows, or primitives/meshes are interleaved with sprites |
| draw calls jump when one effect is enabled | a custom shader on the quad batcher disables multi-texture batching |
| frame time spikes and GC pauses | allocating per frame instead of pooling |
| a recycled object looks wrong | `onResetEvent` does not restore every mutated property |
| sprite grows every frame | `scale()` is multiplicative — reset the transform |
| off-screen enemies stop moving | `update()` and built-in physics both gate on `inViewport`; set `alwaysUpdate` |
| a HUD element vanishes | `floating` is culled against the screen rect, and it sits outside it |
| everything updates even when idle | `update()` returning `true` unconditionally |
| memory grows with long music | missing `stream: true` |
| slow only on some machines | Canvas fallback — no GPU tilemap path |
| a freeze the first time a level shows, never again | shader variants linking on first draw — warm them behind the loading screen |
| the same scene stutters once per entry | a derived texture rebuilt per stage: the texture cache keys on the image object, so each rebuild is a new upload |

## Related skills

- `melonjs-sprites-and-animation` — atlases and pooling in detail
- `melonjs-renderer-backends` — why performance differs per machine
- `melonjs-3d` — `InstancedMesh`
