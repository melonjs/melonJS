---
name: melonjs-testing
description: "Use this skill to check that a melonJS game actually works before saying it does: running it in a headless browser, reading the console the engine writes, finding out which renderer the run got, driving the keyboard and the pointer, reading the game's state from outside, and taking a screenshot. Covers what a clean run looks like, the console lines that are noise, and why a game that passes on a software renderer has not been checked on a GPU. Triggers on: test the game, check it works, verify, does it run, headless, Playwright, Puppeteer, screenshot, console errors, end-to-end test, e2e, smoke test, automated test, CI, debug, nothing happens, blank screen, black screen, it does not work."
license: MIT
---

# Checking that a game works

> Most melonJS mistakes are silent: the game starts, logs nothing in red, and
> draws the wrong thing or nothing. Code that compiles has therefore told you
> very little. Run the game, read what the engine printed, and look at a
> frame, before reporting that it works.

## Run it in a headless browser

A scaffolded project is a Vite project: `npm run dev` serves it and prints the
address. Open that address with a browser automation library and collect what
the page says. With Playwright:

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

const lines = [];
page.on("console", (m) => lines.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => lines.push(`[pageerror] ${e}`));

await page.goto("http://localhost:5173/");
// the game is ready once init() has resolved (see below for `app`)
await page.waitForFunction(() => globalThis.app?.isInitialized === true);

await page.locator("canvas").screenshot({ path: "frame.png" });
console.log(lines.join("\n"));
await browser.close();
```

Collect **every** console message, whatever its type, and uncaught errors
through `pageerror`. Filtering on `error` alone misses the engine's own
complaints, most of which are warnings.

A headless page has the focus and runs its frames, so the game is not paused:
`requestAnimationFrame` fires, tweens and physics advance, and two screenshots
a second apart differ if anything moves.

## Let the harness reach the game

Module code is not reachable from outside the page. Put the application on
`globalThis`, in development only, and the harness can ask the game what it
thinks is going on rather than guess from pixels:

```js
const app = new Application(800, 600, { parent: "screen" });
await app.init();
if (import.meta.env.DEV) {
    globalThis.app = app;
}
```

```js
await page.evaluate(() => app.renderer.type);                // "WebGL2", "WebGPU" or "CANVAS"
await page.evaluate(() => app.world.getChildren().length);   // what is in the world
```

Expose a particular object the same way (`globalThis.player = player`) to read
its position or its state after driving it.

## Read the console the engine writes

A clean start prints, as plain `log` lines:

```
melonJS 2 (v20.17.0) | http://melonjs.org
WebGL2 renderer (ANGLE (…)) | Web Audio | pixel ratio 1 | desktop | landscape
resolution: requested 800x600 (SDR), got 800x600 (SDR)
physics: builtin
```

The second line names the renderer the run got: `WebGPU`, `WebGL2` or
`CANVAS`. Read it every time: the same code draws differently on each (see
below).

What to act on:

- **An uncaught error** (`pageerror`): the game stopped, or a callback did.
- **Text containing `is deprecated`.** A deprecation arrives as a collapsed
  group, of type `startGroupCollapsed`, whose text is the engine's message
  with its arguments after it (`melonJS: %s is deprecated since version %s,
  please use %s` then the names), followed by a `warning` that is only a
  stack trace. Filter on `warning` and you get an anonymous `Error at
  warning (…)`: match on the text of every message instead. The message
  names the replacement.
- **A `melonJS:` warning**, printed once however often it happens: a feature
  that is doing nothing on this renderer, an asset that failed to load, a
  setting that was ignored. Each skill's symptom table starts from these.

What is noise, in a headless browser:

- `No available adapters.` and `AUTO: WebGPU unavailable (…) — falling back`:
  the machine has no GPU the browser will use, so the engine took the next
  renderer. Expected; it tells you which one below.
- `GL Driver Message (…): GPU stall due to ReadPixels`: caused by the
  screenshot itself.
- `The AudioContext was not allowed to start`: no one has clicked yet. Sound
  starts after the first input, in a real browser too.

## Know which renderer you checked

A headless browser has no graphics card. What it falls back to depends on the
browser and how it was launched, and changes what the run proves:

| the console says | what was checked |
|---|---|
| `WebGL2 renderer (… SwiftShader …)` | the WebGL path, on a software rasterizer: shaders and post effects ran. Timings mean nothing. |
| `CANVAS renderer` | the fallback only. Shader effects, lit sprites, meshes and everything else that needs a GPU did **nothing**, silently. A screenshot without the effect you added is this, not a bug in your code. |
| `WebGPU renderer` | the WebGPU path. |

The engine refuses a software GPU by default (`failIfMajorPerformanceCaveat`),
which is how a run lands on Canvas. To check GPU features in a harness, accept
the slow context there and only there:

```js
const app = new Application(800, 600, {
    parent: "screen",
    // a test harness has no graphics card: take the software one
    failIfMajorPerformanceCaveat: import.meta.env.DEV ? false : true,
});
```

A run on WebGL says nothing about WebGPU, which the engine prefers on a real
machine. `melonjs-renderer-backends` covers pinning a backend (the `#webgl`,
`#webgpu` and `#canvas` fragments of the page's address do it without a code
change) and what each can and cannot do.

## Drive the keyboard and the pointer

Real input events reach the game, so drive it as a player would:

```js
// hold a key for half a second
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(500);
await page.keyboard.up("ArrowRight");

// click a point given in game coordinates: the canvas may be scaled
const box = await page.locator("canvas").boundingBox();
const toPage = (x, y, width, height) => [
    box.x + (x / width) * box.width,
    box.y + (y / height) * box.height,
];
await page.mouse.click(...toPage(160, 120, 320, 240));
```

Then check the effect on the game's own state, not only on the picture:

```js
const before = await page.evaluate(() => player.pos.x);
// … hold ArrowRight …
const after = await page.evaluate(() => player.pos.x);   // greater, or the binding is wrong
```

A key held for too short a time can fall between two frames: hold it across
several. To press one from inside the page instead, expose `input` as `app`
is and call `input.triggerKeyEvent(input.KEY.LEFT, true)`, then `false`. A renderable that never gets its pointer events has `isKinematic` left
at `true`, the third rule of `melonjs`.

## Look at a frame

`page.locator("canvas").screenshot()` captures what was drawn, on every
renderer. Take it after the scene has had time to start (assets load behind a
loading screen), and read it: an image is the only check for draw order,
scaling, an effect, a camera that looks at the wrong place.

To see the collision shapes and the bounds, register the debug panel in
development and toggle it before the screenshot (`melonjs-plugins`):

```js
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
plugin.register(DebugPanelPlugin, "debugPanel");   // toggled with S
```

## What a check has to cover

Before saying a game works, in this order:

1. The page loads with no `pageerror` and no text containing `is deprecated`.
2. The console header is there, and names the renderer you meant to check.
3. A screenshot after the loading screen shows the scene, not a blank canvas.
4. Each control does what it should, read from the game's state.
5. The path through the game you changed: a level change, a game over and a
   restart, whatever the task was about.

Say which of these you ran, and on which renderer. "It builds" is not one of
them.

## Symptom → cause

| symptom | cause |
|---|---|
| the harness waits for ever on `app.isInitialized` | `app` was never put on `globalThis`, or `init()` rejected: read the console |
| a blank canvas and a clean console | `await app.init()` is missing, or nothing was added to `app.world`: the first rule of `melonjs` |
| the effect just added is not in the screenshot | the run is on `CANVAS renderer`, where shader effects are inert: accept the software GPU in the harness |
| the only complaint is an anonymous `Error at warning (…)` | a deprecation, whose message is in the collapsed group before it: match console text on `is deprecated` |
| a key press does nothing in the harness, and works by hand | pressed and released inside one frame: hold it across several |
| a click lands beside its target | page coordinates were used as game coordinates: scale by the canvas's bounding box |
| the game runs in the harness and stalls for a user | timings on a software rasterizer mean nothing: measure on a real GPU (`melonjs-performance`) |
| it passes here and fails on a user's machine | the harness got WebGL and the user WebGPU, or the reverse: pin each with the address fragment and check both |

## Related skills

- `melonjs-renderer-backends` — which renderer a machine gets, and what each can do
- `melonjs-plugins` — the debug panel
- `melonjs-performance` — measuring, and why not on a software rasterizer
- `melonjs-input` — bindings, pointer events, `triggerKeyEvent`
