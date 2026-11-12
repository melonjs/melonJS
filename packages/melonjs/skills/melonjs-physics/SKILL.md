---
name: melonjs-physics
description: "Use this skill for collision, physics bodies, movement, and spatial queries in melonJS — the built-in SAT world and the planck, matter and Rapier adapters. Covers bodyDef vs Body, collision types and masks, the collision callback family and their firing rules, raycast/queryAABB/querySphere, the behaviour differences between adapters, and which one to pick for a given game. Triggers on: which physics engine, choosing an adapter, switching adapters, setAdapter, PhysicsAdapterClass, create, rotation collision, rotating body, torque, joints, addJoint, removeJoint, hinge, rope, weld, slider, stacking, Body, bodyDef, collision, collisionType, collisionMask, onCollision, onCollisionStart, onCollisionActive, raycast, queryAABB, querySphere, raycast3d, PlanckAdapter, MatterAdapter, RapierAdapter, rapier2d, enableCcd, gravity, velocity, applyForce, isGrounded, isSensor, isTrigger, onShapeCollisionStart, kinematic, subSteps, pixelsPerMeter, Box3d, Sphere, getBodyShapes, hitbox offset, slope, SAT."
license: MIT
---

# Physics and collision

> melonJS has a built-in SAT collision world and three optional rigid-body
> adapters. Movement, collision callbacks and spatial queries all behave
> differently depending on which is active — and several of the differences fail
> silently.

## Choosing a world

| | when | joints (`world.addJoint()`) |
|---|---|---|
| **built-in** (default) | Arcade-style: platformers, top-down games. Fast, position-based, not Newtonian. | ❌ throws |
| **`@melonjs/planck-adapter`** | Full rigid-body dynamics: stacking, realistic restitution. | ✅ hinge, rope, weld, slider |
| **`@melonjs/matter-adapter`** | Same class of thing, backed by matter-js. | ❌ throws (matter's own constraints, through `adapter.matter`) |
| **`@melonjs/rapier2d-adapter`** | Same again, backed by Rapier compiled to WebAssembly: many bodies, per-body continuous collision, a character controller. Loaded asynchronously. | ✅ hinge, rope, weld, slider |

### Picking one

Start with the built-in. It is the default for a reason: no dependency, the
smallest bundle, and its position-based model is what most 2D games actually
want — a platformer's jump arc is a designed curve, not a simulated one, and
tuning gravity against a solver you are fighting is a bad afternoon.

**Move to an adapter when the game needs something the builtin cannot express**,
and these are the usual triggers:

- **Rotation that collides.** The clearest signal. The builtin's SAT never reads
  `body.angle`, so a spinning shape collides as though it never turned. See
  the note in *Built-in world quirks* below.
- **Torque, angular velocity, or spin from an impact.** Anything that should
  start turning *because* it was hit.
- **Joints and constraints** — ragdolls, chains, ropes, vehicles, hinged doors.
  The builtin has no concept of them.
- **Stacking and resting contacts.** Boxes that pile up and stay put need an
  iterative solver. The builtin resolves each contact once per step with no
  iteration pass, which splits three ways. A dynamic body resting on STATIC
  geometry is exact, to the pixel, which is the platformer case it exists for.
  A body squeezed between a dynamic body and static geometry is exact too: the
  immovable side gets the casting vote and the other body absorbs the whole
  correction, so a crate shoved against a wall stops at the wall. But a body
  squeezed between two DYNAMIC bodies has no immovable side to defer to, so
  those per-pair corrections still compete and it comes to rest slightly
  overlapping. Three stacked 44px boxes rest flush on the floor with about 2px
  of overlap inside the pile, and stay there: a stable equilibrium, not jitter
  you can wait out or tune away.
- **Believable restitution and friction**, where a ball's bounce height and roll
  should follow from its material rather than from code you wrote per case.

**Stay on the built-in when** the game is grid or tile based, movement is
authored rather than simulated, collision is "did these two boxes touch" plus a
push-out, or you are shipping to a tight bundle budget. Tiled maps, `Trigger`
and `Collectable` all work on every backend, so this is not a fork in the road
for level content.

**planck, matter or Rapier?** All three are real rigid-body engines and any
will do; the adapters expose the same portable API, so a game can switch with
an import change and a gravity re-tune.

- **planck** (a Box2D port) is the more accurate and the more predictable under
  stress: better stacking, better joint behaviour, continuous collision for
  fast movers. Box2D's `bullet` mode is not a `bodyDef` field: set it on the
  native body with `(this.body as PlanckAdapter.Body).setBullet(true)`. It
  works in **metres**, so it has a `pixelsPerMeter` scale to think about, and
  its tuning vocabulary is Box2D's.
- **matter-js** works directly in **pixels**, which makes it the gentler
  introduction, and its compound bodies and constraints are pleasant to author.
  It is the softer solver: stacks settle less crisply, and it has no continuous
  collision, so fast bodies need `subSteps`.
- **Rapier** (`@melonjs/rapier2d-adapter`) is a Rust engine compiled to
  WebAssembly. It handles many bodies at once, has continuous collision per
  body for fast projectiles (`(this.body as RapierAdapter.Body).enableCcd(true)`),
  a kinematic character controller, and simulates a concave polygon exactly.
  It works in **metres** like planck, with the same `pixelsPerMeter`. The cost
  is the download: about 3 MB of WebAssembly, fetched and compiled on demand,
  so the adapter must be made with `await RapierAdapter.create()`.

**By game type**, the same choice from the other end:

| game | adapter | why |
|---|---|---|
| tile platformer, jumps authored as curves | built-in | movement is designed, not simulated; a body resting on flat static ground is exact to the pixel |
| platformer with slopes the player stands still on | any rigid-body adapter | the built-in has no surface friction, so a body on an incline slides down it. Walking up one is your own code on matter and planck (the `platformer-matter` example snaps its player onto sensor slopes); Rapier's character controller does it, through Rapier's own API, not the portable one |
| platformer with moving platforms that carry the player | planck or Rapier | true kinematic bodies, moved by their velocity; the built-in and matter build a dynamic body for `kinematic` |
| top-down RPG or adventure, grid or tile puzzle | built-in | collision is "did these touch" plus a push-out; no dependency, smallest bundle |
| shoot-'em-up, bullet hell | built-in | bullets need detection, not a physical response |
| 2.5D with height: isometric, beat-'em-up lanes | built-in only | the only backend that takes `Box3d` and `Sphere`; the 2D engines refuse them |
| fighting game or brawler, hitboxes and hurtboxes on one body | built-in, planck or Rapier | matter ignores a shape's own `collisionType`, `collisionMask` and `isTrigger` |
| stacking, towers, catapult and destruction puzzles | planck, or Rapier for many pieces | an iterative solver keeps a pile crisp; Rapier is built for many bodies at once |
| pool, billiards, mini-golf: few bodies, a capped top speed | any rigid-body adapter, matter included | give matter enough `subSteps` that a ball moves less than its radius per sub-step: the `pool-matter` example's break, about 30 px a frame on 16 px balls, runs on 2 |
| pinball, physical bullets: bodies much faster than their own size, with no useful cap | planck or Rapier | continuous collision (planck's `setBullet`, Rapier's `enableCcd`); matter has none, and each sub-step is a full extra solve |
| vehicles, ragdolls, ropes, chains, doors, lifts | planck or Rapier | `world.addJoint()` makes hinge, rope, weld and slider joints the same way on both; matter has only its own constraints, through `adapter.matter` |
| casual physics toy, prototype, game jam | matter | it works in pixels, so there is nothing to convert; its softer stacking does not show |
| sandbox with lots of debris | Rapier | many bodies at once, concave pieces simulated exactly |
| playable ad, size-capped portal, instant load | built-in, not Rapier | Rapier downloads and compiles about 3 MB of WebAssembly |

One game can use more than one: `world.setAdapter()` swaps the backend between
screens, so a platformer on the built-in can run a physics mini-game on planck
(see [Switching adapters while the game runs](#switching-adapters-while-the-game-runs)).

An adapter is an `Application` setting, not a plugin:

```js
import { PlanckAdapter } from "@melonjs/planck-adapter";

const app = new Application(800, 600, {
    parent: "screen",
    physic: await PlanckAdapter.create({
        gravity: { x: 0, y: 320 },   // pixels/s², default {x: 0, y: 320}
        pixelsPerMeter: 32,          // default 32
        subSteps: 2,                 // default 1
    }),
});
await app.init();
```

**Make an adapter with `await X.create(options)`.** Every adapter class has
the same static pair (`PhysicsAdapterClass`): `load()` resolves once the
adapter can be built, and `create()` waits for it, then constructs. The
builtin, matter and planck adapters are plain JavaScript, so their `load()`
resolves at once and `new X(options)` is equivalent and still supported; an
adapter whose engine is WebAssembly downloads and compiles it in `load()`, and
only `create()` works for it without a prior `load()`. Write `create()` and
the code is the same for every adapter.

The Rapier adapter is that case. `new RapierAdapter()` before its `load()` has
finished throws "Rapier is not loaded yet"; `RapierAdapter.loaded` says
whether it has. `load()` returns one shared promise, so start it early and the
download runs alongside the game's own assets:

```js
const rapierReady = RapierAdapter.load();   // starts the download now
await loader.preload(assets);
await rapierReady;
app.world.setAdapter(new RapierAdapter());
```

`PlanckAdapter` also takes `velocityIterations` (default `8`) and
`positionIterations` (default `3`). `MatterAdapter` takes a different set —
`gravity` (default `{x: 0, y: 1}`, matter's own convention), `subSteps` and
`matterEngineOptions`; it has no `pixelsPerMeter` because it already works in
pixels. `RapierAdapter` takes `gravity` (pixels/s², default `{x: 0, y: 320}`),
`pixelsPerMeter` (default `32`) and `subSteps` (default `1`); Rapier's own
solver settings stay writable on `adapter.world.integrationParameters`.

`subSteps` is the anti-tunnelling knob when per-frame motion exceeds a body
radius. matter and planck clear forces after every sub-step, so a force applied
once per frame acts on the first sub-step only: raising `subSteps` weakens
every `applyForce`, and forces need re-tuning after it changes. Rapier keeps a
force for the whole frame, across every sub-step, so its forces do not change.

Pick **one** adapter per game (it can be switched later, see
[Switching adapters while the game runs](#switching-adapters-while-the-game-runs));
`physic: "none"` disables physics entirely — `world.step` skips the simulation
and the world behaves as a pure scene graph.

**Gravity is a different unit in every backend, and the defaults are NOT the
same speed.** Each is "Earth-like" in its own convention, but measured against
each other by timing a 200px free fall in one scene:

| backend | default | unit | measured fall |
|---|---|---|---|
| built-in | `0.98` | pixels per STEP², 60 steps a second | **~3600 px/s²** |
| matter | `{x: 0, y: 1}` | matter's own, after its internal `gravity.scale` | **~900 px/s²** |
| planck | `320` | pixels per second² | **~330 px/s²** |
| rapier | `320` | pixels per second², as planck | **~320 px/s²** |

That is a roughly **elevenfold spread**, so swapping the built-in world for an
adapter and keeping everything else the same makes the whole game feel
different. It is not a bug in either one: they simply do not share a unit.

To match a backend you are porting FROM, pick a target in px/s² and convert,
scaling each default by its measured fall: planck and Rapier take it directly;
matter takes `target / 900`; the built-in takes `0.98 * target / 3600`,
because it applies gravity per step, 60 steps a second, rather than per
second. Passing one number to two of them compares nothing:
hand planck matter's `{x: 0, y: 1}` and it runs at a three-hundredth of Earth
gravity.

That mistake is quiet and it does not look like a gravity problem. Bodies fall
slowly enough that a spawner keeping a fixed interval starts constructing them
inside each other, and **a body born overlapping another is outside what a
solver promises to fix**: the contact normals of an interlocked pair can cancel
out, leaving the position solver with nowhere to push. The symptom is two
shapes permanently fused at rest, which reads as a broken collision shape
rather than as a bad gravity constant. Spawn clear of anything already there.

`world.physic` carries the active adapter's label (`"builtin"`, `"planck"`,
`"matter"`, `"rapier"`, `"none"`), so game code can branch without importing
the class.

### Switching adapters while the game runs

`world.adapter` is read-only. `app.world.setAdapter(adapter)` replaces it, for
example to move from planck to matter between two screens:

```ts
import { MatterAdapter } from "@melonjs/matter-adapter";

app.world.setAdapter(await MatterAdapter.create({ gravity: { x: 0, y: 1 } }));
```

The old adapter is destroyed, and the new one builds every body in the world
again from its renderable's `bodyDef`, where the renderable stands and at
the angle its body had.
`world.physic` takes the new adapter's label.

- The joints `world.addJoint()` made are built again too, after the bodies,
  and the handles keep working (see [Joints](#joints-hinges-ropes-welds-and-sliders)).
  Switching to an adapter without joints (built-in, matter) drops them, and
  `setAdapter()` throws once the switch is complete; remove them first with
  `world.removeJoint()` when the switch is meant.
- Nothing else carries over: velocities, forces and contacts start from rest,
  and gravity is the new adapter's own, in its own unit (see the table
  above).
- A body added with a direct `adapter.addBody()` call rather than a `bodyDef`
  is not built again. A legacy `Body` without a `bodyDef` works on the
  built-in adapter only.
- Called from a collision handler, the swap waits for the end of the physics
  step, so `world.adapter` is still the old adapter for the rest of that
  handler.
- Code that kept the old adapter in a field (`this.adapter = app.world.adapter`)
  must read `app.world.adapter` again after the swap.

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
Nesting is fine: adding a container registers the body of every renderable
below it, at any depth, and removing it — destroyed, pooled or kept alive —
takes them all out again, so moving a whole group with `other.addChild(group)`
keeps each body simulated, once. A persistent container's children keep their
bodies through `world.reset()` (a state change or `level.load`).
Calling `adapter.addBody()` yourself registers the body but leaves the
renderable out of the scene graph. On the built-in adapter that body is then
outside the broadphase, so it never collides, and it does not move either
unless the renderable has `alwaysUpdate` set. On matter, planck and Rapier the
body is in the engine's world and collides, but its renderable is never drawn.

`type` is `"static"`, `"dynamic"` or `"kinematic"`, but only planck and Rapier
have a kinematic body: moved by its velocity (`setVelocity`), not by gravity.
The built-in and matter adapters build `"kinematic"` as a dynamic body, which
falls under gravity. For a moving platform that works on every backend, use
`type: "static"` and move it with `app.world.adapter.setPosition()`.

**`fixedRotation` follows the engine, so bodies rotate.** matter, planck and
Rapier all default it to `false`, and so do their adapters (from matter-adapter
1.4.0 and planck-adapter 1.5.0). Pass `fixedRotation: true` for anything that must
stay upright, such as a platformer actor. Earlier adapter versions locked
rotation unless told otherwise, which inverted the engine they wrap: bodies
landed holding whatever angle they were given and no collision could turn them,
while `setAngle()` still worked, so a body could look rotated while being
unable to rotate.

`frictionAir` damps **rotation as well as translation** on matter, planck and
Rapier, so
it is also what settles a spin. Left at `0` a body that starts turning never
stops, which only became visible once rotation stopped being locked. The same
holds for `adapter.setFrictionAir()` at runtime (on planck, from
planck-adapter 1.7.0).

Other portable `bodyDef` fields: `density`, `frictionAir` (number or `{x, y}`),
`friction`, `restitution`, `gravityScale`, `maxVelocity`, `fixedRotation`,
`isSensor`, `userData`. Not every adapter honours every one. The built-in
adapter ignores `friction` and `fixedRotation`, and no adapter reads
`userData`. The built-in maps `frictionAir` onto its per-axis `body.friction`
vector, a per-step deceleration in pixels rather than the damping the adapters
use (a fraction per step on matter, a rate per second on planck and Rapier), so
the same number is not the same drag. The adapters average an `{x, y}` value
into one.

**`new Body(this, shape)`** — the built-in-native API. Fine, but ties the entity
to the built-in world.

### Per-shape filtering and triggers

A shape in `shapes` may carry its own `collisionType`, `collisionMask`,
`isTrigger` (default `false`) and `isActive` (default `true`). On the built-in
adapter a shape can only **narrow** what its body allows: the body's type/mask
are checked first. On planck and Rapier a shape's own `collisionType` /
`collisionMask` replace the body's for that shape, so they can widen it too.
matter filters per body and ignores them.

```js
const feet = new Rect(0, 24, 32, 8);
feet.collisionMask = collision.types.WORLD_SHAPE;
const torso = new Rect(0, 0, 32, 24);
torso.collisionMask = collision.types.ENEMY_OBJECT;
torso.isTrigger = true;      // detects hits, never gets pushed by them
```

`isActive: false` removes the shape from the narrow phase *and* from raycasts
without shrinking the body's bounds, on every backend. matter, planck and
Rapier read it only when the body is built, so after changing it call
`app.world.adapter.updateShape(renderable, renderable.bodyDef.shapes)`, which
works on every adapter. On those three `updateShape()` builds a new body: its
velocity carries over, and on planck and Rapier its angle and the joints
`world.addJoint()` made too; on matter the angle does not. On planck, called
from a collision handler, it takes effect when the step ends. The built-in also
reads `isActive` live, from the shapes the body holds; those are not always
the ones you authored, since a `Rect` is stored as a converted `Polygon`, so
toggle `body.getShape(i)` there.

`isTrigger` works on the built-in, planck and Rapier; matter ignores it, as it
does the per-shape filter. Under planck and Rapier the body-wide setters
(`setCollisionType` / `setCollisionMask` / `setSensor`) write every shape and
so overwrite per-shape values.

For contacts reported per *shape pair* rather than per body pair, define
`onShapeCollisionStart` / `onShapeCollisionActive` / `onShapeCollisionEnd`.
Declaring at least one of them opts into shape-pair enumeration; declaring none
costs nothing.

### Shapes drawn in a physics-shape editor

A visual collision-shape editor exports a JSON file holding a map of body name
to the fixtures authored for it. Preload it like any other JSON, then name it
from `bodyDef.shapes` with `id` naming the body to read:

```js
// in the preloader
{ name: "shapes", type: "json", src: "data/physics/shapes.json" }

// then, on the renderable
this.bodyDef = { type: "dynamic", shapes: "shapes", id: "hotdog" };
```

This works identically on every adapter — the file is
resolved into real shapes before any adapter is handed the definition. Circles
and polygons both load, and a concave outline (exported already decomposed into
convex pieces) becomes one `Polygon` per piece.

The density, friction and bounce the shapes were authored with are carried onto
the body definition too, each honoured by whichever backends support it — the
built-in adapter ignores contact `friction`, as it does for a hand-written
definition. The format carries these per fixture, but the built-in and matter
cannot honour that, so they reduce onto the body and a file whose fixtures
disagree warns. An
explicit field on the definition always wins:

```js
// bounces at 0.9 whatever the file says
this.bodyDef = { type: "dynamic", shapes: "shapes", id: "hotdog", restitution: 0.9 };
```

The exporting tool's own filter block is **not** read, in any spelling. Its
category and mask bits are numbers in that tool's namespace rather than
{@link collision.types}, and a template writes its defaults for every fixture
whether or not you set anything — importing them would silently tag a shape as
something it is not and stop it colliding. Set `collisionType` / `collisionMask`
on the body definition instead. A file written by hand may carry those two names
per fixture, and `isSensor`, which mean the same thing here as there.

Authored shapes and imported ones can sit in the same list.

Two bodies must never share one `shapes` array: a body **owns** its shapes and
rotating it mutates them in place. Naming the file sidesteps this — every body
resolved from it mints its own shapes.

`Body#fromJSON()` and passing an exported list to `addShape()` are the old,
built-in-only spelling of this and are deprecated since 20.7.0.

### Which shapes each backend can actually simulate

| shape | builtin | matter | planck | rapier |
|---|---|---|---|---|
| `Rect` | exact | exact | exact | exact |
| convex `Polygon` | exact | exact | exact, up to 12 vertices | exact, all its points |
| concave `Polygon` | **wrong**: SAT is convex-only | exact, split into convex parts | its convex hull | exact, as triangles |
| `RoundRect` | exact | exact | sampled down to 12 vertices | exact, all its points |
| `Ellipse` | exact | circle of the average radius | circle of the average radius | circle of the average radius |
| `Line` | exact | thin quad along the segment | thin quad along the segment | exact segment on a static or kinematic body, thin quad on a dynamic one |
| `Box3d`, `Sphere` | exact, and in 3D | **throws** | **throws** | **throws** |
| `Point` | supported | **throws** | **throws** | **throws** |

Two of those are worth knowing before you author geometry. Box2D caps a
polygon's vertex count and says nothing when you go over: measured, a
16-point outline comes back with 12 vertices and a 36-point one collapses
from 70x36 to 47x18. A `RoundRect` carries 36 points, four corners of nine
arc segments each, so it is the usual way to meet that cap; the adapter now
samples it down and keeps the extent. Rapier has no such cap. Anything the 2D
backends cannot express is refused loudly on each of them, rather than leaving a
body with no collision geometry that silently never collides.

A concave polygon is a third. A Tiled map is safe: the loader splits a
concave collision polygon into convex triangles before any backend sees it,
and a shape editor exports one already split. A concave `Polygon` you build
yourself is simulated exactly by matter (split into convex parts) and Rapier
(as triangles); the built-in tests it as if it were convex and planck fills it
in to its hull, so on those two split it into convex pieces yourself.

A polygon may be wound either way: its edge normals are oriented outward from
its signed area. Before 20.13 they pointed inward on a counter-clockwise
polygon — a Tiled polygon drawn that way, anything mirrored with
`scale(-1, 1)` or a `Rect` of negative width — and the built-in circle test
then collided a circle with it from tens of pixels away, as soon as their
bounding boxes met. Polygon against polygon was never affected.

Whatever a backend really simulates is what `getBodyShapes()` reports, so the
debug panel is the fastest way to see an approximation for what it is.

### `Line` shapes, and why slopes need a rigid-body adapter

A `Line` is two points and no area, and it is what Tiled emits for every
polyline, so it is the natural way to author a slope or a strip of ground.
matter and planck have no segment primitive, so both simulate one as a
thin quad following the segment (2px), which is what `getBodyShapes()` reports
back. Before 20.7 each substituted something of its own instead: matter the
line's bounding box, planck a one-metre square wherever the body happened to
be. Neither logged anything. Rapier has a segment, and uses it on a static or
kinematic body, which is what Tiled terrain is; on a dynamic body, where a
segment would carry no mass, it uses the same 2px quad.

The builtin solver resolves a sloped segment too, and correctly: a body lands
on it and SLIDES down it, holding a constant distance from the surface while
its x advances. What it has no notion of is SURFACE friction. `def.friction`
is ignored entirely and `body.friction` is a per-step velocity damping vector
fed from `def.frictionAir`, so nothing removes the tangential component of
gravity. A body on an incline therefore accelerates down it forever and leaves
at the end, and in a valley of segments it swings from arm to arm for a while
before coming to rest on the flat. (It used to escape through an arm instead;
that was a separate defect in how a body was separated from a shape list, fixed
in 20.7.)

matter, planck and Rapier all have real surface friction, so the same valley
holds a body still.

**Several shapes on one body.** A Tiled polyline arrives as ONE body carrying
one shape per segment, and until 20.7 a body resting on such a ground could
sink through one of the segments and drop out. The narrowphase reports the
FIRST overlapping shape pair it finds, and the compound resolution pass
re-ran that same first-hit-wins scan, so it kept re-resolving the pair it had
already resolved while a neighbour was penetrated unmeasured. Every pair is
enumerated now. If you are ever diagnosing something similar, the experiment
that localises it is to re-run the same geometry as SEVERAL single-shape
bodies: if that holds and one multi-shape body does not, the fault is in the
compound path rather than in the shape type.

Do not diagnose this by dropping a body and reading its final `y`. A body that
slid off the end of a ramp and a body that fell straight through it both end up
far below, and they look identical in that one number. Track the body against
the surface height at its CURRENT x instead: riding the slope shows a constant
offset while x advances.

So segments collide on every backend. If you need a body to come to REST on a
sloped one, use a rigid-body adapter, or damp it yourself: the builtin will slide
it down the incline indefinitely. The `Line Collision` example draws the
authored segment against the geometry each backend reports, which is the
quickest way to see what a backend is really simulating.

### `anchorPoint` moves the collision shapes with the drawing

`anchorPoint` says where in its own bounds a renderable sits on its `pos`:
`updateBounds()` translates its bounds by `-width * anchorPoint.x, -height *
anchorPoint.y`, and `preDraw` shifts its rendering by the same amount. A
body's collision shapes are measured from that same frame, so a shape of
`new Rect(0, 0, width, height)` covers the sprite whatever the anchor is, and
a shape's own `pos` still offsets it inside that frame (a small hitbox at the
feet, a hurtbox at the head).

**That frame's origin is its TOP-LEFT corner, which is the trap for a small
shape.** `new Rect(0, 0, w, h)` reads naturally because it spans the frame.
A circle or a `Sphere` does not span anything, so `new Sphere(0, 0, 0, r)` on
a centre-anchored sprite sits on the sprite's corner, not on the sprite. Put
it at half the frame:

```js
// centred on a 24x128 sprite whose anchorPoint is (0.5, 0.5)
bolt.bodyDef = { type: "dynamic", shapes: [new Sphere(24 / 2, 128 / 2, 0, r)] };
```

Measured on exactly that sprite: with the shape at `(0, 0, 0)`,
`adapter.getBodyShapes()` reported it at `(-12, -64)` — **64 units up the
screen, four times its own radius** — so the projectile collided well away
from where the player saw it, in a way that still looked like a working game
because the targets were large.

The offset comes from the renderable's own `width` / `height`, NOT from what
it draws at. Scale a sprite through `currentTransform` and those stay the
texture's size, so the half-frame term is half the texture, not half the
drawn quad. The debug overlay is the quickest confirmation: the red shape
should sit on the art.

This was broken until 20.7: shapes were measured from `pos` regardless of the
anchor, so anything not anchored at its top-left corner collided where it was
not drawn, by half a body at the default centred anchor and by a full body
height at the bottom anchor a platformer actor uses. If you compensated by
offsetting your shapes by hand, remove those offsets. `Entity` and Tiled
objects set their own anchor to `(0, 0)`, so nothing built either of those
ways is affected.

The debug panel is the quickest check: green is the renderable's bounds, red
is what actually collides, and the two now agree.

One renderable does not take that offset at all: one that has cleared
`applyAnchorTransform`, the flag `preDraw` reads before shifting anything.
`GLTFModel` sets it `false` outright and `Mesh` clears it under a `Camera3d`,
because both emit world coordinates and pivot about their own model origin
rather than a bounds box, so they draw at `pos` whatever their `anchorPoint`
still holds. Their bodies are built there too, on every backend, and
`raycast3d` reports hits in that same frame. If you clear the flag on a
renderable of your own, the same applies: you place it, and your shapes are
measured from `pos`.

### `autoTransform: false` opts out of rotated bounds

`updateBounds()` only applies `currentTransform` when `autoTransform` is
`true`. Turn it off and the renderable's bounds stay the UNROTATED frame
while the sprite turns inside them, which quietly feeds a wrong box to
frustum culling and to the broadphase. Measured on a 60x20 box at 90
degrees: `20x60` with `autoTransform` on, `60x20` with it off.

That flag means "I place myself", so it is a fair contract, but reach for it
only when you really are drawing in your own frame, and remember the bounds
are yours to keep honest then.

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

`maxVel` is what turns a force into a speed, so the two are set together. Use
the setters rather than writing the vectors — both take an optional THIRD
argument for the depth axis, left unchanged when omitted, so a 2D call keeps
its behaviour:

```js
this.body.setMaxVelocity(3, 15);   // walk speed, jump speed
this.body.setFriction(0.4, 0);     // ground drag, none vertically
```

`friction` here is per-axis per-step velocity damping, not a surface
coefficient — see the built-in quirks below.

These two are methods of the built-in `Body` and are not functions on matter,
planck or Rapier. The portable forms go through the adapter, or the
`bodyDef`'s `maxVelocity` / `frictionAir`:

```js
app.world.adapter.setMaxVelocity(this, { x: 3, y: 15 });
app.world.adapter.setFrictionAir(this, { x: 0.4, y: 0 }); // the adapters average the axes
```

A velocity cap is in the adapter's velocity unit: pixels per step on the
built-in and matter, pixels per second on planck and Rapier (see *Porting*
below).

Under matter, planck and Rapier, `syncFromPhysics()` copies the engine body's position
back onto `renderable.pos` after every step, so a direct write is simply erased
— no error. The built-in world integrates `pos` in place instead, so a write
survives but fights collision resolution and jitters. To teleport, go through
`adapter.setPosition(renderable, p)` so the engine body moves with it.

## Joints: hinges, ropes, welds and sliders

`app.world.addJoint(definition)` joins two bodies. Only two adapters have
joints:

| adapter | `world.addJoint()` | `capabilities.constraints` |
|---|---|---|
| planck | ✅ hinge, rope, weld, slider, each a planck joint | `true` |
| Rapier | ✅ the same four, each a Rapier joint | `true` |
| built-in | ❌ throws, naming the adapter | `false` |
| matter | ❌ throws, naming the adapter. matter's own constraints are still there through `adapter.matter`, in matter-only code | `false` |

Code meant to run on any adapter checks `capabilities.constraints` first:

```ts
if (app.world.adapter.capabilities.constraints) {
    app.world.addJoint({ type: "rope", a: hook, b: lantern });
} else {
    // the built-in or matter adapter: hang the lantern some other way
}
```

| `type` | what it does | settings |
|---|---|---|
| `"hinge"` | the bodies share a point and turn about it: chain links, doors, wheels | `limits`: b's angle minus a's, in radians |
| `"rope"` | the anchors stay within `maxLength` of each other, and can come closer | `maxLength` in pixels; default the distance when made |
| `"weld"` | the bodies move as one, in the pose they had when joined | |
| `"slider"` | b slides along `axis` and keeps a's angle: lifts, pistons | `axis` in a's space; `limits` in pixels along it |

- **Add both renderables first.** The joint needs their bodies, which
  `addChild()` builds; `addJoint()` throws for a renderable not in the world,
  and for an unknown `type`.
- **Anchors are in pixels, in each renderable's own space**: the space its
  `bodyDef` shapes are written in, so `{ x: 0, y: 0 }` is the top-left of its
  drawn frame whatever its `anchorPoint`.
- **Default anchors hold the bodies where they stand.** `anchorB` defaults to
  the centre of b's body and `anchorA` to the point of a under it; a rope
  joins the two centres. A slider's `limits` then count from where b starts.
- **`collideConnected`** defaults to `false`: the two joined bodies pass
  through each other.

```ts
// a chain of 6 x 16 links hanging from a static hook, all with a bodyDef
app.world.addChild(hook);
let previous = hook;
for (let i = 0; i < 8; i++) {
    const link = app.world.addChild(new Link(x, y + 8 + i * 16));
    app.world.addJoint({ type: "hinge", a: previous, b: link, anchorB: { x: 3, y: 0 } });
    previous = link;
}
// a rope from the hook to the last link keeps the chain from stretching
app.world.addJoint({ type: "rope", a: hook, b: previous, anchorB: { x: 3, y: 16 } });

// a door that opens up to 90 degrees, hinged at its top-left corner
app.world.addJoint({
    type: "hinge", a: frame, b: door,
    anchorB: { x: 0, y: 0 }, limits: { min: 0, max: Math.PI / 2 },
});

// a plank glued to a wall, that breaks off
const glue = app.world.addJoint({ type: "weld", a: wall, b: plank });
app.world.removeJoint(glue);
```

A rope that collides is the chain above: each link is an ordinary body, so it
collides with whatever its `collisionMask` allows and fires the usual hooks.
Joined links do not collide with each other; links further apart do, so give
the links a collision type their mask leaves out if the rope should pass
through itself.

The world keeps the joints it made:

- a joint is removed when either body leaves the world, and re-adding the
  body does not bring it back. Moving a body to another container of the
  same world (for its draw order) is not leaving: the body, its motion and
  its joints stay as they are;
- `world.setAdapter()` builds every joint again on the new adapter, after the
  bodies; `updateShape()`, which rebuilds the body on planck and Rapier,
  builds its joints again too;
- the handle (`PhysicsJoint`) stays the same object throughout. Its `native`
  is the engine's joint (a `planck.RevoluteJoint`, a Rapier `ImpulseJoint`),
  replaced on each rebuild, and `null` once the joint is removed.
  `removeJoint()` is safe to call twice, or on a joint its body took with it.

The engines differ at the edges. On planck, a joint made or removed in a
collision handler takes effect when the step ends, as Box2D locks its world
while it steps. On Rapier, limits are soft: a fast body passes a hinge or
slider limit by a few pixels for a frame before it is pushed back.

What `addJoint()` does not wrap (motors, springs, the other Box2D joints) is
the engine's own API, through `joint.native` or `adapter.planck` /
`adapter.rapier`. That code is engine-specific, and a setting made on
`joint.native` is lost when the joint is built again.

## Collision callbacks — which one to use

The lifecycle is `onCollisionStart` (contact begins), `onCollisionActive` (every
step while it persists) and `onCollisionEnd` (contact breaks). None of them are
defined on `Renderable` — you just declare the ones you want and the dispatcher
checks `typeof`. That is also why they cannot be declared on the base class: a
field there would SHADOW the prototype method every subclass that implements
one defines.

**In TypeScript the response is `CollisionResponse`**, exported from `melonjs`:

```ts
import type { CollisionResponse, Renderable } from "melonjs";

class Coin extends Sprite {
    onCollisionStart(response: CollisionResponse, other: Renderable) { … }
}
```

On a renderable you do not subclass, declare the hooks you want as OPTIONAL
members of a local interface and assign through one plain cast — that is the
opt-in, and it needs no `as unknown as`:

```ts
interface Contacts {
    onCollisionStart?: (response: CollisionResponse, other: Renderable) => void;
}
(rock as Contacts).onCollisionStart = (response, other) => { … };
```

How often the lifecycle fires depends on the adapter. The built-in fires each
hook once per body pair, per side, per step. matter, planck and Rapier report
contacts per SHAPE pair, so a body touching through two of its shapes gets two
calls (on Rapier a concave polygon is one shape per triangle), and matter fires
`onCollisionActive` once per sub-step; planck and Rapier fire it once per
frame. Guard a one-shot reaction (a pickup, a landing sound) with a flag of
your own.

The legacy `onCollision` still exists and has a trap:

> On the built-in world, `onCollision` fires **twice per frame** for
> dynamic-dynamic pairs — once per outer-loop visit — and gets the raw SAT
> response with a fixed `a`/`b` per pair. On the adapters it is routed to their
> "still touching" phase and fires once per side. There it receives the same
> response as `onCollisionActive` (`a`, `b`, `normal`, `depth`, `pair`), so
> `overlap`, `overlapN` and `overlapV` are `undefined`.

The legacy dedupe idiom is `if (this !== response.a) return;`. Defining
`onCollisionActive` suppresses the legacy callback on that renderable (the
"supersedes" rule, applied per side so `a` and `b` can migrate independently),
on every adapter.

**Return values only work on the legacy handler.** `return false` from
`onCollision` skips the built-in SAT push-out; the other adapters ignore it, and
what `onCollisionStart` / `onCollisionActive` return is discarded everywhere.
To opt a body out of the physical response, set `bodyDef.isSensor` /
`body.setSensor(true)`, or make the shape a trigger. With no `onCollision`
defined at all, push-out happens by default for dynamic non-sensor bodies.

The two handler families do **not** get the same response object:

| | `onCollision` (legacy) | `onCollisionStart` / `Active` / `End` |
|---|---|---|
| `a` / `b` | fixed per pair | receiver-symmetric: `a === this`, `b === other` |
| overlap magnitude | `response.overlap` | `response.depth` |
| contact axis | `response.overlapN` / `overlapV` | `response.normal` |
| also carries | `aInB`, `bInA`, `indexShapeA/B`, `isTriggerContact` | `pair` (adapter-native, absent on built-in) |

The left-hand column is the built-in's. On matter, planck and Rapier
`onCollision` gets the right-hand one too. On Rapier `pair` is
`{ collider1, collider2 }`, two collider handles for `adapter.world.getCollider()`.

On the modern response `overlap` / `overlapN` / `overlapV` are still present but
`@deprecated` (and `undefined` under every adapter but the built-in) — use
`depth` and `normal`. `depth` is in pixels on every adapter (on planck from
planck-adapter 1.7.0; before, it was always `0`). `normal` is the direction
the receiver must move to separate, in canvas coordinates: `normal.y < -0.7`
means "push me up", i.e. I landed on top of `other`.

One portability wrinkle: the built-in adapter dispatches `onCollisionEnd` with
`undefined` as the response; the other adapters pass a real one. Guard it. On
Rapier a sensor contact, and every `onCollisionEnd`, carries a `normal` of
`(0, 0)` and a `depth` of `0`: Rapier computes no contact for them, so read
only `other` there.

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
  is deferred, so it is safe; `removeChildNow()`, and the internal `destroy()`
  it calls, are immediate,
  and the detector only survives them because it re-checks `body === undefined`
  after every user callback.
- **planck** — `onCollisionStart` / `onCollisionEnd` are dispatched from
  planck's `begin-contact` / `end-contact` events, which fire *while the world
  is locked*. Adding a renderable with a `bodyDef` there makes planck's
  `createBody` return `null` and the adapter then throws on the null handle.
  Removing one there is safe from planck-adapter 1.7.0: the body leaves every
  event and query at once and is destroyed when the step ends. Before that,
  `removeChildNow()` left an invisible body behind that still collided.
  `onCollisionActive` is dispatched after the step and is the safe one.
- **matter** — callbacks come from matter's `collisionStart` / `collisionActive`
  / `collisionEnd` events during `Engine.update`.
- **Rapier**: the adapter reads Rapier's events once its step has returned
  and dispatches them after, so adding and removing bodies in any handler is
  safe. A partner still touching a removed body gets its `onCollisionEnd`.

## Spatial queries

`raycast` and `queryAABB` are implemented by every adapter:

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
`Camera3d` sets. So is `raycast3d`. `world.adapter.capabilities.raycasts3d`
says whether the adapter has them at all, and it stays `true` on the built-in
under a 2D camera, where `raycast3d` returns `null` and `querySphere` returns
`[]`: check `world.sortOn === "depth"` as well. `raycast` itself is
capability-gated by `capabilities.raycasts`.

`queryAABB` does not return the same set everywhere. On the built-in it
returns every non-kinematic renderable whose bounds overlap the rectangle, with
a body or without; matter, planck and Rapier query their own world, so they
return only renderables that have a body. On every adapter a ray skips a body
it starts inside, so a body casting from its own centre does not hit itself
(before 20.14 the built-in and matter-adapter < 1.6.0 returned that body); on
Rapier it hits sensors like any other body.

On the built-in adapter a 2D ray measures each shape the way the narrowphase
measures it against a planar shape: polygons, `Rect`, `RoundRect` and `Line`
by their edges, an `Ellipse` with its rotation, a `Box3d` by its XY footprint
and a `Sphere` as a circle of its radius (a 2D ray is unbounded along Z). A
`Point` has no area to cross and is skipped, as is an unknown shape type,
with a one-time console warning. Before 20.13 a body carrying a `Point`,
`Sphere` or `Box3d` made every ray that reached it throw, and a rotated
ellipse was hit where it would have been unrotated.

The legacy `collision.rayCast(line, result)` is a different API: it takes a
`Line`, returns an **array** of every intersecting renderable, and only exists
on the built-in path.

Two prerequisites on the built-in adapter that produce empty results rather
than errors:

- **`isKinematic` must be `false`** for a renderable to be in the broadphase at
  all (a `Body` sets this for you).
- On the **built-in** adapter, the broadphase is cleared and rebuilt inside
  `world.update()`, so querying before the first update returns nothing.
  Rapier behaves the same: it indexes bodies for queries when its world
  steps, so a body added this frame is found from the next one on.

## 3D collision: `Box3d`, `Sphere` and the Z pushback

The narrowphase is not 2D-only. Two shapes carry a depth extent — `Box3d` and
`Sphere` — and any pair of them is resolved in three dimensions, pushing back
along **Z** as well as X and Y.

```js
import { Box3d, Sphere } from "melonjs";

// a box: its centre, measured from the frame's top-left corner like any
// shape, then its FULL width, height and depth (not half-extents)
crate.body.addShape(new Box3d(crate.width / 2, crate.height / 2, 0, 40, 60, 40));
// a sphere: its centre, then one radius
rock.body.addShape(new Sphere(rock.width / 2, rock.height / 2, 0, 30));
```

Reach for these for anything moving in the XZ plane under a `Camera3d` — a
runner dodging obstacles, a 2.5D platformer, pickups on a course. Hand-rolling
a distance check there is the usual mistake, and it throws away the
penetration vector the response already carries.

**Which of the two.** A `Box3d` is world-axis-aligned and cannot be oriented:
it is right for walls, floors, crates and anything else that stays square to
the world, and wrong for anything that turns. A `Sphere` has no orientation to
get wrong, which makes it the shape for things that tumble, and for anything
laid out over a curved surface — on a globe every object's own "up" points a
different way, so no single axis-aligned box fits any of them. It is also the
cheaper test: one distance against a sum of radii.

**Z arrives beside `overlapN`, not inside it.** `overlapN` stays the 2D unit
vector it always was and `overlapNZ` carries the depth component, because
`Vector3d` does not extend `Vector2d` and widening the field would have broken
every existing 2D handler. The two together are a 3D unit vector, and
`overlapZ = overlapNZ * overlap` exactly as `overlapV = overlapN * overlap`.

**How much of the normal is in each half depends on the shapes.** A `Box3d`
pair separates along ONE world axis, so a depth contact leaves the 2D fields
at zero and a legacy 2D handler correctly applies no push. A `Sphere`
separates along the line between the two centres, which is generally diagonal:
all three components are non-zero at once. So subtract both halves rather than
branching on one:

```js
onCollision(response, other) {
    // works for either shape: the 2D half is zero when there is no 2D push
    this.pos.x -= response.overlapV.x;
    this.pos.y -= response.overlapV.y;
    this.pos.z -= response.overlapZ;
    return false;
}
```

Branching on `if (response.overlapNZ !== 0)` and then moving only `pos.z` is
the mistake to avoid: correct for a box pair, and for a sphere it throws away
the planar half of the contact.

**Mixed pairs degrade to 2D.** A `Box3d` or a `Sphere` against a `Polygon`,
`Rect`, `RoundRect` or `Ellipse` tests the 3D shape's XY footprint and
treats the planar shape as unbounded along Z, which is what keeps a sphere or
box body colliding with an ordinary Tiled collision layer. `overlapZ` is zero
for those, since only one side has a depth to resolve. Give BOTH sides a 3D
shape when you want a depth result.

This is the narrowphase and is independent of the 3D broadphase queries above
— `querySphere` / `raycast3d` need `world.sortOn === "depth"`; a 3D body shape
does not.

`raycast3d` measures a `Box3d` body as its box and a body that is one `Sphere`
as that sphere, both exactly. Anything else, including a body mixing the two,
is measured as the AABB containing its 3D shapes, and a body with none falls
back to a bounding sphere derived from the renderable's 2D bounds.

**Bounds are what the broadphase sorts by, and they come from the SHAPE.**
Every item is filed by its renderable's 2D `getBounds()`, so an object with no
extent cannot be placed and silently collides with nothing. A `Mesh` takes its
extent from its geometry and a `GLTFModel` from its part meshes, so both report
where they are without being told. A body's shapes do **not** contribute, so a
custom collidable built on a bare `Container` has no extent until you give it
one:

```js
// a container reports an EMPTY bounds until it has a size of its own
group.resize(width, height);
```

`enableChildBoundsUpdate` also gives it one, but it re-measures the whole child
list on every update (after the children have moved, and before each culling
check while it is off screen) — reach for it only when the extent genuinely IS
the members' union and moves with them (a flock, a squad), not to give a fixed
group a size.

## Built-in world quirks

These are specific to the default world and surprise people arriving from a
real rigid-body engine:

- **Dynamic-dynamic collision is position-based, not Newtonian.** Separation is
  mass-proportional but the velocity response is per-body cancellation — two
  equal-mass bodies do not exchange momentum the way you would expect.
- **An immovable contact wins the step.** Each step records, per body, which
  directions it has already been pushed out of, and a later dynamic-dynamic
  contact will not push it back in one of those directions: the other body
  takes the whole correction instead. A light body shoving a heavy one against
  a wall therefore stops dead at the wall rather than driving it through, and
  the shover absorbs all of the separation. The record lasts one step and is
  not contact state — it says nothing about what a body is touching.
- **Gravity defaults to `(0, 0.98)`** — pixels per frame², not m/s². Mutate
  `app.world.adapter.gravity` at runtime, or pass
  `physic: await BuiltinAdapter.create({ gravity: new Vector2d(0, g) })` to override
  it (a `Vector2d` here, where the adapters take `{x, y}`). `body.gravityScale`
  (default `1`) scales it per body; `0` disables gravity for that body and is
  the portable replacement for the deprecated `body.ignoreGravity`.
- **`applyForce(x, y)` is linear only** unless you pass the optional
  `(pointX, pointY)` application point, which generates a torque
  `τ = r × F` into `body.angularVelocity` via `body.pseudoInertia`.
  `applyTorque(τ)` is the direct form. The point is in **world** coordinates,
  as on the other adapters, and the lever arm is measured from the centre of
  the shapes where they collide: the renderable's drawn frame (so the anchor
  counts) plus any parent container's position. `renderable.getBounds()` is
  in that space, so `b.centerX, b.top` is the top centre.
- **Force accumulators reset at end-of-step** — for every body, including
  static, paused and off-screen ones — so forces must be applied every frame to
  persist.
- **`isGrounded` reads the last step's push-out, not a live contact test** —
  `true` when a collision in the last step pushed the body up out of
  something below it (a floor or a slope, not a wall) and neither
  `body.falling` nor `body.jumping` is set. Before 20.14 it read the two flags
  alone, so a body never stepped, or held still in mid-air with
  `gravityScale` 0, read as grounded. The DIRECTION of the push-out decides
  the flags: pushed up out of a floor while not rising is a landing, pushed down
  by a ceiling while rising (or `jumping`) ends the jump and falls, and a
  side contact, a body touched from above while standing, or a body with
  `gravityScale` 0 leaves them alone. Before 20.13 a magnitude test decided
  instead, so anything that sank a pixel or more per step — gravity above
  about `1.02`, mass above about `1.03`, `timer.tick > 1` at a low frame
  rate, a floor moving up under it — stayed `falling` while sitting flush on
  the floor, and could never jump.
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

### Rotation collides on planck, matter and Rapier, but not on the built-in solver

This is the sharpest behaviour difference between the adapters, and it is
silent — nothing warns you.

| adapter | a rotating body |
| --- | --- |
| **builtin** | rotates **visually only**. `body.angle`, `setAngle()` and angular integration write `renderable.currentTransform`; the collision shapes are never rotated, so a spinning sprite collides as if it were upright |
| **planck** / **matter** / **rapier** | rotates for real — the solver owns the body's transform and collision follows it |

So a turret, a swinging platform or a tumbling crate that must *collide*
rotated needs a rigid-body adapter. Under the builtin solver, approximate it with a
shape that is close enough at every angle (a circle, or a square for
90° steps), or rotate the shapes yourself with `body.rotate(angle)` — which
does rotate them, unlike `setAngle()`.

The visual turn pivots on the centre of the body's shapes, where they are
drawn and collide, whatever the renderable's `anchorPoint`. Before 20.13 it
ignored the anchor, so a centre-anchored renderable turned about its
bottom-right corner and swung away from where it stood; only a `(0, 0)`
anchor turned in place.

`body.rotate()` applies a **delta** and does not update `body.angle`; the two
are unlinked, so a body driven by `rotate()` still reports an angle of `0`.
Track it yourself if you need to read it back. Before 20.7 it also threw on a
`Box3d` or `Point` shape, and did not tell its owner that the body's bounds had
grown.

`adapter.getBodyShapes(renderable)` reports whichever is true: the geometry
the engine is actually simulating on planck, matter and Rapier (matter-adapter
1.3.0 / planck-adapter 1.4.0 and later), unrotated shapes on the builtin solver because
there they genuinely are. That is what the debug overlay draws, so the hitbox
you see is the hitbox that collides — a sprite spinning inside a stationary red
box on the builtin is the solver telling you the truth, not a drawing bug.

On the adapters that report comes from the engine rather than from your
definitions, so it shows the approximations they make: an `Ellipse` appears as
the circle of average radius it is simulated as, a concave polygon as the
convex parts matter splits it into, the triangles Rapier builds or the hull
planck fills it in to, and a `Rect` as a `Polygon`. Your
authored shapes are untouched and still readable on `renderable.bodyDef.shapes`.

**If you need rotation to affect collision, use planck, matter or Rapier.** That is the
dividing line: the builtin is a position-based solver whose SAT never reads
`body.angle`, so rotation there is a visual property. `body.rotate(angle)` is
the workaround, not a rotating body — it permanently moves the shapes, does not
track an angle, and gives you no angular velocity, torque or rotational
response from a collision. A game whose collision genuinely turns (a spinning
hazard, a swinging bridge, a car, anything with torque) wants a real rigid-body
adapter rather than a workaround.

## Porting between adapters

Same call, different magnitude — these are the ones that waste an afternoon:

- **The portable API converts for you, the native handle does not.**
  `adapter.setVelocity` / `body.setVelocity(x, y)` are in pixels on every
  adapter; reaching for the raw handle (`body.setLinearVelocity` on planck,
  `body.setLinvel` on Rapier) puts you in metres per second, scaled by
  `pixelsPerMeter`.
- **Time base differs.** Built-in `body.vel` and matter's velocity are pixels
  *per step* (60 steps a second); planck's and Rapier's are pixels *per
  second*, so the same number is about 60× off there. `maxVelocity` follows the
  same split, and so does angular velocity: radians per step on the built-in
  and matter, per second on planck and Rapier.
- **Force magnitudes are not comparable** between adapters; re-tune rather than
  reuse. `applyForce` is cleared after each step, so call it every frame; on
  matter and planck that step is a sub-step, which is why `subSteps` weakens it
  there, while Rapier keeps it for the whole frame. `applyImpulse` is the
  one-shot. planck and Rapier apply
  `adapter.applyImpulse(renderable, impulse, point)` at its point. The built-in
  and matter ignore the point; matter has no native impulse, so the adapter
  emulates it as `Δv = J / mass`.
- **Pausing stops the whole simulation** on matter, planck and Rapier; the
  built-in keeps moving a renderable with `updateWhenPaused`.
- **`body.position` is the centroid in matter**, while `renderable.pos` is
  wherever its `anchorPoint` puts it. The adapter stores a per-body offset so
  `renderable.pos` stays correct — but read `body.position` directly and you
  get the centroid.
- **The default collision type differs.** With no `collisionType`, a body is
  `ENEMY_OBJECT` on the built-in but category `1` (`PLAYER_OBJECT`) on matter,
  planck and Rapier. With no `collisionMask`, it collides with every type on
  every adapter (before planck-adapter 1.7.0, planck stopped at bit 15, so a
  user type from `collision.types.USER << 9` up never hit it; Rapier filters on
  the full 32 bits). Set `collisionType` on every `bodyDef`.
- **`type: "kinematic"` is planck and Rapier only**; the built-in and matter
  build a dynamic body (see *Two ways to declare a body*).
- **A `Line` (what Tiled emits for a polyline) is a thin 2px rectangle along
  the segment on matter**, which is what `getBodyShapes()` reports (since
  matter-adapter 1.5.0; before that it fell back to its axis-aligned bounding
  box). Only a degenerate (zero-area, collinear) `Polygon` still falls back to
  its bounding box. Any other shape type throws `unsupported shape type`.
- **Ellipses become circles on matter, planck and Rapier**, using the average
  of the two radii.
- **`isGrounded` is capability-gated** (`capabilities.isGrounded`) and computed
  differently per adapter: the last step's push-out on built-in, a live scan of
  active contacts on matter, planck and Rapier, counting a solid contact that
  pushes the body up (a sensor contact counts when the other body is below).
  On every adapter the side of a wall is not ground.

Adapter-specific escapes exist (`(this.body as MatterAdapter.Body).frictionAir`,
`adapter.matter.Constraint.create(...)`) but are not portable — flag them if you
use them. `adapter.capabilities` (`constraints`,
`continuousCollisionDetection`, `sleepingBodies`, `raycasts`, `raycasts3d`,
`velocityLimit`, `isGrounded`) is the portable way to branch. matter reports
`continuousCollisionDetection: false` (from matter-adapter 1.6.0; earlier
versions claimed `true`): it has none, and `subSteps` is the remedy for fast
bodies. Its `sleepingBodies` needs `matterEngineOptions: { enableSleeping: true }`.
Rapier reports `continuousCollisionDetection: true`, but it is opt-in per body.

Rapier's escapes are `adapter.rapier` (the Rapier module) and `adapter.world`
(the Rapier world), with the body typed as `RapierAdapter.Body`:

```ts
const adapter = app.world.adapter as RapierAdapter;
const { rapier, world } = adapter;
(bullet.body as RapierAdapter.Body).enableCcd(true);    // continuous collision
const spring = rapier.JointData.spring(2.5, 50, 1, { x: 0, y: 0 }, { x: 0, y: 0 }); // metres, body-local
world.createImpulseJoint(spring, anchor.body as RapierAdapter.Body, player.body as RapierAdapter.Body, true);
const controller = world.createCharacterController(0.01);   // 0.01 m skin
```

A hinge, rope, weld or slider is portable through `world.addJoint()` (see
[Joints](#joints-hinges-ropes-welds-and-sliders)); a spring is Rapier's own.
Rapier's objects live in WebAssembly memory, which the garbage collector does
not reclaim. The adapter's `destroy()`, which `setAdapter()` calls on the
adapter it replaces, frees its world, and the joints `world.addJoint()` made
are freed with their bodies; free a joint or a character controller you made
yourself through `adapter.world` with `world.removeImpulseJoint()` /
`world.removeCharacterController()`.

## Symptom → cause

| symptom | cause |
|---|---|
| entity jitters or does not move | assigning `pos` instead of applying force |
| `world.adapter = …` throws a `TypeError` | `world.adapter` is read-only; call `world.setAdapter(adapter)` |
| a body stops simulating after `world.setAdapter()` | it was added with a direct `adapter.addBody()`; give it a `bodyDef` |
| `addJoint()` throws "the builtin adapter has none" (or matter) | the adapter has no joints (`capabilities.constraints` is `false`); use planck or Rapier, or check the flag first |
| `setAdapter()` throws "dropped N joints" | the new adapter has no joints; the switch went through without them. Remove them with `world.removeJoint()` before switching |
| `addJoint()` throws "needs both renderables to have a body" | a renderable is not in the world yet: `addChild()` both first |
| two bodies jump together, or swing about the wrong point, when joined | anchors given in the wrong space: they are pixels in each renderable's own (`bodyDef` shape) space; leave `anchorA` out to join at b's anchor where it stands |
| a weld pulls the two bodies onto each other | both anchors given as each body's centre; leave `anchorA` out |
| a joint motor or a setting on `joint.native` stops working after `setAdapter()` or `updateShape()` | the joint was built again, with a new `native`; set it again |
| the links of a rope push each other apart or tangle | links that are not joined still collide; give them a collision type their mask leaves out |
| a matter constraint outlives its body, or is gone after `setAdapter()` | it is matter's own, not the world's; remove it with `adapter.matter.Composite.remove()` |
| collision handler runs twice per frame | legacy `onCollision` on a dynamic pair (built-in) — use `onCollisionActive` |
| `return false` from a handler does nothing | return values are only honoured by legacy `onCollision` — use `isSensor` / `isTrigger` |
| crash or a null body when spawning from `onCollisionStart` | world mutated during contact dispatch (locked world under planck) |
| `raycast` / `queryAABB` finds nothing | `isKinematic` still `true`, or no `world.update` yet (built-in) |
| `new RapierAdapter()` throws "Rapier is not loaded yet" | its WebAssembly loads asynchronously; use `await RapierAdapter.create(options)`, or `await RapierAdapter.load()` first |
| a fast body passes through a thin one (Rapier) | continuous collision is per body and off by default: `(body as RapierAdapter.Body).enableCcd(true)` |
| `normal` is `(0, 0)` and `depth` is `0` (Rapier) | a sensor contact or an `onCollisionEnd`: Rapier computes no contact there |
| `querySphere` / `raycast3d` is not a function | matter, planck or Rapier: all are 2D-only and omit them |
| `querySphere` returns `[]` and `raycast3d` returns `null` (built-in) | no 3D broadphase: `world.sortOn !== "depth"`; they need a `Camera3d` stage |
| `queryAABB` misses objects that have no body (matter, planck, Rapier) | those adapters query their own world, which holds bodies only |
| a 3D contact reports no overlap to push against | read `overlapNZ` / `overlapZ` — a Z-axis MTV leaves `overlapN` / `overlapV` at zero |
| two 3D objects never separate in depth | one of them carries a planar shape; a mixed pair is tested as the box's XY footprint, unbounded along Z |
| `response.depth` / `response.normal` are `undefined` (built-in) | reading a legacy `onCollision` response — it carries `overlap` / `overlapN` |
| `response.overlapV` / `overlapN` are `undefined` (matter, planck, Rapier) | the adapters hand `onCollision` the modern response too; use `normal` / `depth` |
| a pickup or a landing sound fires twice (matter, planck, Rapier) | contacts are reported per shape pair, and `onCollisionActive` once per sub-step on matter; guard with a flag |
| a `type: "kinematic"` platform falls (built-in, matter) | only planck and Rapier have kinematic bodies; use `type: "static"` and `adapter.setPosition()` |
| `this.body.setMaxVelocity is not a function` (matter, planck, Rapier) | it is a built-in `Body` method; use `app.world.adapter.setMaxVelocity(this, { x, y })` |
| every force got weaker after raising `subSteps` (matter, planck) | forces are cleared after each sub-step, so they act on the first one only; re-tune (Rapier keeps a force for the whole frame) |
| `isActive = false` on a shape changes nothing (matter, planck, Rapier) | read only when the body is built; call `adapter.updateShape(renderable, shapes)` |
| `onCollisionEnd` handler throws on `response` | built-in dispatches it with `undefined` |
| off-screen bodies stop simulating | built-in gating on `inViewport`; set `alwaysUpdate` |
| a body sinks through one shape of a multi-shape body | fixed in 20.7; before that the compound pass only ever re-resolved the first overlapping pair |
| a body will not stay put on a slope on the builtin | it is riding the slope and sliding: the builtin has no surface friction, only `frictionAir` damping. Damp it yourself, or use a rigid-body adapter |
| the sprite is drawn offset from its hitbox | pre-20.7 `anchorPoint` moved the drawing but not the collision shapes; upgrade, and drop any offsets you added to compensate |
| a small shape sits at the sprite's corner | a shape's offset is measured from the drawn frame's TOP-LEFT; `new Sphere(0, 0, 0, r)` is the corner, `(width / 2, height / 2)` is the centre |
| a rotated renderable reports an unrotated bounding box | `autoTransform: false` opts `updateBounds()` out of the transform |
| a body in a pile sinks into the floor (built-in) | fixed in 20.7 for anything with an immovable side; bodies pinned only by other DYNAMIC bodies still overlap by a pixel or two, which is what the rigid-body adapters are for |
| `applyForce` with a point spins a body pushed through its centre, or tips it the wrong way (built-in) | before 20.13 the point was measured against the body's LOCAL bounds, so only a body at the world origin got the right torque; upgrade, and drop any `pos` you subtracted to compensate |
| forces do nothing after switching adapter | magnitude units differ — re-tune, don't reuse numbers |
| `body.position` disagrees with `renderable.pos` on matter | matter stores the centroid, while `renderable.pos` sits where its `anchorPoint` puts it; the adapter offsets between them |
| a `bodyDef` two containers down never falls nor collides (`body` stays `undefined`) | before 20.13 only the added container's own children were registered; upgrade |
| `other.addChild(group)` throws "renderable is already adapter-managed" | before 20.13 a group detached with keepalive (which moving it does) left its children's bodies registered, still simulated off-stage; upgrade |
| the children of a persistent container stop falling and colliding after a state change or `level.load` | before 20.13 `world.reset()` kept only the bodies whose own renderable was persistent; upgrade, or flag each child `isPersistent` |
| `bodyDef.shapes: "…"` throws "is not loaded" | the name must match the `name` the JSON was preloaded under, not its filename |
| everything falls far too fast or too slow after swapping backends | gravity is a different unit per backend; see the table above |
| debris lands holding its spawn angle and never tumbles | `fixedRotation: true`, or matter-adapter < 1.4.0 / planck-adapter < 1.5.0 |
| a rotated sprite collides as if upright | the built-in solver rotates visually only — `body.angle` never rotates the shapes. Use a rigid-body adapter, or `body.rotate(angle)` |
| `setAngle` swings a sprite away from where it stood (built-in) | before 20.13 the pivot ignored `anchorPoint`, so a centre-anchored renderable turned about its bottom-right corner; upgrade |
| `isGrounded()` stays `false` on the floor, so the player cannot jump (built-in) | before 20.13 a body sinking 1px or more per step (gravity or mass above ~1.02, `timer.tick > 1`, a rising floor) never landed; upgrade |
| `isGrounded()` is `true` in mid-air, for a body with `gravityScale` 0 or one not yet stepped (built-in) | before 20.14 it read the `falling` / `jumping` flags alone, without a surface under the body; upgrade |
| a ray cast from a body's centre hits that body (built-in, matter) | before 20.14 / matter-adapter 1.6.0 a ray did not skip a body it starts inside; upgrade |
| `raycast()` / `queryAABB()` find nothing right after the bodies are added (built-in, Rapier) | both index bodies for queries during a world step: query from the next frame on |
| a circle body is shoved by a polygon it is nowhere near (built-in) | before 20.13 a counter-clockwise polygon (Tiled, mirrored with `scale(-1, 1)`) had inward edge normals; upgrade |
| `raycast` throws "reading 'x'" / "reading 'length'" (built-in) | before 20.13 a body carrying a `Point`, `Sphere` or `Box3d` broke the ray walk; upgrade |
| a ray passes through a rotated ellipse, or stops short of it (built-in) | before 20.13 the raycast ignored `Ellipse#angle`; upgrade |
| the debug hitbox does not follow a spinning body | pre-1.2.1 matter-adapter / pre-1.3.1 planck-adapter returned the authored shapes rather than the rotated ones |
| a Tiled polyline becomes a solid box on matter | matter-adapter < 1.5.0 built a `Line` as its AABB; upgrade (a degenerate `Polygon` still falls back to one) |
| the player climbs a tall wall with repeated jumps (matter, planck) | matter-adapter < 1.5.3 / planck-adapter < 1.6.3 counted any contact with a lower body as ground; upgrade |
| a hero made of several shapes is never grounded, so it cannot jump (matter) | matter-adapter < 1.5.3 missed contacts on the parts of a compound body; upgrade |
| `setSensor(true)` on a platform under the player does nothing, so it cannot be dropped through (matter) | matter-adapter < 1.5.3 did not update a contact already in place; upgrade |
| `raycast` misses a body made of several shapes, or a concave one (matter) | matter-adapter < 1.6.0 did not resolve the part it hit to its body; upgrade |
| a shape hook's `normal` points the opposite way to `onCollisionStart`'s (matter) | matter-adapter < 1.6.0 reversed it; upgrade |
| `response.depth` is always `0` (planck) | planck-adapter < 1.7.0 read the depth from the wrong place; upgrade |
| an invisible body keeps colliding after `removeChildNow()` from `onCollisionStart` (planck) | planck-adapter < 1.7.0 could not destroy a body while the world was locked; upgrade, or use `removeChild()` |
| a spin never settles after `adapter.setFrictionAir()` (planck) | planck-adapter < 1.7.0 damped movement only there; upgrade |

## Related skills

- `melonjs-renderables` — `isKinematic`, which also gates the broadphase
- `melonjs-tilemaps` — collision shapes authored in Tiled
- `melonjs-loading-assets` — preloading a shape editor's export as JSON
