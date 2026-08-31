---
name: melonjs-events
description: "Use this skill for the melonJS event bus and lifecycle hooks — subscribing to engine events, the per-frame and per-state event names, renderable lifecycle callbacks, and how to unsubscribe without leaking. Triggers on: event.on, event.off, event.once, event.emit, GAME_UPDATE, GAME_BEFORE_DRAW, LEVEL_LOADED, LOADER_COMPLETE, STATE_CHANGE, CANVAS_ONRESIZE, POINTERMOVE, WORLD_STEP, onActivateEvent, onDeactivateEvent, onDestroyEvent, lifecycle, subscribe, listener."
license: MIT
---

# Events and lifecycle

## The bus

```js
import { event } from "melonjs";

const onUpdate = () => { /* … */ };
const unsubscribe = event.on(event.GAME_UPDATE, onUpdate);  // on() returns its own off()
event.once(event.LEVEL_LOADED, () => { /* … */ });

// two ways to undo it — the same reference, or the returned function
event.off(event.GAME_UPDATE, onUpdate);
unsubscribe();
```

`event.on`/`once`/`off`/`has` all take an optional third `context` argument,
invoked as the handler's `this`. **`off` matches on the pair — handler identity
AND context identity.** `on(EVT, fn, this)` followed by `off(EVT, fn)` removes
nothing, silently.

**Store the handler reference, or use the context argument.** An inline arrow or
a fresh `.bind(this)` in the `on` call can never be removed — that is the
standard way to leak listeners in melonJS.

```js
// ✗ unremovable
event.on(event.GAME_UPDATE, this.tick.bind(this));

// ✓ keep the bound reference
this._tick = this.tick.bind(this);
event.on(event.GAME_UPDATE, this._tick);
// later: event.off(event.GAME_UPDATE, this._tick);

// ✓ or skip the bind entirely — the context is part of the identity
event.on(event.GAME_UPDATE, this.tick, this);
// later: event.off(event.GAME_UPDATE, this.tick, this);
```

Custom event names work at runtime (`event.emit("my.custom.event", payload)`),
but `on`/`emit` are typed against a closed map of the engine's own events, so in
TypeScript a name outside that map is a compile error. Use your own emitter for
game events in a `.ts` project.

## The events worth knowing

**Per frame**

| event | when |
|---|---|
| `GAME_BEFORE_UPDATE` / `GAME_UPDATE` / `GAME_AFTER_UPDATE` | around the world update — `GAME_UPDATE` is **not** emitted while paused |
| `GAME_BEFORE_DRAW` / `GAME_AFTER_DRAW` | around the draw pass |
| `WORLD_STEP` | after the physics step |
| `TICK` | the raw engine tick |

**Lifecycle**

| event | when |
|---|---|
| `BOOT`, `GAME_INIT`, `VIDEO_INIT` | engine start-up |
| `STATE_CHANGE`, `STATE_PAUSE`, `STATE_RESUME`, `STATE_STOP` | state machine |
| `STAGE_RESET` | a stage was reset |
| `LEVEL_LOADED` | a Tiled level finished loading |
| `LOADER_PROGRESS`, `LOADER_COMPLETE`, `LOADER_ERROR` | asset loading |
| `BLUR` / `FOCUS` | the page lost or regained focus |
| `CANVAS_ONRESIZE`, `VIEWPORT_ONRESIZE` | relayout hooks |
| `POINTERMOVE` | global pointer movement |

Use `LOADER_PROGRESS` / `LOADER_COMPLETE`. The `loader.onProgress` /
`loader.onload` / `loader.onError` properties were deprecated in 18.2.0 and
removed in 20.3: they were module-level `let` bindings on an ES module
namespace, so `loader.onProgress = fn` threw and the documented migration path
never worked. For completion, `loader.preload(assets, onloadcb)` also takes the
callback directly.

## Renderable lifecycle callbacks

Prefer these over bus subscriptions where they fit — the engine calls them at the
right times and there is nothing to unsubscribe:

| callback | when |
|---|---|
| `onActivateEvent()` | `addChild`-ed into a container that is already attached to the world root (a `Container` forwards it to its children) |
| `onDeactivateEvent()` | removed from its container — including the automatic world clear on a state change |
| `onDestroyEvent()` | `destroy()` ran; called with no arguments from the container-removal path |
| `onCollisionStart` / `onCollisionActive` / `onCollisionEnd` | contacts |

Note the activate gate: adding a child to a *detached* container fires nothing.
The callback arrives later, when that container itself is added to the world.
And an `isPersistent` renderable survives the world clear between stages, so it
gets no fresh `onActivateEvent` on the next state.

**Pair subscriptions with activate/deactivate, not the constructor.** This is
the rule that keeps pooled objects working:

```js
onActivateEvent() {
    this._tick = this.update.bind(this);
    event.on(event.GAME_UPDATE, this._tick);
    input.registerPointerEvent("pointerdown", this, this._onDown);
}
onDeactivateEvent() {
    event.off(event.GAME_UPDATE, this._tick);
    input.releasePointerEvent("pointerdown", this);
}
```

**Pool-recycled objects never fire `onDestroyEvent` on removal** — `removeChildNow`
tries `pool.push(child)` first and only calls `destroy()` if that fails, so a
class registered with `pool.register(name, Class, true)` goes back to the pool
instead. Anything you clean up there will not run. `destroy()` is also what calls
`releaseAllPointerEvents(this)`, which is why a pooled object must release its
own pointer registrations in `onDeactivateEvent`.

## Guard callbacks that can fire during teardown

Events can arrive while a stage is being dismantled, when the current state is
already something else:

```js
if (!state.isCurrent(state.PLAY)) return;
```

Without this, a "children emptied" handler can reset the wrong stage.

## Removing objects from a collision callback

Contact callbacks fire inline inside the physics step, mid-iteration over the
detector's pair list. `container.removeChild()` is safe there — it defers the
actual removal to the next tick, which is exactly why it defers. The immediate
forms are the dangerous ones: `removeChildNow()` and `destroy()` tear the object
down under the iteration (`destroy()` nulls `pos` and `body`). The builtin
detector guards the pair it is currently resolving, but nothing guarantees that
for the rest of the step or for another adapter.

Use `removeChild()`, or flag the work and drain it from `Stage.update`.

## Symptom → cause

| symptom | cause |
|---|---|
| handler still fires after removing the object | `event.off` given a different function reference, or a different `context` than `on` got |
| handlers accumulate on pooled objects | subscribed in the constructor rather than `onActivateEvent` |
| cleanup never runs on a pooled object | pooled removal does not fire `onDestroyEvent` |
| crash during a stage switch | callback ran mid-teardown — guard with `state.isCurrent` |
| crash after a collision | `removeChildNow()` / `destroy()` inside a contact callback — use `removeChild()` |
| progress callbacks never fire | assigned `loader.onProgress` (removed in 20.3) instead of subscribing to `LOADER_PROGRESS` |
| `onActivateEvent` never runs | the child was added to a container not yet attached to the world |

## Related skills

- `melonjs-scenes-and-state` — the state machine and stage lifecycle
- `melonjs-performance` — pooling, and why activate/deactivate pairing matters
