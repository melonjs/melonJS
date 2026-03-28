melonJS 2
=========
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![Build Status](https://github.com/melonjs/melonJS/actions/workflows/main.yml/badge.svg)](https://github.com/melonjs/melonJS/actions/workflows/main.yml)
[![NPM Package](https://img.shields.io/npm/v/melonjs)](https://www.npmjs.com/package/melonjs)
[![NPM Downloads](https://img.shields.io/npm/dm/melonjs)](https://www.npmjs.com/package/melonjs)
[![Build Size](https://badgen.net/bundlephobia/minzip/melonjs)](https://bundlephobia.com/result?p=melonjs)
[![Tree-shaking](https://badgen.net/bundlephobia/tree-shaking/melonjs)](https://bundlephobia.com/result?p=melonjs)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/melonjs/badge?style=rounded)](https://www.jsdelivr.com/package/npm/melonjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Discord](https://img.shields.io/discord/608636676461428758?color=7289da&label=discord)](https://discord.gg/aur7JMk)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)


A modern & lightweight HTML5 game engine
-------------------------------------------------------------------------------
![melonJS](https://melonjs.org/img/alex4-github.png)

[melonJS](https://melonjs.org/) is an open-source HTML5 game engine that empowers developers to create 2D games using modern JavaScript and TypeScript. Built with ES6 classes and bundled using [esbuild](https://esbuild.github.io), it provides tree-shaking support for optimal bundle sizes.

[melonJS](https://melonjs.org/) is licensed under the [MIT License](LICENSE.md) and actively maintained with the help of a small team of enthusiasts at AltByte in Singapore.

Why melonJS
-------------------------------------------------------------------------------

melonJS is designed so you can **focus on making games, not on graphics plumbing**.

- **Canvas2D-inspired rendering API** — If you've used the HTML5 Canvas, you already know melonJS. The rendering API (`save`, `restore`, `translate`, `rotate`, `setColor`, `fillRect`, ...) follows the same familiar patterns — no render graphs, no shader pipelines, no instruction sets to learn.

- **True renderer abstraction** — Write your game once, run it on WebGL or Canvas2D with zero code changes. The engine handles all GPU complexity behind a unified API, with automatic fallback when WebGL is not available. Designed to support future backends (WebGPU) without touching game code.

- **Complete engine, minimal footprint** — Physics, tilemaps, audio, input, cameras, tweens, particles, UI — a full 2D game stack in a single tree-shakeable ES module. No dependency sprawl, no library stitching.

- **Tiled as a first-class citizen** — Deep [Tiled](https://www.mapeditor.org) integration built into the core: orthogonal, isometric, hexagonal and staggered maps, animated tilesets, collision shapes, object properties, compressed formats — all parsed and rendered natively.

- **Batteries included, hackable by design** — Get started in minutes with minimal setup. When you need to go deeper: ES6 classes throughout, a plugin system for engine extensions, and a clean architecture that's easy to extend without fighting the framework.

About melonJS
-------------------------------------------------------------------------------

[melonJS](https://melonjs.org/) is a fully featured game engine :

Compatibility
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with all major browsers (Chrome, Safari, Firefox, Opera, Edge) and mobile devices

Graphics
- 2D sprite-based graphic engine
- Fast WebGL renderer for desktop and mobile devices with fallback to Canvas rendering
- High DPI resolution & Canvas advanced auto scaling
- Sprite with 9-slice scaling option, and animation management
- Built-in effects such as tinting, masking and 2D lighting
- Standard spritesheet, single and multiple Packed Textures support
- Compressed texture support (DDS, KTX, KTX2, PVR, PKM) with automatic format detection and fallback
- System & Bitmap Text
- Video sprite playback

Sound
- Web Audio support with 3D spatial audio and stereo panning based on [Howler](https://howlerjs.com)

Physics
- Polygon (SAT) based collision algorithm for accurate detection and response
- Fast Broad-phase collision detection using spatial partitioning (QuadTree)
- Collision filtering for optimized automatic collision detection
- Multiple shapes per body for complex hitboxes

Input
- Mouse and Touch device support (with mouse emulation)
- Gamepad support with button and axes binding
- Keyboard event handling with key binding system
- Device motion & accelerometer support

Camera
- Camera follow with configurable deadzone and damping
- Built-in shake, fade and flash effects

UI
- Clickable, hoverable and draggable UI elements
- Drag-and-drop support
- Text buttons with built-in styling

Level Editor
- [Tiled](https://www.mapeditor.org) map format [up to 1.12](https://doc.mapeditor.org/en/stable/reference/tmx-changelog/) built-in support for easy level design
    - Uncompressed and [compressed](https://github.com/melonjs/melonJS/tree/master/packages/tiled-inflate-plugin) Plain, Base64, CSV and JSON encoded XML tilemap loading
    - Orthogonal, Isometric, Hexagonal and Oblique maps (both normal and staggered)
    - Multiple layers (multiple background/foreground, collision and Image layers)
    - Parallax scrolling via Image layers
    - Animated and multiple Tileset support
    - Tileset transparency settings
    - Layers alpha and tinting settings
    - Rectangle, Ellipse, Polygon and Polyline objects support
    - Tiled Objects with custom properties
    - Flipped & rotated Tiles
    - Dynamic Layer and Object/Group ordering
    - Dynamic Entity loading
    - Shape based Tile collision support

Assets
- Asynchronous asset loading with progress tracking
- A fully customizable preloader
- Support for images, JSON, TMX/TSX, audio, video, binary and fonts

Core
- A state manager (to easily manage loading, menu, options, in-game state)
- Tween effects with multiple easing functions (Quadratic, Cubic, Elastic, Bounce, etc.) and Bezier/Catmull-Rom interpolation
- Transition effects
- Pooling support for object recycling
- Basic Particle System
- EventEmitter based event system
- Persistent data storage (save/load via localStorage)
- Plugin system for extending engine capabilities

Tools integration
-------------------------------------------------------------------------------
melonJS is supporting the below tools and frameworks natively or through our official plugin(s) :

 [![Free Texture Packer](https://user-images.githubusercontent.com/4033090/136762061-1d3a0dfe-dbe0-4d3d-808d-47a49ecf5309.png "Free Texture Packer")](http://free-tex-packer.com)
 [![TexturePacker](https://user-images.githubusercontent.com/4033090/136762472-bc55a638-c69b-4ff5-9d03-c684c8bea0ea.png "TexturePacker")](https://www.codeandweb.com/texturepacker)
 [![PhysicsEditor](https://user-images.githubusercontent.com/4033090/136762890-b1010c7f-cb19-4d35-a3f1-f5048db07835.png "PhysicsEditor")](https://www.codeandweb.com/physicseditor)
 [![ShoeBox](https://user-images.githubusercontent.com/4033090/136762705-92027d94-d87c-4a95-b051-26647410248d.png "ShoeBox")](https://renderhjs.net/shoebox/)
 [![Tiled](https://user-images.githubusercontent.com/4033090/136762999-5a7f377b-4136-4205-9fe0-83728c90cb9b.png "Tiled")](https://www.mapeditor.org)
 [![Cordova](https://user-images.githubusercontent.com/4033090/136763147-6d157ce6-6921-437e-bb8f-0287b86109da.png "Cordova")](https://cordova.apache.org)
[![Spine](https://github.com/melonjs/melonJS/assets/4033090/7a8d81b8-bc80-47bd-80dc-d9a054c78c96 "Spine")](http://esotericsoftware.com)
[![aseprite](https://github.com/melonjs/melonJS/assets/4033090/65d19fef-2eba-461a-b925-cc2ad3bb270c "aseprite")](https://www.aseprite.org)

Tools integration and usage with melonJS is documented in our [Wiki](https://github.com/melonjs/melonJS/wiki#third-party-tools-usage).

Getting Started
-------------------------------------------------------------------------------

The fastest way to create a new game:

    npm create melonjs my-game
    cd my-game
    npm install
    npm run dev

This scaffolds a ready-to-run project with TypeScript, Vite, and the debug plugin. It also works with plain JavaScript — just rename `.ts` files to `.js`.

You can also start from the [boilerplate](https://github.com/melonjs/typescript-boilerplate) directly, or follow the step-by-step [Platformer Tutorial](https://melonjs.org/tutorial/).

For more details, check the wiki [Details & Usage](https://github.com/melonjs/melonJS/wiki#details--usage) guide.

Examples
-------------------------------------------------------------------------------

* [Platformer](https://melonjs.github.io/melonJS/examples/#/platformer) ([source](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/platformer))
* [Isometric RPG](https://melonjs.github.io/melonJS/examples/#/isometric-rpg) ([source](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/isometricRpg))
* [SVG Shapes](https://melonjs.github.io/melonJS/examples/#/svg-shapes) ([source](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/svgShapes))
* [Graphics](https://melonjs.github.io/melonJS/examples/#/graphics) ([source](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/graphics))
* [Hello World](https://melonjs.github.io/melonJS/examples/#/hello-world) ([source](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/helloWorld))
* [Whac-A-Mole](https://melonjs.github.io/melonJS/examples/#/whac-a-mole) ([source](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/whac-a-mole))
* [Compressed Textures](https://melonjs.github.io/melonJS/examples/#/compressed-textures) ([source](https://github.com/melonjs/melonJS/tree/master/packages/examples/src/examples/compressedTextures))

Browse all examples [here](https://melonjs.github.io/melonJS/examples/)

-------------------------------------------------------------------------------

### Basic Hello World Example

```JavaScript
import * as me from "https://esm.run/melonjs";

me.device.onReady(function () {
    // initialize the display canvas once the device/browser is ready
    if (!me.video.init(1218, 562, {parent : "screen", scale : "auto"})) {
        alert("Your browser does not support HTML5 canvas.");
        return;
    }

    // set a gray background color
    me.game.world.backgroundColor.parseCSS("#202020");

    // add a font text display object
    me.game.world.addChild(new me.Text(609, 281, {
        font: "Arial",
        size: 160,
        fillStyle: "#FFFFFF",
        textBaseline : "middle",
        textAlign : "center",
        text : "Hello World !"
    }));
});
```
> Simple hello world using melonJS 2

Documentation
-------------------------------------------------------------------------------

* [Online API](https://melonjs.github.io/melonJS/)

Plugins
-------------------------------------------------------------------------------
melonJS provides a plugin system allowing to extend the engine capabilities.

Here is the list of official plugins maintained by the melonJS team:
- [debug-plugin](https://github.com/melonjs/melonJS/tree/master/packages/debug-plugin) - a debug panel for inspecting game objects
- [tiled-inflate-plugin](https://github.com/melonjs/melonJS/tree/master/packages/tiled-inflate-plugin) - enable loading and parsing of zlib, gzip and zstd compressed [Tiled](https://www.mapeditor.org/) maps
- [spine-plugin](https://github.com/melonjs/spine-plugin) - [Spine](http://esotericsoftware.com) runtime integration to render Spine skeletal animations

If you wish to develop your own plugin, we also provide a [plugin template](https://github.com/melonjs/plugin-template) to help you get started.

Installation
-------------------------------------------------------------------------------

melonJS is distributed as a tree-shakeable ES6 module with TypeScript declarations included.

Install via [npm](https://www.npmjs.com/package/melonjs) :

    npm install melonjs

Then import it in your project :

```JavaScript
import * as me from 'melonjs';
```

Or use it directly via [jsDelivr](https://www.jsdelivr.com/package/npm/melonjs) CDN :

```html
<!-- load the ES6 module bundle of melonJS v18.0 -->
<script type="module" src="https://esm.run/melonjs@18.0"></script>
<!-- omit the version completely to get the latest one -->
<!-- you should NOT use this in production -->
<script type="module" src="https://esm.run/melonjs"></script>
```
> Note: the debug plugin is available separately as [`@melonjs/debug-plugin`](https://www.npmjs.com/package/@melonjs/debug-plugin)

Community
-------------------------------------------------------------------------------
Join us and get help or share your projects :

- [Discord](https://discord.gg/aur7JMk)
- [Wiki](https://github.com/melonjs/melonJS/wiki)
- [FAQ](https://github.com/melonjs/melonJS/wiki/FAQ)

Contributing
-------------------------------------------------------------------------------
We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting changes or new features.

<a href = "https://github.com/melonjs/melonJS/graphs/contributors">
  <img src = "https://contrib.rocks/image?repo=melonJS/melonjs"/>
</a>

Sponsors
-------------------------------------------------------------------------------
Support the development of melonJS by [becoming a sponsor](https://github.com/sponsors/melonjs). Get your logo in our README with a link to your site or become a backer and get your name in the [BACKERS](BACKERS.md) list. Any level of support is really appreciated and goes a long way !

[![Melon Gaming](https://user-images.githubusercontent.com/4033090/136695857-d098c27d-f4b2-4c71-8574-b5f4291779cb.png "Melon Gaming")](https://www.melongaming.com)

[![Altbyte Pte Ltd](https://user-images.githubusercontent.com/4033090/136692693-35dca8aa-5012-4a37-9ea2-51640d2e6d73.png "AltByte")](https://www.altbyte.com)
