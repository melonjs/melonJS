# Changelog

## 2.2.1 - 2026-05-11

### Changed
- Bump bundled Spine runtimes (`@esotericsoftware/spine-canvas`, `spine-core`, `spine-webgl`) range from `^4.2.109` to `^4.2.114`. Picks up the empty-atlas hang fix in `AssetManagerBase` (4.2.113) — `loadTextureAtlas` no longer waits forever on an atlas with zero pages. No plugin API change.

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