# Changelog

## 1.0.1 - _2026-11-17_

### Fixed
- `setPosition()` with a coordinate that is not a finite number (`NaN`, `Infinity`) leaves the body and its renderable where they are, as `setAngle()` and the velocity, force and turn setters already do. The body and its renderable, `depth` included, were put at `NaN` and stayed there until the next valid position

## 1.0.0 - _2026-11-17_

### Added
- A melonJS physics adapter for Rapier 3D, compiled to WebAssembly: bodies that move and turn in three dimensions, written back onto a `Mesh`, `Sprite3d` or `GLTFModel` ([#1846](https://github.com/melonjs/melonJS/issues/1846))
- `Box3d`, `Sphere`, `Capsule3d`, `ConvexHull3d` and `TriangleMesh3d` colliders; a 2D shape is refused with the reason
- The 3D form of the adapter API: `Vector3d` velocities, forces, impulses and positions, `getRotation` / `setRotation`, `getVelocity3d`, `getAngularVelocity3d`, exact `raycast3d` and `querySphere`
- Joints through `world.addJoint()`, with 3D anchors and axes, joining the bodies as they stand however each is turned; Rapier's own features through `adapter.rapier` and `adapter.world`
- `isSleeping()`: whether Rapier has put a body to rest, to tell when a shot or a stack has settled
- `updateShape()` replaces a body's colliders and keeps the body: its pose, velocities, joints, what was set on it at run time and the handle on `renderable.body`
