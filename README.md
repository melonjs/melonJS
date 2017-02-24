melonJS
=======
[![Build Status](https://travis-ci.org/melonjs/melonJS.svg)](https://travis-ci.org/melonjs/melonJS)
[![Inline docs](http://inch-ci.org/github/melonjs/melonjs.svg?branch=master)](http://inch-ci.org/github/melonjs/melonjs)

A fresh & lightweight HTML5 game engine
-------------------------------------------------------------------------------
![melonJS](http://melonjs.org/media/alex4-github.png)

Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod

[melonJS](http://melonjs.org/) is licensed under the [MIT License](http://www.opensource.org/licenses/mit-license.php)

About melonJS
-------------------------------------------------------------------------------

[melonJS](http://melonjs.org/) is the result of our enthusiasm & experiments with Javascript,
and currently features :

- A fresh & lightweight 2D sprite-based engine
- Standalone library (does not rely on anything else, except a HTML5 capable browser)
- Compatible with most major browsers (Chrome, Safari, Firefox, Opera, IE) and mobile devices
- Device motion & accelerometer support
- High DPI & auto scaling
- Multi-channel HTML5 audio support and Web Audio on supported devices
- Lightweight physics implementation to ensure low cpu requirements
- Polygon (SAT) based collision algorithm for accurate detection and response
- Fast Broad-phase collision detection using spatial partitioning
- 3rd party tools support for physic body definition (PhysicEditor, Physic Body Editor)
- Advanced math API for Vector and Matrix
- Tween Effects
- Transition effects
- A basic set of Object Entities (to be extended)
- Object Pooling
- Basic Particle System
- Basic animation management
- Standard spritesheet and Packed Textures (Texture Packer, ShoeBox) support
- A state manager (to easily manage loading, menu, options, in-game state)
- Tiled map format version +0.9.x integration for easy level design
    - Uncompressed Plain, Base64, CSV and JSON encoded XML tilemap loading
    - Orthogonal, Isometric and Perspective tilemap support
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
- System & bitmap fonts
- Mouse and Touch device support (with mouse emulation)
- Built-in support for [CocoonJS](https://www.ludei.com/cocoonjs/) and [Ejecta](https://github.com/melonjs/melonJS/wiki/How-to-build-your-game-for-tvOS-(or-iOS)-using-Ejecta)
- Asynchronous messaging support (minPubSub)
- Basic GUI elements included
- Customizable loader

Using melonJS
-------------------------------------------------------------------------------

* [API Documentation](http://melonjs.github.io/melonJS/docs/)
* [Examples](http://melonjs.github.io/melonJS/)

For your first time using melonJS, follow these tutorials :

- [Platformer](http://melonjs.github.io/tutorial-platformer/) Step by Step Tutorial.
- [Space Invaders](http://melonjs.github.io/tutorial-space-invaders/) Step by Step Tutorial.

When starting your own projects, checkout the [boilerplate](https://github.com/melonjs/boilerplate)

**Note** that due to the _cross-origin request_ policy implemented in most browsers
(that prevents from accessing local files), you will need to either disable this
security check (see the tutorial), or better use a "personal" local web server
like the `grunt connect` task that is used for building melonJS (see below for building melonJS).

Building melonJS
-------------------------------------------------------------------------------
To build your own version of melonJS you will need to install :

- The [Node.js](http://nodejs.org/) JavaScript runtime and [npm](https://npmjs.org/) package manager
- The [Grunt](http://gruntjs.com/) task manager

Once the Node.js package manager has been installed (using the installer from their website),
you need to install build dependencies and Grunt CLI (Command Line Interface), by doing the following :

Open a [Terminal](http://www.apple.com/osx/apps/all.html#terminal) or a [Command Prompt](http://en.wikipedia.org/wiki/Command_Prompt) and
type the following :

    $ [sudo] npm install -g grunt-cli

Next you need to install the melonJS dependencies, by typing :

    $ cd melonJS
    $ npm install

Once this is done, you can build melonJS :

    $ cd melonJS # if not already in the melonJS directory
    $ grunt

Both plain and minified versions of the library will be available under the "build" directory.

Building the documentation
-------------------------------------------------------------------------------
Here is how you can build your own copy of the docs locally :

    $ cd melonJS # if not already in the melonJS directory
    $ grunt doc

The generated documentation will be available in the `docs` directory

Testing
-------------------------------------------------------------------------------
The recommended way to test is to use the `serve` task:

    $ grunt serve

Then navigate to http://localhost:8000/ in your browser. Stop the server when
you are done by pressing `Ctrl+C` in the terminal.


To run melonJS tests in node simply run the following:

    $ grunt test

This will run the jasmine spec tests with the output displayed on the shell. This however, is not
recommended because the tests are run by PhantomJS in this mode, and there are a
lot of known bugs and unsupported features in the version of WebKit shipped
with PhantomJS.

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
