---
name: melonjs-3d
description: "Use this skill for anything 3D or 2.5D in melonJS — Camera3d, Mesh, InstancedMesh, Sprite3d billboards, Light3d, ground shadows, glTF/GLB scenes, and depth sorting. Covers the Y-down/+Z-forward convention that is the inverse of OpenGL, the cameraClass opt-in, clip planes, and what does not work on the Canvas fallback. Triggers on: Camera3d, Mesh, InstancedMesh, Sprite3d, Light3d, billboard, glTF, glb, 3D, 2.5D, depth, cameraClass, fov, setClipPlanes, setFog, fog, distance fog, castGroundShadow, lit."
license: MIT
---

# 3D and 2.5D in melonJS

> melonJS is a 2D engine that grew a real 3D tier: perspective cameras, meshes,
> instancing, glTF scenes and 3D lights. Most of what a model "knows" about 3D
> graphics comes from the OpenGL convention, and **melonJS's is the inverse**.
> Read the conventions section before writing any 3D code.

## Coordinate conventions — the inverse of OpenGL

This is the single most important thing on this page.

| | melonJS | OpenGL convention |
|---|---|---|
| vertical | **Y-down** — higher `y` is *lower* on screen | Y-up |
| depth | **+Z forward** — higher `z` is *farther* away | −Z forward |

Rotations are extrinsic XYZ. `Camera3d` exposes two of the three: `camera.pitch`
(X, look up/down) and `camera.yaw` (Y, look left/right). **There is no `roll`**;
neither camera applies a Z-axis bank to the view, so assigning one does nothing.

The payoff is that 2D code translates directly — anywhere you used `pos.x` /
`pos.y`, add `pos.z` and the maths still holds. The cost is that every
OpenGL-shaped instinct is backwards.

**Consequence that bites immediately:** "behind everything" is the *largest*
depth when the camera looks along +Z. Put a backdrop on the wrong side and it
either paints over the whole scene (it is nearer than everything else) or
disappears without trace (it falls in front of the near plane and the GPU clips
it). Which sign means "far" depends on which side the camera sits, so check the
camera before picking a backdrop depth.

glTF assets are authored Y-up right-handed. `level.load` converts them by
rotation (`rightHanded: true` is its default), so you do not apply a flip
yourself. The **`Mesh` constructor defaults `rightHanded` to `false`**, which
bridges by mirroring instead — geometry you hand to a `Mesh` directly comes in
flipped left/right unless you pass `rightHanded: true`. See
`melonjs-3d-assets`.

## Opting in

3D starts with the camera class, and nothing else has to change. Set it once on
the `Application`:

```js
import { Application, Camera3d } from "melonjs";

const app = new Application(1024, 768, {
    parent: "screen",
    cameraClass: Camera3d,      // ← the opt-in
});
await app.init();
```

That flips the world's sort to `"depth"`, switches the broadphase to a 3D index,
and renders sprites and meshes with perspective projection. `Camera3d` extends
`Camera2d`, so follow, fade, shake and post effects all still work.

Per-stage opt-in also works, which is useful when the loading screen is 2D:

```js
class GameStage extends Stage {
    constructor() {
        super({ cameras: [new Camera3d(0, 0, 1024, 768, { fov: Math.PI / 3 })] });
    }
}
```

## Camera traps

- **There is no sky.** The frame clears to `renderer.backgroundColor` (opaque
  black unless the renderer was created transparent), and `world.backgroundColor`
  clears over it when you set one — both are flat colours. Anything more is a
  backdrop renderable, screen-fixed or placed at a far depth.
- **Set the clip planes for your scene scale.** Defaults are near 0.1 / far 1000.
  Objects beyond the far plane clip or project with bad w-divides; a `near` that
  is too small wastes depth precision and distant props z-fight. Use
  `camera.setClipPlanes(near, far)`.
- **`camera.pos.set(x, y)` is 2-argument and zeroes z.** Use `camera.depth` —
  the documented z accessor — or assign `pos.x`/`pos.y` individually.

## Depth sorting

Under `Camera3d` the world sorts on `"depth"` **every frame** (recursively), so
unlike 2D you *can* assign `depth` after `addChild` and it will reorder. That is
the one place where the usual z-ordering rule is relaxed — see
`melonjs-renderables` for the 2D rules, which still apply everywhere else.

You will often *have* to. A `Container` has `autoDepth: true` by default, so
`addChild(child)` with no explicit z **overwrites `pos.z` with the child's
index** — a real world depth in a 3D scene, and never the one you wanted. Pass
it (`world.addChild(mesh, z)`), or set `mesh.depth` afterwards. The glTF
importer turns `autoDepth` off on the container it loads into for this reason.

**`floating` does not opt out of this sort.** It skips the camera *transform*,
not the depth *order*. A floating child is ordered by `|pos.z|` alone — its
`pos.x/y` are screen pixels, and the camera does not move relative to it — so
the magnitude is the distance and the sign is ignored:

```js
world.addChild(hud, -150);       // small -> nearer than anything -> on top
world.addChild(skybox, -10000);  // large -> farther -> behind everything
world.addChild(skybox, 100000);  // equally far: sign does not matter
```

Both hold at any camera position. A HUD given the huge z that would put it on
top in 2D lands at the far end of the level instead, with the scenery drawing
over it.

## Distance fog

Off until you ask for it, and one call on the camera:

```js
camera.setFog({ near: 2000, far: 7000 });   // linear: name the two distances
camera.setFog({ mode: "exp2", density: 4e-4 }); // or one density
camera.setFog(null);                         // off
```

It is the cheapest thing that stops a 3D scene reading as flat cut-outs, and it
lets props arrive at the far plane without a visible edge.

**Every parameter is optional, and the omitted ones track live.** Distances
default to the camera's own clip planes, so fog cannot silently disagree with
them after a later `setClipPlanes`. The colour defaults to
`renderer.backgroundColor` and follows it, so geometry dissolves into whatever
sky you already set — including through a day/night fade. Pass `color` only
when the fog should deliberately differ from the backdrop:

```js
camera.setFog({ far: 5000, color: "#8899aa" });
```

A `Color` is held by reference, so mutating it animates the fog.

Fog is measured **radially** from the camera and applied **per fragment**, so
it does not slide as the camera turns and does not band across large triangles.
It lives on the camera, so a split-screen or minimap view fogs independently —
and a `Camera2d` never fogs at all.

**Per object:** `fog: false` exempts a mesh however far away it is — for a
waypoint or objective marker that has to stay readable. Emissive surfaces fog
like everything else (light travelling through fog is attenuated too), so a
neon sign that should punch through wants `fog: false`, not a brighter
emissive.

Only meshes fog. 2D content, HUDs and `floating` renderables never reach the
mesh shaders, so a screen-space overlay stays clean with no work.

## Meshes

```js
const cube = new Mesh(x, y, {
    model: "cube",          // a preloaded OBJ name — no built-in primitives
    texture: atlas,         // TextureAtlas, image, or a preloaded image name
    width: 64, height: 64,
    cullBackFaces: true,    // the default
    lit: true,
});
```

**A mesh pivots about its model origin `(0, 0, 0)`, not an anchor point.** Under
`Camera3d` it opts out of the anchor offset entirely, so `anchorPoint` is inert
there — place the origin where you want the pivot at authoring time, or nest the
mesh under a transformed parent. The anchor is only honoured on the legacy
2D-camera path.

### InstancedMesh, and when it is the wrong tool

**`InstancedMesh`** draws one mesh many times in a single draw call — the
difference between a hundred trees and a hundred thousand. glTF scenes using
`EXT_mesh_gpu_instancing` load as one automatically; by hand it is a `Mesh`
with a count:

```js
const trees = new InstancedMesh(0, 0, { ...treeGeometry, instanceCount: 400 });
const at = new Matrix3d();               // one scratch, reused
for (let i = 0; i < trees.instanceCount; i++) {
    at.identity().translate(x, y, z);
    trees.setInstance(i, at);
}
world.addChild(trees, 0);

trees.visibleInstanceCount = 120;        // draw fewer, without re-uploading
```

It is not a free upgrade. One `InstancedMesh` is **one geometry and one
material**, and four things move from per-object to per-group:

| | with `Mesh` | with `InstancedMesh` |
| --- | --- | --- |
| depth sort | each object sorts on its own `pos` | the whole set has **one** sort key |
| ground shadow | one blob per object | one instanced draw for the set |
| removal | `removeChild`, indices unaffected | `removeInstance(i)` swaps the **last** instance into the hole, so any index you were holding is now wrong |
| colour | `tint` per object | needs `instanceColors: true` and `setInstanceColor(i, …)` |

So the question is not "how many are there" but **"does the game address them
individually"**:

- **Scenery — instance it.** Trees, rocks, grass, debris: the game never asks
  about one of them.
- **Collision-tested props — still fine.** You test against positions you
  already own; instancing only changes how they are *drawn*.
- **Collectibles and enemies — usually not.** Anything removed one at a time
  makes `removeInstance`'s swap your problem: you have to keep an index↔object
  map and repair it on every removal. At small counts a pooled `Mesh` each is
  less code and no slower.

Under a few hundred objects the draw-call saving is not what limits you
anyway — reach for it when the count is in the thousands, or when the objects
are pure scenery and it costs nothing to.

## Normals are generated for you

A `lit` mesh needs per-vertex normals for the shader to light with. Supply them
if you have them; **omit them and the engine computes them from the geometry**:

```js
const mesh = new Mesh(x, y, { vertices, uvs, indices, lit: true });
// normals derived from the triangles — nothing else to do
```

You do not choose flat or smooth, because the geometry already decides. Face
normals accumulate into their vertices weighted by area, so where faces **share**
a vertex they average and the surface shades smoothly, and where every triangle
carries its **own** three vertices — a triangle soup, which is how most
hand-built geometry comes out — each vertex belongs to one face and the result
is that face's normal, so it shades flat. Want faceted edges: duplicate the
vertices. Want smooth: share them.

An explicit `settings.normals` always wins, and an unlit mesh gets none — there
would be nothing to read them.

**A lit mesh with no normals used to render fullbright**, which looks like the
lighting is broken rather than absent. If an older scene suddenly picks up
shading, that is why.

## Colouring a mesh

There are four levels, and picking the wrong one is the usual reason a colour
"does not apply". They all multiply together.

| level | how | use for |
|---|---|---|
| whole object | `mesh.tint.setColor(r, g, b)` | flash on hit, team colour, fading one object |
| per vertex | `settings.vertexColors`, or `mesh.setVertexColor(i, color)` | a gradient *within* one mesh — distance haze, a darker crease |
| per material | `textureGroups`, from a multi-material OBJ + MTL | a model whose parts differ, in one draw call |
| per instance | `new InstancedMesh(…, { instanceColors: true })` then `setInstanceColor(i, color)` | a thousand copies that differ |

**`tint` is per object.** That is the trap: build a terrain as one big mesh and
you can tint the whole valley or none of it. Anything that varies *across* a
single mesh is per-vertex.

```js
// fade a procedural terrain toward the sky the further out it goes
const ground = new Color(217, 230, 244);
const sky = new Color(207, 230, 247);
const haze = new Color();
for (let i = 0; i < mesh.vertexCount; i++) {
    const t = Math.min(1, mesh.originalVertices[i * 3 + 2] / 6000);
    mesh.setVertexColor(i, haze.copy(ground).lerp(sky, t));
}
```

Supply the whole array at construction when you already have it —
`vertexColors` takes a packed `Uint32Array` (the form the batchers read, so no
conversion) or one `Color` per vertex. A length that does not match
`vertexCount` **throws**; it is not padded, because a short array would leave
the tail of the mesh mis-coloured and that reads as a lighting bug.

Mutating the array directly is fine, but say so afterwards:

```js
mesh.vertexColors[i] = color.toUint32(color.alpha);
mesh.needsUpdate = true;   // the retained Camera3d path uploads once
```

`setVertexColor` does that for you. Skip it and the colour applies under a 2D
camera and silently does not under `Camera3d`.

On a lit mesh the colour multiplies the **lit** result, so it behaves as albedo
rather than as an emissive override — a vertex colour will not make an unlit
face bright.

`alpha` hides a mesh as it hides anything else: at 0 the draw is skipped. There
is no *partial* mesh transparency though — the mesh path renders opaque, so a
mesh at `alpha = 0.5` draws fully opaque rather than half see-through. Fade a
mesh out and it will stay solid until it vanishes.

## Sprite3d and billboards

`Sprite3d` is the 2.5D workhorse: a flat sprite living at a real depth, with
`billboard` controlling how it faces the camera.

| `billboard` | behaviour |
|---|---|
| `false` (default) / `"none"` | no rotation — a flat plane in the world |
| `true` / `"cylindrical"` | yaws to face the camera, stays upright (characters, trees) |
| `"spherical"` | always fully faces the camera (particles, impostors) |

`"cylindrical"` is what you want for paper-thin characters in a 2.5D game.
Billboarding needs a `Camera3d` drawing the frame; under a 2D camera the quad
renders fixed-orientation. **Any other string falls through to the spherical
branch**, so a guessed value like `"upright"` silently gives you spherical.

## Lighting

`Light3d` takes **one argument — the options object** (it has no `x, y, z`
pair; a light carries its own `position`). Types are `"directional"` (the
default), `"ambient"`, `"point"` and `"spot"`.

```js
world.addChild(new Light3d({ type: "directional", direction: [0.3, 1, 0.2] }));
world.addChild(new Light3d({ type: "ambient", intensity: 0.3 }));
```

Use **both halves**: with a key light but no ambient, the shadow side of a mesh
goes black. With no `Light3d` in the world at all, a `lit: true` mesh falls back
to a white ambient and renders fullbright — indistinguishable from unlit, which
is why "I added `lit: true` and nothing changed" is the usual first report.

Other defaults worth knowing: `intensity` 1, `color` white, `range` 1000 (point
and spot, a stylised quadratic falloff, not inverse-square),
`innerConeAngle` 0 and `outerConeAngle` π/4 (spot).

**`Light2d` is 2D-only** and produces visible artifacts under perspective
projection. Do not combine it with `Camera3d`.

Ground shadows are **on by default** (the `castGroundShadow` application
setting), and need a GPU backend and a `Camera3d`. As a blanket default they
skip geometry with no vertical extent — a ground plane. Per object,
`castGroundShadow: true`/`false` overrides the app setting and is obeyed as
given, safeguard included; `shadowGroundY` names the floor the blob lands on.

The blob is an ellipse sized to the caster's own footprint and placed at the
caster's x/z — it is **never offset by light direction**. So a tall or narrow
object (a character, a tree, a pickup) shows its shadow clearly, while a wide,
flat-bottomed one resting on the floor covers its own completely from a camera
looking down at it. That is the shadow behaving correctly, not a bug.

**Do not chase it by raising `shadowGroundY`.** Lifting the plane does not slide
the blob out from under the object, it floats the blob *up* — and past a few
units it projects over the top of the caster as a dark halo ringing it. If an
object needs a visible shadow, give it a smaller footprint relative to its
height, or accept that a boulder bedded in the ground has none.

## glTF / GLB scenes

Loaded through the same level director as everything else:

```js
await loader.preload([{ name: "diorama", type: "glb", src: "data/diorama.glb" }]);
level.load("diorama", { scale, castGroundShadow, shadowGroundY, onLoaded });
```

`.obj` / `.mtl` are also supported loader types.

`melonjs-3d-assets` covers the rest: every `level.load` option, which material
features are imported, imported lights and their intensity units, node-TRS
animation (and the skinning that is out of scope), and OBJ/MTL.

## Requires a GPU backend

The whole 3D tier needs WebGPU or WebGL 2. The Canvas renderer has no depth
buffer, no perspective path and no `drawMesh`, so a `Camera3d` scene does not
render correctly there — usually a black canvas. `Light3d` and shader effects
are inert too. A `Mesh` under a *2D* camera still renders, CPU-projected by
painter's algorithm and unlit.

`Application` does warn: constructing with a `cameraClass` whose
`defaultSortOn` is `"depth"` on a renderer with no depth buffer logs a
`console.warn`. But `video.AUTO` falls back silently to Canvas, so the strong
gate is to ask for a GPU backend by name — `renderer: video.WEBGL` (or
`video.WEBGPU`) makes `await app.init()` reject instead of misrendering:

```js
const app = new Application(1024, 768, {
    parent: "screen",
    renderer: video.WEBGL,      // init() rejects if WebGL 2 is unavailable
    cameraClass: Camera3d,
});
await app.init();
```

To branch rather than fail, read `app.renderer.supportsDepthBuffer` after
`init()`.

## Symptom → cause

| symptom | cause |
|---|---|
| a `lit` mesh renders fullbright | it had no normals — supply them, or let the engine generate them |
| a gradient across one mesh is impossible | `tint` is per object — use `vertexColors` / `setVertexColor` |
| a mesh stays solid as you fade it out | meshes render opaque; only `alpha` 0 (hidden) and 1 differ |
| vertex colour applies under a 2D camera but not `Camera3d` | wrote the array directly without setting `needsUpdate` |
| `Mesh: vertexColors has N entries, expected M` | one colour per *vertex*, not per triangle or per index |
| nothing renders, or a backdrop covers everything | wrong depth sign — "far" is *larger* z when looking along +Z |
| distant objects vanish or warp | scene exceeds the default far plane; `setClipPlanes` |
| distant surfaces z-fight | `near` too small for the scene scale |
| black canvas under `Camera3d` | Canvas renderer (no depth buffer) — check the `console.warn` |
| everything flat and unlit | `lit: true` with no `Light3d` in the world (falls back to fullbright), or a mesh under a 2D camera |
| a `floating` HUD draws behind the scenery | a large \|z\| is *far* under `Camera3d` — use a small depth |
| distant geometry pops in against the sky | no fog — `camera.setFog({})` picks up the clip planes and background colour |
| fog does not match the sky after a background fade | an explicit `color` was passed; omit it to track `renderer.backgroundColor` |
| geometry clips before it has finished fading | fog `far` beyond the clip far — omit the distances and they default to the clip planes |
| one marker must stay readable in fog | `fog: false` on that mesh |
| an object casts no visible shadow | wide and flat-bottomed — its own blob is underneath it; raising `shadowGroundY` haloes it instead of revealing it |
| a dark ring around the top of an object | `shadowGroundY` lifted too far, floating the blob up into the caster |
| a mesh sits at the wrong depth after being added | `autoDepth` overwrote `pos.z` with the child index — pass `addChild(mesh, z)` |
| a mesh sits half its size off | `anchorPoint` — only on the 2D-camera path; a `Camera3d` mesh pivots on its model origin |
| a billboard tips over when the camera looks down | `"spherical"`, or a mistyped mode string falling through to it — use `true` / `"cylindrical"` |
| an object jumps to the camera plane | `Vector3d.set(x, y)` / `camera.pos.set(x, y)` zeroed its z |
| lighting looks wrong under a 3D camera | `Light2d` used instead of `Light3d` |

## Related skills

- `melonjs-renderables` — the 2D z-ordering rules, anchors, custom draw
- `melonjs-getting-started` — Application settings and the renderer fallback
