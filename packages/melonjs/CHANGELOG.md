# Changelog

## [19.1.0] (melonJS 2) - _2026-04-16_

### Added
- WebGL: multi-texture batching — up to 16 textures (based on device capabilities) drawn in a single batch/draw call, eliminating GPU flushes on texture changes. Automatically falls back to single-texture mode when a custom `ShaderEffect` is active. ~80% fewer draw calls on the platformer example (14 vs ~70 flushes/frame), with an estimated 30-50% FPS improvement on low-end mobile devices.
- WebGL: `highPrecisionShader` application setting — when `false`, caps shader precision at `mediump` for better performance on mobile GPUs that support `highp` but run faster at `mediump`. Default `true` (auto-detect highest precision).

### Fixed
- WebGL: `getSupportedCompressedTextureFormats()` no longer crashes when the GL context is unavailable — falls back to the base renderer's empty format list
- Examples: compressed textures example updated to use `setText()`/`preDraw()`/`draw()`/`postDraw()` pattern — fixes text not rendering after `Text.draw()` standalone removal in 19.0

## [19.0.0] (melonJS 2) - _2026-04-14_

### Added
- Renderer: `drawMesh(mesh)` method on both WebGL and Canvas renderers for textured triangle mesh rendering with backface culling and depth testing
- Renderable: `Mesh` class for displaying textured 3D triangle meshes, with OBJ model loading or raw geometry data, built-in perspective projection, and standard transform API (`rotate`, `scale`, `translate`)
- Renderable: `Mesh.toCanvas()` and `Mesh.toImageBitmap()` — render the mesh at its current state to an offscreen canvas or ImageBitmap for use as a Sprite image or with `drawImage()`
- Renderable: `Mesh.toPolygon()` — compute a 2D convex hull polygon from the current projected vertices for collision shapes
- Renderable: `translate(x, y, z)` method added to Renderable for transform-based translation
- Loader: Wavefront OBJ format parser — `loader.preload({ type: "obj" })` and `loader.getOBJ(name)` for loading 3D model geometry (vertices, UVs, faces, quad triangulation, winding auto-correction)
- Loader: Wavefront MTL material parser — `loader.preload({ type: "mtl" })` and `loader.getMTL(name)` for loading material properties (diffuse texture, diffuse color, opacity)
- Math: `Matrix3d.perspective(fov, aspect, near, far)` — generate a perspective projection matrix
- Math: `Matrix3d.toMatrix2d(out?)` — extract the 2D affine components from a 4x4 matrix
- Math: vertex utilities in `src/math/vertex.js` — `normalizeVertices()`, `projectVertices()`, `convexHull()`
- WebGL: `MaterialBatcher` base class for textured batchers, shared by `QuadBatcher` and `MeshBatcher` (texture create/bind/upload/delete)
- WebGL: `MeshBatcher` for indexed triangle mesh rendering with chunked buffer management for large models
- WebGL: `IndexBuffer.addRaw(indices)` for adding pre-computed absolute indices without rebasing
- Canvas: degenerate UV triangle support — solid color fill sampled from texture for color-palette models (e.g. Kenney)
- WebGL: 15 built-in `ShaderEffect` presets for per-sprite visual effects — `FlashEffect`, `OutlineEffect`, `GlowEffect`, `DesaturateEffect`, `PixelateEffect`, `BlurEffect`, `ChromaticAberrationEffect`, `DissolveEffect`, `DropShadowEffect`, `ScanlineEffect` (with optional CRT curvature/vignette), `TintPulseEffect`, `WaveEffect`, `InvertEffect`, `SepiaEffect`, `HologramEffect`. All extend `ShaderEffect` and are disabled in Canvas mode.
- Renderable: `Trail` class for drawing fading, tapering ribbons behind moving objects — auto-follow or manual point mode, configurable width/gradient/lifetime, works on both WebGL and Canvas
- Gradient: `getColorAt(position, out)` — interpolate a color at any position along a gradient, useful for procedural effects
- Gradient: `destroy()` — release pooled resources held by a gradient instance
- Math: `lerpArray(values, position)` — linearly interpolate a value from an evenly spaced array at a given 0–1 position
- Math: `computeVertexNormal(points, index, out)` — compute the averaged perpendicular normal at a vertex in a 2D polyline

### Changed
- **BREAKING**: `Renderable.currentTransform` is now a `Matrix3d` (was `Matrix2d`) — enables 3D transforms on any renderable. Code that accesses `currentTransform.val` indices directly must update: translation is at `[12],[13]` (was `[6],[7]`)
- **BREAKING**: `Matrix3d.scale(x, y, z)` default `z` changed from `0` to `1` — prevents accidental Z-axis flattening
- **BREAKING**: `Matrix3d.rotate(angle, v)` axis parameter is now optional, defaults to Z axis — 2D rotation works without specifying an axis
- **BREAKING**: `Matrix2d.fromMat3d()` now extracts translation from indices `[12],[13]` (was `[8],[9]`) — correctly converts 4x4 translation to 2D affine
- **BREAKING**: `Matrix3d.multiply()` now accepts both `Matrix3d` and `Matrix2d` — Matrix2d is promoted to 4x4 inline, no temporary copy needed
- **BREAKING**: `Matrix3d.rotate()` returns `this` instead of `null` on zero-length axis vector — safe for method chaining
- `RenderState` save/restore stack uses `Matrix3d` (was `Matrix2d`)
- `Camera2d.invCurrentTransform` is now `Matrix3d` (was `Matrix2d`)
- `Renderable.rotate(angle, v)` defaults to Z axis when no axis given (same 2D behavior)
- `Renderable.scale(x, y, z)` defaults z to 1 (preserves Z dimension)
- `QuadBatcher` and `MeshBatcher` now extend `MaterialBatcher` (was `Batcher`) — eliminates ~180 lines of duplicated texture management code
- WebGL context always created with `depth: true` for hardware depth buffer support (used by 3D mesh rendering)
- WebGL renderer `setBatcher()` now syncs the projection matrix to the new batcher
- **BREAKING**: `Text.draw()` and `BitmapText.draw()` no longer accept `text`, `x`, `y` parameters — standalone draw without a parent container is removed (deprecated since 10.6.0)
- **BREAKING**: `Text.measureText()` no longer takes a `renderer` parameter (was unused)
- **BREAKING**: `UITextButton` settings `backgroundColor` and `hoverColor` removed — use `hoverOffColor` and `hoverOnColor` instead
- **BREAKING**: `Tween` no longer adds itself to `game.world` — uses event-based lifecycle (`TICK`, `GAME_AFTER_UPDATE`, `STATE_PAUSE`, `STATE_RESUME`, `GAME_RESET`) instead. Public API unchanged. `isPersistent` and `updateWhenPaused` properties still supported.
- **BREAKING**: removed `depthTest` application setting and `DepthTest` type — GPU depth sorting is incompatible with 2D alpha blending and the painter's algorithm. The `"z-buffer"` option never worked correctly for 2D sprites. Depth testing remains available internally for 3D mesh rendering only (`drawMesh`).
- Container: `sortOn` is now a getter/setter that caches the comparator function — avoids string lookup on each sort call
- Container: sort comparators simplified — removed legacy null guards (children always have `pos`)
- Renderer: `customShader` property moved to base `Renderer` class — `Renderable.preDraw`/`postDraw` no longer check renderer type via `renderer.gl`
- WebGL: `clear()` no longer clears the depth buffer (only used by `drawMesh` which clears it locally)

### Fixed
- Geometry: `Rect.setSize()` now calls `updateBounds()` — fixes a regression from July 2024 (`4d185c902`) where replacing `Rect.setShape()` with `pos.set()` + `setSize()` during the TypeScript conversion left bounds stale, causing pointer event broadphase lookups to use `(0,0)` instead of the actual pointer position (see #817)
- WebGL: depth buffer now correctly used for 3D mesh rendering with `gl.LESS` depth function
- Canvas: backface culling corrected for Y-flipped screen space (was culling front faces instead of back)
- Canvas: triangle seam expansion (0.5px) to cover anti-aliasing gaps between adjacent triangles
- Canvas: painter's algorithm depth sorting for back-to-front triangle rendering

## [18.3.0] (melonJS 2) - _2026-04-07_

### Added
- Renderer: `bezierCurveTo()`, `quadraticCurveTo()`, and `arcTo()` path methods — draw cubic and quadratic Bezier curves, matching the Canvas 2D API. Canvas renderer uses native context methods, WebGL renderer tessellates via Path2D.
- Renderer: `setLineDash()` and `getLineDash()` methods — set dash patterns for stroke operations, matching the Canvas 2D API. Works on both Canvas and WebGL renderers. Dash state is saved/restored with `save()`/`restore()`.
- Renderer: `createLinearGradient()` and `createRadialGradient()` methods — create gradient fills that can be passed to `setColor()`, matching the Canvas 2D API. Works on both Canvas and WebGL renderers with all fill methods (`fillRect`, `fillEllipse`, `fillArc`, `fillPolygon`, `fillRoundRect`). Gradient state is saved/restored with `save()`/`restore()`.
- Tiled: extensible object factory registry for `TMXTileMap.getObjects()` — object creation is now dispatched through a `Map`-based registry (like `loader.setParser`), with built-in factories for text, tile, and shape objects, plus class-based factories for Entity, Collectable, Trigger, Light2d, Sprite, NineSliceSprite, ImageLayer, and ColorLayer
- Tiled: new public `registerTiledObjectFactory(type, factory)` and `registerTiledObjectClass(name, Constructor)` APIs allowing plugins to register custom Tiled object handlers by class name without modifying engine code
- Tiled: `detectObjectType()` now checks `settings.class` and `settings.name` against the factory registry before falling through to structural detection, enabling class-based dispatch for custom types

### Changed
- Application: `new Application(width, height, options)` now auto-calls `boot()` if the engine hasn't been initialized, making it a valid standalone entry point
- Application: `boot()` moved to `system/bootstrap.ts` — decoupled from `index.js`
- Application: `game` singleton decoupled from barrel `index.js` — internal modules no longer import from the barrel
- Application: new `canvas` getter, `resize()`, and `destroy()` convenience methods
- Application: `GAME_INIT` event now passes the Application instance as parameter
- Stage: `onResetEvent(app, ...args)` now receives the Application instance as first parameter, followed by any extra arguments from `state.change()`
- Stage: `onDestroyEvent(app)` now receives the Application instance as parameter
- Container: default dimensions are now `Infinity` (no intrinsic size, no clipping) — removes dependency on `game.viewport`. `anchorPoint` is always `(0, 0)` as containers act as grouping/transform nodes
- ImageLayer: decoupled from `game` singleton — uses `parentApp` for viewport and renderer access; `resize`, `createPattern` and event listeners deferred to `onActivateEvent`
- TMXTileMap: `addTo()` resolves viewport from the container tree via `getRootAncestor().app` instead of `game.viewport`
- Input: pointer and pointerevent modules now receive the Application instance via `GAME_INIT` event instead of importing the `game` singleton
- video: `video.renderer` and `video.init()` are now deprecated — use `new Application(width, height, options)` and `app.renderer` instead. `video.renderer` is kept in sync via `VIDEO_INIT` for backward compatibility
- EventEmitter: native context parameter support — `addListener(event, fn, context)` and `addListenerOnce(event, fn, context)` now accept an optional context, eliminating `.bind()` closure overhead and enabling proper `removeListener()` by original function reference
- EventEmitter: `event.on()` and `event.once()` no longer create `.bind()` closures when a context is provided

### Fixed
- Path2D: fix `quadraticCurveTo()` and `bezierCurveTo()` using a reference to `startPoint` instead of capturing coordinates — `lineTo()` mutates `startPoint` on each call, causing the curve to deform as it was tessellated. Captured `lx`/`ly` values instead.
- Path2D: fix `quadraticCurveTo()` and `bezierCurveTo()` segment count — was using `arcResolution` directly (2 segments), now computes adaptive segment count based on control polygon length for smooth curves.
- Text: fix textBaseline y offset for multiline text — "bottom"/"middle" used single line height instead of total text height, causing misaligned bounding boxes
- BitmapText: fix bounds offset direction for textAlign/textBaseline — bounds were shifted in the wrong direction for "right"/"center"/"bottom"/"middle"
- BitmapText: fix bounding box width — last glyph now uses `max(xadvance, xoffset + width)` to capture full visual extent
- BitmapText: fix bounding box height — uses actual glyph extents (`maxBottom - minTop`) instead of `capHeight` which was too short for glyphs with descenders
- BitmapText: fix baseline positioning — "middle"/"bottom"/"alphabetic"/"ideographic" shifts now use real glyph metrics and total text height, correctly centering and aligning text on baseline reference points
- BitmapText: fix bounding box y offset — box starts at first visible glyph pixel (`glyphMinTop * scale`) instead of draw origin
- BitmapText: optimize bounds calculation — precompute `glyphMinTop`/`glyphMaxBottom` once in font parsing; cache `measureText` results in `setText`/`resize` instead of recomputing on every `updateBounds`
- Camera2d: fix floating containers with Infinity bounds not rendering — containers with default `Infinity` dimensions had cleared bounds, causing `isVisible()` to return false and preventing update/draw of children (e.g., HUD elements)
- Sprite: fix `flicker()` not working with multi-camera setups — visibility was toggled per draw call (once per camera), so with 2 cameras the toggle canceled out. Now uses time-based flickering (~15 flashes/sec) that is frame-rate independent and multi-camera safe
- Application: `Object.assign(defaultApplicationSettings, options)` mutated the shared defaults object in both `Application.init()` and `video.init()` — creating multiple Application instances would corrupt settings. Fixed with object spread.
- Text/Light2d: fix invalid `pool.push` on CanvasRenderTarget instances that were never pool-registered (would throw on destroy)
- CanvasRenderTarget: `destroy(renderer)` now properly cleans up WebGL GPU textures and cache entries (previously leaked in Light2d)
- Text: always use power-of-two texture sizes for offscreen canvas (removes WebGL version check dependency)
- Application: prevent white flash on load by setting a black background on the parent element when no background is defined
- WebGLRenderer: `setBlendMode()` now tracks the `premultipliedAlpha` flag — previously only the mode name was checked, causing incorrect GL blend function when mixing PMA and non-PMA textures with the same blend mode
- TMX: fix crash in `getObjects(false)` when a map contains an empty object group (Container.children lazily initialized)
- Container: fix `updateBounds()` producing NaN when container has Infinity dimensions (skip parent bounds computation for non-finite containers, derive bounds from children only)
- Container: fix circular import in `BitmapTextData` pool registration (`pool.ts` ↔ `bitmaptextdata.ts`)
- EventEmitter: `removeAllListeners()` now correctly clears once-listeners (previously only cleared regular listeners)
- Loader: fix undefined `crossOrigin` variable in script parser, unsafe regex match in video parser, missing error parameter in video/fontface error callbacks, `fetchData` Promise constructor antipattern and silent error swallowing

### Chore
- Converted `index.js` to `index.ts` — no internal modules import from the barrel anymore
- Minimum Node.js version is now 24.0.0 (Node 18/20 EOL, Node 22 in maintenance)
- CI: upgrade to Node.js 24 and pnpm/action-setup v5
- TypeScript: 5.9 → 6.0 (added explicit `rootDir` to all tsconfig.build.json)
- ESLint: 9.x → 10.x (fixed all `no-useless-assignment` errors across the codebase)
- Biome: 2.3 → 2.4
- Updated vitest, turbo, eslint-plugin-jsdoc, typescript-eslint, typedoc, type-fest, vite, react-router-dom to latest versions
- Examples: lazy-load all example components via React.lazy() for code splitting (main bundle 1286 KB → 427 KB)
- Examples: fix ace editor loading order and initial content display in "Show Code" panel
- Fix missing README on the npm release (copy root README during `pnpm dist`)
- Add VertexArrayBuffer unit tests for `push()` and `pushFloats()`

## [18.2.1] (melonJS 2) - _2026-03-29_

### Fixed
- Loader: fix race condition where the default loading screen logo sprite could persist after preloading completes, caused by the async logo image loading finishing after the state transition or `game.world.reset()`

## [18.2.0] (melonJS 2) - _2026-03-29_

### Added
- Camera2d: added proper multi-camera support
- Platformer example: minimap camera showing a zoomed-out view of the full level with viewport highlight and player marker
- TMX: support Tiled 1.8 native `repeatx`/`repeaty` attributes on image layers (with fallback to legacy custom `repeat` property)
- TMX: support Tiled 1.8 `parallaxoriginx`/`parallaxoriginy` map attributes
- TMX: support Tiled 1.8 class-type custom properties (`type="class"` with nested properties)
- TMX: support Tiled 1.9 tile sub-rectangles (`x`, `y`, `width`, `height` on `<tile>` elements for defining sub-regions within a tileset image)
- TMX: support Tiled 1.9 `tilerendersize` and `fillmode` tileset attributes for controlling how oversize tiles render relative to the map grid
- TMX: support Tiled 1.10 `isCollection` tileset flag when available (fallback to image detection for older maps)
- TMX: support Tiled 1.11 embedded base64 images on tilesets (including per-tile collection images) and image layers (TMX/XML; JSON via `imagedata` property)
- TMX: support Tiled 1.12 oblique map orientation (`orientation="oblique"` with `skewx`/`skewy` attributes)
- TMX: support Tiled 1.12 capsule object shape (`<capsule/>` in XML, `capsule: true` in JSON) via polygon-approximated `RoundRect`
- TMX: support Tiled 1.12 list/array custom properties (`type="list"` with typed `<item>` elements in XML, array of `{type, value}` in JSON)
- TMX: support Tiled 1.12 per-object opacity and visibility
- TMX: support Tiled 1.12 layer blend modes (`mode` attribute on tile layers, image layers, and object groups)
- RoundRect: can now be used as a collision shape — extends Polygon directly with polygon-approximated rounded corners for accurate SAT collision (previously treated as a plain rectangle)
- Batcher: support configurable `maxVertices` via `settings.maxVertices` (default 4096)
- Batcher: support optional indexed drawing via `settings.indexed` — creates own VBO and dynamic `IndexBuffer` with `addIndices()` method
- Batcher: support configurable projection matrix uniform name via `settings.projectionUniform` (default `"uProjectionMatrix"`) — enables use of third-party shaders (e.g. Spine's `u_projTrans`)
- IndexBuffer: refactored to support both static quad patterns (`fillQuadPattern`) and dynamic stream drawing (`add`/`upload`/`clear`)
- VertexArrayBuffer: new `pushFloats()` method for variable-length all-float vertex data (used by custom batchers with non-standard vertex formats)
- CanvasRenderer: add support for additional CSS blend modes (`overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`) when supported by the browser
- WebGLRenderer: add `darken` and `lighten` blend modes via `gl.MIN`/`gl.MAX` (WebGL2 only)

### Changed
- TypeScript: convert leaf modules to TypeScript — plugin, camera, particles emitter, state, audio
- TypeScript: convert application, input, and UI modules to TypeScript — application, header, resize, input, pointer, pointerevent, gamepad, uibaseelement, uispriteelement, uitextbutton

### Fixed
- WebGLRenderer: `setBatcher()` now rebinds the shared vertex buffer when switching batchers, allowing custom batchers with their own GL buffers to integrate without manual cleanup
- WebGLRenderer: `setBlendMode()` now accepts a `premultipliedAlpha` parameter (default `true`) for correct blending with non-premultiplied textures; removed internal `gl`/`context` parameter from both WebGL and Canvas renderers
- Renderer: add base `setBlendMode()` and `GPURenderer` property to fix TypeScript `as any` casts in `header.ts` and `resize.ts`
- Plugin: `plugin.register()` now uses `pluginClass.name` for name derivation, fixing class name extraction when bundlers strip class names
- TMXTileset: fix animation key using first frame tileid instead of the tile's own id
- CanvasRenderer: replace bezier ellipse approximation with native `context.ellipse()` (with polyfill for older browsers)
- Plugin: fix `plugin.get()` throwing `TypeError` when searching by name with no match (instanceof on string)
- Events: fix duplicate `BLUR` entry in Events interface (was missing `FOCUS`)
- UIBaseElement: fix `isDraggable` JSDoc (was incorrectly saying "clicked"), fix `released` default (was `false`, should be `true`)
- UITextButton: fix `bindKey` settings type from `string` to `string | number`
- Application: fix constructor `options` parameter not being optional
- Application: fix `getUriFragment()` unsafe cast by making `url` parameter optional
- CanvasRenderer: `setProjection()` now properly applies the projection matrix as a canvas 2D transform

## [18.1.0] (melonJS 2) - _2026-03-23_

### Added
- Loader: fontface assets now support `baseURL` — font paths are resolved consistently with other asset types
- TextureAtlas: new `getAnimationSettings()` method for extending Sprite with texture atlas animations
- TMX: automatically decompose concave collision polygons into convex triangles using earcut triangulation, instead of throwing an error
- Ellipse: add rotation and matrix transform support (#583, #771)
- Ellipse: proper SAT collision detection for non-circular ellipses via polygon approximation (#584)
- WebGLRenderer: compressed texture support — DDS (DXT1/DXT3/DXT5/BC7), KTX v1, KTX2, PVR (PVRTC/S3TC/ETC1), and PKM (ETC1/ETC2) parsers (#1182)
- Loader: image asset fallback chains — provide an array of sources (e.g. compressed texture formats by priority, with a PNG fallback) and the loader will try each in order until one succeeds
- Renderer: new `RenderState` class with pre-allocated save/restore stacks for zero-allocation state management
- WebGLRenderer: `lineWidth` now works for all primitive drawing methods via a proper shader-based implementation (#999)
- WebGLRenderer: new `ShaderEffect` class — simplified custom shader API that only requires a fragment `apply(color, uv)` function, with automatic vertex shader and texture sampling boilerplate. Silently disabled in Canvas mode.

### Changed
- Physics: collision response is now mass-proportional — when two dynamic bodies collide, overlap and velocity correction are split based on relative mass
- Entity: deprecated in favor of Sprite/Renderable + Body (#1008)
- TMX: refactor TMXUtils into reusable `src/utils/decode.ts` and `src/utils/xml.ts` modules; modernize property coercion, XML normalization, and tileset iteration
- WebGLRenderer: `Compositor`, `QuadCompositor`, and `PrimitiveCompositor` are now deprecated in favor of `Batcher`, `QuadBatcher`, and `PrimitiveBatcher`
- WebGLRenderer: `currentCompositor`, `compositors`, `addCompositor()`, `setCompositor()` are now deprecated in favor of `currentBatcher`, `batchers`, `addBatcher()`, `setBatcher()`
- WebGLRenderer: `settings.compositor` is deprecated in favor of `settings.batcher`
- Loader: modernize asset loading with Promise-based completion, improving parallel loading performance
- Loader: `onload`, `onProgress`, and `onError` properties are now deprecated in favor of `LOADER_COMPLETE`, `LOADER_PROGRESS`, and `LOADER_ERROR` events

### Fixed
- TMX: fix hexagonal renderer `pixelToTileCoords` mutating internal centers array on every call
- TMX: fix default collision shape using map dimensions instead of object dimensions in `getObjects()`
- TMX: fix `heigth` typo in TMXLayer canvas renderer options
- TMX: fix canvas memory leak in TMXLayer — canvasRenderer kept for reuse on deactivation
- TMX: reduce GC pressure — replace `new Vector2d()` with pool allocations and `clone()` with `vector2dPool.get().setV()` across all TMX renderers
- WebGLRenderer: fix `drawVertices` and `#expandLinesToTriangles` mutating input vertex objects, causing polygon geometry corruption across frames
- WebGLRenderer: fix `restore()` not re-applying the GL scissor rectangle when restoring a state with active scissor test
- Decode: fix CSV decoding skipping newlines after the first one
- Path2D: fix SVG arc (`A` command) parsing in `parseSVGPath` — correct endpoint-to-center parameterization and maintain path continuity (#1198)
- Path2D: fix `ellipse()` rotation bug where the starting point was not transformed by the rotation angle
- CanvasRenderer: fix `stroke()`/`fill()` not rendering paths built via `path2D.parseSVGPath()`
- Renderer: fix `PrimitiveCompositor.drawVertices()` ignoring the `vertexCount` parameter
- Texture: fix tint cache bug where `Map.set()` return value was incorrectly used as the inner cache map, causing duplicate tinted images to be created
- TMX: fix crash when loading XML maps due to missing node type guard in the XML parser
- Sprite: fix body-renderable misalignment when using `createAnimationFromName()` with trimmed TexturePacker atlas frames (#1201)
- Sprite: fix visual "vibration" on flip with trimmed atlas frames — stable dimensions and anchor across all frames (#1214)
- Sprite: fix sprite jumping on rotated atlas frames — trim offset now applied after rotation with correct coordinate transform
- Entity: auto-inherit renderable's anchorPoint when entity anchor is at default (0,0), aligning body and sprite centers
- WebGL: flush and rebatch when texture units are exhausted instead of throwing (#1280)
- WebGLRenderer: `setAntiAlias()` now controls GL texture filtering (`GL_NEAREST` vs `GL_LINEAR`) on all bound textures (#1279)
- Renderer: fix `setAntiAlias()` in `resize.js` passing the rendering context instead of a boolean, corrupting `settings.antiAlias` on every resize
- WebGLRenderer: `createPattern()` now cleans up previous GPU texture when repeat mode changes (#1278)
- WebGLRenderer: fix custom shader support — properly flush and restore default shader per draw call, fix `setUniform` using wrong GL program, reset sampler uniform on shader switch
- WebGLRenderer: fix uniform setter appending extra `v` suffix for vec/mat types

### Performance
- Path2D: replace `Math.pow()` with inline multiplication in quadratic/cubic Bézier and arc interpolation
- Collision: replace array `push()`/`pop()` with index-based pool access in SAT collision detection
- Container: replace `concat()` with accumulator pattern in `getChildByProp()` and `getChildByType()` to avoid O(n²) array copying in deep hierarchies
- QuadTree: replace temporary array allocation with in-place compaction during node splits
- Renderer: replace `forEach` with `for` loop in `PrimitiveCompositor.drawVertices()`
- TMX: optimize map loading pipeline (~20-40% faster) via tileset lookup caching, pre-allocated decode buffers, closure-free iteration, and a fast path for base64 tile data
- WebGLRenderer: `strokeRect` and `strokePolygon` now use a single `drawVertices` call instead of per-edge `strokeLine` calls for thick lines
- WebGLRenderer: `fillRect` now pushes 2 triangles directly, bypassing path2D and earcut triangulation
- WebGLRenderer: round join circles for thick-line corners are now batched into a single `drawVertices` call
- WebGLRenderer: remove redundant `setCompositor` call in `stroke()` when dispatching to shape-specific methods
- WebGLRenderer: `fillEllipse` and `fillArc` now use direct triangle fan geometry, bypassing path2D and earcut
- WebGLRenderer: `fillRoundRect` now generates composite geometry (3 rects + 4 corner fans) directly, bypassing earcut
- WebGLRenderer: `fillPolygon` now uses `Polygon.getIndices()` cached earcut results instead of rebuilding the path each frame
- WebGLRenderer: skip redundant `gl.uniform1i` sampler call in `QuadCompositor.addQuad()` when consecutive quads share the same texture unit
- WebGLRenderer: replace per-frame `clone()`/`push()`/`pop()` allocations in save/restore with zero-allocation `RenderState` stacks
- WebGLRenderer: switch quad rendering from `gl.drawArrays` (6 vertices per quad) to `gl.drawElements` with a static index buffer (4 vertices + 6 indices per quad), reducing vertex data by 33%
- WebGLRenderer: increase vertex batch size from 256 (64 quads) to 4096 (1024 quads), reducing draw calls for sprite-heavy and tile-heavy scenes


## [18.0.0] (melonJS 2) - _2026-03-10_

### Added
- Chore: new GitHub Workflow for running the tests (@hornta)
- Chore: new GitHub Workflow for doc generation and publishing (@hornta)
- Color: Color constructor now also accepts another Color object as paramater
- Renderer: new `backgroundColor` property allowing to change the color when clearing the background between frames

### Fixed
- Docs: fix `floating` default shown for `UIBaseElement` and `UISpriteElement` (@SergioChan)
- Body: fix `setCollisionType()` not accepting numeric collision type values
- Body: fix `setVertices()` fallback creating a Point instead of a Polygon for non-polygon shapes
- Camera: fix `moveTo()` upper bound clamping allowing the camera to scroll past the world edge
- Camera: fix `focusOn()` double-counting target position and not centering the camera viewport
- CanvasRenderTarget: fix arguments passed to `convertToBlob()` (@hornta)
- Container: fix `addChildAt()` rejecting valid index equal to children length
- Container: fix `getNextChild()` returning the previous child instead of the next one
- Container: fix `removeChildNow()` crash when container is not attached to root
- Physics: fix persistence for child bodies during world reset (@Vareniel)
- Physics: fix collision response velocity projection to properly cancel movement into collision surfaces
- Physics: fix shapes tunneling through polyline segment junctions by resolving all overlapping shapes per body pair (fix sprite going through polyline shapes in the isometric rpg example)
- Physics: fix `step()` crash when a body's ancestor is undefined
- Renderable: fix Light2D objects color blending when using the Canvas Renderer (@Vareniel)
- TypeScript: fix missing `OffscreenCanvas` argument type for the TextureAtlas constructor
- Video: fix implicit global reference to HTMLVideoElement

### Performance
- Collision: use a pre-built lookup table for SAT function dispatch
- Collision: reduce overhead in the collision detection hot path
- Container: cache camera references outside the per-child update loop
- Physics: reduce iteration overhead in `world.step()`
- QuadTree: reduce array allocations in `retrieve()` and `insert()`

### Changed
- Chore: replaced rollup by esbuild for the build process (@hornta)
- Chore: replaced webdoc with typedoc (@hornta)
- Chore: replaced mocha and puppeteer with vitest (@hornta)
- Chore: deprecated classes and methods from version 15 and lower have been removed (see https://github.com/melonjs/melonJS/wiki/Upgrade-Guide)
- Math: namespace `Math` is now deprecated and renamed to `math` for better consistency with the rest of the API.
- Renderable: the `anchorPoint` property now used the lighter `ObservablePoint` class instead of `ObservableVector2d`.

## [17.4.0] (melonJS 2) - _2024-06-22_

### Added
- Renderer: new `lineJoin` property to set the line join style (only support "round" for now in WebGL mode)
- Renderer: add support for line thickness for `strokePolygon` and `strokeRect` operations in WebGL

### Changed
- Chore: Update to TypeScript 5.5

### Fixed
- Renderer: fix `fillEllipse()` method in WebGL mode (that was stroking the ellipse instead)
- TypeScript: fix most (if not all) missing declarations

## [17.3.0] (melonJS 2) - _2024-06-04_

### Added
- Renderer: add support for line thickness when using `strokeLine()` in WebGL

### Changed
- Renderer: the `setLineWidth()` method is now deprecated and replaced by a `lineWidth` class property

### Fixed
- Renderer: fix animation when using multi-texture atlas in WebGL mode
- TMX: fix tsx file type import when using a React / Vue build step (thanks @customautosys)
- Typedef: fix missing definition for `video.init()` settings parameter, and `Application` constructor parameter

## [17.2.0] (melonJS 2) - _2024-04-22_

### Added
- Audio: add missing optional id parameter to 3D / Spatial audio methods
- Core: add platform detection if running as a standalone web app
- Loader: add missing `unload` implementation for font assets

### Fixed
- Loader: properly return an error when attempting to load FontFace assets on non-browser platforms
- Renderer: fix a regression when a global canvas is available (e.g. webapp adapter for wechat)
- Renderer: fix a regression when forcing WebGL1 rendering mode (leading to an exception)
- Renderer: fix a regression when using the canvas rendering mode where antialias setting was not being applied on cached tinted elements

### Chores
- Update to eslint 9

## [17.1.0] (melonJS 2) - _2024-03-29_

### Added
- Audio: added/exposed 3D Spatial Audio method (`stereo()`, `position()`, `orientation()` and `panner()`)
- Loader: image resources can now take an array of `src` urls with different format (preparing for later usage)
- Math: added a `isPowerOfFour()` method
- Renderer: new `renderTarget` property specifying the default `CanvasRenderTarget` to use when rendering

### Changed
- Renderer: `CanvasTexture` is now deprecated and replaced by a new `CanvasRenderTarget` class

### Fixed
- Core: prevent multiple temporary canvas creation when calling `isWebGLSupported` multiple times

## [17.0.0] (melonJS 2) - _2024-03-05_

### Added
- Sprite: add support for aseprite texture atlas (including animation)
- Atlas: `createSpritefromAnim` parameter is now optional, and if not defined will use all defined index in the corresponding atlas
- Loader: new `setOptions` method that allows specifying custom settings to be applied to fetch requests (crossOrigin, withCredentials, etc..)

### Changed
- Loader: loader settings such as `crossOrigin` and `withCredentials` are now deprecated and have to be set through the `setOptions` method

### Fixed
- Doc: fix hyperlinks to source code within documentation (thanks @Waltibaba)
- Loader: fix settings for the fetch request not being applied in ES6 builds (thanks @B0sh)

## [16.1.2] (melonJS 2) - _2024-02-12_

### Fixed
- Renderable: fix Light2d renderables not always triggering a screen refresh
- Plugin: fix version comparaison once and for all using the official semver package

## [16.1.1] (melonJS 2) - _2024-02-06_

### Fixed
- Loader: fix an issue where some mobile browser (e.g. safari) would not emit the canplay event for video assets if autoplay is disabled

## [16.1.0] (melonJS 2) - _2024-02-06_

### Added
- Loader: add optional `autoplay` and `loop` parameters when `[pre]loading` audio and video assets (`false` by default)
- Loader: add support for loading/preloading of HTMLVideoElement
- Sprite: HTMLVideoElement can now be passed as a source when creating Sprite object

## [16.0.0] (melonJS 2) - _2024-02-03_

### Added
- Path2d: preliminary SVG path parsing to the Path2D class (WIP)

### Changed
- Chore: update to npm 10, Node.js 20 and friends
- loader: replaced XHR by Fetch for assets preloading (thanks @Edwardscb)
- Renderer: fix `toBlob`, `toDataURL` and `toImageBitmap` method signature to better match with the W3C API

## [15.15.0] (melonJS 2) - _2023-11-20_

### Added
- Renderable : new `parentApp` getter that returns the parent application/game instance to which a renderable belongs to.

### Fixed
- ImageLayer: fix a regression when loading a level within a sub container (thanks @rcl)

## [15.14.0] (melonJS 2) - _2023-10-17_

### Added
- loader: prevent loading of previously loaded resources. e.g. duplicated resources across mutliple manifest (thanks @z0mb1)
- loader: add handling of asset load error, enabling to retry loading failed assets (thanks @z0mb1)

### Changed
- UI: small optimization when rendering BitmapText

## [15.13.0] (melonJS 2) - _2023-10-07_

### Changed
- UI: UITextButton `backgroundColor` and `hoverColor` properties are now deprecated in favor of `hoverOffColor` and `hoverOnColor`

### Fixed
- UI: fix duplicated text rendering in UITextButton
- UI: fix an exception when destroying a UITextButton

## [15.12.0] (melonJS 2) - _2023-09-23_

### Added
- Renderer: add proper `width` and `height` (getter/setter) properties and deprecate `getHeight()` and `getWidth()`

### Changed
- Audio: update howler.js to version 2.2.4

## [15.11.0] (melonJS 2) - _2023-09-15_

### Added
- plugin: the `BasePlugin` class now holds a reference to the app or game instance that registered the plugin
- plugin: new `plugin.get()` method to retrieve a plugin instance by its Class Type or registered name

## [15.10.0] (melonJS 2) - _2023-09-05_

### Added
- utils: new file `getPath()` method that return the path element of a full file path

### Changed
- Chore: new "docs" directory where production documentation is generated, and properly published using Github Workflows
- Chore: update NPM dependencies

### Fixed
- Loader: fix the `setParser()` method not being exported (and therefore preventing from using and setting custom parser) 

## [15.9.2] (melonJS 2) - _2023-08-28_

### Fixed
- Renderer: fix the Canvas Renderer `setMask()` method ignoring the default path when no argument is passed
- Geometries: fix missing `type` property for all geometry and use internally for type checking instead of relying on `instanceof`

## [15.9.1] (melonJS 2) - _2023-08-24_

### Fixed
- Geometry: add default parameters to the `Polygon` constructor, allowing to instantiate "empty" polygons
- TMX: fix CanvasRenderer option typo when using TMXLayer pre-rendering option (thanks @0o001)
- TypeScript: fix missing parameter for `setMask()` in the parent `Renderer` class

## [15.9.0] (melonJS 2) - _2023-08-16_

### Added
- Input: new `hasActiveEvents` returning true if there are any pending events in the queue
- Input: new `hasRegisteredEvents` returning true if there are registered pointer event listeners
- Physic: new `WORLD_STEP` event emmitted after the builtin physic world has been updated (if enabled)
- Renderer: fix/enable batching for all ellipse & arc(To) WebGL stroke operations
- Renderer: the `setTransform` and `transform()` methods now also accept individual components to match the CanvasRenderingContext2D API
 
### Fixed
- Plugin: add missing deprecation warning for `plugin.Base` (deprecated since [15.1.6] and replaced by `BasePlugin`)

### Changed
- Physic: split the world update method into a separate step for clearer code when using custom update logic.

## [15.8.0] (melonJS 2) - _2023-07-29_

### Added
- Doc: add proper documentation and example for Renderer drawing-related APIs
- Physic: new `physic` flag allowing to disable the builtin physic implementation
- Renderer: new TextureCanvas `invalidate()` method to force reuploading the corresponding WebGL Texture

### Fixed
- Doc: fix missing default `game` application instance
- Renderer: properly deallocate and reallocate texture unit after a texture deletion in WebGL rendering mode

## [15.7.0] (melonJS 2) - _2023-07-19_

### Added
- Color: new `setFloat` method allowing to specify RGBA components in a normalized float format

### Fixed
- Renderer: fix how alpha and globalAlpha values are applied in the Canvas Renderer to match with WebGL
- TypeScript : fix loader.Asset definition typings (causing an error with the Vite-Typescript boilerplate)

## [15.6.0] (melonJS 2) - _2023-07-18_

### Added
- Audio: expose the audio `load` method in the documentation and typings
- Loader: melonJS now dynamically assign parser/preload functions to known asset types
- Loader: add the possibility to specify a user defined parser/preload function for a given asset type
- Renderable: new `depth` getter/setter that will returns the depth of a renderable on the z axis
- Renderer: the default renderer instance is now passed as parameter when emitting the global `VIDEO_INIT` event
- Renderer: add path like methods (`beginPath`, `lineTo`, `moveTo`, `rect`, `roundRect`, `closePath`, `fill` and `stroke`)

### Changed
- Geometry: optimize Path2d triangulation by only recalculating all triangles when the path is modified

### Fixed
- Core: fix some leftover direct global references to `document` (now using `globalThis.document`)
- Geometry: fix consecutive Path2d line stroke in WebGL mode

## [15.5.0] (melonJS 2) - _2023-07-13_

### Changed
- Color: optimize conversion function such as `toHex` and `toUint32`
- Geometry: optimize circle/ellispe creation and recycling
- Renderable: revert previous changes on the flip[X/Y] optimization since it's causing backward compatibility issue

### Fixed
- Doc: fix multiple incorrect `@type` tags across the API
- Doc: fix `ImageLayer` extending `Sprite` and not `Renderable`
- Doc: fix missing `fillStyle` and `StrokeStyle` properties for `Text` elements
- Physic: fix a potential memory leak when recalculating a polygon edges and normals
- TypeScript: fix missing typings for `Vector[2d/3d]` `x`, `y` and `z` properties
- TypeScript: fix typings for Array parameter type

## [15.4.1] (melonJS 2) - _2023-06-24_

### Fixed
- Audio : fix a TypeScript definition issue introduced in the previous version (on the audio `init` method)

## [15.4.0] (melonJS 2) - _2023-06-24_

### Added
- Application: new `pauseOnBlur`, `resumeOnFocus` and `stopOnBlur` properties to configure a game behavior on blur and focus events

### Changed
- Core: visibility and focus/blur events are now managed internally through new global `BLUR` and `FOCUS` events
- Device: `pauseOnBlur`, `resumeOnFocus` and `stopOnBlur` properties are now deprecated and replaced by their Application counterpart
- Geometry: optimize Rect `contains` method by using typeof instead of instanceof to identify given parameter type

### Fixed
- Renderable : fix a potential issue with a Tile Layer not being properly redrawn when adding or clearing individual tiles
- TMX : properly set the `preRender`flag for Tiled layer at runtime (when added to the root container)
- TMX : fix pre-rendering for non-orthogonal maps
- UI: fix dirty flag for base UI elements not being set due to wrong property name (thanks @yuta0315)

## [15.3.0] (melonJS 2) - _2023-05-23_

### Added
- Renderer: new `scaleTarget` that allows to specify which HTML element to be used as reference when scaling the canvas (thanks @johnhyde)

### Changed
- Application: world steps and rendering update are now done through a new global `TICK` event
- Application: further "decoupling" of Application, Stage and State (see #1091)
- Renderable : faster implementation of the `tint` getter/setter, and Color `copy` method

### Fixed
- doc: fix the @name value of `state.DEFAULT` (thanks @johnhyde)
- doc: fix documentation for the `TMXUtils` namespace
- Renderer: fix potential memory leak in WebGL, where the renderer was not clearing the save/restore stack upon reset
- TypeScript : fix optional arguments typings for all renderers and Application constructor

## [15.2.1] (melonJS 2) - _2023-05-14_

### Fixed
- TMX: fix a regression with the inflate patch entry point

## [15.2.0] (melonJS 2) - _2023-05-12_

### Changed
- Plugin: the `Base` plugin class is now deprecated and replaced by `BasePlugin` (`Base` is just an alias now)

### Fixed
- Typescript: fix typing for the `utils` and `plugin` API
- Utils: fix "namespace" es6 declaration and export

## [15.1.6] (melonJS 2) - _2023-05-10_

### Fixed
- TypeScript: fix typings for methods taking a renderable as argument, by enumerating all different class types

## [15.1.5] (melonJS 2) - _2023-05-05_

### Fixed
- Container: fix child bounds not being recalculated when a child is added through the `addChildAt()` method
- Container: fix container not recursively updating child bounds when `enableChildBoundsUpdate` is enabled
- Renderable: fix floating coordinates mismatch by forcing a child `floating` property to false when added to a floating container
- Renderable: fix the `isFloating` getter to also return true when a renderable is added to nested floating containers
- UI: fix initial UIBaseElement bound calculation when using nested UI containers
- UI: fix UIBaseElement container not propagating events to child objects by default

## [15.1.4] (melonJS 2) - _2023-04-26_

### Fixed
- Core: fix a regression with OffscreenCanvas support detection
- Doc: fix broken hyperlinks in the audio documentation
- TypeScript: fix documentation and typings for the loader API (thanks @edmundg)

## [15.1.3] (melonJS 2) - _2023-04-24_

- WebGL: fix a crash when creating/uploading a texture on browser(s) not supporting OffscreenCanvas

## [15.1.2] (melonJS 2) - _2023-04-24_

### Fixed
- Core: fix detection of OffscreenCanvas support by browser (fix a crash with Waterfront, thanks @fr0st for reporting it)

## [15.1.1] (melonJS 2) - _2023-04-10_

### Fixed
- Container: fix a regression when creating a container with physic bodies, before adding it to the main world container, would throw an exception

## [15.1.0] (melonJS 2) - _2023-04-07_

### Added
- Container: new `getRootAncestor()` method that returns the root container's parent (aka World Container)
- Renderer: new `toBlob()`, `toDataURL()` and `toImageBitmap()` methods added to `CanvasTexture`
- Renderer: new `toBlob()`, `toDataURL()` and `toImageBitmap()` methods added to all Renderers
- TMX: add a "patcheable" entry point to allow for a tiled inflate (zlib/gzip/zstd) plugin
- UI: new draggable feature for UIBaseElement (can be toggled on/off using `isDraggable`)

### Changed
- Application: the `sortOn` property is now a proper getter/setter for the App World instance `sortOn` property
- Plugin: the 2nd parameter of the `register` method is now optional and will use the given plugin class name by default

### Fixed
- Renderer: add missing export for the `CanvasTexture` class
- UI: fix internal holdTimeout type to integer and properly reset value to -1 when a timer is cleared
- UI: UITextButton now properly use the given alpha value of the given background and hover color
- UI: cleaned-up the UITextButton implementation, and added proper documentation for UITextButton specific properties
- WebGL: fix a Type Error exception with the latest version of Safari when using OffscreenCanvas element as a texture source

## [15.0.0] (melonJS 2) - _2023-03-18_

### Added
- Renderer: enable batch drawing for rectangle and polygon based primitive shapes
- Renderer: new base `Compositor` class that can be extended to create custom WebGL compositors
- Renderable: custom shader can now be set per renderable through a new `shader` property (experimental feature)

### Changed
- Core: remove remaining polyfills related to pre-ECMAScript 2015 features (as melonJS 2 implementation base is now 100% ES6)
- Renderer: refactoring of the `WebGLCompositor` into a `QuadCompositor` and `PrimitiveCompitor` for Quad and Primitive composition
- Renderer: the vertex shader now takes a color attributes (as opposed to using an uniform in previous version)
- Renderer: attributes and default shader "definitions" for WebGL Compositor(s) are now directly passed through the constructor
- Text: Text object now use offscreen canvas by default to render text (this has been in beta for almost 2 years)
- Text: setting `lineWidth` to a value greater than 0 will now automatically stroke the text
- Text: `drawStroke()` is now deprecated in favour of the `lineWidth` property

### Fixed
- Geometry: fix `arcTo()` drawing a "looping" line between the start and end angle
- Input: fix `device.touch` wrongly returning `true` on non-touch devices
- Renderer: fix binding of active shader when switching compositor
- Renderer: fix a TypeError exception on Safari Technology Preview
- Text: restore the text Stroke feature (was broken since a couple of releases)

## [14.5.0] (melonJS 2) - _2023-02-13_

### Added
- Bounds: add a `centerOn` method similarly to other base geometry objects
- ImageLayer: enable blend mode for `ImageLayer` renderable objects
- Sprite: sprites now "flip" (see flip[X/Y] methods) properly around their default anchor point

### Changed
- Loader: partial refactoring of the preloader to be more es6 compliant and fix circular dependencies with other modules/classes
- Pool: simplified and optimized the pool `pull` method
- Sprite: optimized flip[X/Y] operations by using the sprite own transform matrix instead of manipulating the renderer at draw time
- Renderer: optimized access to cached textures, especially when using multiple atlases
- Renderer: Path2D now uses `Point` internally (instead of `Vector2d`) which is a much more simple object 
- Renderer: optimize Path2D triangulation

### Fixed
- Core: fix "global" exposed properties being read-only after refactoring to ES6
- Geometry: fix corresponing bounds not being properly updated when setting `center[X/Y]` or calling `centerOn()`.
- Input: fix a regression with pointer detection on transformed Renderable object
- Renderable: fix a regression with Bounds position being off after applying a transformation
- Sprite: fix `setRegion()` being called at every update for non-animated sprites 
- Tiled: fix format deprecation warning if map was not created with Tiled and format version is not available

## [14.4.0] (melonJS 2) - _2023-01-10_

### Added
- Tiled: add support for the .tmj and .tsj extension (JSON)
- Tiled: add support for Infinite map (Tiled chunks based map format)

### Changed
- Tiled: warn about map version 1.4 and below being deprecated (terrain was replaced by wangset tiles since version 1.5)

### Fixed
- Physic: fix a regression with the `collision.rayCast()` function (thanks @cpravetz)
- Tiled: fix a `cannot recycle` exception when rendering hexagonal maps

## [14.3.0] (melonJS 2) - _2022-12-30_

### Added
- Core: its now possible to specify a custom renderer (that extends the default Renderer class)

### Changed
- General: further code revamping to make melonJS more modular and allow instantiation of different app/games
- Physic: new `Detector` class instantiated by each physic world instance to detect and solve collisions

### Fixed
- Core: fix missing TS definitions when publishing on NPM (following changes in #1162)
- Doc: fix `fps` type in the World class

## [14.2.0] (melonJS 2) - _2022-12-26_

### Added
- Core: add a tsconfig file for types generation and properly enable type suggestions (thanks @lartkma)

### Changed
- Utils: move `getPixels()` as `getImageData()` under the CanvasTexture object

### Fixed
- Core: fix an uncaught exception (again) when using melonJS with parcel (thanks @infamoustrey)
- Core: fix further global reference to document (i.e. refer to globalThis instead of implicitely using window)
- Core: fix more circular dependencies for better/clearer code

## [14.1.2] (melonJS 2) - _2022-12-01_

### Fixed
- Build: fix TypeScript `.d.ts` file generation & definition (thanks @lartkma)

## [14.1.1] (melonJS 2) - _2022-11-03_

### Fixed
- Core: disable tree-shaking for now, as it is causing exception with the boilerplate
- ES6: use proper semantic when exporting default classes
- Physic: fix a regression in the quadtree implementation that was causing issues with some collision detection edge case

## [14.1.0] (melonJS 2) - _2022-10-30_

### Added
- Core: the build process has been upgraded to rollup 3 and Node 19
- Core: the build process will now only output a tree-shakeable ES Module directory `melonjs.mjs`

## [14.0.2] (melonJS 2) - _2022-10-18_

### Fixed
- Build: fix wrong distribution files being published on NPM

## [14.0.1] (melonJS 2) - _2022-10-18_

### Fixed
- Physic: fix faulty colllision detection under certain circumstances

## [14.0.0] (melonJS 2) - _2022-10-11_

### Added
- UI: New `UIBaseElement` class, a clickable container base UI element (thanks @wpernath)
- UI: New `UITextButton` class, a clickable roundRect & Text base button (thanks @wpernath)

### Changed
- Core: Build process will now only output a ES6 Bundle and the TS Declaration, ES5 is now fully deprecated
- Test Units: replaced the "old" ES5 based Jasmine+Karma framework by a modern ES6 based Mocha+Puppeteer one (thanks @L1lith)
- UI: the base `GUI_Object` class is now deprecated and replaced by `UISpriteElement`, a Sprite based clickable element

### Fixed
- Build: fix typescript generation (d.ts), no more missing API or modules
- Container: fix Container class initialization when no default viewport have been created
- Core: fix a regression with Ejecta platform detection (following ES6 refactoring)

## [13.4.0] (melonJS 2) - _2022-09-27_

### Added
- BitmapText: melonJS will now throw a warning message in the console, instead of failing silently, if a Glyph is not defined for a given character (thanks @wpernath)

### Fixed
- BitmapText: fix kerning when scaling BitmapText objects (thanks @SiLiKhon)

## [13.3.0] (melonJS 2) - _2022-08-28_

### Added
- Documentation: enable offline documentation access with the latest webdoc 2.1 version

### Changed
- Readme: replace link to the latest tutorial

## [13.2.1] (melonJS 2) - _2022-08-22_

### Fixed
- Release date and version/change tracking

## [13.2.0] (melonJS 2) - _2022-08-22_

### Added
- Geometry: new base Point geometry object
- Tiled: now properly support Point geometry if defined in a map

### Changed
- Core: replaced internal reference to the deprecated `trim[Left/Right]` methods by their `trim[Start/End]` equivalents
- WebGL: dissociate the `preMultipliedAlpha` setting from the `transparent` one since those are 2 different things

### Fixed
- BitmapText: fix improper `fillStyle` initialization in BitmapText (thanks @wpernath)
- Canvas: fix the "transparent" canvas mode with the canvas renderer (thanks @wpernath)
- Sprite: properly apply a tint when passed through the settings to the constructor
- WebGL: fix a regression with global opacity not being properly cascaded to texture in WebGL mode (thanks @wpernath)

## [13.1.1] (melonJS 2) - _2022-08-10_

### Fixed
- Release date and version/change tracking

## [13.1.0] (melonJS 2) - _2022-08-10_

### Added
- Color: added a `setHSL(h, s, l)` and `setHSV(h, s, v)` method to the Color class
- Tiled: add support for the new `class` property (note: melonJS will still set the deprecated `type` one for backward compatibility)
- Renderer: Canvas rendering mode can now be forced by adding `[#/&]canvas` to the URL (similarly with WebGL1/2 already)
- Vector: new `moveTowards()` method for `[Observable]Vector2d/3d` objects (limited to x and y axis for 3d vectors)

### Changed
- Renderer: the double-buffering option for the Canvas Renderer is now deprecated, this to better align both renderer and enable further improvements

### Fixed
- 9-Slice Sprite: fix resizing of a 9-slice sprite (thanks @NemoStein)
- Tiled: fix missing text property in TMX Object documentation
- Vector: fix `lerp()` not triggering the callback in `ObservableVector2/3d` objects
- Renderer: fix the manual canvas scaling option (thanks @NemoStein)

## [13.0.0] (melonJS 2) - _2022-07-18_

### added
- Event: also provide a reference to the camera viewport being resized when emitting `VIEWPORT_ONRESIZE`
- Unit Test: added base64 encoded data preload testing for image and audio assets
- Utils: new `isDataUrl()` helper returning true if the given url is in the `data:[<mediatype>][;base64],<data>` format.

### Changed
- Core: full ES6 refactoring of `me.device`, and API clean-up (@see https://github.com/melonjs/melonJS/wiki/Upgrade-Guide#120x-to-130x-stable)
- Game: refactoring of the global `game` into an instantiable `Application` object, with `game` now being the default instance of it (@see #1091)
- Loader: `onload` and `onerror` callbacks are now optionals when directly loading assets (easier with base64 encoded assets)
- Physic: World physic implementation is now properly tight to its corresponding parent application/game (@see #1091)
- Physic: Gravity is now properly applied as a force, instead of directly modifying a body velocity
- Physic: Gravity now properly takes in account the body mass
- Physic: resulting force is now properly cancelled at the end of an update cycle (not required anymore to manually set it to 0 in user code)

### Fixed
- Doc: fix missing `Timer` documentation following previous refactoring
- Loader: fix loading/preloading of base64 audio assets, and base64 encoded FontFace
- Renderer: fix a regression with the masking features in the Canvas Rendering mode
- Text: fix an uncaught exception when removing Text object from the game world that use offScreenCanvas texture caching (thanks @wpernath)

## [12.0.0] (melonJS 2) - _2022-06-27_

### Changed
- Loader: the default loading screen has been updated with the new melonjs logo
- String: replaced own `trim[left/right]` functions with native es10 equivalent (with polyfill)

## [11.0.0] (melonJS 2) - _2022-06-23_

### Added
- Event: new `DOM_READY` event triggered when the DOM is loaded and ready (now used internally to trigger the `onReady()` function)

### Changed
- Renderable: update the Light2d constructor to allow creating elliptical shaped lights

### Fixed
- Core: fix an uncaught exception when using parcel (thanks @8Observer8)

## [10.12.0] (melonJS 2) - _2022-06-20_

### Added
- State: new `get(state)` function that return the instance to the Stage associated with the given state

### Changed
- Physic: simplify the collision api and implementation (removed `collision.response` that serves no purpose anymore)
- Pooling: silently fail if internally failing at recycling body physic shapes

### Fixed
- Physic: fix a regression with Ellipse vs Polygon SAT collision detection
- Text: make sure the optional `x` and `y` arguments of the draw method are set to a default value
- TypeScript: fix and uniform draw method signature across all renderables
- TypeScript: fix typings for the `onCollision` method
- TypeScript: fix `setMaxVelocity` and `setFriction` method scope
- Webdoc: fix wrong or missing  argument names (`Path2D.arcTo`, `Rect.centerOn`, `Texture.AdduVs`)


## [10.11.0] (melonJS 2) - _2022-06-14_

### Changed
- Core: fix all rollup "$1" related duplicated declaration and/or export
- Core: refactored Timer into an instantiable class with `timer` (namespace) now being the default instance of the Timer class
- Doc: replaced JSDoc by Webdoc for documentation generation (huge thanks to @ShukantPal)

### Fixed
- Bounds: fix the `addFrame()` method
- Core: fix a regression when accessing `localStorage`
- Core: fix a regression when when running melonJS in node.js (undefined global reference in the roundRect polyfill)
- Geometry: fix the RoundRect `clone()` method
- Input: fix PointerEvent detection on Firefox for Android mobile (thanks @kutyamutya)
- Renderer: fix a regression with `strokeLine()` in the CanvasRenderer

## [10.10.0] (melonJS 2) - _2022-06-07_

### Added
- Core: new `CanvasTexture` object to allow recycling canvas through the engine (text caching, default particles, effect, etc..)
- Core : new experimental light effect that simply simulate a spot/point light for now (work in progress)
- Color : allow overriding the alpha component with a specific value when calling `toRGBA` or `toHex8`
- Renderer: support reverse clipping when applying geometry masks (alpha component of the masked area is ignored in legacy Canvas rendering mode)
- Renderer: added multiple clipping region for masks (only works with overlapping region in legacy Canvas rendering mode)

### Changed
- TMX: replace use of `eval()` by `Function()` when parsing map including executable code
- Core: replace internal calls to deprecated `substr` function with `slice`

### Fixed
- Renderable: mark renderable(s) as dirty when their pos or bounds are updated
- Geometry: fix a regression with roundRect shape drawing

## [10.9.0] (melonJS 2) - _2022-05-21_

### Added
- Geometry : add a proper `contains` and other utility methods to RoundRect

### Fixed
- Renderer: fix clipping of RoundRect mask with the Canvas Renderer

## [10.8.0] (melonJS 2) - _2022-05-16_

### Added
- Geometry : new RoundRect geometry object
- Geometry : new Path2D API to provide better abstraction when drawing primitives in WebGL

### Changed
- Renderer: refactored the WebGL renderer to use the new Path2D API for primitive drawing

### Fixed
- Core: improve internal object recycling, to fix instance leaking or hoarding by the pool system
- Input: fix a warning on using passive target disabling swipe on a WebView (thanks @zngb)

## [10.7.1] (melonJS 2) - _2022-05-05_

### Fixed
- Renderer: fix a crash on context restore when using the canvas renderer

## [10.7.0] (melonJS 2) - _2022-05-04_

### Added
- Core : new `device.nodeJS` to detect if running under node.js
- Particle Emitter: added the possibility to define a specific tint and blend mode for particles
- Renderable: new `centerOn` method to center a renderable around given coordinates
- Renderer: added "additive" as an alias for the "lighter" blend mode
- Renderer: listen to `contextlost` & `contextrestored` events in Canvas rendering mode (@see https://developer.chrome.com/blog/canvas2d/#context-loss)

### Changed
- Core : replace internal use of global window object by `globalThis`
- Core : refactor the boot process, and device/feature detection/initialisation to better work within node.js (will still require jsdom and node-canvas)
- Particle Emitter: refactoring of the Emitter class to directly extend `Container` instead of `Renderable`

### Fixed
- Particle Emitter: fix a regression in `ParticleEmitter` causing a crash, after es6 class reformatting
- Particle Emitter: fix particle additive blend mode in WebGL

## [10.6.1] (melonJS 2) - _2022-04-25_

### Fixed
- Renderable: fix a regression in BitmapText when specifying a scaling size through the constructor

## [10.6.0] (melonJS 2) - _2022-04-25_

### Added
- Renderable : added the possibility to specify a blend mode per renderable
- Renderer: added missing compatible/supported blend mode across the canvas and WebGL renderer ("normal", "multiply", "lighter, "screen")
- Renderable : new (simple) word wrapping feature for Text and BitmapText classes

### Changed
- Renderable : refactor of Text and BitmapText to isolate metrics related features/functions and standardize the api between the 2 classes

### Fixed
- Container: mark a container as dirty when changing own child(s) order using `MoveTo[Top/Bottom]`, `move[Up/Down]` and `swapChildren`
- Renderable : fix NineSliceSprite bounding box not being properly scaled up
- Renderer: fix blend mode in WebGL rendering mode


## [10.5.2] (melonJS 2) - _2022-03-17_

### Fixed
- WebGL: fix shader attribute for the projection matrix not being properly updated when using the flex scaling mode

## [10.5.1] (melonJS 2) - _2022-03-17_

### Fixed
- Renderer: fix a regression when zooming the canvas in WebGL rendering mode
- TypeScript : fix definition of the base Renderable class

## [10.5.0] (melonJS 2) - _2022-03-15_

### Changed
- Physic: set collision shapes as static by default (those should be fixed anyway)
- Renderable : refactor of Draggable and DropTarget base objects

### Fixed
- Physic: fix improper behavior for static bodies responding to collisions (thanks @dynamo-foundation)
- Physic: static bodies are now properly filtered out if within the same node or overlapping
- Renderable : fix a me.Sprite bug when reusing the same image/texture with different frame width/height (thanks @dynamo-foundation)

## [10.4.0] (melonJS 2) - _2022-03-08_

### Added
- Renderable : containers now define a `backgroundColor` property allowing to defined a background color for a specific container
- Renderable : new `inset[x/y]` property setting allowing to define the size of a corner for NineSliceSprite (thanks @dynamo-foundation)

### Changed
- Renderer: the video.renderer.Texture class is now directly exported (and available) as TextureAtlas

### Fixed
- TypeScript : fix all typings and other issues with the typescript definition file (now with 0 warnings and linting errors)
- Input : fix a regression (undefined error) with the `releasePointerEvent` method (thanks @siauderman)

## [10.3.0] (melonJS 2) - _2022-02-02_

### Added
- TMX: melonJS will now throw an error if collision polygons defined in Tiled are not forming a convex shape
- WebGL : vertex element and buffer size are now dynamically calculated based on attribute definition

### Changed
- WebGL : switch from drawElements to drawArrays when drawing quads
- WebGL : optimize ColorLayer rendering and `clearRect` method by using `clipRect` & `clearColor` instead of drawing primitives
- Device : modernize the `pointerLock` implementation (2.0 specs) and moved it under `me.input`

### Fixed
- Renderable : properly delete me.Text cache WebGL texture upon deactivation (if created)
- WebGL : Optimize vertex buffer allocated size following tint color packing into Uint32
- Device : fix `pointerLock` feature detection

## [10.2.3] (melonJS 2) - _2021-12-18_

### Fixed
- Core: fix a regression with the quadtree implementation and non floating objects
- Preloader: optimize defined cache canvas size in the default loading screen when using WebGL2

## [10.2.2] (melonJS 2) - _2021-12-14_

### Added
- Renderable: new `isFloating` getter returning true if the renderable is a floating object or contained in a floating container

### Fixed
- TypeScript: fix most of method parameters and return type declaration when applicable
- Input: fix an issue with pointer event detection on nested floating items

## [10.2.1] (melonJS 2) - _2021-11-23_

### Fixed
- changelog release date and links

## [10.2.0] (melonJS 2) - _2021-11-23_

### Added
- Bounds: faster condition assessment for the `overlaps` method
- Renderable: added a basic `NineSliceSprite` renderable object
- Renderable: new `offScreenCanvas` option for me.Text allowing to use an individual offscreen canvas texture per text element

### Fixed
- Input: fix a regression with me.input.pointer not being updated on pointer events
- Loader: fix a "double initialization and double reset" bug with the default loading screen

## [10.1.1] (melonJS 2) - _2021-11-12_

### Fixed
- documentation: add missing pages for `Container` and `World` object
- Renderable: also flag as "dirty" when changing opacity, or when viewport change is triggering an `ImageLayer` update

## [10.1.0] (melonJS 2) - _2021-11-08_

### Changed
- Input: refactor me.Pointer by extending me.Bounds instead of me.Rect (simplify implementation and memory usage when using pointer Event)
- WebGL: refactor/simplify the WebGLCompositor implementation to be more generic
- WebGL: prevent temporary Array Buffer Allocation when using WebGL2
- WebGL: tint color are now packed into Uint32 before passing them to the Vertex Shader
- Device: replace use of deprecated `onorientationchange()` event listener by the standard ScreenOrientation one

### Fixed
- Input: fix a regression, throwing an undefined property exception, when accessing me.input.pointer before registering on any events (thanks @kkeiper1103)
- WebGL: fix initial declaration of the WebGLVersion property

## [10.0.2] (melonJS 2) - _2021-10-29_

### Fixed
- Documentation: fix missing class definition after the 10.0.0 release

## [10.0.1] (melonJS 2) - _2021-10-25_

### Fixed
- Physic: fix a regression (crash) with undefined reference in the minified ES6 module

## [10.0.0] (melonJS 2) - _2021-10-23_

### Added
- melonJS is now a pure ES6 library, for class definition, inheritance and semantic
- melonJS now includes typescript definition for the ESM `melonjs.module` bundle (thanks @qpwo)
- Core : new `me.event.BOOT` event that will be triggered when melonJS is initialized
- Physic : physic bodies can now be configured as static bodies (which do not move automatically and do not check for collision with others)
- Event : new system events at the beginning and end of both the update and draw "loop"

### Changed
- Jay Inheritance has been replaced with ES6 standard inheritance
- Core : object using the pooling function *must* now implement a `onResetEvent` method and use the `recycling` flag when registered
- Core : manually pushing a non recyclable object into the object pool will now throw an exception instead of silently failing
- Physic : physic body update and collision check is now automatically done through the world simulation update loop
- Physic : fixed gravitational acceleration (thanks @neilsf)
- Event: minPubSub event based implementation has been replaced by a nodeJS event emitter based implementation
- Renderable: calling `flipX/Y()` without argument will now flip the renderable as expected

### Deprecated
- all deprecated API from the legacy melonJS version have been removed

### Fixed
- Renderer: fix the stencil masking feature on renderable components (for both WebGL and Canvas mode)
- Loader: fix a graphic glitch in the default preloading screen

-------------------------------------------------------------------------------

[17.5.0]: https://github.com/melonjs/melonJS/compare/17.4.0...17.5.0
[17.4.0]: https://github.com/melonjs/melonJS/compare/17.3.0...17.4.0
[17.3.0]: https://github.com/melonjs/melonJS/compare/17.2.0...17.3.0
[17.2.0]: https://github.com/melonjs/melonJS/compare/17.1.0...17.2.0
[17.1.0]: https://github.com/melonjs/melonJS/compare/17.0.0...17.1.0
[17.0.0]: https://github.com/melonjs/melonJS/compare/16.1.3...17.0.0
[16.1.3]: https://github.com/melonjs/melonJS/compare/16.1.2...16.1.3
[16.1.2]: https://github.com/melonjs/melonJS/compare/16.1.1...16.1.2
[16.1.1]: https://github.com/melonjs/melonJS/compare/16.2.0...16.1.1
[16.1.0]: https://github.com/melonjs/melonJS/compare/16.0.0...16.1.0
[16.0.0]: https://github.com/melonjs/melonJS/compare/15.15.0...16.0.0
[15.15.0]: https://github.com/melonjs/melonJS/compare/15.14.0...15.15.0
[15.14.0]: https://github.com/melonjs/melonJS/compare/15.13.0...15.14.0
[15.13.0]: https://github.com/melonjs/melonJS/compare/15.12.0...15.13.0
[15.12.0]: https://github.com/melonjs/melonJS/compare/15.11.0...15.12.0
[15.11.0]: https://github.com/melonjs/melonJS/compare/15.10.0...15.11.0
[15.10.0]: https://github.com/melonjs/melonJS/compare/15.9.2...15.10.0
[15.9.2]: https://github.com/melonjs/melonJS/compare/15.9.1...15.9.2
[15.9.1]: https://github.com/melonjs/melonJS/compare/15.9.0...15.9.1
[15.9.0]: https://github.com/melonjs/melonJS/compare/15.8.0...15.9.0
[15.8.0]: https://github.com/melonjs/melonJS/compare/15.7.0...15.8.0
[15.7.0]: https://github.com/melonjs/melonJS/compare/15.6.0...15.7.0
[15.6.0]: https://github.com/melonjs/melonJS/compare/15.5.0...15.6.0
[15.5.0]: https://github.com/melonjs/melonJS/compare/15.4.1...15.5.0
[15.4.1]: https://github.com/melonjs/melonJS/compare/15.4.0...15.4.1
[15.4.0]: https://github.com/melonjs/melonJS/compare/15.3.0...15.4.0
[15.3.0]: https://github.com/melonjs/melonJS/compare/15.2.1...15.3.0
[15.2.1]: https://github.com/melonjs/melonJS/compare/15.2.0...15.2.1
[15.2.0]: https://github.com/melonjs/melonJS/compare/15.1.6...15.2.0
[15.1.6]: https://github.com/melonjs/melonJS/compare/15.1.5...15.1.6
[15.1.5]: https://github.com/melonjs/melonJS/compare/15.1.4...15.1.5
[15.1.4]: https://github.com/melonjs/melonJS/compare/15.1.3...15.1.4
[15.1.3]: https://github.com/melonjs/melonJS/compare/15.1.2...15.1.3
[15.1.2]: https://github.com/melonjs/melonJS/compare/15.1.1...15.1.2
[15.1.1]: https://github.com/melonjs/melonJS/compare/15.1.0...15.1.1
[15.1.0]: https://github.com/melonjs/melonJS/compare/15.0.0...15.1.0
[15.0.0]: https://github.com/melonjs/melonJS/compare/14.5.0...15.0.0
[14.5.0]: https://github.com/melonjs/melonJS/compare/14.4.0...14.5.0
[14.4.0]: https://github.com/melonjs/melonJS/compare/14.3.0...14.4.0
[14.3.0]: https://github.com/melonjs/melonJS/compare/14.2.0...14.3.0
[14.2.0]: https://github.com/melonjs/melonJS/compare/14.1.2...14.2.0
[14.1.2]: https://github.com/melonjs/melonJS/compare/14.1.1...14.1.2
[14.1.1]: https://github.com/melonjs/melonJS/compare/14.1.0...14.1.1
[14.1.0]: https://github.com/melonjs/melonJS/compare/14.0.2...14.1.0
[14.0.2]: https://github.com/melonjs/melonJS/compare/14.0.1...14.0.2
[14.0.1]: https://github.com/melonjs/melonJS/compare/14.0.0...14.0.1
[14.0.0]: https://github.com/melonjs/melonJS/compare/13.4.0...14.0.0
[13.4.0]: https://github.com/melonjs/melonJS/compare/13.3.0...13.4.0
[13.3.0]: https://github.com/melonjs/melonJS/compare/13.2.1...13.3.0
[13.2.1]: https://github.com/melonjs/melonJS/compare/13.2.0...13.2.1
[13.2.0]: https://github.com/melonjs/melonJS/compare/13.1.1...13.2.0
[13.1.1]: https://github.com/melonjs/melonJS/compare/13.1.0...13.1.1
[13.1.0]: https://github.com/melonjs/melonJS/compare/13.0.0...13.1.0
[13.0.0]: https://github.com/melonjs/melonJS/compare/12.0.0...13.0.0
[12.0.0]: https://github.com/melonjs/melonJS/compare/11.0.0...12.0.0
[11.0.0]: https://github.com/melonjs/melonJS/compare/10.12.0...11.0.0
[10.12.0]: https://github.com/melonjs/melonJS/compare/10.11.0...10.12.0
[10.11.0]: https://github.com/melonjs/melonJS/compare/10.10.0...10.11.0
[10.10.0]: https://github.com/melonjs/melonJS/compare/10.9.0...10.10.0
[10.9.0]: https://github.com/melonjs/melonJS/compare/10.8.0...10.9.0
[10.8.0]: https://github.com/melonjs/melonJS/compare/10.7.1...10.8.0
[10.7.1]: https://github.com/melonjs/melonJS/compare/10.7.0...10.7.1
[10.7.0]: https://github.com/melonjs/melonJS/compare/10.6.1...10.7.0
[10.6.1]: https://github.com/melonjs/melonJS/compare/10.6.0...10.6.1
[10.6.0]: https://github.com/melonjs/melonJS/compare/10.5.2...10.6.0
[10.5.2]: https://github.com/melonjs/melonJS/compare/10.5.1...10.5.2
[10.5.1]: https://github.com/melonjs/melonJS/compare/10.5.0...10.5.1
[10.5.0]: https://github.com/melonjs/melonJS/compare/10.4.0...10.5.0
[10.4.0]: https://github.com/melonjs/melonJS/compare/10.3.0...10.4.0
[10.3.0]: https://github.com/melonjs/melonJS/compare/10.2.3...10.3.0
[10.2.3]: https://github.com/melonjs/melonJS/compare/10.2.2...10.2.3
[10.2.2]: https://github.com/melonjs/melonJS/compare/10.2.0...10.2.2
[10.2.1]: https://github.com/melonjs/melonJS/compare/10.2.0...10.2.1
[10.2.0]: https://github.com/melonjs/melonJS/compare/10.1.1...10.2.0
[10.1.1]: https://github.com/melonjs/melonJS/compare/10.1.0...10.1.1
[10.1.0]: https://github.com/melonjs/melonJS/compare/10.0.2...10.1.0
[10.0.2]: https://github.com/melonjs/melonJS/compare/10.0.1...10.0.2
[10.0.1]: https://github.com/melonjs/melonJS/compare/10.0.0...10.0.1
[10.0.0]: https://github.com/melonjs/melonJS/compare/9.1.2...10.0.0
