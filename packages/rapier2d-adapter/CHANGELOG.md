# Changelog

## 1.2.0 - _2026-11-16_

### Added
- `isSleeping()`: whether Rapier has put a body to sleep

## 1.1.3 - _2026-11-16_

### Fixed
- A `"slider"` joint keeps the angle between the two bodies as it was when the joint was made, as `JointDefinition` says and as a Box2D prismatic joint set up from the bodies does: the second body slides along the first body's axis and turns with it. It used to turn the second body onto the first body's angle. Bodies joined at the same angle behave as before. A game that relied on the turn sets the second body's angle with `setAngle()` before `addJoint()`

## 1.1.2 - _2026-11-16_

### Fixed
- A body removed inside an `onCollisionStart`, `onCollisionActive` or shape-level hook no longer makes the other renderable hear `onCollisionEnd` before its `onCollisionStart`, with no end after it: the side going out hears the end at once, the other once the pair's hooks are done, and only a side that heard the start hears the end. Removing that body again from the partner's end hook no longer crashes Rapier (`RuntimeError: unreachable`)
- A start event Rapier queued for a collider that a hook removed earlier in the same step no longer leaves a stale touching pair behind: it stayed until Rapier's stop event
- `step()` with a `dt` that is `NaN`, infinite, zero or negative simulates nothing; a `NaN` or `Infinity` step used to freeze every awake body for good, with no gravity afterwards
- `raycast()` and `queryAABB()` on a destroyed adapter return `null` and `[]`; they threw `Cannot read properties of undefined`
- A `NaN` `maxVelocity` on an axis no longer turns the body's velocity into `NaN`: it caps nothing. A negative one caps by its size; it used to pin the velocity at that speed, even on a body at rest
- `setMaxVelocity()` on a renderable with no body yet no longer keeps the renderable alive until `destroy()`: the cap is held weakly, and still applies once `addChild()` builds the body, unless the `bodyDef` has a `maxVelocity` of its own
- A second `addBody()` for the same renderable replaces its body; the first Rapier body and its records were leaked, and kept colliding. An `addBody()` refused for an unsupported shape no longer leaves an orphan Rapier body in the world
- A contact normal has no negative zero: the side of an axis-aligned contact that is handed the negated normal got `{ x: -0, y: -1 }`, so `toEqual({ x: 0, y: -1 })` failed; so did the zero normal of an `onCollisionEnd` and of a sensor contact, and the shape-level `normal`, `overlapN` and `overlapV`

## 1.1.1 - _2026-11-14_

### Fixed
- Installing the adapter no longer asks for Node 24. Its `package.json` declared `engines: { node: ">=24.0.0" }`, so npm warned on an older Node and Yarn 1 refused to install it; the adapter runs in the browser

## 1.1.0 - _2026-11-13_

### Added
- Joints through `world.addJoint()` (melonJS 20.15): a `"hinge"` is a revolute joint, a `"rope"` a rope joint, a `"weld"` a fixed joint and a `"slider"` a prismatic joint, in pixels and radians; `updateShape()` keeps a body's joints

### Fixed
- `updateShape()` keeps the body's angle; the new body was built upright

## 1.0.0 - _2026-11-12_

### Added
- A melonJS physics adapter for Rapier 2D, compiled to WebAssembly, implementing the full `PhysicsAdapter` interface ([#1845](https://github.com/melonjs/melonJS/issues/1845))
- `RapierAdapter.load()` and `create()`: Rapier downloads in a chunk of its own and compiles before the adapter is built
- `Rect`, `RoundRect`, `Ellipse`, `Polygon` and `Line` are simulated, concave polygons exactly as triangles; a `Point`, `Box3d` or `Sphere` is refused with the reason
- Collision types and masks filter on all 32 bits, over Rapier's 16-bit collision groups
- Rapier's own features through `adapter.rapier` and `adapter.world`: per-body continuous collision detection, joints, the character controller
