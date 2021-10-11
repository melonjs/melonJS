melonJS 2
=========
[![Build Status](https://travis-ci.org/melonjs/melonJS.svg)](https://travis-ci.org/melonjs/melonJS)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/melonjs/melonJS.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/melonjs/melonJS/context:javascript)
[![Build Size](https://badgen.net/bundlephobia/min/melonjs)](https://bundlephobia.com/result?p=melonjs)
[![Dependencies](https://img.shields.io/david/melonjs/melonJS.svg)](https://david-dm.org/melonjs/melonJS)
[![NPM Package](https://img.shields.io/npm/v/melonjs)](https://www.npmjs.com/package/melonjs)
[![Boss Bounty Badge](https://img.shields.io/endpoint.svg?url=https://api.boss.dev/badge/enabled/melonjs/melonJS)](https://www.boss.dev/issues/repo/melonjs/melonJS)


A fresh, _modern_ & lightweight HTML5 game engine
-------------------------------------------------------------------------------
![melonJS](http://melonjs.org/media/alex4-github.png)

melonJS 2 is a modern version of the melonJS game engine. It has been rebuilt almost entirely using ES6 class, inheritance and semantic, and is bundled using Rollup to provide modern features such as transpiling and tree-shaking.

>Note: migrating an existing project to melonJS 2 (version 10.0 and higher) will definitely break your game (ES6 semantic, no more Jay inheritance, and no backward compatibility with deprecated APIs), and you might want to read first this small step by step guide on [upgrading to melonJS 2](https://github.com/melonjs/melonJS/wiki/Upgrading-to-melonJS-2). If you are looking at the legacy version (9.x and lower) of melonJS, you can find it [here](https://github.com/melonjs/melonJS/tree/legacy) under the _legacy_ branch.

[melonJS](http://melonjs.org/) is open-source, licensed under the [MIT License](LICENSE.md), and actively developed and maintained with the help of a small team of enthusiasts at AltByte in Singapore.

About melonJS
-------------------------------------------------------------------------------

[melonJS](http://melonjs.org/) is a fully featured game engine :

Compatibility
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with all major browsers (Chrome, Safari, Firefox, Opera, Edge) and mobile devices

Graphics
- 2D sprite-based graphic engine
- Fast WebGL 1 & 2 renderer for desktop and mobile devices with fallback to Canvas rendering
- High DPI resolution & Canvas advanced auto scaling
- Sprite with Animation management
- built-in effects such as tinting and masking
- Standard spritesheet, single and multiple Packed Textures support
- System & Bitmap Text

Sound
- Web Audio support with spatial audio or stereo panning based on [Howler](https://howlerjs.com)
- fallback to Multi-channel HTML5 audio for legacy browsers

Physic
- Lightweight 2d physics implementation to ensure low cpu requirements
- Polygon (SAT) based collision algorithm for accurate detection and response
- Fast Broad-phase collision detection using spatial partitioning

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
- Asynchronous publish/subscribe pattern messaging support (minPubSub)

Tools integration
-------------------------------------------------------------------------------
 [![Free Texture Packer](https://user-images.githubusercontent.com/4033090/136762061-1d3a0dfe-dbe0-4d3d-808d-47a49ecf5309.png "Free Texture Packer")](http://free-tex-packer.com)
 [![TexturePacker](https://user-images.githubusercontent.com/4033090/136762472-bc55a638-c69b-4ff5-9d03-c684c8bea0ea.png "TexturePacker")](https://www.codeandweb.com/texturepacker)
 [![PhysicsEditor](https://user-images.githubusercontent.com/4033090/136762890-b1010c7f-cb19-4d35-a3f1-f5048db07835.png "PhysicsEditor")](https://www.codeandweb.com/physicseditor)
 [![ShoeBox](https://user-images.githubusercontent.com/4033090/136762705-92027d94-d87c-4a95-b051-26647410248d.png "ShoeBox")](https://renderhjs.net/shoebox/)
 [![Tiled](https://user-images.githubusercontent.com/4033090/136762999-5a7f377b-4136-4205-9fe0-83728c90cb9b.png "Tiled")](https://www.mapeditor.org)
 [![Cordova](https://user-images.githubusercontent.com/4033090/136763147-6d157ce6-6921-437e-bb8f-0287b86109da.png "Cordova")](https://cordova.apache.org)

Tools integration and usage with melonJS is documented in our [Wiki](https://github.com/melonjs/melonJS/wiki#third-party-tools-usage).


Using melonJS
-------------------------------------------------------------------------------

Basic Example

```JavaScript
import * as me from "melonjs.module.js";

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
> Simple hello world using melonJS 9.x or higher

Documentation :

* [Online API](http://melonjs.github.io/melonJS/docs/) ([offline](https://github.com/melonjs/melonJS/archive/gh-pages.zip) version under the `docs` directory)
* [Examples](https://melonjs.github.io/examples/)

For your first time using melonJS, follow these tutorials :

- [Platformer](http://melonjs.github.io/tutorial-platformer/) Step by Step Tutorial.
- [Space Invaders](http://melonjs.github.io/tutorial-space-invaders/) Step by Step Tutorial.

> Note: current version of both the tutorials are not compatible with the ES6 version.

You may find it useful to skim the overview found at the wiki [Details & Usage](https://github.com/melonjs/melonJS/wiki#details--usage)

When starting your own projects, checkout our [es6 boilerplate](https://github.com/melonjs/es6-boilerplate)

Download melonJS
-------------------------------------------------------------------------------

The latest builds with corresponding release note are available for direct download [here](https://github.com/melonjs/melonJS/releases).

Since version 10.0.0 melonJS provides different build options :

| build               | description |
| ------------------- | ----------- |
| `melonjs.module.js` | the ES6 Module (ESM) Bundle |
| `melonjs.module.d.ts` | typescript declaration file for the ES6 Module (ESM) Bundle |
| `melonjs.js`        | a ES5 UMD Bundle (directly transpiled from the ES6 version) |
| `melonjs.min.js`    | a minified version of the ES5 UMD bundle |

Alternatively, the latest version of melonJS can be installed through [NPM](https://www.npmjs.com/package/melonjs) :

    $ npm install melonjs

If you need to import the ES6 module of melonjs (for Webpack):

    $ import * as me from 'melonjs/dist/melonjs.module.js';

> Note: when using the es6 module, deprecated methods need to be manually applied, see [here](http://melonjs.github.io/melonJS/docs/me.deprecated.html#.apply)

Or can simply be added to your html, through a content delivery network (CDN) URL, using for example :

```html
<!-- load the ES5 UMD bundle of melonJS v10.0.0 -->
<script src="https://cdn.jsdelivr.net/npm/melonjs@10.0.0/dist/melonjs.js"></script>
<!-- load the ES6 module bundle of melonJS v10.0.0 -->
<script src="https://cdn.jsdelivr.net/npm/melonjs@10.0.0/dist/melonjs.module.js"></script>
<!-- omit the version completely to get the latest one -->
<!-- you should NOT use this in production -->
<script src="https://cdn.jsdelivr.net/npm/melonjs/dist/melonjs.js"></script>
<!-- add ".min" to any JS/CSS file to get a minified version -->
<script src="https://cdn.jsdelivr.net/npm/melonjs@10.0.0/dist/melonjs.min.js"></script>
```
> Note: "official" CDN and NPM install are only available from version 7.0.0 and onwards.

and of course the debug panel :
```html
<!-- load the latest debug panel -->
<script src="https://cdn.jsdelivr.net/npm/melonjs/plugins/debug/debugPanel.js"></script>
<!-- or a specific corresponding release -->
<script src="https://cdn.jsdelivr.net/npm/melonjs@9.0.0/plugins/debug/debugPanel.js"></script>
```
> Note: current version of the debugPanel is not compatible with the ES6 ESM version.

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

The generated library will be available under the `build` directory :
- `melonjs.js` : plain ES5 UMD bundle
- `melonjs.min.js` : minified ES5 UMD bundle
- `melonjs.module.js` : plain ES6 module

To run the melonJS test suite simply use the following:

    $ npm run test

This will run the jasmine spec tests with the output displayed on the shell. Do
note that the latest Chrome version is required, as the test unit will run the
Browser in a headless mode (in case of failed tests, upgrade your browser).


Building the documentation
-------------------------------------------------------------------------------
Similarly, you can build your own copy of the docs locally by running :

    $ npm run doc

The generated documentation will be available in the `docs` directory

WIP Builds
-------------------------------------------------------------------------------
melonJS uses Travis-CI for automated testing and build uploads. The latest build
artifacts can be downloaded from the [melonjs-builds](https://melonjs-builds.s3.amazonaws.com/index.html?prefix=artifacts/)
bucket.

Questions, need help ?
-------------------------------------------------------------------------------
If you need technical support, you can contact us through the following channels :
* [melonJS developer forum](http://www.html5gamedevs.com/forum/32-melonjs/)
* [gitter web chat](https://gitter.im/melonjs/public)
* [melonJS wikipage](https://github.com/melonjs/melonJS/wiki)
* [Discord](https://discord.gg/aur7JMk)

For any other non technical related questions, feel free to also send us an [email](mailto:contact@melonjs.org)

Sponsors
-------------------------------------------------------------------------------
Support the development of melonJS by [becoming a sponsor](https://github.com/sponsors/melonjs). Get your logo in our README with a link to your site or become a backer and get your name in the [BACKERS](BACKERS.md) list. Any level of support is really appreciated and goes a long way !

[![Melon Gaming](https://user-images.githubusercontent.com/4033090/136695857-d098c27d-f4b2-4c71-8574-b5f4291779cb.png "Melon Gaming")](https://www.melongaming.com)

[![Altbyte Pte Ltd](https://user-images.githubusercontent.com/4033090/136692693-35dca8aa-5012-4a37-9ea2-51640d2e6d73.png "AltByte")]()
