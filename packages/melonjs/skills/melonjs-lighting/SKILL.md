---
name: melonjs-lighting
description: "Use this skill for 2D dynamic lighting in melonJS — Light2d, ambient light on a Stage, multiple lights, and per-pixel normal-mapped sprites authored in SpriteIlluminator. Covers specular highlights via shininess, the ambient-cutout model, which parts need a GPU backend, and why Light2d does not survive a Camera3d. Triggers on: Light2d, specular, shininess, highlight, glint, lighting, ambientLight, ambientLightingColor, normalMap, SpriteIlluminator, per-pixel lighting, drawLight, torch, glow, darkness."
license: MIT
---

# 2D dynamic lighting

> `Light2d` is a world renderable that cuts through a stage's ambient darkness.
> The glow and the cutout work on every backend; only per-pixel normal-map
> shading needs a GPU one. It is 2D-only.

## The model: ambient darkness plus cutouts

The `Stage` holds an ambient colour — a dark sheet painted over the scene after
the world is drawn — and each active `Light2d` punches a hole in it at its
visible area. The lights themselves are drawn additively on top.

```js
class PlayScreen extends Stage {
    onResetEvent(app) {
        this.ambientLight.parseCSS("#1a1a2e");     // the darkness

        app.world.addChild(new Light2d(x, y, radiusX, radiusY, "#ffddaa", 0.9));
    }
}
```

The constructor is `Light2d(x, y, radiusX, radiusY = radiusX, color = "#FFF",
intensity = 0.7)`, and `pos` is the light's **centre** — its `anchorPoint` is
`(0.5, 0.5)`, and `centerX` / `centerY` are overridden to return `pos` directly.
Give `radiusY` a different value for a stretched, elliptical light.

A `Light2d` added to the world **registers itself with the stage's ambient
overlay on activate**, so you add it like any other renderable and it takes part
in the lighting pass. It draws additively (`blendMode = "lighter"`); set
`light.illuminationOnly = true` to suppress the visible glow while still lighting
normal-mapped sprites.

`Stage.ambientLight` defaults to fully transparent black, and `drawLighting()`
returns immediately while its alpha is 0 — so with no ambient colour set there
is nothing to cut through and the lights just look like soft additive blobs.

## Multiple lights

Add as many as you need — the glow quads and the ambient cutouts accumulate with
no fixed cap.

The **normal-map** pipeline is capped: lights are packed into a std140 uniform
block sized for `MAX_LIGHTS = 32`, and anything past the 32nd is silently dropped
from the per-pixel shading (it still draws its glow and punches its cutout). The
cap is an allocation, not a budget — the fragment loop still runs once per pixel
per live light.

Lights are positioned like any renderable, so they can follow an entity by
updating `pos`, or be added as children of one.

## Per-pixel lighting with normal maps

For sprites that respond to light direction rather than just brightness, supply a
normal map alongside the diffuse texture:

```js
await loader.preload([
    { name: "hero",     type: "image", src: "data/img/hero.png" },
    { name: "hero_n",   type: "image", src: "data/img/hero_n.png" },
]);

const hero = new Sprite(x, y, {
    image: "hero",
    normalMap: "hero_n",       // ← enables per-pixel lighting on this sprite
    framewidth: 32, frameheight: 32,
});
```

`normalMap` takes a loader key, or any image-like source (`HTMLImageElement`,
canvas, `ImageBitmap`, a `Texture2d`). Assigning anything else — including an
`HTMLVideoElement`, which would freeze on frame 0 — throws a `TypeError`.

Normal maps are typically authored in **SpriteIlluminator**. The sidecar pattern
above — one `_n` image beside each diffuse image — is the simplest setup, but an
atlas can carry one too: `new TextureAtlas(json, image, { normalMap })` pairs a
normal texture sharing the colour texture's UVs, and a `Sprite` built from that
atlas picks it up in preference to its own `settings.normalMap`.

## Specular highlights

A normal map gives a sprite **shape**: the light knows which way each texel
faces, so a torch reveals bumps and crevices. `shininess` decides whether it
also **shines**:

```js
const sword = new Sprite(x, y, {
    image: "sword",
    normalMap: "sword_n",
    shininess: 64,        // 0 (the default) is matte
});
```

The difference is what the highlight *does*. Diffuse brightness depends only on
the angle between the surface and the light, so a torch moving past just makes
the sprite brighter. A specular highlight only appears where a texel reflects
the light **toward the screen**, so it slides across the surface as the light
moves: armour that glints as you walk by, rather than armour that is merely lit.

Low values give a broad sheen (worn metal, wet stone); high values a tight glint
(polished steel, glass). It is gated on the exponent exactly as MTL `Ns` is on
the 3D path, so `0` means matte however bright the scene, and a sprite that
never sets it renders exactly as it always did.

Three things worth knowing:

- **It needs a `normalMap`.** With no surface directions there is nothing to
  reflect, and the sprite stays matte whatever `shininess` says.
- **The normal map's alpha channel masks it per texel.** 255 is fully
  reflective, 0 is dead matte, so one sprite can be a shiny blade with a matte
  leather grip. A normal map with no alpha detail (the usual case) shines
  uniformly. Note the corollary: if your normal map already uses alpha for
  something, that channel now also decides gloss.
- **It accumulates per light.** Each light contributes its own highlight in its
  own colour, so a sprite between a warm lamp and a cool one carries two
  distinct glints that move independently.

The highlight takes the light's own colour and is *added* on top of the lit
result rather than multiplied into it, which is why a glint blows out toward
white on a dark sprite instead of tinting with it.

See it running: [Normal Map example](https://melonjs.github.io/melonJS/examples/#/normal-map).

Unlit areas of a normal-mapped sprite render pure black unless you raise
`Stage.ambientLightingColor` (default black) — that is the base level added to
every lit pixel, and it is a different knob from `Stage.ambientLight`.

Without a normal map a sprite is still lit, but flatly: brightness varies with
distance from the light, not with surface direction.

## What needs a GPU backend, and what does not

Less than you would expect. `Light2d` is renderer-agnostic: it just calls
`renderer.drawLight(this)`, and every backend implements it — the GPU backends
through a shared procedural radial-falloff shader, the Canvas renderer by
rasterising a cached `Gradient` into one shared render target and compositing it
with `drawImage`. The ambient cutout pass is plain `setMask` + `fillRect`. So the
lit-spot look works everywhere, Canvas included.

What Canvas cannot do is **per-pixel normal-map lighting**:
`renderer.setLightUniforms()` is a no-op there, and the first frame that passes a
non-empty light list logs a one-shot warning. Normal-mapped sprites simply render
unlit — no error.

```js
if (app.renderer.shaderLanguage === null) {
    // Canvas fallback: lights and ambient still work, but `normalMap` is ignored
}
```

## Do not combine with `Camera3d`

`Camera3d` extends `Camera2d` and therefore still runs the 2D lighting pass, but
nothing in that pass is projection-aware: the ambient fill is a screen-space
`fillRect`, the cutout is a 2D `Ellipse` mask, and light positions are packed as
2D world coordinates minus the camera translate. Under a perspective projection
none of that lines up with what the camera actually draws.

For 3D scenes use `Light3d` instead — it is the counterpart for the mesh
lighting path, with `"directional"`, `"ambient"`, `"point"` and `"spot"` types.
See the `melonjs-3d` skill.

## Symptom → cause

| symptom | cause |
|---|---|
| lights added but the scene never darkens | no ambient colour set — `ambientLight` alpha is 0, so the pass returns early |
| sprite lit flatly, ignoring light direction | no `normalMap` on the sprite, or the Canvas backend is active |
| normal-mapped sprite is pure black where unlit | `Stage.ambientLightingColor` left at black |
| the 33rd light shades nothing | `MAX_LIGHTS = 32` for the normal-map pipeline |
| `TypeError` assigning `normalMap` | not an image-like value (a video element is rejected outright) |
| lighting misaligned under a 3D camera | the 2D light pass is not projection-aware — use `Light3d` |

## Related skills

- `melonjs-3d` — `Light3d` for perspective scenes
- `melonjs-sprites-and-animation` — sprite settings and atlases
