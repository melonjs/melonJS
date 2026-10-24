---
name: melonjs-math
description: "Use this skill for vector and matrix maths in melonJS — Vector2d, Vector3d, their observable variants, Matrix2d, Matrix3d, and the math utility functions. Covers which methods mutate and which allocate, the vector pool and when clone() is the wrong tool, interpolation with lerp, slerp, damp and moveTowards, and the argument defaults that silently drop a component. Triggers on: Vector2d, Vector3d, ObservableVector2d, ObservableVector3d, Matrix2d, Matrix3d, vector, vector maths, dot, cross, normalize, length, distance, angle, lerp, slerp, damp, moveTowards, project, clamp, degToRad, radToDeg, clone, vector pool, vector3dPool, setMuted, setCallback, my vector is wrong, z is zero, scale ignores z., moveTowards ignores z, projectN, currentTransform, setTransform, matrix, transform matrix, column-major, val, Float32Array, basis matrix, orientation matrix, Noise, getNoise1d, flicker, wobble."
license: MIT
---

# Vectors, matrices and maths

## The one rule that explains most surprises

**Methods mutate `this` and return it. They do not return a new vector.**

```js
const a = new Vector3d(1, 0, 0);
const b = new Vector3d(0, 1, 0);

a.cross(b);        // a IS NOW the cross product; the original a is gone
a.add(b).normalize().scale(3, 3, 3);   // chains, all in place
```

That is what makes the API allocation-free, and it is the opposite of what a
functional style expects. If you need to keep the original, copy into
something you own first:

```js
out.copy(a).cross(b);    // a untouched, nothing allocated
```

**The exceptions are named.** A handful of methods return a NEW vector, and
each has a `*Self` sibling that does not:

| allocates a new vector | mutates in place |
|---|---|
| `negate()` | `negateSelf()` |
| `floor()` | `floorSelf()` |
| `ceil()` | `ceilSelf()` |
| `clamp(low, high)` | `clampSelf(low, high)` |
| `clone()` | `copy(v)` |

So `v.negate()` in a per-frame loop allocates every frame and `v.negateSelf()`
does not. The names are the only clue; nothing in the call site shows it.

## `clone()` comes from a pool, and only pays off if you give it back

`clone()` is `vector3dPool.get(...)`. A pool is fast when instances come back:
`get()` takes a free one and resets it. Nothing comes back on its own, so a
clone that is simply dropped makes `get()` miss, construct, and write two
registry entries.

Measured, 3M operations:

| | |
|---|---|
| `out.copy(a).cross(b)` | 39ms |
| `new Vector3d(ax, ay, az).cross(b)` | 37ms |
| `a.clone().cross(b)` | **2919ms** |

So:

- **Transient value inside a function?** Use a module-level scratch vector, or
  `new Vector3d()`. Not `clone()`.
- **Keeping it, then done with it?** `clone()` and `vector3dPool.release(v)`
  when finished. Releasing is what makes the pool a pool.
- **Writing a helper that returns a vector?** Take an optional `out`:

```js
const cross = (a, b, out = new Vector3d()) => out.copy(a).cross(b);
```

That is the engine's own convention, and it lets a hot caller supply scratch
while a casual one ignores it.

**A returned value can never be shared scratch.** The next call overwrites
something the caller is still holding, and nothing fails loudly:

```js
const _t = new Vector3d();
const bad = (v) => _t.copy(v).normalize();   // WRONG: two calls alias
```

## Argument defaults that drop a component

Three signatures quietly discard what you did not pass. All three are
reachable by writing the obvious thing.

**`scale(x, y = x, z = 1)`** — `z` defaults to **1**, not to `x`. A uniform
scale has to say so three times:

```js
v.scale(2);          // (1,2,3) -> (2,4,3)   z UNTOUCHED
v.scale(2, 2, 2);    // (1,2,3) -> (2,4,6)   what you meant
```

**`set(x, y, z = 0)`** — setting two components **zeroes the third**:

```js
v.set(10, 20);       // z is now 0, whatever it was
```

**`Vector3d.pos` on a renderable is typed `Vector2d`.** `Renderable.pos` is an
`ObservableVector3d` at run time but is declared through `Polygon` as a
`Vector2d`, so `.z`, `.setMuted` and `.setCallback` need a cast from
TypeScript. See issue #1510.

## `cross` is two different functions

```js
v3.cross(other);   // Vector3d: MUTATES v3, returns this
v2.cross(other);   // Vector2d: returns a NUMBER, mutates nothing
```

The 2D one is the z component of the 3D cross, which is the useful scalar for
"which side is this on". Same name, different shape, different return.

## Interpolation: four of them, and they are not interchangeable

```js
a.lerp(b, t);            // straight line, t in 0..1
a.slerp(b, t);           // along the ARC, constant angular rate
a.damp(b, lambda, dt);   // frame-rate independent ease toward b
a.moveTowards(b, step);  // fixed distance per call, never overshoots
```

**`moveTowards` is X/Y ONLY, on `Vector3d` as well as `Vector2d`.** It is the
one of the four that is not 3D: it measures the distance from `dx` and `dy`,
steps along `atan2(dy, dx)`, and leaves `z` exactly where it was. The source
says so in a comment and the JSDoc says "on the x and y axis", but the name
gives no hint, and in a list like the one above it reads as the sibling of the
other three. Anything moving in three dimensions wants `damp` or an explicit
step; reach for `moveTowards` only when the motion really is planar.

**`lerp` between two directions is uneven**: it slows at the ends, runs fast
through the middle, and shortens the vector as it passes halfway. Anything
whose direction matters more than its components wants `slerp` — a camera
swinging to look somewhere, a turret tracking, a body moving over a sphere.
`slerp` carries length linearly, so two unit vectors give a unit vector and
nothing needs normalising afterwards.

**`damp` is the one to use for "ease toward a target every frame"**, because
`lerp(current, target, 0.1)` per frame is frame-rate dependent: it converges
twice as fast at 120fps as at 60.

## `project` scales THIS, and `projectN` is the one without the divide

`a.project(b)` does not return the component of `a` along `b`. It scales **a**
by `a.b / |b|^2` and returns `a`, so the result points along `a`, not along
`b`. Worth knowing before you reach for it expecting the textbook projection.

`projectN(v)` is the same thing for a `v` that is already unit, so it skips
the `/ v.length2()`:

```js
a.project(b);   // a scaled by (a.b / |b|^2)
a.projectN(b);  // a scaled by (a.b)      -- only correct when |b| = 1
```

Handing `projectN` a target that is NOT unit does not normalise anything, it
just scales by the raw dot product. That is the price of it being cheaper, and
it is the caller's job to meet the contract.

Until 20.9 both 3D classes got this wrong: `Vector3d.projectN` and
`ObservableVector3d.projectN` were copies of `project`, division and all,
under `projectN`'s name and its "slightly more efficient" doc comment. Nothing
in the engine called either one and nothing tested them, which is how it
survived. Both are fixed and all four classes are now pinned by tests.

## `length()` is `sqrt(x*x + y*y + z*z)`

Fast and correct to 1 ULP for anything a game holds. It is NOT robust at
extremes: components above ~1e154 overflow to `Infinity` and below ~1e-162
underflow to `0`, because the squares are formed before the root. `Math.hypot`
avoids that and costs 35 to 65% more. The engine takes the speed, which is the
right trade for coordinates between 1e-3 and 1e6; nothing in a game is 148
orders of magnitude from unit scale.

`length2()` skips the square root. Use it for comparisons:

```js
if (a.distance(b) < r) { }            // a square root you did not need
if (a.sub(b).length2() < r * r) { }   // same answer, cheaper
```

## Observable vectors

`ObservableVector2d` / `ObservableVector3d` call a callback on every write,
which is how a renderable knows its bounds went stale.

```js
v.setCallback(() => { ... });
v.setMuted(true);     // write without firing it
```

**`setMuted` is what you want when writing several components**, so a
half-updated vector does not fire a callback that reads the other half.
`set()` already does this internally: it disables the callback, writes all
three, fires once, and re-enables.

Note the observable `set(x = 0, y = 0, z = 0)` defaults EVERY argument, so
`set(10, 20)` zeroes z exactly as the plain vector does.

## Matrices

`Matrix2d` is 3x3 for 2D affine transforms; `Matrix3d` is 4x4. Both mutate and
chain, same as vectors, and both come from pools.

```js
m.identity().translate(x, y).rotate(angle).scale(sx, sy);
```

**Order is the reverse of how it reads.** These post-multiply, so the call
made LAST reaches the vertex FIRST. To rotate a thing about its own centre,
translate to the centre last.

### Every renderable already HAS one

`Renderable.currentTransform` is a `Matrix3d`. If you are orienting something
on screen, the matrix exists: write into it rather than building a parallel
structure and copying.

```js
// the whole transform of a renderable, written in place
mesh.currentTransform.identity().translate(x, y, z).rotate(angle, axis);
```

### The sixteen numbers are `val`, column-major

Composing with `translate`/`rotate`/`scale` is one way to fill a matrix. The
other is to write the numbers, which is what you want when the orientation
comes from a basis you have already computed — three orthonormal vectors, a
surface frame, a camera basis.

`val` is a `Float32Array(16)` in **column-major** order, the OpenGL
convention: each basis vector occupies a stride-4 run, and the translation is
the last column.

| | X column | Y column | Z column | translation |
|---|---|---|---|---|
| indices | `0,1,2` | `4,5,6` | `8,9,10` | `12,13,14` |

```js
// an orientation from three axes, straight into the renderable's own matrix
const m = mesh.currentTransform.val;
m[0] = right.x;   m[1] = right.y;   m[2] = right.z;   m[3] = 0;
m[4] = up.x;      m[5] = up.y;      m[6] = up.z;      m[7] = 0;
m[8] = fwd.x;     m[9] = fwd.y;     m[10] = fwd.z;    m[11] = 0;
m[12] = 0;        m[13] = 0;        m[14] = 0;        m[15] = 1;
```

A helper that builds one should take the destination, the same way the engine
takes an `out`, so it writes once into the matrix that will be used:

```js
const orient = (frame, out) => { /* writes out.val */ return out; };
orient(frame, mesh.currentTransform);
```

### Getting numbers IN from somewhere else

`setTransform(...)` takes the sixteen as arguments, and `copy(m)` takes
another matrix:

```js
m.setTransform(a, b, c, d, e, f, g, h, i, j, k, l, p, q, r, s);
m.copy(other);                 // Float32Array.set under the hood
```

Both are fine occasionally. In a per-frame loop, prefer writing `val` or
`copy()` over spreading sixteen arguments, and note that **one matrix built
once and applied to many renderables** is a `copy()` per renderable, not a
rebuild per renderable.

**`val` is `Float32Array`, so it holds float32.** Numbers you put in are
rounded to single precision. That is where they were always heading, since
this is what reaches the GPU, but it means a value read back out is not
bit-identical to the double you wrote.

## Utilities

```js
import { math } from "melonjs";

math.clamp(v, lo, hi);
math.lerp(a, b, t);              // scalars
math.damp(a, b, lambda, dt);     // frame-rate independent
math.degToRad(deg);  math.radToDeg(rad);
math.random(lo, hi);             // integer
math.randomFloat(lo, hi);
math.weightedRandom(lo, hi);     // integer, biased toward LO
math.round(n, decimals);
math.pow(n);                     // n squared
math.DEG_TO_RAD  math.RAD_TO_DEG  math.TAU  math.ETA  math.EPSILON
```

### Values that wobble over time

`Noise`, the generator behind `NoiseTexture2d`, also samples directly. For a
value that should drift without repeating (a torch's flicker, a sway, a camera
wander), sample it with time:

```js
import { Noise } from "melonjs";

const noise = new Noise({ seed: 7, frequency: 1.5, octaves: 3 });
// around 1; give each object its own offset so they do not move together
const flicker = 1 + 0.2 * noise.getNoise1d(seconds + offset);
```

`getNoise1d` returns `[-1, 1]` (with fractal octaves most values fall within
about ±0.6), `frequency` is in changes per unit of the input, and the same seed
gives the same field every run. A sum of sines repeats where people notice it,
and `Math.random()` every frame jitters instead of drifting.

## Symptoms

| symptom | cause |
|---|---|
| z unchanged after scaling | `scale(s)` leaves z alone; pass `scale(s, s, s)` |
| z became 0 for no reason | `set(x, y)` defaults z to 0 |
| the original vector changed | the method mutates; `copy()` into something first |
| memory climbs in a loop | `clone()` or `negate()`/`floor()`/`ceil()` per frame |
| two helper results are the same object | a shared scratch vector was returned |
| `.z` is a type error | `Renderable.pos` is declared `Vector2d` (#1510) |
| rotation eases oddly between directions | `lerp` on directions; use `slerp` |
| you built your own 16-number array | `Renderable.currentTransform` is already a `Matrix3d`; write its `val` |
| a value read back from a matrix differs | `val` is `Float32Array`; it holds float32 |
| easing differs at 120fps | per-frame `lerp`; use `damp` |
| a flicker or sway looks mechanical, or visibly repeats | a sum of sines or a per-frame `Math.random()`: sample `Noise#getNoise1d(time)` |

## Related skills

- `melonjs-3d` — `Camera3d`, meshes, and where these vectors are used in 3D
- `melonjs-physics` — bodies, velocities and collision response
- `melonjs-performance` — pooling in general, and what release() is for
