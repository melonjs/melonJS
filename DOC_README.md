<p align="center">
  <img src="https://raw.githubusercontent.com/melonjs/melonJS/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png" alt="melonJS" width="600">
</p>

<p align="center">
  <em>A modern, plugin-free HTML5 game engine</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/melonjs"><img src="https://img.shields.io/npm/v/melonjs.svg" alt="npm"></a>
  <a href="https://bundlejs.com/?q=melonjs"><img src="https://img.shields.io/bundlejs/size/melonjs?label=minzip" alt="size"></a>
  <a href="https://discord.gg/aur7JMk"><img src="https://img.shields.io/discord/608636676461428758?color=7289da&label=discord" alt="discord"></a>
</p>

---

## Quick Start

```bash
npm install melonjs
```

```javascript
import { Application, Sprite, loader } from "melonjs";

// create a new melonJS application
const app = new Application(1218, 562, {
    parent: "screen",
    scale: "auto",
    backgroundColor: "#202020",
});

// initialize it (builds the renderer and appends the canvas)
await app.init();

// load and add a sprite
loader.preload([{ name: "player", type: "image", src: "player.png" }], () => {
    app.world.addChild(new Sprite(609, 281, { image: "player" }));
});
```

> **Note:** since version 20.0, `await app.init()` is **required** after constructing the `Application`. The WebGPU backend, which `AUTO` tries first where available, acquires its GPU device asynchronously; the call resolves without suspending on the WebGL and Canvas backends.

## Features

| Feature | Description |
|---------|-------------|
| **Rendering** | WebGPU, WebGL 2 and Canvas 2D with automatic fallback — the same feature set on every backend |
| **3D** | Perspective {@link Camera3d | Camera3d}, mesh instancing, ground shadows, distance fog, point and spot lights, glTF/GLB and OBJ/MTL loading |
| **Tiled Maps** | First-class [Tiled](https://www.mapeditor.org/) map editor support (TMX/JSON), with GPU-accelerated tile rendering for orthogonal maps |
| **Sprites** | Texture atlas, animation, TexturePacker & Aseprite support |
| **Physics** | Built-in SAT collision with gravity and friction, shape-level collision events, and a {@link PhysicsAdapter | PhysicsAdapter} interface for Box2D (planck) or Matter.js |
| **Audio** | Web Audio API with format fallback, plus procedural tone and noise generation |
| **Input** | Keyboard, mouse, touch, gamepad |
| **Particles** | Configurable {@link ParticleEmitter | ParticleEmitter}, with a reference space so particles can be measured from the emitter, the world, or any container |
| **Effects** | All thirteen CSS blend modes on every renderer, tinting, masking, and camera post-processing chains |
| **Custom Shaders** | Per-sprite {@link ShaderEffect | ShaderEffect} carrying both GLSL and WGSL, so one effect runs on either GPU backend |
| **UI** | Built-in UI components (buttons, text input, containers) |

## Common Tasks

#### Load a level from a Tiled map
Load a level created with the [Tiled](https://www.mapeditor.org/) map editor. melonJS supports orthogonal, isometric, and hexagonal maps with multiple layers, animated tiles, and collision shapes.
```javascript
import { level } from "melonjs";

// load a level by name (must be preloaded first)
level.load("myLevel");
```
See: {@link level.load | level}, {@link TMXTileMap | TMXTileMap}

#### Create a sprite with animations
Create a sprite from a texture atlas (e.g. exported from TexturePacker or Aseprite) and define animation sequences from named frames.
```javascript
import { Sprite, TextureAtlas, loader } from "melonjs";

// create a texture atlas from preloaded JSON + image
const atlas = new TextureAtlas(loader.getJSON("atlas"), loader.getImage("atlas"));

// create a sprite with animation frames from the atlas
const player = new Sprite(100, 100,
    atlas.getAnimationSettings(["walk01.png", "walk02.png", "walk03.png"])
);
```
See: {@link Sprite | Sprite}, {@link TextureAtlas | TextureAtlas}

#### Handle keyboard and gamepad input
Bind physical keys or gamepad buttons to named actions, then check those actions in your game logic.
```javascript
import { input } from "melonjs";

// bind the spacebar and gamepad button to a "jump" action
input.bindKey(input.KEY.SPACE, "jump");

// check if the action is active (e.g. in an update loop)
if (input.isKeyPressed("jump")) {
    // make the player jump
}
```
See: {@link input | input}

#### Add physics and collision to a game object
Attach a physics body with a collision shape to any renderable. The engine handles gravity, velocity, friction, and collision detection automatically.
```javascript
import { Body, Rect, collision } from "melonjs";

// create a rectangular collision body (x, y, width, height)
this.body = new Body(this, new Rect(0, 0, 32, 32));

// set collision type so the engine knows how to handle collisions
this.body.collisionType = collision.types.PLAYER_OBJECT;

// set movement limits and friction
this.body.setMaxVelocity(3, 15);
this.body.setFriction(0.4, 0);
```
See: {@link Body | Body}, {@link collision | collision}

#### Apply a custom shader effect to a sprite
Apply a per-sprite fragment shader using `ShaderEffect`. You only need to write the color transformation — the vertex shader and texture sampling are handled automatically. Runs on both GPU backends — write the body once and it is realized as GLSL or WGSL for the active renderer — and is silently ignored in Canvas mode.
```javascript
import { ShaderEffect } from "melonjs";

// apply a grayscale effect to a sprite
mySprite.addPostEffect(new ShaderEffect(renderer, `
    vec4 apply(vec4 color, vec2 uv) {
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        return vec4(vec3(gray), color.a);
    }
`));
```
See: {@link ShaderEffect | ShaderEffect}, {@link Renderable.addPostEffect | addPostEffect}

## Using this reference with an AI assistant

Three things here are meant for assistants as much as for people.

**`llms.txt`** — [melonjs.github.io/melonJS/llms.txt](https://melonjs.github.io/melonJS/llms.txt)
indexes every exported class, function, interface and type with a one-line
summary and a link to its page, and marks the deprecated ones. It is
regenerated on every docs build, so it never drifts from the release. Point an
assistant at that single URL rather than asking it to guess an API name.

**Copy page** — the button in the header above copies the page you are reading
as Markdown, with its canonical URL attached, or hands it straight to an
assistant. Useful when you want to ask about one class without the model
fetching half the reference.

**Skills** — the engine ships guidance files that teach an assistant its
conventions, and more usefully the mistakes that fail *silently* rather than
raising an error: a custom `draw()` that ignores `this.pos`, `isKinematic`
blocking pointer events, `.z` set after `addChild`. They are versioned with the
engine, so a copy matching your exact release always ships inside the package.

Install them into whatever assistant you use, with one command:

```bash
npx skills add https://github.com/melonjs/melonJS/tree/master/packages/melonjs/skills
```

It installs one copy of each skill under `.agents/skills/<skill-name>`, then
symlinks that copy into every assistant's own directory, so
`.claude/skills/melonjs` points back at `.agents/skills/melonjs` and there is
nothing to place by hand. The installer reports coverage of 77 agents. It
installs from `master`; swap that for a release tag in the URL to pin.

They are plain Markdown — readable by any agent, or by you.

## Links

- [Live Examples](https://melonjs.github.io/melonJS/examples/)
- [GitHub Repository](https://github.com/melonjs/melonJS)
- [Discord Community](https://discord.gg/aur7JMk)
- [melonjs.org](http://www.melonjs.org/)
