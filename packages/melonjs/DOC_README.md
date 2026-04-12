<p align="center">
  <img src="https://raw.githubusercontent.com/melonjs/melonJS/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png" alt="melonJS" width="600">
</p>

<p align="center">
  <em>A lightweight, plugin-free HTML5 game engine</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/melonjs"><img src="https://img.shields.io/npm/v/melonjs.svg" alt="npm"></a>
  <a href="https://github.com/nicedoc/bundlephobia/blob/master/LICENSE"><img src="https://img.shields.io/bundlephobia/min/melonjs" alt="size"></a>
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

// load and add a sprite
loader.preload([{ name: "player", type: "image", src: "player.png" }], () => {
    app.world.addChild(new Sprite(609, 281, { image: "player" }));
});
```

## Features

| Feature | Description |
|---------|-------------|
| **Rendering** | WebGL & Canvas 2D with automatic fallback, 3D mesh rendering with OBJ/MTL support |
| **Tiled Maps** | First-class [Tiled](https://www.mapeditor.org/) map editor support (TMX/JSON) |
| **Sprites** | Texture atlas, animation, TexturePacker & Aseprite support |
| **Physics** | Built-in collision detection (SAT), gravity, friction |
| **Audio** | Web Audio API with format fallback |
| **Input** | Keyboard, mouse, touch, gamepad |
| **Particles** | Configurable particle emitter system |
| **Custom Shaders** | Per-sprite [ShaderEffect](classes/ShaderEffect.html) for WebGL fragment effects |
| **UI** | Built-in UI components (buttons, text input, containers) |

## Common Tasks

#### Load a level from a Tiled map
Load a level created with the [Tiled](https://www.mapeditor.org/) map editor. melonJS supports orthogonal, isometric, and hexagonal maps with multiple layers, animated tiles, and collision shapes.
```javascript
import { level } from "melonjs";

// load a level by name (must be preloaded first)
level.load("myLevel");
```
See: [`level`](functions/level.load.html), [`TMXTileMap`](classes/TMXTileMap.html)

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
See: [`Sprite`](classes/Sprite.html), [`TextureAtlas`](classes/TextureAtlas.html)

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
See: [`input`](modules/input.html)

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
See: [`Body`](classes/Body.html), [`collision`](modules/collision.html)

#### Apply a custom shader effect to a sprite
Apply a per-sprite fragment shader using `ShaderEffect`. You only need to write the color transformation — the vertex shader and texture sampling are handled automatically. Works with WebGL, silently ignored in Canvas mode.
```javascript
import { ShaderEffect } from "melonjs";

// apply a grayscale effect to a sprite
mySprite.shader = new ShaderEffect(renderer, `
    vec4 apply(vec4 color, vec2 uv) {
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        return vec4(vec3(gray), color.a);
    }
`);
```
See: [`ShaderEffect`](classes/ShaderEffect.html), [`GLShader`](classes/GLShader.html)

## Links

- [Live Examples](https://melonjs.github.io/melonJS/examples/)
- [GitHub Repository](https://github.com/melonjs/melonJS)
- [Discord Community](https://discord.gg/aur7JMk)
- [melonjs.org](http://www.melonjs.org/)
