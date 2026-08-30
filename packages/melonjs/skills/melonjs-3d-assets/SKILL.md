---
name: melonjs-3d-assets
description: "Use this skill when loading 3D models into melonJS — glTF and GLB scenes, OBJ/MTL models, materials, imported lights, node animation, ground shadows and GPU instancing. Covers level.load options, the rightHanded conversion, and exactly what the loader does and does not support. Triggers on: glTF, gltf, glb, OBJ, MTL, 3D model, getGLTF, getOBJ, getMTL, GLTFModel, GLTFScene, level.load glb, rightHanded, lightIntensityScale, castGroundShadow, shadowGroundY, EXT_mesh_gpu_instancing, KHR_lights_punctual, skinning, Blender export, 3D asset."
license: MIT
---

# Loading 3D assets

> glTF/GLB is the primary path for 3D content, and it goes through the **level
> director** rather than the world directly: `level.load("scene")`, the same call
> a Tiled map uses. OBJ/MTL is the simpler path for a single static model.

## Loading a glTF/GLB scene

```js
await loader.preload([
    { name: "diorama", type: "glb", src: "data/scenes/diorama.glb" },
]);

level.load("diorama", { scale: 50 });
```

`type: "gltf"` (JSON plus external buffers) and `type: "glb"` (single binary)
are both loader types. A self-contained GLB is the better shipping format — one
request, nothing to resolve relatively.

The scene loads under whatever camera the stage has; view it under a `Camera3d`
or it renders flat. See `melonjs-3d` for the camera.

### `level.load` options for glTF/GLB

| option | default | what it does |
|---|---|---|
| `scale` | `1` | pixels per glTF unit, applied to the whole scene. Blender's metre-scale export usually needs 20–100. |
| `container` | `game.world` | where the nodes are added |
| `onLoaded` | `app.onLevelLoaded` | called with the **level id**, not the scene |
| `rightHanded` | `true` | see below |
| `lights` | `true` | instantiate authored `KHR_lights_punctual` lights as `Light3d` world children |
| `lightIntensityScale` | — | keep authored intensity ratios instead of normalising every light to 1 |
| `castGroundShadow` | inherits the app setting (**on**) | blob shadows for this scene's meshes |
| `shadowGroundY` | each object's own base | world Y of the floor the blobs land on |

`onLoaded` receives the level id — it is a "done" signal, not a handle on the
scene. You need it: with the game loop running, `level.load` stops the loop and
defers the actual load to the next tick, so it returns *before* anything is in
the world. To get at what was loaded, load into a container you own, or look the
nodes up by their authored names:

```js
level.load("diorama", { scale: 50, onLoaded: () => {
    const sun = app.world.getChildByName("Sun")[0];   // note: returns an array
    sun.intensity = 2;
}});
```

## `rightHanded` — and the default that differs between the two APIs

glTF is authored **Y-up, right-handed**; melonJS is **Y-down, +Z forward**.
There are two ways to bridge that, and they are not equivalent:

- a **rotation** — preserves chirality, matches the authoring tool
- a **mirror** (negate Y only) — flips the scene left/right

`level.load` defaults `rightHanded: true`, so a scene loaded through the level
director comes in correctly. **The `Mesh` constructor defaults it to `false`**,
so glTF or OBJ geometry you feed to a `Mesh` yourself comes in mirrored unless
you pass `rightHanded: true`. A model that is subtly wrong — text backwards, a
character's gear on the wrong side — is this and nothing else.

Do not add a flip of your own on top; two corrections cancel back to wrong.

## Materials — what actually arrives

The importer covers a deliberate subset:

- `pbrMetallicRoughness` **base colour texture and factor**
- metallic/roughness **factors** converted to the engine's specular model
- `emissiveFactor`, including `KHR_materials_emissive_strength`
- `KHR_materials_unlit` — honoured, for baked/stylised workflows
- `alphaMode: "MASK"` — the cutout threshold is applied
- `doubleSided`

Not imported: **normal maps**, metallic/roughness *textures*, occlusion maps,
morph targets, `KHR_texture_transform`. Nothing errors — the material simply
arrives without them, which reads as "flatter than the preview in my authoring
tool". Bake what you need into the base colour.

**Draco compression is the exception that does error.** Its geometry sits in
accessors with no buffer view, which the parser rejects outright, so the whole
asset fails to load. Export uncompressed.

`textureFilter` on the Application settings (`"nearest"` / `"linear"` /
`"auto"`) drives sampling; glTF materials that declare their own sampler carry
it through. Pixel-art models want `"nearest"`.

## Lights

Authored `KHR_lights_punctual` lights — sun, point, spot — become `Light3d`
world children, plus a soft ambient fill, and each keeps its authored name.
A scene carrying any of them renders through the **lit** path automatically.

glTF stores physical units — lux for suns, candela for lamps — and a Blender
daylight sun is 1000+, which blows out the engine's stylised shading. So every
light is normalised to intensity 1 by default. To keep the *ratios* the artist
set, scale instead of normalising:

```js
// a 1000-lux sun lands at 1, a 500-lux fill lands at 0.5
level.load("diorama", { scale: 50, lightIntensityScale: 0.001 });
```

Pass `lights: false` to manage lighting yourself.

## Animation

Node-TRS animation **is** supported: translation, rotation and scale channels,
the rigid hierarchical animation used by blocky/low-poly character packs. An
animated asset instantiates as a single `GLTFModel` keeping the node hierarchy
intact, with an API deliberately mirroring `Sprite`. The model carries the asset
name, which is how you get hold of it after loading:

```js
const model = app.world.getChildByName("hero")[0];   // the GLTFModel

model.getAnimationNames();                           // ["idle", "walk", ...]
model.setCurrentAnimation("walk", { loop: true, speed: 1, onComplete });
model.setCurrentAnimation("jump", { next: "idle" }); // chain
model.isCurrentAnimation("walk");
model.play();
model.pause();
```

`speed` is a playback multiplier (1 = authored speed), not a frame delay. Only
an explicit `loop: false` stops looping. `setCurrentAnimation` **throws** on a
clip name the asset does not define — check `getAnimationNames()` first.

**Vertex skinning is out of scope** — `JOINTS_0` / `WEIGHTS_0` are not read, and
neither are morph targets. A smoothly-deforming character will not deform. The
options are: rig it hierarchically instead (separate meshes parented into a
node tree), use `Sprite3d` billboards, or use the Spine plugin for 2D skeletal
work.

## Instancing

A node using `EXT_mesh_gpu_instancing` loads as an `InstancedMesh` — one draw
call for every copy, which is the difference between a hundred trees and a
hundred thousand. Export with instancing enabled where your tool supports it.
Sparse accessors on the instancing attributes are rejected with a clear error
rather than silently misplacing every instance.

## Ground shadows

```js
level.load("diorama", { scale: 50, castGroundShadow: true, shadowGroundY: 0 });
```

`castGroundShadow` is tri-state: set it and it overrides the application setting
for this scene in both directions; omit it and the scene inherits — and that
setting is `true` by default, so shadows are already on. As a scene-wide opt-in
it skips nodes with no vertical extent — a ground plane is exactly that, and
shadowing it with itself smears a blob across the whole floor. Blob shadows need
a GPU backend and a `Camera3d`; nothing is drawn on the 2D-camera or Canvas
paths.

Omit `shadowGroundY` and each blob sits at its own object's base at full
strength, which is right for props already resting on the ground. Set it when
things jump or fly, so the shadow stays on the floor and shrinks with height.

## OBJ/MTL

A different shape entirely: OBJ produces raw geometry you hand to a `Mesh`,
not a scene. Preload the two files and name them in the `Mesh` settings — the
`model` and `material` names are independent, the same name for both is just a
convention:

```js
await loader.preload([
    { name: "fox", type: "obj", src: "models/fox.obj" },
    { name: "fox", type: "mtl", src: "models/fox.mtl" },
]);

const mesh = new Mesh(400, 300, {
    model: "fox",
    material: "fox",        // texture resolved from the material's map_Kd
    width: 200,
    height: 200,
    rightHanded: true,      // the Mesh default is false — see above
});
world.addChild(mesh);
```

**The MTL loader fetches the textures it references itself** — `map_Kd` and
`map_d` are resolved relative to the `.mtl` and preloaded for you, so there is
no image entry in the manifest above. Passing `texture:` explicitly overrides
that and pins *one* binding over the whole model, which on a multi-material
model suppresses the per-material texture split; leave it out unless you mean
that.

MTL contributes `Kd` (diffuse tint), `d` / `Tr` (opacity), `Ke` (emissive),
`Ks` + `Ns` (specular highlight), `map_Kd` (diffuse texture) and `map_d`
(per-texel opacity). Normal and specular *maps* are not supported.
`loader.getOBJ(name)` and `loader.getMTL(name)` return the parsed data if you
want it directly. OBJ has no scene graph, no lights, no animation — use glTF for
anything beyond a single static model.

## Packaging

A self-contained GLB is one file with nothing to resolve — the safest thing to
ship. External references still work in both formats: `.bin` buffers and image
`uri`s are resolved **relative to the asset's own URL** (a GLB with an external
texture loads as-shipped). But an external file that 404s rejects the parse, so
the whole asset fails to load rather than arriving partially — no untextured
fallback. Note that `loader.setBaseURL("*", …)` deliberately skips `gltf`,
`glb`, `obj` and `mtl` for this reason; set those types individually if you
need a prefix.

## Symptom → cause

| symptom | cause |
|---|---|
| model mirrored — text backwards, gear on the wrong side | `Mesh` defaults `rightHanded` to `false`; pass `true` |
| model upside down | a manual axis flip on top of the loader's conversion |
| scene is enormous or invisibly small | `scale` left at 1 against a metre-scale export |
| the asset fails to load entirely | an external buffer/image `uri` that 404s, or Draco-compressed geometry |
| everything is blown out white | authored lux/candela intensities; use `lightIntensityScale` |
| materials flatter than the authoring-tool preview | no normal or metallic/roughness *textures* are imported |
| a character does not deform | vertex skinning is out of scope; rig hierarchically or billboard |
| animation names come back empty | the asset has no node-TRS channels (skin-only rig) |
| a hundred copies tank the frame rate | exported without `EXT_mesh_gpu_instancing` |
| a shadow smeared across the whole floor | a ground plane cast its own blob — use the scene-wide opt-in |
| `onLoaded` gets a string, not the scene | it is called with the level id; load into your own container instead |
| scene renders flat and unlit | no `Camera3d` — the 2D-camera path is CPU-projected and unlit (with a `Camera3d` on Canvas you get a black canvas instead) |

## Related skills

- `melonjs-3d` — conventions, `Camera3d`, meshes, `Light3d`, instancing
- `melonjs-lighting` — how `Light3d` behaves once imported
- `melonjs-loading-assets` — the loader, asset types and base URLs
- `melonjs-plugins` — the Spine plugin, for skeletal characters
