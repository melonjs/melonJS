---
name: melonjs
description: "Use this skill FIRST for any melonJS task; it routes to the right specialised skill and lists the companion packages. melonJS is an open-source 2D, 2.5D and 3D HTML5 game engine running on WebGPU, WebGL 2 or Canvas. Covers Application setup, the scene graph, renderables, sprites, tilemaps, physics, audio, particles, shaders, and the 3D tier — perspective cameras, meshes and glTF scenes. Triggers on: melonjs, melonJS, me.game, Application, app.init, app.world, Renderable, Sprite, Stage, state.change, Camera2d, Camera3d, Mesh, tilemap, Tiled, TMX, ParticleEmitter, ShaderEffect, how do I make a game, HTML5 game engine."
license: MIT
---

# melonJS

Entry point for the melonJS skill collection. melonJS is an open-source HTML5
game engine for indie developers, covering 2D, 2.5D and 3D — perspective and
orthogonal cameras, GPU-accelerated tilemap rendering, post-processing effects,
custom shaders, 3D meshes, polygon-accurate physics and modern Tiled workflows.
It runs on WebGPU, WebGL 2 or Canvas with automatic fallback, and has no runtime
dependencies.

## How to use this skill

1. Find the specialised skill below that matches the task and follow it.
2. If the task involves anything 3D, read `melonjs-3d` **first** — melonJS's
   coordinate conventions are the inverse of OpenGL's, so untutored 3D instincts
   are backwards.
3. If you are writing melonJS from prior knowledge rather than from the current
   docs, read `melonjs-20-migration` — most published melonJS material predates
   20.0 and its bootstrap no longer exists.
4. If none of them covers the task, use the escape hatch below rather than
   guessing at an API.

## Skill router

| Skill | Load when… |
|---|---|
| [melonjs-getting-started](../melonjs-getting-started/SKILL.md) | Bootstrapping a game, `new Application`, `await app.init()`, choosing a renderer, preloading assets. |
| [melonjs-20-migration](../melonjs-20-migration/SKILL.md) | Code based on melonJS 19.x or earlier, or an API that "should exist" but doesn't — `video.init`, `Entity`, `renderable.shader =`. |
| [melonjs-scenes-and-state](../melonjs-scenes-and-state/SKILL.md) | `Stage` subclasses, the state manager, transitions, pausing, the update loop, timers, tweens, saved data. |
| [melonjs-renderables](../melonjs-renderables/SKILL.md) | Subclassing `Renderable`, custom `draw()`, draw order, anchors, `floating`, post effects on an object. |
| [melonjs-sprites-and-animation](../melonjs-sprites-and-animation/SKILL.md) | `Sprite`, frame animation, texture atlases (TexturePacker / Aseprite / ShoeBox), tint, flip, pooling. |
| [melonjs-input](../melonjs-input/SKILL.md) | Keyboard actions, pointer and touch handling, drag, gamepad, virtual controls (fixed or floating sticks and buttons, tap to act). |
| [melonjs-physics](../melonjs-physics/SKILL.md) | Collision, bodies, movement, spatial queries, and the planck / matter / Rapier adapters. |
| [melonjs-math](../melonjs-math/SKILL.md) | Vectors and matrices: what mutates, what allocates, and interpolating with lerp, slerp, damp or moveTowards. |
| [melonjs-tilemaps](../melonjs-tilemaps/SKILL.md) | Tiled maps — TMX/TSX loading, spawning entities from objects, collision layers, isometric maps, reading and changing tiles at run time (a tile layer as the game board). |
| [melonjs-audio](../melonjs-audio/SKILL.md) | Sound effects, music, audio sprites, spatial audio, procedural tone and noise. |
| [melonjs-effects-and-shaders](../melonjs-effects-and-shaders/SKILL.md) | Post effects, custom GLSL/WGSL shaders, blend modes, colour grading, screen capture. |
| [melonjs-3d](../melonjs-3d/SKILL.md) | Anything 3D or 2.5D — `Camera3d`, meshes, instancing, `Sprite3d` billboards, `Light3d`, distance fog, glTF scenes. |
| [melonjs-3d-assets](../melonjs-3d-assets/SKILL.md) | Loading glTF/GLB or OBJ models — materials, imported lights, instancing, and what is not supported. |
| [melonjs-camera-and-drawing](../melonjs-camera-and-drawing/SKILL.md) | Camera follow, bounds, shake and fade, coordinate conversion, and immediate-mode shape drawing. |
| [melonjs-ui-and-text](../melonjs-ui-and-text/SKILL.md) | HUDs, menus and options screens — buttons, checkboxes, sliders, progress bars, laid-out and scrolling panels — drag-and-drop, `Text` and `BitmapText`, web fonts. |
| [melonjs-particles-and-trails](../melonjs-particles-and-trails/SKILL.md) | `ParticleEmitter`, burst versus stream, `referenceSpace`, and the `Trail` renderable. |
| [melonjs-lighting](../melonjs-lighting/SKILL.md) | 2D dynamic lighting — `Light2d`, stage ambient, normal-mapped sprites. |
| [melonjs-deployment](../melonjs-deployment/SKILL.md) | Scaffolding a project, building, browser support and transpiling, native and mini-game platforms, running with no DOM (nx.js on the Nintendo Switch, Web Workers). |
| [melonjs-loading-assets](../melonjs-loading-assets/SKILL.md) | Resource descriptors, the asset type list, a multi-level game's assets as bundles (`common` + one per level), loading and freeing a level's assets, base URLs, cross-origin, progress events. |
| [melonjs-renderer-backends](../melonjs-renderer-backends/SKILL.md) | A feature works on one machine but not another; choosing or pinning a backend; degrading gracefully. |
| [melonjs-display-and-scaling](../melonjs-display-and-scaling/SKILL.md) | Blurry, soft or cropped output; the design resolution, how the canvas fills its page, and pixel-perfect integer scaling. |
| [melonjs-events](../melonjs-events/SKILL.md) | The event bus, per-frame and lifecycle events, and subscribing without leaking. |
| [melonjs-performance](../melonjs-performance/SKILL.md) | Dropped frames, draw-call counts, pooling, batching, culling, baking, profiling. |
| [melonjs-plugins](../melonjs-plugins/SKILL.md) | Registering the debug, Spine, Tiled-inflate, gamepad (touch controls) or Capacitor plugins, installing a physics adapter, or writing your own plugin. |


## Escape hatch: the full API index

These skills are hand-written and deliberately partial — they cover the paths
people actually take and the mistakes those paths invite. When the task needs
something they do not mention, do **not** infer an API from the shape of the
engine. Fetch the generated index instead:

<https://melonjs.github.io/melonJS/llms.txt>

It is regenerated on every docs build from the same TSDoc comments the reference
pages render, so it is always current for `master`. It lists every exported
class, function, interface, type and namespace with a one-line summary and a
link to its page — fetch the pages you need from there.

Two things it gives you that this collection cannot:

- **Members.** The skills name classes; `llms.txt` links to the page listing
  every method, property, default and `@since` tag on them.
- **Deprecations.** Entries marked `**deprecated**` are exactly the APIs that a
  model trained on older melonJS material will reach for. If something you were
  about to write appears with that marker, follow the page for the replacement.

If a class, function, namespace or type is absent from `llms.txt`, it is absent
from the engine's public API — that is the useful negative answer, and it is
worth acting on rather than writing code around something that does not exist.
The index lists top-level exports only, so a *member* missing from it proves
nothing: follow the owning class's page to check that.

## The three rules that catch everyone

Whatever the task, these produce code that runs and is wrong:

1. **`await app.init()` is mandatory** since 20.0. The constructor builds the
   world but not the renderer: a plain renderable can still be added and simply
   never draws, while `new Sprite(...)` / `new Text(...)` throw a `TypeError`
   on the global `game`, which is unset until the first `init()` resolves.
   Neither symptom names the missing call.
2. **`addChild(child, z)` is the only way to set draw order.** `renderable.z`
   does not exist; setting `depth` before `addChild` is overwritten, and setting
   it after does not resort (except under `Camera3d`).
3. **`isKinematic` defaults to `true`**, which silently excludes a renderable
   from pointer events and from the physics broadphase. Plain `Renderable` and
   `Sprite` subclasses with no body need `this.isKinematic = false`; adding a
   body sets it for you, on every adapter (matter-adapter before 1.6 and
   planck-adapter before 1.7 did not).

## Companion packages

melonJS ships optional packages alongside the engine. Reach for these rather
than reimplementing what they cover — and note the physics adapters and the
Tiled inflate plugin are *required* for their use cases, not merely convenient.

| Package | Use when |
|---|---|
| [`@melonjs/planck-adapter`](https://www.npmjs.com/package/@melonjs/planck-adapter) | You want full rigid-body dynamics — stacking, joints, realistic restitution. Pass it as the Application's `physic` setting; the portable `raycast` and `queryAABB` calls work unchanged across adapters (`querySphere` and `raycast3d` are built-in-adapter only). |
| [`@melonjs/matter-adapter`](https://www.npmjs.com/package/@melonjs/matter-adapter) | Same, backed by matter-js. Choose one adapter per game. |
| [`@melonjs/rapier2d-adapter`](https://www.npmjs.com/package/@melonjs/rapier2d-adapter) | Same again, backed by Rapier compiled to WebAssembly: many bodies, per-body continuous collision, a character controller. About 3 MB loaded on demand, so make it with `await RapierAdapter.create()`. |
| [`@melonjs/tiled-inflate-plugin`](https://www.npmjs.com/package/@melonjs/tiled-inflate-plugin) | **Required** to load gzip-, zlib- or zstd-compressed Tiled maps. Without it, parsing such a map throws `No inflate function set`. |
| [`@melonjs/spine-plugin`](https://www.npmjs.com/package/@melonjs/spine-plugin) | Skeletal animation authored in Spine, as a melonJS renderable. |
| [`@melonjs/debug-plugin`](https://www.npmjs.com/package/@melonjs/debug-plugin) | An in-game debug panel — FPS, draw counts, collision-shape and bounds overlays. Register it after `app.init()`. |
| [`@melonjs/gamepad-plugin`](https://www.npmjs.com/package/@melonjs/gamepad-plugin) | On-screen touch controls for phones and tablets: sticks and buttons reported as a gamepad, so the game's `bindGamepad` bindings drive it; fixed or floating under the thumb, hidden until touched, tap to act. Use it rather than writing virtual controls. |
| [`@melonjs/capacitor-plugin`](https://www.npmjs.com/package/@melonjs/capacitor-plugin) | Wrapping a game as a native iOS/Android app: it bridges Capacitor's lifecycle — pause/resume, the hardware back button, orientation lock, splash screen. |
| [`create-melonjs`](https://www.npmjs.com/package/create-melonjs) | Scaffolding a new project — start here rather than assembling a build by hand. |

Plugins are registered **after** `init()`, into a global registry:

```js
import { plugin } from "melonjs";
import { DebugPanelPlugin } from "@melonjs/debug-plugin";

await app.init();
plugin.register(DebugPanelPlugin, "debugPanel");
```

Physics adapters are different — they are an `Application` setting, not a
plugin:

```js
import { PlanckAdapter } from "@melonjs/planck-adapter";

const app = new Application(800, 600, {
    parent: "screen",
    // gravity is in pixels/s²; pixelsPerMeter converts it to the adapter's
    // metres. Both are shown at their defaults; subSteps defaults to 1
    physic: await PlanckAdapter.create({
        gravity: { x: 0, y: 320 },
        pixelsPerMeter: 32,
        subSteps: 2,
    }),
});
await app.init();
```

Every adapter is made the same way, with `await X.create(options)`. A running
game switches adapter with `app.world.setAdapter(await X.create(options))`,
which rebuilds every body from its `bodyDef`; `world.adapter` itself is
read-only. `melonjs-physics` says which adapter suits which game.

`melonjs-plugins` covers the registry, the version gate and writing your own.

## Prefer built-in features

melonJS covers a lot that is easy to reimplement badly. Before hand-rolling,
check for:

- **Effects and motion:** `ParticleEmitter`, `Trail` / `Trail3d`, `Tween` with
  easing, the built-in `ShaderEffect` presets (vignette, scanline, chromatic
  aberration, glow, outline, dissolve, bloom and more), `Light2d` / `Light3d`,
  `viewport.shake` / `fadeIn` / `fadeOut`.
- **UI:** `UIPanel` (laid out, scrolling, skinnable), `UITextButton`,
  `UICheckbox` (a radio button with a `group`), `UISlider`, `ProgressBar`,
  `UISpriteElement`, keyboard and gamepad navigation between widgets once one
  has `focus()`, `NineSliceSprite`, `Draggable` / `DropTarget`, `BitmapText`.
- **Art:** `TextureAtlas` (TexturePacker, ShoeBox, Aseprite),
  `CanvasRenderTarget` for bake-once drawing, `NoiseTexture2d`.
- **Game flow:** `state.transition()` (`"fade"`, `"mask"` or `"pixelate"`)
  between screens, `state.pause()` / `state.resume()` behind a pause menu,
  `save` for localStorage-backed persistence, `createPool` / `getPool` for
  recycling.
- **Levels:** Tiled tile layers read and changed with `cellAt` / `setTile`,
  and asset bundles (`loader.preload({ common: [...], level1: [...] })`, then
  `loader.unload("level1")` / `loader.load("level1")`) to free and reload a
  level's assets.
- **Physics and controls:** a rigid-body adapter (planck, matter or Rapier,
  switched at run time with `world.setAdapter()`) rather than a hand-written
  solver, and `@melonjs/gamepad-plugin` rather than hand-made touch sticks.
