---
name: melonjs-deployment
description: "Use this skill when packaging, shipping or scaffolding a melonJS game — starting a project with create-melonjs, building for the web, browser support and transpiling, and bundle size. For running inside a game portal, a native app, a mini-game runtime or with no DOM, use melonjs-platforms. Triggers on: create-melonjs, scaffold, new project, build, deploy, publish, browser support, transpile, ES2022, bundle size, tree-shaking."
license: MIT
---

# Starting and shipping a project

## Scaffolding

Start from the template rather than assembling a build by hand:

```bash
npm create melonjs@latest my-game
```

The project name is required — without it the command prints its usage and
exits — and it names a new directory: an existing one is refused. It downloads
the melonJS TypeScript boilerplate (Vite, TypeScript and the debug plugin
already wired in), which saves you the top-level-await and asset-path issues
that a hand-rolled config usually hits first. Then `npm install` and
`npm run dev` in that directory.

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

## Platforms: portals, native apps, mini-games, no DOM

Running inside a game portal (YouTube Playables, Facebook Instant Games), a
native app wrapper (Capacitor, Cordova), a mini-game runtime (WeChat Mini
Games), or with no DOM at all (nx.js on the Nintendo Switch, a Web Worker) is
covered by `melonjs-platforms`: each platform's setup, and the shared way of
handing pausing, saving and sound to the platform.

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
| a built-in method is missing after transpiling | transpiling is syntax-only; polyfills are separate |
| bundle much larger than expected | tree-shaking recovers little — subsystems are interconnected |

## Related skills

- `melonjs-platforms` — portals, native apps, mini-games and runtimes with no DOM
- `melonjs` — the companion packages, including the Capacitor plugin
- `melonjs-plugins` — registering the Capacitor plugin, and its helpers
- `melonjs-getting-started` — the Application bootstrap the template produces
