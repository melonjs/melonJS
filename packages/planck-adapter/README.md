# @melonjs/planck-adapter

![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/planck-adapter)](https://www.npmjs.com/package/@melonjs/planck-adapter)

A [planck.js](https://piqnt.com/planck.js/) physics adapter for melonJS — drops in for the built-in SAT physics and gives you Box2D's rigid-body simulation, continuous collision detection, rotational dynamics, sleeping bodies, joints, and raycasting.

Planck is a faithful JavaScript/TypeScript port of [Box2D](https://box2d.org/) 2.3.0 — the same simulator behind Angry Birds, Limbo, and many of the touch-era classic mobile platformers. It is a sync, zero-WASM, MIT-licensed library that ships as plain ES modules.

**Per-object collision dispatch is already wired up.** Every `Renderable` receives `onCollisionStart(response, other)`, `onCollisionActive(response, other)`, and `onCollisionEnd(response, other)` callbacks — the same shape you use under the built-in adapter or `@melonjs/matter-adapter`. No rewrite, no contact-list firehose to filter yourself.

## Installation

```bash
npm install @melonjs/planck-adapter
```

`planck` is bundled in as a regular dependency, so you don't need to install it yourself — that's the whole point of the adapter. The only peer dependency is `melonjs` ≥ 19.5 (because melonJS is the one providing the `PhysicsAdapter` interface this package implements).

## Usage

Pass a `PlanckAdapter` instance as the `physic` option when constructing your `Application`:

```ts
import { PlanckAdapter } from "@melonjs/planck-adapter";
import { Application, video } from "melonjs";

const app = new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,
    physic: new PlanckAdapter({
        gravity: { x: 0, y: 320 },
    }),
});
```

That's it — every renderable that declares a `bodyDef` gets registered with planck automatically on `Container.addChild`, and the rest of your game code (collision handlers, velocity reads, gravity tweaks, etc.) talks to the shared `PhysicsAdapter` interface so it works with either adapter.

### Constructor options

```ts
new PlanckAdapter({
    gravity?: { x: number; y: number };  // default { x: 0, y: 320 } ≈ 10 m/s² pulling down
    pixelsPerMeter?: number;             // default 32
    subSteps?: number;                   // default 1
    velocityIterations?: number;         // default 8 (Box2D recommendation)
    positionIterations?: number;         // default 3 (Box2D recommendation)
})
```

#### `gravity`

Specified in **pixels per second²**, not meters. The adapter converts to meters internally using `pixelsPerMeter`. The default `(0, 320)` ≈ 10 m/s² at `pixelsPerMeter = 32` is Earth-like gravity pulling down — adjust for arcade feel.

#### `pixelsPerMeter`

Planck (and Box2D) operates in **meters** internally; the adapter converts to/from melonJS's pixel space at every boundary (positions, velocities, gravity, forces, AABB queries). The default `32` means one 32×32 sprite is one Box2D unit — which falls inside Box2D's tuned sweet spot (0.1 – 10 m). Bumping this makes the world feel "smaller" (objects act heavier); lowering makes everything feel "bigger" and risks solver instability if bodies grow past Box2D's tuned scale.

Pick once at construction time and stick with it — every body in the world shares the same scale.

#### `subSteps`

Divides each physics step into `N` sub-steps of `dt / N` seconds. Box2D's narrow phase isn't swept; a body moving more than ~one collision radius per tick can tunnel through a wall or another body. For very fast objects bump this to `2`–`4`. The default `1` matches plain Box2D behaviour.

#### `velocityIterations` / `positionIterations`

Box2D solver iteration counts. The defaults are Box2D's recommended `8` and `3`. Increase `positionIterations` for stiffer stacks (less jitter at the cost of CPU); increase `velocityIterations` for crisper restitution between bouncing bodies.

## Collision Events

The adapter dispatches planck's two native collision events to renderable hooks, plus an active-pair pass each step:

```ts
class Player extends Sprite {
    // fires once when two bodies begin contact (planck: begin-contact)
    onCollisionStart(response, other) { /* stomp, pickup, trigger entry */ }

    // fires every frame while two bodies remain in contact (adapter walks
    // the world contact list after each step)
    onCollisionActive(response, other) { /* sustained damage, conveyor friction */ }

    // fires once when two bodies separate (planck: end-contact)
    onCollisionEnd(response, other) { /* left the platform, exited a zone */ }
}
```

Implement only the ones you need — missing methods are silently skipped. The same three handlers also fire on the builtin SAT adapter and on `@melonjs/matter-adapter`, so handler code stays portable.

### The `response` object

The first argument passed to every collision hook is:

```ts
response = {
    a:      Renderable,                 // this renderable (the one whose handler is firing)
    b:      Renderable,                 // the other renderable
    normal: { x: number, y: number },   // unit MTV for `a` (direction to escape)
    depth:  number,                     // penetration depth in pixels (always positive)
    pair:   planck.Contact,             // raw planck Contact (manifold, points, fixtures, …)
}
```

**`normal` direction** — the minimum-translation vector *for the receiver*. It points in the direction `this` (a.k.a. `response.a`) must move to separate from `other`. Each side of the dispatch sees its own MTV, so the normals on the two handlers are mirrored.

In canvas coordinates (y grows downward):

- `normal.y < -0.7` → push me **up** to escape ⇒ I'm sitting on top of `other` (classic stomp / landing).
- `normal.y >  0.7` → push me **down** to escape ⇒ I'm underneath (head-bumped a ceiling, got stomped on).
- `Math.abs(normal.x) > 0.7` → mostly horizontal contact ⇒ side hit.

`response.pair` is planck's native `Contact` (with `getFixtureA()`, `getFixtureB()`, `getManifold()`, `getWorldManifold()`, etc.) for advanced use. The `normal` and `depth` fields are derived from `getWorldManifold` and `getManifold().points[i].separation` respectively, both expressed in melonJS pixel space.

## Body helper methods

The canonical portable surface is the `PhysicsAdapter` interface — every method below is also reachable as `adapter.X(renderable, ...)`. As a convenience this adapter bolts the portable operations onto `renderable.body` so the idiomatic form available on built-in `me.Body` works here too:

```ts
// Linear kinematics — spliced onto body (planck.Body has no equivalent)
body.setVelocity(x, y)                       // ⇔ adapter.setVelocity(renderable, { x, y })
body.getVelocity(out?)                       // ⇔ adapter.getVelocity(renderable, out)
body.applyForce(x, y)                        // ⇔ adapter.applyForce(renderable, { x, y })
body.applyForce(x, y, pointX, pointY)        // off-centre ⇒ generates torque (planck native lever-arm)
body.applyImpulse(x, y)                      // ⇔ adapter.applyImpulse(renderable, { x, y })

// Angular kinematics — NATIVE on planck.Body, reused as-is
body.setAngle(rad)                           // planck.Body.setAngle / adapter.setAngle
body.getAngle()                              // planck.Body.getAngle  / adapter.getAngle
body.setAngularVelocity(omega)               // planck.Body.setAngularVelocity / adapter.setAngularVelocity
body.getAngularVelocity()                    // planck.Body.getAngularVelocity / adapter.getAngularVelocity
body.applyTorque(t)                          // planck.Body.applyTorque / adapter.applyTorque

// Body state — spliced helpers wrap planck's per-fixture / mass-data APIs
body.setSensor(isSensor?)                    // toggles every fixture's sensor flag
body.setStatic(isStatic?)                    // ⇔ planck.Body.setType("static" | "dynamic")
body.setMass(m)                              // wraps planck.Body.setMassData (preserves center + inertia)
body.setBounce(r)                            // sets every fixture's restitution
body.setGravityScale(s)                      // planck.Body.setGravityScale (native, same name & sig)
body.setCollisionMask(mask)                  // sets every fixture's filterMaskBits
body.setCollisionType(type)                  // sets every fixture's filterCategoryBits
```

**Implementation note:** the helpers marked "NATIVE on planck.Body" are NOT spliced — planck's class already exposes them with compatible signatures, so the `PlanckAdapter.Body` type surfaces them via the intersection. Methods like `applyForce`, `setVelocity`, and `setStatic` that DO collide with native planck signatures (or use different shapes) are spliced on top of the body, replacing the native form with the portable one. The original `planck.Body.applyForce(Vec2, Vec2, wake)` is still reachable via `adapter.world.getBodyList()` if you absolutely need it, but you should generally prefer the portable form.

### Reaching planck-native body methods

Planck exposes a rich body API (sleeping control, mass data, CCD bullet flag, transform overrides, etc.) directly on the `planck.Body` instance. Cast to the published `PlanckAdapter.Body` type to keep type-checking happy without taking a direct `planck` import:

```ts
import { PlanckAdapter } from "@melonjs/planck-adapter";

// enable continuous collision detection for fast-moving objects (e.g. cue ball):
(ball.body as PlanckAdapter.Body).setBullet(true);

// suppress sleeping on a body that must always respond to user input:
(player.body as PlanckAdapter.Body).setSleepingAllowed(false);

// read planck-native mass:
const mass = (crate.body as PlanckAdapter.Body).getMass();
```

`PlanckAdapter.Body` is `planck.Body & PhysicsBody` — you get planck's full instance methods plus the portable helper methods, without needing to import `planck` yourself. Code that does this is planck-only by definition; for portable rotation use the angular kinematic methods above.

## Planck-specific APIs

These methods are exposed on the adapter for behaviours that Box2D supports natively but that the legacy SAT adapter either doesn't model or models differently. Game code that uses them won't run unchanged on the builtin adapter.

```ts
adapter.raycast(from: Vector2d, to: Vector2d) → RaycastHit | null
```
Shoot a ray through the world and get the first body hit. Returns the renderable, the world-space intersection point, the surface normal, and the fraction along the ray (`0..1`).

```ts
adapter.queryAABB(rect: Rect) → Renderable[]
```
Return every renderable whose body overlaps the rectangle. Useful for AoE checks, explosion targeting, mouse picking.

```ts
adapter.setSensor(renderable, isSensor)
```
Toggle every fixture on the body between solid and sensor mode at runtime. Sensors still fire `onCollisionStart` / `onCollisionActive` / `onCollisionEnd` — only the solver's separation step is disabled. Useful for one-way platforms, trigger zones, snap-to-surface ground assists.

### Direct engine access

For planck-specific features that don't fit the portable `PhysicsAdapter` surface — joints, particle systems, native queries, raw events — the adapter exposes two escape hatches:

```ts
const adapter = app.world.adapter as PlanckAdapter;

// The whole planck namespace. Modules are named exactly as in planck's docs
// (planck.RevoluteJoint, planck.DistanceJoint, planck.Box, planck.Circle, ...).
adapter.planck;          // typeof planck
const joint = new adapter.planck.RevoluteJoint(
    { collideConnected: false },
    a.body as PlanckAdapter.Body,
    b.body as PlanckAdapter.Body,
    new adapter.planck.Vec2(0, 0),
);
adapter.world.createJoint(joint);

// The underlying planck.World instance.
adapter.world;           // planck.World — full body / fixture / joint / contact APIs
```

Any code that touches `adapter.planck.*` or `adapter.world.*` is planck-only — it will not run on the built-in adapter or any future adapter. Use the `PhysicsAdapter` methods (`setVelocity`, `applyForce`, `setStatic`, `setSensor`, `raycast`, …) for anything that should stay portable.

## Body Definitions

melonJS body definitions (`BodyDefinition`) are mapped to planck bodies + fixtures. The keys you can set are the same as for the builtin adapter:

```ts
this.bodyDef = {
    type: "dynamic" | "static" | "kinematic",
    shapes: BodyShape[],         // Rect, Polygon, Ellipse (Ellipse → circle approximation)
    collisionType?: number,
    collisionMask?: number,
    maxVelocity?: { x, y },      // emulated via afterStep clamp
    frictionAir?: number,        // ⇒ planck.Body.setLinearDamping (scalar only)
    restitution?: number,
    density?: number,            // ⇒ fixture density (kg/m²)
    friction?: number,           // ⇒ fixture surface friction coefficient
    gravityScale?: number,
    isSensor?: boolean,
    fixedRotation?: boolean,     // planck native — defaults to true (matches SAT axis-aligned bodies)
};
```

Internally each `shape` becomes a `planck.Fixture` attached to a single `planck.Body`. Multi-shape defs produce a multi-fixture body (Box2D's compound-shape pattern).

### Collision filter API

For planck users, planck's per-fixture `categoryBits` / `maskBits` is exposed as a live alias of the legacy `body.collisionType` / `collisionMask`. Writes propagate to every fixture on the body:

```ts
// All four lines do the same thing — pick whichever convention you prefer:
body.collisionType = collision.types.PLAYER_OBJECT;
body.getFixtureList().setFilterCategoryBits(collision.types.PLAYER_OBJECT);

body.collisionMask = collision.types.ENEMY_OBJECT;
body.getFixtureList().setFilterMaskBits(collision.types.ENEMY_OBJECT);
```

## Behavioural notes when porting from the builtin adapter

- **Bodies have full rotational dynamics by default for non-fixedRotation bodies.** If your game code assumes axis-aligned bodies (reads `pos` and expects an unrotated rect), keep `fixedRotation: true` (the default).
- **Polylines (zero-thickness lines) don't translate.** planck — like Box2D — can't make a body from collinear vertices, and polygons must be convex with ≤8 vertices. Replace TMX polylines with thin rectangles at load time, or load and rewrite them post-load.
- **Ellipses are approximated as circles** with the average radius. For tall/narrow ellipses this is a poor fit; a polygon hull is a better choice when accuracy matters.
- **`maxVelocity` is emulated.** Box2D has no native velocity cap; the adapter clamps each body's velocity after every step.
- **`isGrounded` is literal.** It returns `true` whenever any contact pair has the other body's center below this one's. Inside an `onCollisionStart` handler for a stomp, the enemy you just landed on already counts as "ground" — so don't use `!isGrounded` as a proxy for "I was airborne before this contact." Use the body's pre-contact velocity instead (`vel.y > 0` ⇒ falling at impact).
- **Forces are real Newtons.** `applyForce(x, y)` is integrated as `force / mass * dt²`. Magnitudes feel ~100× smaller than the legacy SAT adapter — for jumps and dashes use `setVelocity` (immediate) or `applyImpulse` (`Δv = J / m`) instead.

## Behavioural notes when porting from `@melonjs/matter-adapter`

Most of the portable surface (`bodyDef`, `setVelocity`, `applyForce(x, y, px, py)`, the three collision hooks, `setSensor`, `setStatic`, `raycast`, `queryAABB`) works identically. The differences:

- **Box2D works in meters.** Forces, velocities, gravity, and positions go through `pixelsPerMeter` conversion. You don't have to do anything explicit; the boundary is invisible, but it means tuning numbers from a matter game don't transfer directly.
- **Per-body `gravityScale` is native** — no `beforeUpdate` counter-force emulation, no surprises near the threshold of 0.
- **Sleeping is native and unconditional.** Idle bodies sleep automatically (set `setSleepingAllowed(false)` on a body that must remain responsive without input).
- **Polygons must be convex with ≤8 vertices.** Matter accepts concave polygons (decomposed by `poly-decomp`); planck doesn't. Pre-decompose at TMX load time if your collision shapes include concave outlines.
- **No concept of "compound body" with sub-positions.** All fixtures share the same body anchor; multi-shape bodies effectively compose collision geometry into one rigid mass. Matter's distinct sub-body positions don't translate.
- **`Matter.Body.create({parts: [...]})` style compound bodies become a single planck body with multiple fixtures.** The adapter does this transparently.

## A simple porting example

The same player class on the matter adapter, then ported here:

**Before — `@melonjs/matter-adapter`:**

```ts
import { Application, collision, input, Rect, Sprite, video } from "melonjs";
import { MatterAdapter } from "@melonjs/matter-adapter";

new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,
    physic: new MatterAdapter({ gravity: { x: 0, y: 5 } }),
});
```

**After — `@melonjs/planck-adapter`:**

```ts
import { Application, collision, input, Rect, Sprite, video } from "melonjs";
import { PlanckAdapter } from "@melonjs/planck-adapter";

new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,
    // (1) Swap the adapter. Gravity is in px/s² now — pick a value that feels
    //     right for your sprite scale (32 px/m default ⇒ 320 ≈ Earth gravity).
    physic: new PlanckAdapter({ gravity: { x: 0, y: 320 } }),
});
```

The rest of the player class — `bodyDef`, `applyForce` magnitudes, `setVelocity`, collision hooks — typically ports unchanged. Tune `WALK_FORCE` upward if motion feels sluggish (Box2D's force-mass-dt² integration is similar to matter's but the unit scale through `pixelsPerMeter` shifts the numbers).

## Recipes

### Jump — instant upward impulse (Portable)

```ts
const vel = this.body.getVelocity();
this.body.setVelocity(vel.x, -JUMP_VEL);  // preserves horizontal motion
```

### Trigger zone / coin pickup (Portable)

Mark the body as a sensor:

```ts
this.bodyDef = {
    type: "static",
    shapes: [new Ellipse(16, 16, 32, 32)],
    isSensor: true,
    collisionType: collision.types.COLLECTABLE_OBJECT,
    collisionMask: collision.types.PLAYER_OBJECT,
};

onCollisionStart(_response, _other) {
    gameState.score += 100;
    this.ancestor.removeChild(this);
}
```

### Spring / hinge between two bodies (Planck-only)

```ts
const adapter = app.world.adapter as PlanckAdapter;
if (adapter.capabilities.constraints) {
    const joint = adapter.world.createJoint(new adapter.planck.DistanceJoint(
        {
            length: 80 / adapter.pixelsPerMeter,  // remember: planck wants meters
            frequencyHz: 4,                       // 0 = rigid, higher = stiffer
            dampingRatio: 0.5,
        },
        anchor.body as PlanckAdapter.Body,
        player.body as PlanckAdapter.Body,
        anchor.body.getPosition(),
        player.body.getPosition(),
    ));
}
```

For a revolute (pin) joint use `planck.RevoluteJoint`; for a prismatic (slider) joint use `planck.PrismaticJoint`. The full Box2D joint set is exposed via `adapter.planck.*`.

### CCD for fast objects (Planck-only)

For projectiles, break-shot cue balls, or other very fast bodies where the default narrow phase might miss a collision:

```ts
(projectile.body as PlanckAdapter.Body).setBullet(true);
```

Planck's CCD treats bullet bodies with a swept narrow phase, eliminating tunneling at the cost of extra solver work. Use sparingly — only on the small handful of bodies that genuinely need it.

### Disabling sleep on a body (Planck-only)

```ts
(player.body as PlanckAdapter.Body).setSleepingAllowed(false);
```

Useful for the player or any body that must respond instantly to input regardless of whether it's been idle. Planck will skip the sleep heuristic for that body and keep integrating it every step.

## Porting checklist

1. Verify the boot banner shows `physic: @melonjs/planck-adapter`
2. Pick a sensible `pixelsPerMeter` (default 32 works for most 16/32-px games)
3. Set `gravity` in px/s² (default 320 ≈ 10 m/s² at default scale)
4. Replace any `Matter.Body.applyForce(b, p, v)` direct calls with `body.applyForce(x, y, px, py)` (portable)
5. Convert any concave TMX polygons to convex pieces (planck can't decompose them)
6. Add `setBullet(true)` to any fast-moving projectiles
7. Pass `fixedRotation: true` in `bodyDef` for anything that should stay axis-aligned
