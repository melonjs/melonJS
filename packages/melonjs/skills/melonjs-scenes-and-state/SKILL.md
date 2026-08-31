---
name: melonjs-scenes-and-state
description: "Use this skill for scene structure and game flow in melonJS — Stage subclasses, the state manager, transitions, pausing, the update loop, timers and tweens. Covers onResetEvent versus the constructor, state.set before state.change, the camera and world lifecycle per stage, and pause-aware timing. Triggers on: Stage, state, state.set, state.change, state.transition, state.pause, onResetEvent, onDestroyEvent, onActivateEvent, onDeactivateEvent, PLAY, MENU, LOADING, update loop, GAME_UPDATE, timer, setTimeout, setInterval, Tween, freeze."
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

`state.change` **throws** `Undefined Stage for state '<id>'` if nothing was
registered for that id, and `state.set` throws if the second argument is not a
`Stage` instance. Neither fails quietly.

## Persistent objects across levels

```js
if (typeof this.HUD === "undefined") {
    this.HUD = new Container();         // construct once (or UIBaseElement)
}
this.HUD.isPersistent = true;           // survives level changes
this.HUD.floating = true;               // screen coordinates, not world
app.world.addChild(this.HUD, 100);      // explicit z — see melonjs-renderables
```

## Transitions and pausing

```js
state.transition("fade", "#FFFFFF", 250);
state.transition("mask", "#000", 500, new Ellipse(0, 0, 1, 1));  // shape required
state.pause();                               // freeze update, keep drawing
state.resume();
app.freeze(150);                             // brief hit-stop (proxies state.freeze)
```

`state.transition` is global and sticky — once set it applies to every later
`state.change`. The `"mask"` form needs its fourth argument, an `Ellipse` or
`Polygon`; without one it warns and falls back to a direct switch.

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

Engine timers are **pause-aware**. `window.setTimeout` keeps firing while the
game is paused, which produces enemies spawning behind a pause menu. Pass
`false` as the third argument — `timer.setInterval(fn, 500, false)` — for one
that keeps running through a pause, which is what a pause-menu animation or a
countdown that should not freeze needs. (That argument was ignored by
`setInterval` before 20.3.)

## Tweens

```js
import { Tween, pool } from "melonjs";

const t = pool.pull("Tween", sprite.pos)   // registered name is "Tween"
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
```

## Symptom → cause

| symptom | cause |
|---|---|
| scene builds once and is empty on return | content created in the constructor, not `onResetEvent` |
| `Undefined Stage for state 'N'` thrown | no `state.set` for that id first |
| a tween finishes in 1000 ms whatever you pass | `to()` takes `{ duration }`, not a number |
| object frozen while its state updates | `update()` not returning `true` |
| timers fire behind a pause menu | `window.setTimeout` instead of `timer.setTimeout` |
| a tween does nothing | `.start()` never called |
| effect stops during a hit-stop | tween needs `updateWhenPaused = true` |
| crash after a stage switch | callback ran during teardown — guard with `state.isCurrent` |
| HUD scrolls away with the camera | missing `floating = true` |

## Related skills

- `melonjs-getting-started` — the Application and the first scene
- `melonjs-renderables` — `floating`, draw order, update/draw contracts
