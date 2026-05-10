# @melonjs/capacitor-plugin

A [melonJS](https://melonjs.org/) plugin that bridges [Capacitor](https://capacitorjs.com/)'s native lifecycle and hardware back-button events into the engine — so a melonJS game wrapped as an iOS or Android app pauses on background, resumes on foreground, and lets each `Stage` intercept the hardware back press without manual `event.on` / `event.off` boilerplate.

melonJS games already run inside Capacitor's WebView with zero engine changes — this plugin is purely an ergonomics layer over the standard `@capacitor/app` events, plus optional helpers for orientation lock and splash-screen dismissal.

## Install

```sh
npm install melonjs @melonjs/capacitor-plugin @capacitor/app
```

The plugin's required runtime peer is `@capacitor/app`. The orientation and splash helpers are optional and pull their respective peer deps lazily — only install them if you call those helpers:

```sh
# only if you call lockOrientation / unlockOrientation
npm install @capacitor/screen-orientation

# only if you call hideSplash
npm install @capacitor/splash-screen
```

## Quick start

```ts
import { Application, plugin, state, Stage } from "melonjs";
import {
    CapacitorPlugin,
    bindStageBack,
    hideSplash,
    lockOrientation,
} from "@melonjs/capacitor-plugin";

await lockOrientation("landscape");

// `new Application(...)` boots the engine and creates the renderer
// in a single call — replaces the legacy `boot()` + `video.init(...)`
// pair.
const app = new Application(1024, 768, {
    parent: "screen",
    scaleMethod: "flex",
});

// One register call wires lifecycle (appStateChange → state.pause/resume)
// and forwards hardware back-button presses into the engine event bus.
plugin.register(CapacitorPlugin, "capacitor", {
    pauseAudio: true,
});

class PlayStage extends Stage {
    onResetEvent() {
        // Bind a back-button handler that lives as long as this stage.
        // Calling `evt.preventDefault()` keeps the engine from running
        // the default action (App.exitApp).
        bindStageBack(this, (evt) => {
            state.change(state.MENU);
            evt.preventDefault();
        });
    }
}

state.set(state.PLAY, new PlayStage());
state.change(state.PLAY);
await hideSplash({ fadeOutDuration: 300 });
```

## API

### `CapacitorPlugin`

A `BasePlugin` subclass. Register it via the engine's plugin system:

```ts
plugin.register(CapacitorPlugin, "capacitor", options?);
```

Once registered the instance is reachable at `plugin.cache.capacitor` (or `plugin.get(CapacitorPlugin)`).

Options (`ConnectCapacitorOptions`):

| key | default | description |
|---|---|---|
| `pauseOnBackground` | `true` | When the OS sends the app to background, call `state.pause()`; resume on foreground. |
| `pauseAudio` | `true` | Forwarded to `state.pause(music)` / `state.resume(music)`. Set `false` if you want background audio to keep playing. |
| `forwardBackButton` | `true` | Forward Capacitor's `backButton` event to the engine bus so subscribers can intercept it. |
| `onUnhandledBack` | `() => App.exitApp()` | Called when no subscriber calls `evt.preventDefault()`. Override to e.g. show a confirm dialog. |

The instance exposes a `teardown()` method that removes every Capacitor listener it installed. Mostly useful for hot-reload and unit tests.

### `bindStageBack(stage, handler)`

Subscribe a hardware-back handler whose lifetime matches the given `Stage`'s reset/destroy lifecycle. The handler is attached in `onResetEvent` and detached in `onDestroyEvent` automatically.

The handler receives a `CapacitorBackEvent`:

```ts
interface CapacitorBackEvent {
    readonly defaultPrevented: boolean;
    preventDefault(): void;
}
```

If any handler calls `evt.preventDefault()`, the plugin's `onUnhandledBack` action is suppressed for that press.

### `onBackButton(handler)`

Subscribe a global handler (not tied to any stage). Returns an unsubscribe function. Useful if you want a back-button policy that applies regardless of the active stage. Most code should prefer `bindStageBack` for per-screen behavior.

### `lockOrientation(o)` / `unlockOrientation()`

Thin lazy wrappers around `@capacitor/screen-orientation`. The dependency is `import()`-ed only when these are called.

### `hideSplash(opts?)`

Thin lazy wrapper around `@capacitor/splash-screen`'s `hide()`. Same lazy-import pattern.

## Capacitor project setup

This plugin is a runtime adapter — it doesn't replace the standard Capacitor project setup. After scaffolding a melonJS game (e.g. via `npm create melonjs my-game`) wire Capacitor as you normally would:

```sh
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/app
npx cap init my-game com.example.mygame
npx cap add ios
npx cap add android
npm run build
npx cap copy
npx cap open ios       # or: npx cap open android
```

melonJS's Vite-based build outputs to `dist/`, which is Capacitor's default `webDir`. No additional config required.

## License

MIT — see `LICENSE`.
