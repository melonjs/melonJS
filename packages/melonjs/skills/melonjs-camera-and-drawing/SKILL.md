---
name: melonjs-camera-and-drawing
description: "Use this skill for camera control and immediate-mode drawing in melonJS — following a target, viewport bounds, shake and fade, secondary cameras, and drawing shapes, lines and gradients inside a custom draw(). Covers world versus screen coordinate conversion, clipping and masking, and baking with CanvasRenderTarget. Triggers on: Camera2d, viewport, follow, setBounds, shake, fadeIn, fadeOut, worldToLocal, localToWorld, colorMatrix, renderer.fill, renderer.stroke, Rect, Ellipse, Polygon, Line, Gradient, clipRect, mask, CanvasRenderTarget, NoiseTexture2d."
license: MIT
---

# Camera and immediate-mode drawing

## Following a target

```js
app.viewport.follow(player, app.viewport.AXIS.BOTH, 0.1);
```

**Pass the renderable, not `renderable.pos`.** `follow()` accepts a `Renderable`,
a `Vector2d` or a `Vector3d` and **throws** `invalid target for me.Camera2d.follow`
for anything else. A renderable's `pos` is an `ObservableVector3d`, which is not
a `Vector3d` subclass, so `follow(player.pos, …)` throws.

The third argument is a damping factor in `[0 .. 1]` — lower is smoother and
laggier, `1` snaps. Omit it for a hard lock (it defaults to `1`). It is
frame-rate independent since 19.7. `AXIS.HORIZONTAL` / `AXIS.VERTICAL` /
`AXIS.BOTH` / `AXIS.NONE`.

Call it from the followed entity's `onActivateEvent`, using `this.parentApp`.

## Bounds are the thing people forget

The camera's bounds default to the **renderer size**, so it cannot scroll until
you widen them to the world:

```js
app.viewport.setBounds(0, 0, mapWidth, mapHeight);
```

Symptom: `follow()` is called, looks right, and the view never moves. Note a
canvas resize resets the default camera's bounds to `(0, 0, w, h)`, so re-apply
them from a `CANVAS_ONRESIZE` handler if your game resizes. Loading a Tiled map
sets them for you from the map size.

## Camera effects

```js
app.viewport.shake(4, 200);                       // intensity, ms
app.viewport.fadeIn("#000000", 500);              // fade TO black
app.viewport.fadeOut("#000000", 500);             // start black, fade back to normal
app.viewport.colorMatrix.contrast(1.1).saturate(1.1);
app.viewport.addPostEffect(new VignetteEffect(app.renderer));
```

The fade pair is named from the *colour's* point of view, not the scene's:
`fadeIn` fades the colour in (screen goes to `color`), `fadeOut` fades it out
(screen starts at `color` and clears). Both default to a 1000 ms duration and
take an optional completion callback.

`colorMatrix` (`brightness` / `contrast` / `saturate` / `hueRotate` / `sepia` /
`invertColors`, all chainable) is the cheap way to grade a whole camera: the
camera appends it as a final post-effect pass by itself whenever the matrix is
non-identity, and drops it again after the frame. It is **not** shader-free —
it is a `ColorMatrixEffect`, i.e. a `ShaderEffect`, so like every post effect it
is inert on the Canvas renderer.

## Coordinate conversion

```js
app.viewport.worldToLocal(x, y);   // world → screen
app.viewport.localToWorld(x, y);   // screen → world
```

Both return a `Vector2d`; with no third argument that vector comes from the
shared pool, so in a per-frame path pass your own `v` as the third argument, or
release it with `getPool("vector2d").release(v)`.

Pointer events already carry every frame of reference: `gameWorldX`/`gameWorldY`
(world), `gameScreenX`/`gameScreenY` (screen), `gameLocalX`/`gameLocalY`
(relative to the registered region's container) and `gameX`/`gameY`, which is
whichever of world/screen matches the region — screen for a `floating` region,
world otherwise. Use the screen pair for anything that *moves* the camera, or
the drag feeds back on itself.

## Secondary cameras

Cameras are first-class — a minimap is a second camera with `autoResize = false`
and an overridden `postDraw`:

```js
this.cameras.set("minimap", new MinimapCamera());
```

View state is per camera, not per scene: a `Camera3d` carries its own distance
fog (`setFog`), so a minimap or split-screen view fogs independently of the main
one — and a `Camera2d` never fogs. See `melonjs-3d`.

## Immediate-mode drawing

Inside a custom `draw(renderer)` you can draw shapes directly. Remember the two
renderable rules: read `this.pos`, and zero the anchor.

```js
draw(renderer) {
    renderer.setColor("#ff8800");
    renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);

    renderer.setColor("#ffffff");
    renderer.lineWidth = 2;                 // property, not setLineWidth()
    renderer.stroke(new Line(0, 0, [/* … */]));
}
```

Geometry available: `Rect`, `RoundRect`, `Ellipse`, `Polygon`, `Line`, `Point`
(and a `Bounds`). `renderer.fill(shape)` and `renderer.stroke(shape)` take any
of them and throw `Invalid geometry for fill/stroke` for anything else.

`Gradient` gives linear and radial fills, built with
`renderer.createLinearGradient(x0, y0, x1, y1)` /
`createRadialGradient(x0, y0, r0, x1, y1, r1)` and then handed to
`renderer.setColor(gradient)`. `NoiseTexture2d` generates cellular and simplex
noise — including seamless tiling and `asNormalMap` — so you rarely need to ship
noise PNGs.

## Clipping and masking

```js
renderer.clipRect(x, y, w, h);        // rectangular clip
renderable.mask = new Ellipse(/* … */);  // shape mask on an object
```

Note that a `Container` with `clipping` enabled clips **after** its own
`translate(pos)`, in container-local coordinates — `clipRect(0, 0, width,
height)`. It also silently does nothing unless the container is non-root and has
a finite `width`/`height`: a `Container` built with no explicit size is
`Infinity × Infinity`, and `clipping = true` on it is a no-op.

## Bake once, draw many

When you would otherwise issue hundreds of identical draws every frame, render
them once into a `CanvasRenderTarget` and draw the result:

```js
const rt = new CanvasRenderTarget(width, height, { context: "2d" });
const ctx = rt.context;          // a CanvasRenderingContext2D — draw into it once…
// then draw the backing canvas, not the target object:
renderer.drawImage(rt.canvas, x, y);
// or wrap it: new Sprite(0, 0, { image: rt.canvas })
```

Pass `rt.canvas`, never `rt` — a `CanvasRenderTarget` is a wrapper, not a
drawable, and the engine's own bakes (the particle emitter's default texture)
hand `.canvas` on for exactly that reason.

This is the sanctioned performance idiom before reaching for a custom shader.

`renderer.toFrameTexture()` is the related tool for capturing the *current frame*
into a texture for a shader to sample.

## Symptom → cause

| symptom | cause |
|---|---|
| `follow()` set but the view never moves | viewport bounds still at renderer size |
| `invalid target for me.Camera2d.follow` | passed `player.pos` — pass the renderable, a `Vector2d` or a `Vector3d` |
| camera drag jumps around | using world (`gameWorldX`) instead of screen (`gameScreenX`) coordinates |
| `colorMatrix` does nothing | it is a shader effect — inert on the Canvas renderer |
| custom drawing appears at the origin | `draw()` not reading `this.pos` |
| custom drawing offset by half its size | centred `anchorPoint` not zeroed |
| `setLineWidth` is not a function | it is the `lineWidth` property |
| clipping in the wrong place inside a container | container clips in local coordinates, after its own translate |
| `container.clipping = true` does nothing | container has no explicit size, so `width`/`height` are `Infinity` |
| baked target draws nothing / throws | passed the `CanvasRenderTarget`, not its `.canvas` |
| frame rate drops with many static draws | bake into a `CanvasRenderTarget` instead |

## Related skills

- `melonjs-renderables` — the `draw()` contract and anchors
- `melonjs-3d` — `Camera3d`, which extends `Camera2d` and keeps all of the above
