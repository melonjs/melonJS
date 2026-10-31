---
name: melonjs-ui-and-text
description: "Use this skill for HUDs, buttons, menus, options screens, dialogue panels, progress bars and on-screen text in melonJS. Covers UIBaseElement/UISpriteElement/UITextButton, UICheckbox, UISlider, ProgressBar, UIPanel (skins, layout, scrolling), Draggable and DropTarget, the floating screen-space container pattern, which of two overlapping panels gets the pointer, Text and BitmapText, web font loading, and NineSliceSprite panels. Triggers on: UI, HUD, button, checkbox, radio button, UICheckbox, slider, UISlider, volume slider, options menu, settings screen, scrolling list, scroll panel, layout, column, grid, UI skin, UIBaseElement, UISpriteElement, UITextButton, ProgressBar, progress bar, health bar, gauge, Draggable, DropTarget, menu, dialogue, overlapping panels, moveToTop, onOver, onClick, bindKey, keyboard shortcut, button keyboard, Tween, easing, animate a label, wavy text, per-glyph effect, glyphEffect, shake text, rainbow text, Text, BitmapText, fillStyle, fillGradient, gradient text, tint, font, fontface, wordWrapWidth, NineSliceSprite, score display, floating., fullscreen, full screen, requestFullscreen, exitFullscreen, isFullscreen, fullscreen button, fullscreen option"
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

### Do not build a throwaway label to measure a string

A `Text` owns a canvas bake and a GPU texture, and only `destroy()` frees
them — which is `@internal` and absent from the published types, so a game
cannot free a label it owns outside a container. A label built purely to
measure something therefore strands both, and if it is built in a stage's
`onResetEvent` it strands another on every entry to that state.

`measureText(text?)` measures any string on a label that already exists,
including one it is not currently holding:

```js
const widest = hudScore.measureText("00:00").width;
```

Advance widths scale linearly with the point size for one family, so measuring
on an existing label and scaling the result is exact. For labels you genuinely
spawn in bulk, `getPool("text")` recycles the bake.

### `fillStyle` means two different things

The name is shared and the behaviour is not, which is the trap when moving a
label from one class to the other:

| | `Text` | `BitmapText` |
|---|---|---|
| what `fillStyle` holds | a real `Color`, the fill | `Renderable#tint`, under another name |
| white | white glyphs | the ABSENCE of a tint |
| gradient | yes, via `fillGradient` | no: a tint is one colour over a page image |
| recolour it later | `label.fillStyle.parseCSS("#ff4040")` — the field is a `Color` with no setter, and ASSIGNING a string replaces it, after which the glyphs stop filling entirely and nothing is logged | `label.fillStyle = "#ff4040"` — a real setter that parses the string |
| stroke | `strokeStyle` + `lineWidth` | none |
| `size` | pixels | a RATIO of the authored size |

### Per-glyph wave, shake and colour: `glyphEffect`

Animating individual letters does **not** mean one renderable per character.
`BitmapText#glyphEffect` offsets and tints each glyph inside the batch the
label already draws, so an animated 100-character line stays one draw call and
costs no extra objects:

```js
label.glyphEffect = (out, ctx) => {
    // phase from the glyph's POSITION, not its index — see below
    out.offsetY = Math.sin(ctx.time * 0.005 + ctx.x * 0.02) * 6;  // wave
    out.tint.setColor(255, 128, 128);                             // per glyph
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

### Making it read as motion

Three things decide whether a wave looks alive or mechanical, and none of them
is the amplitude.

- **Take the phase from `ctx.x`, not `ctx.index`.** This is the big one.
  Stepping per glyph advances the wave as far across a narrow `I` as across a
  wide `M`, so the wavelength stretches and squashes with whatever the line
  happens to spell, and the eye reads the unevenness as a mechanism. `ctx.x`
  gives the wave one fixed length in pixels and lets it travel through the
  text at a constant rate, whatever the letters are.
- **Round the offsets if the frame is upscaled.** They are added to the glyph
  destination unchanged, so a fractional offset in a small design resolution
  that is then magnified with nearest sampling makes the glyph's OWN pixels
  come out uneven — and differently uneven each frame. That is a shimmer, not
  movement. `Math.round` the offset and it steps cleanly, for the same reason
  `subPixel` defaults to false. Whole pixels mean few steps, so the amplitude
  has to be large enough to give you several.
- **A shake is not a sine.** A sine moves the whole line as one body, which is
  a wave however fast you run it. A shake gives each glyph a direction
  unrelated to its neighbours: pick a random angle per glyph, hold it for a
  tick, interpolate to the next, and scale the whole thing by a decay if it is
  an impact rather than a state.

Starting points that look right across sizes, as fractions of the font size:
an amplitude around an eighth of it, a wavelength around ten times it, and a
little under 5 radians per second. For a shake, re-target each glyph roughly
20 to 40 times a second.

`ctx.time` starts when the effect is **assigned**, so attach it at the moment
you want to be t=0 — on the frame the hit lands, not when the label was built.
A label reused across lives carries the old clock, so a decay attached once
will already be spent the second time.

Both, whole:

```js
import { BitmapText } from "melonjs";

const title = new BitmapText(app.viewport.width / 2, 60, {
    font: "display",
    textAlign: "center",
    text: "JUNGLE RABBIT",
});
title.floating = true;
app.world.addChild(title);

// A wave: four pixels deep, a ~1.3s cycle, and a wavelength of roughly ten
// times the font size. Phase from ctx.x, offset rounded.
title.glyphEffect = (out, ctx) => {
    out.offsetY = Math.round(Math.sin(ctx.time * 0.005 + ctx.x * 0.02) * 4);
};

// A shake: each glyph picks its own direction, holds it for a tick, slides to
// the next, and the whole thing decays. Deterministic, so the same hit shakes
// the same way every time.
const angle = (i, tick) => {
    const h = Math.sin(i * 127.1 + tick * 311.7) * 43758.5453;
    return (h - Math.floor(h)) * Math.PI * 2;
};
const impact = (amplitude, durationMs, rate) => (out, ctx) => {
    const left = 1 - ctx.time / durationMs;
    if (left <= 0) {
        return;                              // settled; `out` is already zeroed
    }
    const amp = amplitude * left * left;
    const tick = (ctx.time / 1000) * rate;
    const held = Math.floor(tick);
    const k = tick - held;
    const a = angle(ctx.index, held);
    const b = angle(ctx.index, held + 1);
    out.offsetX = Math.round((Math.sin(a) + (Math.sin(b) - Math.sin(a)) * k) * amp);
    out.offsetY = Math.round((Math.cos(a) + (Math.cos(b) - Math.cos(a)) * k) * amp);
};

// assigned at the moment of the hit, which is what makes ctx.time start here
banner.setText("CAPSIZED!");
banner.glyphEffect = impact(3, 650, 24);
```

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

There is no `UIContainer` class. Use `Container` for a bare grouping,
`UIPanel` for anything with a background or a border (see below), or
`UIBaseElement` when you want the pointer handling and nothing drawn — it is a
`Container` that already sets `floating = true` and `isKinematic = false`.

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

### Panels and cards: `UIPanel`

A dialog, a menu card, a HUD frame: a rectangle with a fill, an optional
border and children on top. `UIPanel` is a `UIBaseElement`, so it is a
container that carries pointer events.

```js
import { UIPanel, Text } from "melonjs";

const card = new UIPanel(cx - 200, cy - 120, {
    width: 400, height: 240,
    fillColor: "#0a1526",                       // null leaves it transparent
    borderColor: "rgba(130, 200, 240, 0.55)",   // null for none
    borderWidth: 2,
    radius: 14,
});
card.addChild(new Text(200, 24, { text: "PAUSED", textAlign: "center" }));
app.world.addChild(card, -150);   // small depth: see the 3D section below
```

**`fillColor`, not `backgroundColor`.** `Container` already has a
`backgroundColor` and it does something else entirely: it is handed to
`clearColor` and wipes the whole render target, so a panel setting it repaints
the screen. The names here match `ProgressBarSettings`.

**The border is drawn INSIDE the box.** `width` and `height` are the outer
size, border included, so a panel never paints past the rectangle you gave it
and its `getBounds()`, which is what the pointer dispatcher hit-tests, stays
that rectangle. One thing to know with a `radius`: keep `borderWidth` at 2 or
more. A rounded border has to be stroked, and a stroke at exactly 1 goes out as
plain lines, which drops a pixel where each arc meets its straight edge. A
square border is four fills and is fine at 1.

**`blocking` (default `true`)** makes the panel consume clicks and hovers that
miss its children, which is what a dialog wants — a click on the card, or on
the dimmed scene behind it, must not reach the game. Children are unaffected:
the dispatcher asks a child before the container holding it. Set it `false` for
a frame drawn over a playfield that still has to receive clicks.

A full-screen panel with a translucent `fillColor` and `borderColor: null` is
the veil behind a modal, and it blocks for free.

**`bobAmplitude` / `bobPeriod`** give the panel the slow float an idle
dialogue or pause panel usually has, so a screen waiting for input does not
look frozen:

```js
card.bobAmplitude = 3;      // pixels either side; 2 to 4 is the usual range
card.bobPeriod = 2500;      // ms for a full up-and-down cycle
```

Three things to know. **The panel is clickable where it is drawn**: the offset
goes into `getAbsolutePosition()`, which is what the bounds pipeline reads, so
the hit area of the panel and of every widget inside it follows the float at
any depth. `pos` is left alone, so it still reads and writes the resting place.
It is fed from `update(dt)`, so it stops with the rest of the game on
`state.pause()` unless the panel sets `updateWhenPaused`, which a pause menu
does anyway. And do not go below an amplitude of 2: the offset is rounded to whole
pixels, so an amplitude of 1 has three positions to move through and twitches
instead of drifting.

One consequence worth knowing: `getBounds()` on a bobbing panel answers
differently each frame, so do not cache it or compare two children's bounds
while a bob is running.

### Panel art, title, dragging: `skin`, `title`, `draggable`

```js
const options = new UIPanel(20, 20, {
    width: 380, height: 460,
    // one atlas region, stretched as a nine-slice to the panel's size
    skin: { atlas, region: "grey_panel", insetx: 10, insety: 10 },
    title: "OPTIONS", titleFont: "kenpixel", titleFontSize: 20, titleFillStyle: "black",
    draggable: true,   // comes to the front when grabbed
});
```

The title sits at the top and the content starts below it. `insetx` /
`insety` are the unscaled corners of the art, and also where the frame ends:
layout `padding` is measured from there.

### Laying a panel out: `layout`

Leave `layout` at `"none"` and children stay where you put them. Otherwise
the panel places them, below the title and inside the frame:

```js
const menu = new UIPanel(x, y, {
    width: 360, height: 100,
    layout: "column",      // "row", "grid" (with `columns`), or "none"
    padding: 16,           // from the frame to the content
    gap: 12,               // between children
    align: "stretch",      // "start", "center", "end", or "stretch"
    autoSize: true,        // grow the panel to fit
});
menu.addChild(new UITextButton(0, 0, { text: "Play", onClick: play }));
menu.addChild(new UITextButton(0, 0, { text: "Options", onClick: openOptions }));
```

Children are laid out in the order they were added. It runs when a child is
added or removed and when the panel is resized, **not every frame**: a child
that changes size afterwards, a label whose text grew, needs
`menu.relayout()`. `"stretch"` resizes children that have a `resize` method,
which `UITextButton` and other containers do; a `Text` keeps its size.

A row inside a column is a second panel that draws nothing and lets clicks
through: `new UIPanel(0, 0, { width, height, layout: "row", blocking: false })`.

### Scrolling lists: `scroll`

```js
const levels = new UIPanel(420, 435, {
    width: 340, height: 150,
    layout: "grid", columns: 5, gap: 8, padding: 10,
    scroll: "vertical",    // "horizontal", "both", or "none"
});
```

The content is cropped to the area inside the frame and below the title, and
scrolls with the wheel over the panel and by dragging, with momentum when
flung. A scrollbar shows while it does not fit. `scrollTo(x, y)`,
`scrollToChild(child)`, `scrollX` / `scrollY`, `maxScrollX` / `maxScrollY` and
an `onScroll(x, y, panel)` setting are there to drive it from code.

What to know:

- **Scrolling moves the children.** Their `pos` is where they are drawn, so
  it changes as the list scrolls. A child added to a `"none"` layout while
  scrolled is placed in content coordinates and moved into view.
- **A drag that starts on a button scrolls the list and cancels the press.**
  The button gets `onCancel()` instead of `onRelease()`, and its `onClick`
  SETTING is not called. The `onClick()` METHOD already ran on the press, so
  a button in a list does its work in the setting: see the next section.
- **A slider in a scrolling panel is dragged, not the panel.** Any widget
  that sets `keepsDrag` keeps its drags.
- Children scrolled out of view do not get pointer events. Nested scrolling
  panels are not supported yet.

### A pause overlay: `updateWhenPaused` cascades

`state.pause()` stops every world child stepping while rendering carries on, so
the overlay that reads the key to UNPAUSE has to opt out:

```js
const overlay = new UIPanel(0, 0, { width: w, height: h, fillColor: "rgba(4,8,16,0.72)" });
overlay.updateWhenPaused = true;   // the whole subtree, not just this one
```

The flag covers the container's **entire subtree**, so nested labels, buttons
and the card inside the veil all keep stepping without being flagged one by
one. That matters for more than their `update`: `inViewport` is computed in the
same loop that honours the pause, so a skipped child keeps whatever it had —
`false` for one built while paused — and `Container.draw` then declines to draw
it, silently. A panel whose labels never appear while paused is this.

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

### A button that does one thing: `UITextButton`

No subclass needed for a single action:

```js
const play = new UITextButton(100, 200, {
    text: "Play",              // a CSS font by default ("sans-serif")
    size: 24,                  // pixels with a CSS font, a SCALE with a bitmap font
    onClick: () => state.change(state.PLAY),
});
```

**`onClick` is called on a COMPLETED click**: pressed and released over the
button, or its `bindKey` pressed and released. A press dragged off the button,
cancelled, or turned into a scroll does not call it, and neither does a
disabled button. The `onClick()` method is different: it runs on the press,
as before, for subclasses.

`font` is a loaded bitmap font's name, drawn with `BitmapText` as before, or
any other name, drawn as a CSS font with `Text`. The label is
`button.label` (`bitmapText` is the old name for it).

**Skinned** from an atlas, drawn as a nine-slice so one image makes a button
of any width:

```js
new UITextButton(0, 0, {
    font: "kenpixel", size: 12, text: "Accept", borderWidth: 160,
    skin: { atlas, normal: "green_button04", pressed: "green_button05" },
});
```

Pressed art is usually shorter than the normal art. The button draws it
lowered by the difference and moves the label down with it, so it looks
pushed in. `hover` and `disabled` regions are optional. `enabled = false`
draws the `disabled` region, or the button at half opacity, and ignores the
pointer and the key.

### Keyboard shortcuts on a button: `bindKey`

A `UITextButton` can be activated from the keyboard as well as the pointer:

```js
const resume = new UITextButton(x, y, {
    font: "PressStart2P", text: "RESUME",
    bindKey: input.KEY.ENTER,     // a keycode, or an action name you bound
});
```

It takes either an `input.KEY` keycode or the NAME of an action the game has
already bound. Neither form touches the global bindings, so a keycode works
even when nothing has called `input.bindKey` for it.

**The handlers fire with no `Pointer`.** This is the one that breaks existing
code: a button whose `onClick(event)` reads `event.gameX` worked for years
because only a pointer could ever press it, and the first key press throws.
Guard the argument, or keep pointer-only work out of the handler:

```js
onClick(event) {
    if (event) { this.ripple(event.gameX, event.gameY); }  // pointer only
    this.resumeGame();                                     // either input
}
```

Three more rules, each with a reason you can feel in a game:

- **The first input to press owns the button.** A pointer cannot release a key
  press and a key cannot release a pointer press, so a button cannot be left
  half pressed by using both at once.
- **Losing focus cancels a held key WITHOUT calling `onRelease()`.** If you
  use the pair as press and depress, firing while held, also stop on
  `event.BLUR` or the gun is still firing when the player alt-tabs back.
- **`isClickable` gates the press, not the release.** Disabling a button while
  its key is down still releases it, so it cannot stick.

Shortcuts live only while the button is activated, and never start dragging or
tap-and-hold: those stay pointer gestures.

### Checkboxes and radio buttons: `UICheckbox`

```js
const music = new UICheckbox(40, 60, {
    labelOn: "Music ON", labelOff: "Music OFF",   // or one `label`
    checked: settings.music,
    onChange: (on) => { settings.music = on; on ? audio.playTrack("theme") : audio.stopTrack(); },
});
```

The label is part of the widget: clicking it toggles the box, and removing
the checkbox takes the label with it. Drawn with primitives by default, or
`skin: { atlas, on, off, disabled? }`.

**Setting `checked` from code does NOT call `onChange`**, nor does
`toggle()`. Only the user does. Restoring saved settings into the widgets
therefore does not re-run the game logic attached to them, so apply what
they stand for yourself after restoring:

```js
music.checked = saved.music;       // the look only
applyMusic(saved.music);           // the effect, once
```

**Radio buttons** are checkboxes sharing a `group`: exactly one is checked,
clicking the checked one leaves it checked, and they are drawn round. Only
the one the user picked gets `onChange`, as in a web page; read the group with
`UICheckbox.checkedIn("difficulty")`. A checkbox is in its group while it is in
the scene.

### Sliders: `UISlider`

```js
const volume = new UISlider(40, 120, {
    label: "Music", showValue: true,
    format: (v) => Math.round(v * 100) + "%",
    min: 0, max: 1, step: 0.01, value: audio.getVolume(),
    length: 300,                           // orientation: "vertical" too
    onChange: (v) => audio.setVolume(v),   // every step of the drag
    onChangeEnd: () => saveSettings(),     // once, on release
});
```

Drag the thumb, or click the track to jump there. The drag follows the
pointer after it leaves the track, until it is released. The mouse wheel over
the slider moves it one `step`. `value` snaps to `step` and clamps to the
range, and setting it does not call `onChange` or `onChangeEnd`: the same rule
as the checkbox. `skin: { atlas, track, fill?, thumb, thumbHover? }` draws it
from art: the track and fill as nine-slices along its length, the thumb at its
own size.

Put work that should not run 60 times a second, such as saving or playing a
test sound, in `onChangeEnd`.

### A fullscreen option

Three methods on the `Application`, not on `device` (they moved there in
19.7.0):

```js
app.isFullscreen();        // boolean
app.requestFullscreen();   // needs a USER GESTURE
app.exitFullscreen();      // needs none
```

**`requestFullscreen` only works from a click or a key press.** Called at
startup, or from a timer, the browser rejects it and nothing happens. That is
why a fullscreen option lives on a menu entry or a key, never in a scene's
setup:

```js
import { event, input } from "melonjs";

input.bindKey(input.KEY.F, "fullscreen");
event.on(event.KEYDOWN, (action, keyCode, edge) => {
    // `edge` only: a held key auto-repeats, and a repeat toggles straight
    // back out of what it just turned on
    if (action !== "fullscreen" || !edge) {
        return;
    }
    if (app.isFullscreen()) {
        app.exitFullscreen();
    } else {
        app.requestFullscreen();
    }
});
```

One subscription on `KEYDOWN` covers every screen, where polling
`isKeyPressed` would need a copy in each menu that is up.

**It fullscreens the canvas's PARENT**, not the canvas, so a DOM HUD or
overlay inside that container goes with it. Pass an element to override.

**A menu entry showing `ON`/`OFF` must read the state back**, not cache it:
the player can leave fullscreen with Escape or the browser's own control
without your code hearing about it, and a remembered flag then lies.

```js
entry.setLabel(`FULLSCREEN: ${app.isFullscreen() ? "ON" : "OFF"}`);
```

**Nothing to branch on for support.** `requestFullscreen` checks
`device.hasFullscreenSupport` itself and no-ops without it, and
`exitFullscreen` no-ops when not fullscreen. Query
`device.hasFullscreenSupport` only to decide whether to *offer* the option at
all.

Fullscreen does not resize a fixed-resolution game: with
`new Application(w, h, { scale: "auto" })` the internal resolution is
unchanged and only the canvas scales, so a HUD built from
`renderer.width`/`height` needs no repositioning.

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

## When the UI misbehaves

| symptom | cause | fix |
|---|---|---|
| loading saved settings plays the music, saves again or fires game logic | the game called its own change handler while restoring | set `checkbox.checked` / `slider.value`, which never call `onChange`, then apply the setting once yourself |
| `onChange` never fires when settings are restored | by design: only user input calls it | apply the restored value yourself |
| a button in a scrolling list fires when the user only meant to scroll | the work is in the `onClick()` METHOD, which runs on the press | use the `onClick` SETTING, called on a completed click; a scroll cancels the press |
| a button scrolled out of a hand-made list still gets clicks | its container does not clip, so the pointer still finds it where it moved to | use `UIPanel`'s `scroll`, or set `clipping` on the container: since 20.13 the pointer skips children outside a clipping container |
| a layout ignores a label that changed size | layout runs on add, remove and resize only | call `panel.relayout()` |
| `new UITextButton` with a font name draws in a plain font | the name is not a loaded bitmap font, so it is drawn as a CSS font | load the bitmap font (image and `.fnt`) under that name, or load the web font |

## Related skills

- `melonjs-scenes-and-state` — `Tween` and the easing families, for animating any of this
- `melonjs-input` — which object gets a pointer event, and how to consume it
- `melonjs-loading-assets` — web fonts have to be loaded before a `Text` bakes
