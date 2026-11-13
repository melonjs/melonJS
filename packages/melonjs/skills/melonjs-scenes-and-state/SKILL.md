---
name: melonjs-scenes-and-state
description: "Use this skill for scene structure and game flow in melonJS — Stage subclasses, the state manager, transitions, pausing, the update loop, timers and tweens. Covers onResetEvent versus the constructor, state.set before state.change, the camera and world lifecycle per stage, and pause-aware timing. Triggers on: Tween, easing, fade out, flash, pulse, punch, shrink back, ease in, ease out, animate over time, countdown in update, Stage, state, state.set, state.change, state.transition, pixelate, Trigger transition, retry level, state.pause, pauseOnBlur, resumeOnFocus, onResetEvent, onDestroyEvent, onActivateEvent, onDeactivateEvent, PLAY, MENU, LOADING, update loop, GAME_UPDATE, timer, setTimeout, setInterval, Tween, freeze, setFocusEvents, focusEvents, host or portal pause, YouTube Playables onPause, save, save.add, setStorage, localStorage, cloud save, high score persistence."
license: MIT
---

# Scenes, game state and timing

## Stages and the state manager

A `Stage` is a screen. Register it against a state id, then change to it:

```js
import { Stage, state } from "melonjs";

class PlayScreen extends Stage {
    onResetEvent(app) { /* build the scene */ }
    onDestroyEvent(app) { /* tear it down */ }
}

state.set(state.PLAY, new PlayScreen());   // register first
state.change(state.PLAY);                   // then switch
```

Built-in ids: `state.LOADING`, `state.MENU`, `state.READY`, `state.PLAY`,
`state.GAMEOVER` (no underscore), `state.GAME_END`, `state.SCORE`,
`state.CREDITS`, `state.SETTINGS`, `state.DEFAULT`. `state.USER` (100) is the
base for your own ids — `const CUTSCENE = state.USER + 1`.

**Build scene content in `onResetEvent`, not the constructor.** `onResetEvent`
runs on *every* entry to the state; the constructor runs once. Scene content
created in the constructor exists once and is not rebuilt when you return.

`onResetEvent(app)` receives the `Application` — use that rather than importing
the global `game`.

Extra arguments to `state.change` are forwarded:

```js
state.change(state.PLAY, false, { level: 2 });   // → onResetEvent(app, { level: 2 })
```

The second argument is `forceChange`: pass `true` to switch immediately instead
of on a deferred tick, which is what you want when changing state right after a
preload completes. It is ignored when a transition is configured — a transition
always drives the switch from its own completion callback.

`onResetEvent` runs when the switch is made. The first frame, `STATE_CHANGE` and
a transition's reveal follow once the shaders the stage queued are ready, which
is a few milliseconds once the browser has compiled them before, and at most
1.5s on a first visit. So build the stage in `onResetEvent`: an object a
`STATE_CHANGE` listener adds is not waited for, and its first draw may still
compile what it needs. That first frame steps the world once before drawing it,
however short it is, so everything `onResetEvent` added is in it (the same goes
for the frame after a `level.load` made while the game runs). Before 20.12 it
was drawn unstepped, and showed the stage's background alone for one frame.

`state.change` **throws** `Undefined Stage for state '<id>'` if nothing was
registered for that id, and `state.set` throws if the second argument is not a
`Stage` instance. Neither fails quietly.

A change to the state that is **already current does nothing**: no
`onDestroyEvent`, no `onResetEvent`, no transition. So a "Retry" that calls
`state.change(state.PLAY)` from `PLAY` is ignored; reload the level with
`level.reload()`, or go through another state (a game-over or `READY` screen)
and back.

### Always leave `state.LOADING` — it is transitional

`loader.preload()` switches to `state.LOADING` for you. Building your scene in
the preload callback and then *staying there* looks like it works, and is one
of the easiest mistakes to make:

```js
// WRONG — the game now runs inside the loading stage, forever
loader.preload(assets, () => {
    app.world.addChild(new Player(...));
});
```

Nothing ever destroys that stage, so the built-in loading screen's logo and
progress bar are never removed and sit on top of your game. (Eight of this
repository's own examples did this before it was noticed, so it is not an
obscure trap.)

Give the scene a stage of its own and switch to it:

```js
class PlayScreen extends Stage {
    onResetEvent(app) {
        app.world.addChild(new Player(...));
    }
}

await loader.preload(assets);
state.set(state.PLAY, new PlayScreen());
state.change(state.PLAY);
```

The awaited form reads better here than the callback, because "load, then
switch" is exactly what the code then says. If you genuinely want to keep using
the loading stage as your scene, `state.change(state.DEFAULT)` at least gets
you out of it — but a stage of your own is what you want.

## Persistent objects across levels

```js
if (typeof this.HUD === "undefined") {
    this.HUD = new Container();         // construct once (or UIBaseElement)
}
this.HUD.isPersistent = true;           // survives level changes
this.HUD.floating = true;               // screen coordinates, not world
app.world.addChild(this.HUD, 100);      // explicit z — see melonjs-renderables
```

Everything inside a persistent container is kept with it, physics bodies
included (before 20.13 the children's bodies were dropped by the reset).

## Transitions and pausing

```js
state.transition("fade", "#FFFFFF", 250);
state.transition("mask", "#000", 500, new Ellipse(0, 0, 1, 1));  // shape required
state.transition("pixelate", "#000", 300);  // blocks up to 32px; a 4th argument sets the size
state.pause();                               // freeze update, keep drawing
state.resume();
app.freeze(150);                             // brief hit-stop (proxies state.freeze)
```

`state.transition` is global and sticky — once set it applies to every later
`state.change`; `state.setTransition(id, false)` turns it off for changes
into one state.
The duration (1000 ms when omitted) is for each half: the cover, then the
reveal. The `"mask"` form needs its fourth argument, an `Ellipse` or
`Polygon`; without one it warns and falls back to a direct switch. The
`"pixelate"` form breaks the screen up into blocks (its fourth argument is the
largest block size in pixels; the color is not used). It is a shader effect,
so on Canvas it does nothing and the state changes directly.

A level change is not a state change, so `state.transition` does not apply to
it. A Tiled `Trigger` that loads a level has a transition of its own, set on
the trigger: `color` and `duration` (both needed, or the level loads with
none), and `transition: "fade"` (the default) or `"mask"` with a `shape`.
A `"mask"` without a `shape` fades instead, without a warning, and there is
no pixelate form for a trigger. See `melonjs-tilemaps`.

A `state.change` asked for while a transition covers the screen (Enter pressed
twice on a menu, a timer firing as the player skips a screen) needs no guard:
the transition already under way makes it, switching to the last state asked
for with the last arguments, and a second cover never goes up. A change to a
state with no transition of its own (`state.setTransition(id, false)`) is made
at once, and the cover comes down with it. Before 20.12 the second change left
the first cover on the camera for good, the screen black over a running game.

### A Stage's own `update()` is NOT paused

This one is easy to get wrong and hard to see. `Application.update` calls both
of these **unconditionally**:

```js
this.isDirty = this.world.update(this.updateDelta);
this.isDirty = state.current().update(this.updateDelta) || this.isDirty;
```

Only `Container.update` consults the pause — it reads `state.isPaused()` and
skips every child that is not `updateWhenPaused`. So world children (entities,
sprites, meshes, a `GLTFModel`) freeze correctly, while **the Stage subclass's
own `update()` keeps running**. (`event.GAME_UPDATE` is not emitted while
paused, so logic hung off it stops with the world.)

A game that keeps its logic in entities pauses for free and never notices. A
game that drives the simulation from `Stage.update` — common for an endless
runner, where one object moves and the world scrolls past it — keeps simulating
through `pauseOnBlur` with its world frozen. The signature is bizarre and very
misleading: the scenery scrolls on, the player character stands still in world
space and slides off the screen, and it all snaps back on focus. It reads as a
culling or animation bug, not a pause bug.

Guard it explicitly:

```js
update(dt) {
    super.update(dt);
    if (state.isPaused()) {
        return true;        // world children are already frozen for you
    }
    // …simulation…
}
```

Worth knowing that `pauseOnBlur` (default `true`) fires on a window `blur`, not
only on tab `visibilitychange` — so clicking another window on the same screen
triggers it while the canvas is still fully visible.

On focus, `resumeOnFocus` (default `true`) undoes only the pause the
application applied on blur. A game the player paused from its own menu stays
paused when the window comes back; before 20.9 it resumed underneath the menu.

**When a host decides, not the window.** A game embedded by a host that says
when it runs, such as a web game portal's SDK (YouTube Playables forbids
pausing on the page's visibility) or a native wrapper, stops following the
window with `device.setFocusEvents(false)` and emits the engine's own events
from the host's callbacks:

```js
device.setFocusEvents(false);   // the window's blur, focus and visibilitychange no longer count
app.stopOnBlur = true;          // a pause stops drawing too; pauseOnBlur keeps drawing
app.pauseOnBlur = false;
ytgame.system.onPause(() => event.emit(event.BLUR));
ytgame.system.onResume(() => event.emit(event.FOCUS));
```

Everything else is as with the window: `pauseOnBlur`, `stopOnBlur` and
`resumeOnFocus` decide what happens, the sound effects are silenced and held
keys released, and only a pause the engine applied is undone. It can be called
before or after creating the application.

## The update loop

There is no loop you own. Logic goes in `update(dt)` overrides, or a
`GAME_UPDATE` subscription for scene-level animation:

```js
event.on(event.GAME_UPDATE, () => { /* per frame */ });
```

`update(dt)` must **return `true`** when the object changed and needs redrawing.
Returning nothing is falsy and the object can appear frozen while its state moves.

`dt` is milliseconds since the last frame and is the right basis for motion —
the engine already paces it. Do not reach for `performance.now()`.

**Smooth a value toward a target with `math.damp`, not with `lerp` per
frame.** `lerp(current, target, 0.1)` once per frame moves further on a slow
frame than on a fast one, so the feel drifts with the frame rate:

```js
this.speed = math.damp(this.speed, targetSpeed, 5, dt / 1000);
```

`damp(current, target, lambda, dt)` takes SECONDS, so divide `dt`. Higher
`lambda` converges faster. See `melonjs-camera-and-drawing` for the camera's
own `follow()` damping, which is already frame-rate independent for you.

A common idiom for a per-frame game controller with nothing to draw is a
`Renderable(0, 0, 1, 1)` with `alwaysUpdate = true` and an empty `draw()`.

## Timers: use the engine's, not the window's

```js
import { timer } from "melonjs";

timer.setTimeout(fn, 1000);
const id = timer.setInterval(fn, 500);
timer.clearInterval(id);        // in the Stage's onDestroyEvent
```

`Stage` has only `onResetEvent` and `onDestroyEvent` — there is no
`onActivateEvent` / `onDeactivateEvent` on a stage. Those two are `Renderable`
hooks; put per-renderable teardown there instead.

**The outgoing stage is destroyed before the incoming one is reset.** That
ordering is what makes "each stage owns what it started" work: a scene can
release a resource in `onDestroyEvent` and the next scene can claim the same
one in `onResetEvent` without the teardown arriving late and undoing it.

What a stage starts, it must end: `input.registerPointerEvent` regions,
`event.on` subscriptions and running `Tween`s all outlive the stage that made
them. Music is the exception rather than the rule, since `audio.playTrack()`
stops the track it replaces, so `stopTrack()` in `onDestroyEvent` is only
needed where the next screen has no music of its own.

Engine timers are **pause-aware**. `window.setTimeout` keeps firing while the
game is paused, which produces enemies spawning behind a pause menu. Pass
`false` as the third argument — `timer.setInterval(fn, 500, false)` — for one
that keeps running through a pause, which is what a pause-menu animation or a
countdown that should not freeze needs. (That argument was ignored by
`setInterval` before 20.3.)

## Tweens

### You are hand-rolling a tween if you write this

The shape, in any of its spellings. If you are adding a field that counts
milliseconds and dividing it by a constant to get a `0..1`, stop:

```js
// ✗ a tween, written out longhand
private flashMs = 0;
// ... in update(dt)
if (this.flashMs > 0) {
    this.flashMs -= dt;
    const k = this.flashMs / FLASH_MS;      // ← the 0..1
    effect.setUniform("uIntensity", k * k); // ← and a curve, by hand
}
```

```js
// ✓ the same thing
const driver = { k: 1 };
new Tween(driver)
    .to({ k: 0 }, { duration: FLASH_MS })
    .easing(Tween.Easing.Quadratic.In)      // the curve, named
    .onUpdate(() => effect.setUniform("uIntensity", driver.k))
    .start();
```

The tells, any one of which is enough: a `*Ms` or `*Age` field that only
`update()` touches; a division by a `*_MS` constant; `k * k`, `(1 - k) ** 2` or
`** 1.4` written inline, which is an easing curve spelled by hand; an
`if (x <= 0)` arm that exists only to clean up at the end, which is
`onComplete`; a second timer counting the same duration to chain what happens
next, which is `delay`.

It matters beyond tidiness: a hand-rolled fade needs something to tick it, and
an effect that is NOT a renderable (one living on the camera, say) has nothing
that will. That forces an `update(dt)` method and a call site in the game loop
whose only job is to drive the fade. A tween updates itself, so both disappear.

### When NOT to reach for one

Four shapes that look similar and are not tweens:

| shape | what it is | use |
| --- | --- | --- |
| approaching a value that keeps MOVING | a follow, not an animation | `math.damp` |
| a loop that never ends | oscillation | a sine of your own clock |
| a gate: cooldown, spawn interval, invulnerability window | a timer, nothing is interpolated | a plain countdown |
| the same effect on dozens of live objects | per-instance churn | a hand-rolled countdown really is cheaper |

The rule in one line: **fixed duration, known endpoint, one-shot, few
instances.** All four, or it is not a tween.


```js
import { getPool, Tween } from "melonjs";

const t = getPool("tween").get(sprite.pos) // typed pool, release when done
    .to({ x: 300 }, { duration: 500 })     // options object, not a number
    .easing(Tween.Easing.Quadratic.Out)
    .onComplete(() => { /* … */ })
    .start();                    // ← without this, nothing happens
```

Four traps:

- **A tween without `.start()`** (or `autoStart: true` in the `to()` options)
  silently does nothing.
- **`to()`'s second argument is an options object**
  (`{ duration, easing, yoyo, repeat, delay, repeatDelay, interpolation,
  autoStart }`). Passing a bare number is not a duration — it is read for a
  `.duration` property, finds none, and the tween silently runs the default
  1000 ms.
- **Tweens freeze during `state.pause()` / `freeze()`** unless
  `tween.updateWhenPaused = true` — which is how you get an effect that decays
  *through* a hit-stop.
- **Stop a tween before destroying its target**, or `onUpdate` fires against a
  dead renderable.

**A target can be an array: a path.** `to({ x: [200, 120, 300] })` runs from
the current value through each entry in turn, and
`interpolation: Tween.Interpolation.CatmullRom` smooths the corners. Each
`start()` builds the path afresh from the current value, so a replay or a chain
that comes back round runs the same path, and with `yoyo` the return leg plays
it back the way it came. Before 20.13 a restart ran a longer path each time and
a `yoyo` path turned the property into `NaN`.

**To animate something that is not a property, tween a holder and push the
value in `onUpdate`.** A shader uniform and a light's intensity are both set
through a method, so there is nothing for `to()` to interpolate directly. The
callback is invoked with the tweened object as `this` and the eased progress
`0..1` as its argument:

```js
const fade = { level: 1 };
getPool("tween").get(fade)
    .to({ level: 0 }, { duration: 400 })
    .easing(Tween.Easing.Quadratic.Out)
    .onUpdate(function () {
        effect.setUniform("uIntensity", this.level);
        muzzleLight.intensity = this.level * 3;
    })
    .start();
```

Use a `function`, not an arrow, if you want `this` to be the tweened object;
an arrow keeps the enclosing `this` and you read the holder by name instead.
For a handful of pooled objects a hand-rolled countdown in `update()` is
cheaper than a `Tween` each — this is the right tool for one-off effects, not
for every particle.

### Pick the easing, not just the duration

Eleven families, each with `In`, `Out` and `InOut`. `Out` is what most UI
wants: the value arrives decisively instead of creeping in. The two worth
knowing by name beyond the power curves:

| family | what it does |
| --- | --- |
| `Back` | **overshoots past the target and settles back**, which is impact: a stamp, a button press, anything that should LAND rather than arrive |
| `Bounce` | lands and bounces, for something dropping onto a surface |

```js
// a stamp: scale falls to 1 and springs through it
const driver = { scale: 5 };
new Tween(driver)
    .to({ scale: 1 }, { duration: 420 })
    .easing(Tween.Easing.Back.Out)
    .onUpdate(() => { label.currentTransform.identity(); label.scale(driver.scale); })
    .onComplete(() => camera.shake(12, 400))     // the thump, when it truly lands
    .start();
```

`Back` and `Elastic` **leave the range** between your start and end, so clamp
anything that cannot take it, an opacity or a colour channel above all. The
overshoot follows the direction of travel: a value tweened DOWN overshoots
below its target.

Reach for `onComplete` for anything that must happen on arrival, rather than a
second timer counting the same duration. `delay` in the `to()` options chains
the next one without a timer either.

## Guard teardown-adjacent callbacks

Callbacks can fire while a stage is being torn down, when the current state is
already something else:

```js
if (!state.isCurrent(state.PLAY)) return;
```

Without the guard, a "children emptied" handler can reset the wrong stage.

## Persistence

```js
import { save } from "melonjs";

save.add({ hiscore: 0 });      // once; idempotent, loads any stored value
save.hiscore = 1200;           // plain assignment writes to localStorage
save.remove("hiscore");        // gone from localStorage; set it again to save it again
```

**In TypeScript, keep what `add()` returns.** The namespace carries a
`[key: string]: unknown` index for keys registered anywhere, so reading
`save.hiscore` off it gives you `unknown`. `add()` hands back the same
namespace typed with the keys you just registered, which is the handle to
keep:

```ts
const store = save.add({ hiscore: 0, lives: 3 });
store.hiscore = 1200;          // number, no cast
if (score > store.hiscore) { /* ... */ }
```

Chained calls accumulate, so `save.add({ a: 0 }).add({ b: "" })` is typed with
both.

**Somewhere other than `localStorage`.** `save.setStorage(storage)` keeps the
keys in anything with `getItem`, `setItem` and `removeItem` (the
`SaveStorage` type): a game portal's cloud save, a native wrapper's storage.
`localStorage` stays the default, and `save.setStorage(localStorage)` goes
back to it. The storage is handed the same items `localStorage` would hold
(`me.save.<key>` with the value as JSON, and `me.save`, the list of keys).

```js
// a cloud save that loads and saves its data as one string: load it first,
// then serve the keys from memory and save on every change
const held = JSON.parse((await portal.loadData()) || "{}");
save.setStorage({
    getItem: (key) => held[key] ?? null,
    setItem: (key, value) => { held[key] = value; portal.saveData(JSON.stringify(held)); },
    removeItem: (key) => { delete held[key]; portal.saveData(JSON.stringify(held)); },
});
save.add({ hiscore: 0 });      // the cloud value, or 0 the first time
```

- `save` calls the storage synchronously, as it calls `localStorage`. A cloud
  save that loads asynchronously is loaded **before** `setStorage()`, then
  answered from memory; saving can happen in the background.
- What the new storage holds is read at once and wins. A key registered with
  `add()` that it does not hold keeps its value and is written to it, so
  `setStorage()` works before or after `add()`. A key that was only read from
  the previous storage, never registered, is not carried over.
- Nothing is copied back to the previous storage, nor removed from it.

## Symptom → cause

| symptom | cause |
|---|---|
| scene builds once and is empty on return | content created in the constructor, not `onResetEvent` |
| a cloud save behind `save.setStorage()` comes back with the defaults | the storage answered before its data had loaded; await the load, then call `setStorage()` |
| a saved key is gone after `save.setStorage()` | only keys registered with `save.add()` are carried over to the new storage; register it (before or after) |
| the game pauses or goes quiet when the tab is hidden, on a portal that must decide that itself | the window still drives the focus: `device.setFocusEvents(false)`, then emit `event.BLUR` / `event.FOCUS` from the portal's callbacks |
| a host's pause stops the game's updates but it keeps drawing | `pauseOnBlur` keeps drawing; set `stopOnBlur = true` and `pauseOnBlur = false` |
| `Undefined Stage for state 'N'` thrown | no `state.set` for that id first |
| `state.change(state.PLAY)` from `PLAY` does nothing ("Retry" ignored) | a change to the current state is a no-op — `level.reload()`, or go through another state |
| a level change through a `Trigger` ignores `state.transition` | it is a level change, not a state change: set `color` and `duration` (and `transition`) on the trigger |
| the game stops updating for good after one very slow update, such as a heavy first frame (20.12 and 20.13) | the loop could no longer save enough time to step the world: update |
| the game resumes under its own pause menu after a tab switch (before 20.9) | focus undid any pause; update, only the blur pause is undone |
| a tween finishes in 1000 ms whatever you pass | `to()` takes `{ duration }`, not a number |
| object frozen while its state updates | `update()` not returning `true` |
| timers fire behind a pause menu | `window.setTimeout` instead of `timer.setTimeout` |
| the world freezes on blur but the game keeps advancing | simulation lives in `Stage.update`, which the pause does not gate — only `Container.update` checks `state.isPaused()` |
| the player character is left behind and scrolls off after a lost window | same cause: the stage advanced the camera while its world children were paused |
| a tween does nothing | `.start()` never called |
| an array (path) tween wanders further on each replay, or goes `NaN` with `yoyo` | before 20.13 `start()` re-prepended the start value to the path and `yoyo` swapped the array into the start value; upgrade |
| a repeating or `yoyo` tween runs a single cycle when started again (a pulse pulses once, a yoyo stays at the far end) | before 20.13 `start()` did not restore the `repeat` count the first run had used up; upgrade |
| effect stops during a hit-stop | tween needs `updateWhenPaused = true` |
| crash after a stage switch | callback ran during teardown — guard with `state.isCurrent` |
| HUD scrolls away with the camera | missing `floating = true` |
| a `save` key set again after `save.remove()` reads back fine, then is gone (or back at its default) after a reload (before 20.13) | the write skipped the list of keys restored at boot; update |

## Related skills

- `melonjs-getting-started` — the Application and the first scene
- `melonjs-renderables` — `floating`, draw order, update/draw contracts
