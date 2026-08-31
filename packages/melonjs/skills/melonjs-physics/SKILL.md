---
name: melonjs-physics
description: "Use this skill for collision, physics bodies, movement, and spatial queries in melonJS — the built-in SAT world and the planck/matter adapters. Covers bodyDef vs Body, collision types and masks, the collision callback family and their firing rules, raycast/queryAABB/querySphere, and the behaviour differences between adapters. Triggers on: Body, bodyDef, collision, collisionType, collisionMask, onCollision, onCollisionStart, onCollisionActive, raycast, queryAABB, querySphere, PlanckAdapter, MatterAdapter, gravity, velocity, applyForce, isGrounded, SAT."
license: MIT
---

# Physics and collision

> melonJS has a built-in SAT collision world and two optional rigid-body
> adapters. Movement, collision callbacks and spatial queries all behave
> differently depending on which is active — and several of the differences fail
> silently.

## Choosing a world

| | when |
|---|---|
| **built-in** (default) | Arcade-style: platformers, top-down games. Fast, position-based, not Newtonian. |
| **`@melonjs/planck-adapter`** | Full rigid-body dynamics — stacking, joints, realistic restitution. |
| **`@melonjs/matter-adapter`** | Same class of thing, backed by matter-js. |

An adapter is an `Application` setting, not a plugin:

```js
import { PlanckAdapter } from "@melonjs/planck-adapter";

const app = new Application(800, 600, {
    parent: "screen",
    physic: new PlanckAdapter({
        gravity: { x: 0, y: 320 },   // pixels/s², default {x: 0, y: 320}
        pixelsPerMeter: 32,          // default 32
        subSteps: 2,                 // default 1
    }),
});
await app.init();
```

`PlanckAdapter` also takes `velocityIterations` (default `8`) and
`positionIterations` (default `3`). `MatterAdapter` takes a different set —
`gravity` (default `{x: 0, y: 1}`, matter's own convention), `subSteps` and
`matterEngineOptions`; it has no `pixelsPerMeter` because it already works in
pixels. `subSteps` is the anti-tunnelling knob when per-frame motion exceeds a
body radius. Pick **one** adapter per game; `physic: "none"` disables physics
entirely — `world.step` skips the simulation and the world behaves as a pure
scene graph.

`world.physic` carries the active adapter's label (`"builtin"`, `"planck"`,
`"matter"`, `"none"`), so game code can branch without importing the class.

## Two ways to declare a body

**`bodyDef`** — declarative, portable, works on every adapter. Prefer it.

```js
class Player extends Sprite {
    constructor(x, y, settings) {
        super(x, y, settings);
        this.bodyDef = {
            type: "dynamic",
            shapes: [ /* … */ ],
            collisionType: collision.types.PLAYER_OBJECT,
            collisionMask: collision.types.WORLD_SHAPE | collision.types.ENEMY_OBJECT,
            restitution: 0.2,
        };
    }
}
```

The engine forwards it to the active adapter when the renderable is added with
`Container.addChild`, and only if that container is already attached to the root
world; the broadphase picks the renderable up on the next `world.update()`.
Calling `adapter.addBody()` yourself registers the body but leaves the
renderable out of the scene graph, so it integrates but never collides.

Other portable `bodyDef` fields: `density`, `frictionAir` (number or `{x, y}`),
`friction`, `restitution`, `gravityScale`, `maxVelocity`, `fixedRotation`,
`isSensor`, `userData`. Not every adapter honours every one — the built-in
adapter ignores `friction`, `fixedRotation` and `userData`, and maps
`frictionAir` onto its per-axis `body.friction` damping vector.

**`new Body(this, shape)`** — the built-in-native API. Fine, but ties the entity
to the built-in world.

### Per-shape filtering and triggers

A shape in `shapes` may carry its own `collisionType`, `collisionMask`,
`isTrigger` (default `false`) and `isActive` (default `true`). A shape can only
**narrow** what its body allows — the body's type/mask are checked first.

```js
const feet = new Rect(0, 24, 32, 8);
feet.collisionMask = collision.types.WORLD_SHAPE;
const torso = new Rect(0, 0, 32, 24);
torso.collisionMask = collision.types.ENEMY_OBJECT;
torso.isTrigger = true;      // detects hits, never gets pushed by them
```

`isActive: false` removes the shape from the narrow phase *and* from raycasts
without shrinking the body's bounds. Honoured by the built-in and planck
adapters; the matter adapter filters per body and ignores them. Under planck the
body-wide setters (`setCollisionType` / `setCollisionMask` / `setSensor`) write
every fixture and so overwrite per-shape values.

For contacts reported per *shape pair* rather than per body pair, define
`onShapeCollisionStart` / `onShapeCollisionActive` / `onShapeCollisionEnd`.
Declaring at least one of them opts into shape-pair enumeration; declaring none
costs nothing.

## Move with forces, not by assigning position

```js
// ✗ the adapters overwrite this from the engine body every step
this.pos.x += this.speed;

// ✓ portable — works on every adapter
this.body.applyForce(thrustX, 0);
this.body.setVelocity(vx, vy);

// ✓ built-in only — `force` and `maxVel` are BuiltinAdapter Body fields
this.body.force.x = this.body.maxVel.x;
```

Under matter and planck, `syncFromPhysics()` copies the engine body's position
back onto `renderable.pos` after every step, so a direct write is simply erased
— no error. The built-in world integrates `pos` in place instead, so a write
survives but fights collision resolution and jitters. To teleport, go through
`adapter.setPosition(renderable, p)` so the engine body moves with it.

## Collision callbacks — which one to use

The lifecycle is `onCollisionStart` (contact begins), `onCollisionActive` (every
step while it persists) and `onCollisionEnd` (contact breaks). None of them are
defined on `Renderable` — you just declare the ones you want and the dispatcher
checks `typeof`. The legacy `onCollision` still exists and has a trap:

> On the built-in world, `onCollision` fires **twice per frame** for
> dynamic-dynamic pairs — once per outer-loop visit — and gets the raw SAT
> response with a fixed `a`/`b` per pair. On the adapters it is routed to their
> "still touching" phase and fires once per side.

The legacy dedupe idiom is `if (this !== response.a) return;`. Defining
`onCollisionActive` suppresses the legacy callback on that renderable (the
"supersedes" rule, applied per side so `a` and `b` can migrate independently),
and is deduped to once per pair per side per frame on every adapter.

**Return values only work on the legacy handler.** `return false` from
`onCollision` skips the built-in SAT push-out; what `onCollisionStart` /
`onCollisionActive` return is discarded. To opt a body out of the physical
response, set `bodyDef.isSensor` / `body.setSensor(true)`, or make the shape a
trigger. With no `onCollision` defined at all, push-out happens by default for
dynamic non-sensor bodies.

The two handler families do **not** get the same response object:

| | `onCollision` (legacy) | `onCollisionStart` / `Active` / `End` |
|---|---|---|
| `a` / `b` | fixed per pair | receiver-symmetric: `a === this`, `b === other` |
| overlap magnitude | `response.overlap` | `response.depth` |
| contact axis | `response.overlapN` / `overlapV` | `response.normal` |
| also carries | `aInB`, `bInA`, `indexShapeA/B`, `isTriggerContact` | `pair` (adapter-native, absent on built-in) |

On the modern response `overlap` / `overlapN` / `overlapV` are still present but
`@deprecated` (and `undefined` under the matter adapter) — use `depth` and
`normal`. `normal` is the direction the receiver must move to separate, in
canvas coordinates: `normal.y < -0.7` means "push me up", i.e. I landed on top
of `other`.

One portability wrinkle: the built-in adapter dispatches `onCollisionEnd` with
`undefined` as the response; the matter and planck adapters pass a real one.
Guard it.

## Never mutate the world during contact dispatch

Collision callbacks are dispatched from inside the physics step on every
adapter, and each engine has its own tolerance for being mutated there. Flag the
work and drain it from your `Stage.update`:

```js
onCollisionStart(response, other) {
    this.pendingRemoval = true;    // don't addChild / removeChildNow here
}
```

What actually happens per adapter:

- **built-in** — callbacks fire inline during `step()`. `Container.removeChild`
  is deferred, so it is safe; `removeChildNow()` and `destroy()` are immediate,
  and the detector only survives them because it re-checks `body === undefined`
  after every user callback.
- **planck** — `onCollisionStart` / `onCollisionEnd` are dispatched from
  planck's `begin-contact` / `end-contact` events, which fire *while the world
  is locked*. Adding a renderable with a `bodyDef` there makes planck's
  `createBody` return `null` and the adapter then throws on the null handle.
  `onCollisionActive` is dispatched after the step and is the safe one.
- **matter** — callbacks come from matter's `collisionStart` / `collisionActive`
  / `collisionEnd` events during `Engine.update`.

## Spatial queries

`raycast` and `queryAABB` are implemented by all three adapters:

```js
import { Rect, Vector2d } from "melonjs";

// nearest hit only — returns null when nothing is hit
const hit = app.world.adapter.raycast(new Vector2d(x0, y0), new Vector2d(x1, y1));
// hit → { renderable, point, normal, fraction }

// takes a Rect, not a Bounds
const inArea = app.world.adapter.queryAABB(new Rect(x, y, w, h));
```

`querySphere(centre, radius)` (or `querySphere(sphere)`) is **built-in only**,
and only active under a 3D broadphase — i.e. `world.sortOn === "depth"`, which
`Camera3d` sets. So is `raycast3d`. Check
`world.adapter.capabilities.raycasts3d` before calling either. `raycast` itself
is capability-gated by `capabilities.raycasts`.

The legacy `collision.rayCast(line, result)` is a different API: it takes a
`Line`, returns an **array** of every intersecting renderable, and only exists
on the built-in path.

Two prerequisites that produce empty results rather than errors:

- **`isKinematic` must be `false`** for a renderable to be in the broadphase at
  all (a `Body` sets this for you).
- On the **built-in** adapter, the broadphase is cleared and rebuilt inside
  `world.update()`, so querying before the first update returns nothing.

## Built-in world quirks

These are specific to the default world and surprise people arriving from a
real rigid-body engine:

- **Dynamic-dynamic collision is position-based, not Newtonian.** Separation is
  mass-proportional but the velocity response is per-body cancellation — two
  equal-mass bodies do not exchange momentum the way you would expect.
- **Gravity defaults to `(0, 0.98)`** — pixels per frame², not m/s². Mutate
  `app.world.adapter.gravity` at runtime, or pass
  `physic: new BuiltinAdapter({ gravity })` to override it. `body.gravityScale`
  (default `1`) scales it per body; `0` disables gravity for that body and is
  the portable replacement for the deprecated `body.ignoreGravity`.
- **`applyForce(x, y)` is linear only** unless you pass the optional
  `(pointX, pointY)` application point, which generates a torque
  `τ = r × F` into `body.angularVelocity` via `body.pseudoInertia`.
  `applyTorque(τ)` is the direct form. Note the rotation is visual: SAT
  collisions stay axis-aligned.
- **Force accumulators reset at end-of-step** — for every body, including
  static, paused and off-screen ones — so forces must be applied every frame to
  persist.
- **`isGrounded` is flag-based, not contact-based** — the adapter returns
  `!body.falling && !body.jumping`, flags updated by the last resolved
  collision, not a live contact test.
- **`def.density` maps 1:1 to `body.mass`** (default `1`), and `def.friction` is
  **ignored** entirely. `body.friction` is a per-axis `Vector2d` of per-step
  velocity damping fed from `def.frictionAir`, not a surface coefficient.
- **`body.maxVel` defaults to `(490, 490)`** and hard-clamps velocity after
  forces and friction. The canonical movement idiom is
  `this.body.force.x = this.body.maxVel.x`.
- **Default `collisionType` is `ENEMY_OBJECT`**, and default `collisionMask` is
  `ALL_OBJECT` — set both explicitly.
- **Integration is gated on `inViewport || alwaysUpdate`** — an off-screen body
  stops simulating unless you set `alwaysUpdate = true`. It is also gated on
  `updateWhenPaused` while the state manager is paused, and static bodies never
  integrate.
- **`addBody` throws on double-registration** for a renderable that is already
  adapter-managed.

## Porting between adapters

Same call, different magnitude — these are the ones that waste an afternoon:

- **The portable API converts for you, the native handle does not.**
  `adapter.setVelocity` / `body.setVelocity(x, y)` are in pixels on every
  adapter; reaching for the raw handle (`body.setLinearVelocity` on planck) puts
  you in metres per second, scaled by `pixelsPerMeter`.
- **Time base differs.** Built-in `body.vel` is pixels *per frame*; planck and
  matter integrate in seconds. The same number is ~60× off.
- **Force magnitudes are not comparable** between adapters; re-tune rather than
  reuse. `applyForce` is a per-step accumulator everywhere (cleared each step,
  so call it every frame) — `applyImpulse` is the one-shot. Matter has no native
  impulse, so the adapter emulates it as `Δv = J / mass` and ignores the
  application point.
- **`body.position` is the centroid in matter**, while `renderable.pos` is
  top-left in melonJS. The adapter stores a per-body offset so `renderable.pos`
  stays correct — but read `body.position` directly and you get the centroid.
- **Degenerate (zero-area / collinear) polygons — a Tiled polyline, a `Line` —
  cannot be built by matter and fall back to their axis-aligned bounding box.**
  Any other shape type throws `unsupported shape type`.
- **Ellipses become circles on matter**, using the average of the two radii.
- **`isGrounded` is capability-gated** (`capabilities.isGrounded`) and computed
  differently per adapter: a flag read on built-in, a live scan of active
  contacts on matter.

Adapter-specific escapes exist (`(this.body as MatterAdapter.Body).frictionAir`,
`adapter.matter.Constraint.create(...)`) but are not portable — flag them if you
use them. `adapter.capabilities` (`constraints`,
`continuousCollisionDetection`, `sleepingBodies`, `raycasts`, `raycasts3d`,
`velocityLimit`, `isGrounded`) is the portable way to branch.

## Symptom → cause

| symptom | cause |
|---|---|
| entity jitters or does not move | assigning `pos` instead of applying force |
| collision handler runs twice per frame | legacy `onCollision` on a dynamic pair (built-in) — use `onCollisionActive` |
| `return false` from a handler does nothing | return values are only honoured by legacy `onCollision` — use `isSensor` / `isTrigger` |
| crash or a null body when spawning from `onCollisionStart` | world mutated during contact dispatch (locked world under planck) |
| `raycast` / `queryAABB` finds nothing | `isKinematic` still `true`, or no `world.update` yet (built-in) |
| `querySphere` / `raycast3d` is not a function | 2D adapter, or built-in without a 3D broadphase (`sortOn !== "depth"`) |
| `response.depth` / `response.normal` are `undefined` | reading a legacy `onCollision` response — it carries `overlap` / `overlapN` |
| `onCollisionEnd` handler throws on `response` | built-in dispatches it with `undefined` |
| off-screen bodies stop simulating | built-in gating on `inViewport`; set `alwaysUpdate` |
| forces do nothing after switching adapter | magnitude units differ — re-tune, don't reuse numbers |
| `body.position` disagrees with `renderable.pos` on matter | matter stores the centroid, melonJS the top-left — the adapter offsets between them |
| a Tiled polyline becomes a solid box on matter | matter cannot build a zero-area polygon; the adapter falls back to its AABB |

## Related skills

- `melonjs-renderables` — `isKinematic`, which also gates the broadphase
- `melonjs-tilemaps` — collision shapes authored in Tiled
