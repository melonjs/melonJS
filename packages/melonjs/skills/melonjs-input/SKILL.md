---
name: melonjs-input
description: "Use this skill for keyboard, pointer, mouse, touch and gamepad input in melonJS. Covers the bindKey action indirection, registerPointerEvent on regions, the isKinematic requirement that silently blocks pointer events, which of several overlapping objects receives an event and how to consume it, world vs screen pointer coordinates, and gamepad mapping onto the same actions. Triggers on: input, bindKey, isKeyPressed, KEY, registerPointerEvent, releasePointerEvent, pointerdown, pointerup, pointermove, POINTERMOVE, gamepad, bindGamepad, triggerKeyEvent, virtual gamepad, touch controls, joystick, gamepad-plugin, KEYDOWN, KEYUP, press any key, splash screen, click, touch, drag, hit test, event propagation, stop propagating, overlapping, which object gets the click."
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

### A poll can miss a press entirely

`isKeyPressed` is sampled once per frame, and `keyup` decrements the key's
counter the moment it arrives — locked or not. A press that goes down and up
between two frames therefore leaves the counter back at zero and is never
seen. At 60fps that is anything under ~16ms: rare from a human finger, routine
from a synthetic event, and more likely the slower the frame rate.

For a screen where a missed press is a dead end — a splash, a "press any key",
a notice to acknowledge — listen for the event instead, which cannot be missed:

```js
import { event } from "melonjs";

// action is the bound action name, or undefined for an unbound key
const onKey = (action) => { if (action === "menuSelect") continue(); };
event.on(event.KEYDOWN, onKey);      // in onResetEvent
event.off(event.KEYDOWN, onKey);     // in onDestroyEvent — it does not self-remove
```

`KEYDOWN` fires for *every* key, bound or not, so matching on `action` is what
narrows it; it also repeats while the key is held, so guard anything that must
happen once. Keep polling for movement and for a menu cursor, where one step
per press and a key held across a state change are the things that matter.

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

`app.viewport` works as a whole-screen region when you want global clicks. Note
it is asked **before** everything else, not as a fallback after nothing matched:
the dispatcher appends it to the candidate list and walks that list from the
end. So a viewport handler must not return `false` unless it really means to
swallow every pointer event in the game.

The accepted event names are exactly `"pointerdown"`, `"pointerup"`,
`"pointermove"`, `"pointercancel"`, `"pointerenter"`, `"pointerover"`,
`"pointerleave"` and `"wheel"`. Anything else — `"click"`, `"mousedown"`,
`"touchstart"` — makes both `registerPointerEvent` and `releasePointerEvent`
throw `invalid event type`. melonJS maps the canonical name onto whichever
mouse/touch events the device actually supports, so you always register the
pointer name.

## Which object gets the event

The dispatcher collects the regions near the pointer from the broadphase,
bounds-checks each one, orders them **the way they are drawn** and asks the
topmost first, walking down until something consumes.

A handler consumes by returning `false`. This is the DOM sense and it reads
backwards: `false` means handled, and anything else, `undefined` included, lets
the walk carry on to whatever is underneath.

```js
input.registerPointerEvent("pointerdown", this, () => {
    this.fire();
    return false;        // nothing under this gets the click
});
```

Three things decide the order, and only the first is obvious:

- **`pos.z`, among siblings of one container.** Higher is on top.
- **Across containers, the common ancestor decides.** `pos.z` is
  container-local, since `autoDepth` numbers each container's children from 1,
  so a button at `z = 8` inside one panel does not outrank a second panel at
  `z = 2`. The pair is resolved by walking both up to their shared parent and
  comparing the two siblings there, which is exactly how drawing resolves it.
  Raise a whole panel with `ancestor.moveToTop(panel)`, not by inflating a
  child's `z`.
- **A child is asked before the container holding it**, since it draws over it.

Equal `z` between siblings falls back to child order, lower index on top. Two
callbacks registered on the **same** region for the same event run
last-registered-first.

Consuming a **move** also takes the pointer away from the regions below: each
one still holding it gets its `pointerleave`, because it is covered now and
being inside its own bounds no longer decides. Consuming a press, a release or a
wheel does not, since none of those says where the pointer is.

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
keycode has not already been passed to `bindKey`.

Axes use the same call with a threshold, and bind **one half of the axis each**
— the sign selects which half:

```js
input.bindGamepad(0, { type: "axes", code: input.GAMEPAD.AXES.LX, threshold: -0.15 }, input.KEY.LEFT);
input.bindGamepad(0, { type: "axes", code: input.GAMEPAD.AXES.LX, threshold:  0.15 }, input.KEY.RIGHT);
```

**`threshold` is added to the deadzone, it does not replace it.** The test is
`abs(value) >= deadzone + abs(threshold)`, so with the default deadzone of 0.1
a threshold of `0.5` does not fire until 0.6 of full travel, and `0.15` fires at
0.25. Pick the number you want the stick to break at and subtract the deadzone.
Raising `setGamepadDeadzone` moves every axis binding with it.

`unbindGamepad(index, button, type?)`, `setGamepadDeadzone(value)` and
`setGamepadMapping(id, mapping)` complete the surface.

### Which index to bind

Bindings are per pad **index**, and the index is plug order, not identity —
nothing reports which pad is "the" controller. Slot 0 is a guess: a wheel, a
spare pad or a keyboard-shaped device left plugged in can hold it for a whole
session while the player presses buttons on slot 1.

So a one-player game binds **every slot it will accept** to the same actions,
and lets `activeGamepad()` say which one is in use when something has to go
back the other way:

```js
for (let pad = 0; pad < 4; pad++) {
    input.bindGamepad(pad, { type: "buttons", code: input.GAMEPAD.BUTTONS.FACE_1 }, input.KEY.X);
}
input.activeGamepad();   // the last pad to produce a bound input, else the
                         // first connected one, else -1
```

Binding spare slots costs nothing: the poll skips a bound index with no pad in
it. `activeGamepad()` follows **bound inputs only**, which is what makes it an
answer about the player rather than about electrical noise — a worn stick at
rest reports movement for ever and would otherwise claim to be the active pad.

### Rumble

```js
input.vibrateGamepad(input.activeGamepad(), {
    duration: 120, strongMagnitude: 0.6, weakMagnitude: 0.9,
});
input.stopGamepadVibration(index);   // cut a long effect short
input.hasGamepadVibration(index);    // for an options-screen toggle
```

Safe to call blind: no pad, no motors, or no Gamepad API at all resolves
`false` and does nothing, so game code never branches on support. Magnitudes
default to **full** — the underlying web API defaults every parameter to zero,
which makes a bare `playEffect` a silent no-op. A second call preempts the
first on the same pad, so a rapid series of hits reads as a rapid series of
hits rather than as a queue. For a SUSTAINED rumble issue one effect with a
long `duration` instead of calling every frame.

Hot-plugging needs no polling of your own — the engine listens for the browser's
own events and republishes them:

```js
import { event } from "melonjs";

event.on(event.GAMEPAD_CONNECTED,    (gamepad) => { /* gamepad.id, .index */ });
event.on(event.GAMEPAD_DISCONNECTED, (gamepad) => { /* pause, show a prompt */ });
```

Bindings survive a disconnect: they are attached to the index, not to the
device, so a pad unplugged and plugged back into the same slot keeps working.

## Virtual controls

For on-screen touch controls, use `@melonjs/gamepad-plugin` rather than
writing them: sticks and buttons drawn over the game and reported as a pad in
a gamepad slot, so the `bindGamepad` bindings above answer to them unchanged.

```js
import { GamepadPlugin } from "@melonjs/gamepad-plugin";

// once the application is created: a stick and two buttons, on touch screens
plugin.register(GamepadPlugin, "gamepad", {
    buttons: [{ label: "A" }, { label: "B" }],
});
```

The left stick presses the D-pad buttons (`GAMEPAD.BUTTONS.UP` ...) in 8
directions and reports `AXES.LX`/`LY`; the buttons press `FACE_1`, `FACE_2`...
in turn, or a key with `{ key: input.KEY.SPACE }`. Each finger is followed on
its own, a touch starting on the controls does not reach the game, and they
hide while a real pad is in use. `plugin.cache.gamepad.visible` says whether
they show, to word a prompt ("tap" or a key name).

A single key can also be pressed directly, reaching the same actions:

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
| stick has to be pushed well past its `threshold` before it registers | `threshold` is ADDED to the deadzone, not used instead of it |
| one half of a stick does nothing | each half is a separate `bindGamepad`, chosen by the sign of `threshold` |
| a widget under an overlapping panel still reacts | the panel consumes nothing — return `false` from its `onClick` and `onOver` |
| a widget stays highlighted after the pointer moves onto a panel over it | the panel consumes no `pointermove`, so nothing takes the pointer off the widget |
| a child's big `z` does not put it in front of another container | `pos.z` is container-local — use `ancestor.moveToTop()` on the container |
| every click in the game stops working | a handler on `app.viewport` returning `false`, which is asked first |
| touch controls do nothing | nothing bound to their slot — `bindGamepad` on the plugin's `index` (0 by default), or give the buttons a `key` |
| touch controls never show on a desktop | the gamepad plugin's `enabled` defaults to `device.touch` — pass `enabled: true` to try them there |

## Related skills

- `melonjs-renderables` — `isKinematic` also gates the physics broadphase
- `melonjs-ui-and-text` — `UISpriteElement` and `UITextButton` handle this for you
