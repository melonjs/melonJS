---
name: melonjs-renderer-backends
description: "Use this skill when a feature works on one machine and not another, when choosing or pinning a renderer, or when writing code that must degrade gracefully. Covers the WebGPU to WebGL 2 to Canvas fallback ladder, what each backend supports, capability detection, and the subsystems that warn once and then stop working on Canvas. Triggers on: video.AUTO, video.WEBGPU, video.WEBGL, video.CANVAS, renderer.type, supportsDepthBuffer, shaderLanguage, WebGPU, WebGL2, Canvas fallback, context loss, backend, works on my machine."
license: MIT
---

# Renderer backends and graceful degradation

> `video.AUTO` picks a backend at **runtime**. The same code runs on a different
> renderer depending on the machine, and several subsystems degrade to nothing
> rather than erroring. This is the root cause of most "works on my machine"
> reports.

## The ladder

`video.AUTO` (the default) tries **WebGPU → WebGL 2 → Canvas** and uses the first
that initialises.

```js
const app = new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,     // or video.WEBGPU / video.WEBGL / video.CANVAS
});
await app.init();
```

WebGL 1 is not in the ladder — 20.x made WebGL 2 the baseline, and pinning
`video.WEBGL` **rejects** on a WebGL-1-only device rather than degrading.

## What each backend can do

| | WebGPU | WebGL 2 | Canvas |
|---|---|---|---|
| sprites, tilemaps, text | ✅ | ✅ | ✅ |
| blend modes | ✅ | ✅ | ✅ except `"none"` |
| shaders and post effects | ✅ | ✅ | ❌ inert |
| `Light2d` glow (`drawLight`) | ✅ | ✅ | ✅ cached radial gradient |
| normal-map lighting, `Light3d` | ✅ | ✅ | ❌ inert |
| `Mesh` | ✅ | ✅ | ⚠️ CPU-projected, no depth |
| `Camera3d` / depth sorting | ✅ | ✅ | ❌ warns, renders wrong |
| `InstancedMesh` | ✅ | ✅ | ⚠️ one draw per instance |
| GPU tilemap rendering | ✅ | ✅ | ❌ per-tile CPU path |

The Canvas column is the problem: none of it throws. Each of those paths warns
once and then degrades or no-ops, so the game runs and looks wrong.

Two Canvas rows are worth spelling out because they are easy to misread as total
failures. A `Light2d` still *draws* — the Canvas renderer bakes a radial gradient
per light and blits it — what disappears is per-pixel normal-map shading, which
warns once (`Light2d normal-map lighting requires the WebGL renderer`) and then
renders sprites unlit. A `Mesh` still draws too, sorted with the painter's
algorithm and no depth buffer, so convex models look right and anything
self-overlapping does not. `"none"` (replace, alpha included) is the one blend
mode Canvas cannot express — there is no `globalCompositeOperation` that
disables blending for the drawn area alone — so it resolves to `"normal"`, and
`setBlendMode` reports that back.

## Detecting what you have

```js
app.renderer.type;                    // "WebGPU" | "WebGL2" | "CANVAS"
app.renderer.supportsDepthBuffer;     // the practical "is this a GPU backend" test
app.renderer.shaderLanguage;          // "wgsl" | "glsl" | null (null on Canvas)
```

There are narrower flags for the features that do not travel together:
`supportsShaderTileLayers`, `supportsRetainedMesh` and `supportsInstancing` —
all three `false` on Canvas, `true` on both GPU backends. Prefer a capability
flag over comparing `type` against a string; `type` is an identity check for
code coupled to one backend's machinery.

For a scene that genuinely requires a GPU backend, fail loudly rather than
rendering something broken:

```js
await app.init();
if (!app.renderer.supportsDepthBuffer) {
    throw new Error("this game needs WebGL 2 or WebGPU");
}
```

## Writing code that degrades well

**Decorative effects** — let them no-op. A missing vignette is fine.

**Load-bearing effects** — guard the carrier. If a shader draws your content
rather than decorating it, the carrier renderable shows through raw when the
effect is disabled: a 1×1 white texture stretched to fill a quad renders as a
white box exactly where the effect should have been.

```js
if (effect.enabled) {
    // draw the carrier the shader consumes
}
```

**Dual-language shaders** — a `ShaderEffect` compiles the body matching
`renderer.shaderLanguage`. With no matching body — a GLSL-only effect on WebGPU,
any effect on Canvas — the constructor warns once, leaves `enabled === false`,
and every method becomes a no-op. Pass `{ glsl, wgsl }` rather than a bare
string, or gate on `renderer.shaderLanguage`.

## Pinning a backend

Pin only with a reason. `video.WEBGL` costs you the WebGPU path *and* the Canvas
fallback, so a WebGL-1-only device gets nothing at all.

Legitimate reasons: reproducing a backend-specific bug, a benchmark, or a known
driver issue in the field.

For one-off testing you do not need to touch the settings at all: the URI
fragments `#webgpu`, `#webgl` (or `#webgl2`) and `#canvas` override the
`renderer` setting for that run, and behave exactly like passing the matching
constant — `#webgl` on a WebGL-1-only device rejects rather than falling back.

## Context loss

A GPU context can be lost at any time — tab backgrounding, driver reset, memory
pressure. melonJS handles restoration on both GPU backends: WebGL recompiles
every live `GLShader` and replays its uniform snapshot, WebGPU renegotiates a
device and rebuilds its batchers, and both then emit
`event.ONCONTEXT_RESTORED` (the paired loss event is `event.ONCONTEXT_LOST`).

What you must handle is your own GPU-side state. If you cached a raw texture or
program handle, re-acquire it on restore rather than holding the stale one:

```js
import { event } from "melonjs";

event.on(event.ONCONTEXT_RESTORED, (renderer) => {
    // re-acquire anything you were holding by raw handle
});
```

## Practical differences

- **Frame capture orientation differs**: row 0 of a `toFrameTexture()` capture is
  the bottom of the frame under WebGL and the *top* under WebGPU, so a GLSL body
  that flips with `1.0 - uv.y` must not do so in its WGSL twin. The WebGPU
  capture also preserves alpha, where the WebGL one captures into an opaque RGB
  texture.
- **The advanced blend modes cost far more than they look.** `overlay`,
  `difference`, `hard-light`, `soft-light`, `color-dodge`, `color-burn`,
  `darken` and `lighten` cannot be expressed as fixed-function blending, so on
  both GPU backends each such draw is bracketed individually: capture the
  destination, redraw offscreen, composite through `BlendEffect`. Fine for
  accents, ruinous for hundreds of objects. `normal`, `additive`, `multiply`,
  `screen` and `exclusion` are ordinary fixed-function state and cost nothing
  extra.
- **3D meshes do not honour blend modes.** The mesh pass draws with its own
  depth/blend state; asking for one of the advanced modes logs a one-time
  `blend mode "…" is not supported for 3D meshes` warning and falls back to
  `"normal"`. Gradient fills warn the same way.

## Symptom → cause

| symptom | cause |
|---|---|
| effect works locally, not for a user | they got the Canvas fallback, or a different GPU backend |
| sprites render unlit though lights are in the scene | Canvas fallback — normal-map shading is inert (check the console) |
| mesh looks inside-out where it overlaps itself | Canvas fallback — painter's algorithm, no depth buffer |
| shader works on one machine only | GLSL-only effect, AUTO chose WebGPU elsewhere — the console carries the warning |
| a solid box where an effect should be | carrier drawn while the effect is disabled |
| nothing renders at all on an old device | `video.WEBGL` pinned; WebGL 1 is rejected, not downgraded |
| ported shader is vertically flipped | the WebGL capture is bottom-up, the WebGPU one top-down |
| a blended mode is ignored on a mesh | meshes fall back to `"normal"`; look for the one-time warning |
| textures vanish after the tab is restored | cached raw GPU handles not re-acquired on context restore |

## Related skills

- `melonjs-getting-started` — renderer selection in the Application settings
- `melonjs-effects-and-shaders` — dual-language shaders and the Canvas no-op
- `melonjs-3d` — the tier that requires a GPU backend outright
