---
name: melonjs-particles-and-trails
description: "Use this skill for particle effects and motion trails in melonJS — ParticleEmitter configuration, burst versus stream emission, the referenceSpace frame of reference introduced in 20.2, 3D particle motion through elevation and minSpread/maxSpread in 20.8, and the Trail renderable. Covers the emitter that silently does nothing until you call an emit method. Triggers on: ParticleEmitter, particles, burstParticles, streamParticles, referenceSpace, ParticleEmitterSettings, elevation, minSpread, maxSpread, spawn area, Trail, explosion, smoke, sparks, debris, ring, exhaust, emitter."
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

## Where particles are born

`width` and `height` are the spawn AREA, and both default to `1` — so by
default every particle launches from the same pixel. That is fine for a
fountain and wrong for an explosion: additive sprites piled on one point clip
all three channels there however well they are tinted, so a burst reads as one
bright flash rather than as debris.

Give it the size of whatever broke. The area is measured from the emitter's own
position, NOT centred on it, so offset by half or the whole burst sits down and
to the right of its source:

```js
const area = radius * 2;
const emitter = new ParticleEmitter(x - area / 2, y - area / 2, {
    width: area, height: area,
});
```

## Particles in 3D

By default a particle keeps the depth it was born at for its whole life: it
moves across the emitter's plane and never toward or away from the camera.
Under a `Camera3d` that reads as a flat sticker anywhere but dead ahead.

`elevation` lifts the launch out of that plane and `elevationVariation` spreads
it. `angle` is the azimuth within the plane, as it always was:

```js
const emitter = new ParticleEmitter(x, y, {
    angle: 0, angleVariation: Math.PI * 2,
    elevation: 0, elevationVariation: Math.PI / 2,   // a sphere of debris
    speed: 9,
});
world.addChild(emitter, z);     // the depth slice the burst belongs to
emitter.burstParticles();
```

`speed` is the length of the whole 3D vector, so an "all directions" burst
covers the sphere evenly instead of bunching toward the poles.

Both default to `0`, and that is a gate rather than the 3D path with zeros in
it: an emitter that asks for no elevation runs the same two trig calls it
always did, writes no depth and starts no sort.

**The launch is in WORLD axes.** `vel.x` and `vel.y` add to the particle's
`pos.x`/`pos.y` and `velZ` adds to its depth, so `angle` and `elevation`
describe a direction in the world, not on the screen. Building them from a
camera basis works only while the camera's axes ARE the world axes, which stops
being true the moment you pose a `Camera3d`. For a direction `d` already in
world terms the pair is `angle: Math.atan2(-d.y, d.x)`,
`elevation: Math.asin(d.z)`.

### Cones, rings and spheres: aiming around an axis

`angleVariation` and `elevationVariation` are sampled INDEPENDENTLY, spreading
particles over a rectangle of azimuth by elevation. That cannot describe a
shape defined against a direction. A ring of debris leaving a point on a sphere
is the set of directions at ninety degrees to that point's normal, and on a
rectangle the elevation that satisfies it is a function of the azimuth, so no
pair of variations gets there.

Set `maxSpread` and `angle`/`elevation` become an AXIS instead. Each particle
leaves at a polar angle between `minSpread` and `maxSpread` off that axis,
around a uniformly random azimuth:

| `minSpread` … `maxSpread` | shape |
|---|---|
| `0` … `0.5` | a tight cone along the axis |
| `0` … `Math.PI` | the whole sphere |
| either value at `Math.PI / 2` | a flat disc perpendicular to the axis |

An explosion on a planet's surface is a ring tangent to it: set the axis to the
surface normal and use `minSpread: Math.PI / 2 - 0.3, maxSpread: Math.PI / 2`.
Keeping the band at or inside ninety degrees is what stops debris tilting back
into the body it came off. `angleVariation` and `elevationVariation` are unused
while `maxSpread` is set.

### Sorting, and why it is keyed off the blend mode

A 3D burst only needs depth sorting when its blend is order dependent, and the
emitter decides that for you. Additive blending is commutative, so an additive
burst looks the same however it is ordered and pays nothing; `"normal"` is not,
so a 3D burst drawn with it is sorted back to front.

The two differ in more than cost. Additive sprites overlapping near the centre
of a burst sum to white however they are tinted, so debris that has to keep its
colour wants `textureAdditive: false` and accepts the sort. A common shape is
two emitters: a solid, sorted body of debris with a sparser additive spray of
sparks over it.

The default particle sprite is a filled SQUARE, which additive blending hides
and normal blending does not. Pass your own soft `image` for non-additive
debris.

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

**`Trail` is 2D.** `addPoint` takes `(x, y)`, points are stored without a `z`,
and the ribbon is drawn as connected screen-space quads. Under a `Camera3d` it
draws a flat ribbon that does not recede with perspective — so it is the wrong
tool for a trail behind an object moving *into* the scene. For that:

- **`ParticleEmitter` with `referenceSpace: "world"`** — particles stay where
  they were dropped while the emitter moves on, and each one sits at the
  emitter's depth slice so `Camera3d` projects it correctly. Add an `elevation`
  and they recede as well. This is the built-in answer for exhaust, ski tracks
  and speed trails in 3D.
- **A procedural `Mesh`** built from the object's recent path, with
  `mesh.vertexColors` for a per-vertex gradient — more work, but a continuous
  ribbon rather than discrete puffs.

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
| trail looks flat under a `Camera3d` | `Trail` is 2D — use a world-space emitter or a ribbon mesh |
| emitter added but nothing appears | `streamParticles()` / `burstParticles()` never called |
| the cloud follows a moving emitter | default `referenceSpace: "local"` — use `"world"` for trails |
| particles do not travel far enough | settings tuned pre-20.2, when drawn travel was doubled |
| one-shot emitters accumulate | missing `autoDestroyOnComplete: true` |
| frame rate drops with many effects | an emitter per event instead of one re-aimed emitter |
| a 3D burst is invisible under a `Camera3d` | before 20.8 a particle was culled at twice its depth; update |
| the whole burst launches from one pixel | `width`/`height` are the spawn area and default to `1` |
| the burst sits down-right of its source | the spawn area starts at the emitter's position; offset by half |
| the middle of a burst goes white | additive sprites overlapping — `textureAdditive: false`, or spread them |
| debris chunks look like squares | the default sprite is a filled square; pass your own `image` |
| a ring tilts with the camera instead of staying on a surface | the launch axis is in WORLD axes, not the camera basis |

## Related skills

- `melonjs-renderables` — draw order and blend modes
- `melonjs-effects-and-shaders` — blend mode cost on each backend
