# Changelog

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
