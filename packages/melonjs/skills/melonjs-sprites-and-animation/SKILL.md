---
name: melonjs-sprites-and-animation
description: "Use this skill when creating sprites, playing frame animations, or working with texture atlases in melonJS. Covers Sprite construction from a plain image or an atlas region, addAnimation/setCurrentAnimation, TextureAtlas for TexturePacker/ShoeBox/Aseprite, tint, flip, NineSliceSprite, and the centred anchorPoint that offsets naive positioning. Triggers on: Sprite, new Sprite, addAnimation, setCurrentAnimation, isCurrentAnimation, TextureAtlas, TexturePacker, Aseprite, ShoeBox, atlas, region, framewidth, frameheight, tint, flipX, flipY, NineSliceSprite, animation."
license: MIT
---

# Sprites, animation and atlases

> Creating sprites from images or atlases, driving frame animation, and the
> positioning trap that catches almost everyone.

## `pos` is the centre, not the top-left

`Renderable.anchorPoint` defaults to **`(0.5, 0.5)`**, so a sprite's `pos` is its
**centre**. `Container` forces `(0, 0)` instead, which is why containers and
sprites appear to disagree.

```js
// a 64×64 sprite at (100, 100) covers 68..132, not 100..164
const s = new Sprite(100, 100, { image: "hero", framewidth: 64, frameheight: 64 });

s.anchorPoint.set(0, 0);   // switch to top-left positioning if you prefer
```

Writing top-left maths against the centred default puts everything half a sprite
off, with no error. It is the most common source of "close but subtly wrong"
placement.

## Constructing a sprite

From a plain image:

```js
const hero = new Sprite(x, y, {
    image: "hero",          // preloaded asset name
    framewidth: 32,
    frameheight: 32,
});
```

From a texture atlas region:

```js
const atlas = new TextureAtlas(loader.getJSON("sprites"), loader.getImage("sprites"));
const coin = new Sprite(x, y, { image: atlas, region: "coin_01.png" });
```

`framewidth` / `frameheight` define the animation grid on a sheet. Omit them and
the whole image is one frame.

## Animation

```js
hero.addAnimation("idle", [0, 1, 2, 3], 100);   // frames, ms per frame
hero.addAnimation("walk", [4, 5, 6, 7]);
hero.addAnimation("die",  [8, 9], 150);

hero.setCurrentAnimation("walk");
hero.setCurrentAnimation("die", "idle");                          // chain to idle when it ends
hero.setCurrentAnimation("die", { loop: false });                 // play once, hold the last frame
hero.setCurrentAnimation("die", { loop: false, onComplete: fn }); // …and call fn when it does

if (hero.isCurrentAnimation("walk")) { /* … */ }
```

Frame indices are into the `framewidth`/`frameheight` grid. With an atlas, use
`atlas.getAnimationSettings([regionNames])` and spread it into the Sprite
settings, or `atlas.createAnimationFromName([regionNames])`, which returns a
ready-made Sprite. On a fixed-cell spritesheet only numeric indices are
accepted — passing region names throws.

The second argument to `setCurrentAnimation` is polymorphic. A **string** chains
to that animation when this one ends. An **options object** takes
`{ loop, next, speed, onComplete }`, and only an explicit `loop: false` stops the
looping. A **bare function** is the legacy form: it fires at *every* cycle end,
and only holds the last frame if it returns `false`. Omit the argument entirely
and the animation loops forever.

Re-selecting the animation that is already current is a no-op, so calling
`setCurrentAnimation` every frame is safe. An unknown id throws.

## Texture atlases

`TextureAtlas` reads several formats:

| source | how |
|---|---|
| TexturePacker / Free Texture Packer JSON | `new TextureAtlas(loader.getJSON(name), loader.getImage(name))` |
| Aseprite **JSON export** | same as TexturePacker — the format is detected from `meta.app` |
| Aseprite **`.aseprite` / `.ase` binary** | loader type `"aseprite"`, which stores the composited image *and* a JSON sidecar under the one asset name |
| ShoeBox | JSON export using the melonJS exporter settings file; same call as TexturePacker |
| fixed-cell spritesheet | `new TextureAtlas({ framewidth, frameheight, anchorPoint }, loader.getImage(name))` |
| multi-page | pass an array of atlas JSON objects as the first argument |

Helpers: `createSpriteFromName(name)`, `createAnimationFromName([names])`,
`getAnimationSettings([names])`.

Atlases matter for performance: the GPU batchers bind several textures at once
(up to `renderer.maxTextures`), so a handful of separate images still batch —
but once a frame crosses that many distinct textures the batch has to flush.
Packing into one atlas keeps everything on a single binding.

## Visual properties

```js
sprite.tint.setColor(255, 128, 0);   // multiply tint
sprite.alpha = 0.5;
sprite.flipX(true);                   // mirror horizontally
sprite.flipY(true);
sprite.blendMode = "additive";        // see the effects skill for the full list
sprite.scale(2, 2);                   // ← multiplicative, see below
```

**`scale()` is multiplicative, not absolute.** Calling it every frame compounds.
For absolute scaling reset first:

```js
sprite.currentTransform.identity();
sprite.currentTransform.scale(s, s, 1);
```

This bites hardest with pooled sprites, which arrive carrying their previous
life's transform.

## `NineSliceSprite`

For panels and dialogue boxes that stretch without distorting their corners:

```js
new NineSliceSprite(x, y, {
    image: "panel", width: 300, height: 120,
    insetx: 12, insety: 12,     // lowercase x/y — `insetX` is silently ignored
});
```

`width` and `height` are mandatory and the constructor throws without them.
The insets default to a quarter of the frame.

## Pooling

Frequently spawned sprites should be pooled:

```js
pool.register("bullet", Bullet, true);      // true = recyclable
const b = pool.pull("bullet", x, y);        // new Bullet(x, y), or onResetEvent(x, y) on a reused one
world.removeChild(b);                       // returns it to the pool automatically
```

Two consequences:

- A recyclable class's `onResetEvent` must reset **everything** its lifetime
  mutates — alpha, tint, scale, animation state. Anything you forget carries
  over to the next use.
- Pool-recycled objects do **not** fire `onDestroyEvent` on removal. Pair event
  subscriptions with `onActivateEvent` / `onDeactivateEvent` instead.

## Symptom → cause

| symptom | cause |
|---|---|
| everything offset by half a sprite | top-left maths against the centred `anchorPoint` |
| sprite grows every frame | `scale()` is multiplicative — reset the transform |
| a recycled sprite keeps its old look | `onResetEvent` does not restore every mutated property |
| event handlers leak on pooled objects | bound in the constructor rather than `onActivateEvent` |
| animation never advances | no `framewidth`/`frameheight`, so the sheet is one frame |
| animation plays once and stops | `{ loop: false }`, or a callback that returned `false` |
| sprites do not batch | more distinct textures in one frame than `renderer.maxTextures` |
| nine-slice corners stretch anyway | `insetX`/`insetY` instead of `insetx`/`insety` |

## Related skills

- `melonjs-renderables` — anchors, draw order, custom draw
- `melonjs-getting-started` — preloading images and atlases
