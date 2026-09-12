---
name: melonjs-effects-and-shaders
description: "Use this skill for post-processing effects, custom shaders, blend modes and colour grading in melonJS. Covers the built-in ShaderEffect presets, addPostEffect on renderables and cameras, writing a custom dual-language GLSL/WGSL effect, the screen_texture builtins, and why effects silently do nothing on the Canvas fallback. Triggers on: ShaderEffect, addPostEffect, removePostEffect, getPostEffect, VignetteEffect, GlowEffect, BlurEffect, PixelateEffect, ScanlineEffect, shader, GLSL, WGSL, uniform, setUniform, setTexture, setTime, blendMode, colorMatrix, screen_texture, toFrameTexture, post effect, filter."
license: MIT
---

# Post effects and custom shaders

> melonJS ships a catalogue of post effects and a dual-language shader system.
> The recurring trap is that every shader path needs a GPU backend and
> **degrades to nothing** on Canvas rather than erroring. Blend modes are the
> exception — those work on all three renderers.

## Applying an effect

Effects attach to a renderable **or** to a camera (for full-screen grading):

```js
import { VignetteEffect, GlowEffect } from "melonjs";

sprite.addPostEffect(new GlowEffect(app.renderer));
app.viewport.addPostEffect(new VignetteEffect(app.renderer));
```

`renderable.shader = …` is **deprecated since 19.2.0**, and its setter destroys
whatever it replaces. Use `addPostEffect` / `getPostEffect` / `removePostEffect`.

## Toggle with `enabled`, do not remove

**`removePostEffect()` destroys the effect** — it calls `effect.destroy()` and
frees GPU resources, so the instance cannot be re-added. Same for
`clearPostEffects()` and for reassigning the deprecated `.shader`.

```js
// ✗ destroys it; re-adding later fails or forces a recompile
sprite.removePostEffect(effect);

// ✓
effect.enabled = false;
```

An effect with `effect.shared === true` opts out of auto-destroy because it is
reused across renderables.

## Built-in effects

Eighteen presets, every one constructed as `new XEffect(renderer, options)` and
every one shipping both a GLSL and a WGSL body, so they all run on either GPU
backend: `VignetteEffect`, `ScanlineEffect` (optional CRT curvature),
`GlowEffect`, `BlurEffect`, `PixelateEffect`, `ChromaticAberrationEffect`,
`DropShadowEffect`, `FlashEffect`, `OutlineEffect`, `ColorMatrixEffect`,
`DesaturateEffect`, `DissolveEffect`, `TintPulseEffect`, `WaveEffect`,
`InvertEffect`, `SepiaEffect`, `HologramEffect`, `ShineEffect`.

For grading without writing a shader yourself, the camera has a colour matrix:

```js
app.viewport.colorMatrix.contrast(1.1).saturate(1.1);
```

It is still *implemented* as one: a non-identity matrix makes the camera append
an internal `ColorMatrixEffect` to its post-effect chain for that frame, so it
needs a GPU backend like everything else here.

## Custom effects are dual-language

A custom `ShaderEffect` supplies a fragment **body**, not a whole program. To run
on both GPU backends it needs GLSL *and* WGSL — a GLSL-only effect silently does
nothing when `video.AUTO` lands on WebGPU.

```js
const effect = new ShaderEffect(app.renderer, { glsl, wgsl });
effect.setUniform("uStrength", 0.5);
effect.setTexture("uScene", tex);
effect.setTime(timer.getTime() / 1000);   // setTime takes SECONDS; getTime is ms
```

Uniform names are shared across the two bodies — in WGSL they are the members of
one `@group(3) @binding(0) var<uniform>` struct — so a single `setUniform` call
feeds whichever backend is live. `setTime` is a convenience for a `uTime`
uniform and silently does nothing if the shader does not declare one.

### One effect is one program — prefer preloading, and share

A `ShaderEffect` compiles and links in its **constructor**, and the link is
checked with `getProgramParameter(LINK_STATUS)` straight after `linkProgram` —
a blocking call. So the cost is paid on whatever frame the effect is
constructed, and *n* identical effects cost it *n* times. `clone()` does not
avoid it: it constructs a new effect and links a new program.

Preload it instead. Loader type `"shader"` takes a `src` **or inline source via
`data`**, compiles at load time (inside the loading screen), and hands back a
**shared** instance:

```js
loader.preload([{ name: "ramp", type: "shader", data: myFragmentBody }]);
// …then, for every label that wants it:
label.addPostEffect(loader.getShader("ramp"));
```

Sharing one instance across renderables is safe *because* the loader sets
`effect.shared`. Without that flag a renderable's teardown destroys its post
effects, which would free the program out from under everything else still
using it. Uniforms live on the effect, so a shared instance means one set of
uniform values — fine when the look is uniform, and the reason to clone (and
pay a link) when it is not.

Note this covers **your** effects only. The engine's own mesh/quad shader
variants are compiled lazily per feature combination on first draw and cannot be
preloaded — see `melonjs-loading-assets` for the warm-up that covers those.

### Screen-reading builtins

For refraction, distortion and anything that samples what is already drawn:

- **`screen_texture`** — a sampler kept filled with everything drawn so far
  (GLSL: annotate the sampler `uniform sampler2D tex : screen_texture;`)
- **`screen_uv`** — this fragment's 0..1 position in that capture
- **`noise_uv`** — 0..1 across the sprite regardless of its atlas frame

In WGSL the capture is sampled through `screen_sampler` (clamped) or
`screen_sampler_repeat` (wrapping) instead of GLSL's `: screen_texture`
annotation. `screen_uv` is y-**up** in GLSL and y-**down** in WGSL, which exactly
matches each backend's own capture orientation — so a body that samples
`screen_texture` at `screen_uv` needs no flip in *either* language.

Two places where a straight port really does differ:

- **A capture you bind yourself.** `renderer.toFrameTexture()` grabs the frame
  into a `Texture2d` you hand to `setTexture` — the supported replacement for
  `readPixels` tricks. The GL capture is bottom-up (GLSL bodies sample it with
  `1.0 - uv.y`) and opaque RGB; the WebGPU capture is top-down (the WGSL twin
  must *not* flip) and preserves alpha.
- **Vertical UV offsets** — a drop shadow, a directional smear. The WebGL pooled
  multi-effect path composites through bottom-up FBOs, so declare a `uUVYDir`
  uniform (initialise it to `1.0`) and multiply vertical offsets by it; the
  renderer feeds `-1` on that path and `+1` everywhere else.

## A ShaderEffect cannot shade a mesh on WebGPU

The single-effect fast path swaps the renderable's program outright instead of
rendering through an offscreen target. On WebGL that works for a `Mesh` too, so
a custom mesh shader is a `ShaderEffect` away. **On WebGPU it does not** — the
renderer says so in its own source, warns once, and then keeps the built-in
mesh shading.

Nothing throws. The mesh simply draws with its plain texture, which looks like
a broken shader, a bad binding, or a texture that failed to load — and since
`video.AUTO` prefers WebGPU where it is available, this is the default outcome
on most desktops. It cost several hours here: the symptom was a water surface
rendering flat white, and alpha, bindings, transparency and lighting were all
eliminated before the backend was.

2D renderables are unaffected: `Sprite`, `Text` and the rest go through the
quad path, which hosts effects on both backends. So a gradient fill for text,
or a refraction over a sprite, is fine — it is specifically the mesh path.

If you need a genuinely custom mesh shader that runs everywhere, supply a full
dual-language `GLShader` rather than a fragment body, and declare the fog
uniforms yourself (see `melonjs-3d`).

## Extra textures bind in setTexture order

`setTexture("uFoo", …)` assigns bindings **1 and 2** to the first extra
texture, **3 and 4** to the second, and so on. The WGSL must match:

```wgsl
@group(3) @binding(1) var uFoo : texture_2d<f32>;
@group(3) @binding(2) var uFooSampler : sampler;
```

Copying a two-texture effect and deleting one leaves the survivor declared at
3/4 while it is bound at 1/2 — the program fails to build and the effect is
silently dropped.

## Blend modes

Fourteen modes; thirteen of them are honoured by all three renderers:

```js
sprite.blendMode = "additive";   // or "multiply", "screen", "overlay", …
```

Six ride fixed-function blend state and cost nothing extra: `normal`,
`additive` (spelled `add` or `lighter` too), `multiply`, `screen`, `exclusion`,
and `none` (blending off — the source replaces the destination, alpha included).
`none` is the one mode the Canvas backend does not implement; it reports
`"normal"` instead.

The other eight cannot be expressed as a multiply-add on the destination, so the
GPU backends capture the destination and composite through `BlendEffect` — one
capture plus one composite **per draw**: `difference`, `overlay`, `hard-light`,
`color-dodge`, `color-burn`, `soft-light`, `darken`, `lighten`. Right for
accents; expensive for hundreds of objects. The Canvas renderer reaches all
eight through `globalCompositeOperation` instead, at no extra cost.

Anything else collapses to `"normal"`, and so do 3D meshes and `Gradient` fills
whatever you ask for — the latter with a one-time console warning.
`renderer.setBlendMode(mode)` returns the mode it actually applied, so comparing
that against your request detects the fallback.

## The Canvas fallback

`ShaderEffect` on a Canvas renderer logs a warning, leaves `enabled = false`, and
turns every method into a no-op. Nothing throws. The same happens on a GPU
backend when no body matches its language — a GLSL-only effect under WebGPU.

That is fine for decoration. It is **not** fine when the shader draws your
content — the carrier renderable then shows through raw. A 1×1 white texture
stretched to 280×156 renders as a white box where the effect should be.

Guard when the effect is load-bearing:

```js
if (app.renderer.shaderLanguage === null) {
    // no programmable pipeline — skip the carrier draw entirely
}
```

`shaderLanguage` (`"glsl"`, `"wgsl"`, or `null`) is the flag to test here rather
than a backend name or `supportsDepthBuffer`: it answers "can this renderer
compile what I am about to hand it". Per-effect, `effect.enabled` answers the
same question after construction.

## Symptom → cause

| symptom | cause |
|---|---|
| effect does nothing, warning in console | Canvas fallback — no programmable pipeline |
| effect does nothing on some machines only | GLSL-only shader, `video.AUTO` chose WebGPU |
| a white or solid box where the effect should be | carrier renderable drawn while the effect is disabled |
| effect cannot be re-enabled | `removePostEffect()` destroyed it — use `enabled` |
| ported shader renders upside down | a hand-bound `toFrameTexture()` capture — GL is bottom-up, WebGPU top-down |
| shadow/smear offset flips on some draws | vertical UV offset not multiplied by `uUVYDir` |
| frame rate collapses with many blended sprites | an *advanced* mode (overlay, darken, …) — each draw is a capture plus a composite |
| animated shader never moves | `setTime` fed milliseconds, or the shader declares no `uTime` |

## Related skills

- `melonjs-renderables` — where post effects attach, and the destroy trap
- `melonjs-3d` — the GPU-backend requirement, and why a custom mesh shader is
  not affected by the camera's distance fog
