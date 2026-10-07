---
name: melonjs-audio
description: "Use this skill for sound and music in melonJS — loading audio, playing effects, background tracks, audio sprites, volume and muting, spatial audio, procedural tone/noise generation, and effects such as reverb or a compressor on the whole mix. Covers the mandatory audio.init format list, the directory-not-file src convention, playTrack versus play, the fixed listener and pixel-scale distances of positional sound, and browser autoplay unlocking. Triggers on: audio, sound, audio.init, audio.play, playTrack, stopTrack, audio.load, sfx, music, volume, mute, fade, rate, pitch, sprite audio, stereo, panner, position, listener, refDistance, reverb, echo, delay, compressor, distortion, filter, audio effect, audio.tone, audio.noise, getAudioContext, getMasterGain, hasAudio, hasFormat, autoplay."
license: MIT
---

# Audio

## Two setup rules

```js
import { audio, loader } from "melonjs";

audio.init("mp3,ogg");                      // 1. BEFORE preloading any audio

await loader.preload([
    { name: "cling", type: "audio", src: "data/sfx/" },   // 2. a PREFIX, not a file
]);
```

1. **`audio.init(format)` must run before any audio asset is preloaded**, and
   lists the formats you actually ship. Preloading first throws
   `target audio extension(s) should be set through me.audio.init() before
   calling the preloader.` It returns `false` when no audio backend is
   available, so it is worth checking. The format list defaults to `"mp3"`.
2. **`src` is a prefix, not a file.** The loader appends the asset `name` plus
   each configured extension and uses the first that loads — so
   `data/sfx/` + `cling` + `mp3` → `data/sfx/cling.mp3`. Passing a full filename
   gives you a 404. A `data:audio/...` URL is the one exception: it is used
   verbatim, prefix and extension skipped.

`audio.hasAudio()` says whether the browser can play audio at all, and
`audio.hasFormat("ogg")` whether it can play one codec — useful for choosing
the `init` list or hiding a sound toggle on a device with no audio.

Order matters — melonJS tries the listed formats left to right, so put the
preferred one first. Two formats (`"webm,mp3"` or `"mp3,ogg"`) is the usual
belt-and-braces for codec coverage. Accepted tokens: `mp3`, `mpeg`, `opus`,
`ogg`, `oga`, `wav`, `aac`, `caf`, `m4a`, `m4b`, `mp4`, `weba`, `webm`, `dolby`,
`flac`.

## Effects versus music

```js
audio.play("cling");                    // fire and forget
audio.play("cling", false, null, 0.5);  // loop, onend, volume
const id = audio.play("engine", true);  // looping; keep the id to stop it

audio.playTrack("theme");               // background music
audio.stopTrack();
```

Use **`playTrack`** for music, not `play`. `playTrack(name, volume?)` always
loops, and it records the name as the current track — which is what
`app.pauseOnBlur` / `resumeOnFocus` / `stopOnBlur` act on, via
`state.pause(true)` → `pauseTrack()`. `stopTrack()`, `pauseTrack()`,
`resumeTrack()` and `getCurrentTrack()` all read that same single slot, so there
is only ever one current track. Stop it in `onDestroyEvent`.

Every per-clip function throws `audio clip <name> does not exist` if the clip was
never loaded, and `play` additionally throws when a named sprite region is
missing.

## Audio sprites

One file carrying many effects, with named regions in milliseconds:

```js
await loader.preload([{
    name: "sfx", type: "audio", src: "data/sfx/",
    sprite: { jump: [0, 450], hit: [2000, 250], music: [4000, 12000, true] },
}]);

audio.play("sfx", { sprite: "jump" });
```

The optional third element marks a region as looping. `play()`'s second argument
takes either the original `loop` boolean or a `PlayOptions` object
(`sprite`, `loop`, `onend`, `volume`, plus the spatial `follow`, `at` and
`stopWithTarget`) — both forms work. Object fields win over the positional
`onend` / `volume` arguments when both are supplied.

## Clip state

```js
audio.duration("theme");        // seconds — 0 while still loading
audio.duration("sfx", id);      // duration of the region THAT instance plays
audio.playing("theme");         // is anything playing?
audio.playing("theme", id);     // is that instance playing?
audio.state("theme");           // "unloaded" | "loading" | "loaded"
```

`stop()`, `pause()` and `resume()` take an optional instance `id` too; omit it
and the whole group is affected. `audio.stop()` with no arguments at all stops
every sound. `audio.seek(name)` reads the position, `audio.seek(name, s, id?)`
writes it; `audio.rate(name, r, id?)` changes speed and pitch together
(`0.5`..`4.0`, `1` is normal) and `audio.fade(name, from, to, ms, id?)` ramps
the volume (`0`..`1`, over milliseconds).

## Volume and muting

```js
audio.setVolume(0.5);           // global, 0..1
audio.getVolume();              // read it back
audio.mute("cling");            // one clip  — mute(name, id?, shouldMute = true)
audio.unmute("cling");
audio.muteAll();                // everything (audio.disable() is an alias)
audio.unmuteAll();              // (audio.enable() is an alias)
audio.muted();                  // global mute state
```

`audio.unload(name)` / `audio.unloadAll()` free the decoded buffers; `unload`
also clears the current-track pointer if it named that clip.

### Losing focus mutes everything

When the window loses focus the engine mutes all audio, and unmutes it on
focus. That covers sound effects, procedural `tone` / `noise` and the mixer
effects, not just the music track that `state.pause()` pauses. Set
`pauseOnBlur: false` in the application settings if a clip has to keep playing
in the background.

## Spatial audio

```js
audio.position("engine", x, y, z);
audio.orientation("engine", x, y, z);
audio.stereo("engine", -1);     // -1 left … 1 right
audio.panner("engine", { coneInnerAngle: 90, /* … */ });
```

`position(name, x, y = 0, z = -0.5, id?)` and
`orientation(name, x, y, z, id?)` both default `id` to "the whole group".
Called with just the clip name, each of the four returns the current value —
`stereo` gives `0` and `position` gives `[0, 0, 0]` before they have ever been
set.

### Let the engine place the sound: `follow` and `at`

The shortest path to positional audio is a play option. Both take **world
pixels**, the same numbers as `pos.x` / `pos.y`, and the engine converts to
audio space for you:

```js
// tracks the renderable every frame, and stops when it is destroyed
audio.play("ufo", { follow: this, stopWithTarget: true });

// pinned to a fixed world point
audio.play("portal", { at: { x: 1200, y: 480 } });
```

`follow` re-reads the target's **absolute** position each frame, so a renderable
nested in a moving container is placed correctly. `stopWithTarget` is what you
want for a sound that belongs to an entity: without it a looping clip on a
destroyed renderable keeps playing from wherever it last was. `audio.unfollow(id)`
detaches a sound and leaves it playing where it is.

### Move the listener, don't do the subtraction yourself

```js
audio.setListener(player);                  // tracked every frame
audio.listener(x, y, z);                    // or place it by hand
audio.listener();                           // → [x, y, z] in world pixels
audio.listenerOrientation(fx, fy, fz, ux, uy, uz);
audio.setListener(null);                    // stop tracking
```

With a listener in the world, source positions are **absolute world
coordinates**, not offsets. The older idiom — passing `source.pos.x -
player.pos.x` every frame with the ear stuck at the origin — still works, but
only if you leave the listener at `(0, 0, 0)`; mixing the two double-counts the
player's position.

`setListener` places the ear at the target's absolute position after the world
updates. It does not touch orientation, so a side-scroller keeps the default
"facing into the screen" and gets left-right panning plus distance falloff with
one call.

**Y is down.** Every one of these calls takes and returns melonJS world
coordinates, where y grows downward; the Y-up flip Web Audio wants happens
inside the engine. Pass `pos.y` as it is.

### The defaults are tuned for pixels

`audio.setSpatialDefaults()` / `getSpatialDefaults()` set the panner attributes
every new voice starts from, and the shipped defaults already assume a 2D game
measured in pixels:

| attribute | default | why |
|---|---|---|
| `refDistance` | `240` | full volume out to roughly a few tiles |
| `maxDistance` | `10000` | inaudible past ~2000 px with the inverse model |
| `panningModel` | `"equalpower"` | cheap, and it does not smear a 2D mix |
| `distanceModel` | `"inverse"` | smooth rolloff |

So `audio.play("ufo", { follow: ufo })` is audible at a sane range with no
tuning. Widen or tighten the field once, globally:

```js
audio.setSpatialDefaults({ refDistance: 400, maxDistance: 20000 });
```

`audio.panner(name, attrs, id?)` still overrides per clip or per voice, and it
merges over the current values rather than replacing them, so writing one field
no longer resets the rest. Called without an `id` it writes the **group**
defaults, which is what a clip-wide tuning call looks like.

For a 3D scene where front-to-back matters, `panningModel: "HRTF"` is worth the
cost; for a 2D one it mostly muddies the stereo image.

### `stereo` and `position`: last writer wins

Both drive the same per-instance panner node, and the engine swaps the node to
match whichever you called **last**: `stereo()` after `position()` gives you
plain left-right panning, and `position()` after `stereo()` gives you 3D
falloff. Neither silently does nothing any more, and the order you call them in
no longer matters.

Still pick one per voice and stay with it. A 2D game usually wants `stereo()`
alone; reach for `position()` (or `follow` / `at`) when distance falloff
matters.

**Spatial audio is WebAudio-only.** On a clip loaded with `stream: true` (or
`html5: true`) `stereo` / `position` / `orientation` return early and do
nothing — which is exactly the case for the long music tracks people reach for
first. `follow` and `at` are equally inert on a streamed clip.

## Procedural sound

For beeps, blips and noise without shipping files. Both take **one options
object**, and `duration` (in seconds) is required:

```js
audio.tone({ freq: 440, duration: 0.2, gain: 0.3, pan: -0.5 });
audio.tone({ freq: [440, 660, 880], duration: 0.4 });   // layered partials
audio.noise({ duration: 0.5, filter: { type: "lowpass", frequency: 800 } });
```

`tone` also takes `wave` (default `"sine"`), `attack` (`0.005`) and `pitchSlide`
(`1`). `noise` takes `type` (`"white"` | `"pink"` | `"brown"`, default
`"white"`), `attack`, `pan`, `filter` and `filterSweep`. `gain` defaults to `0.1`
on both.

### Sequencing: `delay`, not `setTimeout`

Both take `delay` — seconds before the sound starts, scheduled on the **audio
clock**. That is what builds a multi-part sound: a stinger's second note, an
explosion's double-tap.

```js
audio.tone({ freq: 392, duration: 0.12 });
audio.tone({ freq: 587, duration: 0.18, delay: 0.11 });
audio.tone({ freq: [784, 1176], duration: 0.75, delay: 0.23 });
```

Do not reach for `setTimeout` here. A timer fires on the main thread, so a busy
frame slips the note late and the sequence audibly loses time — the fault is
easy to blame on the sound design rather than the scheduling. `delay` is
sample-accurate because the whole envelope is scheduled up front.

Both are **silent no-ops** when there is no WebAudio context — they bail on
`getAudioContext() === null` rather than throwing. Neither needs the clip to be
loaded; neither goes through the file-playback path at all.

`audio.getAudioContext()` and `audio.getMasterGain()` are the escape hatches for
custom Web Audio work; both return `null` when audio is unavailable, so guard.
Connect a custom graph to the master gain rather than `ctx.destination` if you
want it to respect `setVolume` / `muteAll`.

## Effects on all game audio: reverb, echo, compressor

There is no built-in reverb, delay, distortion or compressor, and no per-clip
filter on file playback. There does not need to be one for the common case:
every buffered clip and every `tone` / `noise` passes through the master gain
on its way to the speakers, so an effect inserted **after** it applies to the
whole mix.

```js
const ctx = audio.getAudioContext();   // creates the context if needed
const master = audio.getMasterGain();
if (ctx && master) {                   // null when audio is unavailable
    const comp = ctx.createDynamicsCompressor();
    master.disconnect();               // master -> speakers becomes
    master.connect(comp);              // master -> compressor -> speakers
    comp.connect(ctx.destination);
}
```

Any Web Audio node or chain works the same way: a `ConvolverNode` with an
impulse response for reverb, a `DelayNode` with a feedback gain for echo, a
`BiquadFilterNode` for an underwater low-pass, a `WaveShaperNode` for
distortion. Do it once, at startup; the master gain lives as long as the
context.

- **`setVolume` / `muteAll` still work**, because they act on the master gain,
  which is now upstream of the effect.
- **Streamed clips are not affected.** A `stream: true` (`html5: true`) clip
  plays through an `<audio>` element and never reaches the master gain — which
  is usually the music. Preload the music buffered if it must go through the
  effect.
- **It is all or nothing.** The per-instance nodes are not public, so an effect
  on one clip only (muffling one sound behind a wall) is not possible through
  this route; `noise` has its own `filter` for generated sounds.
- To remove it, reverse the wiring: `master.disconnect(); master.connect(ctx.destination);`.

## Autoplay: sound is silent until the first gesture

Browsers create the audio context in the `suspended` state and keep it there
until a user interaction. Nothing errors — audio simply does not play, which
reads as a bug. melonJS installs one-shot `touchstart` / `touchend` / `click` /
`keydown` unlock listeners on `document`, so the first real gesture anywhere
unlocks it and fires the clip's `on.unlock` callback. Design for it: start music
on the first click or key press, not on load. `tone` / `noise` additionally call
`ctx.resume()` themselves, best-effort, on every invocation.

Playback also starts **asynchronously**: `play()` returns an id while the
instance is still starting, so `playing()` can legitimately be `false` on the
very next line.

## Load-time options

```js
{ name: "sfx", type: "audio", src: "data/sfx/",
  sprite: { jump: [0, 450] },
  pool: 5,            // finished instances kept for reuse — NOT a concurrency cap
  rate: 1.0,          // initial playback rate, 0.5..4.0
  mute: false,
  loop: false,
  autoplay: false,
  preload: true,      // or "metadata"
  format: "mp3",      // explicit hint when the URL has no usable extension
  stream: true,       // long music: stream rather than decode into memory
  on: { play() {}, end() {}, stop() {}, unlock() {} },
}
```

`pool` (default `5`) is a **reuse cap on finished voices**, not a limit on
simultaneous playback: when the number of ended voices exceeds it, the surplus
are disconnected and dropped. Raise it for a clip triggered in rapid bursts, not
to allow more overlap.

Use `stream: true` for long music tracks — it plays through an HTML5 `<audio>`
element instead of decoding the whole file into memory. (`html5: true` is the
same switch under its backend name.) `on` accepts the full lifecycle set:
`play`, `pause`, `stop`, `end`, `fade`, `seek`, `rate`, `volume`, `mute`,
`unlock`.

Outside a preload, `audio.load(asset, onload?, onerror?)` takes the same
descriptor and loads one clip at runtime — for a level's sounds fetched when
the level starts. The loader calls the same function, so the same rules apply.

Re-preloading a manifest that already contains a loaded clip is a no-op —
`audio.unload(name)` first if you genuinely want to reload it.

**Credentials use the same global switch as every other asset type** —
`loader.setOptions({ withCredentials: true })`, not an audio-specific option.
Buffered audio fetches through the shared loader path, so it honours it exactly
as an image or a JSON file does. A `stream: true` clip does not: it plays
through an `<audio>` element, which needs a `crossorigin` attribute rather than
fetch credentials. Preload a clip buffered if it sits behind a login.

**Failing clips and `setStopOnAudioError(false)`.** The default is to fail the
preload when a clip cannot be loaded after its retries: the error reaches the
loader, so `await loader.preload(...)` rejects and your `catch` runs, and the
reason is logged. Turn the flag off and the engine mutes audio, warns
(`failed loading <name>, disabling audio`) and lets the load *continue* — the
preload finishes and the game reaches the next scene without sound.

Before 20.4 both halves were broken: with the flag off it disabled audio and
failed the preload anyway, and a clip whose bytes arrived but would not decode
(a missing file served as HTML by an SPA rewrite, say) reported nothing at all
either way — blank screen, empty console.

## Symptom → cause

| symptom | cause |
|---|---|
| audio assets 404 | `src` given as a full filename instead of a directory prefix |
| `target audio extension(s) should be set...` thrown at preload | `audio.init()` not called before preloading |
| `audio clip X does not exist` | the clip was never preloaded, or the name is mis-cased — every per-clip call throws this |
| nothing plays until the user clicks | browser autoplay policy — expected, design around it |
| `playing()` is false right after `play()` | playback starts asynchronously |
| music keeps playing after leaving a scene | used `play` instead of `playTrack`, or no `stopTrack` in teardown |
| `stereo` / `position` do nothing | the clip was loaded with `stream: true` — spatial is WebAudio-only |
| one format works, another does not | that codec is not in the `audio.init()` list |
| audio behind a login fails, or the preload hangs | `loader.setOptions({ withCredentials: true })` — the same switch every asset type uses |
| a streamed clip ignores `withCredentials` | `stream: true` plays through an `<audio>` element; preload it buffered instead |
| `audio.tone(440, {...})` does nothing / errors | `tone` takes a single options object with a required `duration` |
| `tone` / `noise` are silent with no error | no WebAudio context — `getAudioContext()` returned `null` |
| a positioned sound is silent, or only audible right next to the player | `refDistance` was narrowed below the pixel default — widen it with `audio.setSpatialDefaults({ refDistance })` |
| a positioned sound does not follow the player | nothing is placing it — `audio.play(name, { follow: entity })`, and `audio.setListener(player)` once |
| a followed sound pans to the wrong side as the player moves | the listener was moved **and** positions are still relative to the player — with a listener in the world, pass absolute world coordinates |
| a looping sound outlives the entity that owns it | `follow` without `stopWithTarget: true` |
| `audio.panner()` reset the attributes I set earlier | it merges now, so this is fixed; a stale build still replaces them |
| `position()` does nothing on a clip that pans with `stereo()` (or the reverse) | fixed: the node follows whichever was called last. On a stale build the first call fixed it |
| a reverb / compressor on the master gain does not affect the music | the music is `stream: true`, which bypasses the master gain — preload it buffered |
| sound effects keep playing after the window loses focus | a build older than 20.9 — `state.pause()` only ever paused the music track; set `pauseOnBlur: false` if that was deliberate |

## Related skills

- `melonjs-getting-started` — preloading and asset ordering
