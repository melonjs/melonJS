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
