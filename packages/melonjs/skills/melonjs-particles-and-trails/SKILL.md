---
name: melonjs-particles-and-trails
description: "Use this skill for particle effects and motion trails in melonJS — ParticleEmitter configuration, burst versus stream emission, the referenceSpace frame of reference introduced in 20.2, and the Trail renderable. Covers the emitter that silently does nothing until you call an emit method. Triggers on: ParticleEmitter, particles, burstParticles, streamParticles, referenceSpace, ParticleEmitterSettings, Trail, explosion, smoke, sparks, exhaust, emitter."
license: MIT
---

# Particles and trails

## An emitter does nothing until you tell it to emit

Adding a `ParticleEmitter` to the world is not enough. Nothing appears, and
nothing warns you.

```js
const emitter = new ParticleEmitter(x, y, {
    image: loader.getImage("spark"),
    totalParticles: 60,
    speed: 4,
    minLife: 200, maxLife: 800,
});

world.addChild(emitter);
emitter.streamParticles();     // continuous — or:
emitter.burstParticles();      // one shot
```

`streamParticles(ms)` takes an optional run time; without one it uses the
`duration` setting, which defaults to `Infinity` — a stream runs until
`stopStream()`. `burstParticles(n)` launches `n`, or `totalParticles`.

For one-shot effects, `autoDestroyOnComplete: true` removes the emitter once its
particles have finished. The `onComplete` callback fires at that same moment
either way.

For repeated effects (muzzle flashes, impacts) keep **one** long-lived emitter
and re-aim it per shot, rather than allocating an emitter per event.

## `referenceSpace` — which frame particles live in

Added in 20.2. This decides what a particle's position is measured *from*, and
it is the difference between an effect that trails behind a moving object and
one that drags along with it.

| value | particles are measured from | use for |
|---|---|---|
| `"local"` (default) | the emitter | flames, auras, anything welded to the object |
| `"world"` | the container the emitter sits in | **trails, smoke, exhaust, dust** |
| a `Container` | that container | a moving frame — snow inside a moving carriage |

```js
// exhaust that stays where it was emitted, so the ship flies away from it
const exhaust = new ParticleEmitter(x, y, { referenceSpace: "world", /* … */ });
```

With the default `"local"`, a moving emitter carries its whole cloud along —
which is right for a torch flame and wrong for a smoke trail. Changing it at
runtime re-bases live particles, so nothing jumps.

## Particle tuning changed in 20.2

The 20.2 particle transform fix corrected a drift where drawn positions ran past
simulated ones. Particles now travel roughly **half as far** over their life as
they did before.

Consequence: **speed values tuned on 19.x or earlier look wrong on 20.2+.** If
you are copying emitter settings from older code or older tutorials, expect to
raise `speed` or `maxLife`.

## Trails

`Trail` is a ribbon that follows a target — use it rather than hand-rolling a
position history. **Its constructor takes one argument, the options object** —
no `x, y` pair like every other renderable:

```js
const trail = new Trail({
    target: sprite,             // a renderable or a plain Vector2d
    length: 24,                 // max points kept (default 20)
    width: 20,                  // max ribbon width in px (default 10)
    lifetime: 500,              // per-point lifetime in ms (default 500)
    widthCurve: [1, 0],         // 0 = head, 1 = tail
    gradient: ["#fff", "#f80", "#f000"],
});
trail.blendMode = "additive";
world.addChild(trail, 5);
```

Omit `target` and feed it yourself with `trail.addPoint(x, y)` — the mode for a
sword slash, where the ribbon follows a weapon tip rather than an object. Points
closer together than `minDistance` (default 4 px) are dropped.

## Performance

- Particles come from a shared pool, so a steady-state emitter allocates
  nothing. Each emitter is still a `Container` that updates and draws every
  frame, so one busy emitter beats many idle ones.
- `totalParticles` (default 50) is a cap on how many are alive at once in stream
  mode; `burstParticles()` launches that many in one go, or the count you pass.
- `framesToSkip` (default 0) skips n updates between simulation steps — the
  cheapest lever on an emitter with many particles.
- Blending is per particle, set through the `blendMode` setting or by assigning
  `emitter.blendMode` (which reaches the particles already alive as well as
  later ones). Additive is cheap everywhere: fixed-function on both GPU
  backends, native `lighter` on Canvas. The expensive modes are the advanced CSS
  ones (`overlay`, `soft-light`, `color-dodge`, `darken`, …), which on WebGL 2
  and WebGPU cost a destination capture plus a shader composite *per blended
  draw*.

## Symptom → cause

| symptom | cause |
|---|---|
| emitter added but nothing appears | `streamParticles()` / `burstParticles()` never called |
| the cloud follows a moving emitter | default `referenceSpace: "local"` — use `"world"` for trails |
| particles do not travel far enough | settings tuned pre-20.2, when drawn travel was doubled |
| one-shot emitters accumulate | missing `autoDestroyOnComplete: true` |
| frame rate drops with many effects | an emitter per event instead of one re-aimed emitter |

## Related skills

- `melonjs-renderables` — draw order and blend modes
- `melonjs-effects-and-shaders` — blend mode cost on each backend
