# melonJS — agent instructions

> **This is a template for a game that *uses* melonJS, not instructions for
> working on the engine itself.** Copy it to your own project root:
>
> ```bash
> cp node_modules/melonjs/skills/AGENTS.md ./AGENTS.md
> ```
>
> Already have an `AGENTS.md`? Paste the sections below into it. Codex, Cursor,
> Gemini CLI and anything else following the `AGENTS.md` convention will read it
> from your project root. Claude Code users should install the plugin instead —
> `/plugin marketplace add melonjs/melonJS` — which registers the same guidance
> as 23 routed skills.

This project uses **melonJS 20.x**, an open-source 2.5D HTML5 game engine
running on WebGPU, WebGL 2 or Canvas with automatic fallback.

## Read these before writing engine code

Task-oriented guides ship with the package at `node_modules/melonjs/skills/`,
one directory per subsystem, each ending with a symptom → cause table.

**Start at `node_modules/melonjs/skills/melonjs/SKILL.md`** — it routes to the
right one for the task. Do not read all of them; read the router, then the one
or two it points at.

For anything the guides do not cover, fetch
<https://melonjs.github.io/melonJS/llms.txt> — an index of every exported class,
function and type with a one-line summary and a link to its reference page,
regenerated on every docs build. Deprecated entries are marked. Do not infer an
API from the shape of the engine; look it up.

## Three rules that produce code which runs and is wrong

1. **`await app.init()` is mandatory** since 20.0. The `Application` constructor
   builds the world but no renderer, so `addChild` silently succeeds while
   `new Sprite(...)` throws a `TypeError` that names neither the class nor the
   missing call.
2. **`addChild(child, z)` is the only way to set draw order.** `renderable.z`
   does not exist. Setting `depth` before `addChild` is overwritten by
   `autoDepth`; setting it after does not resort.
3. **`isKinematic` defaults to `true`**, which silently excludes a renderable
   from pointer events and from the physics broadphase. Plain `Renderable` and
   `Sprite` subclasses need `this.isKinematic = false` — attaching a `Body`
   sets it for you.

## Most melonJS bugs are silent, not fatal

The engine warns and degrades rather than throwing. A shader effect on the
Canvas fallback, a `Camera3d` without a GPU backend, a pooled object whose
`onResetEvent` forgets a property — all render *something*. When output looks
wrong rather than crashing, check the console for a one-shot warning and consult
the relevant skill's symptom table before debugging the game logic.

## Prefer built-in features

Before hand-rolling: `ParticleEmitter`, `Trail`, `Tween`, the built-in
`ShaderEffect` presets, `Light2d` / `Light3d`, `UIBaseElement` /
`UITextButton`, `NineSliceSprite`, `TextureAtlas`, `BitmapText`,
`CanvasRenderTarget` for bake-once drawing, `viewport.shake` / `fadeIn` /
`fadeOut`, and `save` for persistence.

Companion packages cover the rest: `@melonjs/planck-adapter` and
`@melonjs/matter-adapter` (physics), `@melonjs/spine-plugin` (skeletal
animation), `@melonjs/tiled-inflate-plugin` (**required** for compressed Tiled
maps), `@melonjs/debug-plugin`, `@melonjs/capacitor-plugin`.
