# Changelog

## 3.1.0 - _2026-06-14_

### Added

- `Spine.findConstraint(name)` — convenience wrapper around the unified 4.3 constraints list; matches the `findBone()`/`findSlot()` shape and resolves any constraint type (IK, transform, path, physics, Slider) by name. Return type is typed as a union of the five concrete constraint classes (`SpineConstraint` typedef) for `instanceof` narrowing without a cast
- `Spine.getConstraintNames()` — list all constraint names defined on the skeleton (mirrors `getAnimationNames()`/`getSkinNames()`)
- spine-core constraint classes re-exported from `@melonjs/spine-plugin` so `instanceof` narrowing of `findConstraint()` results doesn't require a second runtime import (the plugin already owns the spine-core re-export, so identity matches): the new 4.3 Slider classes (`Slider`, `SliderData`, `SliderTimeline`, `SliderMixTimeline`) plus the four pre-existing constraint classes (`IkConstraint`, `TransformConstraint`, `PathConstraint`, `PhysicsConstraint`)

### Fixed

- `setSkeleton()` actually loads binary `.skel` skeletons — was hardcoded to `SkeletonJson` for every input, so passing a `.skel` file (loaded as a `Uint8Array` by the asset manager) threw inside the JSON parser. Now dispatches to `SkeletonBinary` for `.skel` filenames and `SkeletonJson` otherwise. The README and JSDoc have claimed binary support since the original 1.x release; this is the first version where it works. The `spineboy` example in the live preview now loads from `spineboy-pro.skel` to give the binary path continuous coverage

### Chore

- dev deps: `tsx` ^4.21.0 → ^4.22.4, `typescript` ^6.0.2 → ^6.0.3 (no consumer impact — devDependencies aren't installed by npm consumers of the plugin)

## 3.0.0 - _2026-06-14_

### **BREAKING CHANGES**

- **Spine 4.3 editor required** — bundled Spine runtimes bumped from `^4.2.114` to `^4.3.7`. The 4.2 and 4.3 skeleton data formats are incompatible both ways: existing `.json`/`.skel` exports must be re-exported from a Spine 4.3 editor, and 4.3 exports will not load on plugin 2.x
- the plugin now sets `Skeleton.yDown = true` (the official 4.3 Y-down switch, same approach as Spine's own pixi/phaser/canvaskit integrations). Code that reached into `spineObject.skeleton` and compensated for the old manual Y-flip (root bone `scaleY = -1`, inverted physics gravity) must drop those workarounds — the runtime now handles Y-down natively
- Spine 4.3 moved bone/slot state into poses: code accessing `bone.x/.scaleX/.worldX` etc. through `spineObject.skeleton` must use `bone.pose.*` (unconstrained, for writing) or `bone.appliedPose.*` (constrained, for reading world transforms); `slot.color`/`slot.getAttachment()` are now `slot.appliedPose.color`/`slot.appliedPose.attachment`
- other 4.3 core renames that surface through `spineObject.skeleton`: `setToSetupPose()` → `setupPose()`, `physicsConstraints` → `physics`, `MixBlend`/`MixDirection` removed (use `TrackEntry.additive`), `MeshAttachment.getParentMesh()` → `getSourceMesh()`. The plugin's own `Spine.setToSetupPose()` wrapper keeps its name

### Added

- Spine 4.3 feature support inherited with the runtime bump: slider constraints, sequence timelines, non-linear animation mixing (`TrackEntry.mixInterpolation`), convex/inverse clipping, physics force direction vectors (`skeleton.windX/Y`, `gravityX/Y`)
- **WebGL context-loss recovery** — the plugin now survives a `webglcontextlost`/`webglcontextrestored` cycle (melonJS ≥ 19.7 recovery machinery): `SpineBatcher` builds its GPU resources in `init()` so the renderer's restore path can re-create them, and all spine GL resources (atlas textures, debug pipeline) are funneled through a single shared canvas-backed `ManagedWebGLRenderingContext` so spine's own restorables actually fire (a managed context built from a raw GL context has no element to listen on and silently never restores)

### Changed

- minimum melonJS version is now **19.7.1** (was 18.3.0) — required for the WebGL context-loss restore + blend-cache invalidation fix the plugin's recovery path relies on
- skeleton positioning now goes through `skeleton.x/y` instead of writing to the root bone pose — root-bone-relative user code (e.g. custom bone offsets) is unaffected
- `flipX()`/`flipY()` JSDoc corrected: flipping is around the root bone, not the visual center (behavior unchanged, was always root-relative)
- mesh auto-detection for the canvas renderer now uses the public `Skin.getAttachments()` API instead of walking spine's internal `skin.attachments` array

### Performance

- Canvas `SkeletonRenderer` mesh vertex buffer slimmed from 8 floats per vertex down to 2 (positions only) — first removed the 4 dead per-vertex color floats (canvas tinting is applied per slot via `setTint()`/`setGlobalAlpha()`), then dropped the UV interleave entirely (UVs now read straight from `sequence.getUVs(index)` in `drawMesh`). Halves the buffer twice over, eliminates a per-vertex copy pass, and removes the dedicated `computeMeshVertices` method. Verified pixel-identical across all 15 example skeletons (cold-start harness drift falls in the same noise floor with the change applied or not)

### Fixed

- Canvas `SkeletonRenderer` no longer corrupts mesh vertex data while a `ClippingAttachment` is active — the stride-2 "clipped vertex size" was inherited from spine-webgl's `clipTriangles` repacking, which the canvas path never performs: positions were written at stride 2 then read at the full vertex stride, scrambling any mesh drawn inside an active clip (latent since the 4.2 plugin; canvas meshes are clipped per-triangle, so no example skeleton ever exposed it)
- Canvas `SkeletonRenderer` now uses `color.alpha` (the melonJS `Color` accessor) instead of `color.a`, which was always `undefined`. Canvas's `globalAlpha = undefined` is silently ignored, so slot-alpha animation never faded attachments — the canvas renderer behaved as if every slot were fully opaque. Visible on `powerup` (the trailing stars stayed at full opacity instead of fading) and any other skeleton with slot-alpha keyframes
- Canvas `SkeletonRenderer` correctly handles atlas regions packed at 90° rotation (`region.degrees === 90`) — the `translate(-w/2, -h/2)` after the dimension swap was using the *pre-swap* half-dimensions, so any attachment whose texture region was rotated in the atlas drew with its quad offset by `±(w−h)/2`. Visible as the tank turret floating detached from the chassis and the raptor rider's visor tilted off his head on canvas (WebGL was unaffected). Now matches the official `spine-canvas` SkeletonRenderer math by re-deriving the halves from post-swap `w`/`h`

### Removed

- all manual Y-down plumbing made obsolete by `Skeleton.yDown`: the root-bone `scaleY` inversion in `setToSetupPose()`, the per-constraint physics gravity flip in `setSkeleton()`, and the `+90°` Canvas rotation offset in `rotate()`

## 2.2.1 - 2026-05-11

### Changed
- Bump bundled Spine runtimes (`@esotericsoftware/spine-canvas`, `@esotericsoftware/spine-core`, `@esotericsoftware/spine-webgl`) range from `^4.2.109` to `^4.2.114`. Picks up the empty-atlas hang fix in `AssetManagerBase` (4.2.113) — `loadTextureAtlas` no longer waits forever on an atlas with zero pages. No plugin API change.

## 2.2.0 - 2026-04-15

### Added
- `setTint()` now applies to `skeleton.color` — RGB tinting works on WebGL, Canvas is limited to alpha only
- Canvas `SkeletonRenderer` now passes `premultipliedAlpha` to `setBlendMode()` for correct blending with PMA textures

### Fixed
- fix `scale()` double-applying on Canvas — was scaling through both root bone and canvas context
- fix `skin.attachments.entries()` crash in mesh detection — inner attachments are plain objects, not Maps
- fix potential crash when `draw()` is called before `setSkeleton` completes

## 2.1.0

### Added
- Tiled integration: Spine objects can now be placed directly in Tiled maps — set the object class to "Spine" and add `atlasFile`/`jsonFile` custom properties. The plugin registers a Tiled object class on initialization via `registerTiledObjectClass("Spine", Spine)`

### Changed
- minimum melonJS version is now 18.3.0 — required for the Tiled object factory registry that enables placing Spine objects directly in Tiled maps

### Fixed
- Auto-detect `premultipliedAlpha` from atlas pages and set it on the SkeletonRenderer, fixing incorrect blending for PMA textures (e.g. Cloud Pot)

## 2.0.1

### Changed
- minimum melonJS version is now 18.2.1 (loading screen race condition fix)

## 2.0.0

### Changed
- migrated into the melonJS monorepo
- replaced rollup build with esbuild (aligned with debug-plugin)
- bumped Spine runtime dependencies to ^4.2.108
- minimum melonJS version is now 18.2.0
- WebGL rendering now uses a custom `SpineBatcher` extending melonJS `Batcher` with indexed drawing, instead of Spine's own `PolygonBatcher` — integrates through melonJS's batcher system (`setBatcher("spine")`)
- SpineBatcher uses Spine's official two-color tinting shader (`Shader.newTwoColoredTextured`) and attribute names
- blend modes now delegate to melonJS `renderer.setBlendMode()` with premultiplied alpha support
- canvas `SkeletonRenderer` refactored: extracted `drawRegion()`, `drawMesh()`, `drawTriangle()` methods from monolithic `draw()`
- `AssetManager` cleaned up: renamed `asset_manager` to `spineAssetManager`, added `dispose()`, fixed JSDoc
- source reorganized: `index.js` is the proper entry point, `Spine.js` is the renderable, `SpinePlugin.js` is the plugin registration
- `SpinePlugin.js` renamed from `index.js` for clarity

### Fixed
- use `setBatcher`/`currentBatcher` instead of deprecated `setCompositor`/`currentCompositor`
- replace removed `utils.file.getPath()` with inline path extraction
- `rotate()` now always calls `super.rotate()` and returns `this` for chaining (WebGL path was missing both)
- `scale()` now applies scale to the Spine root bone as well as the melonJS transform
- `dispose()` now guards against calling WebGL-only methods on canvas renderer
- `throw "string"` replaced with `throw new Error()` for proper stack traces
- `setAnimationByIndex`/`addAnimationByIndex` now use `console.warn` instead of `console.log` for errors
- canvas `drawTriangle()` now guards against degenerate triangles (zero-area UV)
- canvas mesh drawing now subtracts 1 pixel from UV dimensions to prevent edge bleeding (matches official spine-canvas)

### Added
- `SpineBatcher`: custom melonJS `Batcher` for two-color tinted Spine rendering via indexed `drawElements`
- `addAnimation(trackIndex, name, loop, delay)` method for adding queued animations by name
- `setCombinedSkin(combinedName, ...skinNames)` for mix-and-match skin combining
- `setEmptyAnimation(trackIndex, mixDuration)` for clearing animation tracks
- `findBone(boneName)` and `findSlot(slotName)` for direct skeleton access
- `addAnimationListener(listener)` and `removeAnimationListener(listener)` for animation state events (start, end, complete, event, etc.)
- `getAnimationNames()` and `getSkinNames()` for skeleton introspection
- `skeleton.update(delta)` call before `updateWorldTransform()` as required by Spine 4.2+
- canvas `SkeletonRenderer` auto-detects mesh attachments and enables `triangleRendering` only when needed
- spine example added to the monorepo examples app with character selector dropdown and debug plugin

### Removed
- redundant `getSpinePosition()`, `setSpineSize()`, `getSpineSize()` methods (use inherited `pos`, `width`, `height`)
- redundant `addAnimationByName()` (replaced by `addAnimation()`)
- old melonJS version check hack in constructor (no longer needed with >=18.2.0)
- old test/examples folder (replaced by monorepo examples)
- custom GLSL shaders (now uses Spine's official `Shader.newTwoColoredTextured`)
- manual GL state management in `resetRenderer()`/`enableRenderer()`/`end()` (replaced by melonJS batcher system)

## 1.5.0 - 2023-09-23

- fix the `addAnimation()` method not returning the corresponding set TrackEntry
- fix the base renderable `flip[X/Y]` method when used/applied to the Spine renderable
- add a `isCurrentAnimation()` method that returns true if the given name is corresponding to the current track current animation
- expose the `currentTrack` property to access the corresponding current animation track entry
- clarify in the readme that the current plugin support both the 4.1 and 4.2-beta Spine runtime versions
- the spine-plugin now requires to be properly registered using `me.plugin.register(SpinePlugin);`
- the spine-plugin now requires melonJS v15.12.0 or higher
- add check for minimum melonJS version when the plugin is registered
- restructure code to adhere to the updated plugin API and get a proper reference to the melonjs renderer instance

## 1.4.0 - 2023-09-05

- add support for loading spine assets through the melonJS preloader (see README)
- add inline documentation for the Spine class, properties and methods
- console now display both the plugin and spine runtime versions

## 1.3.0 - 2023-08-28

- add support for Mesh Attachement
- added more examples under the test folder and separated them into individual files
- add a fullscreen option to examples (pressing the "F" key toggles fullscreen mode)

## 1.2.1 - 2023-08-23

- code refactoring and optimization to prepare for future feature additions
- fix URLs in the package.json file

## 1.2.0 - 2023-08-22

- add support for clipping (coin example is now rendered properly)

## 1.1.0 - 2023-08-19

- add some basic debug rendering
- optimize code (remove unneeded logic)

## 1.0.0 - 2023-08-16

initial release