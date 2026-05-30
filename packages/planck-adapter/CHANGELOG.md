# Changelog

## 1.1.0 - _unreleased_

### Changed
- **Minimum melonJS bumped to 19.7.0.** The `PhysicsAdapter` interface gained the required `raycasts3d: boolean` capability and the optional `raycast3d?` / `querySphere?` methods in 19.7 alongside `Camera3d` + the `Octree` broadphase. `@melonjs/planck-adapter` declares `raycasts3d: false` and omits both 3D methods — planck (Box2D) is 2D-only, so any `world.raycast3d` / `world.adapter.querySphere?(...)` call under this adapter falls through to `null` / `undefined` at the call site.

## 1.0.0 - _2026-05-22_

Initial release of `@melonjs/planck-adapter` — a [planck.js](https://piqnt.com/planck.js/) (Box2D 2.3.0 port) physics adapter for melonJS.

### Added

- **`PlanckAdapter`** — full `PhysicsAdapter` implementation wrapping a `planck.World`. Drops in as the `physic` option on `Application` and gives you Box2D's rigid-body simulation: continuous collision detection, sleeping bodies, joints, raycasts, and full rotational dynamics. Reports `physicLabel = "planck"`, so user code can branch on `app.world.physic === "planck"` without importing the adapter class.
- **`PlanckAdapterOptions`** with `gravity` (px/s²), `pixelsPerMeter` (default `32`), `subSteps` (default `1`), `velocityIterations` (default `8`), and `positionIterations` (default `3`). Tuning the iteration counts and substeps is the standard Box2D path to stiffer stacks / fewer tunneling cases / crisper restitution.
- **`PlanckAdapter.Body`** — published type for `renderable.body` under this adapter. Namespace-merged with the class, defined as `planck.Body & PhysicsBody`. Lets user code reach planck-native methods (`setBullet`, `setSleepingAllowed`, `getMass`, `applyAngularImpulse`, …) via `(this.body as PlanckAdapter.Body).setBullet(true)` without importing `planck` directly — the planck dependency stays behind the adapter boundary.
- **Pixel ↔ meter unit conversion** at every adapter boundary (positions, velocities, gravity, forces, AABB queries). Configurable via `pixelsPerMeter`. Internal Box2D state stays in real-world units (the simulator's tuned sweet spot), while the engine boundary keeps melonJS in pixel space throughout.
- **Body + fixture split mirrored declaratively.** A single `BodyDefinition` with `shapes: [Rect, Polygon, ...]` produces a single `planck.Body` with one fixture per shape. Friction (`friction`), restitution (`restitution`), density (`density`), and sensor (`isSensor`) flags are forwarded to each fixture; type (`static` / `dynamic` / `kinematic`), gravity scale, fixed rotation, and linear damping (`frictionAir`) go on the body.
- **Collision lifecycle handlers** — `onCollisionStart`, `onCollisionActive`, `onCollisionEnd` on each renderable with the same receiver-symmetric `CollisionResponse` shape as `@melonjs/matter-adapter` (a/b receiver pair, MTV normal, penetration depth in pixels, raw `planck.Contact` as `response.pair`). Begin/end fire on planck's `begin-contact` / `end-contact` events; active fires for every touching contact in the world each step.
- **Portable body helpers spliced onto `renderable.body`**: `setVelocity` / `getVelocity` / `applyForce(x, y, pointX?, pointY?)` / `applyImpulse` / `setSensor` / `setStatic` / `setCollisionMask` / `setCollisionType` / `setMass` / `setBounce`. Angular APIs (`setAngle`, `getAngle`, `setAngularVelocity`, `getAngularVelocity`, `applyTorque`) and `setGravityScale` are deliberately NOT spliced because planck's `Body` already provides them with compatible signatures — splicing would shadow (and recurse into) the native methods.
- **Live `collisionType` / `collisionMask` aliases on the body** — read and write planck's per-fixture `filterCategoryBits` / `filterMaskBits` through the legacy melonJS body-level names. Writes propagate to every fixture on the body, so multi-shape bodies stay in sync without per-fixture bookkeeping.
- **`adapter.planck` and `adapter.world` escape hatches** for planck-specific features (joints, particles, native queries, raw events). User code reaches the whole `planck` namespace through `adapter.planck` without taking a direct `planck` import; the underlying `planck.World` is exposed as `adapter.world` for joint creation and other body / fixture management.
- **AABB query + raycast** via `adapter.queryAABB(rect)` and `adapter.raycast(from, to)`. Both convert to/from meters at the boundary; the raycast clips to the closest hit and returns a portable `RaycastHit` with the renderable, world-space hit point, surface normal, and ray fraction in `0..1`.
- **`isGrounded(renderable)`** implementation that walks the body's contact list and reports true when at least one touching contact has the other body's center below this one's. Compatible with sleeping bodies (settled stacks still report grounded against the floor they rest on).
- **Pause-aware step** — when `state.isPaused()` is true (browser tab loses focus, `state.pause()`, etc.) the adapter skips the simulation step entirely, matching `BuiltinAdapter` and `@melonjs/matter-adapter` semantics.

### Notes

- Initial release.
