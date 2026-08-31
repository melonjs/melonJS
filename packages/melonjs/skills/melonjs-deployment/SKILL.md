---
name: melonjs-deployment
description: "Use this skill when packaging, shipping or scaffolding a melonJS game — starting a project with create-melonjs, building for the web, wrapping as a native app with Capacitor or Cordova, publishing to WeChat Mini Games or Facebook Instant Games, browser support and transpiling. Triggers on: create-melonjs, scaffold, new project, build, deploy, publish, Capacitor, Cordova, native app, iOS, Android, WeChat, Instant Games, browser support, transpile, ES2022, bundle size, tree-shaking."
license: MIT
---

# Starting and shipping a project

## Scaffolding

Start from the template rather than assembling a build by hand:

```bash
npm create melonjs@latest my-game
```

The project name is required — without it the command prints its usage and
exits. It downloads the melonJS TypeScript boilerplate (Vite, TypeScript and the
debug plugin already wired in), which saves you the top-level-await and
asset-path issues that a hand-rolled config usually hits first.

## Adding melonJS to an existing project

```bash
npm install melonjs
```

```js
import { Application, Sprite, loader } from "melonjs";
```

The package is a tree-shakeable ES module with TypeScript declarations included
and **no runtime dependencies**.

A CDN build exists for quick experiments, but not for production:

```html
<script type="module">
    import { Application } from "https://cdn.jsdelivr.net/npm/melonjs@20/+esm";
</script>
```

## Browser support and transpiling

The published bundle targets **ES2022** and uses private class members. A browser
that predates that **cannot parse the file at all** — it fails at load, not when
a feature is used, so the symptom is a blank page with a syntax error.

To support older browsers, transpile melonJS **together with your own code**.
The usual trap is that build setups skip `node_modules` by default, leaving
melonJS untouched however low you set your target:

```js
// vite.config.js — esbuild downlevels dependencies too
export default { build: { target: "es2020" } };
```

```js
// webpack: the default `exclude: /node_modules/` would skip melonjs
{ test: /\.js$/, exclude: /node_modules\/(?!melonjs)/, use: "babel-loader" }
```

Two caveats worth knowing:

- **Transpiling handles syntax only.** Built-in methods need separate polyfills;
  a bundler's `target` setting will never add them.
- Downlevelled private class members become `WeakMap` lookups, and melonJS uses
  them in the renderer's hot paths. This is a real trade, not a free switch.

## Native apps

**Capacitor** is the current recommendation for iOS and Android — see
`@melonjs/capacitor-plugin`. **Cordova** also works and is documented, but is the
older route.

The thing that breaks first in both is asset loading: the app is served from
`file://`, where `fetch()` cannot read local files. melonJS's loader falls back
to XHR for that scheme, so engine-loaded assets work — but any `fetch()` in
*your* game code will fail there.

## Mini-game platforms

**WeChat Mini Games** and **Facebook Instant Games** are both documented in the
wiki. Note that `device.platform.isWeixin` detects WeChat's **in-app browser**,
which is a normal WebView. WeChat *Mini Games* are a different runtime with no
DOM, and need platform-specific adaptation rather than just detection — the one
hook the engine offers is that the renderer adopts a `globalThis.canvas` when
the runtime's adapter provides one, instead of creating its own.

## Size

The whole engine is roughly **250 KB minzipped**. Tree-shaking helps less than
you might expect — the engine's subsystems reach each other, so a game importing
a handful of symbols still pulls most of it. Budget for the full figure.

Practical wins are in assets, not the engine: pack sprites into atlases, prefer
one tileset over several, and use `stream: true` for long music tracks so they
are not decoded into memory.

## Symptom → cause

| symptom | cause |
|---|---|
| blank page, syntax error in the console | browser older than the ES2022 target |
| transpiling changes nothing | build config excludes `node_modules` |
| assets 404 in a packaged native app | `fetch()` in game code — `file://` needs XHR |
| a built-in method is missing after transpiling | transpiling is syntax-only; polyfills are separate |
| bundle much larger than expected | tree-shaking recovers little — subsystems are interconnected |

## Related skills

- `melonjs` — the companion packages, including the Capacitor plugin
- `melonjs-getting-started` — the Application bootstrap the template produces
