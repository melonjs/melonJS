# Changelog

## 16.0.0 _unreleased_

### Breaking Changes
- Requires melonJS **19.5.0 or later** — the hitbox overlay now goes through the new `PhysicsAdapter.getBodyAABB` / `getBodyShapes` adapter API (and the velocity overlay through the existing `adapter.getVelocity`) rather than reading `renderable.body.*` directly. Older engines don't expose those methods and the plugin will refuse to load. 19.5 also moved the FPS estimate into `timer.update()` (was previously driven by this plugin's `timer.countFPS()` call) and removed the debug-only `Container.drawCount` field, both of which this version is aware of.

### Improvements
- `#draws` stat is now self-computed by counting per-frame `postDraw` calls on direct children of `game.world`, instead of reading the now-removed `Container.drawCount` field. Same number, no API surface bleeding back into the engine.
- Help-text key label (`[X] show/hide` in the panel footer) now reverse-looks-up the key name from `input.KEY`, so a custom `debugToggle` like `KEY.SPACE` or `KEY.F1` displays correctly instead of producing garbage from a fixed `String.fromCharCode(32 + keycode)` assumption.
- Hitbox/body overlays render correctly regardless of which physics adapter is active. Each adapter owns its own coordinate-system conversion (builtin returns local-space directly; matter subtracts world-space → local), so the debug plugin no longer relies on duck-typed body shims and is automatically compatible with future adapters.
- Velocity vector overlay now works on **any** renderable with a body (not just `Entity`), and works under both builtin and matter physics. Previously the overlay was Entity-only and read `body.vel` directly — a builtin-only field that doesn't exist on matter bodies.
- Velocity overlay is now independent of the hitbox option for general renderables. Previously, toggling the hitbox option off would also suppress the velocity arrow on non-`Entity` renderables (`Entity` already had the two flags independent); now both flags can be toggled independently for any renderable.
- Overlay rendering (hitbox / velocity / quadtree) is no longer tied to panel visibility. Each overlay's checkbox in the panel is the source of truth; hiding the panel keeps any enabled overlays rendering in the world. The panel's HTML UI (FPS, draw-call counts, frame-time graph) still pauses while hidden — that's just a stats readout. Workflow: open the panel, tick the overlays you want, close the panel, keep playing with the overlays still on.

## 15.0.3

### Improvements
- Console log now links to the npm package page instead of the GitHub readme

## 15.0.2

### Bug Fixes
- Fixed quadtree debug visualization not rendering — draw calls were issued after `renderer.flush()`, so the quadtree lines were never submitted to the GPU

## 15.0.1

### Bug Fixes
- Fixed Entity debug overlay drawing in local coordinate space instead of attempting world-coordinate conversion
  - Green box (renderable bounds) now correctly uses `strokeRect` with the renderable's anchor and dimensions
  - Orange/red boxes (body bounds and collision shapes) translate from anchor point to body origin before drawing
  - Fixes overlays being mispositioned for entities with non-zero anchor points or trimmed atlas sprites

## 15.0.0

### Breaking Changes
- Major version bump to align with melonJS versioning
- Debug panel rewritten from canvas-drawn to HTML overlay

### New Features
- HTML overlay panel with native checkboxes (replaces custom canvas hit-detection)
- Retro CRT green terminal aesthetic with PressStart2P pixel font
- Frame-time sparkline graph with stacked update/draw bars and target frame line
- Density-based QuadTree visualization (green → yellow → red wireframes)
- Panel inserted as canvas sibling — no longer modifies parent element layout

### Improvements
- Switched from bitmap font (.fnt/.png) to TTF web font via @font-face (better scaling)
- Counters class now extends Map (ES6 built-in)
- CSS grid layout with flexbox-aligned stat values
- Proper event listener cleanup on destroy (fixes memory leaks)
- `Float32Array` ring buffer for frame time history (120 samples)

### Code Cleanup
- Renamed snake_case variables to camelCase
- Replaced deprecated API calls (`setLineWidth()` → `renderer.lineWidth`)
- Removed unused fields, dead code, and stale comments
- Modernized to ES6+ (destructuring, `for...of`, nullish coalescing)
- Plugin now passes eslint

## 14.9.0
### Bug Fixes
- Fixed checkbox init bug: quadtree URL hash flag was toggling the wrong checkbox
- Fixed memory leak: event listeners not properly unregistered on destroy
- Fixed `onClick.bind(this)` creating a new reference on each `show()`, preventing proper cleanup on `hide()`
- Removed unused `canvas` allocation (`video.createCanvas`)
- Removed duplicate `frameUpdateTime`/`frameDrawTime` declarations
- Fixed deprecated `setLineWidth()` call, replaced with `renderer.lineWidth`

### Improvements
- QuadTree visualization: wireframe-only with density-based coloring (green → yellow → red)
- Cached `this.body.getBounds()` in Entity patch (was called multiple times)
- Removed unused `math` import, `font_size` and `fps_str_len` fields
- Removed dead commented-out code

### Code Cleanup
- Renamed snake_case variables to camelCase (`help_str` → `helpText`, `fps_str` → `fpsText`, etc.)
- Replaced `typeof x !== "undefined"` with `x !== undefined`
- Replaced `~~(value)` with `Math.trunc(value)`
- Replaced `math.round(x, 2)` with `Number(x.toFixed(2))`
- Removed stale/obvious comments
- Refactored hitbox patches to use early returns and always-paired save/restore
- Used destructuring and `for...in` where appropriate
- Inline `export default class` in counters.js
- Fixed typo in JSDoc (`show()` and `show()` → `show()` and `hide()`)
- Plugin now passes eslint (removed from global ignore list)
