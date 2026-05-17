# Changelog

## 1.0.0 - _unreleased_

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
