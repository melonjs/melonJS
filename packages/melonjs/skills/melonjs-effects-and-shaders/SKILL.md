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

### A camera effect covers the HUD too

A camera's post-effect brackets the **entire** world draw — floating children
included. So the obvious way to write a full-screen pass also washes over every
HUD label in that world, which is rarely what you want.

To land a pass *after* the world but *before* the HUD, host the effect on a
screen-filling floating renderable ordered below the HUD's z instead:

```js
const quad = new Sprite(0, 0, { image: anyImage });
quad.anchorPoint.set(0, 0);
quad.scale(viewW / anyImage.width, viewH / anyImage.height);
quad.floating = true;                 // its own uv is now screen space
quad.blendMode = "additive";
quad.addPostEffect(myEffect);
world.addChild(quad, HUD_Z - 10);     // 2D: below the labels. See the note.
```

Two things follow from the quad filling the frame: its own `uv` is screen space
(so a pass like this needs none of the `screen_uv` / `screen_texture` builtins),
and the incoming `color` is the quad's own texture, which a body that paints
from scratch can ignore entirely.

**Depth here is easy to get backwards, and the rule FLIPS between the two sort
modes.** Under the default `sortOn = "z"` a higher z draws later, i.e. on top,
so `HUD_Z - 10` puts the pass under the labels as written above. Under
`sortOn = "depth"`, which every `Camera3d` scene sets, a floating child's sort
key is `pos.z * pos.z` and the walk paints far to near, so the SMALLER
magnitude is nearer and draws on top — `HUD_Z - 10` there puts the pass OVER
the labels, the opposite of the comment.

So in a 3D scene give the overlay a larger magnitude than the HUD, and give
the HUD a small one (`melonjs-3d` and `melonjs-ui-and-text` both say a HUD
wants a small depth, not the huge z that would put it on top in 2D).

Either way, verify it rather than reasoning about it: return a flat colour from
the body for one frame and see what it tints.

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

Twenty-one presets, every one constructed as `new XEffect(renderer, options)` and
every one shipping both a GLSL and a WGSL body, so they all run on either GPU
backend: `VignetteEffect`, `ScanlineEffect` (optional CRT curvature),
`BloomEffect`, `GlowEffect`, `BlurEffect`, `PixelateEffect`,
`ChromaticAberrationEffect`, `DropShadowEffect`, `FlashEffect`,
`OutlineEffect`, `ColorMatrixEffect`, `DesaturateEffect`, `DissolveEffect`,
`TintPulseEffect`, `WaveEffect`, `InvertEffect`, `SepiaEffect`,
`HologramEffect`, `ShineEffect`, `RadialGradientEffect`, `ToneMappingEffect`.

`RadialGradientEffect` is a procedural soft spot: solid at the centre of its
host quad, fading linearly to transparent at the edge, and elliptical for free
on a non-square quad. It is the one to reach for instead of baking a disc into
a canvas, for a pickup highlight, a trigger marker or a damage flash. Its
falloff assumes the quad samples a FULL texture rect, so pair it with a
standalone image or `Renderer.getWhitePixel()` rather than a sprite that draws
a sub-region of an atlas, where the centre would land off-quad.

**`BloomEffect` and `GlowEffect` are not the same thing**, and reaching for the
wrong one is the usual disappointment here. `GlowEffect` draws a halo OUTSIDE a
sprite's silhouette: its body returns the colour untouched wherever alpha is
already non-zero, so on an opaque frame it returns early on every fragment and
a camera-wide glow does nothing at all. `BloomEffect` is the screen bloom —
bright pixels bleed into their neighbours — and it is the one to put on the
camera:

```js
game.viewport.addPostEffect(new BloomEffect(app.renderer));
// only the brightest highlights, with a wider halo
game.viewport.addPostEffect(
    new BloomEffect(app.renderer, { threshold: 0.85, radius: 4 }),
);
```

Its tap offsets are in texels, so it takes its size from the renderer at
construction; call `setTextureSize(w, h)` from an `event.ONRESIZE` handler, or
when applying it to something smaller than the frame.

**`ToneMappingEffect` goes after it, and goes last.** Bloom spreads the bright
parts; the tone map is what stops the sum of the two clipping flat at white,
which is the difference between an effect that reads as light and one that
reads as a white sticker. `exposure` lifts the image into the curve, and the
curve (`aces`, `reinhard` or `exponential`) is baked at construction:

```js
game.viewport.addPostEffect(new BloomEffect(app.renderer));
game.viewport.addPostEffect(
    new ToneMappingEffect(app.renderer, { exposure: 1.6 }),
);
```

It is a grade, not a colour pipeline. By default melonJS renders into `RGBA8`
everywhere, so the frame reaching it is already clamped and `exposure` past 1
is what gives the curve range to compress.

**`hdr: true` in the application settings changes that**: render targets
become half-float, so the chain carries values above 1 instead of clamping at
every write, and the bloom threshold starts discriminating genuinely
over-bright pixels rather than merely bright ones. Off by default: it costs
GPU memory on the camera's two render targets and depends on the driver.

On its own it is **not HDR output**: the frame is still presented in SDR, so
anything above 1 clamps on the final blit. What it buys is that nothing clamped
BEFORE then. Removing that last clamp is a second, separate opt-in —
`hdrOutput`, below — and it is WebGPU-only.

```js
const app = new Application(1024, 576, { hdr: true, … });
// …and check what you actually got, since a driver can refuse it
if (app.renderer.supportsHDR) { /* the chain now carries values above 1 */ }
```

Branch the GRADE on that flag, not just the feature. An exposure under 1 and a
bloom threshold at 1 make sense only where values above 1 exist; applied to a
chain that clamps, the same numbers tone map an already display-referred frame
and switch the bloom off, which reads as a dark, flat picture rather than as a
missing feature. Where there is no headroom, squeeze each emitter into range in
its own shader instead and put the bloom threshold back under 1.

**Nothing is added to your chain.** `hdr` is additive: the same frame, plus
additive content that no longer saturates per write and a threshold that means
something. Anything still above 1 at the end clamps on the blit, as it always
did.

A tone map is therefore a decision, not a consequence, and it is a bigger one
than it looks. Every curve maps 1 to less than 1, so a 2D look built ON the
clamp — clipped white specular, saturated neon — goes matte the moment you add
one, at any exposure. Add one when your art is authored in linear light and you
want the highlights rolled off; skip it when the clipping IS the look.

It applies to the CAMERA chain only. A sprite's chain keeps 8-bit targets on
purpose: its final blit composites with `ONE_MINUS_SRC_ALPHA`, and additive
blending accumulates alpha past 1 in a float target, so that factor would go
negative and subtract the backdrop.

### Once it is on: putting values above 1 into the frame

`hdr: true` on its own changes nothing visible. It removes a ceiling; something
still has to reach for it. No single draw exceeds 1 on its own, so a game that
turns the setting on and changes nothing else renders very nearly the frame it
did before and looks like the feature is broken. The exception is worth knowing
because it is free: additive content that already overlapped was being clipped
at every write, and stops being.

What produces over-bright pixels:

```js
// a built-in colour matrix, scaled past 1 — no custom shader needed
sprite.addPostEffect(new ColorMatrixEffect(app.renderer).brightness(4));

// in 3D, both of these were always unbounded; the 8-bit target was the only
// thing destroying the range. `emissive` is a 3-component Float32Array, set
// from the mesh settings or replaced wholesale — it is not a Color
const mesh = new Mesh(x, y, { emissive: [2.5, 1.8, 0.4], /* … */ });
light.intensity = 3;

// and additive blending, which accumulates past 1 once the target can hold it
sprite.blendMode = "additive";
```

**One effect, not two.** A renderable carrying exactly ONE post effect takes
the renderer's `customShader` fast path: no offscreen target, and it draws
straight into the camera's half-float target with its range intact. A chain of
two or more is routed through a pooled intermediate that stays 8 bits per
channel on purpose, so the energy is clamped there, before the camera ever sees
it. Adding a second effect to an emitter is enough to silently undo its
headroom.

### Everything inside the camera is graded, including your UI

The tone curve runs on the camera's whole frame. A `floating` HUD is still
inside it, so a label authored at display white arrives at the curve as 1 and
leaves at `1 - exp(-exposure)` — at exposure 0.45 that is 0.36, and the HUD
comes out at roughly a third of its brightness for no reason the author can
see.

UI in an HDR chain has to be authored for that chain, exactly as the scene is:

```js
// drive the readout so the curve lands it back at display white. `shared`
// keeps one instance across every element: it opts the effect out of the
// per-renderable auto-destroy, so the first element torn down does not take
// the program the others are still using
const energy = new ColorMatrixEffect(app.renderer).brightness(2);
energy.shared = true;
for (const element of hudElements) element.addPostEffect(energy);
```

Put it on each ELEMENT, not on their container: `beginPostEffect` clears
`customShader` for any renderable with no effects of its own, so a container's
shader is thrown away by its first child. The alternative is to keep the UI out
of the camera pass entirely, by overriding `Stage.draw` and drawing it after
`super.draw(...)` — at the cost of the bloom that makes additive UI glow.

The quad trick under *A camera effect covers the HUD too* does not help here.
It works by hosting a pass BELOW the HUD's z, and a tone map cannot live there:
it has to be the last thing before the blit to the 8-bit canvas, which is the
camera. Anything the camera draws goes through it.

Pick the multiplier by measuring against the no-headroom build, not by
inverting the curve. Inverting it over-estimates, because additive UI is inside
the BLOOM too and driving it harder also makes it spill wider into the same
pixels.

### `hdrOutput`: actually presenting in HDR, and what it costs you

`hdr` gives the chain headroom and then throws it away at the very last step,
because the surface the browser presents into is 8 bits per channel. Values
above 1 clamp there, exactly as they did before the setting existed.
`hdrOutput` changes that surface, so they reach the compositor instead:

```js
const app = new Application(1024, 576, { hdr: true, hdrOutput: true, … });
if (app.renderer.supportsHDROutput) { /* the display is getting values above 1 */ }

app.renderer.setHDROutput(false);   // and at runtime, for a settings screen
```

**It is WebGPU-only, and that is not a melonJS limitation.** The WebGPU
specification defines a tone mapping mode on the canvas configuration, and two
engines ship it. The WebGL2 equivalent needs a drawing-buffer tone mapping mode
that is still an unapproved specification change with no implementation in any
browser; the colour-space half of it exists in Chrome behind
`--enable-experimental-web-platform-features`, which is not something you can
ask a player to enable. So the WebGL2 backend reports `false`, warns once if
you asked, and presents in SDR as it always has.

That makes this the first setting where **the same machine answers differently
depending on which backend `video.AUTO` picked**. Branch on
`renderer.supportsHDROutput`, never on the setting.

**It requires `hdr`** — the last pass blits from the camera's target, so if
that target is 8 bits there is nothing above 1 left to present and the extra
cost would buy an identical picture. Turning `hdr` off turns this off with it.

**It changes how your game looks, on an HDR display.** Everything else here is
careful not to: `hdr` is additive, the tone curve defaults to none. This one
removes the final clamp, so anything you drove above 1 — an additive stack, an
emitter, a `brightness()` above 1 — gets genuinely brighter rather than
saturating at white. That is the point of it, and it is why it is a separate
opt-in rather than part of `hdr`. Two consequences worth planning for:

- a look built on clipped whites will not survive it unchanged, because the
  clipping is what you were art-directing against
- a tone curve and `hdrOutput` pull in opposite directions. A curve exists to
  fit values into `[0, 1]`; if you have removed the clamp, either drop the
  curve or give it a white point high enough to leave the top of the range
  alone
- **`"aces"` cannot produce HDR output.** Its expression clamps to `[0, 1]`
  internally, so everything past the shoulder collapses to one value before
  the white point scales it — different bright things come out equally bright.
  Under `hdrOutput` use `"reinhard"` or `"exponential"`, which approach 1
  asymptotically without clamping and so keep their ordering when the white
  point lifts them past it, or use no curve at all

**What it is not.** It does not make an SDR display brighter, and there is no
way to ask melonJS how bright the panel is — `matchMedia("(dynamic-range:
high)")` is the closest the platform gets. Calibrating in nits, the way a
console settings screen does, is not reachable from the web platform today.

### Exposure, and the runtime toggle

Under `hdr` the useful exposure is often **below** 1, which surprises people who
have only used the effect as an LDR grade. The curve has to work where it
separates: at exposure 1 the ACES shoulder maps 2, 4 and 8 to 0.86, 0.96 and
0.99, so genuinely different energies all arrive at white and the headroom buys
nothing you can see. Lower exposure spreads them out. The right value is a
property of how bright your scene is authored, so measure it; there is no
default that is right for two different games.

A tone curve is a setting rather than an effect you wire up:

```js
renderer.setToneMapping("aces", { exposure: 0.4, white: 6 });
renderer.setToneMapping("none");                       // and off again
```

`"none"` by default. The renderer keeps the curve LAST on the camera, so
whatever you put in front of it is mapped along with everything else. Changing
the mode rebuilds one shader (the curve is baked); `exposure` and `white` are
uniform writes, so a settings screen can drive them live. `white` is the value
that comes out as display white — the knob a "brightness" or "peak" slider
wants, since exposure alone drags the midtones up with the highlights.

`renderer.setHDR(enable)` moves the whole pipeline at runtime, the way
`setAntiAlias` does, for a settings toggle. It empties the render-target pool
when the format actually changes, so it is not something to drive per frame.
The boot header reports what happened either way:

```
resolution: requested 1024x576 (HDR), got 1024x576 (SDR)   ← the driver refused
```

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

**Never put a backtick in a shader body, including in its comments.** An inline
body is a JavaScript template literal, so a backtick ENDS it — and what follows
is parsed as code, which fails somewhere further down the file with an error
that says nothing about shaders:

```js
const glsl = `
// x * x, not `pow(x, 2.0)`: the base goes negative here   <-- ends the literal
vec4 apply(vec4 color, vec2 uv) { ... }
`;
```

Markdown-quoting an identifier is a reflex when writing a comment, and this is
the one place it breaks the file. Write `pow(x, 2.0)` bare. A body loaded from
a `.glsl` / `.wgsl` file has no such problem, which is one more reason to move
a shader out once it stops being a sketch.

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

### Declare a level's effects with that level's assets

An effect the loader knows about can be prepared before anything draws it; an
effect built inline cannot, because it does not exist until the code that
constructs it runs — which is the stage or level you were hoping to speed up.
That is the practical reason to prefer the asset form even when the source is a
string in your own module:

```js
// with the level's other assets, not in the stage that uses them.
// `preload()` rather than `load()` — preload is what warms the shaders it
// brought in, and it can be called again per level, not just at boot
await loader.preload([
    { name: "ripples", type: "shader", src: {
        glsl: "assets/level2/ripples.glsl",
        wgsl: "assets/level2/ripples.wgsl",
    }},
    // …that level's textures, maps and audio alongside it
], undefined, false);   // `false`: stay on this stage, no loading screen
```

`src` takes the dual-language pair, so one asset carries both realizations and
the two backends cannot drift apart. `data` takes inline source the same way.

With `prewarm` on (the default since 20.6), `loader.preload()` warms on its way
through — automatically, on every call — and compiles the GPU-side objects for
every shader it holds — on WebGPU that is the
WGSL module, which is otherwise built inside the draw path the first time the
effect is used. Effects constructed inline are not in the loader, so nothing can
bring them forward.

One caveat if you are moving an inline effect to a file: a template literal can
interpolate constants into the source (`vec2(${ASPECT}, 1.0)`), and a static
file cannot. Promote those to uniforms rather than duplicating the numbers
across the GLSL and WGSL copies — duplicated constants are exactly how the two
backends drift.

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

## A ShaderEffect on a mesh is a colour hook, and drops some builtins

`mesh.addPostEffect(fx)` shades a `Mesh` on **both** backends since 20.5. The
body is spliced into the engine's own mesh shader as a colour hook, so the mesh
keeps its placement, alpha cutout, lighting and fog, and `setUniform` /
`setTime` drive it exactly as they do over a sprite. Uniform-only bodies are
the supported case and they are most of them.

Five things the quad tier gives an effect that the mesh tier does not, each
refused rather than half-working:

| refused | why |
|---|---|
| its own `setTexture` samplers | resolved by the quad tier's per-effect device state; refused on both backends |
| `screen_texture`, `screen_uv` | need the screen capture only the quad tier takes |
| `noise_uv` | derived from a quad's image and object size |
| `vColor`, on WGSL only | the WGSL mesh module has no module-scope equivalent; the GLSL one declares it, so GLSL is fine |
| `InstancedMesh` | the instanced WGSL builder drops everything between the two stages |

Hitting one warns **once** and falls back to the built-in shading. Nothing
throws, so the symptom is a mesh drawing with its plain texture, which reads as
a broken shader, a bad binding or a texture that failed to load. Check the
console for the warning before you start eliminating alpha, bindings and
transparency: it names which of the five it was.

2D renderables never hit this. `Sprite`, `Text` and the rest go through the
quad path, which has the full feature set, so a gradient fill for text or a
refraction over a sprite is fine.

If you need one of the five on a mesh, supply a full dual-language `GLShader`
rather than a fragment body, and declare the fog uniforms yourself (see
`melonjs-3d`).

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
| syntax error in a file whose shader you just edited, pointing at a line of GLSL | a backtick in the shader body ended the template literal — most often one wrapped around an identifier in a comment |

## Related skills

- `melonjs-renderables` — where post effects attach, and the destroy trap
- `melonjs-3d` — the GPU-backend requirement, and why a custom mesh shader is
  not affected by the camera's distance fog
