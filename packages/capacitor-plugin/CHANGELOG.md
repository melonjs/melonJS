# Changelog

## [1.0.2] - _2026-11-14_

### Fixed
- Installing the plugin no longer asks for Node 24. Its `package.json` declared `engines: { node: ">=24.0.0" }`, so npm warned on an older Node and Yarn 1 refused to install it; the plugin runs in the browser

## [1.0.1] - _2026-11-09_

### Fixed
- Coming back to the app no longer resumes a game that was already paused when it left, such as one showing its pause menu

## [1.0.0] - _2026-05-10_

### Added
- Initial release. `CapacitorPlugin` (`BasePlugin` subclass) bridges Capacitor's `appStateChange` → `state.pause` / `state.resume`, and forwards `backButton` events into the melonJS event bus as a `CapacitorBackEvent` with a `preventDefault()` API. Defaults: pause/resume on background, also pause/resume audio, exit the app when no handler intercepts the back press.
- `bindStageBack(stage, handler)` — wires a per-stage back-button handler whose lifetime matches the stage's `onResetEvent` / `onDestroyEvent`, removing the manual `event.on` / `event.off` boilerplate.
- `onBackButton(handler)` — subscribe a global, stage-agnostic back-button handler. Returns an unsubscribe function.
- `lockOrientation(o)` / `unlockOrientation()` — lazy wrappers around `@capacitor/screen-orientation` (optional peer dep, dynamically imported only when called).
- `hideSplash(opts?)` — lazy wrapper around `@capacitor/splash-screen` (optional peer dep, dynamically imported only when called).
