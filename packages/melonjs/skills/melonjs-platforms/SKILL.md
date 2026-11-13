---
name: melonjs-platforms
description: "Use this skill when a melonJS game runs somewhere other than a plain browser tab: a game portal (YouTube Playables, Facebook Instant Games), a mini-game runtime (WeChat Mini Games), a native app wrapper (Capacitor, Cordova), or a runtime with no DOM (nx.js on the Nintendo Switch, a Web Worker). Covers loading a portal's SDK, handing pausing to the platform (device.setFocusEvents versus the pauseOnBlur / stopOnBlur flags), saving to its cloud (save.createCloudStorage, save.setStorage), following its mute, its loading and ready signals, a frame that starts with no size, and the canvas setting with no page. Triggers on: YouTube Playables, ytgame, firstFrameReady, gameReady, Facebook Instant Games, FBInstant, Messenger, startGameAsync, WeChat mini game, wx, weapp-adapter, Capacitor, Cordova, native app, iOS, Android, nx.js, Nintendo Switch, Web Worker, OffscreenCanvas, no DOM, game portal, cloud save, platform pause, setFocusEvents, createCloudStorage."
license: MIT
---

# Platforms: portals, mini-games, native apps, no-DOM runtimes

A melonJS game is a web page, so it runs anywhere a browser does. Beyond that:

| platform | kind | melonJS | section |
|---|---|---|---|
| YouTube Playables | game portal (SDK) | 20.15+ for the integration below | [YouTube Playables](#youtube-playables) |
| Facebook Instant Games | game portal (SDK), also reached from Messenger | 20.15+ for the integration below | [Facebook Instant Games](#facebook-instant-games) |
| WeChat Mini Games | mini-game runtime; WeChat's adapter stands in for the DOM | 20.15+ | [WeChat Mini Games](#wechat-mini-games) |
| Capacitor, Cordova | native app wrapper (WebView) | any 20.x | [Native apps](#native-apps-capacitor-and-cordova) |
| nx.js (Nintendo Switch), Web Workers | runtime with no DOM | 20.14+, experimental | [Runtimes with no DOM](#runtimes-with-no-dom-nxjs-web-workers) |

The wiki has a page per platform: <https://github.com/melonjs/melonJS/wiki/Platforms>.

## The pattern when a platform is in charge

A portal or a native wrapper decides what a browser tab leaves to the game:
when the game is paused, where progress is saved, whether sound is on. Each is
handed over the same way on every platform.

### The SDK

A portal's SDK is a script it hosts. Load it in `index.html` **before** the
game, from the portal's URL. Never bundle it: portals reject bundles that do.

### Pausing: who reports it, and what the game does

Two separate settings:

| setting | decides | default |
|---|---|---|
| `device.setFocusEvents()` | **who** reports that the player left: the browser window (`blur`, `focus`, `visibilitychange`), or nobody, leaving it to the platform | the window |
| `app.pauseOnBlur`, `stopOnBlur`, `resumeOnFocus` | **what** the game does on every `event.BLUR` / `event.FOCUS`, wherever it comes from | pause on blur, resume on focus |

When the platform says when the game is in the foreground, stop the window
reporting and emit the engine's events from the platform's callbacks:

```js
device.setFocusEvents(false);
app.stopOnBlur = true;      // a pause stops the loop and the rendering; pauseOnBlur keeps drawing
app.pauseOnBlur = false;
platform.onPause(() => event.emit(event.BLUR));
platform.onResume(() => event.emit(event.FOCUS));
```

On `BLUR` melonJS pauses or stops the game, pauses the music track, mutes the
sound effects and releases held keys; `FOCUS` undoes exactly that, and leaves
alone a pause or a mute the game applied itself (a pause menu stays paused).

Two ways to get this wrong:

- **Turning the flags off** to stop the window pausing the game: they apply to
  the platform's `BLUR` too, so its pause then does nothing. Keep the flags;
  turn the window off with `setFocusEvents(false)`.
- **Calling `state.pause()` / `state.resume()`** from the platform's events:
  it fights the engine's own pause, and the resume undoes a pause the game
  applied itself, so a pause menu ends up with the game running behind it.

### Saving: the platform's cloud, or its own storage

`save` writes to `localStorage` by default. `save.setStorage()` points it
elsewhere, and the game keeps using `save` as usual:

- A **cloud save** (YouTube, Facebook) loads and saves asynchronously, in one
  piece. Load it before the game reads `save`, then hand it over through
  `save.createCloudStorage({ data, write })`. It holds the items in memory,
  saves the changes made together in one `write()`, one write at a time with
  the latest values (a portal that refuses a save while one is pending never
  sees two), retries a failed write with the next change, and `flush()` saves
  at once: call it on the platform's pause.
- A **storage that answers at once**, such as a native wrapper's, plugs into
  `setStorage()` directly, with its own `getItem`, `setItem` and `removeItem`.
  WeChat needs neither: its adapter's `localStorage` is WeChat's storage.

### Sound

A platform with its own mute (YouTube) expects the game to follow it, with
`audio.muteAll()` / `audio.unmuteAll()` from its callback. It then replaces the
game's own mute button: don't keep one.

### Loading and readiness

- `event.LOADER_PROGRESS` reports the loader's progress, 0 to 1.
- The first `event.GAME_AFTER_DRAW` while `state.isCurrent(state.LOADING)` is
  the loading screen's first frame.
- A stage's `onResetEvent()` is where the game becomes playable.

### The screen size

A portal's frame can start with **no height** and get its size later.
`new Application(innerWidth, innerHeight, ...)` then throws "width or height was
zero, Canvas could not be initialized". Start at a fixed size and let
`scaleMethod` (`"fit"`, `"flex"`) follow the frame; `app.resize()` re-measures
if the frame changes without a resize event.

## YouTube Playables

SDK: `<script src="https://www.youtube.com/game_api/v1"></script>`, first in
`index.html`. The global is `ytgame`; outside YouTube it does nothing, so test
`typeof ytgame !== "undefined" && ytgame.IN_PLAYABLES_ENV`.

```js
// cloud save: load first, saved back one save at a time
const cloud = save.createCloudStorage({
    data: await ytgame.game.loadData(),
    write: (items) => ytgame.game.saveData(JSON.stringify(items)),
});
save.setStorage(cloud);

// pause only when YouTube says so; save at once when it does
device.setFocusEvents(false);
app.stopOnBlur = true;
app.pauseOnBlur = false;
ytgame.system.onPause(() => { event.emit(event.BLUR); cloud.flush(); });
ytgame.system.onResume(() => event.emit(event.FOCUS));

// YouTube's mute wins
const setSound = (on) => (on ? audio.unmuteAll() : audio.muteAll());
setSound(ytgame.system.isAudioEnabled());
ytgame.system.onAudioEnabledChange(setSound);
```

- `ytgame.game.firstFrameReady()` while a loading screen is drawn (the first
  `GAME_AFTER_DRAW` in `LOADING`), then `ytgame.game.gameReady()` once
  playable, never before. Both are required.
- The rules forbid pausing on the page's visibility (hence
  `setFocusEvents(false)`), and any save outside the cloud save.
- `sendScore({ value })` takes an integer; the best score sent must match the
  best in the save. `requestRewardedAd(rewardId)` uses a fixed ID per reward
  type; reward only on `true`. `getLanguage()` gives the YouTube language.
- Input: touch and mouse required, keyboard recommended. melonJS UI buttons
  take all three; `button.focus()` turns on arrow-key navigation.
- Limits: 30 MiB before `gameReady()` (15 recommended), 30 MiB per file (512 KiB
  recommended), 250 MiB total, 3 MiB of save; file names `[A-Za-z0-9_.-]` only.
- YouTube serves the game with a strict `Content-Security-Policy` (scripts from
  the game and the SDK only, requests to the game's own origin). The SDK Test
  Suite guide has the exact header; send it from the local dev server.
- Test in Google's SDK Test Suite with the **production build** (a dev
  server's `/@vite/client` fails the file name check); Chrome asks to allow
  local network access.

## Facebook Instant Games

Instant Games run in the Facebook app, on facebook.com/gaming, and are found
from Messenger. Current SDK: **8.0**,
`<script src="https://connect.facebook.net/en_US/fbinstant.8.0.js"></script>`
before the game, never bundled. The bundle needs `index.html` and
`fbapp-config.json` (with `instant_games.navigation_menu_version`) at the root
of the zip.

```js
await FBInstant.initializeAsync();     // before any other SDK call

const app = new Application(360, 640, { parent: "screen", scaleMethod: "fit" });
device.setFocusEvents(false);
app.stopOnBlur = true;
app.pauseOnBlur = false;
FBInstant.onPause(() => event.emit(event.BLUR));
FBInstant.onResume(() => event.emit(event.FOCUS));
await app.init();

const { save: data } = await FBInstant.player.getDataAsync(["save"]);
save.setStorage(save.createCloudStorage({
    data,
    write: (items) => FBInstant.player.setDataAsync({ save: items }),
}));

event.on(event.LOADER_PROGRESS, (p) => FBInstant.setLoadingProgress(Math.round(p * 100)));
await loader.preload(resources);
state.set(state.PLAY, new PlayScreen());
await FBInstant.startGameAsync();
state.change(state.PLAY, true);
```

- **SDK 8.0 removed `FBInstant.player.getName()` and `getPhoto()`** (Meta's
  "Zero Permissions"): older code calling them throws a `TypeError`.
- `setDataAsync()` rejects with `PENDING_REQUEST` while a save is pending:
  `createCloudStorage()` never sends two. Up to 1 MB per player.
- `getLocale()` uses an underscore (`"en_US"`); valid after `initializeAsync()`.
- Ads: `getInterstitialAdAsync(placementId)` / `getRewardedVideoAsync(placementId)`,
  then `loadAsync()` and `showAsync()`; failing is normal, carry on. Banner ads
  are being removed by 31 March 2027.
- **Outside Facebook the SDK loads but `initializeAsync()` never resolves**: a
  game run on its own waits forever on a blank page. `FBInstant` is defined, so
  "mock it when `typeof FBInstant === 'undefined'`" does not help. Swap in a
  local stand-in when the page is not in a frame (`window.self === window.top`):
  Facebook always runs the game in one.
- Real tests run in Facebook's player:
  `https://www.facebook.com/embed/instantgames/APP_ID/player?game_url=https://localhost:8080`,
  served over HTTPS, logged in with a role on the app.

## WeChat Mini Games

WeChat runs a mini-game outside any browser. Its adapter, **weapp-adapter**
(WeChat's adapter guide, or `miniprogram/js/libs/weapp-adapter.js` in
`wechat-miniprogram/minigame-demo`), adds a stand-in `document`, `Image`
(`wx.createImage()`), `Audio` (`wx.createInnerAudioContext()`), `localStorage`
(WeChat's storage), touch events and the global on-screen `canvas`. melonJS runs
on it from **20.15**, taking its usual browser path against those stand-ins. The
adapter must run **before** melonJS, which reads them as it loads:

```js
// game.js, the entry point WeChat runs: CommonJS, not ES modules
require("./js/weapp-adapter.js");
require("./js/game.bundle.js");   // the game + melonJS: esbuild --bundle --format=iife
```

```js
// the game's entry, before bundling
import "./wx-fetch.js";
import { Application, event, video } from "melonjs";

async function start() {          // an IIFE bundle has no top-level await
    const app = new Application(360, 640, {
        canvas: GameGlobal.canvas,     // the adapter's on-screen canvas
        renderer: video.AUTO,          // WebGL 2 where WeChat has it, else Canvas
        scale: "auto",
        scaleMethod: "flex-height",    // never "fit" or "stretch" here
    });
    await app.init();
    wx.onHide(() => event.emit(event.BLUR));   // nothing else reports it
    wx.onShow(() => event.emit(event.FOCUS));
    // preload and start as usual
}
start();
```

WeChat has **no `fetch`**. melonJS loads images through the adapter's `Image`
(WeChat has no `createImageBitmap` either), but reads JSON, Tiled maps, text and
binary files with `fetch`. Define one over WeChat's file system; the loader only
reads `ok`, `status`, `statusText` and calls `text()`, `json()` or
`arrayBuffer()`:

```js
// wx-fetch.js
const files = wx.getFileSystemManager();
const read = (filePath, encoding) => new Promise((resolve, reject) => {
    files.readFile({ filePath, encoding,
        success: (r) => resolve(r.data), fail: (r) => reject(new Error(r.errMsg)) });
});
GameGlobal.fetch = async (url) => {
    const path = url.split("?")[0];
    try { files.accessSync(path); } catch { return { ok: false, status: 404, statusText: "Not Found" }; }
    return { ok: true, status: 200, statusText: "OK",
        text: () => read(path, "utf8"),
        json: async () => JSON.parse(await read(path, "utf8")),
        arrayBuffer: () => read(path) };
};
```

- **Scaling**: WeChat stretches its canvas over the whole screen, and melonJS
  keeps the size of a canvas it is given. Use a `scaleMethod` that gives the
  canvas the screen's shape: `"flex-height"` (portrait, fixed width),
  `"flex-width"` (landscape), `"flex"`, `"fill-min"`, `"fill-max"`. With
  `"fit"` or `"stretch"` the picture is distorted and touches land off by the
  difference in shape.
- **Paths** start at the package root (`data/map/level.json`); `./` is not
  found. WeChat packages only some file types, not `.tmj`, `.tmx` or `.tsx`:
  save Tiled maps as JSON under a `.json` name, tilesets embedded. 4 MB main
  package, 30 MB in all; more from an allow-listed HTTPS server
  (`wx.downloadFile()`), which the `fetch` above does not cover.
- **Saving**: `save` works unchanged (`localStorage` is `wx.setStorageSync()`:
  1 MB per key, 10 MB in all).
- **Sound**: no `AudioContext`, so melonJS plays through the adapter's `Audio`:
  playback, volume, loop and mute. `tone()`, `noise()`, the effects and 3D sound
  need Web Audio and are not available. iOS plays no Ogg: `audio.init("mp3")`.
- **Fonts**: no `FontFace`, so a `fontface` asset fails: `wx.loadFont(path)`
  returns a family name for `Text`, or use `BitmapText`.
- **Not there**: `DOMParser` (XML maps), the `video` and `script` asset types,
  WebGPU (Android only, through WeChat's own `wx.getGPU()`). No `eval` or
  `new Function` is allowed; melonJS uses neither.

Verified against WeChat's documentation, its API typings
(`wechat-miniprogram/minigame-api-typings`) and the adapter's source, and run
against the real adapter over a simulated `wx`; not yet on a device.

## Native apps: Capacitor and Cordova

**Capacitor** is the current recommendation for iOS and Android. A melonJS game
runs in its WebView unchanged; `@melonjs/capacitor-plugin` adds the native
lifecycle: the game pauses when the app goes to the background and resumes when
it comes back (but stays paused if the player had paused it, from 1.0.1), the
hardware back button reaches the current stage (`bindStageBack`), and
orientation lock and the splash screen are one call each. The boilerplate's
Vite build writes to `dist/`, Capacitor's default `webDir`. See
`melonjs-plugins` for its options. **Cordova** also works and is documented,
but is the older route.

Without any plugin, the game already pauses in the background: the WebView
fires `visibilitychange`, which melonJS reports as `event.BLUR`, and
`pauseOnBlur` (on by default) does the rest. If a WebView does not fire it
reliably, make the native events the source instead, as above: Cordova's
`pause` / `resume` document events, `setFocusEvents(false)`, and
`event.emit(event.BLUR)` / `event.emit(event.FOCUS)`.

The thing that breaks first under Cordova is asset loading: the app is served
from `file://`, where `fetch()` cannot read local files. melonJS's loader falls
back to XHR for that scheme, so engine-loaded assets work — but any `fetch()` in
*your* game code will fail there. Capacitor serves the app from a local web
server instead (`https://localhost` on Android, `capacitor://localhost` on
iOS), so `fetch()` works there.

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
  The `video` and `script` asset types need a DOM and fail, and so do SVG
  images in a worker, which load through `Image`.
- **Input**: touch arrives as `TouchEvent`s on the canvas, and melonJS reports
  them as pointer events as usual. There is no mouse. On nx.js the Joy-Con are
  standard gamepads (`melonjs-input`), and keyboard events only come from a
  USB keyboard.
- **Audio** needs no gesture to unlock. nx.js cannot say which formats it
  decodes (its `Audio` has no `canPlayType`), so melonJS tries the first
  extension given to `audio.init()`: list one FFmpeg decodes, such as
  `audio.init("ogg,mp3")`. nx.js's Web Audio has no `PannerNode`,
  `OscillatorNode`, `BiquadFilterNode` or effect nodes, so plain playback,
  volume and `stereo()` work, but 3D `position()` / `panner()`, `tone()` /
  `noise()` and the reverb / echo / compressor effects throw there (see
  `melonjs-audio`).
- **Fonts**: nx.js's `FontFace` only takes the font's bytes, so a `fontface`
  asset (a URL) fails there. Load the bytes yourself and add the face before
  using it in a `Text`. The face is ready once made, and its `load()` throws
  on nx.js, so do not call it:
  `fonts.add(new FontFace("Pixel", await (await fetch("font.ttf")).arrayBuffer()))`.
- **Save data**: melonJS checks `localStorage` when it loads. On nx.js, if the
  app declares user save data (`userAccountSaveDataSize` in its NACP), that
  first read is when the Switch asks the player to pick a user profile. An app
  that saves nothing should leave that size at 0, so no picker appears.
- A Web Worker has no `Image`, `Audio` or `AudioContext` of its own, and no
  input events: draw there, and keep input and sound on the page.

The engine's own test, `tests/nxjs-compatibility.spec.js`, runs a game in a
Web Worker made to look like nx.js. It is the reference for what is expected
to work, not a test on Switch hardware.

## Symptom → cause

| symptom | cause |
|---|---|
| "width or height was zero, Canvas could not be initialized" when the game starts inside a portal | the application was sized from a frame with no height yet: start from a fixed size, let `scaleMethod` follow |
| the game pauses when the player switches tab, on a portal that forbids it | the window still reports focus: `device.setFocusEvents(false)` and emit `BLUR` / `FOCUS` from the platform's callbacks |
| the platform's pause does nothing, after turning `pauseOnBlur` off | the flags apply to every `BLUR`, the platform's included: keep them, turn the window off instead |
| a pause menu is running again after the app returns from the background | `state.resume()` called from a platform event undid the game's own pause; emit `event.FOCUS` instead, or capacitor-plugin < 1.0.1 |
| the platform pauses the game but it keeps drawing | `pauseOnBlur` keeps drawing: `stopOnBlur = true`, `pauseOnBlur = false` |
| `Cannot read properties of null (reading 'getItem')` at boot in a sandboxed frame (YouTube's Test Suite) | `localStorage` is `null` there; fixed in melonJS 20.15 |
| a cloud save comes back with the defaults | read before it loaded: await the platform's load, then `save.createCloudStorage()` |
| `PENDING_REQUEST` from Facebook's `setDataAsync()` | a hand-written storage saving on every change; `save.createCloudStorage()` saves one at a time |
| `FBInstant.player.getName is not a function` | removed in Instant Games SDK 8.0 |
| an Instant Game run locally stays on a blank page | `initializeAsync()` never resolves outside Facebook: use a local stand-in when `window.self === window.top` |
| YouTube's Test Suite fails "filenames must only contain supported characters" | a dev server's internal files: test the production build |
| assets 404 in a packaged Cordova app | `fetch()` in game code — `file://` needs XHR |
| `Cannot read properties of undefined (reading 'body')` from `new Application` in nx.js or a Web Worker | melonJS older than 20.14, which needed a DOM; update |
| WebGL 2 "could not be created" on nx.js | another context was taken on `screen` first: it holds one context kind, so let the Application be the first to call `getContext` on it |
| the game is drawn small, or cropped, on nx.js | its resolution is not the screen's 1280x720; with no page, `scale: "auto"` does not fit it |
| an XML Tiled map fails with "needs DOMParser" | no DOM to parse XML with: export the map and its tilesets as JSON (`.tmj` / `.tsj`) |
| a `fontface` asset fails on nx.js | nx.js's `FontFace` takes bytes, not a URL: fetch the file and add the face to `fonts` yourself |
| spatial sound, `tone()` or `noise()` throws "Method not implemented" on nx.js | the node it needs is missing from nx.js's Web Audio; use `stereo()` and recorded sounds |
| images fail on WeChat, "createImageBitmap is not a function" | melonJS before 20.15 |
| `video.WEBGL` throws, or `video.AUTO` picks Canvas, on WeChat | melonJS before 20.15 required a global `WebGL2RenderingContext`, which WeChat lacks |
| "HTMLAudioElement is not defined" when a WeChat game pauses or mutes | melonJS before 20.15 |
| JSON files and Tiled maps fail on WeChat, "fetch is not defined" | WeChat has no `fetch`: define one over `wx.getFileSystemManager()` |
| a file is not found on WeChat | a `./` path, or a type WeChat does not package (`.tmj`): rename maps to `.json` |
| a WeChat game is distorted and touches land beside the finger | `scaleMethod` `"fit"` or `"stretch"`: use a `"flex"` or `"fill"` method |
| a WeChat game keeps running when the player leaves | nothing emits `BLUR` there: emit it from `wx.onHide()`, `FOCUS` from `wx.onShow()` |

## Related skills

- `melonjs-scenes-and-state` — `save`, `setStorage()` / `createCloudStorage()`, and pausing in depth
- `melonjs-deployment` — scaffolding, building, browser support and size
- `melonjs-plugins` — the Capacitor plugin's options and helpers
- `melonjs-audio` — muting, and what the audio unlock needs
- `melonjs-display-and-scaling` — `scaleMethod` and what it measures
