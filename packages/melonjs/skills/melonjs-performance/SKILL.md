---
name: melonjs-performance
description: "Use this skill when a melonJS game drops frames, allocates heavily, or needs to scale to many objects. Covers object pooling, draw-call batching, atlases, baking with CanvasRenderTarget, instancing, culling and alwaysUpdate, the debug plugin, and where the real costs are. Triggers on: performance, slow, frame rate, fps, lag, pool, pool.register, pool.pull, batching, draw calls, InstancedMesh, culling, alwaysUpdate, inViewport, CanvasRenderTarget, optimise, profiling, debug plugin, memory, render targets, hdr."
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
import { createPool } from "melonjs";

const bulletPool = createPool((x, y) => {
    const instance = new Bullet(x, y);
    return { instance, reset: (x, y) => instance.onResetEvent(x, y) };
});

const b = bulletPool.get(x, y);   // recycled: reset(x, y)
                                  // fresh:    new Bullet(x, y)
world.removeChild(b);             // returns to bulletPool automatically
```

The container returns a child to whichever pool built it, so removal is enough;
you only call `release()` yourself for something that was never added to the
world.

**`me.pool` is the older, string-keyed version and is deprecated since
18.0.0.** `pool.register(name, Class, true)` / `pool.pull(name)` still work and
print a one-off console notice, but a recycled object is no longer returned on
removal, so pooling through it now costs an allocation per spawn. To register a
class so a Tiled map can name it, use `registerTiledObjectClass` — that is a
separate registry and is not deprecated.

Two rules that cause subtle bugs when missed:

- **`onResetEvent` must restore everything the object's lifetime mutates** —
  alpha, tint, scale, animation, velocity. Anything you forget carries into the
  next use, which looks like a random visual glitch.
- **Pooled objects do not fire `onDestroyEvent` on removal.** Removal always
  calls `onDeactivateEvent`, then tries to return the object to the pool that
  built it; only when nothing owns it does it fall through to `destroy()`,
  which is what calls `onDestroyEvent`. So a successfully recycled object never
  sees it. Pair event subscriptions with `onActivateEvent` /
  `onDeactivateEvent` instead, or you leak handlers.

- **`removeChild` is DEFERRED, which breaks a pool you re-lend in the same
  frame.** The removal is queued and runs after the update and draw stack has
  unwound, so an object you remove and immediately hand out again is torn out
  from under its new owner when the queue drains: it vanishes, and the frame
  after that the removal throws `Child is not mine.` Take it out immediately
  instead, keeping the instance alive for reuse:

  ```js
  world.removeChildNow(bullet, true);   // keepalive: do NOT destroy it
  this.freeList.push(bullet);
  ```

  `removeChildNow(child, keepalive)` with `keepalive` true skips the destroy,
  which is what you want for anything you own the lifetime of. This is the
  usual cause of a pooled effect that flickers out one frame after it is
  recycled.

**The engine's own classes are NOT in this pool.** They were registered in it
once, which bought nothing: most had recycling off, so `pool.pull("Sprite")`
was a plain construction behind a string key. The ones worth recycling have
typed pools instead, reached by key and fully typed:

```js
const tween = getPool("tween").get(target);
const label = getPool("text").get(x, y, { font: "Arial", size: 12 });
getPool("text").release(label);          // yours to release, as with particles
```

`getPool` covers `vector2d`, `vector3d`, `point`, `matrix2d`, `matrix3d`,
`bounds`, `color`, `polygon`, `line`, `rectangle`, `roundedRectangle`,
`ellipse`, `tween`, `particle`, `text`, `colorLayer` and `bitmapTextData`.

`pool.register` still aliases every name you give it under an `me.` prefix,
pointing at the same entry, so `pool.pull("me.Bullet")` resolves identically —
and the same alias reaches the Tiled object factory, which is why a map
authored against melonJS 1.x still finds its classes. Prefer the unprefixed
name in new code; do not "correct" an `me.`-prefixed one, it is not broken.

## `scale()` is multiplicative

A pooled sprite arrives carrying its previous life's transform, and calling
`scale()` each frame compounds. `rotate()` is the same. For absolute values,
reset first:

```js
sprite.currentTransform.identity();
sprite.currentTransform.scale(s, s, 1);
```

**Order matters, and it is the opposite of what reads naturally.**
`Matrix2d.scale` multiplies the matrix ROWS, so it applies AFTER whatever the
matrix already holds. Scale first and then rotate; rotate first and the scale
lands in the rotated frame and SHEARS anything non-uniform:

```js
// correct: a long thin quad, rotated
t.identity();
t.scale(length / texW, width / texH);
t.rotate(angle);

// wrong: the same quad arrives as a parallelogram
t.identity();
t.rotate(angle);
t.scale(length / texW, width / texH);
```

The symptom is a sprite that looks right at 0 and 90 degrees and skews in
between, which reads as a bad texture rather than as a transform bug.

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

Since 20.6 the engine's own programs are built during `preload()` instead —
`loader.preload()` calls `renderer.prewarm()` itself, on every call, when the
application's `prewarm` setting is on, which is the default. So on a current
version this is one cause you can rule out before looking further, **unless the
game does not use the preloader at all**, which is the one way to miss it — see `melonjs-loading-assets`. It does not
cover effects you construct inline, and it does not cover the rest of what a
first frame pays for, below.

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
102ms) on the second.

**Careful with the conclusion, though — "the programs were cached" is the
tempting reading and it is wrong.** Prewarming the engine's own programs ahead
of that first entry moves the worst frame by about 3ms, measured. So the 575ms
is not program linking: it is everything else the first *submit* pays for —
texture residency, buffer uploads, and the driver specializing a pipeline
against real bindings — all of which the second entry finds already done.

That distinction decides which lever to reach for. Linking is what `prewarm`
covers and what shrinking your shader count helps. The rest only goes away if
the geometry is actually **drawn** once beforehand.

Three things follow.

- **Cut the number of programs.** Identical `ShaderEffect`s each link their own,
  so preload one as a `"shader"` asset and share it.
- **Declare effects as assets, not inline**, so the loader can prepare them
  before a scene draws — an inline effect does not exist until the stage that
  builds it runs.
- **Pay what remains behind the loading screen** by drawing the scene once there
  and discarding it (see `melonjs-loading-assets`). Linking is only part of a
  first frame: texture residency, buffer uploads and the driver specializing
  against real bindings all land on the first *submit*, and only an actual draw
  front-loads those. A measured case on a fast desktop GPU had shader prewarming
  move the worst frame by ~3ms while a warm-up draw moved it by hundreds.

Do not profile this on a software rasterizer — headless Chromium falls back to
SwiftShader, where the absolute numbers are wildly pessimistic and the JS
profile shows the time as `(program)`, outside JS entirely. Ratios transfer;
milliseconds do not.

## Render targets, and what `hdr` costs

A render target is a canvas-sized GPU surface. The engine allocates them
lazily and only where a multi-pass chain actually needs one, which is worth
knowing before assuming an effect is expensive:

- a renderable with **no** post effects: none
- a renderable with **exactly one** post effect: still none. It takes the
  `customShader` fast path and draws straight into whatever target is already
  bound
- a **camera** with effects: a pair (one capture, one ping-pong intermediate)
- a sprite with **two or more** effects: its own pair

So the first lever is the count, not the cost of any one effect: going from
one effect to two on a sprite is what allocates, not going from a cheap shader
to an expensive one.

`hdr: true` changes the format of that camera pair from 8 bits per channel to
half-float, which is **8 bytes per pixel instead of 4**. At 1920×1080 that is
about 8 MB per target instead of 4 MB, so roughly +8 MB for the pair. With
`antiAlias` on, the capture half is also multisampled and its multisampled
surface takes the same format, so that part doubles too.

Nothing else moves. Sprite chains and the advanced-blend target stay 8-bit
whatever `hdr` says, for a correctness reason rather than a thrifty one: their
final blit composites with `ONE_MINUS_SRC_ALPHA`, and additive blending
accumulates alpha past 1 in a float target, which would turn that factor
negative and subtract the backdrop.

**With `hdr` off, nothing changes at all** — every target keeps the 8-bit
attachment it has always had, and a game that never adds a camera post-effect
allocates no render targets in the first place. The setting costs nothing
until something is actually using it.

```js
// what you actually got, which is not always what you asked for
if (app.renderer.supportsHDR === false) { /* grade for a chain that clamps */ }
```

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
