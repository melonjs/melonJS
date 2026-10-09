---
name: melonjs-scenes-and-state
description: "Use this skill for scene structure and game flow in melonJS — Stage subclasses, the state manager, transitions, pausing, the update loop, timers and tweens. Covers onResetEvent versus the constructor, state.set before state.change, the camera and world lifecycle per stage, and pause-aware timing. Triggers on: Tween, easing, fade out, flash, pulse, punch, shrink back, ease in, ease out, animate over time, countdown in update, Stage, state, state.set, state.change, state.transition, state.pause, onResetEvent, onDestroyEvent, onActivateEvent, onDeactivateEvent, PLAY, MENU, LOADING, update loop, GAME_UPDATE, timer, setTimeout, setInterval, Tween, freeze."
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
own `update()` keeps running**.

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

## Symptom → cause

| symptom | cause |
|---|---|
| scene builds once and is empty on return | content created in the constructor, not `onResetEvent` |
| `Undefined Stage for state 'N'` thrown | no `state.set` for that id first |
| a tween finishes in 1000 ms whatever you pass | `to()` takes `{ duration }`, not a number |
| object frozen while its state updates | `update()` not returning `true` |
| timers fire behind a pause menu | `window.setTimeout` instead of `timer.setTimeout` |
| the world freezes on blur but the game keeps advancing | simulation lives in `Stage.update`, which the pause does not gate — only `Container.update` checks `state.isPaused()` |
| the player character is left behind and scrolls off after a lost window | same cause: the stage advanced the camera while its world children were paused |
| a tween does nothing | `.start()` never called |
| effect stops during a hit-stop | tween needs `updateWhenPaused = true` |
| crash after a stage switch | callback ran during teardown — guard with `state.isCurrent` |
| HUD scrolls away with the camera | missing `floating = true` |

## Related skills

- `melonjs-getting-started` — the Application and the first scene
- `melonjs-renderables` — `floating`, draw order, update/draw contracts
