# Changelog

## 1.2.0 - _2026-08-23_

### Fixed
- **A body with more than one shape received NO collision events at all.** matter reports collisions between compound **parts**, but only the parent body was registered against its renderable, so every dispatch failed its lookup and returned early. That silently dropped `onCollision`, `onCollisionStart`, `onCollisionActive` and `onCollisionEnd` for any multi-shape body, while single-shape bodies worked normally. Parts now resolve through `body.parent`, which matter sets to the body itself for a simple body, so both cases take one path

### Added
- **Shape-level collision events** ([melonjs#1596](https://github.com/melonjs/melonJS/issues/1596)): `onShapeCollisionStart`, `onShapeCollisionActive` and `onShapeCollisionEnd` now fire on this backend, reporting every overlapping shape pair rather than one contact per body pair. Each melonJS shape becomes one matter part and matter's pairs are already per-part, so a compound body overlapping through several shapes produces several pairs and every one is reported. Each contact carries both shapes, both indices into the body definition, the trigger status and the contact normal and depth, receiver-symmetric so `shapeA` / `indexShapeA` are always your own

### Notes
- The peer range stays `>=20.0.0`. These hooks are dispatched by the adapter itself and are ordinary methods on your renderable, so nothing here needs the engine release that introduced them: the events work on any melonJS 20.x. The builtin detector's own implementation arrived in 20.1.0


## 1.1.1 - _2026-08-21_

### Changed
- **Minimum melonJS bumped to 20.0.0** — tracks the engine's physics contract in 20.0.0
- **Per-shape collision settings are not supported** ([melonjs#1590](https://github.com/melonjs/melonJS/issues/1590)) — a shape's own `collisionType` / `collisionMask` / `isTrigger` / `isActive` are ignored under this adapter. Matter's `collisionFilter` and `isSensor` are properties of a *body*, not of the parts it is built from, so there is nothing to map them onto. Body-level filtering is unaffected; use the builtin or planck adapter if you need per-shape control


## 1.1.0 - _2026-06-06_

### Changed
- **Minimum melonJS bumped to 19.7.0.** The `PhysicsAdapter` interface gained the required `raycasts3d: boolean` capability and the optional `raycast3d?` / `querySphere?` methods in 19.7 alongside `Camera3d` + the `Octree` broadphase. `@melonjs/matter-adapter` declares `raycasts3d: false` and omits both 3D methods — Matter is 2D-only, so any `world.raycast3d` / `world.adapter.querySphere?(...)` call under this adapter falls through to `null` / `undefined` at the call site.

## 1.0.0 - _2026-05-22_

### Added
- **`MatterAdapter.Body`** — published type for `renderable.body` under this adapter. Namespace-merged with the class, defined as `ReturnType<typeof Matter.Body.create> & PhysicsBody`. Lets user code reach matter-native fields (`frictionAir`, `angle`, `angularVelocity`, `torque`, …) via `(this.body as MatterAdapter.Body).frictionAir = 0.02` without importing `matter-js` directly — the matter dependency stays behind the adapter boundary.
- **`subSteps` option** on `MatterAdapterOptions` (default 1). Runs `Matter.Engine.update(engine, dt / N)` N times per `step()` call. Increases narrow-phase accuracy at high relative velocities (break shots, projectiles) at the cost of ~N× physics CPU. Matter's broad phase isn't swept, so a body moving more than ~one collision radius per tick can tunnel through a wall or other body; smaller per-tick deltas cap inter-body motion and eliminate the tunneling.
- **Angular API helpers spliced onto each body**: `setAngularVelocity(omega)` / `getAngularVelocity()` / `setAngle(rad)` / `getAngle()` / `applyTorque(t)`. Match the corresponding `PhysicsBody` interface methods. `applyForce(x, y)` extended to accept an optional point `(x, y, pointX, pointY)` — when present, forwarded to `Matter.Body.applyForce(body, point, F)` so matter's native lever-arm handling generates the corresponding torque.
- **Adapter-level angular methods**: `setAngle` / `getAngle` / `setAngularVelocity` / `getAngularVelocity` / `applyTorque` / `applyForce(rend, F, point?)`. Mirror the body-level helpers for portable code.
- **`BodyDefinition.friction` passthrough** — matter's `body.friction` (surface coefficient of friction) is now honored on body registration. Combined with `fixedRotation: false`, produces the matter-native "throw" effect between balls and rail-friction-induced trajectory changes off walls.
- **Helpers contract enforced by the type system** — the `helpers` object spliced onto each body at registration is typed `Omit<PhysicsBody, "collisionType" | "collisionMask">`. Drift between the matter helpers and the engine's portable `PhysicsBody` interface now fails the matter-adapter build immediately.

### Fixed
- **`syncFromPhysics` rotation pivot** — the per-frame transform sync set `currentTransform.identity().rotate(body.angle)`, which `Renderable.preDraw` then applies pivoted at `renderable.pos`. For renderables with `anchorPoint = (0, 0)` and a body shape centered inside the bounds (the common case), the sprite rotated around its top-left corner instead of its visible center. Now pre-translates by the negated `posOffset` (the centroid → pos delta cached at addBody time), so rotation lands on the visible center regardless of anchor.

### Notes
- Initial release.
