# Changelog

## 1.3.0 - _2026-08-24_

### Added
- **Shape-level collision events** ([melonjs#1596](https://github.com/melonjs/melonJS/issues/1596)): `onShapeCollisionStart`, `onShapeCollisionActive` and `onShapeCollisionEnd` now fire on this backend, reporting every overlapping shape pair rather than one contact per body pair. Box2D creates one contact per FIXTURE pair and this adapter already builds one fixture per shape, so the enumeration is what the engine reports natively rather than something layered on top: a compound body overlapping through several shapes produces several contacts, and each names its own pair. Each contact carries both shapes, both indices into the body definition, the trigger status and the contact normal and depth, receiver-symmetric so `shapeA` / `indexShapeA` are always your own

### Notes
- The peer range stays `>=20.0.0`. These hooks are dispatched by the adapter itself and are ordinary methods on your renderable, so nothing here needs the engine release that introduced them: the events work on any melonJS 20.x. The builtin detector's own implementation arrived in 20.1.0


## 1.2.0 - _2026-08-21_

### Added
- **Tests for per-shape collision settings** — seven cases pinning per-fixture filters, `isTrigger` as a sensor fixture, `isActive` skipping fixture creation, a zero-fixture body still stepping, and the body-wide-setter limitation below
- **Per-shape collision settings** ([melonjs#1590](https://github.com/melonjs/melonJS/issues/1590)) — a shape may now carry its own `collisionType` / `collisionMask` / `isTrigger` / `isActive`, overriding the body-level values. This backend needed no structural change: it already builds one fixture per shape, and Box2D filters and flags sensors per *fixture*, so the shape values simply feed the fields previously fed from the body. `isTrigger` maps to a sensor fixture; `isActive: false` skips fixture creation entirely, keeping the shape out of the simulation without removing it from the body. A shape that sets nothing behaves exactly as before. **Known limitation:** the body-wide setters (`setCollisionType`, `setCollisionMask`, `setSensor`) write every fixture on the body, so calling one after construction overwrites any per-shape values; and `body.collisionType` / `body.collisionMask` read the head fixture, which is the last shape added rather than the body's declared value

### Changed
- **Minimum melonJS bumped to 20.0.0** — per-shape collision settings are defined by the engine's `Body`/`Detector` contract added in 20.0.0


## 1.1.0 - _2026-06-06_

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
