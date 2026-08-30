---
name: melonjs-input
description: "Use this skill for keyboard, pointer, mouse, touch and gamepad input in melonJS. Covers the bindKey action indirection, registerPointerEvent on regions, the isKinematic requirement that silently blocks pointer events, world vs screen pointer coordinates, and gamepad mapping onto the same actions. Triggers on: input, bindKey, isKeyPressed, KEY, registerPointerEvent, releasePointerEvent, pointerdown, pointerup, POINTERMOVE, gamepad, bindGamepad, triggerKeyEvent, click, touch, drag."
license: MIT
---

# Input: keyboard, pointer and gamepad

## Keyboard goes through named actions

Do not poll key codes. Bind a key to an **action string**, then poll the action —
this is what lets gamepad and virtual controls map onto the same handling.

```js
import { input } from "melonjs";

input.bindKey(input.KEY.LEFT,  "left");
input.bindKey(input.KEY.RIGHT, "right");
input.bindKey(input.KEY.X,     "jump", true);   // true = locked: one press per keydown

// in update()
if (input.isKeyPressed("left"))  { /* … */ }
if (input.isKeyPressed("jump"))  { /* fires once per press, not per frame */ }
```

The third argument to `bindKey` is `lock` (default `false`). Without it,
`isKeyPressed` stays true for as long as the key is held — correct for movement,
wrong for jump or fire. A locked action stays consumed until the key is released
or you call `input.unlockKey("jump")`. Use `input.keyStatus(action)` when you
want the raw held/not-held state regardless of locking.

The full signature is `bindKey(keyCode, action, lock?, preventDefault?)`;
`preventDefault` defaults to `input.preventDefault` (itself `true`). Pass the
fourth argument per binding, or change the global default with
`input.setPreventDefault(false)` — **assigning `input.preventDefault = false`
does not work**, it is a read-only module binding.

## Pointer events need `isKinematic = false`

**This is the trap.** `Renderable.isKinematic` defaults to `true`, and both the
broadphase and the pointer dispatcher skip any candidate whose `isKinematic` is
still `true`. The handler registers successfully and simply never fires.

```js
class Button extends Renderable {
    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.isKinematic = false;               // ← required
    }
    onActivateEvent() {
        input.registerPointerEvent("pointerdown", this, this.onDown.bind(this));
    }
    onDeactivateEvent() {
        input.releasePointerEvent("pointerdown", this);
    }
}
```

`Container`, `Camera2d`, `Draggable`, `DropTarget` and the `UI*` elements set it
to `false` for you, and so does attaching a physics body (`Body`'s constructor
sets `ancestor.isKinematic = false`) — so plain `Renderable` and `Sprite`
subclasses with no body are the ones that catch people.

Register in `onActivateEvent` and release in `onDeactivateEvent`, not in the
constructor — pooled objects are reused and would otherwise accumulate handlers.

`app.viewport` works as a whole-screen region when you want global clicks: the
dispatcher appends it to the candidate list on every event, so it is reachable
even when nothing else is under the pointer.

The accepted event names are exactly `"pointerdown"`, `"pointerup"`,
`"pointermove"`, `"pointercancel"`, `"pointerenter"`, `"pointerover"`,
`"pointerleave"` and `"wheel"`. Anything else — `"click"`, `"mousedown"`,
`"touchstart"` — makes both `registerPointerEvent` and `releasePointerEvent`
throw `invalid event type`. melonJS maps the canonical name onto whichever
mouse/touch events the device actually supports, so you always register the
pointer name.

## World coordinates versus screen coordinates

The pointer carries several, and picking the wrong one produces a feedback loop:

| property | meaning | use for |
|---|---|---|
| `pointer.gameScreenX` / `gameScreenY` | canvas-relative position | anything that **moves the camera** |
| `pointer.gameWorldX` / `gameWorldY` | projected into world space | picking and spawning objects |
| `pointer.gameLocalX` / `gameLocalY` | relative to the region's ancestor container | hit-testing inside a container |
| `pointer.gameX` / `gameY` | **context-dependent** — see below | region handlers on non-floating regions |

`gameX`/`gameY` is not a fixed coordinate space. The dispatcher rewrites it per
candidate just before calling your handler: world coordinates for a normal
region, screen coordinates for a `isFloating === true` region. On the global
`event.POINTERMOVE` broadcast it is set to the **screen** coordinates. When you
need one specific space, read `gameWorldX`/`gameWorldY` or
`gameScreenX`/`gameScreenY` by name rather than relying on `gameX`.

Using world coordinates for a camera-orbit drag means the same pixel maps to a
different world point every frame as the camera moves — the drag jumps wildly.

## Pointer move and release outside a region

Region handlers only fire while the pointer is over the region. For drag
tracking, listen globally:

```js
import { event } from "melonjs";
event.on(event.POINTERMOVE, (pointer) => { /* … */ });
```

There is **no global pointer-up system event** — `event.ts` publishes only
`POINTERMOVE`, `POINTERLOCKCHANGE`, `DRAGSTART` and `DRAGEND`. For "released
anywhere" you need a raw listener:

```js
globalThis.addEventListener("pointerup", onRelease);
```

For plain drag-and-drop, `Draggable` / `DropTarget` already wire all of this up
(`pointerdown` / `pointerup` / `pointercancel` regions plus a global
`POINTERMOVE` listener) and emit `event.DRAGSTART` / `event.DRAGEND`. `DRAGEND`
still originates from a region handler, so it only fires when the release lands
on the draggable itself.

## Gamepad

Gamepad input maps onto the same action strings, so game code does not branch:

```js
input.bindGamepad(0,
    { type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_1 },
    input.KEY.X);        // → the "jump" action bound above
```

**Order matters:** `bindGamepad` throws `no action defined for keycode N` if the
keycode has not already been passed to `bindKey`. Axes use the same call with a
threshold: `{ type: "axes", code: input.GAMEPAD.AXES.LX, threshold: -0.5 }`.
`unbindGamepad(index, button)`, `setGamepadDeadzone(value)` and
`setGamepadMapping(id, mapping)` complete the surface.

## Virtual controls

On-screen buttons synthesise key events, again reaching the same actions:

```js
input.triggerKeyEvent(input.KEY.LEFT, true);    // press
input.triggerKeyEvent(input.KEY.LEFT, false);   // release
```

## Symptom → cause

| symptom | cause |
|---|---|
| pointer handler never fires | `isKinematic` left at its `true` default |
| handlers fire twice, or on dead objects | registered in the constructor instead of `onActivateEvent` |
| camera drag jumps around | using world coordinates instead of `gameScreenX`/`gameScreenY` |
| `gameX` holds screen coords where world coords were expected | read on `event.POINTERMOVE`, or on a floating region — use `gameWorldX`/`gameWorldY` |
| drag stops when leaving the object | region events end at the region — use `event.POINTERMOVE` |
| release never detected outside the region | no global pointer-up event — add a raw listener |
| jump fires every frame while held | `bindKey` without its third `lock` argument |
| `invalid event type` thrown at registration | non-pointer name (`"click"`, `"mousedown"`, …) passed to `registerPointerEvent` |
| `no action defined for keycode N` | `bindGamepad` called before `bindKey` for that keycode |

## Related skills

- `melonjs-renderables` — `isKinematic` also gates the physics broadphase
- `melonjs-ui-and-text` — `UISpriteElement` and `UITextButton` handle this for you
