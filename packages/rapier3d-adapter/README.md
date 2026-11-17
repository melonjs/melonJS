# @melonjs/rapier3d-adapter

![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/melonjs/melonJS/blob/master/LICENSE)
[![NPM Package](https://img.shields.io/npm/v/@melonjs/rapier3d-adapter)](https://www.npmjs.com/package/@melonjs/rapier3d-adapter)

A [Rapier](https://rapier.rs) 3D physics adapter for melonJS: rigid bodies that move, tumble and stack in three dimensions, for a game drawn with `Camera3d`. Rapier is a rigid-body engine written in Rust and compiled to WebAssembly, with continuous collision detection per body, joints and a character controller.

It implements the same `PhysicsAdapter` interface as the other adapters, in its 3D form: bodies are declared with a `bodyDef` made of the 3D shapes, the collision hooks are the same, and the portable calls take a `Vector3d` where a 2D game passes a `Vector2d`. Each frame, a body's position is written to its renderable's `pos` and `depth`, and its turn to its `currentTransform`, so a `Mesh`, a `Sprite3d` or a `GLTFModel` tumbles as it is simulated.

## Installation

```bash
npm install @melonjs/rapier3d-adapter
```

[`@dimforge/rapier3d-compat`](https://www.npmjs.com/package/@dimforge/rapier3d-compat) is a regular dependency of the adapter, installed with it: Rapier's build with its WebAssembly embedded in the JavaScript, which works with any bundler, a CDN or plain ES modules. The only peer dependency is `melonjs` 20.16 or later, the first with the 3D shapes.

## Usage

Create the adapter with `Rapier3dAdapter.create()` and pass it as the `physic` option, with a 3D camera:

```ts
import { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
import { Application, Box3d, Camera3d, Mesh, video } from "melonjs";

const app = new Application(800, 600, {
    parent: "screen",
    renderer: video.WEBGL,
    cameraClass: Camera3d,
    physic: await Rapier3dAdapter.create(),
});
await app.init();

const crate = new Mesh(0, 0, { model: "crate", texture: "crate", width: 64, height: 64 });
crate.pos.set(0, -200);
crate.bodyDef = { type: "dynamic", shapes: [new Box3d(0, 0, 0, 64, 64, 64)] };
// give the depth when adding it: left out, the container numbers it
app.world.addChild(crate, 0);
```

Shapes are in the renderable's space, relative to its `pos` (and `depth`), which is where the body sits. The engine's 3D convention holds: Y grows downward, +Z goes into the screen.

### Loading Rapier

As on every melonJS adapter:

- `Rapier3dAdapter.load()` downloads and compiles Rapier, and resolves when it is ready. Every call returns the same promise; a failed load rejects, and the next call tries again.
- `Rapier3dAdapter.create(options)` waits for `load()`, then constructs the adapter.
- `Rapier3dAdapter.loaded` is `true` once `load()` has finished.

Rapier is imported with `import()`, so bundlers put it (about 4.3 MB, 1.6 MB compressed) in a chunk of its own, downloaded when `load()` is first called. There are two ways to wait for it.

#### 1. Before the game starts: `create()`

The shortest: await the adapter in the `Application` settings, as on every adapter.

```ts
import { Application, Camera3d, loader } from "melonjs";
import { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";

const app = new Application(800, 600, {
    parent: "screen",
    cameraClass: Camera3d,
    physic: await Rapier3dAdapter.create({ gravity: { x: 0, y: 980, z: 0 } }),
});
await app.init();
await loader.preload(assets);
// build the scene from here
```

The page stays blank while Rapier downloads and compiles: the loading screen only starts with `loader.preload`, after it. Right for a prototype, a test, or a game whose players have Rapier cached.

#### 2. Behind the loading screen: the preloader

Rapier is the largest download a game with it has, so load it with the game's other assets, where the loading screen counts it. Teach the loader an asset type for it with `loader.setParser`, list it in the preload, and switch the world to Rapier once the preload is done:

```ts
import { Application, Camera3d, loader } from "melonjs";
import { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";

// once: registering the same type twice logs a warning
loader.setParser("rapier3d", (_asset, onload, onerror) => {
    Rapier3dAdapter.load().then(() => onload(), onerror);
    return 1; // one asset, for the loading screen's progress
});

// no `physic` here: the built-in physics runs until the switch below
const app = new Application(800, 600, { parent: "screen", cameraClass: Camera3d });
await app.init();

await loader.preload([
    { name: "rapier3d", type: "rapier3d", src: "" },
    ...assets,
]);
app.world.setAdapter(new Rapier3dAdapter({ gravity: { x: 0, y: 980, z: 0 } }));
// build the scene from here
```

Rapier downloads in parallel with the models and textures, the loading screen shows it from the first frame, and a failed download fails the preload like any other asset. `world.setAdapter()` (melonJS 20.14 and later) rebuilds any body made before it from its `bodyDef`, so the order is safe either way; building the scene after it is simply cheaper. The [Slingshot](https://melonjs.github.io/melonJS/examples/#/slingshot) example loads this way.

#### Will this stay asynchronous?

The WebAssembly ESM integration proposal lets JavaScript import a compiled module without awaiting it (source phase imports, `import source mod from "./engine.wasm"`), supported in some engines already. It takes the `await` out of the code, not the download: a static import is fetched and compiled before the game's own code runs, where no loading screen can show it. Rapier's `-compat` build, which this adapter uses, embeds its WebAssembly and starts it asynchronously. Should a later build be ready at import, `load()` resolves at once, as it already does on the built-in, matter and planck adapters, and both ways above work unchanged.

### Options

All optional; this is the call with each at its default:

```ts
physic: await Rapier3dAdapter.create({
    gravity: { x: 0, y: 320, z: 0 }, // pixels per second², ≈ 10 m/s² pulling down
    pixelsPerMeter: 32,              // a 32-pixel cube is one meter, and weighs 1 kg
    subSteps: 1,
}),
```

#### `gravity`

In pixels per second², with an optional `z`. It is read at every step: `app.world.adapter.gravity.set(0, 0, 320)` pulls along Z from the next one (a body already asleep stays asleep until something wakes it).

#### `pixelsPerMeter`

Rapier is tuned for objects about a meter across, so the adapter works in meters and converts everything at the boundary (positions, velocities, gravity, forces, queries): every value you pass is in pixels. Raising it makes every body smaller in meters, so lighter, and the same force moves it further; motion under gravity alone looks the same in pixels. It must be a positive number.

#### `subSteps`

Rapier steps per engine frame, each of `dt / subSteps` seconds: more accurate fast contacts and tall stacks, at about that many times the physics cost. Values below 1 are clamped to 1.

## Shapes

| melonJS shape | Rapier collider | notes |
|---|---|---|
| `Box3d` | cuboid | exact |
| `Sphere` | ball | exact |
| `Capsule3d` | capsule | upright along Y: the shape for a character |
| `ConvexHull3d` | convex polyhedron | the hull of its points: a moving prop |
| `TriangleMesh3d` | triangle mesh | exact, hollow: terrain and level geometry, on a static or kinematic body |
| `Rect`, `Ellipse`, `Polygon`, `Line`, `Point` | refused | throws: a 2D shape has no depth |

Build them from a model as it is drawn, through its transform, scale and handedness:

```ts
level.bodyDef = { type: "static", shapes: [TriangleMesh3d.fromMesh(level)] };
rock.bodyDef  = { type: "dynamic", shapes: [ConvexHull3d.fromMesh(rock)] };
```

A shape can carry `collisionType`, `collisionMask`, `isTrigger` (a sensor) and `isActive` (`false` builds no collider), which override the body's. A `ConvexHull3d` whose points all lie in one plane has no hull: it becomes their bounding box. A triangle mesh has no volume, so it gives a dynamic body no mass.

`adapter.getBodyShapes(renderable)` returns the shapes as given, before the body turns; `getBodyAABB` the XY footprint of the colliders as the body is turned now (exact for a box, a sphere and a capsule; a hull's or a mesh's bounding box, turned).

`adapter.updateShape(renderable, shapes)` replaces the colliders and keeps the body: its position, turn and velocities, its joints, everything set on it at run time, and the handle on `renderable.body`. The pairs touching it end and start again, and its mass becomes that of the new shapes. A shape the adapter cannot build throws before anything is changed.

## The 3D API

The portable calls take a `Vector3d`, and the 2D forms keep working, in the plane of the body:

```ts
const adapter = app.world.adapter as Rapier3dAdapter;

adapter.setVelocity(ball, new Vector3d(0, -200, 400)); // px/s on each axis
adapter.setVelocity(ball, new Vector2d(50, 0));        // sets x and y, keeps the z velocity
adapter.applyImpulse(ball, new Vector3d(0, 0, 64), hitPoint); // off-centre, it spins the body
adapter.applyForce(ship, new Vector3d(0, 0, 10));      // for this frame
adapter.applyTorque(top, new Vector3d(0, 5, 0));       // a number turns about Z
adapter.setPosition(crate, new Vector3d(0, 0, 200));   // a Vector2d keeps the depth

adapter.getVelocity3d(ball);         // Vector3d, px/s
adapter.getRotation(crate);          // Quaternion, from the pose it was made in
adapter.setRotation(crate, q);       // turns the drawn model too, at once
adapter.getAngularVelocity3d(crate); // rad/s about each axis
adapter.setAngularVelocity(crate, new Vector3d(0, 2, 0)); // a number sets the spin about Z only
adapter.setAngle(crate, rad);        // a turn about Z; getAngle() reads the turn about Z
```

`renderable.body` is the Rapier `RigidBody`, with the portable melonJS helpers added to it, as on the 2D Rapier adapter:

```ts
body.setVelocity(x, y, z?)              // pixels per second; without z, the depth velocity is kept
body.getVelocity(out?) / body.getVelocity3d(out?)
body.applyForce(x, y, pointX?, pointY?) // for this frame, in the plane of the body
body.applyImpulse(x, y, z?)             // an instant change of velocity: Δv = J / mass
body.setAngle(rad) / body.getAngle()    // the turn about Z
body.setAngularVelocity(w) / body.getAngularVelocity() // radians per second, about Z
body.applyTorque(t)                     // for this frame, about Z
body.setStatic(isStatic?)
body.setSensor(isSensor?)
body.setGravityScale(scale)
body.setMass(kg)                        // scales every shape's density
body.setBounce(restitution)
body.collisionType / body.collisionMask // read the first shape's values, write every shape's
```

The adapter has the same operations as `adapter.X(renderable, ...)`, except `setMass` and `setBounce`, and also `setFrictionAir`, `setMaxVelocity({ x, y, z? })` / `getMaxVelocity`, `setCollisionType` and `setCollisionMask`. Type the body as `Rapier3dAdapter.Body` to reach Rapier's own methods (`enableCcd`, `linvel`, `sleep`, …), which work in meters.

**Units.** Velocities are in pixels per second and angular velocities in radians per second. `applyForce` accelerates a body by `force / mass` px/s², and `applyImpulse` changes its velocity by `impulse / mass` px/s; a 32-pixel cube at the default density weighs 1 kg at the default scale. A torque is in Rapier's own unit (N·m, not scaled by `pixelsPerMeter`), as on the 2D Rapier adapter. A force or torque lasts for the frame it is applied in, across every sub-step, so apply it every frame for a sustained push.

**How the turn is drawn.** The body's turn is applied on top of the `currentTransform` the renderable had when its body was made, so a model turned or scaled to its rest pose keeps it. A `Mesh` (and a `Sprite3d`) turns in its model's Y-up space, which the adapter accounts for; a `GLTFModel` and any other renderable turn in the engine's space. Moving the renderable with `pos` directly is undone at the next step; use `setPosition` and `setRotation`.

**Code for any adapter** can test `adapter.capabilities.bodies3d` before using the 3D readers, which 2D adapters leave out:

```ts
const v = adapter.getVelocity3d?.(ball) ?? adapter.getVelocity(ball);
```

## Collision events

The same hooks as on every adapter:

```ts
class Pet extends Mesh {
    onCollisionStart(response, other) { /* the first touch */ }
    onCollisionActive(response, other) { /* every frame while touching */ }
    onCollisionEnd(response, other) { /* separated, or the other body was removed */ }
}
```

`response.normal` is `{ x, y, z }`, the unit direction this renderable must move to separate, and `response.depth` the overlap in pixels; both are zero for a sensor contact and in `onCollisionEnd`. `response.pair` is `{ collider1, collider2 }`, the two Rapier collider handles. The shape-level hooks (`onShapeCollisionStart`, …) name each pair of shapes, with the z of the normal in `normalZ`. A renderable with no `onCollisionActive` gets `onCollision` instead, once a frame.

A hook can remove a body, its own or the other one, or change its shapes with `updateShape()`. Every renderable that heard a contact start hears it end, after the start: the one whose body is taken out at once, the other when the hooks of that contact are done. A renderable whose body is gone hears nothing more.

`adapter.isGrounded(renderable)` is true while a contact pushes the body up (against Y), on a surface up to about 84° from level.

## Queries

```ts
adapter.raycast3d(from: Vector3d, to: Vector3d) → RaycastHit3d | null
adapter.querySphere(center: Vector3d, radius) / querySphere(sphere: Sphere) → Renderable[]
adapter.queryAABB(rect: Rect) → Renderable[]
```

- `raycast3d` returns the first collider along the segment, as `{ renderable, point, normal, fraction }`, against the exact shapes: the hit point in pixels, the unit surface normal there, and how far along the segment it is (0 to 1). A body the ray starts inside is skipped, so a body casting from its own centre does not hit itself. Sensors are hit like any other body.
- `querySphere` returns every renderable whose colliders overlap the sphere, exactly, once each.
- `queryAABB` returns what lies over a rectangle in XY, at any depth, once each: by each collider's box as the body is turned, the one `getBodyAABB` reports.

There is no 2D `raycast` (`capabilities.raycasts` is `false`): a 3D world is queried with `raycast3d`. Rapier indexes a body for these queries when its world steps, so a body is found from the frame after it is added, or moved with `setPosition`.

## Body definitions

```ts
this.bodyDef = {
    type: "dynamic",            // "static" | "dynamic" | "kinematic"
    shapes: [ /* see above */ ],
    collisionType?: number,     // default PLAYER_OBJECT (0x0001)
    collisionMask?: number,     // default ALL_OBJECT
    isSensor?: boolean,
    density?: number,           // kg/m³, default 1
    friction?: number,          // default 0.2
    restitution?: number,       // bounce, default 0
    frictionAir?: number,       // damping per second, of movement and rotation; { x, y } is averaged
    gravityScale?: number,      // default 1
    fixedRotation?: boolean,    // default false: the body turns
    maxVelocity?: { x, y, z? }, // px/s per axis; z left out leaves depth uncapped
};
```

A `kinematic` body moves by its velocity and ignores gravity. Collision types and masks filter on all 32 bits, as on the 2D Rapier adapter.

## Joints

`app.world.addJoint()` makes the four portable joints, in 3D:

| `type` | Rapier joint | settings |
|---|---|---|
| `"hinge"` | revolute | `axis`, default Z (as a 2D hinge turns); `limits` in radians |
| `"rope"` | rope | `maxLength` in pixels, default the distance when made |
| `"weld"` | fixed | welded as they stand |
| `"slider"` | prismatic | `axis`, default X; `limits` in pixels along it |

Anchors take an optional `z`, in each renderable's own space, relative to its `pos`; the axis too, in `a`'s own space.

```ts
app.world.addJoint({
    type: "hinge",
    a: frame,
    b: door,
    anchorB: { x: -40, y: 0, z: 0 },
    axis: { x: 0, y: 1, z: 0 }, // a door turns about the vertical
    limits: { min: 0, max: Math.PI / 2 },
});
```

- **Pixels in, meters inside.** Anchors, lengths and slider limits are in pixels; the adapter converts them with `pixelsPerMeter`.
- **Default anchors hold the bodies where they are.** `anchorB` defaults to `b`'s position, and `anchorA` to the point of `a` under it; a rope joins the two positions.
- **Bodies are joined as they stand**, however each is turned: a weld and a slider keep the turn between them, and a hinge leaves them only the turn about its axis. A hinge's `limits` are `b`'s angle about the axis minus `a`'s, so make the joint with the two turned alike (or apart about the axis only) when it has limits.
- **Limits are soft.** A body moving fast can pass a hinge or slider limit by a few pixels for a frame before Rapier pushes it back.
- **The world keeps the joint.** It is removed when either body leaves the world, and built again by `world.setAdapter()`. `updateShape()` keeps the body, so it keeps its joints too, `joint.native` included.
- **Motors and the rest of Rapier's joint settings** are on the Rapier joint itself, `joint.native` (a `RevoluteImpulseJoint`, …). That code is Rapier-only, and the setting is lost when `setAdapter()` builds the joint again.

## Rapier features

`adapter.rapier` is the Rapier module and `adapter.world` the Rapier world, for what the portable interface does not cover. Code that uses them is Rapier-only; test `app.world.physic === "rapier3d"` to branch.

```ts
const { rapier, world } = app.world.adapter as Rapier3dAdapter;

// continuous collision detection, for a fast body that must not pass through a thin one
(projectile.body as Rapier3dAdapter.Body).enableCcd(true);

// a ball-and-socket joint, for a chain or a ragdoll (in meters, body-local)
world.createImpulseJoint(
    rapier.JointData.spherical({ x: 0, y: 0.5, z: 0 }, { x: 0, y: -0.5, z: 0 }),
    upper.body as Rapier3dAdapter.Body,
    lower.body as Rapier3dAdapter.Body,
    true,
);

// Rapier's kinematic character controller, with a 1 cm skin
const controller = world.createCharacterController(0.01);
controller.computeColliderMovement(
    (hero.body as Rapier3dAdapter.Body).collider(0),
    { x: 0.1, y: 0.2, z: 0 },
);
const move = controller.computedMovement(); // meters: apply it to a kinematic body
```

Bodies sleep when they come to rest and wake on contact, or when the adapter moves, turns or pushes them; `body.sleep()` and `body.wakeUp()` force it. `adapter.isSleeping(renderable)` says whether a body is asleep, the way to tell a shot or a stack has settled; it is `false` for a fixed or kinematic body. A sleeping body's renderable is not written to, nor a static one's.

Rapier's objects live in WebAssembly memory, which the garbage collector does not reclaim. The adapter frees them in `destroy()`, which `world.setAdapter()` calls on the adapter it replaces; from then on its queries find nothing, and a body handle kept from it must not be used. Free a joint or a character controller you created yourself through `adapter.world` with `world.removeImpulseJoint()` / `world.removeCharacterController()`; the joints `app.world.addJoint()` made are freed for you.

## Coming from the 2D Rapier adapter

The options, the loading (`load()` / `create()` / `loaded`), the `bodyDef` fields, the hooks, the body helpers and the units are the same. What differs:

- **Shapes have depth.** `Box3d`, `Sphere`, `Capsule3d`, `ConvexHull3d` and `TriangleMesh3d`; a `Rect` or an `Ellipse` is refused with the shape to use instead.
- **The body sits at the renderable's `pos` and `depth`**, and shapes are relative to it, whatever the anchor point. The 2D adapter puts the body at the centre of its first shape.
- **Three axes.** `gravity` is a `Vector3d`; a call given a `Vector3d` acts on all three axes, and one given a `Vector2d`, a scalar angle or a scalar spin acts in the plane of the body, about Z. `getRotation` / `setRotation`, `getVelocity3d` and `getAngularVelocity3d` read and write the rest.
- **`raycast3d` and `querySphere`** in place of `raycast`.
- **`getBodyShapes` returns the shapes as given**, where the 2D adapter returns them posed; the pose is `pos`, `depth` and `getRotation`.
- **`updateShape()` keeps the body** (see [Shapes](#shapes)), where the 2D adapter builds a new one.
- **`physicLabel` is `"rapier3d"`**, and `capabilities.bodies3d` is `true`.
- **Hinges and sliders take an `axis`** with a `z`, and anchors a `z`.


## Examples

The [Slingshot](https://melonjs.github.io/melonJS/examples/#/slingshot) example launches animals at towers of blocks that topple and tumble.

## License

MIT. Rapier itself is distributed under the Apache 2.0 license.
