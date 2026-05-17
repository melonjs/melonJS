# @melonjs/matter-adapter

![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/matter-adapter)](https://www.npmjs.com/package/@melonjs/matter-adapter)

A [matter-js](https://brm.io/matter-js/) physics adapter for melonJS — drops in for the built-in SAT physics and gives you matter's rigid-body simulation, rotational dynamics, constraints, sleeping bodies, continuous collision detection, and raycasting.

**Per-object collision dispatch is already wired up.** Every `Renderable` receives `onCollisionStart(response, other)`, `onCollisionActive(response, other)`, and `onCollisionEnd(response, other)` callbacks — the same shape you use under the built-in adapter. No rewrite. No world-level pair firehose to filter yourself. The matter integration handles the pair-to-renderable routing for you.

## Installation

```bash
npm install @melonjs/matter-adapter matter-js
```

This adapter has two peer dependencies you provide yourself:

- `melonjs` ≥ 19.5
- `matter-js` ≥ 0.20

## Usage

Pass a `MatterAdapter` instance as the `physic` option when constructing your `Application`:

```ts
import { MatterAdapter } from "@melonjs/matter-adapter";
import { Application, video } from "melonjs";

const app = new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,
    physic: new MatterAdapter({
        gravity: { x: 0, y: 5 },
    }),
});
```

That's it — every renderable that declares a `bodyDef` gets registered with matter automatically on `Container.addChild`, and the rest of your game code (collision handlers, velocity reads, gravity tweaks, etc.) talks to the shared [`PhysicsAdapter`](https://melonjs.github.io/melonJS/) interface so it works with either adapter.

### Constructor options

```ts
new MatterAdapter({
    gravity?: { x: number; y: number };        // default { x: 0, y: 1 }
    matterEngineOptions?: Matter.IEngineDefinition; // pass-through to Matter.Engine.create
})
```

The defaults are matter-js native (`gravity = (0, 1)` with `gravity.scale = 0.001`). For an arcade-feel platformer where the player moves a few px per step, you usually want a stronger `gravity.y` (e.g. `4`–`6`).

## Collision Events

The adapter dispatches matter's three native collision events to renderable hooks:

```ts
class Player extends Sprite {
    // fires once when two bodies begin contact
    onCollisionStart(response, other) { /* stomp, pickup, trigger entry */ }

    // fires every frame while two bodies remain in contact
    onCollisionActive(response, other) { /* sustained damage, conveyor friction */ }

    // fires once when two bodies separate
    onCollisionEnd(response, other) { /* left the platform, exited a zone */ }
}
```

Implement only the ones you need — missing methods are silently skipped. The same three handlers also fire on the builtin SAT adapter (it synthesizes start/end via a frame diff), so handler code stays portable.

### The `response` object

The first argument passed to every collision hook is a matter-native response object:

```ts
response = {
    a:      Renderable,                 // this renderable (the one whose handler is firing)
    b:      Renderable,                 // the other renderable
    normal: { x: number, y: number },   // unit MTV for `a` (direction to escape)
    depth:  number,                     // penetration depth (always positive)
    pair:   Matter.Pair,                // raw matter pair (supports, tangent, bodies, …)
}
```

**`normal` direction** — the minimum-translation vector *for the receiver*. It points in the direction `this` (a.k.a. `response.a`) must move to separate from `other`. Each side of the dispatch sees its own MTV, so the normals on the two handlers are mirrored.

In canvas coordinates (y grows downward):

- `normal.y < -0.7` → push me **up** to escape ⇒ I'm sitting on top of `other` (classic stomp / landing).
- `normal.y >  0.7` → push me **down** to escape ⇒ I'm underneath (head-bumped a ceiling, got stomped on).
- `Math.abs(normal.x) > 0.7` → mostly horizontal contact ⇒ side hit.

`response.pair` is matter's native `Pair` (with `bodyA`, `bodyB`, `collision.supports`, `collision.tangent`, etc.) for advanced use. Note that `pair.collision.normal` is matter's raw normal (always the MTV of `pair.bodyA`); use the symmetric `response.normal` unless you specifically need the body-A-relative form.

## Body helper methods

The canonical portable surface is the `PhysicsAdapter` interface. As a convenience, this adapter also bolts the same operations onto `renderable.body` so the idiomatic form available on built-in `me.Body` works here too:

```ts
body.setVelocity(x, y)        // ⇔ adapter.setVelocity(renderable, { x, y })
body.getVelocity(out?)        // ⇔ adapter.getVelocity(renderable, out)
body.applyForce(x, y)         // ⇔ adapter.applyForce(renderable, { x, y })
body.applyImpulse(x, y)       // ⇔ adapter.applyImpulse(renderable, { x, y })
body.setSensor(isSensor?)     // ⇔ adapter.setSensor(renderable, isSensor)
body.setStatic(isStatic?)     // ⇔ adapter.setStatic(renderable, isStatic)
body.setMass(m)               // wraps Matter.Body.setMass
body.setBounce(r)             // writes Matter.Body.restitution
body.setGravityScale(s)       // ⇔ adapter.setGravityScale(renderable, s)
body.setCollisionMask(mask)   // writes Matter.Body.collisionFilter.mask
body.setCollisionType(type)   // writes Matter.Body.collisionFilter.category
```

Pick whichever reads better at the call site — both forms are portable. The raw matter free functions (`Matter.Body.setVelocity(body, v)` etc.) are not stripped, so they remain available for matter-specific arguments like a custom application point.

## Matter-specific APIs

These methods are exposed on the adapter for behaviours matter supports but the legacy SAT adapter doesn't have a clean equivalent for. Game code that uses them won't be portable back to the builtin adapter.

```ts
adapter.setAngle(renderable, angleInRadians)
```
Set a body's rotation. SAT bodies don't rotate (`fixedRotation` defaults to `true`); pass `fixedRotation: false` in your `bodyDef` to enable full rotational dynamics.

```ts
adapter.setSensor(renderable, isSensor)
```
Toggle a body between solid (matter's solver pushes contacts apart) and sensor (matter still fires `onCollisionStart` / `onCollisionActive` / `onCollisionEnd` but doesn't physically separate the bodies). Useful for one-way platforms, trigger zones, snap-to-surface ground assists, etc.

```ts
adapter.raycast(from: Vector2d, to: Vector2d) → RaycastHit | null
```
Shoot a ray through the world and get the first body hit. Returns the renderable, the intersection point, and the surface normal.

```ts
adapter.queryAABB(rect: Rect) → Renderable[]
```
Return every renderable whose body overlaps the rectangle. Useful for AoE checks, explosion targeting, mouse picking.

### Direct engine access

For matter-specific features that don't fit the portable `PhysicsAdapter` surface — constraints, compound bodies, queries, raw `Events`, plugins — the adapter exposes two escape hatches so you don't have to add `matter-js` as a direct dependency just to reach the factories:

```ts
const adapter = app.world.adapter as MatterAdapter;

// The whole matter-js namespace. Modules are named exactly as in matter's docs
// (Matter.Constraint, Matter.Composite, Matter.Bodies, Matter.Events, ...),
// so brm.io/matter-js examples copy-paste without renaming.
adapter.matter;          // typeof Matter
adapter.matter.Constraint.create({ bodyA, bodyB, stiffness: 0.04 });

// The Matter.Engine and its world (Matter.Composite that holds everything).
adapter.engine;          // Matter.Engine
adapter.engine.world;    // Matter.World — pass to Composite.add(...) / Composite.remove(...)
```

A complete spring constraint:

```ts
const spring = adapter.matter.Constraint.create({
    bodyA: playerSprite.body,
    bodyB: anchorSprite.body,
    stiffness: 0.04,
    length: 80,
});
adapter.matter.Composite.add(adapter.engine.world, spring);
```

Any code that touches `adapter.matter.*` or `adapter.engine.*` is matter-only — it will not run on the built-in adapter or any future adapter. Use the `PhysicsAdapter` methods (`setVelocity`, `applyForce`, `setStatic`, `setSensor`, `raycast`, …) for anything that should stay portable.

## Recipes

Concrete patterns for common gameplay needs. Each recipe is labelled **Portable** (same renderable code under any adapter), **Portable via velocity** (same code, just route through the body's velocity rather than the contact response), or **Matter-only** (uses a feature gated by `adapter.capabilities`).

### Jump — instant upward impulse (Portable)

`setVelocity` is the canonical "impulse" pattern on every adapter. Direct mutation of `vel.y` works under the builtin adapter but not under matter (matter's Verlet integrator needs both `velocity` and `positionPrev` reset together); the body method handles that for you.

```ts
const vel = this.body.getVelocity();
this.body.setVelocity(vel.x, -JUMP_VEL);  // preserves horizontal motion
```

### Trigger zone / coin pickup (Portable)

Mark the body as a sensor — collisions still fire `onCollisionStart` but the solver doesn't physically push the player away. `Collectable` and `Trigger` already declare `isSensor: true` in their default `bodyDef`.

```ts
class Coin extends Sprite {
    constructor(x, y) {
        super(x, y, { image: "coin" });
        this.bodyDef = {
            type: "static",
            shapes: [new Ellipse(16, 16, 32, 32)],
            isSensor: true,
            collisionType: collision.types.COLLECTABLE_OBJECT,
            collisionMask: collision.types.PLAYER_OBJECT,
        };
    }
    onCollisionStart(_response, _other) {
        gameState.score += 100;
        this.ancestor.removeChild(this);
    }
}
```

### One-way platform (Portable)

A sensor body + manual snap-to-top from the player. Falling players land; jumping players pass through; pressing _down_ drops through.

```ts
// Platform definition
this.bodyDef = {
    type: "static",
    shapes: [new Rect(0, 0, width, height)],
    isSensor: true,        // <-- key: matter doesn't try to resolve the contact
    collisionType: collision.types.WORLD_SHAPE,
    collisionMask: collision.types.PLAYER_OBJECT,
};

// Player handler — same on both adapters
onCollisionActive(_response, other) {
    if (other.type !== "platform") return;
    if (input.keyStatus("down")) return;              // drop-through
    const vel = this.body.getVelocity();
    if (vel.y < 0) return;                            // jumping up — pass through
    const playerBottom = this.pos.y + this.height;
    const platformTop = other.pos.y;
    if (playerBottom - platformTop > this.height * 0.5) return; // came from below
    const adapter = this.parentApp.world.adapter;
    adapter.setPosition(this, scratchPos.set(this.pos.x, platformTop - this.height));
    this.body.setVelocity(vel.x, 0);
}
```

### Stomp detection (Portable via velocity)

Read the body's **pre-contact velocity** in `onCollisionStart`. The signal is identical on every adapter and survives mid-tick mutations that contact normals can't.

```ts
onCollisionStart(_response, other) {
    if (other.body.collisionType !== collision.types.ENEMY_OBJECT) return;
    const vel = this.body.getVelocity();
    if (vel.y > 0) {
        // I was falling at the moment of impact — stomp
        other.die();
        this.body.setVelocity(vel.x, -STOMP_BOUNCE);
    } else {
        this.hurt();
    }
}
```

If you do want adapter-native contact info (slope normals, penetration depth) you can branch on `adapter.name === "@melonjs/matter-adapter"` and reach `response.normal` / `response.depth` / `response.pair` — but that handler is no longer portable.

### Spring / hinge between two bodies (Matter-only)

Matter constraints are reached via the adapter's `matter` escape hatch — no need to add `matter-js` as a direct dependency.

```ts
const adapter = app.world.adapter as MatterAdapter;
if (adapter.capabilities.constraints) {
    const spring = adapter.matter.Constraint.create({
        bodyA: anchor.body,
        bodyB: player.body,
        stiffness: 0.04,    // 0 = floppy rope, 1 = rigid rod
        length: 80,
    });
    adapter.matter.Composite.add(adapter.engine.world, spring);
}
```

Use `stiffness: 1` for a rigid hinge, low `stiffness` (~0.01–0.05) for spring-like behaviour. Set `pointA` / `pointB` to attach the constraint at a point offset from each body's centre.

### Sleeping bodies (Matter-only)

Matter can mark idle bodies as "sleeping" and skip integrating them entirely until disturbed — a meaningful CPU win when you have dozens of static-after-settling props (debris, fallen blocks, settled stacks). Enable at the engine level via the constructor, then leave matter to manage sleep state.

```ts
new MatterAdapter({
    gravity: { x: 0, y: 5 },
    matterEngineOptions: {
        enableSleeping: true,
    },
});

// Wake a specific body programmatically if needed (e.g. on a trigger event):
const adapter = app.world.adapter as MatterAdapter;
if (adapter.capabilities.sleepingBodies) {
    adapter.matter.Sleeping.set(this.body, false);
}
```

The builtin adapter has no equivalent — there's no integration cost to skip, since SAT only runs collisions, not Verlet integration.

## Body Definitions

melonJS body definitions (`BodyDefinition`) are mapped to matter bodies. The keys you can set are the same as for the builtin adapter:

```ts
this.bodyDef = {
    type: "dynamic" | "static",
    shapes: BodyShape[],         // Rect, Polygon, Ellipse, etc.
    collisionType?: number,
    collisionMask?: number,
    maxVelocity?: { x, y },
    frictionAir?: number | { x, y },
    restitution?: number,
    density?: number,
    gravityScale?: number,
    isSensor?: boolean,
    fixedRotation?: boolean,     // matter only — defaults to true
};
```

### Collision filter API

For matter users, the matter-native `body.collisionFilter.category` / `mask` is exposed as a live alias of the legacy `body.collisionType` / `collisionMask`:

```ts
// All four lines do the same thing — pick whichever convention you prefer:
body.collisionFilter.category = collision.types.PLAYER_OBJECT;
body.collisionType = collision.types.PLAYER_OBJECT;

body.collisionFilter.mask = collision.types.ENEMY_OBJECT;
body.collisionMask = collision.types.ENEMY_OBJECT;
```

## Behavioural notes when porting from the builtin adapter

- **Bodies have full rotational dynamics by default for non-fixedRotation bodies.** If your game code assumes axis-aligned bodies (e.g. it reads `pos` and expects an unrotated rect), keep `fixedRotation: true` (the default).
- **Polylines (zero-thickness lines) don't translate.** matter can't make a body from collinear vertices. Give them a small thickness, or load the TMX shape and rewrite it post-load (see the `platformer-matter` example).
- **`maxVelocity` is emulated.** matter has no native velocity cap; the adapter clamps each body's velocity in `afterUpdate`.
- **Per-body `gravityScale` is emulated.** matter 0.20 only honors the engine-level `gravity.scale`; the adapter applies a counter-force in `beforeUpdate` for bodies that opt out.
- **`isGrounded` is literal.** It returns `true` whenever any contact pair has the other body's center below this one's. Inside an `onCollisionStart` handler for a stomp, the enemy you just landed on already counts as "ground" — so don't use `!isGrounded` as a proxy for "I was airborne before this contact."

## Porting from the built-in adapter

The `PhysicsAdapter` interface is the portable surface. If your gameplay code only uses methods on `world.adapter` (and the four collision hooks on `Renderable`), most of it ports without changes. The pitfalls below cover the parts that don't.

> **Coming from a pre-19.5 codebase?** If your game still uses the legacy `new me.Body(this, shape)` pattern and the `onCollision(response, other)` handler, start with the wiki's [Migrating to the Physics Adapter API](https://github.com/melonjs/melonJS/wiki/Migrating-to-the-Physics-Adapter-API) guide — it covers the legacy → declarative `bodyDef` + lifecycle-handler migration on the built-in adapter. The notes below pick up after that, for the actual built-in → matter swap. See also [Switching Physics Adapters](https://github.com/melonjs/melonJS/wiki/Switching-Physics-Adapters) and [BuiltinAdapter Quirks](https://github.com/melonjs/melonJS/wiki/BuiltinAdapter-Quirks) for engine-portability gotchas.

### `isGrounded` is literal, not predictive

It returns `true` whenever there's an active contact with a body whose center is below ours. Inside an `onCollisionStart` for a stomp, the enemy you just landed on already counts as "ground" — so `!isGrounded` is **not** a reliable "I was airborne before this contact" check. Use the body's pre-contact **velocity** instead (`vel.y > 0` = falling at impact).

### Matter forces are *much* smaller than builtin forces

`applyForce` on matter integrates as `force / mass * dt²`. With a typical 64×96 sprite (mass ≈ 6) and `dt ≈ 16`, a force of `0.05` already moves the body noticeably. If you ported a builtin `WALK_FORCE = 0.4` directly, the player rockets across the screen. Start ~100× smaller and tune up.

### `applyForce` is not a one-shot impulse

It's a sustained Newtonian force, reset at the end of each step. The single-step contribution depends on `dt` and mass, so it's a fragile way to do "instant velocity change" — for jumps, dashes, knockbacks, use `setVelocity` (immediate) or `applyImpulse`.

### Sensor bodies disable physical resolution

To make a body non-solid (one-way platform, trigger zone, ground-snap assist), mark it as a sensor:

```ts
adapter.setSensor(platform, true);
// or declaratively on the body def:
bodyDef.isSensor = true;
```

A sensor still fires `onCollisionStart` / `onCollisionActive` / `onCollisionEnd` — only the physical separation is disabled.

### Slopes need to be authored as proper ramps OR use snap-to-surface

The builtin adapter's slope handling pattern (mutating `response.overlapV.y` to force the player up regardless of contact angle) doesn't translate — matter resolves contacts based on actual geometry. If your TMX has a slope polygon with a vertical "approach wall," matter will block the player. Two ways out:

1. Author the slope as a 3-vertex triangle (no approach wall).
2. Detect slope contact in `onCollisionActive` and manually snap the player to the slope's surface Y at their X (`adapter.setPosition(player, x, surfaceY - playerHeight)`). The matter-platformer example uses this pattern.

### One-way platforms

A sensor body + manual landing snap. Falling players land; jumping players pass through; pressing _down_ drops through:

```ts
// at load time
adapter.setSensor(platform, true);

// in player.onCollisionActive(_response, other):
if (other.type === "platform") {
    if (input.keyStatus("down")) return;           // drop through
    const vel = adapter.getVelocity(this);
    if (vel.y < 0) return;                          // jumping up
    const playerBottom = this.pos.y + this.height;
    if (playerBottom > other.pos.y + 16) return;    // too deep — came from below
    adapter.setPosition(this, new Vector2d(this.pos.x, other.pos.y - this.height));
    adapter.setVelocity(this, new Vector2d(vel.x, 0));
}
```

### TMX polylines

matter can't build a body from collinear vertices. Replace polyline bodies with thin rectangles at load time (`adapter.updateShape(obj, [new Rect(0, 0, width, 6)])`).

### `body.position` vs `renderable.pos`

matter's `body.position` is the **centroid**; `renderable.pos` is **top-left** (with anchor 0,0). The adapter keeps the two in sync via a stored offset — your gameplay code should read `renderable.pos` for visual placement; only reach for `body.position` for matter-internal needs.

### A simple porting example

A minimal player entity. The same class on the built-in adapter, then ported here. Numbered comments call out what changed and why.

**Before — built-in (SAT) adapter:**

```ts
import { Application, collision, input, Rect, Sprite, video } from "melonjs";

new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,
    // physic: defaults to BuiltinAdapter
});

const MAX_VEL_X = 3;
const MAX_VEL_Y = 15;

class Player extends Sprite {
    constructor(x: number, y: number) {
        super(x, y, { image: "player", framewidth: 64, frameheight: 96 });

        this.bodyDef = {
            type: "dynamic",
            shapes: [new Rect(0, 0, 64, 96)],
            collisionType: collision.types.PLAYER_OBJECT,
            maxVelocity: { x: MAX_VEL_X, y: MAX_VEL_Y },
            frictionAir: { x: 0.4, y: 0 },
        };

        input.bindKey(input.KEY.LEFT,  "left");
        input.bindKey(input.KEY.RIGHT, "right");
        input.bindKey(input.KEY.UP,    "jump", true);
    }

    update(dt: number) {
        const adapter = this.parentApp.world.adapter;
        const vel = adapter.getVelocity(this);

        if (input.isKeyPressed("left")) {
            adapter.applyForce(this, { x: -MAX_VEL_X, y: 0 });
        } else if (input.isKeyPressed("right")) {
            adapter.applyForce(this, { x:  MAX_VEL_X, y: 0 });
        }
        if (input.isKeyPressed("jump")) {
            adapter.setVelocity(this, { x: vel.x, y: -MAX_VEL_Y });
        }

        return super.update(dt);
    }

    onCollisionStart(response, other) {
        if (other.body.collisionType !== collision.types.ENEMY_OBJECT) return;
        const adapter = this.parentApp.world.adapter;
        if (response.normal.y < -0.7) {
            // I'm on top of the enemy — stomp
            const vel = adapter.getVelocity(this);
            adapter.setVelocity(this, { x: vel.x, y: -MAX_VEL_Y * 0.75 });
            return;
        }
        this.hurt();
    }
}
```

**After — `@melonjs/matter-adapter`:**

```ts
import { Application, collision, input, Rect, Sprite, video } from "melonjs";
import { MatterAdapter } from "@melonjs/matter-adapter";

new Application(800, 600, {
    parent: "screen",
    renderer: video.AUTO,
    // (1) Swap the adapter. Pick a gravity that suits your sprite scale.
    physic: new MatterAdapter({ gravity: { x: 0, y: 5 } }),
});

const MAX_VEL_X = 3;
const MAX_VEL_Y = 15;
// (2) Matter forces are Newtonian (force/mass*dt²) — magnitudes ~100× smaller.
const WALK_FORCE = 0.012;

class Player extends Sprite {
    constructor(x: number, y: number) {
        super(x, y, { image: "player", framewidth: 64, frameheight: 96 });

        // bodyDef is portable — shape, collision type, maxVelocity unchanged.
        // (3) frictionAir is scalar in matter (no per-axis variant).
        this.bodyDef = {
            type: "dynamic",
            shapes: [new Rect(0, 0, 64, 96)],
            collisionType: collision.types.PLAYER_OBJECT,
            maxVelocity: { x: MAX_VEL_X, y: MAX_VEL_Y },
            frictionAir: 0.02,
        };

        input.bindKey(input.KEY.LEFT,  "left");
        input.bindKey(input.KEY.RIGHT, "right");
        input.bindKey(input.KEY.UP,    "jump", true);
    }

    update(dt: number) {
        const adapter = this.parentApp.world.adapter;
        const vel = adapter.getVelocity(this);

        // (4) Same applyForce calls — only the magnitude changed.
        if (input.isKeyPressed("left")) {
            adapter.applyForce(this, { x: -WALK_FORCE, y: 0 });
        } else if (input.isKeyPressed("right")) {
            adapter.applyForce(this, { x:  WALK_FORCE, y: 0 });
        }
        // (5) setVelocity is portable — works the same way on both adapters.
        if (input.isKeyPressed("jump")) {
            adapter.setVelocity(this, { x: vel.x, y: -MAX_VEL_Y });
        }

        return super.update(dt);
    }

    // (6) Stomp logic is unchanged — `response.normal` and `onCollisionStart`
    //     are part of the portable API and behave identically on both adapters.
    onCollisionStart(response, other) {
        if (other.body.collisionType !== collision.types.ENEMY_OBJECT) return;
        if (response.normal.y < -0.7) {
            const adapter = this.parentApp.world.adapter;
            const vel = adapter.getVelocity(this);
            adapter.setVelocity(this, { x: vel.x, y: -MAX_VEL_Y * 0.75 });
            return;
        }
        this.hurt();
    }
}
```

**Summary of changes:**

| # | Change | Reason |
|---|---|---|
| 1 | Pass `MatterAdapter` to `physic` | switching engines |
| 2 | `WALK_FORCE = 0.012` (down from `3`) | Newtonian magnitudes are much smaller |
| 3 | `frictionAir: 0.02` (scalar) | matter has no per-axis air friction |
| 4 | `applyForce` calls unchanged | portable API |
| 5 | `setVelocity` for jump unchanged | portable; correct pattern for instant velocity change |
| 6 | `onCollisionStart` + `response.normal` unchanged | portable lifecycle handler with identical contract on both adapters |

`bodyDef` shape, collision masks, max-velocity cap, key bindings, sprite setup, collision handler — all unchanged.

### Default behaviour differences vs builtin

| Behaviour | Builtin | Matter |
|---|---|---|
| `fixedRotation` default | n/a (SAT bodies don't rotate) | `true` — matches SAT. Set `false` in `bodyDef` to enable rotation. |
| Continuous collision detection | ❌ | ✅ |
| Sleeping bodies | ❌ | ✅ |
| Constraints (springs, joints) | ❌ | ✅ via `Matter.Constraint` (reach via `adapter.engine`) |
| `applyForce` units | px/frame² | matter Newtonian |

## Porting checklist

1. Verify the boot banner shows `physic: @melonjs/matter-adapter`
2. Set a reasonable `gravity` (e.g. `{ x: 0, y: 4 }` for arcade platformers)
3. Divide your existing `applyForce` magnitudes by ~30–100 as a starting point
4. Use `response.normal.y < -0.7` for stomp checks instead of `!isGrounded` (matter-native MTV; portable to builtin too)
5. Mark trigger / one-way / pickup bodies as `isSensor: true` to disable physical resolution while still firing the lifecycle handlers
6. Replace slope-response hacks with snap-to-surface in `onCollisionActive`
7. Convert TMX polylines to thin rectangles at load time
8. Pass `fixedRotation: true` in `bodyDef` for anything that should stay axis-aligned

## Examples

The melonJS repo's `platformer-matter` example is a full port of the canonical platformer running on this adapter, including:

- Matter-native player movement (`applyForce` for walking, `setVelocity` for the jump impulse + `applyForce` for the variable-height hold)
- Velocity-based stomp detection
- Slope-grip via `onCollisionActive`
- One-way platforms via `setSensor` + manual landing snap
- A live `physic:` line in the boot banner showing this adapter was loaded

## License

[MIT](https://github.com/melonjs/melonJS/blob/master/LICENSE)
