# Changelog

## [1.0.0] - _unreleased_

### Added
- Initial release. `CapacitorPlugin` (`BasePlugin` subclass) bridges Capacitor's `appStateChange` → `state.pause` / `state.resume`, and forwards `backButton` events into the melonJS event bus as a `CapacitorBackEvent` with a `preventDefault()` API. Defaults: pause/resume on background, also pause/resume audio, exit the app when no handler intercepts the back press.
- `bindStageBack(stage, handler)` — wires a per-stage back-button handler whose lifetime matches the stage's `onResetEvent` / `onDestroyEvent`, removing the manual `event.on` / `event.off` boilerplate.
- `onBackButton(handler)` — subscribe a global, stage-agnostic back-button handler. Returns an unsubscribe function.
- `lockOrientation(o)` / `unlockOrientation()` — lazy wrappers around `@capacitor/screen-orientation` (optional peer dep, dynamically imported only when called).
- `hideSplash(opts?)` — lazy wrapper around `@capacitor/splash-screen` (optional peer dep, dynamically imported only when called).
