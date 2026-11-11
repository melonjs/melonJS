---
name: melonjs-deployment
description: "Use this skill when packaging, shipping or scaffolding a melonJS game — starting a project with create-melonjs, building for the web, wrapping as a native app with Capacitor or Cordova, publishing to WeChat Mini Games or Facebook Instant Games, running with no DOM (nx.js on the Nintendo Switch, a Web Worker), browser support and transpiling. Triggers on: create-melonjs, scaffold, new project, build, deploy, publish, Capacitor, Cordova, native app, iOS, Android, WeChat, Instant Games, nx.js, Nintendo Switch, homebrew, no DOM, Web Worker, OffscreenCanvas, browser support, transpile, ES2022, bundle size, tree-shaking."
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

## Native apps

**Capacitor** is the current recommendation for iOS and Android. A melonJS game
runs in its WebView unchanged; `@melonjs/capacitor-plugin` adds the native
lifecycle: the game pauses when the app goes to the background and resumes when
it comes back (but stays paused if the player had paused it, from 1.0.1), the
hardware back button reaches the current stage (`bindStageBack`), and
orientation lock and the splash screen are one call each. The boilerplate's
Vite build writes to `dist/`, Capacitor's default `webDir`. See
`melonjs-plugins` for its options. **Cordova** also works and is documented,
but is the older route.

The thing that breaks first under Cordova is asset loading: the app is served
from `file://`, where `fetch()` cannot read local files. melonJS's loader falls
back to XHR for that scheme, so engine-loaded assets work — but any `fetch()` in
*your* game code will fail there. Capacitor serves the app from a local web
server instead (`https://localhost` on Android, `capacitor://localhost` on
iOS), so `fetch()` works there.

## Mini-game platforms

**WeChat Mini Games** and **Facebook Instant Games** are both documented in the
wiki. Note that `device.platform.isWeixin` detects WeChat's **in-app browser**,
which is a normal WebView. WeChat *Mini Games* are a different runtime with no
DOM, and need platform-specific adaptation rather than just detection — the one
hook the engine offers is that the renderer adopts a `globalThis.canvas` when
the runtime's adapter provides one, instead of creating its own. What the engine
does without a DOM is described in the next section.

## Runtimes with no DOM: nx.js, Web Workers

melonJS (from 20.14) runs where there is no `document`: in a Web Worker, and in
runtimes that implement the web APIs a game uses but no page around it, such as
[nx.js](https://github.com/TooTallNate/nx.js), JavaScript homebrew for the
Nintendo Switch. There is no `<canvas>` to create there, so hand the
Application the canvas to draw to. On nx.js that is the global `screen`, the
1280x720 display:

```js
import { Application, video } from "melonjs";

const app = new Application(1280, 720, {
    canvas: screen,          // nx.js's display; an OffscreenCanvas in a worker
    renderer: video.AUTO,    // WebGL 2 where the runtime has it, else Canvas
    scale: 1,
});
await app.init();
```

What changes without a DOM:

- **Design at the canvas's size.** There is no page to fit, so
  `scale: "auto"` measures nothing and the game is drawn at the scale it was
  given. On the Switch that is 1280x720 (the console scales it when docked).
- `app.parentElement` is `undefined`: the canvas is the display and is not
  attached to anything. Fullscreen and pointer lock do nothing.
- **Assets** load through `fetch` and `createImageBitmap` as in a browser; on
  nx.js a relative path resolves inside the app's RomFS. Tiled maps must be
  **JSON** (`.tmj` / `.tsj`): XML needs `DOMParser` (see `melonjs-tilemaps`).
  The `video` and `script` asset types need a DOM and fail.
- **Input**: touch arrives as `TouchEvent`s on the canvas, and melonJS reports
  them as pointer events as usual. There is no mouse. On nx.js the Joy-Con are
  standard gamepads (`melonjs-input`), and keyboard events only come from a
  USB keyboard.
- **Audio** needs no gesture to unlock. nx.js's Web Audio has no `PannerNode`,
  `OscillatorNode`, `BiquadFilterNode` or effect nodes, so plain playback,
  volume and `stereo()` work, but 3D `position()` / `panner()`, `tone()` /
  `noise()` and the reverb / echo / compressor effects throw there (see
  `melonjs-audio`).
- **Fonts**: nx.js's `FontFace` only takes the font's bytes, so a `fontface`
  asset (a URL) fails there. Load the bytes yourself and add the face before
  using it in a `Text`:
  `fonts.add(await new FontFace("Pixel", await (await fetch("font.ttf")).arrayBuffer()).load())`.
- A Web Worker has no `Image`, `Audio` or `AudioContext` of its own: draw
  there, and play sound from the page.

The engine's own test, `tests/nxjs-compatibility.spec.js`, runs a game in a
Web Worker made to look like nx.js. It is the reference for what is expected
to work, not a test on Switch hardware.

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
| assets 404 in a packaged Cordova app | `fetch()` in game code — `file://` needs XHR |
| a built-in method is missing after transpiling | transpiling is syntax-only; polyfills are separate |
| bundle much larger than expected | tree-shaking recovers little — subsystems are interconnected |
| a native app paused from its menu is running again after coming back from the background | capacitor-plugin < 1.0.1 resumed on every return; upgrade |
| `Cannot read properties of undefined (reading 'body')` from `new Application` in nx.js or a Web Worker | melonJS older than 20.14, which needed a DOM; update |
| WebGL 2 "could not be created" on nx.js | another context was taken on `screen` first: it holds one context kind, so let the Application be the first to call `getContext` on it |
| the game is drawn small, or cropped, on nx.js | its resolution is not the screen's 1280x720; with no page, `scale: "auto"` does not fit it |
| an XML Tiled map fails with "needs DOMParser" | no DOM to parse XML with: export the map and its tilesets as JSON (`.tmj` / `.tsj`) |
| a `fontface` asset fails on nx.js | nx.js's `FontFace` takes bytes, not a URL: fetch the file and add the face to `fonts` yourself |
| spatial sound, `tone()` or `noise()` throws "Method not implemented" on nx.js | the node it needs is missing from nx.js's Web Audio; use `stereo()` and recorded sounds |

## Related skills

- `melonjs` — the companion packages, including the Capacitor plugin
- `melonjs-plugins` — registering the Capacitor plugin, and its helpers
- `melonjs-getting-started` — the Application bootstrap the template produces
