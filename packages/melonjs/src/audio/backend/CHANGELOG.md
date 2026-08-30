# Audio backend changelog

The audio backend is vendored, not a dependency. It tracks its own version here,
separate from the engine's, so its history stays legible.

## Attribution

A customized derivative of howler.js, not the upstream library — renamed,
restructured, corrected and extended as recorded below. Upstream's last release
was 2.2.4 in September 2023.

The original is used under the MIT license; see `LICENSE` in this directory for
the full notice.

## [3.1.0] - _unreleased_

### Fixed
- Plugin hooks collided: the sound-level and voice-level create hooks shared one
  name, and the spatial plugin registered that key twice in the same object, so
  the second silently replaced the first and one of the two never ran. Split into
  `onSoundCreate` and `onVoiceCreate`
- `pos()`, `orientation()` and `stereo()` lost their group-level read path in the
  3.0 rewrite: called with no arguments they returned the sound itself rather than
  the value, and a set with no instance id never recorded the value on the group,
  so a set could not be read back. Restored to match 2.2.4
- The audio context was never created before a spatial call, so `pos()` on a sound
  that had not played yet returned early and silently discarded the value. 2.2.4
  created the context during init
- `loop(loop, id)` was unreachable through the types: the implementation read an
  instance id but the overloads only declared `loop(loop)`
- Unregistering the spatial plugin threw before it cleaned anything up — the
  per-voice loop declared `const sound = sound._sounds[j]`, shadowing the variable
  it read from
- `pannerAttr(id)` with a single numeric argument reads that instance's attributes
  in 2.2.4; the declaration only admitted an options object
- The spatial getters are typed to admit `null`. `_pos` and `_stereo` are null
  until first set, which callers must handle

### Fixed — carried from unmerged upstream pull requests

Upstream's last release was 2.2.4 in September 2023; these sat open against it.

- Panner attributes were shared by reference between a group and its instances,
  so changing one sound's settings rewrote the group's and leaked into every
  sound created afterwards ([#1758](https://github.com/goldfire/howler.js/pull/1758))
- iOS: `play()` issued immediately after `pause()` raced the audio node, which
  paused again right after starting ([#1761](https://github.com/goldfire/howler.js/pull/1761))
- The audio context's `resume()` can reject — a disconnected or busy output
  raises `InvalidStateError`. Unhandled, the engine stayed wedged in "suspended"
  ([#1764](https://github.com/goldfire/howler.js/pull/1764))
- A looping sound reported a position past its loop end when the JavaScript end
  timer fired after the buffer had already restarted
  ([#1776](https://github.com/goldfire/howler.js/pull/1776))
- iOS reports the context as "suspended" rather than "interrupted" after an
  output device change, so unplugging headphones left playback dead
  ([#1551](https://github.com/goldfire/howler.js/pull/1551))
- Low-end iOS devices could be left with a null context by the mobile unload
  path, and creating the scratch buffer immediately after threw
  ([#1363](https://github.com/goldfire/howler.js/pull/1363))
- A `stop()` queued while the sound was still loading dropped its `internal`
  flag, so the replay emitted events the caller had suppressed
  ([#1648](https://github.com/goldfire/howler.js/pull/1648))
- A backgrounded tab could leave the context stopped with no further user
  gesture coming to restart it
  ([#1770](https://github.com/goldfire/howler.js/pull/1770))

### Removed
- The plugin registry. Upstream shipped spatial audio as an opt-in plugin behind
  a `PluginManager`, hook interfaces and a module-level singleton registry — for
  exactly one plugin that is always installed. Spatial is now installed directly
  by the engine, sound and voice constructors. This also removes a whole class of
  bug: the duplicate-hook-key defect fixed above was only possible because two
  hooks were registered into one object literal, and the registry's global state
  had to be worked around in tests
- CocoonJS support. `NavigatorWithCocoonJS` was an empty interface extending
  `Navigator`; the product was discontinued around 2017
- The bundled user-agent parser. It duplicated melonJS's own `system/platform`
  module, less well — its iOS check missed iPadOS 13+, which reports the desktop
  Mac user agent, while `platform.iOS` feature-detects that case. Only one of its
  eight exports was still reachable after the iOS 8 removal above; the Apple
  vendor check it provided now lives in `system/platform` as `appleVendor`, with
  an `isAppleVendorNav` test seam matching the existing `isIPadOnMacUA` pattern
- The iOS 8-and-below fallback that disabled Web Audio. iOS 9 shipped in 2015 and
  melonJS 20 requires WebGL 2 or WebGPU, which no such device provides

### Changed
- Audio context creation is idempotent and belongs to the engine. It was a free
  function under `helpers/` that reached back into the singleton and had no
  internal guard, so calling it with a context already live built a second one
  and leaked the first — six call sites each carried their own `if (!ctx)` check
  to prevent that. It is now `AudioEngine.ensureContext()`, which returns the
  existing context, and the duplicated guards are gone
- Flattened the `helpers/` directory. Its barrel had no consumers at all, the
  context helper moved onto the engine, and the remaining loader is a module in
  its own right rather than a helper — it now sits beside the rest as
  `loader.ts`
- Dropped `index.ts`. It was the package entry point of a library that is no
  longer a package: the engine imports the two symbols it needs straight from
  `core.ts`, and half of what the barrel re-exported was reachable from nowhere.
  The MIT notice it carried now lives in `LICENSE`, where a refactor cannot
  quietly delete it
- Audio is fetched through the engine's shared transport, so it picks up the
  `file:` fallback — `fetch()` cannot read that scheme in a Cordova or Capacitor
  WebView — along with the cache, credentials and cross-origin handling every
  other asset type already had. `setAudioFetcher` overrides it for a custom
  transport or a test, but the default is a working implementation rather than a
  stub that must be installed: a rejection here is not reported as an error, it
  switches the clip to a streaming HTML5 element, so a missed wiring would have
  degraded every network clip silently instead of failing loudly
- The transport helper moved out of `loader/parsers/` to `utils/`. It is engine
  transport, not loader policy, and its placement was the only reason the audio
  module had to import the loader at all
- The switch to streaming on a failed fetch is a named function rather than an
  inline `catch` body, so it reads as the policy response it is — distinct from
  a decode failure, which reports `loaderror`
- Renamed `loader.ts` to `buffer.ts`. It sat next to the engine's own `loader/`
  under a name that described neither what it did nor which layer it belonged to
- Uses `globalThis` rather than `window`, matching the rest of the engine. Several
  of these were unguarded — `window.AudioContext` raises a `ReferenceError` where
  `window` does not exist rather than evaluating to undefined, so the backend
  would have thrown in Node the moment audio was touched
- Renamed to melonJS conventions: `Howl` → `Sound`, the per-instance `Sound` →
  `Voice`, `HowlerGlobal` → `AudioEngine`, `SpatialHowl` → `SpatialSound`
- The spatial plugin is registered on construction and the singleton is typed
  `SpatialAudioEngine`. Upstream ships spatial as opt-in; melonJS exposes
  `audio.position()` / `orientation()` / `stereo()` as public API, so callers
  never register it or cast for it
- `arguments` replaced with rest parameters, preserving the arity dispatch both
  depend on
- Typed the engine augmentation's read paths, which the 3.0 baseline declared as
  returning only the engine while the implementation also returned the value

## [3.0.0] - _2025-11-23_

The TypeScript and ESM rewrite of howler.js 2.2.4, by @eatsjobs
([goldfire/howler.js#1769](https://github.com/goldfire/howler.js/pull/1769)),
unmerged upstream. Vendored as the starting point for this backend.
