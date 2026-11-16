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

`gravity` is read at every step: `app.world.adapter.gravity.set(0, 0, 320)` pulls along Z from the next one. Rapier works in meters, and the adapter converts everything at the boundary (positions, velocities, gravity, forces, queries), so every value you pass is in pixels. `pixelsPerMeter` must be a positive number.

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

A shape can carry `collisionType`, `collisionMask`, `isTrigger` (a sensor) and `isActive` (`false` builds no collider), which override the body's. `adapter.getBodyShapes(renderable)` returns the shapes as given, before the body turns; `getBodyAABB` the XY footprint of the colliders as the body is turned now.

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

On the body handle, `setVelocity(x, y, z?)` and `applyImpulse(x, y, z?)` take an optional `z`, and `getVelocity3d(out?)` reads all three axes; the rest of the helpers are those of the 2D adapters. `renderable.body` is the Rapier `RigidBody`: type it as `Rapier3dAdapter.Body` to reach Rapier's own methods.

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

`response.normal` is `{ x, y, z }`, the unit direction this renderable must move to separate, and `response.depth` the overlap in pixels; both are zero for a sensor contact and in `onCollisionEnd`. The shape-level hooks (`onShapeCollisionStart`, …) name each pair of shapes, with the z of the normal in `normalZ`.

`adapter.isGrounded(renderable)` is true while a contact pushes the body up (against Y), on a surface up to about 84° from level.

## Queries

```ts
adapter.raycast3d(from: Vector3d, to: Vector3d) → RaycastHit3d | null
adapter.querySphere(center: Vector3d, radius) / querySphere(sphere: Sphere) → Renderable[]
adapter.queryAABB(rect: Rect) → Renderable[]
```

- `raycast3d` returns the first collider along the segment, as `{ renderable, point, normal, fraction }`, against the exact shapes. A body the ray starts inside is skipped.
- `querySphere` returns every renderable whose colliders overlap the sphere, exactly.
- `queryAABB` returns what lies over a rectangle in XY, at any depth.

Rapier indexes a body for these queries when its world steps, so a body is found from the frame after it is added.

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
    frictionAir?: number,       // damping per second, of movement and rotation
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

Anchors and axes take an optional `z`, in each renderable's own space, relative to its `pos`. A default `anchorB` is `b`'s position, and a default `anchorA` the point of `a` under it, so nothing moves when the joint is made.

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
controller.computeColliderMovement(hero.body.collider(0), { x: 0.1, y: 0.2, z: 0 });
const move = controller.computedMovement(); // meters: apply it to a kinematic body
```

Bodies sleep when they come to rest and wake on contact. Rapier's objects live in WebAssembly memory: the adapter frees them in `destroy()`, which `world.setAdapter()` calls on the adapter it replaces; free what you create through `adapter.world` yourself.

## Examples

The [Slingshot](https://melonjs.github.io/melonJS/examples/#/slingshot) example launches animals at towers of blocks that topple and tumble.

## License

MIT. Rapier itself is distributed under the Apache 2.0 license.
