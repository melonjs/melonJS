---
name: melonjs-ui-and-text
description: "Use this skill for HUDs, buttons, menus, options screens, dialogue panels, progress bars and on-screen text in melonJS. Covers UIBaseElement/UISpriteElement/UITextButton, UICheckbox, UISlider, ProgressBar, UIPanel (skins, layout, scrolling), keyboard and gamepad focus, Draggable and DropTarget, the floating screen-space container pattern, which of two overlapping panels gets the pointer, Text and BitmapText, web font loading, and NineSliceSprite panels. Triggers on: UI, HUD, button, checkbox, radio button, slider, volume slider, options menu, settings screen, scrolling list, UI skin, progress bar, health bar, menu, dialogue, moveToTop, onOver, onClick, bindKey, keyboard shortcut, Tween, animate a label, wavy text, glyphEffect, rainbow text, typewriter, visibleRatio, drag and drop, isDraggable, focus, fillStyle, fillGradient, gradient text, tint, font, fontface, wordWrapWidth, score display, fullscreen, requestFullscreen, fullscreen button."
license: MIT
---

# UI, HUD and text

## Outlined text: behind the glyphs, or over them

An outline is centred on the glyph's edge, so half of it lies inside the
glyph. `Text` paints it **behind** the glyphs by default (`paintOrder:
"stroke"`): the letters stay whole and the outline shows only around them, so
a thick outline works on any face. What shows is half of `lineWidth`: ask for
twice the width you want to see.

`paintOrder: "fill"` paints the glyphs first and the outline over them, as a
plain canvas does with `fillText` then `strokeText`, and as melonJS did before
20.13. Its inner half then covers the letters: on a small or thin face a
`lineWidth` of 3 already leaves them solid outline colour.

```js
const style = {
    font: "sans-serif", size: 32,
    fillStyle: "#ffd23f", strokeStyle: "#1b1b1b", lineWidth: 6,
};
new Text(x, y, { ...style, text: "BEHIND" });                     // the default
new Text(x, y, { ...style, paintOrder: "fill", text: "OVER" });   // the old look
```

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

The outline's corners are set by `lineJoin`, the same property a canvas
context has, and `miterLimit`:

| setting | corners | use it for |
|---|---|---|
| `lineJoin: "round"` (default) | rounded: the outline is the same width all around | almost everything: HUDs, buttons, titles |
| `lineJoin: "bevel"` | cut flat | a harder edge with no spikes |
| `lineJoin: "miter"` | pointed, as a plain canvas strokes text | a sharp, angular look |
| `miterLimit: n` (default 10) | with `"miter"` only: a corner pointing further than `n` half line widths is cut flat instead | taming the spikes `"miter"` grows on "A", "V", "M" |

At the canvas default of 10, a thick `"miter"` outline grows spikes several
times its width from sharp glyphs; 2 to 4 keeps the corners pointed and the
spikes short:

```js
const outline = {
    font: "sans-serif", size: 48,
    fillStyle: "#ffffff", strokeStyle: "#000000", lineWidth: 6,
};
new Text(x, y, { ...outline, text: "ROUND" });                    // the default
new Text(x, y, { ...outline, lineJoin: "bevel", text: "BEVEL" });
new Text(x, y, { ...outline, lineJoin: "miter", text: "MITER" }); // long spikes
new Text(x, y, { ...outline, lineJoin: "miter", miterLimit: 3, text: "MITER 3" });
```

Whichever you pick, the bake leaves room for it on all four sides, so no corner
is cut and the label's position and bounds do not move; pointed corners just
cost a bigger texture. Changed on a live label, they show from the next
`setText()`.

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

Given a string, it returns a new `TextMetrics` and leaves the label as it was;
with no argument it returns the label's own metrics. Before 20.13 measuring
another string overwrote the label's own metrics, so a centred or
right-aligned label was drawn shifted until its next `setText()`.

Advance widths scale linearly with the point size for one family, so measuring
on an existing label and scaling the result is exact. For labels you genuinely
spawn in bulk, `getPool("text")` recycles the bake.

### Multi-line text: the baseline places the whole block

A `\n` in the string (or an array of strings) starts a new line, on `Text` and
`BitmapText` alike. `textBaseline` then places the block as one piece against
`pos.y`: its top for `"top"` / `"hanging"`, its middle for `"middle"`, its
bottom for `"alphabetic"`, `"ideographic"` and `"bottom"`. So a two-line
`"bottom"` label in a screen corner sits wholly above `pos.y`, and a centred
`"middle"` label centres every line, not the first. `getBounds()` is that same
box, which is what culling and the pointer use.

`wordWrapWidth` only ADDS line breaks: each `\n`-separated line is wrapped on
its own, so explicit breaks and blank lines survive. A line breaks between
words, never inside one, so a single word wider than `wordWrapWidth` gets a
line of its own and overflows it:

```js
const help = new Text(8, 8, {
    font: "sans-serif", size: 16, wordWrapWidth: 200,
    text: "CONTROLS\nArrows move, Space jumps, Esc pauses the game.",
});
// "CONTROLS" on its own line, then the sentence wrapped under it
```

### Typewriter reveal: `visibleRatio`

`visibleCharacters` (`-1`, the default, shows them all) and `visibleRatio`
(0 to 1) show a label a character at a time, on `Text` and `BitmapText` alike.
Tween the ratio: it takes the same time whatever the length of the string.

```js
line.setText("The door is locked. The keeper has the key.");
line.visibleRatio = 0;
new Tween(line).to({ visibleRatio: 1 }, { duration: 1500 }).start();
```

Line breaks are not counted, and the wrapping and the bounds are those of the
whole string, so a word does not jump to the next line as it appears. The two
classes differ in two ways. A `BitmapText` keeps each glyph where the full line
puts it, while a centred or right-aligned `Text` aligns only the part shown so
far, so it slides sideways as it types: left-align a `Text` you reveal. And a
`Text` repaints and re-uploads its bake at every step, where a `BitmapText`
just draws fewer glyphs.

### `fillStyle` means two different things

The name is shared and the behaviour is not, which is the trap when moving a
label from one class to the other:

| | `Text` | `BitmapText` |
|---|---|---|
| what `fillStyle` holds | a real `Color`, the fill | `Renderable#tint`, under another name |
| white | white glyphs | the ABSENCE of a tint |
| gradient | yes, via `fillGradient` | no: a tint is one colour over a page image |
| recolour it later | `label.fillStyle.parseCSS("#ff4040")` — the field is a `Color` with no setter, and ASSIGNING a string replaces it, after which the glyphs stop filling entirely and nothing is logged | `label.fillStyle = "#ff4040"` — a real setter that parses the string |
| stroke | `strokeStyle` + `lineWidth`, behind or over the glyphs with `paintOrder`, corners with `lineJoin` / `miterLimit` | none |
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

`ctx.time` runs only while an effect is set and nothing resets it, so it is 0
only when a label gets its **first** effect. A label that already had one, or
is reused across lives, carries the old clock, and a decay measured from
`ctx.time` itself is already spent there. Note `ctx.time` on the effect's first
call and measure from that, as the shake below does, and attach it at the
moment you want to be t=0: on the frame the hit lands, not when the label was
built.

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
const impact = (amplitude, durationMs, rate) => {
    let start;                               // ctx.time on the first call
    return (out, ctx) => {
        start ??= ctx.time;                  // the label's clock never resets
        const t = ctx.time - start;
        const left = 1 - t / durationMs;
        if (left <= 0) {
            return;                          // settled; `out` is already zeroed
        }
        const amp = amplitude * left * left;
        const tick = (t / 1000) * rate;
        const held = Math.floor(tick);
        const k = tick - held;
        const a = angle(ctx.index, held);
        const b = angle(ctx.index, held + 1);
        out.offsetX = Math.round((Math.sin(a) + (Math.sin(b) - Math.sin(a)) * k) * amp);
        out.offsetY = Math.round((Math.cos(a) + (Math.cos(b) - Math.cos(a)) * k) * amp);
    };
};

// a new impact at the moment of each hit: it measures from its own first call,
// so it shakes again on a banner that has shown one before
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

### Which widget for what

| you want | use | notes |
|---|---|---|
| a button with a label | `UITextButton` | drawn, or skinned from an atlas; `onClick` setting |
| an image-only button or icon | `UISpriteElement` | a `UIBaseElement` holding a `Sprite` (`sprite`); override `onClick` |
| an on/off option, or one of several | `UICheckbox` | a radio button with `group` |
| a value in a range: volume, sensitivity | `UISlider` | horizontal or vertical |
| health, shield, cooldown, loading | `ProgressBar` | not clickable; `value` redraws |
| a frame, dialog or menu card | `UIPanel` | skin, title, layout, scrolling, drag, shadow |
| your own clickable widget | extend `UIBaseElement` | pointer handlers, `enabled`, focus, bounce |
| a group with nothing drawn | `Container` | set `floating` for screen space |

### A whole options menu

Everything below in one place: a skinned panel that lays its widgets out
as a column, a checkbox, a slider, two buttons, a drop shadow, a little
bounce, and keyboard / gamepad play. Each piece has its own section after
this.

```js
import {
    UICheckbox, UIPanel, UISlider, UITextButton, audio, state,
} from "melonjs";

// one style object for every widget's text
const FONT = { font: "kenpixel", fontSize: 14, labelFillStyle: "black" };

const menu = new UIPanel(40, 40, {
    width: 360, height: 100,           // autoSize grows the height to fit
    skin: { atlas, region: "grey_panel", insetx: 10, insety: 10 },
    title: "OPTIONS", titleFont: "kenpixel", titleFontSize: 20,
    layout: "column", padding: 16, gap: 12, align: "stretch", autoSize: true,
    shadowColor: "#00000059", shadowOffsetY: 6, shadowBlur: 10, radius: 6,
});

const music = menu.addChild(new UICheckbox(0, 0, {
    ...FONT,
    labelOn: "Music ON", labelOff: "Music OFF",
    checked: settings.music,
    onChange: (on) => { settings.music = on; },   // user input only
}));

menu.addChild(new UISlider(0, 0, {
    ...FONT,
    label: "Volume", showValue: true,
    valueFormat: (v, ratio) => `${Math.round(ratio * 100)}%`,
    value: audio.getVolume(),
    onChange: (v) => audio.setVolume(v),           // while dragging
    onChangeEnd: () => saveSettings(),             // once, on release
}));

menu.addChild(new UITextButton(0, 0, {
    ...FONT, text: "Back", height: 40,
    hoverScale: 1.04, pressScale: 0.96,            // the bounce
    onClick: () => state.change(state.MENU),       // a completed click
}));

app.world.addChild(menu, 10);
music.focus();   // arrows / D-pad and Enter / A now drive the menu
```

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
hp.max = 50;                           // re-clamps the value into the new range
```

`direction` takes `"left-to-right"` (the default), `"right-to-left"`,
`"top-to-bottom"` or `"bottom-to-top"`, each growing from its own edge.

`showLabel: true` writes text centred over the bar, a percentage by default:
`` labelFormat: (value, ratio) => `${Math.round(value)} HP` `` changes what it says,
and `font` (a CSS family), `fontSize` and `labelFillStyle` how it looks.
`onChange(value, ratio, bar)` is called on every change of the value, from code
too, unlike a checkbox's or a slider's: a bar has no user input to tell apart.
Setting the value it already has calls nothing.

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

**A drop shadow**, here or on a `ProgressBar`, takes a colour whose alpha is
how dark it gets: `shadowColor: "#00000059"`, with `shadowOffsetX` (0),
`shadowOffsetY` (4) and `shadowBlur` (8 pixels of soft edge, `0` for sharp).
There is none until `shadowColor` is set.

```js
const card = new UIPanel(100, 80, {
    width: 300, height: 180, fillColor: "#f0f0f0", radius: 8,
    shadowColor: "#00000059",   // about 35% black
    shadowOffsetY: 6,           // drops it below the card
    shadowBlur: 10,             // pixels of soft edge
});
const hp = new ProgressBar(20, 20, {
    width: 200, height: 16, radius: 8,
    shadowColor: "#00000080", shadowOffsetY: 2, shadowBlur: 4,
});
```
It follows `radius`, which a skinned panel can set to match its art's
corners, and it is drawn outside the bounds, so it never takes the pointer.
Under a see-through fill or track it shows through; give that a solid colour.

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
`menu.relayout()`. `"stretch"` resizes buttons and panels, which lay
themselves out again at a new size; anything else keeps its size.

A row inside a column is a second panel that draws nothing and lets clicks
through: `new UIPanel(0, 0, { width, height, layout: "row", blocking: false })`.

### Scrolling lists: `scroll`

```js
const levels = new UIPanel(420, 435, {
    width: 340, height: 150,
    layout: "grid", columns: 5, gap: 8, padding: 10,
    scroll: "vertical",    // "horizontal", "both", or "none"
    onScroll: (x, y, panel) => { saved.levelScroll = y; },
});
const buttons = [];
for (let i = 1; i <= 30; i++) {
    buttons[i] = levels.addChild(new UITextButton(0, 0, {
        text: String(i), width: 56, height: 40,
        enabled: i <= unlocked,
        onClick: () => startLevel(i),
    }));
}
levels.scrollTo(0, saved.levelScroll);                 // restore where it was
levels.scrollToChild(buttons[unlocked]);               // or show the latest
```

The content is cropped to the area inside the frame and below the title, and
scrolls with the wheel over the panel and by dragging, with momentum when
flung. A scrollbar shows while it does not fit. `scrollTo(x, y)`,
`scrollToChild(child)`, `scrollX` / `scrollY`, `maxScrollX` / `maxScrollY` and
an `onScroll(x, y, panel)` setting are there to drive it from code. Scrolling
from code stops a fling that is still coasting. `clearChildren()` empties the
list and scrolls back to the start, ready to be filled again, and `autoSize`
is ignored on a scrolling panel.

What to know:

- **Scrolling moves the children.** Their `pos` is where they are drawn, so
  it changes as the list scrolls. A child added to a `"none"` layout while
  scrolled is placed in content coordinates and moved into view.
- **A drag that starts on a button scrolls the list and cancels the press.**
  The button gets `onCancel()` instead of `onRelease()`, and its `onClick`
  SETTING is not called. The `onClick()` METHOD already ran on the press, so
  a button in a list does its work in the setting: see the next section.
- **A slider in a scrolling panel is dragged, not the panel.** A widget of
  your own that is dragged too, a knob or a colour picker, sets
  `keepsDrag = true` to keep its drags.
- Children scrolled out of view do not get pointer events. A scrolling panel
  inside another scrolls alone, and is cropped to both: a clip inside a clip
  is the overlap of the two, on Canvas, WebGL and WebGPU alike.
- A draggable panel is moved by its title or its frame. A press on a widget
  on it is the widget's.

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

Every UI element already registers itself for pointer events, so a button is
made by overriding methods rather than by wiring `registerPointerEvent`. For
an image-only button that is `UISpriteElement`: a `UIBaseElement` holding a
`Sprite`, placed like a sprite (`(x, y)` is where its anchor goes, the centre
by default):

| handler | fires | returns |
|---|---|---|
| `onClick(event)` | pressed | `false` to stop the event propagating |
| `onRelease(event)` | the press ends (up, left while held, or cancelled) | `false` to stop propagating |
| `onOver(event)` | pointer enters | `false` to stop propagating |
| `onOut(event)` | pointer leaves, or the element is removed while hovered (no event then) | — |
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
        this.setRegion(atlas.getRegion("speaker_off.png"));   // or this.sprite.setRegion
        return false;          // consumed (the default)
    }
}
```

Undo in `onOut` whatever `onOver` set up (a tooltip, a highlight, a cursor):
it also runs when the element leaves the world while the pointer is on it,
removed on its own, with the panel holding it, or with the scene, so nothing
is left behind. Keep effects that should only follow the pointer (a sound, a
tween) out of it, or check `event`, which is `undefined` for a removal.

The image is `button.sprite`: animations, tint and regions live there
(`setRegion`, `addAnimation`, `setCurrentAnimation` and `isCurrentAnimation`
are also on the element as shortcuts). As a `UIBaseElement` it has
`enabled` (drawn at half opacity when off), `cancelPress()` / `onCancel()`,
the bounce, and focus once `focusable` is set. `pos` is the element's top
left corner, and a second sprite of your own, such as a joystick's knob, is
a child added with `addChild`, not drawn by hand in `draw()`.

**A press stops at a UI element by default.** `onClick` and `onRelease`
return `false` unless you override them, on every `UIBaseElement` (buttons,
checkboxes, sliders, sprite buttons, your own widgets): a click on
a HUD button does not also click the world behind it. Return `true` from
them to let the press through as well. Hover is different: `onOver` lets it
through unless it returns `false`. A non-blocking `UIPanel` lets a press on
its background through, as a frame that only decorates should.

The pointer still has to reach it: a renderable with `isKinematic = true` — the
default on a plain `Renderable` — is skipped by the broadphase and receives
nothing. Every `UIBaseElement` clears it for you; anything else
you make clickable has to clear it itself.

### A button that does one thing: `UITextButton`

No subclass needed for a single action:

```js
const play = new UITextButton(100, 200, {
    text: "Play",              // a CSS font by default ("sans-serif")
    fontSize: 24,              // pixels, with a CSS font or a bitmap font
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
`button.label` (`bitmapText`, its old name, is deprecated since 20.13.0).

With no skin it is a rounded rectangle in `hoverOffColor`, `hoverOnColor`
under the pointer and `pressedColor` while held (`hoverOnColor` when left
out), outlined in `borderColor`.

The button takes the same names as the other widgets: `width` and `height`
for its size, `fontSize` (pixels) and `labelFillStyle` for its text,
`borderColor` for its outline. The older `borderWidth` / `borderHeight`
(its SIZE, not an outline thickness), `size` (a scale with a bitmap font)
and `fillStyle` still work. One style object can then go to every widget:

```js
const FONT = { font: "kenpixel", fontSize: 14, labelFillStyle: "black" };
new UITextButton(0, 0, { ...FONT, text: "OK", width: 160 });
new UICheckbox(0, 0, { ...FONT, label: "Music" });
new UISlider(0, 0, { ...FONT, label: "Volume" });
```

**Skinned** from an atlas, drawn as a nine-slice so one image makes a button
of any width:

```js
new UITextButton(0, 0, {
    font: "kenpixel", fontSize: 12, text: "Accept", width: 160,
    skin: { atlas, normal: "green_button04", pressed: "green_button05" },
});
```

Pressed art is usually shorter than the normal art. The button draws it
lowered by the difference and moves the label down with it, so it looks
pushed in. `hover` and `disabled` regions are optional. `enabled`, shared by
every UI element, turns a widget off: `enabled = false`
draws the `disabled` region, or the button at half opacity, and ignores the
pointer and the key.

### A little bounce: `hoverScale` and `pressScale`

Every `UIBaseElement`, buttons, checkboxes, sliders, panels and your own,
can grow a little under the pointer or with the focus, and shrink while held
(`ProgressBar` is not a `UIBaseElement`, and does not):

```js
new UITextButton(0, 0, { text: "Play", hoverScale: 1.05, pressScale: 0.92 });
levelButton.hoverScale = 1.12;   // or set it later
```

Both default to 1, which is still. The scale eases there and back by itself.
Only the drawing scales, about the centre: the hit area and the layout stay
put, so nothing jitters and the widgets around it do not move.

### Keyboard and gamepad navigation: `focus()`

For a game played without a mouse or a touch screen, give a widget the focus:

```js
playButton.focus();     // where keyboard or gamepad play starts
```

From then on the arrow keys or a pad's D-pad move the focus to the nearest
focusable widget that way. Enter, Space or the pad's A press the focused
widget as a click does: a button calls its `onClick` setting, a checkbox
toggles. Left and right step a slider (up and down on a vertical one). A ring
(`UIBaseElement.focusRingColor`) shows the focus, and hides while the mouse
is used. A focused widget in a scrolling panel is scrolled into view.

There is nothing to turn on. Until a widget has the focus the arrow keys and
the pad are left to the game, and `widget.blur()`, or the focused widget
leaving the scene, gives them back. `UIBaseElement.focusOwner` is the widget
with the focus. The pad is read directly, so the game's own pad bindings
are untouched. The keys the focus takes, and a button's own `bindKey`, do not
scroll the page around the game, which matters in a portal's frame (20.15.1;
before, `input.bindKey` the arrows and Space). A key the game bound itself
follows its binding's `preventDefault`, and `input.setPreventDefault(false)`
leaves the focus keys to the browser as well.

Buttons, checkboxes and sliders are `focusable`. A widget of your own sets
`focusable = true`, and overrides `onNavigate(direction)` (return `true` for
what it handles) and `focusRelease()` for what Enter does:

```js
// a left / right picker: "< Normal >"; Enter confirms the choice
class Picker extends UIBaseElement {
    constructor(x, y, options, onPick) {
        super(x, y, 200, 32);
        this.focusable = true;
        this.options = options;
        this.onPick = onPick;
        this.index = 0;
        // draw() left out: render this.options[this.index]
    }
    onNavigate(direction) {
        if (direction === "left" || direction === "right") {
            const step = direction === "left" ? -1 : 1;
            this.index = (this.index + step + this.options.length) % this.options.length;
            this.isDirty = true;
            return true;    // handled: the focus stays here
        }
        return false;       // up and down move the focus on
    }
    focusRelease() {
        super.focusRelease();   // the widget comes back up, as on a click
        this.onPick(this.options[this.index]);
    }
}
```

Moving the focus from code is `other.focus()`; `UIBaseElement.focusOwner?.blur()`
hands the keys back to the game, for example when gameplay resumes.

Three things to know. Enter and Space go to the focused widget, so another
button whose `bindKey` is Enter or Space waits while any other widget has the
focus, ring shown or hidden: one key press never clicks both. `blur()` the
focused widget to give Enter back to the shortcut (a disabled or hidden
focused widget does not keep it). Enter or A held while the window loses
focus is called off (`onCancel()`, no click), as a held `bindKey` is. And
accept calls a subclass's `onClick()` METHOD with no pointer event, as
`bindKey` does: guard `event` there, or act in the `onClick` setting.

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
- **A held key that is called off goes to `onCancel()`, not `onRelease()`.**
  That happens when the window loses focus, the button is removed, or it is
  disabled (`enabled = false`) while the key is down. If you use the pair as
  press and depress, firing while held, stop in `onCancel()` too, or the gun
  is still firing when the player alt-tabs back.
- **`isClickable` alone gates the press, not the release.** Clearing it while
  the key is down still lets the key release the button, so it cannot stick.

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
`skin: { atlas, on, off, hoverOn?, hoverOff?, disabledOn?, disabledOff? }`.
`boxSize`, `boxColor`, `boxHoverColor` and `checkColor` style the drawn box,
and `labelOn` / `labelOff` can be changed later: the widget refits.

**Setting `checked` from code does NOT call `onChange`**, nor does
`toggle()`. Only the user does. Restoring saved settings into the widgets
therefore does not re-run the game logic attached to them, so apply what
they stand for yourself after restoring:

```js
music.checked = saved.music;       // the look only
applyMusic(saved.music);           // the effect, once
```

**Radio buttons** are checkboxes sharing a `group`: exactly one is checked,
clicking the checked one leaves it checked (so does `toggle()`; set
`checked = false` to clear a group on purpose), and they are drawn round. Only
the one the user picked gets `onChange`, as in a web page; read the group with
`UICheckbox.checkedIn("difficulty")`. A checkbox is in its group from when it is
made until it is destroyed, so the group holds one choice, and `checkedIn`
answers, before the panel is ever added to the world.

```js
for (const level of ["Easy", "Normal", "Hard"]) {
    panel.addChild(new UICheckbox(0, 0, {
        label: level,
        group: "difficulty",
        checked: level === saved.difficulty,
        onChange: (on) => { if (on) { saved.difficulty = level; } },
    }));
}
// later: the checked UICheckbox of the group, or undefined
const picked = UICheckbox.checkedIn("difficulty");
```

**Skinned** from an atlas (the region names are your art's; these are the
UI example's):

```js
new UICheckbox(0, 0, {
    label: "Sound FX",
    skin: {
        atlas,
        on: "green_boxCheckmark",
        off: "grey_boxCheckmark",
        // optional: hoverOn, hoverOff, disabledOn, disabledOff
    },
});
```

### Sliders: `UISlider`

```js
const volume = new UISlider(40, 120, {
    label: "Music", showValue: true,
    valueFormat: (v, ratio) => Math.round(ratio * 100) + "%",
    min: 0, max: 1, step: 0.01, value: audio.getVolume(),
    length: 300,                           // orientation: "vertical" too
    onChange: (v) => audio.setVolume(v),   // every step of the drag
    onChangeEnd: () => saveSettings(),     // once, on release
});
```

Drag the thumb, or click the track to jump there. The drag follows the
pointer after it leaves the track, until it is released. As on any widget, the
press (`onClick`) ends in exactly one of `onRelease` (let go, before
`onChangeEnd`) or `onCancel` (called off by `cancelPress()`, `enabled = false`
or removal, with no `onChangeEnd`). The mouse wheel over
the slider moves it one `step`. `value` snaps to `step` and clamps to the
range, and setting it does not call `onChange` or `onChangeEnd`: the same rule
as the checkbox, and neither does changing `min`, `max` or `step`, which
re-clamp it. `ratio` reads where it is from 0 to 1, and `valueFormat` gets
both. `labelText` changes the caption later. The slider refits to its texts
(the widest value it can show, at either end of the range), and on a
horizontal one the value moves below the track when it would run into the
caption; a `UIPanel` holding it needs `relayout()` if its size changes. `thumbColor`, `thumbHoverColor`, `thumbBorderColor` and
`thumbBorderWidth` style the drawn thumb. `skin: { atlas, track, fill?, thumb, thumbHover? }` draws it
from art: the track and fill as nine-slices along its length, the thumb at its
own size.

Put work that should not run 60 times a second, such as saving or playing a
test sound, in `onChangeEnd`, which runs once on release and after each wheel
or key step.

```js
// whole numbers: a step of 1 shows "7", not "7.00"
new UISlider(0, 0, { label: "Difficulty", showValue: true, min: 1, max: 10, step: 1, value: 5 });

// vertical, 160 pixels tall: up raises it
new UISlider(0, 0, { orientation: "vertical", length: 160, value: 0.5 });

// skinned: the track and fill stretch, the thumb keeps its size
new UISlider(0, 0, {
    length: 240,
    // optional: fill (the part before the thumb), thumbHover
    skin: { atlas, track: "grey_sliderHorizontal", thumb: "blue_sliderDown" },
});
```

With no `valueFormat`, the value text shows as many decimals as `step`
has, and follows a later change of `step`.

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

### Dragging: `isDraggable`, or `Draggable` and `DropTarget`

Any UI element follows the pointer while held once `isDraggable` is set:
`onClick` is the pick-up, `onMove(event)` runs after each move with `pos`
already following, and `onRelease` is the drop. It works by touch as by
mouse, on a floating element as on one in the world. (`UIPanel` has its own
`draggable` setting, above.)

```js
class Token extends UISpriteElement {
    constructor(x, y) {
        super(x, y, { image: atlas, region: "token" });
        this.isDraggable = true;
    }
    onRelease() {
        this.pos.x = Math.round(this.pos.x / 32) * 32;   // snap to the grid
        this.pos.y = Math.round(this.pos.y / 32) * 32;
        return false;
    }
}
```

When something else has to notice the drop, `Draggable` and `DropTarget` are
the pair. Both are plain `Renderable`s, in the world unless you make them
`floating`, that draw nothing until you give them a `draw()`. A `Draggable`
follows the pointer while held (`dragStart(e)` / `dragEnd(e)` to override,
calling `super`), and when it is let go every `DropTarget` its bounds overlap
gets `drop(draggable)`; after `setCheckMethod(target.CHECKMETHOD_CONTAINS)`
only one it lies wholly inside does.

```js
class Slot extends DropTarget {
    drop(card) {
        card.pos.set(this.pos.x, this.pos.y, card.pos.z);   // settle it in
    }
}
```

The drop is checked on the draggable's own pointer-up (`event.DRAGEND` comes
from it), so the release has to land on the draggable itself.

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

`UIPanel`'s `skin` and `UITextButton`'s `skin` already do this for you. By
hand, from a texture atlas, the third argument of `createSpriteFromName` asks
for the 9-slice version:

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
consuming is what stops a widget underneath answering too. A press is consumed
by default on a UI element, but hover is not, so a panel of your own that can
overlap another one also stops hover (`UIPanel` does all of this with
`blocking`):

```js
class Panel extends UIBaseElement {
    onClick() {
        this.ancestor.moveToTop(this);  // and bring it to the front
        return false;                   // consumed (the default)
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
| clicking a HUD button also clicks the world behind it (before 20.13) | a `UIBaseElement` let presses through by default | update: presses now stop at UI elements; a handler that returns `true` still lets them through |
| a custom widget no longer lets clicks reach what is behind it (since 20.13) | presses stop at UI elements by default | return `true` from its `onClick` / `onRelease` |
| a button scrolled out of a hand-made list still gets clicks | its container does not clip, so the pointer still finds it where it moved to | use `UIPanel`'s `scroll`, or set `clipping` on the container: since 20.13 the pointer skips children outside a clipping container |
| a layout ignores a label that changed size | layout runs on add, remove and resize only | call `panel.relayout()` |
| the arrow keys or the pad do nothing in a menu | no widget has the focus: nothing listens until one does | call `firstWidget.focus()` when the menu opens |
| the arrow keys stop moving the player after a menu | a widget still has the focus | `UIBaseElement.focusOwner?.blur()`, or remove the menu: a focused widget leaving the scene gives the keys back |
| the arrow keys scroll the page around the game while they move the focus, in a portal's frame | melonJS before 20.15.1 stopped the page scrolling only for keys bound with `input.bindKey`; from 20.15.1, `input.setPreventDefault(false)` | update, or `input.bindKey` the arrows and Space; leave `input.setPreventDefault` on |
| a `bindKey: ENTER` button does not fire while another widget is focused | Enter and Space go to the focused widget, ring shown or not, so one press never clicks both | focus that button, `blur()` the focused one, or bind another key |
| a tooltip or highlight shown in `onOver` stays after its widget is removed (before 20.14) | the pointer's leave never reaches a removed widget | update: a widget removed while hovered now gets `onOut()`, with no event |
| an `onOut` sound or tween plays when a menu closes or the scene changes (since 20.14) | a widget removed while hovered gets `onOut()` | keep pointer-only effects out of `onOut`, or skip them when its `event` is `undefined` |
| a widget removed while held gets `onCancel()` and no `onRelease()` | the pointer-up never reaches a removed widget, so the press is called off (and `hover` cleared), leaving it at rest when added back | stop what `onClick()` started in `onCancel()` as well as in `onRelease()` |
| a `ProgressBar` fill runs past its track after `max` is lowered (before 20.13) | `min` and `max` did not re-clamp the value | update: they re-clamp it now (and call `onChange` if it moved); `ratio` stays within 0..1 |
| a skinned panel's shadow has square corners | the shadow follows `radius`, and a skin does not set it | set `radius` to the art's corner size |
| a wrapped label lost its `\n` line breaks, or starts with a blank line (before 20.13) | word wrap joined the lines with spaces, and closed an empty line before an over-wide first word | update: each line is now wrapped on its own and an over-wide word starts the first line |
| the second line of a multi-line `"bottom"` or `"middle"` `Text` is drawn below where you put it, or outside its bounds (before 20.13) | `Text` placed only the first line by its baseline | update: the whole block is placed by the baseline, as `BitmapText` does |
| `setText("1,000")` leaves a label showing `["1", "000"]` on two lines, or the other way round (before 20.13) | the change test compared `toString()`, and an array's joins with commas | update |
| a centred or right-aligned label jumps sideways, or is clipped, after `label.measureText("…")` (before 20.13) | measuring another string overwrote the label's own metrics until its next `setText()` | update, or measure on a label that is not displayed |
| `new UITextButton` with a font name draws in a plain font | the name is not a loaded bitmap font, so it is drawn as a CSS font | load the bitmap font (image and `.fnt`) under that name, or load the web font |
| `UI skin: no region named "…" in the atlas` thrown where a widget is made | every region a `skin` names is looked up when the widget is built | fix the name, or re-export the atlas with that image |
| a typewriter reveal on a centred `Text` slides sideways as it types | a `Text` aligns only the part shown so far | left-align it, or reveal a `BitmapText`, which keeps each glyph in its final place |
| a `glyphEffect` decay or intro plays the first time and never again | `ctx.time` runs while any effect is set and never resets, so a later effect starts late | note `ctx.time` on the effect's first call and measure from that |

## Related skills

- `melonjs-scenes-and-state` — `Tween` and the easing families, for animating any of this
- `melonjs-input` — which object gets a pointer event, and how to consume it
- `melonjs-loading-assets` — web fonts have to be loaded before a `Text` bakes
