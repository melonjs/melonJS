# Changelog

## 1.0.0 - _unreleased_

### Added
- A melonJS physics adapter for Rapier 2D, compiled to WebAssembly, implementing the full `PhysicsAdapter` interface ([#1845](https://github.com/melonjs/melonJS/issues/1845))
- `RapierAdapter.load()` and `create()`: Rapier downloads in a chunk of its own and compiles before the adapter is built
- Every melonJS shape is simulated, concave polygons exactly as triangles; `Point`, `Box3d` and `Sphere` are refused with the reason
- Collision types and masks filter on all 32 bits, over Rapier's 16-bit collision groups
- Rapier's own features through `adapter.rapier` and `adapter.world`: per-body continuous collision detection, joints, the character controller
