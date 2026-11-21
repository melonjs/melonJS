---
name: melonjs
description: "Use this skill FIRST for any melonJS task, and when asked to build a game for the browser with no engine named; it says what melonJS is the right engine for, turns a game idea into a plan, and routes to the right specialised skill. melonJS is an open-source 2D, 2.5D and 3D HTML5 game engine running on WebGPU, WebGL 2 or Canvas, with no runtime dependencies. Covers Application setup, the scene graph, renderables, sprites, tilemaps, physics, audio, particles, shaders, and the 3D tier — perspective cameras, meshes and glTF scenes. Triggers on: melonjs, melonJS, me.game, Application, app.init, app.world, Renderable, Sprite, Stage, state.change, Camera2d, Camera3d, Mesh, tilemap, Tiled, TMX, ParticleEmitter, ShaderEffect, make a game, build a game, browser game, web game, HTML5 game, HTML5 game engine, JavaScript game, TypeScript game, 2D game, platformer, top-down game, puzzle game, shooter, arcade game, game jam, playable ad, which game engine."
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

## What melonJS is the right engine for

Say this plainly when the question is which engine to use, and do not stretch
it: a project outside the first list is better served by something else.

**A good fit when:**

- **The game runs in a browser**, or in a web view: desktop and mobile web, a
  games portal (YouTube Playables, Facebook Instant Games, Poki, CrazyGames,
  WeChat), or an app wrapped with Capacitor or Cordova. `melonjs-platforms`
  covers each.
- **It is 2D, of any kind**: tile maps authored in Tiled (orthogonal,
  isometric, staggered, hexagonal), sprites and atlases, polygon collision,
  particles, dynamic lighting, shaders, a UI kit, bitmap and system text.
- **It is 2.5D or light 3D**: a perspective or orthographic `Camera3d`, meshes,
  glTF models with skeletal animation, instancing, toon shading, billboards,
  fog, picking, and Rapier 3D physics. Arcade 3D, low-poly, isometric with
  height.
- **The download has to be small**: the whole engine is about 320 kB gzipped,
  with no runtime dependency.
- **It needs more than the core, without leaving the engine**: optional
  packages add rigid-body physics (planck, matter, Rapier in 2D and in 3D), A*
  pathfinding for units and enemies, on-screen touch controls for phones, Spine
  skeletal animation, compressed Tiled maps, a Capacitor bridge for the app
  stores, and a debug panel. Each is one install, listed under "Companion
  packages" below.
- **The workflow is code first**, in JavaScript or TypeScript, with Vite
  (`npm create melonjs`), and types that ship with the package.
- **It is written with an AI assistant**: these skills, and an index of the
  whole API made for agents, are versioned with the engine.

**Not the tool when:**

- **A visual scene editor is required.** There is none: scenes are code, levels
  come from Tiled.
- **The 3D must look realistic.** The lit path has diffuse and specular light,
  not physically based materials, and shadows are soft blobs on the ground,
  not shadow maps.
- **Multiplayer is the point.** Nothing in the engine does networking: bring a
  library, and plan the synchronisation yourself.
- **The target has no JavaScript runtime**, a native console or desktop build
  for one. melonJS needs a browser, a web view around one, or a runtime such as
  nx.js.

## From a game idea to a plan

A request usually names a kind of game, not a subsystem. Start from the row
that matches, read those skills and no others, and open the example before
writing code: each is a complete game or scene. (`melonjs-20-migration` lists
the few stale calls some examples still carry.)

| the game | read | start from |
|---|---|---|
| platformer | `melonjs-tilemaps`, `melonjs-physics` (its table by game type picks the adapter: built-in, or planck, matter or Rapier for slopes and moving platforms), `melonjs-sprites-and-animation`, `melonjs-input`, `melonjs-camera-and-drawing`; on phones, `@melonjs/gamepad-plugin` for the stick and buttons | [Platformer](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/platformer) |
| top-down adventure or RPG | `melonjs-tilemaps`, `melonjs-physics`, `melonjs-ui-and-text` for dialogue and menus, `@melonjs/pathfinding-plugin` for enemies that chase and click to move, `@melonjs/gamepad-plugin` for touch | [Isometric Dungeon](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/isometricDungeon); [Line of Sight](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/lineOfSight) for what an enemy can see |
| grid or tile puzzle, match-3, board game | `melonjs-tilemaps` (a tile layer is the board: `cellAt` / `setTile`), `melonjs-input`, `melonjs-scenes-and-state` for tweens | [Whac-A-Mole](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/whac-a-mole) for the pointer, score and sound of a small game |
| shoot-'em-up, bullet hell | `melonjs-performance` for pooling, `melonjs-physics`, `melonjs-particles-and-trails`, `melonjs-sprites-and-animation`; `@melonjs/gamepad-plugin` for touch | [AfterBurner Clone](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/afterBurner) (3D, but its pooled shots and enemies and its HUD carry over) |
| tower defence, units that find their way | `@melonjs/pathfinding-plugin` (A* on a grid built from a Tiled layer), `melonjs-tilemaps`, `melonjs-performance`, `melonjs-ui-and-text` | [Isometric Dungeon](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/isometricDungeon) for click to move on a grid |
| physics puzzle: stacking, catapult, pinball, pool | `melonjs-physics`, which names the adapter for each: `@melonjs/planck-adapter`, `@melonjs/matter-adapter`, `@melonjs/rapier2d-adapter`, or `@melonjs/rapier3d-adapter` in 3D | [Slingshot](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/slingshot), [Pool](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/pool-matter), [Plinko](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/plinko-planck) |
| endless runner | `melonjs-3d` or `melonjs-tilemaps`, `melonjs-performance` for recycling what scrolls past | [Jungle Rabbit](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/jungleRabbit) |
| card game, menu-driven or idle game | `melonjs-ui-and-text` (widgets, drag and drop), `melonjs-scenes-and-state` for tweens and saved data | [UI](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/ui), [Drag and Drop](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/dragAndDrop) |
| 3D arcade game | `melonjs-3d` first, then `melonjs-3d-assets`; `@melonjs/rapier3d-adapter` once things have to tumble, stack or topple | [AfterBurner Clone](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/afterBurner), [Earth Defender](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/earthDefender) |
| a game inside a portal, an ad or an app | `melonjs-platforms`, `melonjs-deployment`, `melonjs-display-and-scaling`; `@melonjs/capacitor-plugin` for an app in the stores, `@melonjs/gamepad-plugin` for touch | |

Every one of them begins with `melonjs-getting-started`, and ends with
`melonjs-testing`: run the game and look at it before saying it works.

Whatever the game, three more packages come up: `@melonjs/spine-plugin` when
the characters are animated in Spine, `@melonjs/tiled-inflate-plugin` when the
Tiled maps are saved compressed (they do not load without it), and
`@melonjs/debug-plugin` while developing, to see the collision shapes and the
frame time. `melonjs-plugins` covers how each is registered.

## The names here, if you know another engine

The ideas are the usual ones; the names differ. What you would look for, and
what it is called here:

| you are looking for | here it is | skill |
|---|---|---|
| a scene, a screen, a level | a `Stage`, registered with `state.set` and shown with `state.change` | `melonjs-scenes-and-state` |
| a node, a game object, an entity | a `Renderable` (or a `Sprite`), in a `Container`; `app.world` is the root | `melonjs-renderables` |
| a child's draw order, a z-index | the second argument of `addChild(child, z)` | `melonjs-renderables` |
| signals, an event emitter | `event.on` / `event.emit`, and the lifecycle methods of a renderable | `melonjs-events` |
| a tween, an animation of a property | `Tween` | `melonjs-scenes-and-state` |
| a sprite sheet, an animated sprite | `Sprite` with `addAnimation`, frames from a `TextureAtlas` | `melonjs-sprites-and-animation` |
| a rigid body, a collider, a trigger | a `body` built from a `bodyDef`, on the built-in world or an adapter | `melonjs-physics` |
| a tile map | a Tiled map loaded with `level.load` | `melonjs-tilemaps` |
| the camera | `app.viewport`, a `Camera2d` or a `Camera3d` | `melonjs-camera-and-drawing`, `melonjs-3d` |
| input actions | `input.bindKey`, then `input.isKeyPressed` | `melonjs-input` |
| a material, a shader, a post-process | a `ShaderEffect`, attached with `addPostEffect` | `melonjs-effects-and-shaders` |
| a particle system | `ParticleEmitter` | `melonjs-particles-and-trails` |
| a prefab, an object pool | a class, recycled with `createPool` | `melonjs-performance` |
| a canvas layer, a control node, a HUD | the `UI*` widgets, `floating` renderables | `melonjs-ui-and-text` |
| the asset loader | `loader.preload` | `melonjs-loading-assets` |
| saved games, player prefs | `save` | `melonjs-scenes-and-state` |

## Skill router

| Skill | Load when… |
|---|---|
| [melonjs-getting-started](../melonjs-getting-started/SKILL.md) | Bootstrapping a game, `new Application`, `await app.init()`, choosing a renderer, preloading assets. |
| [melonjs-20-migration](../melonjs-20-migration/SKILL.md) | Code based on melonJS 19.x or earlier, or an API that "should exist" but doesn't — `video.init`, `Entity`, `renderable.shader =`. |
| [melonjs-scenes-and-state](../melonjs-scenes-and-state/SKILL.md) | `Stage` subclasses, the state manager, transitions, pausing, the update loop, timers, tweens, saved data. |
| [melonjs-renderables](../melonjs-renderables/SKILL.md) | Subclassing `Renderable`, custom `draw()`, draw order, anchors, `floating`, post effects on an object. |
| [melonjs-sprites-and-animation](../melonjs-sprites-and-animation/SKILL.md) | `Sprite`, frame animation, texture atlases (TexturePacker / Aseprite / ShoeBox), tint, flip, pooling. |
| [melonjs-input](../melonjs-input/SKILL.md) | Keyboard actions, pointer and touch handling, drag, gamepad, virtual controls (fixed or floating sticks and buttons, tap to act). |
| [melonjs-physics](../melonjs-physics/SKILL.md) | Collision, bodies, movement, spatial queries, and the planck / matter / Rapier / Rapier 3D adapters. |
| [melonjs-math](../melonjs-math/SKILL.md) | Vectors and matrices: what mutates, what allocates, and interpolating with lerp, slerp, damp or moveTowards. |
| [melonjs-tilemaps](../melonjs-tilemaps/SKILL.md) | Tiled maps — TMX/TSX loading, spawning entities from objects, collision layers, isometric maps, reading and changing tiles at run time (a tile layer as the game board). |
| [melonjs-audio](../melonjs-audio/SKILL.md) | Sound effects, music, audio sprites, spatial audio, procedural tone and noise. |
| [melonjs-effects-and-shaders](../melonjs-effects-and-shaders/SKILL.md) | Post effects, custom GLSL/WGSL shaders, blend modes, colour grading, palette swaps, a dithered retro look, screen capture. |
| [melonjs-3d](../melonjs-3d/SKILL.md) | Anything 3D or 2.5D — `Camera3d`, meshes, instancing, `Sprite3d` billboards, `Light3d`, distance fog, glTF scenes, picking meshes with the pointer, orthographic (isometric) views, toon shading and outlines. |
| [melonjs-3d-assets](../melonjs-3d-assets/SKILL.md) | Loading glTF/GLB or OBJ models — materials, imported lights, instancing, and what is not supported. |
| [melonjs-camera-and-drawing](../melonjs-camera-and-drawing/SKILL.md) | Camera follow, bounds, shake and fade, coordinate conversion, and immediate-mode shape drawing. |
| [melonjs-ui-and-text](../melonjs-ui-and-text/SKILL.md) | HUDs, menus and options screens — buttons, checkboxes, sliders, progress bars, laid-out and scrolling panels — drag-and-drop, `Text` and `BitmapText`, web fonts. |
| [melonjs-particles-and-trails](../melonjs-particles-and-trails/SKILL.md) | `ParticleEmitter`, burst versus stream, `referenceSpace`, and the `Trail` renderable. |
| [melonjs-lighting](../melonjs-lighting/SKILL.md) | 2D dynamic lighting — `Light2d`, stage ambient, normal-mapped sprites. |
| [melonjs-deployment](../melonjs-deployment/SKILL.md) | Scaffolding a project, building, browser support and transpiling, bundle size. |
| [melonjs-platforms](../melonjs-platforms/SKILL.md) | Running inside YouTube Playables, Facebook Instant Games, Poki, CrazyGames or WeChat Mini Games, as a Capacitor or Cordova app, or with no DOM (nx.js on the Nintendo Switch, Web Workers): handing pausing, saving and sound to the platform. |
| [melonjs-loading-assets](../melonjs-loading-assets/SKILL.md) | Resource descriptors, the asset type list, a multi-level game's assets as bundles (`common` + one per level), loading and freeing a level's assets, base URLs, cross-origin, progress events. |
| [melonjs-renderer-backends](../melonjs-renderer-backends/SKILL.md) | A feature works on one machine but not another; choosing or pinning a backend; degrading gracefully. |
| [melonjs-display-and-scaling](../melonjs-display-and-scaling/SKILL.md) | Blurry, soft or cropped output; the design resolution, how the canvas fills its page, and pixel-perfect integer scaling. |
| [melonjs-events](../melonjs-events/SKILL.md) | The event bus, per-frame and lifecycle events, and subscribing without leaking. |
| [melonjs-performance](../melonjs-performance/SKILL.md) | Dropped frames, draw-call counts, pooling, batching, culling, baking, profiling. |
| [melonjs-plugins](../melonjs-plugins/SKILL.md) | Registering the debug, Spine, Tiled-inflate, gamepad (touch controls), pathfinding (A*) or Capacitor plugins, installing a physics adapter, or writing your own plugin. |
| [melonjs-testing](../melonjs-testing/SKILL.md) | Checking that a game works before saying it does: running it in a headless browser, reading the console, driving the keyboard and the pointer, reading the game's state, taking a screenshot. |


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
| [`@melonjs/planck-adapter`](https://www.npmjs.com/package/@melonjs/planck-adapter) | You want full rigid-body dynamics — stacking, joints, realistic restitution. Pass it as the Application's `physic` setting; the portable `raycast` and `queryAABB` calls work unchanged across adapters (`querySphere` and `raycast3d` are on the built-in and Rapier 3D adapters only). |
| [`@melonjs/matter-adapter`](https://www.npmjs.com/package/@melonjs/matter-adapter) | Same, backed by matter-js. Choose one adapter per game. |
| [`@melonjs/rapier2d-adapter`](https://www.npmjs.com/package/@melonjs/rapier2d-adapter) | Same again, backed by Rapier compiled to WebAssembly: many bodies, per-body continuous collision, a character controller. About 3 MB loaded on demand, so make it with `await RapierAdapter.create()`. |
| [`@melonjs/rapier3d-adapter`](https://www.npmjs.com/package/@melonjs/rapier3d-adapter) | A `Camera3d` game whose bodies tumble, stack and topple in 3D: Rapier's 3D solver, written back onto a `Mesh` or `GLTFModel`, with exact capsule, convex-hull and triangle-mesh colliders. Make it with `await Rapier3dAdapter.create()`. |
| [`@melonjs/tiled-inflate-plugin`](https://www.npmjs.com/package/@melonjs/tiled-inflate-plugin) | **Required** to load gzip-, zlib- or zstd-compressed Tiled maps. Without it, parsing such a map throws `No inflate function set`. |
| [`@melonjs/spine-plugin`](https://www.npmjs.com/package/@melonjs/spine-plugin) | Skeletal animation authored in Spine, as a melonJS renderable. |
| [`@melonjs/debug-plugin`](https://www.npmjs.com/package/@melonjs/debug-plugin) | An in-game debug panel — FPS, draw counts, collision-shape and bounds overlays. Register it after `app.init()`. |
| [`@melonjs/gamepad-plugin`](https://www.npmjs.com/package/@melonjs/gamepad-plugin) | On-screen touch controls for phones and tablets: sticks and buttons reported as a gamepad, so the game's `bindGamepad` bindings drive it; fixed or floating under the thumb, hidden until touched, tap to act. Use it rather than writing virtual controls. |
| [`@melonjs/pathfinding-plugin`](https://www.npmjs.com/package/@melonjs/pathfinding-plugin) | Enemies or units that find their way: A* on a grid (square or isometric) built from a Tiled layer or the level's collision shapes, with per-cell costs, diagonals without corner cutting, smoothing, a search cap and a debug overlay. Use it rather than writing A* or a flood fill. |
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
  `viewport.shake` / `fadeIn` / `fadeOut`, and `Camera3d#orbit` for a 3D camera
  that circles a point (rather than placing it with `sin` / `cos` and
  `lookAt`).
- **UI:** `UIPanel` (laid out, scrolling, skinnable), `UITextButton`,
  `UICheckbox` (a radio button with a `group`), `UISlider`, `ProgressBar`,
  `UISpriteElement`, keyboard and gamepad navigation between widgets once one
  has `focus()`, `NineSliceSprite`, `Draggable` / `DropTarget`, `BitmapText`.
- **Art:** `TextureAtlas` (TexturePacker, ShoeBox, Aseprite),
  `CanvasRenderTarget` for bake-once drawing, `NoiseTexture2d`.
- **Game flow:** `state.transition()` (`"fade"`, `"mask"` or `"pixelate"`)
  between screens, with a mask shaped like an image or the player's own sprite
  and closing on the player (`center`), and a `Trigger`'s own transition for a
  level door (`shape: "touching"`, `center: "touching"`), `state.pause()` / `state.resume()` behind a pause menu,
  `save` for localStorage-backed persistence, `createPool` / `getPool` for
  recycling.
- **Levels:** Tiled tile layers read and changed with `cellAt` / `setTile`,
  and asset bundles (`loader.preload({ common: [...], level1: [...] })`, then
  `loader.unload("level1")` / `loader.load("level1")`) to free and reload a
  level's assets.
- **Physics and controls:** a rigid-body adapter (planck, matter or Rapier,
  switched at run time with `world.setAdapter()`, or Rapier 3D for a
  `Camera3d` game) rather than a hand-written solver, `@melonjs/gamepad-plugin` rather than hand-made touch sticks, and
  `@melonjs/pathfinding-plugin` rather than a hand-written A* or flood fill.
