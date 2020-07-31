melonJS
=======
[![Build Status](https://travis-ci.org/melonjs/melonJS.svg)](https://travis-ci.org/melonjs/melonJS)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/melonjs/melonJS.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/melonjs/melonJS/context:javascript)
[![Build Size](https://badgen.net/bundlephobia/min/melonjs)](https://bundlephobia.com/result?p=melonjs)
[![Dependencies](https://img.shields.io/david/melonjs/melonJS.svg)](https://david-dm.org/melonjs/melonJS)
[![Inline docs](http://inch-ci.org/github/melonjs/melonJS.svg?branch=master)](http://inch-ci.org/github/melonjs/melonJS)
[![jsDeliver](https://data.jsdelivr.com/v1/package/npm/melonjs/badge)](https://www.jsdelivr.com/package/npm/melonjs)


A fresh & lightweight HTML5 game engine
-------------------------------------------------------------------------------
![melonJS](http://melonjs.org/media/alex4-github.png)

Copyright (C) 2011 - 2020 Olivier Biot

[melonJS](http://melonjs.org/) is licensed under the [MIT License](http://www.opensource.org/licenses/mit-license.php)

About melonJS
-------------------------------------------------------------------------------

[melonJS](http://melonjs.org/) is the result of our enthusiasm & experiments with Javascript,
and currently features :

- A fresh & lightweight 2D sprite-based engine
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with all major browsers (Chrome, Safari, Firefox, Opera, Edge) and mobile devices
- Fast WebGL renderer for desktop and mobile devices with fallback to Canvas rendering
- High DPI resolution & Canvas advanced auto scaling
- Web Audio support with fallback to Multi-channel HTML5 audio
- Lightweight physics implementation to ensure low cpu requirements
- Polygon (SAT) based collision algorithm for accurate detection and response
- Fast Broad-phase collision detection using spatial partitioning
- 3rd party tools support for physic body definition such as [PhysicsEditor](https://www.codeandweb.com/physicseditor)
- Advanced math API for Vector and Matrix
- Tween Effects, Transition effects
- Basic set of Object Entities and GUI elements included
- Pooling support for object recycling
- Basic Particle System
- Sprite with Animation management
- Standard spritesheet, single and multiple Packed Textures support
- 3rd party tools support for Texture Packing such as [TexturePacker](https://www.codeandweb.com/texturepacker), [Free Texture Packer](http://free-tex-packer.com), [ShoeBox](https://renderhjs.net/shoebox/)
- A state manager (to easily manage loading, menu, options, in-game state)
- Tiled map format version +1.0 integration for easy level design
    - Uncompressed Plain, Base64, CSV and JSON encoded XML tilemap loading
    - Orthogonal, Isometric and Hexagonal maps (both normal and staggered)
    - Multiple layers (multiple background/foreground, collision and Image layers)
    - Multiple Tileset support
    - Tileset Transparency settings
    - Layers Alpha settings
    - Rectangle, Ellipse, Polygon and Polyline objects support
    - Tiled Objects
    - Flipped & rotated Tiles
    - Dynamic Layer and Object/Group ordering
    - Dynamic Entity loading
    - Shape based Tile collision support
- System & Bitmap fonts
- Mouse and Touch device support (with mouse emulation)
- Device motion & accelerometer support
- Built-in support for 3rd party Application Wrappers such as [Cordova](https://cordova.apache.org)
- Asynchronous publish/subscribe pattern messaging support (minPubSub)
- A fully customizable preloader
- As light as [~70kb](https://bundlephobia.com/result?p=melonjs@latest) minified & gzipped

Using melonJS
-------------------------------------------------------------------------------

Basic Example

```JavaScript
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
> Simple hello world using melonJS 8.x or higher

Documentation :

* [Online API](http://melonjs.github.io/melonJS/docs/) ([offline](https://github.com/melonjs/melonJS/archive/gh-pages.zip) version under the `docs` directory)
* [Examples](http://melonjs.github.io/melonJS/)

For your first time using melonJS, follow these tutorials :

- [Platformer](http://melonjs.github.io/tutorial-platformer/) Step by Step Tutorial.
- [Space Invaders](http://melonjs.github.io/tutorial-space-invaders/) Step by Step Tutorial.

You may find it useful to skim the overview found at the wiki [Details & Usage](https://github.com/melonjs/melonJS/wiki#details--usage)

When starting your own projects, checkout the [boilerplate](https://github.com/melonjs/boilerplate)

Download melonJS
-------------------------------------------------------------------------------

The latest build (plain and minified) with corresponding release note is available for direct download [here](https://github.com/melonjs/melonJS/releases).

Alternatively, the latest version of melonJS can be installed through [NPM](https://www.npmjs.com/package/melonjs) :

    $ npm install melonjs

Or can simply be added to your html, through a content delivery network (CDN) URL, using for example :

```html
<script src="https://cdn.jsdelivr.net/npm/melonjs@latest/dist/melonjs.js"></script>
```
or the following for the minified version :
```html
<script src="https://cdn.jsdelivr.net/npm/melonjs@latest/dist/melonjs.min.js"></script>
```
and of course the debug panel :
```html
<script src="https://cdn.jsdelivr.net/npm/melonjs@latest/plugins/debug/debugPanel.js"></script>
```

> Note: "official" CDN and NPM install are only available from version 7.0.0 and onwards.

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

The generated library will be available under the `build` directory.

Building the documentation
-------------------------------------------------------------------------------
Similarly, you can build your own copy of the docs locally by running :

    $ npm run doc

The generated documentation will be available in the `docs` directory

Testing
-------------------------------------------------------------------------------

To run melonJS tests in node simply run the following:

    $ npm run test

This will run the jasmine spec tests with the output displayed on the shell. Do
note that the latest Chrome version is required, as the test unit will run the
Browser in a headless mode (in case of failed tests, upgrade your browser).

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

For any other non technical related questions, feel free to also send us an [email](mailto:contact@melonjs.org).
