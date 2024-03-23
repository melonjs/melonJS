melonJS 2
=========
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![Build Size](https://badgen.net/bundlephobia/minzip/melonjs)](https://bundlephobia.com/result?p=melonjs)
[![Tree-shaking](https://badgen.net/bundlephobia/tree-shaking/react-colorful)](https://bundlephobia.com/result?p=melonjs)
[![NPM Package](https://img.shields.io/npm/v/melonjs)](https://www.npmjs.com/package/melonjs)
[![jsDeliver](https://data.jsdelivr.com/v1/package/npm/melonjs/badge?style=rounded)](https://www.jsdelivr.com/package/npm/melonjs)
[![Boss Bounty Badge](https://img.shields.io/endpoint.svg?url=https://api.boss.dev/badge/enabled/melonjs/melonJS)](https://www.boss.dev/issues/repo/melonjs/melonJS)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)


A fresh, _modern_ & lightweight HTML5 game engine
-------------------------------------------------------------------------------
![melonJS](https://melonjs.org/img/alex4-github.png)

melonJS 2 is a modern version of the melonJS game engine that was first released in 2011. It has been rebuilt entirely using ES6 class, inheritance and semantic, and bundled using Rollup to provide modern features such as transpiling and tree-shaking.

>Note: migrating an existing project to melonJS 2 (version 10.0 and higher) will definitely break your game (ES6 semantic and inheritance, nodeJS event emitter, and no backward compatibility with deprecated legacy APIs), and you might want to read first this small step by step guide on [upgrading to melonJS 2](https://github.com/melonjs/melonJS/wiki/Upgrading-to-melonJS-2). If you are looking at the legacy version (9.x and lower) of melonJS, you can find it [here](https://github.com/melonjs/melonJS/tree/legacy) under the _legacy_ branch.

[melonJS](https://melonjs.org/) is open-source, licensed under the [MIT License](LICENSE.md), and actively developed and maintained with the help of a small team of enthusiasts at AltByte in Singapore.

About melonJS
-------------------------------------------------------------------------------

[melonJS](https://melonjs.org/) is a fully featured game engine :

Compatibility
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with all major browsers (Chrome, Safari, Firefox, Opera, Edge) and mobile devices

Graphics
- 2D sprite-based graphic engine
- [Blazing Fast](https://melonjs.discourse.group/t/melonjs-benchmark/48/4) WebGL renderer for desktop and mobile devices with fallback to Canvas rendering
- High DPI resolution & Canvas advanced auto scaling
- Sprite with 9-slice scaling option, and animation management
- built-in effects such as tinting and masking
- Standard spritesheet, single and multiple Packed Textures support
- System & Bitmap Text

Sound
- Web Audio support with 3D spatial audio or stereo panning based on [Howler](https://howlerjs.com)
- fallback to Multi-channel HTML5 audio for legacy browsers

Physic
- Polygon (SAT) based collision algorithm for accurate detection and response
- Fast Broad-phase collision detection using spatial partitioning
- Collision filtering for optimized automatic collision detection

Input
- Mouse and Touch device support (with mouse emulation)
- Device motion & accelerometer support

Level Editor
- Tiled map format version +1.0 built-in support for easy level design
    - Uncompressed and [compressed](https://github.com/melonjs/tiled-inflate-plugin) Plain, Base64, CSV and JSON encoded XML tilemap loading
    - Orthogonal, Isometric and Hexagonal maps (both normal and staggered)
    - Multiple layers (multiple background/foreground, collision and Image layers)
    - Animated and multiple Tileset support
    - Tileset transparency settings
    - Layers alpha and tinting settings
    - Rectangle, Ellipse, Polygon and Polyline objects support
    - Tiled Objects
    - Flipped & rotated Tiles
    - Dynamic Layer and Object/Group ordering
    - Dynamic Entity loading
    - Shape based Tile collision support

Assets
- Asynchronous asset loading
- A fully customizable preloader

And Also
- A state manager (to easily manage loading, menu, options, in-game state)
- Tween Effects, Transition effects
- Pooling support for object recycling
- Basic Particle System
- nodeJS EventEmitter based event system

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

# Using melonJS

### For your first time using melonJS, this is where you start

- [melonJS: Hacking a Platformer Game](https://melonjs.org/tutorial/)

You may find it useful to skim the overview found at the wiki [Details & Usage](https://github.com/melonjs/melonJS/wiki#details--usage)

When starting your own projects, checkout our [ES6 x Vite boilerplate](https://github.com/melonjs/es6-boilerplate) or the [TypeScript x Vite boilerplate](https://github.com/melonjs/typescript-boilerplate)

Demos
-------------------------------------------------------------------------------

A few demos of melonJS capabilities :

* [Platformer Demo](https://melonjs.github.io/examples/platformer/) ([source](https://github.com/melonjs/examples/tree/master/platformer))
* [Isometric Demo](https://melonjs.github.io/examples/isometric_rpg/) ([source](https://github.com/melonjs/examples/tree/master/isometric_rpg))
* [Sprite Demo](https://melonjs.github.io/examples/sprite/) ([source](https://github.com/melonjs/examples/tree/master/sprite))
* [Masking Demo](https://melonjs.github.io/examples/masking/) ([source](https://github.com/melonjs/examples/tree/master/masking)) (WARNING: may potentially trigger seizures for people with photosensitive epilepsy)
* [Primitive Drawing Demo](https://melonjs.github.io/examples/graphics/) ([source](https://github.com/melonjs/examples/tree/master/graphics))
* [UI Demo](https://melonjs.github.io/examples/UI/) ([source](https://github.com/melonjs/examples/tree/master/UI))
* [Tiled Map Loader Demo](https://melonjs.github.io/examples/tiled_example_loader/) ([source](https://github.com/melonjs/examples/tree/master/tiled_example_loader))
* [Video Demo](https://melonjs.github.io/examples/video/) ([source](https://github.com/melonjs/examples/tree/master/video))

More examples are available [here](https://melonjs.github.io/examples/)

-------------------------------------------------------------------------------

### Basic [Hello World](https://jsfiddle.net/obiot/4o9f02tc/) Example

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
> Simple hello world using melonJS 2 (version 10.x or higher)

Documentation
-------------------------------------------------------------------------------

* [Online API](http://melonjs.github.io/melonJS/docs/)

To enable an offline version of the documentation, navigate to the settings page and enable `offline storage`:
<img width="297" alt="186643536-854af31e-9c94-412e-a764-4bb7f93f15c3" src="https://user-images.githubusercontent.com/4033090/187061867-cf8c4c8a-437b-4f76-9138-610adda0ca23.png">


Plugins
-------------------------------------------------------------------------------
melonJS provide a plugin system allowing to extend the engine capabilities.

Here is the list of official plugins maintained by the melonJS team:
- [debug-plugin](https://github.com/melonjs/debug-plugin) - a debug panel for inspecting game objects
- [tiled-inflate-plugin](https://github.com/melonjs/tiled-inflate-plugin) - enable loading and parsing of zlib and gzip compressed [Tiled](https://www.mapeditor.org/) maps
- [spine-plugin](https://github.com/melonjs/spine-plugin) - [Spine](http://esotericsoftware.com) runtime integration to render Spine skeletal animations

If you wish to develop your own plugin, we also provide a [plugin template](https://github.com/melonjs/plugin-template) to help you get started.

Download melonJS
-------------------------------------------------------------------------------

The latest builds with corresponding release note are available for direct download [here](https://github.com/melonjs/melonJS/releases).

melonJS 2 now only provides an ES6 Bundle :

| build               | description |
| ------------------- | ----------- |
| `melonjs.module.js` | the ES6 Module (ESM) Bundle |
| `melonjs.mjs` | a tree-shakeable ES6 Module Directory |
| `types/index.d.ts` | typescript declaration files for the ES6 Module (ESM) Bundle |

>Note: if you need your application to be compatible with ES5, refer to our [boilerplate](#using-melonjs) that provides automatic transpiling to ES5.

The latest version of melonJS can be installed through [NPM](https://www.npmjs.com/package/melonjs) :

    $ npm install melonjs

And then import melonjs in your project using :

    $ import * as me from 'melonjs';

Or it can simply be added to your html, using [jsDeliver](https://www.jsdelivr.com/package/npm/melonjs) content delivery network (CDN) :

```html
<!-- load the ES6 module bundle of melonJS v10.0 -->
<script type="module" src="https://esm.run/melonjs@10.0"></script>
<!-- omit the version completely to get the latest one -->
<!-- you should NOT use this in production -->
<script type="module" src="https://esm.run/melonjs"></script>
```
> Note: starting from the 10.0.0 version, the debug plugin is no longer provided as part of the melonJS library release, and has been moved to the official [boilerplate](https://github.com/melonjs/es6-boilerplate)

Contributing
-------------------------------------------------------------------------------
For most users, all you probably want is to use melonJS, and all you need then is just to download the latest built [release](https://github.com/melonjs/melonJS#download-melonjs) to get started.

If you want to start to be part and contribute to the project, make sure to read our [Contributing Guide](CONTRIBUTING.md) before starting submitting changes or new features.

Contributors
-------------------------------------------------------------------------------
<a href = "https://github.com/melonjs/melonJS/graphs/contributors">
  <img src = "https://contrib.rocks/image?repo=melonJS/melonjs"/>
</a>

Sponsors
-------------------------------------------------------------------------------
Support the development of melonJS by [becoming a sponsor](https://github.com/sponsors/melonjs). Get your logo in our README with a link to your site or become a backer and get your name in the [BACKERS](BACKERS.md) list. Any level of support is really appreciated and goes a long way !

[![Melon Gaming](https://user-images.githubusercontent.com/4033090/136695857-d098c27d-f4b2-4c71-8574-b5f4291779cb.png "Melon Gaming")](https://www.melongaming.com)

[![Altbyte Pte Ltd](https://user-images.githubusercontent.com/4033090/136692693-35dca8aa-5012-4a37-9ea2-51640d2e6d73.png "AltByte")](https://www.altbyte.com)
