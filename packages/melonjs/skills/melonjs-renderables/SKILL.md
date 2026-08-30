---
name: melonjs-renderables
description: "Use this skill when subclassing Renderable, writing a custom draw() method, handling pointer or click events on game objects, applying post effects and shaders, or controlling draw order. Covers the pos-relative draw contract, isKinematic and input, addPostEffect vs the deprecated shader property, and z-ordering. Triggers on: Renderable, extends Renderable, draw(, update(, isKinematic, pointerEvent, registerPointerEvent, onClick, addPostEffect, removePostEffect, ShaderEffect, addChild, z-order, anchorPoint, floating."
license: MIT
---

# Renderables, input and effects

> Subclassing `Renderable`, custom drawing, receiving pointer events, and
> applying post effects — with the traps that produce silently wrong output
> rather than an error.

Everything here is a **silent failure**: the code runs, nothing throws, and the
result is wrong. Those are the cases worth memorising, because nothing in the
type signatures warns you.

## 1. A custom `draw()` must position itself from `this.pos`

The renderer is **not** pre-translated to the renderable's position when `draw()`
is called. `Container.draw` translates by the *container's* own `pos` and then
calls `child.preDraw` / `draw` / `postDraw`; `preDraw` never translates by the
child's `pos`. Read `this.pos` and draw relative to it.

```js
class Marker extends Renderable {
    draw(renderer) {
        // ✗ draws at the parent container's origin, not at the marker
        renderer.fillRect(0, 0, this.width, this.height);

        // ✓
        renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
    }
}
```

The symptom is an object that renders correctly at position (0, 0) and appears
stuck at the top-left as soon as you move it.

**Zero the anchor in custom-draw renderables.** `preDraw` does not translate to
`pos`, but it *does* apply the anchor offset `(-width * anchorPoint.x,
-height * anchorPoint.y)`. With the default centred anchor, drawing at
`this.pos` therefore lands half a size off:

```js
constructor(x, y, w, h) {
    super(x, y, w, h);
    this.anchorPoint.set(0, 0);   // ← or every custom draw is offset by -w/2, -h/2
}
```

## 2. `isKinematic` must be `false` to receive input or collisions

`Renderable.isKinematic` **defaults to `true`**, which means *"physics collision
and input events will not impact this renderable"*. A kinematic renderable is
skipped by the pointer-event dispatcher entirely.

```js
class Button extends Renderable {
    constructor(x, y) {
        super(x, y, 100, 40);
        this.isKinematic = false;          // ← required, or clicks never arrive
        input.registerPointerEvent("pointerdown", this, () => { /* … */ });
    }
}
```

The symptom is a handler that is registered, looks correct, and never fires.

Note that `Container`, `Camera2d`, `Draggable`, `DropTarget` and the `UI*`
elements set it to `false` for you, and so does the `Body` constructor on its
owner (which covers `Entity` and anything you give a body to) — so a plain
`Renderable` or `Sprite` subclass with no body is the case that catches people.

The same flag has a second, less obvious effect: it is also the opt-in to the
world **broadphase**. The quadtree/octree insert skips any child with
`isKinematic === true`, so body-less objects you want `adapter.queryAABB` /
`querySphere` to find need `isKinematic = false` as well. The builtin
narrowphase likewise requires *both* partners to be non-kinematic.

## 3. Draw order: only `addChild(child, z)` works

There are three separate traps here and they compound.

```js
world.addChild(sprite, 10);   // ✓ the only reliable form
```

1. **`renderable.z` does not exist.** There is no `z` accessor anywhere on
   `Renderable` (nor on `Rect`/`Polygon` above it) — only `depth`, which proxies
   `pos.z`, and the container's default `sortOn: "z"` comparator reads `pos.z`.
   Writing `sprite.z = 100` creates an inert property that nothing reads.
   Several shipped examples still contain `this.z = Number.POSITIVE_INFINITY`;
   those HUDs draw on top only because they happen to be added last. (A `z` key
   in a `Sprite`/`ImageLayer` *settings* object is a different thing and is real
   — it assigns `pos.z` in the constructor — but trap 2 then overwrites it.)
2. **Setting `depth` *before* `addChild` is overwritten.** With `autoDepth` on
   (the default), `addChild` without an explicit `z` assigns
   `child.pos.z = children.length` after the push, discarding whatever you set.
3. **Setting `depth` *after* `addChild` does not reorder.** Containers sort when
   a child is added (`autoSort`, deferred to the next tick), not when `pos.z`
   changes. If you must change it later, call `container.sort()` yourself.

The exception: under `Camera3d` the world's `sortOn` is `"depth"`, and the
camera calls `container.sortNow(true)` every frame. Note that mode does **not**
sort by `pos.z` as a layer index — it sorts by squared distance from the camera
in world space (nearest first in the array, painted far→near). So changing
`depth` does reorder there, but as a position change, not as a layer number.

```js
// ✗ overwritten by autoDepth
sprite.depth = 10;
world.addChild(sprite);

// ✗ no resort happens (except under Camera3d)
world.addChild(sprite);
sprite.depth = 10;

// ✓
world.addChild(sprite, 10);
```

## 4. `removePostEffect()` destroys the effect

To disable an effect temporarily, toggle it. Removing it frees its GPU
resources and leaves you holding a dead object.

```js
// ✗ effect is destroyed; re-adding it will not work
sprite.removePostEffect(effect);

// ✓
effect.enabled = false;
```

Exception worth knowing: an effect with `effect.shared === true` opts out of
auto-destroy, because it is reused across renderables.

Use `addPostEffect()` / `getPostEffect()` / `removePostEffect()`. Assigning
`renderable.shader = …` is deprecated since 19.2.0.

Post effects need a programmable pipeline. A `ShaderEffect` constructed against
the Canvas renderer (`renderer.shaderLanguage === null`) logs a warning, stays
at `enabled === false` and no-ops every method rather than throwing — and
`beginPostEffect` filters disabled effects out. Since `video.AUTO` picks the
backend at runtime, an effect that works on your machine may do nothing on
another.

## 5. `Vector3d.set(x, y)` silently zeroes `z`

```js
v.set(10, 20);        // z becomes 0, not "unchanged"
v.set(10, 20, v.z);   // keep it
```

`pos` is an `ObservableVector3d`, whose `set(x = 0, y = 0, z = 0)` does the same
— so `this.pos.set(x, y)` wipes the object's depth.

## Update and draw

```js
class Enemy extends Renderable {
    update(dt) {
        this.pos.x += this.speed * (dt / 1000);
        return true;                       // ← true means "redraw me"
    }
    draw(renderer) { /* … */ }
}
```

`update()` returns a boolean meaning *"this object changed and needs
redrawing"*. The parent accumulates it into the container's `isDirty`, and the
application skips the whole draw pass while nothing is dirty — so returning
nothing (falsy) can leave the scene frozen even though state is updating. The
base implementation returns `this.isDirty`, so `return super.update(dt)` is the
other correct ending.

`update()` is only called when `obj.inViewport === true` or
`obj.alwaysUpdate === true`. An off-screen object with the default
`alwaysUpdate = false` does not tick at all.

## Anchors and floating

- `anchorPoint` defaults to centre `(0.5, 0.5)` on `Renderable`, but `Container`
  forces `(0, 0)`. Mixing them up shifts children by half their size.
- `floating = true` pins a renderable to the screen rather than the world, which
  is what you want for HUD elements. It opts the object out of camera transforms
  and out of ancestor position accumulation.

## Prefer built-in features

Before writing custom `draw()` code, check whether the engine already covers it —
`ParticleEmitter`, `Tween`, the `ShaderEffect` presets, `UISpriteElement` and
`UITextButton`, the physics adapters, and the Tiled tilemap renderers all exist.
Hand-rolled equivalents miss the batching and the multi-backend support.

## Symptom → cause

| symptom | cause |
|---|---|
| object draws at its parent's origin, ignores its position | `draw()` not reading `this.pos` |
| pointer handler registered but never fires | `isKinematic` left at its `true` default |
| wrong draw order | anything other than `addChild(child, z)` — see section 3 |
| effect cannot be re-enabled after removal | `removePostEffect()` destroyed it |
| effect silently does nothing | running on the Canvas renderer |
| object appears frozen while its state changes | `update()` not returning `true` |
| off-screen object never ticks | `update()` is gated on `inViewport` — set `alwaysUpdate = true` |
| custom draw offset by half the size | centred `anchorPoint` default not zeroed |
| spatial query never finds an object | `isKinematic` left `true` — not in the broadphase |
| `z` unexpectedly 0 after a `set` | `Vector3d.set(x, y)` defaults `z` to 0 |

## Related skills

- `melonjs-getting-started` — Application lifecycle and the scene graph
- `melonjs-20-migration` — the deprecated `shader` property and other pre-20 APIs
