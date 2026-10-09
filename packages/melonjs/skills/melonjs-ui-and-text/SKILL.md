---
name: melonjs-ui-and-text
description: "Use this skill for HUDs, buttons, menus, dialogue panels, progress bars and on-screen text in melonJS. Covers UIBaseElement/UISpriteElement/UITextButton, ProgressBar, Draggable and DropTarget, the floating screen-space container pattern, which of two overlapping panels gets the pointer, Text and BitmapText, web font loading, and NineSliceSprite panels. Triggers on: UI, HUD, button, UIBaseElement, UISpriteElement, UITextButton, ProgressBar, progress bar, health bar, gauge, Draggable, DropTarget, menu, dialogue, overlapping panels, moveToTop, onOver, onClick, Tween, easing, animate a label, wavy text, per-glyph effect, glyphEffect, shake text, rainbow text, Text, BitmapText, fillStyle, fillGradient, gradient text, tint, font, fontface, wordWrapWidth, NineSliceSprite, score display, floating."
license: MIT
---

# UI, HUD and text

## Outlined text: the stroke eats into the glyph

`Text` draws `fillText` and then `strokeText`, so the outline lands **on top of
the fill** and is centred on the glyph edge — half of it inward. On a small or
chunky face a `lineWidth` of 3 leaves the letters solid black. Keep it to 1,
and raise the font size rather than the stroke.

The stroke used to cost you the top row of pixels as well, and a display face
whose glyphs overshoot the nominal ascent did the same on its own: the render
box was sized from the line height alone, with no allowance for either. **That
is fixed** — the bake is padded by the ink's real extent and the blit shifts
back by the same amount, so nothing is clipped and the reported bounds are
unchanged. Write the string you mean:

```js
new Text(x, y, { font: "Display", lineWidth: 1, lineHeight: 1.45, text: "" });
hud.setText("SCORE 100");
```

If you have a label carrying a leading `\n` to buy headroom, that workaround is
now dead weight — drop it, and take the line height back off the position you
shifted it by.

## Gradient text

`fillStyle` takes a `Gradient` as well as a colour — the same object
`Renderer#setColor` accepts, built the way the canvas API builds one:

```js
const ramp = renderer.createLinearGradient(0, 0, 0, 24);  // top to bottom
ramp.addColorStop(0, "#fffdf0");
ramp.addColorStop(1, "#f0a020");

new Text(x, y, { font: "Display", size: 24, fillStyle: ramp });
```

Coordinates are the label's own bake: `(0, 0)` is the top-left of the render
box, so the ramp above runs down one line. A multi-line label **restarts it on
every line**, reading like one `Text` per line — you do not have to author the
gradient over the block height. Pass `gradientPerLine: false` for a single ramp
spanning the whole block, which is what a plain canvas does and what a
deliberate fade across a two-line title wants.

The ramp colours the **fill only** — `Text` strokes in a separate pass, so
an outline keeps its own colour without any luminance trickery — and it works on
Canvas2D, which a post effect does not.

### The gradient does not live in `fillStyle`

`fillStyle` ACCEPTS a `Gradient`; it never HOLDS one. The constructor routes it
to `fillGradient` and leaves `fillStyle` as the pooled `Color` it always is,
which is what keeps `fillStyle.alpha` gating the fill and keeps the colour
owned by the pool.

So changing the ramp later means assigning the field it actually landed in:

```js
label.fillGradient = ramp;   // ✓
label.fillStyle = ramp;      // ✗ TS2740: Gradient is not a Color
```

The ramp is authored for ONE line height, so a label that changes size needs a
new one built at the new size; there is nothing that rescales it for you.

## BitmapText: `size` is a RATIO, not pixels

The trap when moving over from `Text`:

```js
new Text(x, y,       { font: "Arial", size: 24, text: "SCORE" });  // 24 pixels
new BitmapText(x, y, { font: "arial", size: 24, text: "SCORE" });  // 24 TIMES
```

`size` scales the font's authored size, so `1` is native and `2` is double —
`resize(scale)` and `set(textAlign, scale)` take the same ratio. Whole numbers
keep pixel art crisp; fractional ones resample the page image.

It has **no stroke** — there is no `strokeStyle` or `lineWidth` here, which is
part of why it stays sharp. Colour comes from the tint instead:

```js
const score = new BitmapText(8, 8, {
    font: "arial", text: "1000", fillStyle: "#ffd700",
});
score.fillStyle = "#ff4040";                  // recolour at any time
score.fillStyle = new Color(255, 255, 255);   // UNTINTED, not "white text"
```

`fillStyle` is `Renderable#tint` under another name: white is the *absence* of a
tint and every other colour tints away from it, so author the page in white to
keep every colour available to you.

Load the descriptor as `binary` and its page as `image` under the **same name**.
Both BMFont flavours — text (`.fnt`) and XML — are auto-detected, so an `.xml`
descriptor loads as-is:

```js
loader.preload([
    { name: "arial", type: "binary", src: "data/font/arial.fnt" },
    { name: "arial", type: "image",  src: "data/font/arial.png" },
]);
```

Reach for it over `Text` when the text is mostly static, has to stay crisp at
integer scales, or wants recolouring without a re-bake.

### `fillStyle` means two different things

The name is shared and the behaviour is not, which is the trap when moving a
label from one class to the other:

| | `Text` | `BitmapText` |
|---|---|---|
| what `fillStyle` holds | a real `Color`, the fill | `Renderable#tint`, under another name |
| white | white glyphs | the ABSENCE of a tint |
| gradient | yes, via `fillGradient` | no: a tint is one colour over a page image |
| stroke | `strokeStyle` + `lineWidth` | none |
| `size` | pixels | a RATIO of the authored size |

### Per-glyph wave, shake and colour: `glyphEffect`

Animating individual letters does **not** mean one renderable per character.
`BitmapText#glyphEffect` offsets and tints each glyph inside the batch the
label already draws, so an animated 100-character line stays one draw call and
costs no extra objects:

```js
label.glyphEffect = (out, ctx) => {
    out.offsetY = Math.sin(ctx.time * 0.008 + ctx.index * 0.6) * 6;  // wave
    out.tint.setColor(255, 128, 128);                                // per glyph
};
label.glyphEffect = null;    // back to the plain path
```

`out` and `ctx` are **reused**: read `ctx` during the call and write `out`, but
never keep either. `out.offsetX` / `offsetY` start at zero and `out.tint` at
opaque white on every glyph, so an effect that only touches some glyphs leaves
the rest alone. `ctx` carries `index` (across lines, line breaks excluded),
`char`, `code`, `x`, `y` and `time`.

Four things that catch people:

- **`time` advances in `update`, not in `draw`.** A label drawn through two
  cameras animates once, not twice. It is the milliseconds ACCUMULATED across
  updates while an effect was set, and nothing resets it, so swapping the
  callback continues the same clock rather than starting a new one.
- **Effects move pixels, not layout.** Metrics, wrapping, alignment,
  `visibleCharacters` and the bounds all ignore the offsets, so the pen advance
  and kerning are exactly as without one. The flip side is that **offsets do
  not extend the culling bounds**: a big wave near the screen edge can clip, so
  keep the measured text in view.
- **Canvas pays per distinct colour.** WebGL and WebGPU carry the tint in the
  per-vertex colour, so batching survives. The Canvas renderer instead caches a
  tinted copy of the whole font page per colour, and that cache is unbounded
  for the renderer's life, so a colour driven by `ctx.time` allocates a
  page-sized canvas every frame there. On Canvas, keep the palette finite or
  animate only the offsets.
- **`tint` is multiplicative**, like `fillStyle` above: white leaves the glyph
  alone, and `out.tint` multiplies whatever the label's own `fillStyle` is.

`Text` has no equivalent, since it rasterises the whole string into one texture.

## The HUD pattern

A HUD is a `floating` container at a high z, built once and re-added:

```js
class HUD extends Container {
    constructor(app) {
        super(0, 0, app.viewport.width, app.viewport.height);
        this.floating = true;       // screen space, not world space
        this.isPersistent = true;   // survives a world reset
    }
}

app.world.addChild(new HUD(app), 100);   // explicit z — not `.z = Infinity`
```

There is no `UIContainer` class. Use `Container`, or `UIBaseElement` when the
panel itself must react to the pointer — it is a `Container` that already sets
`floating = true` and `isKinematic = false`.

Three things matter here:

- **`floating = true`** opts the container out of camera transforms, so it stays
  put while the world scrolls. Without it the HUD scrolls away — a silent
  failure.
- **Only the parent container needs `floating`.** `addChild` forces
  `child.floating = false` under a floating parent, and the container applies one
  projection swap for the whole subtree.
- **Pass an explicit z.** `this.z = Number.POSITIVE_INFINITY` appears in several
  shipped examples and does nothing — `renderable.z` is not a real property. The
  real accessor is `depth` (an alias for `pos.z`); `addChild(child, z)` sets it
  for you.

### Bars and gauges: `ProgressBar`

A health bar, a shield gauge, a cooldown and a loading bar are one object. Set
`value`; it redraws.

```js
const hp = new ProgressBar(20, 20, {
    width: 200, height: 24,
    min: 0, max: 100, value: 100,      // min/max default to 0 and 1
    trackColor: "#0000001a",
    fillColor: "#c0392b",
    borderColor: "black", borderWidth: 2,
    padding: 2,                        // inset of the fill inside the track
    radius: 6,                         // 0 is square
});
hud.addChild(hp);

hp.value -= 15;                        // clamps; `ratio` reads back 0..1
```

`direction` takes `"left-to-right"` (the default), `"right-to-left"`,
`"top-to-bottom"` or `"bottom-to-top"`, each growing from its own edge.

**The colour follows the value by mutating the `Color` you passed.** This is
the one non-obvious part, and it is deliberate: every game wants a different
rule, and most want the colour somewhere else too, next to a shader uniform or
a glow. The bar re-reads `fillColor` every frame, so it never has to know:

```js
const full = new Color().parseCSS("#7fe0ff");
const empty = new Color().parseCSS("#ff2a1e");
const mixed = new Color();

const shield = new ProgressBar(x, y, {
    width: 190, height: 13,
    trackColor: null,                  // hollow: the scene shows through
    borderColor: "rgba(122, 190, 235, 0.8)",
    padding: 2,
    fillColor: mixed,                  // KEPT, not copied
});

// each frame
mixed.copy(empty).lerp(full, hp);      // the bar follows, and so can a shader
shield.value = hp;
```

Blinking is the same story: `setOpacity()` already does it, on whatever clock
the game is already keeping. Neither is built in.

**`bindEvent` takes the value from an event instead**, and the subscription
then lives exactly as long as the bar:

```js
const bar = new ProgressBar(0, y, {
    width: renderer.width, height: 4,
    trackColor: "black", fillColor: "#55aa00",
    bindEvent: event.LOADER_PROGRESS,
});
```

Hold that subscription anywhere else and it outlives the bar, firing into a
renderable whose `pos` has already been released. The engine's own loading
screen is built on exactly this.

Two more worth knowing:

- **The border is four filled rects, not a stroke** (unless the bar is
  rounded). A stroke is centred on the path, so half of it falls outside and a
  bordered bar paints over its neighbour; and `strokeRect` adds corner joins
  only above a line width of 1, so at exactly 1 a corner pixel goes missing.
- **`trackColor: null` leaves the bar hollow**, which is what a HUD over a busy
  scene usually wants: the border is then the only chrome.

### Buttons: extend the handlers, do not bind listeners

`UISpriteElement` is a `Sprite` that already registers itself for pointer
events, so a button is made by overriding methods rather than by wiring
`registerPointerEvent`:

| handler | fires | returns |
|---|---|---|
| `onClick(event)` | pressed | `false` to stop the event propagating |
| `onRelease(event)` | pressed and released | `false` to stop propagating |
| `onOver(event)` | pointer enters | `false` to stop propagating |
| `onOut(event)` | pointer leaves | — |
| `onHold()` | pressed and held | — |

```js
class MuteButton extends UISpriteElement {
    constructor(x, y) {
        super(x, y, { image: atlas, region: "speaker.png" });
        this.setOpacity(0.5);
    }
    onOver() { this.setOpacity(1.0); }
    onOut()  { this.setOpacity(0.5); }
    onClick() {
        audio.muteAll();
        return false;          // consumed — do not fall through to the world
    }
}
```

The pointer still has to reach it: a renderable with `isKinematic = true` — the
default on a plain `Renderable` — is skipped by the broadphase and receives
nothing. `UISpriteElement` and `UIBaseElement` clear it for you; anything else
you make clickable has to clear it itself.

### `z` is container-local

`addChild(child, z)` writes a depth that means something **only among that
container's own children**. `autoDepth` numbers them from 1, so a button at
`z = 8` inside one panel and a whole second panel at `z = 2` are not comparable
numbers, and the second panel is still the one on top. Drawing and hit-testing
both resolve a cross-container pair the same way: walk up to the common parent
and compare the two siblings there.

So a panel is raised by raising **the panel**, not its contents:

```js
this.ancestor.moveToTop(panel);   // reorders, and sets z past its neighbour
```

Giving a child a huge `z` to "put it in front" lifts it only within its own
panel. This is also why a widget's `z` never has to be coordinated with
anything outside its own container.

### Panels and boxes that stretch: `NineSliceSprite`

A panel, dialogue box or button background drawn from one small image wants
`NineSliceSprite`, not a `Sprite` scaled up. It cuts the image into a 3×3 grid,
keeps the four corners at their own size, and stretches only the edges and the
middle, so the border stays crisp at any size. Do not hand-roll it from nine
sprites.

From a texture atlas, the third argument of `createSpriteFromName` asks for the
9-slice version. This is how the UI example's draggable panel draws itself:

```js
class Panel extends UIBaseElement {
    constructor(x, y, width, height) {
        super(x, y, width, height);
        // `true` returns a NineSliceSprite stretched to the panel's size
        this.addChild(
            texture.createSpriteFromName("grey_panel", { width, height }, true),
        );
    }
}
```

From a loaded image, construct it directly (the Text example's dialogue box):

```js
const box = new NineSliceSprite(48, 640, {
    image: "panel",
    width: 900,
    height: 256,
    insetx: 36,          // the border thickness in the source image
    insety: 36,
    tint: "#3a3f58",     // tint works as on any sprite
});
box.anchorPoint.set(0, 0); // place it by its top-left corner
```

Three things trip people up:

- **`width` and `height` are mandatory.** They are the size to stretch *to*, not
  the image's size, and the constructor throws without them.
- **Set `insetx` / `insety` to the art's border.** Left out, each defaults to a
  quarter of the source image, which on most panel art cuts through the border:
  the corners smear or the border thins out when the box grows.
- **The anchor is the centre**, as for any `Sprite`. Set it to `(0, 0)` to place
  the box by its corner, as a layout usually wants.

It resizes live: set `width` / `height` and the next draw re-slices, so a box
that grows with its text, or a panel the player drags larger, needs no new
sprite.

### An opaque panel has to say so

The hit test asks the topmost renderable first and then keeps walking down, so
consuming is what stops a widget underneath answering too. A panel that can
overlap another one therefore wants both:

```js
class Panel extends UIBaseElement {
    onClick() {
        this.ancestor.moveToTop(this);  // and bring it to the front
        return false;                   // consumed
    }
    onOver() {
        return false;                   // the frame the pointer crosses in
    }
    onActivateEvent() {
        super.onActivateEvent();
        // and every frame after that, when the pointer is ALREADY inside and
        // `onOver` no longer fires
        input.registerPointerEvent("pointermove", this, () => false);
    }
    onDeactivateEvent() {
        input.releasePointerEvent("pointermove", this);
        super.onDeactivateEvent();
    }
}
```

Leave `onOut` alone: an element that suppresses its own leave stays lit after
the pointer has gone. It fires for the covered element too, not only when the
pointer leaves its bounds, so a button half under the panel goes dark as soon as
the pointer slides onto the panel, which never takes it out of the button's
bounds.

### In a 3D scene, a HUD needs a SMALL depth

`floating` opts a renderable out of the camera transform. It does **not** opt it
out of the depth sort, and the two sorts read z differently:

| container `sortOn` | ordered by | on top |
| --- | --- | --- |
| `"z"` (default, 2D) | `pos.z` | **highest** z |
| `"depth"` (what `Camera3d` sets) | distance from the camera | **nearest** the camera |

Under `"depth"` a floating child is ordered by `|pos.z|` alone — its `pos.x/y`
are screen pixels, not a place in the world, and the camera does not move
relative to it. So the *magnitude* is the distance, and the sign is ignored:

```js
world.addChild(hud, -150);        // small -> in front of the whole scene
world.addChild(backdrop, -10000); // large -> behind the whole scene
world.addChild(backdrop, 100000); // equally far: sign does not matter
```

Give a HUD the huge z that would put it on top in 2D and it lands at the far end
of the level instead, with the scenery drawing over it. Both shipped idioms are
the same rule: afterBurner's HUD sits at `-150`, and the glTF, Billboard, Night
City and Instanced Forest examples park a floating sky at `-10000` or `100000`.

## Related skills

- `melonjs-scenes-and-state` — `Tween` and the easing families, for animating any of this
- `melonjs-input` — which object gets a pointer event, and how to consume it
- `melonjs-loading-assets` — web fonts have to be loaded before a `Text` bakes
