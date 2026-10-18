---
name: melonjs-display-and-scaling
description: "Use this skill when a melonJS game looks blurry, soft, shimmering or cropped, or when choosing how the canvas fills its page. Covers the design resolution, scale and scaleMethod, scaleTarget, scaleRounding for pixel-perfect integer scaling, antiAlias, textureFilter, subPixel, devicePixelRatio, and which setting does which job. Triggers on: blurry, soft, fuzzy, shimmering, pixel art, pixel perfect, crisp, nearest, linear, scale, scaleMethod, scaleTarget, scaleRounding, integer scaling, antiAlias, textureFilter, subPixel, devicePixelRatio, retina, hidpi, design resolution, canvas size, canvas cropped, letterbox, image-rendering, upscale, resolution."
license: MIT
---

# Display and scaling

Seven settings decide how a game looks on screen, and they are easy to get
individually right and collectively wrong. This is what each one actually
does, and which one to reach for.

## The four jobs

A pixel travels from your source art to a physical pixel through four
separate decisions. Knowing which setting owns which is most of the work.

| job | setting | what it decides |
|---|---|---|
| how big the frame is drawn | `width`/`height` on `Application` | the design resolution everything is authored against |
| how it uses the space | `scale`, `scaleMethod`, `scaleTarget` | fit, fill, stretch, and what it measures to decide |
| may the factor be fractional | `scaleRounding` | whole device pixels per source pixel, or any factor |
| how a texture is sampled | `antiAlias`, `textureFilter` | nearest or linear, and the CSS upscale filter |

`subPixel` is a fifth, orthogonal to all of them: it decides whether a
renderable may sit on a fractional position WITHIN the frame.

## Design resolution

```js
const app = new Application(480, 270, { scale: "auto" });
```

The game is drawn at 480x270 whatever the window is, and the canvas is scaled
to the container. Everything in world coordinates is in those units. This is
the usual arrangement: author once, scale to whatever you are given.

## `scale` and `scaleMethod`

`scale: "auto"` turns on automatic scaling; a number is a fixed multiplier and
`scaleMethod` is then ignored.

`scaleMethod` decides how the available space is used:

- **`"fit"`** keeps the design resolution and the aspect ratio, scaling to the
  largest factor that fits. Leftover space becomes margin. This is the one to
  use when the game is authored for a fixed frame.
- **`"fill-min"` / `"fill-max"`** keep the aspect ratio but RESIZE the
  renderer, so the design resolution changes with the window and the game sees
  more or less of the world.
- **`"flex"`, `"flex-width"`, `"flex-height"`** resize the renderer on one or
  both axes.
- **`"stretch"`** scales each axis independently, so the aspect ratio is not
  preserved and circles become ovals.
- **`"manual"`** does nothing automatic.

The distinction that matters: **`fit` scales a fixed frame; everything else
changes how much of the world is visible.** A game whose layout assumes a
known frame wants `fit`.

## `scaleTarget`: what gets measured

Automatic scaling measures **the parent of the element the canvas is mounted
in**, not the element itself. If that grandparent is not the box you meant,
the canvas is sized wrongly, and the failure is quiet.

The case that bites: a canvas container that is `position: fixed` or
`absolute` contributes no height to its parent, so the parent measures only
whatever else is in it. If that parent is `<body>`, the engine falls back to
the window size and the canvas ends up larger than the box it lives in,
cropped by whatever sits above it.

```js
new Application(1024, 576, {
	parent: "screen",
	scale: "auto",
	// measure THIS, rather than guessing from the DOM shape
	scaleTarget: document.getElementById("stage"),
});
```

Either name the element with `scaleTarget`, or give the canvas container a
parent whose box is the area you want filled. If the canvas is cropped or
overflows on resize, this is the first thing to check.

## `scaleRounding`: whole device pixels

```js
new Application(480, 270, {
	scale: "auto",
	scaleMethod: "fit",
	scaleRounding: "integer",   // default "fractional"
});
```

`"fractional"` fills the container exactly, at whatever factor that takes. A
480 wide design in a 1280 wide container is scaled by 2.667, so some source
pixels cover three screen pixels and some cover two. Pixel art shows this as
uneven glyph stems and shimmering edges, and browsers resolve the unevenness
differently, so the same scene can look crisp in one and soft in another.

`"integer"` rounds the factor DOWN so every source pixel covers the same whole
number of device pixels, and letterboxes with the space left over. That trade,
crisp pixels for black bars, is the whole decision.

### What it costs

More than "some letterboxing", and the size of it is decided by
`devicePixelRatio` as much as by the window. A higher ratio has more device
pixels to round among, so it lands closer to the factor it wanted. For a
480x270 design, which is exactly a quarter of 1920x1080:

| container | ratio | fit | integer | presented | area lost |
|---|---|---|---|---|---|
| 1920x1080 | 1 or 2 | 4.000 | 4 / 8 | 1920x1080 | none |
| 1440x810 | 1 | 3.000 | 3 | 1440x810 | none |
| 960x540 | 1 | 2.000 | 2 | 960x540 | none |
| 1280x720 | 2 | 2.667 | 5 | 1200x675 | 12% |
| 2560x1440 | 2 | 5.333 | 10 | 2400x1350 | 12% |
| 1280x720 | 1 | 2.667 | 2 | 960x540 | **44%** |
| 1366x768 | 1 | 2.844 | 2 | 960x540 | **51%** |

So the decision is mostly made when the design resolution is chosen, not when
this setting is. One that divides the sizes you expect costs nothing; one that
does not can give up half the screen on a 1x display, and 1366x768 laptops are
not rare. A game that must fill the window on any machine should stay
fractional and accept the uneven pixels.

Two things to know:

- It applies to **`scaleMethod: "fit"` only.** Every other method resizes the
  renderer to the container, so the design resolution moves and there is no
  fixed factor to round.
- The rounding happens in **device** pixels. `devicePixelRatio` multiplies the
  CSS size on the way to real pixels, so rounding the CSS factor would let the
  fraction straight back in: a factor of 2 at a ratio of 1.25 is 2.5 device
  pixels per source pixel.

## `antiAlias` does three things

This is the setting most likely to surprise, because it is not one switch:

1. the texture filter, but only while `textureFilter` is `"auto"` (the
   default), which TRACKS it: linear when on, nearest when off. Setting
   `textureFilter` explicitly decouples the two
2. `imageSmoothingEnabled` on the 2D context
3. the canvas CSS `image-rendering`: `pixelated` when off, `auto` when on

So `antiAlias: false` gives hard-edged textures AND a hard-edged upscale of
the whole frame. That is usually what a pixel-art game wants, and usually NOT
what a smooth 3D scene wants, because it also disables MSAA.

`textureFilter: "nearest" | "linear"` separates the texture half, so a scene
can have smooth model edges and nearest-sampled sprites. The presentation half
is not separable: there is no way to get MSAA silhouettes and a hard-edged
upscale at the same time.

## `subPixel` is about position, not scale

`subPixel: false` (the default) truncates a renderable's translation to whole
pixels inside the frame. It is `|0`, so it truncates **toward zero** rather
than rounding, which is worth knowing when something travels a short distance:
an offset that should swing between -3 and +3 lands on -2 and +2, and parks at
the extremes for longer than it should.

It does nothing about how the frame reaches the screen. A game that carefully
snaps positions and is then scaled by 2.667 has thrown that work away at the
last step, which is the contradiction `scaleRounding: "integer"` exists to
resolve.

## Soft text next to crisp sprites

If everything is crisp EXCEPT the text, the scale factor is not the cause: a
fractional factor softens the whole frame equally. The text is different
because of how it is made.

`Text` draws through the browser's `fillText`, which anti-aliases glyph edges
into partial-alpha pixels. Measured on one label at 16px: **171 distinct
partial alpha levels**. Nothing in the canvas API turns that off. `antiAlias`
and the `imageSmoothingEnabled` that `CanvasRenderTarget` sets govern IMAGE
drawing, not glyph rasterisation.

So the label arrives already soft, and the upscale then magnifies each grey
edge pixel into a grey block, sitting beside sprites that were hard-edged to
begin with and stay hard-edged under nearest sampling.

It also explains the same scene looking crisp in one browser and soft in
another at identical size and settings: engines use different font
rasterisers, with different hinting and anti-aliasing, so they bake DIFFERENT
textures from the same font at the same size.

**Use `BitmapText` for a game that upscales.** A pixel-font atlas is
hard-edged source art like every other texture, so it survives magnification
the way the sprites do. Raising the design resolution only shrinks the
magnification of anti-aliasing that is still there, so it softens the symptom
rather than removing it, and `scaleRounding` does nothing for this at all.

Keep `Text` where the frame is not upscaled much, or where the label is meant
to look smooth.

### Baking an atlas from a face you already use

Swapping in a bitmap face means generating one, and three things decide
whether it comes out looking like the original:

- **Threshold the coverage.** Hard edges are the whole point, so every pixel
  has to end up fully on or fully off. Hardening only the ALPHA is not enough:
  an outlined glyph keeps a soft stroke-to-fill blend INSIDE the silhouette,
  which still reads as blur once magnified. Pick the colours from a mask.
- **Bake each size at that size, and draw it at a ratio of 1.** `size` on
  `BitmapText` is a ratio of the authored size, and a bitmap face has the sizes
  it was baked at. Doubling a smaller atlas halves the detail; a ratio below 1
  drops whole stems; a fractional ratio resamples hard pixels unevenly. One
  atlas per step of the type scale.
- **Grow the outline outward, but carve it INWARD around a counter.** This is
  the one that costs the most time. A stroke drawn by the canvas is centred on
  the contour, so around an enclosed hole it eats into the letter and the hole
  keeps its size. Dilating a mask outward instead grows black INTO the hole
  from every side, which closes anything under about 3px: the letter loses its
  counter and reads as a blob. Take the rim from the fill side and the hole
  survives at every size. Neither leaving holes unrimmed nor closing the small
  ones is a substitute — both were tried and both look wrong.

Two traps in the generator itself:

- A face whose glyphs overshoot the `textBaseline` origin is clipped by a tight
  cell, and the symptom is an outline that goes missing along one edge of some
  glyphs. Pad the cell by a fraction of the size, and assert that no glyph's
  ink reaches its border.
- The threshold decides the TOPOLOGY, not just the weight. A notch or a narrow
  gap in a letterform closes over at a full threshold and becomes an isolated
  hole, which then bakes as a black blob sitting on the glyph. Thinner, the
  same feature stays joined to the background and reads as the face intends.
  So a small size may want a thinner fill than a large one, and the way to see
  it is to magnify one glyph, not a whole line.

## A pixel-art setup

```js
const app = new Application(480, 270, {
	scale: "auto",
	scaleMethod: "fit",
	scaleRounding: "integer",   // whole device pixels, letterbox the rest
	antiAlias: false,           // nearest textures, hard-edged upscale
	// subPixel: false is already the default
});
```

## A smooth 3D setup

```js
const app = new Application(1024, 576, {
	scale: "auto",
	scaleMethod: "fit",
	antiAlias: true,            // MSAA and a filtered upscale
	textureFilter: "nearest",   // but keep blocky textures if the art is blocky
});
```

## Symptoms

| symptom | cause |
|---|---|
| pixel art is blurry or shimmers | the frame is upscaled by a fractional factor; set `scaleRounding: "integer"` |
| crisp in one browser, soft in another | the same fractional factor, which engines distribute differently under `pixelated` |
| the canvas is cropped or overflows its box | automatic scaling measured the wrong element; name it with `scaleTarget` |
| the canvas grows on every resize | the measured ancestor is auto-sized around the canvas itself |
| things shimmer as they move | fractional positions; check `subPixel`, and that the scale factor is whole |
| 3D model edges are jagged | `antiAlias: false` also disables MSAA; turn it on and use `textureFilter` for textures |
| textures are smoothed when they should be blocky | `antiAlias: true` makes the default texture filter linear; set `textureFilter: "nearest"` |
| `scaleRounding: "integer"` changes nothing | it applies to `scaleMethod: "fit"` only; the others resize the renderer |
| text is soft but sprites are crisp | the glyphs were anti-aliased when `Text` baked them; use `BitmapText` (see below) |
| the game shows more world on a bigger window | that is `fill-*` or `flex-*` doing their job; use `"fit"` to keep a fixed frame |
