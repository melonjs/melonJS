melonJS 2
=========
![melonJS Logo](https://github.com/melonjs/melonJS/raw/master/media/Banner/Banner%20-%20Billboard%20-%20Original%20Logo%20-%20horizontal.png)

[![Build Status](https://travis-ci.org/melonjs/melonJS.svg)](https://travis-ci.org/melonjs/melonJS)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/melonjs/melonJS.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/melonjs/melonJS/context:javascript)
[![Build Size](https://badgen.net/bundlephobia/min/melonjs)](https://bundlephobia.com/result?p=melonjs)
[![NPM Package](https://img.shields.io/npm/v/melonjs)](https://www.npmjs.com/package/melonjs)
[![jsDeliver](https://data.jsdelivr.com/v1/package/npm/melonjs/badge?style=rounded)](https://www.jsdelivr.com/package/npm/melonjs)
[![Boss Bounty Badge](https://img.shields.io/endpoint.svg?url=https://api.boss.dev/badge/enabled/melonjs/melonJS)](https://www.boss.dev/issues/repo/melonjs/melonJS)


A fresh, _modern_ & lightweight HTML5 game engine
-------------------------------------------------------------------------------
![melonJS](https://melonjs.org/img/alex4-github.png)

melonJS 2 is a modern version of the melonJS game engine. It has been rebuilt almost entirely using ES6 class, inheritance and semantic, and is bundled using Rollup to provide modern features such as transpiling and tree-shaking.

>Note: migrating an existing project to melonJS 2 (version 10.0 and higher) will definitely break your game (ES6 semantic, no more Jay inheritance, nodeJS event emitter, and no backward compatibility with deprecated legacy APIs), and you might want to read first this small step by step guide on [upgrading to melonJS 2](https://github.com/melonjs/melonJS/wiki/Upgrading-to-melonJS-2). If you are looking at the legacy version (9.x and lower) of melonJS, you can find it [here](https://github.com/melonjs/melonJS/tree/legacy) under the _legacy_ branch.

[melonJS](https://melonjs.org/) is open-source, licensed under the [MIT License](LICENSE.md), and actively developed and maintained with the help of a small team of enthusiasts at AltByte in Singapore.

About melonJS
-------------------------------------------------------------------------------

[melonJS](https://melonjs.org/) is a fully featured game engine :

Compatibility
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with all major browsers (Chrome, Safari, Firefox, Opera, Edge) and mobile devices

Graphics
- 2D sprite-based graphic engine
- Fast WebGL 1 & 2 renderer for desktop and mobile devices with fallback to Canvas rendering
- High DPI resolution & Canvas advanced auto scaling
- Sprite with 9-slice scaling option, and animation management
- built-in effects such as tinting and masking
- Standard spritesheet, single and multiple Packed Textures support
- System & Bitmap Text

Sound
- Web Audio support with spatial audio or stereo panning based on [Howler](https://howlerjs.com)
- fallback to Multi-channel HTML5 audio for legacy browsers

Physic
- Polygon (SAT) based collision algorithm for accurate detection and response
- Fast Broad-phase collision detection using spatial partitioning
- Collision filtering for optimized automatic collision detection

Input
- Mouse and Touch device support (with mouse emulation)
- Device motion & accelerometer support

Level Editor
- Tiled map format version +1.0 integration for easy level design
    - Uncompressed Plain, Base64, CSV and JSON encoded XML tilemap loading
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
 [![Free Texture Packer](https://user-images.githubusercontent.com/4033090/136762061-1d3a0dfe-dbe0-4d3d-808d-47a49ecf5309.png "Free Texture Packer")](http://free-tex-packer.com)
 [![TexturePacker](https://user-images.githubusercontent.com/4033090/136762472-bc55a638-c69b-4ff5-9d03-c684c8bea0ea.png "TexturePacker")](https://www.codeandweb.com/texturepacker)
 [![PhysicsEditor](https://user-images.githubusercontent.com/4033090/136762890-b1010c7f-cb19-4d35-a3f1-f5048db07835.png "PhysicsEditor")](https://www.codeandweb.com/physicseditor)
 [![ShoeBox](https://user-images.githubusercontent.com/4033090/136762705-92027d94-d87c-4a95-b051-26647410248d.png "ShoeBox")](https://renderhjs.net/shoebox/)
 [![Tiled](https://user-images.githubusercontent.com/4033090/136762999-5a7f377b-4136-4205-9fe0-83728c90cb9b.png "Tiled")](https://www.mapeditor.org)
 [![Cordova](https://user-images.githubusercontent.com/4033090/136763147-6d157ce6-6921-437e-bb8f-0287b86109da.png "Cordova")](https://cordova.apache.org)

Tools integration and usage with melonJS is documented in our [Wiki](https://github.com/melonjs/melonJS/wiki#third-party-tools-usage).


# Using melonJS

### For your first time using melonJS, this is where you start

- [melonJS: Hacking a Platformer Game](https://melonjs.org/tutorial/)

You may find it useful to skim the overview found at the wiki [Details & Usage](https://github.com/melonjs/melonJS/wiki#details--usage)

When starting your own projects, checkout our [es6 boilerplate](https://github.com/melonjs/es6-boilerplate)

Demos
-------------------------------------------------------------------------------

A few demos of melonJS capabilities :

* [Platformer Demo](https://melonjs.github.io/examples/platformer/)
* [Isometric Demo](https://melonjs.github.io/examples/isometric_rpg/)
* [Sprite Demo](https://melonjs.github.io/examples/sprite/)
* [Masking Demo](https://melonjs.github.io/examples/masking/)
* [Primitive Drawing Demo](https://melonjs.github.io/examples/graphics/)
* [UI Demo](https://melonjs.github.io/examples/UI/)

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

    // add a gray background to the default Stage
    me.game.world.addChild(new me.ColorLayer("background", "#202020"));

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

Download melonJS
-------------------------------------------------------------------------------

The latest builds with corresponding release note are available for direct download [here](https://github.com/melonjs/melonJS/releases).

melonJS 2 now only provides an ES6 Bundle :

| build               | description |
| ------------------- | ----------- |
| `melonjs.module.js` | the ES6 Module (ESM) Bundle |
| `melonjs.module.d.ts` | typescript declaration file for the ES6 Module (ESM) Bundle |

>Note: if you need your application to be compatible with ES5, refer to our [boilerplate](https://github.com/melonjs/es6-boilerplate) that provides automatic transpiling to ES5.

Alternatively, the latest version of melonJS can be installed through [NPM](https://www.npmjs.com/package/melonjs) :

    $ npm install melonjs

If you need to import the ES6 module of melonjs (e.g. for Webpack):

    $ import * as me from 'melonjs/dist/melonjs.module.js';

Or can simply be added to your html, using [jsDeliver](https://www.jsdelivr.com/package/npm/melonjs) content delivery network (CDN) :

```html
<!-- load the ES6 module bundle of melonJS v10.0 -->
<script src="https://esm.run/melonjs@10.0"></script>
<!-- omit the version completely to get the latest one -->
<!-- you should NOT use this in production -->
<script src="https://esm.run/melonjs"></script>
```
> Note: starting from the 10.0.0 version, the debug plugin is no longer provided as part of the melonJS library release, and has been moved to the official [boilerplate](https://github.com/melonjs/es6-boilerplate)

Building melonJS
-------------------------------------------------------------------------------
For most users, all you probably want is to use melonJS, and all you need then is just to download the latest built [release](https://github.com/melonjs/melonJS#download-melonjs) to get started. The only time you should need to build melonJS is if you want to contribute to the project and start developing on it.

To build your own version of melonJS you will need to install :

- The [Node.js](http://nodejs.org/) JavaScript runtime and the [NPM](https://npmjs.org/) package manager

Once Node.js and NPM have been installed, you need to install build dependencies,
by executing the following in the folder where you cloned the repository :

    $ [sudo] npm install

Then build the melonJS source by running:

    $ npm run build

The generated files will be available under the `build` directory :
- `melonjs.module.js` : plain ES6 module
- `melonjs.module.d.ts` : typescript declaration for the ES6 Module

To run the melonJS test suite simply use the following:

    $ npm run test

This will run the jasmine spec tests with the output displayed on the shell. Do
note that the latest Chrome version is required, as the test unit will run the
Browser in a headless mode (in case of failed tests, upgrade your browser).

Last but not least, if you really want to contribute, but not sure how, you can
always check our [discussions](https://github.com/melonjs/melonJS/discussions/categories/ideas) list to get some idea on where to start.

Building the documentation
-------------------------------------------------------------------------------
Similarly, you can build your own copy of the docs locally by running :

    $ npm run doc

The generated documentation will be available in the `docs` directory

WIP Builds
-------------------------------------------------------------------------------
latest WIP builds are available under [`dist`](dist/) in the [master](https://github.com/melonjs/melonJS/tree/master) branch.

Questions, need help ?
-------------------------------------------------------------------------------
If you need technical support, you can contact us through the following channels :
* Forums: with melonJS 2 we moved to a new discourse [forum](https://melonjs.discourse.group), but we can still also find the previous one [here](http://www.html5gamedevs.com/forum/32-melonjs/)
* Chat: come and chat with us on [discord](https://discord.gg/aur7JMk), or [gitter](https://gitter.im/melonjs/public)
* we tried to keep our [wikipage](https://github.com/melonjs/melonJS/wiki) up-to-date with useful links, tutorials, and anything related melonJS.


Sponsors
-------------------------------------------------------------------------------
Support the development of melonJS by [becoming a sponsor](https://github.com/sponsors/melonjs). Get your logo in our README with a link to your site or become a backer and get your name in the [BACKERS](BACKERS.md) list. Any level of support is really appreciated and goes a long way !

[![Melon Gaming](https://user-images.githubusercontent.com/4033090/136695857-d098c27d-f4b2-4c71-8574-b5f4291779cb.png "Melon Gaming")](https://www.melongaming.com)

[![Altbyte Pte Ltd](https://user-images.githubusercontent.com/4033090/136692693-35dca8aa-5012-4a37-9ea2-51640d2e6d73.png "AltByte")]()
