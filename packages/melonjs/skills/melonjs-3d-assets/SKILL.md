---
name: melonjs-3d-assets
description: "Use this skill when loading 3D models into melonJS — glTF and GLB scenes, OBJ/MTL models, materials, imported lights, node animation, ground shadows and GPU instancing. Covers level.load options including the async flag, the rightHanded conversion, and exactly what the loader does and does not support. Triggers on: glTF, gltf, glb, OBJ, MTL, 3D model, getGLTF, getOBJ, getMTL, GLTFModel, GLTFScene, level.load glb, rightHanded, lightIntensityScale, castGroundShadow, shadowGroundY, EXT_mesh_gpu_instancing, KHR_lights_punctual, skinning, Blender export, 3D asset."
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
| `async` | `false` | return a promise that settles once the scene is in the world, instead of a boolean |
| `rightHanded` | `true` | see below |
| `lights` | `true` | instantiate authored `KHR_lights_punctual` lights as `Light3d` world children |
| `lightIntensityScale` | — | keep authored intensity ratios instead of normalising every light to 1 |
| `castGroundShadow` | inherits the app setting (**on**) | blob shadows for this scene's meshes |
| `shadowGroundY` | each object's own base | world Y of the floor the blobs land on |

`onLoaded` receives the level id — it is a "done" signal, not a handle on the
scene. You need it, or `async`: with the game loop running, `level.load` stops
the loop and defers the actual load to a timer, so by default it returns
*before* anything is in the world.

```js
await level.load("diorama", { scale: 50, async: true });
// the scene is in the world here
```

Note `await level.load("diorama")` without the flag does not await the load — the
call returns a boolean, and `await true` resolves immediately. To get at what was
loaded, load into a container you own, or look the nodes up by their authored
names:

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

### Placing and moving a model

A `GLTFModel` is placed like any other renderable — `pos`, `depth`, `rotate`
and `scale` move the **whole rig**, and compose with whatever the active clip
is doing, so a walk cycle plays wherever the character stands:

```js
const boat = new me.GLTFModel(me.loader.getGLTF("boat"), { scale: 40, lit: false });
boat.setCurrentAnimation("paddle", { loop: true });
app.world.addChild(boat);

boat.pos.set(steerX, waterLevel);
boat.depth = travelled;
boat.rotate(lean - lastLean, AXIS_Z);   // `rotate` is RELATIVE — feed it the delta
boat.animationspeed = 0.85 + 0.9 * pace; // one authored tempo, many run speeds
```

Constructing one directly from `loader.getGLTF(name)` is fine and is the way to
go when the model is a game object rather than a scene — `level.load` is for
loading a whole scene into the world.

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

A blob is centred on its caster's x/z and is never offset by light direction, so
a wide flat-bottomed prop hides its own shadow under itself. Raising
`shadowGroundY` to force one into view floats the blob up over the object as a
dark ring rather than sliding it clear — the setting is for things that leave
the ground, not a visibility knob.

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

## Authoring assets for the engine

Notes from modelling props and a rigged character against this loader. They are
Blender-specific in the API details, general in the traps.

### One clip means one action

glTF names an animation after the **action** it came from, so three objects
each carrying their own action export as three separate clips — and a game can
only play one clip at a time, so the other two never move. Put every animated
object in **one action**, using slots (Blender 4.4+):

```python
shared = bpy.data.actions.new("paddle")
for ob in (pivot, shoulder_l, shoulder_r, body):
    ad = ob.animation_data_create()
    ad.action = shared
    ad.action_slot = shared.slots.new('OBJECT', ob.name)
```

Exporting with the scene/whole-timeline mode does **not** merge per-object
actions into one clip — it still emits one per action. Slots are the fix.

In Blender 5.x, `action.fcurves` no longer exists; curves live under
`action.layers[].strips[].channelbags[].fcurves`, and a channelbag identifies
its slot as `cb.slot.identifier` (there is no `slot_identifier`).

### Never re-parent or join a rig that is mid-pose

Both parenting and joining bake the objects' **current world transforms**.
Parenting a child while the parent sits in an animated pose writes the inverse
of that pose into `matrix_parent_inverse`, which silently cancels the animation
— the part renders rigid while the curves still exist. Detach the action, zero
the rig, do the surgery, then reattach:

```python
saved = [(o, o.animation_data.action_slot) for o in animated]
for ob, _ in saved:
    ob.animation_data.action = None
    ob.rotation_euler = (0, 0, 0)
# ...re-parent / join here...
for ob, slot in saved:
    ob.animation_data.action = act
    ob.animation_data.action_slot = slot
```

A joined mesh also inherits the **active** object's scale, so joining into a
box that was scaled to `(0.8, 2.0, 0.1)` leaves a node with that non-uniform
scale and geometry divided back through it. It renders in the right place but
skews flat-shaded normals — apply transforms (`rotation=True, scale=True`)
after joining. Watch for a related trap: setting `ob.scale.x` on a mesh whose
size was already applied *multiplies* rather than replaces it.

### A model only needs to stay split where something animates it

Every glTF primitive is a draw call. Merge everything static into one mesh and
keep separate nodes only for the parts a clip actually drives — a boat with a
rabbit and a paddle went from 28 primitives to 5 that way, with no visible
change.

### One palette strip beats one material per colour

An `InstancedMesh` is **one geometry and one material**, so a prop that wants
five colours cannot use five materials. Give the whole model a single material
whose image is an *N*×1 strip, one pixel per shade, and point each face's UVs
at a cell centre (`u = (cell + 0.5) / N`, `v = 0.5`) with the sampler set to
nearest. A whole scene's palette then costs one tiny texture, a merged mesh can
be twenty colours, and there is nothing to bleed between cells.

Colour-space trap when generating that strip programmatically: Blender's
`image.pixels` are scene-linear floats, but this export path writes them out
**verbatim**, so pre-converting sRGB→linear darkens every colour. White is the
tell — it is the one value identical in both spaces, so if white survives and
everything else came out dark, that is the bug. Verify by decoding the PNG back
out of the GLB and comparing bytes to the source palette.

### Feeding an authored mesh into an `InstancedMesh`

`EXT_mesh_gpu_instancing` covers instances authored *in the file*. When the
game places them itself, take the geometry off the parsed descriptor instead:

```js
const node = me.loader.getGLTF("palm").nodes[0];
const trees = new me.InstancedMesh(0, groundY, {
    vertices: node.vertices, uvs: node.uvs,
    normals: node.normals, indices: node.indices,
    texture: palette, textureFilter: "nearest", scale: 40,
    instanceCount: count,
});
```

`nodes` is one entry **per primitive**, each in its own local space with a
separate `world` matrix — so this only works cleanly when the asset is a single
merged primitive exported with an identity node transform. Model it at the
origin, base on the floor, and apply transforms before exporting.

One geometry stamped out hundreds of times reads as one object *copied*
hundreds of times, so vary each instance in its transform. Rotate **after**
translating, or the instance swings around the group origin instead of turning
where it stands:

```js
placement.identity().translate(x / s, -y / s, z / s)
         .rotate(math.randomFloat(0, Math.PI * 2), AXIS_Y);
const j = math.randomFloat(0.82, 1.18);
placement.scale(j, j, j);
```

Sizing every prop against **one** scale constant, rather than giving each its
own, keeps "this looks wrong" a modelling question instead of a scaling one.

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
| a whole scatter looks like one object repeated | every instance shares the group transform — vary yaw/scale per instance, rotating *after* the translate |
| three clips where you authored one | one action per object; use a single action with a slot each |
| one part of a rig renders rigid while its curves exist | it was re-parented mid-pose, baking the inverse into `matrix_parent_inverse` |
| a merged mesh lights wrong along one axis | it inherited the active object's non-uniform scale on join — apply transforms |
| an authored palette comes out uniformly dark, but white is correct | linear values written to a strip that is saved verbatim |
| `getGLTF(name).nodes[0]` geometry lands in the wrong place | `nodes` is per primitive, each with its own `world`; merge to one primitive and export at the origin |
| a prop casts no visible shadow | wide and flat-bottomed — the blob is under it; `shadowGroundY` haloes it rather than revealing it |
| shadows only show on casters near the camera | `shadowGroundY` is on the wrong side — Y-down means the floor is a **greater** y, so a `pos.y - lift` puts the blob inside the caster and the depth test leaves only a hairline ring |
| a shadow smeared across the whole floor | a ground plane cast its own blob — use the scene-wide opt-in |
| `onLoaded` gets a string, not the scene | it is called with the level id; load into your own container instead |
| scene renders flat and unlit | no `Camera3d` — the 2D-camera path is CPU-projected and unlit (with a `Camera3d` on Canvas you get a black canvas instead) |

## Related skills

- `melonjs-3d` — conventions, `Camera3d`, meshes, `Light3d`, instancing, and
  `camera.setFog` (an outdoor scene almost always wants it; it is set on the
  camera, so a loaded scene needs no per-node work)
- `melonjs-lighting` — how `Light3d` behaves once imported
- `melonjs-loading-assets` — the loader, asset types and base URLs
- `melonjs-plugins` — the Spine plugin, for skeletal characters
