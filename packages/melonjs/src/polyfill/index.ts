// Canvas and DOM shims the engine needs to draw, feature-detected at import.
//
// Deliberately no language polyfills: the published bundle targets ES2022, so
// every browser that can parse it already has `globalThis`, `String.trimStart`
// and `String.trimEnd` — those are ES2019/ES2020 and predate the floor by
// years. Patching `String.prototype` on an application's behalf is also not a
// library's call to make: the consumer picks the target, and one that needs
// older browsers needs a whole-app polyfill strategy rather than a fragment
// shipped by a dependency.
import "./console.ts";
import "./ellipse.ts";
import "./roundrect.ts";
