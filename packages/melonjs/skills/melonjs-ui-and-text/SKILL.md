---
name: melonjs-ui-and-text
description: "Use this skill for HUDs, buttons, menus, dialogue panels and on-screen text in melonJS. Covers UIBaseElement/UISpriteElement/UITextButton, Draggable and DropTarget, the floating screen-space container pattern, Text and BitmapText, web font loading, and NineSliceSprite panels. Triggers on: UI, HUD, button, UIBaseElement, UISpriteElement, UITextButton, Draggable, DropTarget, menu, dialogue, Text, BitmapText, font, fontface, wordWrapWidth, NineSliceSprite, score display, floating."
license: MIT
---

# UI, HUD and text

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

Relayout on resize by listening for `event.CANVAS_ONRESIZE`.

## Buttons and interactive elements

Use the built-ins rather than hand-rolling — they set `isKinematic = false` for
you, which is the trap that stops hand-rolled buttons receiving clicks at all.

```js
class PlayButton extends UISpriteElement {
    constructor(x, y) {
        super(x, y, { image: atlas, region: "play.png" });
    }
    onClick()   { state.change(state.PLAY); return false; }
    onOver()    { this.setOpacity(1.0); }
    onOut()     { this.setOpacity(0.8); }
    onRelease() { return false; }
}
```

| class | for |
|---|---|
| `UIBaseElement` | a `Container` base — clickable, optionally draggable and holdable |
| `UISpriteElement` | a `Sprite`-backed button with hover/press callbacks |
| `UITextButton` | a `BitmapText` label on a `RoundRect` background — it needs a **bitmap** font, not a `fontface` |
| `Draggable` / `DropTarget` | drag-and-drop; `dropTarget.setCheckMethod(dropTarget.CHECKMETHOD_CONTAINS)` to require containment instead of overlap |

The callbacks to override are `onClick`, `onOver`, `onOut`, `onRelease` and
`onHold`; `UIBaseElement` adds `onMove` while dragging. Returning `false` from
`onClick` / `onRelease` stops the event propagating further.

## Text

```js
new Text(x, y, {
    font: "Arial",
    size: 32,
    fillStyle: "#FFFFFF",
    textAlign: "center",
    textBaseline: "middle",
    text: "Score: 0",
    wordWrapWidth: 400,        // enables wrapping
});
```

`text` accepts a string or an array of lines. Update with `setText()`.

**Custom web fonts must be preloaded** with the `"fontface"` asset type:

```js
{ name: "PressStart2P", type: "fontface", src: "data/font/PressStart2P.ttf" }
```

Drawing before the font has loaded silently renders in a fallback font — the
layout looks subtly wrong rather than failing.

## `BitmapText`

For pixel-perfect text that scales without antialiasing, and for text drawn in
volume: every `BitmapText` sharing a font draws glyph quads from that one page
image, so they batch together. Each `Text` instead owns a private canvas
texture (re-rasterised whenever it changes), so a screenful of them is a
screenful of distinct textures.

```js
await loader.preload([
    { name: "PressStart2P", type: "image",  src: "data/font/font.png" },
    { name: "PressStart2P", type: "binary", src: "data/font/font.fnt" },
]);

new BitmapText(x, y, {
    font: "PressStart2P",
    size: 2,                  // a scale ratio, not a pixel size
    text: "GAME OVER",
});
```

It needs **both** assets, and by default they must share the **same asset
name** — `settings.font` resolves the image *and*, unless you pass
`settings.fontData`, the descriptor. Registering the descriptor under a
different name (`"…-fnt"`) is the usual mistake; either use one name for both,
or pass `fontData: "PressStart2P-fnt"` explicitly.

The descriptor is AngelCode BMFont in either flavour — the text `.fnt` form or
the XML form — auto-detected, so an `.xml` export loads as-is.

## Never draw text through the raw context

```js
// ✗ works on Canvas only — getContext() returns the GL/GPU context on the
//   GPU backends, and neither has fillText
app.renderer.getContext().fillText("hi", 10, 10);

// ✓
world.addChild(new Text(10, 10, { text: "hi", /* … */ }));
```

`getContext()` hands back the *backend's* context — a
`CanvasRenderingContext2D` only under the Canvas renderer. On WebGL or WebGPU
the call throws `TypeError: … .fillText is not a function`, so this fails loudly
— but only on the machines that picked a GPU backend, which under `video.AUTO`
is most of them and probably not yours.

## Panels

`NineSliceSprite` stretches a panel without distorting its corners — the right
tool for dialogue boxes and windows:

```js
new NineSliceSprite(x, y, {
    image: "panel", width: 300, height: 120, insetx: 12, insety: 12,
});
```

The inset keys are lowercase `insetx` / `insety`; `insetX` is silently ignored
and the corners fall back to a quarter of the frame. `width` and `height` are
mandatory — the constructor throws without them.

## Symptom → cause

| symptom | cause |
|---|---|
| HUD scrolls away with the camera | missing `floating = true` on the container |
| HUD drawn under the game | `this.z = …` instead of `addChild(hud, z)` |
| hand-rolled button never responds | `isKinematic` left `true` — use `UISpriteElement` |
| text renders in the wrong font | web font not preloaded as `"fontface"` |
| `BitmapText` renders nothing | the `.fnt` / image pair was loaded under two different asset names |
| `TypeError: … .fillText is not a function` | drawn via `getContext()` under a GPU backend |
| `UIContainer is not defined` | no such class — use `Container` or `UIBaseElement` |
| UI misplaced after a window resize | no `CANVAS_ONRESIZE` relayout |

## Related skills

- `melonjs-input` — the `isKinematic` requirement in full
- `melonjs-renderables` — `floating`, draw order, containers
