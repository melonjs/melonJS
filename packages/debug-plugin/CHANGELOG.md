# Changelog

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
